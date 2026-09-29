"""
The API contract. This is the shape of the JSON on the wire.

Why not just reuse the SQLAlchemy models?

Because what the browser SENDS and what the database STORES are different
things. The browser sends item name, qty, rate. It does NOT send
taxable_value, cgst_amount, or grand_total - those are calculated on the
server. If you reused one class for both, you would have to trust the
browser's arithmetic, and anyone with curl could send you an invoice for
Rs 5,00,000 with a grand total of Rs 1.

So: *Create schemas are what comes IN. *Out schemas are what goes OUT.
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


# ---------- what the browser sends us ----------

class InvoiceLineCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=200)
    description: str = ""
    hsn_sac: str = ""
    quantity: Decimal = Field(gt=0)      # gt=0 rejects zero and negatives
    rate: Decimal = Field(ge=0)
    gst_rate: Decimal = Field(default=Decimal("18"), ge=0, le=28)


class InvoiceCreate(BaseModel):
    invoice_date: date
    buyer_name: str = Field(min_length=1, max_length=200)
    buyer_address: str = ""
    buyer_gstin: str = ""
    po_no: str = ""
    place_of_supply_code: str = "24"
    exclude_gst_from_total: bool = False
    lines: List[InvoiceLineCreate] = Field(min_length=1)


# ---------- what we send back ----------

class InvoiceLineOut(BaseModel):
    # from_attributes lets Pydantic read a SQLAlchemy object directly
    # (line.item_name) instead of needing a dict.
    model_config = ConfigDict(from_attributes=True)

    sn: int
    item_name: str
    description: str
    hsn_sac: str
    quantity: Decimal
    rate: Decimal
    taxable_value: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    line_total: Decimal


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_no: int
    invoice_date: date
    buyer_name: str
    buyer_address: str
    buyer_gstin: str
    po_no: str
    place_of_supply_code: str
    taxable_total: Decimal
    cgst_total: Decimal
    sgst_total: Decimal
    igst_total: Decimal
    grand_total: Decimal
    amount_in_words: str
    exclude_gst_from_total: bool = False
    tax_total: Decimal = Decimal("0")
    tax_in_words: str = ""
    lines: List[InvoiceLineOut]


class InvoiceListItem(BaseModel):
    """Slim version for the list screen - no lines, so the query stays cheap."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_no: int
    invoice_date: date
    buyer_name: str
    grand_total: Decimal


# ---------- Buyer schemas ----------

class BuyerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = ""
    gstin: str = ""
    state_code: str = "24"
    email: str = ""
    phone: str = ""


class BuyerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    address: Optional[str] = None
    gstin: Optional[str] = None
    state_code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class BuyerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str
    gstin: str
    state_code: str
    email: str
    phone: str


# ---------- Item / Product schemas ----------

class ItemCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=200)
    description: str = ""
    hsn_sac: str = ""
    rate: Decimal = Field(default=Decimal("0"), ge=0)
    gst_rate: Decimal = Field(default=Decimal("18"), ge=0, le=28)


class ItemUpdate(BaseModel):
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    hsn_sac: Optional[str] = None
    rate: Optional[Decimal] = Field(default=None, ge=0)
    gst_rate: Optional[Decimal] = Field(default=None, ge=0, le=28)


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_name: str
    description: str
    hsn_sac: str
    rate: Decimal
    gst_rate: Decimal


# Aliases for convenience
itemCreate = ItemCreate
itemOut = ItemOut
    