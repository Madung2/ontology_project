"""Tests for live database reflection through SQLAlchemy."""

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from convergence.adapters.sqlalchemy_adapter import SQLAlchemyAdapter
from convergence.web.app import app, projects


def _make_sqlite_db(path: Path) -> str:
    url = f"sqlite:///{path}"
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        conn.exec_driver_sql(
            """
            CREATE TABLE customers (
                customer_id INTEGER PRIMARY KEY,
                email TEXT NOT NULL,
                created_at TIMESTAMP
            )
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE accounts (
                account_id INTEGER PRIMARY KEY,
                customer_id INTEGER NOT NULL,
                account_number TEXT NOT NULL,
                balance NUMERIC,
                FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
            )
            """
        )
        conn.exec_driver_sql(
            "CREATE INDEX accounts_number_idx ON accounts(account_number)"
        )
    return url


def test_sqlalchemy_adapter_reflects_sqlite_schema(tmp_path):
    """The adapter should normalize SQLite metadata into SchemaIR."""
    url = _make_sqlite_db(tmp_path / "banking.db")

    adapter = SQLAlchemyAdapter(url)
    schema = adapter.extract_schema(dialect=adapter.dialect)

    assert schema.dialect == "sqlite"
    assert len(schema.tables) == 2
    assert len(schema.foreign_keys) == 1

    accounts = schema.get_table("accounts")
    assert accounts is not None
    assert any(col.name == "account_id" and col.is_pk for col in accounts.columns)
    assert any(col.name == "customer_id" and col.is_fk for col in accounts.columns)
    assert accounts.indexes[0]["name"] == "accounts_number_idx"


def test_connect_db_endpoint_runs_pipeline(tmp_path):
    """The web API should connect to a live DB and populate project outputs."""
    projects.clear()
    url = _make_sqlite_db(tmp_path / "api.db")
    client = TestClient(app)

    created = client.post(
        "/api/projects",
        json={"name": "SQLite API Test", "description": "live database"},
    )
    assert created.status_code == 200
    project_id = created.json()["id"]

    connected = client.post(
        f"/api/projects/{project_id}/connect-db",
        json={"connection_url": url, "include_views": False},
    )
    assert connected.status_code == 200
    assert connected.json()["dialect"] == "sqlite"
    assert connected.json()["tables"] == 2

    schema = client.get(f"/api/projects/{project_id}/schema")
    assert schema.status_code == 200
    assert schema.json()["dialect"] == "sqlite"

    semantic = client.get(f"/api/projects/{project_id}/semantic-ir")
    assert semantic.status_code == 200
    assert semantic.json()["stats"]["nodes"] > 0
