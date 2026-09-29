"""
Connection to PostgreSQL.

Three objects matter here:
  engine   - the actual connection pool to Postgres. Created once.
  Session  - a "unit of work". One per HTTP request. Holds a transaction.
  Base     - the parent class all your table classes inherit from.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Format: postgresql+psycopg://user:password@host:port/database_name
DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/invoice_db"

# echo=True prints every SQL statement SQLAlchemy generates.
# Leave this ON while learning - it is the single most useful thing here.
# You will see the INSERT that your React form caused.
engine = create_engine(DATABASE_URL, echo=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """
    FastAPI dependency. One database session per request.

    The `yield` is important: FastAPI runs everything before the yield,
    hands the session to your endpoint, then runs the `finally` block
    after the response is sent. So the connection always gets returned
    to the pool, even if your endpoint raises.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
