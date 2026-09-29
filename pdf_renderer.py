"""
Invoice object -> HTML (Jinja2) -> PDF (WeasyPrint).

Two steps, deliberately separate. You can look at the HTML in a browser
and use dev tools on it, which makes laying out the table far less
painful than debugging PDF drawing coordinates.
"""

from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATE_DIR = Path(__file__).parent / "templates"

env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
)


def inr(value) -> str:
    """
    Indian digit grouping: 200600 -> 2,00,600.00
    Last three digits, then pairs. Python's :, format gives 200,600 which
    is wrong for an Indian invoice.
    """
    if value is None:
        return ""
    negative = value < 0
    whole, _, frac = f"{abs(value):.2f}".partition(".")

    if len(whole) > 3:
        last3 = whole[-3:]
        rest = whole[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        whole = ",".join(groups) + "," + last3

    out = f"{whole}.{frac}"
    return f"-{out}" if negative else out


env.filters["inr"] = inr


def render_invoice_html(invoice) -> str:
    template = env.get_template("invoice.html")
    return template.render(inv=invoice)


def render_invoice_pdf(invoice) -> bytes:
    # Imported here rather than at module top so that the rest of the app
    # still starts if WeasyPrint's system libraries are not installed yet.
    from weasyprint import HTML

    html = render_invoice_html(invoice)
    return HTML(string=html).write_pdf()
