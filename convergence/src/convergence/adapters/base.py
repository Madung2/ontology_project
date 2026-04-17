"""Abstract base database adapter."""

from abc import ABC, abstractmethod
from convergence.core.schema_ir import SchemaIR, TableIR, ColumnIR, ForeignKeyIR


class BaseDBAdapter(ABC):
    """Abstract base class for database adapters."""

    @abstractmethod
    def connect(self) -> None:
        """Connect to the database."""
        pass

    @abstractmethod
    def extract_tables(self) -> list[TableIR]:
        """Extract all tables from the database."""
        pass

    @abstractmethod
    def extract_columns(self, table_name: str) -> list[ColumnIR]:
        """Extract all columns for a specific table."""
        pass

    @abstractmethod
    def extract_foreign_keys(self) -> list[ForeignKeyIR]:
        """Extract all foreign keys from the database."""
        pass

    @abstractmethod
    def extract_indexes(self, table_name: str) -> list[dict]:
        """Extract indexes for a specific table."""
        pass

    @abstractmethod
    def extract_table_comment(self, table_name: str) -> str:
        """Extract comment for a table."""
        pass

    @abstractmethod
    def extract_column_comments(self, table_name: str) -> dict[str, str]:
        """Extract comments for all columns in a table."""
        pass

    def extract_schema(self, dialect: str = "unknown") -> SchemaIR:
        """Extract the full schema and return as SchemaIR."""
        self.connect()
        if dialect == "unknown":
            dialect = getattr(self, "dialect", dialect)

        tables = self.extract_tables()
        foreign_keys = self.extract_foreign_keys()

        # Enrich tables with columns and indexes
        for table in tables:
            columns = self.extract_columns(table.name)
            indexes = self.extract_indexes(table.name)
            comments = self.extract_column_comments(table.name)

            table.columns = columns
            table.indexes = indexes
            table.comment = self.extract_table_comment(table.name)

            # Apply column comments
            for col in table.columns:
                col.comment = comments.get(col.name)

        return SchemaIR(
            dialect=dialect,
            tables=tables,
            foreign_keys=foreign_keys,
        )
