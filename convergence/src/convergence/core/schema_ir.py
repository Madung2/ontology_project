"""RDB metadata intermediate representation — Phase 1 output."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ColumnSemanticTag(str, Enum):
    """Semantic tags for columns."""
    ID = "ID"
    FOREIGN_KEY = "FOREIGN_KEY"
    AMOUNT = "AMOUNT"
    DATE = "DATE"
    STATUS = "STATUS"
    NAME = "NAME"
    DESCRIPTION = "DESCRIPTION"
    CODE = "CODE"
    OTHER = "OTHER"


class GraphRole(str, Enum):
    """Role a table/column plays in the graph."""
    NODE = "NODE"
    EDGE = "EDGE"
    PROPERTY = "PROPERTY"
    SKIP = "SKIP"


class TableClassification(str, Enum):
    """Classification of a table's semantic role."""
    ENTITY = "ENTITY"
    JUNCTION = "JUNCTION"
    LOOKUP = "LOOKUP"
    AUDIT = "AUDIT"
    UNKNOWN = "UNKNOWN"


class ColumnIR(BaseModel):
    """Intermediate representation of a column."""
    name: str
    data_type: str
    nullable: bool = True
    is_pk: bool = False
    is_fk: bool = False
    fk_ref: Optional[str] = None  # "table.column" format
    comment: Optional[str] = None


class TableIR(BaseModel):
    """Intermediate representation of a table."""
    name: str
    columns: list[ColumnIR]
    comment: Optional[str] = None
    indexes: list[dict] = Field(default_factory=list)


class ForeignKeyIR(BaseModel):
    """Intermediate representation of a foreign key."""
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    constraint_name: Optional[str] = None


class SchemaIR(BaseModel):
    """Intermediate representation of a database schema."""
    dialect: str
    tables: list[TableIR]
    foreign_keys: list[ForeignKeyIR]
    metadata: dict = Field(default_factory=dict)

    def get_table(self, name: str) -> Optional[TableIR]:
        """Get a table by name."""
        for table in self.tables:
            if table.name.lower() == name.lower():
                return table
        return None

    def get_fks_from(self, table_name: str) -> list[ForeignKeyIR]:
        """Get all foreign keys originating from a table."""
        return [fk for fk in self.foreign_keys if fk.from_table.lower() == table_name.lower()]

    def get_fks_to(self, table_name: str) -> list[ForeignKeyIR]:
        """Get all foreign keys pointing to a table."""
        return [fk for fk in self.foreign_keys if fk.to_table.lower() == table_name.lower()]

    @property
    def entity_tables(self) -> list[TableIR]:
        """Get tables that look like entities (have single-column PKs)."""
        entities = []
        for table in self.tables:
            pk_columns = [col for col in table.columns if col.is_pk]
            if len(pk_columns) == 1:
                entities.append(table)
        return entities

    @property
    def junction_tables(self) -> list[TableIR]:
        """Get tables that look like junctions (composite PK with mostly FKs)."""
        junctions = []
        for table in self.tables:
            pk_columns = [col for col in table.columns if col.is_pk]
            if len(pk_columns) >= 2:
                fk_columns = [col for col in pk_columns if col.is_fk]
                if len(fk_columns) >= 2:
                    junctions.append(table)
        return junctions
