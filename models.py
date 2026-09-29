"""
Database tables, described as Python classes.

These classes are NOT what travels over the network. They are what lives
in Postgres. The Pydantic classes in schemas.py are what travels over the
network. Keeping those two separate is deliberate - see schemas.py.

Money is Numeric(14, 2), never Float. Float cannot represent 0.1 exactly,
and rounding drift on an invoice is a real problem, not a theoretical one.
"""

from datetime import date
from decimal import Decimal
from typing import List

from sqlalchemy import String, Date, Numeric, Integer, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Document identity
    invoice_no: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    invoice_date: Mapped[date] = mapped_column(Date)

    # Buyer. In the real system this becomes a foreign key to a `parties`
    # table. Kept inline here so there is one less join to think about.
    buyer_name: Mapped[str] = mapped_column(String(200))
    buyer_address: Mapped[str] = mapped_column(Text, default="")
    buyer_gstin: Mapped[str] = mapped_column(String(15), default="")

    po_no: Mapped[str] = mapped_column(String(50), default="")

    # State code decides CGST+SGST (same state) vs IGST (different state).
    # 24 = Gujarat.
    place_of_supply_code: Mapped[str] = mapped_column(String(2), default="24")

    # Totals. Computed on the SERVER, never accepted from the browser.
    taxable_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    cgst_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    sgst_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    igst_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    amount_in_words: Mapped[str] = mapped_column(Text, default="")

    # Special condition: some companies (e.g. Pharma) exclude GST from the final grand total
    exclude_gst_from_total: Mapped[bool] = mapped_column(Boolean, default=False)
    tax_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    tax_in_words: Mapped[str] = mapped_column(Text, default="")

    lines: Mapped[List["InvoiceLine"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceLine.sn",
        lazy="selectin",   # loads lines in a 2nd query instead of N queries
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))

    sn: Mapped[int] = mapped_column(Integer)          # 1, 2, 3... on the printed sheet
    item_name: Mapped[str] = mapped_column(String(200))

    # Multi-line description. On your RJ invoice, "T-Scale make" with
    # "S10 Indicator" underneath is ONE line item with a two-line
    # description - not two rows. Store it as text, let the PDF wrap it.
    description: Mapped[str] = mapped_column(Text, default="")

    hsn_sac: Mapped[str] = mapped_column(String(8), default="")
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    taxable_value: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    # Rates are SNAPSHOTTED onto the line, not looked up at print time.
    # If the GST rate on HSN 8423 changes next year, this invoice must
    # still print exactly what the customer was charged.
    cgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    sgst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    igst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)

    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2))

    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class Buyer(Base):
    """
    Customer / Buyer company master table.
    Stores company details for reuse across invoices.
    """
    __tablename__ = "buyers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    address: Mapped[str] = mapped_column(Text, default="")
    gstin: Mapped[str] = mapped_column(String(15), default="")
    state_code: Mapped[str] = mapped_column(String(2), default="24")
    email: Mapped[str] = mapped_column(String(100), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")


class Item(Base):
    """
    Product / Item master table.
    Stores standard product descriptions, HSN codes, and default rates/GST.
    """
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    hsn_sac: Mapped[str] = mapped_column(String(8), default="")
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18)

    