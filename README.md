# Invoice learning slice

The smallest complete path: React form -> HTTP -> FastAPI -> PostgreSQL -> PDF.

Read the files in this order. Each one is commented for *why*, not *what*.

1. `backend/schemas.py`     - the contract. What JSON looks like on the wire.
2. `backend/main.py`        - `create_invoice()` is the function to study.
3. `frontend/src/api.js`    - where a JS object becomes text.
4. `frontend/src/App.jsx`   - `handleSave()` is the mirror of `create_invoice()`.

## Setup

### 1. PostgreSQL

    CREATE DATABASE invoice_db;
    CREATE USER invoice_user WITH PASSWORD 'invoice_pass';
    GRANT ALL PRIVILEGES ON DATABASE invoice_db TO invoice_user;

Then inside `invoice_db`:

    GRANT ALL ON SCHEMA public TO invoice_user;

### 2. Backend

    cd backend
    python -m venv .venv
    .venv\Scripts\activate          # Windows
    source .venv/bin/activate       # Linux / Mac
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

On Windows, WeasyPrint needs the GTK runtime installed separately.
Everything except the PDF endpoint works without it, so do the PDF step
last. If GTK is a fight, the `/preview` endpoint renders the same HTML in
your browser with no extra dependencies.

### 3. Frontend

    cd frontend
    npm create vite@latest . -- --template react
    # keep the src/ files from this repo, overwrite Vite's
    npm install
    npm run dev

Frontend runs on 5173, backend on 8000. Two programs, two ports.

## Do this before writing any React

Open http://localhost:8000/docs and POST an invoice from there.

That page is generated from your Pydantic schemas. It proves the backend
works on its own. Once it does, the React side is only "send the same JSON
that /docs sent".

## The four things worth watching

**1. The Network tab.** Open dev tools, click Save, click the request.
Payload shows the JSON that left the browser. Response shows what came
back, including the `id` and `invoice_no` the server generated. Nothing
crossed that boundary except text.

**2. Your uvicorn terminal.** `echo=True` prints every SQL statement.
You will see the INSERT your button click produced.

**3. A deliberate 422.** Clear the buyer name and save. FastAPI rejects it
before `create_invoice()` runs, and `api.js` unpacks which field failed.
Validation is not decoration.

**4. Change the place of supply to Maharashtra.** Same numbers, but the
tax splits as IGST instead of CGST+SGST, and the PDF grows a different
column. That switch lives in `calculations.py`, in one `if`.

## What is deliberately missing

This is a learning slice, not the product:

- Numbering is `MAX + 1`. Two simultaneous saves collide. Needs a
  `number_series` table with `SELECT ... FOR UPDATE`, reset per financial year.
- No draft/issued/cancelled status. Issued invoices must become immutable.
- No auth, no company table, no parties master, no quotations.
- `create_all()` instead of Alembic migrations.
- No credit notes, no payments, no round-off column.
