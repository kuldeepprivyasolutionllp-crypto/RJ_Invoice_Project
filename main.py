"""
The web layer. Run it with:

    uvicorn main:app --reload --port 8000

Then open http://localhost:8000/docs

That /docs page is FastAPI's best feature for learning. It is generated
automatically from your Pydantic schemas, and you can fire real requests
at your own API from the browser - before you have written any React at
all. Do that first. Get a POST working there, THEN wire up the frontend.
"""

from decimal import Decimal

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.orm import Session

import models
import schemas
from calculations import compute_line, amount_in_words, money
from database import engine, get_db
from pdf_renderer import render_invoice_pdf

# Creates tables if they do not exist. Fine for learning.
# For the real project use Alembic migrations instead - this cannot
# handle changing a column that already has data in it.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Invoice Learning API")


# ---------------------------------------------------------------
# CORS - the thing that breaks everyone's first day
# ---------------------------------------------------------------
# Your React dev server runs on http://localhost:5173.
# Your API runs on http://localhost:8000.
# Different port = different "origin". Browsers block cross-origin
# requests by default, so without this block your fetch() fails with
# a CORS error in the console even though the API is working fine.
#
# Note this is a BROWSER rule. curl and the /docs page are unaffected,
# which is why "it works in /docs but not in React" is such a common
# first bug.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def next_invoice_number(db: Session) -> int:
    """
    Simplified: MAX + 1.

    The real system needs a `number_series` table with SELECT ... FOR UPDATE,
    reset per financial year, and the number allocated only at the moment of
    issue. Two users clicking Save at the same instant would both get the
    same number here. Good enough to learn with, not good enough to ship.
    """
    current_max = db.execute(select(func.max(models.Invoice.invoice_no))).scalar()
    return (current_max or 1478) + 1


@app.post("/api/invoices", response_model=schemas.InvoiceOut, status_code=201)
def create_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """
    THIS IS THE FUNCTION TO STUDY. Trace it line by line.

    Notice what FastAPI already did before your first line runs:

      * read the HTTP body
      * parsed the JSON text into a dict
      * validated it against InvoiceCreate
      * built a real Python object with real Decimals and a real date

    `payload` is not a dict. payload.buyer_name is a str. payload.lines
    is a list of objects. If the browser sent quantity: -5, this function
    was never called - the client already got a 422 with an explanation
    of exactly which field failed.

    `db: Session = Depends(get_db)` is FastAPI's dependency injection.
    It calls get_db(), takes what it yields, and passes it in.
    """

    invoice = models.Invoice(
        invoice_no=next_invoice_number(db),
        invoice_date=payload.invoice_date,
        buyer_name=payload.buyer_name,
        buyer_address=payload.buyer_address,
        buyer_gstin=payload.buyer_gstin,
        po_no=payload.po_no,
        place_of_supply_code=payload.place_of_supply_code,
        exclude_gst_from_total=payload.exclude_gst_from_total,
    )

    taxable = cgst = sgst = igst = Decimal("0")

    for index, line_in in enumerate(payload.lines, start=1):
        # Recomputed on the server from qty and rate. The browser's
        # numbers are for display only; they are never persisted.
        computed = compute_line(
            line_in.quantity, line_in.rate, line_in.gst_rate,
            payload.place_of_supply_code,
        )

        invoice.lines.append(models.InvoiceLine(
            sn=index,
            item_name=line_in.item_name,
            description=line_in.description,
            hsn_sac=line_in.hsn_sac,
            quantity=line_in.quantity,
            rate=line_in.rate,
            **computed,
        ))

        taxable += computed["taxable_value"]
        cgst += computed["cgst_amount"]
        sgst += computed["sgst_amount"]
        igst += computed["igst_amount"]

    invoice.taxable_total = money(taxable)
    invoice.cgst_total = money(cgst)
    invoice.sgst_total = money(sgst)
    invoice.igst_total = money(igst)
    tax_total = money(cgst + sgst + igst)
    invoice.tax_total = tax_total

    if payload.exclude_gst_from_total:
        # Special condition (e.g. Pharma): GST is not added to the final total cost
        invoice.grand_total = money(taxable)
        invoice.amount_in_words = amount_in_words(invoice.grand_total)
        invoice.tax_in_words = amount_in_words(tax_total)
    else:
        # Standard: Final total cost includes GST
        invoice.grand_total = money(taxable + tax_total)
        invoice.amount_in_words = amount_in_words(invoice.grand_total)
        invoice.tax_in_words = ""

    db.add(invoice)      # stage it - nothing has hit Postgres yet
    db.commit()          # NOW the INSERTs run. Watch your terminal.
    db.refresh(invoice)  # re-read, so invoice.id is populated

    # Returning a SQLAlchemy object. FastAPI runs it through InvoiceOut,
    # which converts it to JSON text for the response body.
    return invoice


@app.get("/api/invoices", response_model=list[schemas.InvoiceListItem])
def list_invoices(db: Session = Depends(get_db)):
    stmt = select(models.Invoice).order_by(models.Invoice.invoice_no.desc())
    return db.execute(stmt).scalars().all()


@app.get("/api/invoices/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """
    invoice_id comes from the URL path. FastAPI reads the `int` type hint,
    converts "7" to 7, and returns 422 automatically if someone requests
    /api/invoices/banana.
    """
    invoice = db.get(models.Invoice, invoice_id)
    if invoice is None:
        # This becomes an HTTP 404 with {"detail": "Invoice not found"}.
        # Your React code checks response.ok and shows the message.
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@app.get("/api/invoices/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    """
    Same data, different representation.

    Note the response is bytes, not JSON. The Content-Type header is what
    tells the browser to treat it as a PDF. `inline` opens it in a viewer
    tab; change to `attachment` to force a download.
    """
    invoice = db.get(models.Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pdf_bytes = render_invoice_pdf(invoice)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'inline; filename="Invoice_{invoice.invoice_no}.pdf"'
        },
    )


@app.get("/api/invoices/{invoice_id}/preview", response_class=Response)
def preview_invoice_html(invoice_id: int, db: Session = Depends(get_db)):
    """
    Handy while building the template: renders the same HTML the PDF is
    made from, straight into your browser. Much faster to iterate on
    than regenerating a PDF every time you nudge a border.
    """
    from pdf_renderer import render_invoice_html

    invoice = db.get(models.Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Response(content=render_invoice_html(invoice), media_type="text/html")


# ---------------------------------------------------------------
# Buyer Company Master (CRUD)
# ---------------------------------------------------------------

@app.post("/api/buyers", response_model=schemas.BuyerOut, status_code=201)
def create_buyer(payload: schemas.BuyerCreate, db: Session = Depends(get_db)):
    """Create a new buyer company in the database."""
    buyer = models.Buyer(
        name=payload.name.strip(),
        address=payload.address.strip(),
        gstin=payload.gstin.strip().upper(),
        state_code=payload.state_code.strip(),
        email=payload.email.strip(),
        phone=payload.phone.strip(),
    )
    db.add(buyer)
    db.commit()
    db.refresh(buyer)
    return buyer


@app.get("/api/buyers", response_model=list[schemas.BuyerOut])
def list_buyers(db: Session = Depends(get_db)):
    """Return all buyer companies ordered by name."""
    stmt = select(models.Buyer).order_by(models.Buyer.name.asc())
    return db.execute(stmt).scalars().all()


@app.get("/api/buyers/{buyer_id}", response_model=schemas.BuyerOut)
def get_buyer(buyer_id: int, db: Session = Depends(get_db)):
    """Fetch a single buyer company by ID."""
    buyer = db.get(models.Buyer, buyer_id)
    if buyer is None:
        raise HTTPException(status_code=404, detail="Buyer company not found")
    return buyer


@app.put("/api/buyers/{buyer_id}", response_model=schemas.BuyerOut)
def update_buyer(buyer_id: int, payload: schemas.BuyerUpdate, db: Session = Depends(get_db)):
    """Update an existing buyer company's details."""
    buyer = db.get(models.Buyer, buyer_id)
    if buyer is None:
        raise HTTPException(status_code=404, detail="Buyer company not found")

    if payload.name is not None:
        buyer.name = payload.name.strip()
    if payload.address is not None:
        buyer.address = payload.address.strip()
    if payload.gstin is not None:
        buyer.gstin = payload.gstin.strip().upper()
    if payload.state_code is not None:
        buyer.state_code = payload.state_code.strip()
    if payload.email is not None:
        buyer.email = payload.email.strip()
    if payload.phone is not None:
        buyer.phone = payload.phone.strip()

    db.commit()
    db.refresh(buyer)
    return buyer


@app.delete("/api/buyers/{buyer_id}", status_code=200)
def delete_buyer(buyer_id: int, db: Session = Depends(get_db)):
    """Delete a buyer company from the database."""
    buyer = db.get(models.Buyer, buyer_id)
    if buyer is None:
        raise HTTPException(status_code=404, detail="Buyer company not found")

    db.delete(buyer)
    db.commit()
    return {"detail": "Buyer deleted successfully"}


# ---------------------------------------------------------------
# Item / Product Master (CRUD)
# ---------------------------------------------------------------

@app.post("/api/items", response_model=schemas.ItemOut, status_code=201)
@app.post("/api/invoice/item_add", response_model=schemas.ItemOut, status_code=201)
def create_item(payload: schemas.ItemCreate, db: Session = Depends(get_db)):
    """Add a new item to the product master."""
    item = models.Item(
        item_name=payload.item_name.strip(),
        description=payload.description.strip(),
        hsn_sac=payload.hsn_sac.strip(),
        rate=payload.rate,
        gst_rate=payload.gst_rate,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/api/items", response_model=list[schemas.ItemOut])
@app.get("/api/invoice/item_get", response_model=list[schemas.ItemOut])
def list_items(db: Session = Depends(get_db)):
    """Return all master items ordered by name."""
    stmt = select(models.Item).order_by(models.Item.item_name.asc())
    return db.execute(stmt).scalars().all()


@app.get("/api/items/{item_id}", response_model=schemas.ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    """Get a single item by ID."""
    item = db.get(models.Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@app.put("/api/items/{item_id}", response_model=schemas.ItemOut)
def update_item(item_id: int, payload: schemas.ItemUpdate, db: Session = Depends(get_db)):
    """Update master item details."""
    item = db.get(models.Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    if payload.item_name is not None:
        item.item_name = payload.item_name.strip()
    if payload.description is not None:
        item.description = payload.description.strip()
    if payload.hsn_sac is not None:
        item.hsn_sac = payload.hsn_sac.strip()
    if payload.rate is not None:
        item.rate = payload.rate
    if payload.gst_rate is not None:
        item.gst_rate = payload.gst_rate

    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/items/{item_id}", status_code=200)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """Delete an item from master."""
    item = db.get(models.Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"detail": "Item deleted successfully"}


    