"""
All the arithmetic. Deliberately in its own file, with no FastAPI and no
SQLAlchemy imported, so you can test it from a plain Python shell:

    >>> from calculations import amount_in_words
    >>> amount_in_words(Decimal("200600"))
    'Rupees Two Lakh Six Hundred Only'

Business logic that does not import your web framework is business logic
you can actually test.
"""

from decimal import Decimal, ROUND_HALF_UP

SELLER_STATE_CODE = "24"   # Gujarat - RJ Technologies


def money(value: Decimal) -> Decimal:
    """Round to 2 decimals, half-up. Banker's rounding is wrong for invoices."""
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_line(quantity: Decimal, rate: Decimal, gst_rate: Decimal,
                 place_of_supply_code: str) -> dict:
    """
    One line's tax split.

    Same state as seller -> CGST + SGST, each at half the GST rate.
    Different state      -> IGST at the full rate.

    On your RJ invoice: 18% GST, buyer in Gujarat, so 9% + 9%.
    """
    taxable = money(quantity * rate)
    half = gst_rate / 2

    if place_of_supply_code == SELLER_STATE_CODE:
        cgst_rate, sgst_rate, igst_rate = half, half, Decimal("0")
    else:
        cgst_rate, sgst_rate, igst_rate = Decimal("0"), Decimal("0"), gst_rate

    cgst_amount = money(taxable * cgst_rate / 100)
    sgst_amount = money(taxable * sgst_rate / 100)
    igst_amount = money(taxable * igst_rate / 100)

    return {
        "taxable_value": taxable,
        "cgst_rate": cgst_rate,
        "cgst_amount": cgst_amount,
        "sgst_rate": sgst_rate,
        "sgst_amount": sgst_amount,
        "igst_rate": igst_rate,
        "igst_amount": igst_amount,
        "line_total": money(taxable + cgst_amount + sgst_amount + igst_amount),
    }


# ---------- amount in words, Indian numbering ----------

_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
         "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
         "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
         "Eighty", "Ninety"]


def _under_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    tens, ones = divmod(n, 10)
    return _TENS[tens] + (" " + _ONES[ones] if ones else "")


def _under_thousand(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(_ONES[hundreds] + " Hundred")
    if rest:
        parts.append(_under_hundred(rest))
    return " ".join(parts)



def amount_in_words(amount: Decimal) -> str:
    """
    Indian system: crore / lakh / thousand / hundred.

    Your uploaded invoice printed 'Two hundred thousand, six hundred'
    which is the international system. Indian invoice convention is
    'Rupees Two Lakh Six Hundred Only'.
    """
    amount = money(amount)
    rupees = int(amount)
    paise = int((amount - rupees) * 100)

    if rupees == 0:
        words = "Zero"
    else:
        crore, rest = divmod(rupees, 10_000_000)
        lakh, rest = divmod(rest, 100_000)
        thousand, rest = divmod(rest, 1_000)

        parts = []
        if crore:
            parts.append(_under_thousand(crore) + " Crore")
        if lakh:
            parts.append(_under_thousand(lakh) + " Lakh")
        if thousand:
            parts.append(_under_thousand(thousand) + " Thousand")
        if rest:
            parts.append(_under_thousand(rest))
        words = " ".join(parts)

    result = f"Rupees {words}"
    if paise:
        result += f" and {_under_hundred(paise)} Paise"
    return result + " Only"


