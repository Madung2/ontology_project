"""Live database metadata adapter backed by SQLAlchemy reflection."""

from typing import Any

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from convergence.adapters.base import BaseDBAdapter
from convergence.core.schema_ir import ColumnIR, ForeignKeyIR, TableIR


class SQLAlchemyAdapter(BaseDBAdapter):
    """Extract schema metadata from a live database through SQLAlchemy."""

    def __init__(
        self,
        connection_url: str,
        schema_name: str | None = None,
        include_views: bool = False,
    ):
        self.connection_url = connection_url
        self.schema_name = schema_name or None
        self.include_views = include_views
        self.engine: Engine | None = None
        self.inspector: Any = None
        self.dialect = "unknown"

    def connect(self) -> None:
        """Create the SQLAlchemy engine and verify that a connection opens."""
        if self.engine and self.inspector:
            return

        try:
            self.engine = create_engine(self.connection_url, pool_pre_ping=True)
            with self.engine.connect():
                pass
            self.inspector = inspect(self.engine)
            self.dialect = self.engine.dialect.name
        except ModuleNotFoundError as exc:
            raise ConnectionError(
                "Database driver is not installed. Install the SQLAlchemy driver "
                "for this URL, for example psycopg, pymysql, or oracledb."
            ) from exc
        except SQLAlchemyError as exc:
            raise ConnectionError(f"Database connection failed: {exc}") from exc

    def extract_tables(self) -> list[TableIR]:
        """Extract table names from the configured schema."""
        self.connect()
        table_names = list(self.inspector.get_table_names(schema=self.schema_name))

        if self.include_views:
            view_names = self.inspector.get_view_names(schema=self.schema_name)
            table_names.extend(name for name in view_names if name not in table_names)

        return [TableIR(name=name, columns=[]) for name in table_names]

    def extract_columns(self, table_name: str) -> list[ColumnIR]:
        """Extract columns with primary key and foreign key annotations."""
        self.connect()
        pk_columns = set(self._pk_columns(table_name))
        fk_refs = self._fk_refs(table_name)

        columns = []
        for column in self.inspector.get_columns(table_name, schema=self.schema_name):
            name = column["name"]
            fk_ref = fk_refs.get(name)
            columns.append(
                ColumnIR(
                    name=name,
                    data_type=self._normalize_type(column.get("type")),
                    nullable=bool(column.get("nullable", True)),
                    is_pk=name in pk_columns,
                    is_fk=fk_ref is not None,
                    fk_ref=fk_ref,
                    comment=column.get("comment"),
                )
            )

        return columns

    def extract_foreign_keys(self) -> list[ForeignKeyIR]:
        """Extract all foreign key relationships."""
        self.connect()
        foreign_keys = []

        for table_name in self.inspector.get_table_names(schema=self.schema_name):
            for fk in self.inspector.get_foreign_keys(table_name, schema=self.schema_name):
                constrained = fk.get("constrained_columns") or []
                referred = fk.get("referred_columns") or []
                referred_table = fk.get("referred_table")
                if not referred_table:
                    continue

                for from_column, to_column in zip(constrained, referred):
                    foreign_keys.append(
                        ForeignKeyIR(
                            from_table=table_name,
                            from_column=from_column,
                            to_table=referred_table,
                            to_column=to_column,
                            constraint_name=fk.get("name"),
                        )
                    )

        return foreign_keys

    def extract_indexes(self, table_name: str) -> list[dict]:
        """Extract indexes for a table."""
        self.connect()
        try:
            return list(self.inspector.get_indexes(table_name, schema=self.schema_name))
        except NotImplementedError:
            return []

    def extract_table_comment(self, table_name: str) -> str:
        """Extract table comments when supported by the dialect."""
        self.connect()
        try:
            comment_info = self.inspector.get_table_comment(
                table_name,
                schema=self.schema_name,
            )
        except (NotImplementedError, SQLAlchemyError):
            return ""

        return comment_info.get("text") or ""

    def extract_column_comments(self, table_name: str) -> dict[str, str]:
        """Extract column comments from reflected column metadata."""
        self.connect()
        comments = {}

        for column in self.inspector.get_columns(table_name, schema=self.schema_name):
            if column.get("comment"):
                comments[column["name"]] = column["comment"]

        return comments

    def _pk_columns(self, table_name: str) -> list[str]:
        try:
            pk = self.inspector.get_pk_constraint(table_name, schema=self.schema_name)
        except SQLAlchemyError:
            return []

        return pk.get("constrained_columns") or []

    def _fk_refs(self, table_name: str) -> dict[str, str]:
        refs = {}
        try:
            fks = self.inspector.get_foreign_keys(table_name, schema=self.schema_name)
        except SQLAlchemyError:
            return refs

        for fk in fks:
            referred_table = fk.get("referred_table")
            if not referred_table:
                continue

            constrained = fk.get("constrained_columns") or []
            referred = fk.get("referred_columns") or []
            for from_column, to_column in zip(constrained, referred):
                refs[from_column] = f"{referred_table}.{to_column}"

        return refs

    def _normalize_type(self, db_type: Any) -> str:
        """Return a compact, display-friendly type name."""
        if db_type is None:
            return "unknown"

        raw = str(db_type).lower()
        if "(" in raw:
            raw = raw.split("(", 1)[0]

        aliases = {
            "varchar2": "varchar",
            "character varying": "varchar",
            "numeric": "decimal",
            "number": "decimal",
            "int": "integer",
            "timestamp without time zone": "timestamp",
            "timestamp with time zone": "timestamp",
        }
        return aliases.get(raw, raw)
