"""DDL file parser using sqlglot."""

import sqlglot
from sqlglot import exp
from convergence.adapters.base import BaseDBAdapter
from convergence.core.schema_ir import TableIR, ColumnIR, ForeignKeyIR


class DDLAdapter(BaseDBAdapter):
    """Parse DDL text and extract schema."""

    def __init__(self, ddl_text: str):
        """Initialize with DDL text."""
        self.ddl_text = ddl_text
        self.dialect = self._detect_dialect()
        self.parsed_tables: dict[str, dict] = {}
        self._parse_ddl()

    def _detect_dialect(self) -> str:
        """Detect SQL dialect from DDL text patterns."""
        text_upper = self.ddl_text.upper()

        if "SERIAL" in text_upper:
            return "postgres"
        if "AUTO_INCREMENT" in text_upper:
            return "mysql"
        if "NUMBER(" in text_upper:
            return "oracle"
        if "IDENTITY" in text_upper:
            return "tsql"

        return "postgres"

    def _parse_ddl(self) -> None:
        """Parse DDL statements and extract table definitions."""
        try:
            statements = sqlglot.parse(self.ddl_text, dialect=self.dialect)
        except Exception:
            # Fallback to generic dialect
            statements = sqlglot.parse(self.ddl_text, dialect="postgres")

        for stmt in statements:
            if isinstance(stmt, exp.Create) and isinstance(stmt.this, exp.Schema):
                # Get table name from schema.args['this']
                schema = stmt.this
                table_name_item = schema.args.get('this')
                if table_name_item:
                    table_name = str(table_name_item)
                    self.parsed_tables[table_name] = self._parse_create_table(stmt)
                else:
                    table_name = schema.name
                    if table_name:
                        self.parsed_tables[table_name] = self._parse_create_table(stmt)

    def _parse_create_table(self, create_stmt: exp.Create) -> dict:
        """Parse a CREATE TABLE statement."""
        schema = create_stmt.this
        # Get table name from schema.args['this']
        table_name_item = schema.args.get('this')
        table_name = str(table_name_item) if table_name_item else schema.name

        columns_data = {}
        fks = []
        pks = []

        for col_def in schema.expressions:
            if isinstance(col_def, exp.ColumnDef):
                col_name = col_def.name
                col_type = self._normalize_type(col_def.kind.sql(dialect=self.dialect) if col_def.kind else "varchar")
                col_nullable = True
                col_is_pk = False
                col_is_fk = False
                fk_ref = None
                fk_info = None

                # Check constraints
                if col_def.constraints:
                    for constraint in col_def.constraints:
                        constraint_kind = constraint.args.get("kind")
                        if isinstance(constraint_kind, exp.PrimaryKeyColumnConstraint):
                            col_is_pk = True
                            pks.append(col_name)
                        elif isinstance(constraint_kind, exp.NotNullColumnConstraint):
                            col_nullable = False
                        elif isinstance(constraint_kind, exp.Reference):
                            col_is_fk = True
                            fk_info = self._parse_reference(constraint_kind, table_name, col_name)
                            if fk_info:
                                fk_ref = f"{fk_info['to_table']}.{fk_info['to_column']}"
                                fks.append(fk_info)

                columns_data[col_name] = {
                    "name": col_name,
                    "type": col_type,
                    "nullable": col_nullable,
                    "is_pk": col_is_pk,
                    "is_fk": col_is_fk,
                    "fk_ref": fk_ref,
                }

            elif isinstance(col_def, exp.PrimaryKey):
                # Table-level primary key
                for col in col_def.expressions:
                    col_name = col.name if hasattr(col, "name") else str(col)
                    if col_name in columns_data:
                        columns_data[col_name]["is_pk"] = True
                        pks.append(col_name)

            elif isinstance(col_def, exp.ForeignKey):
                # Table-level foreign key
                for from_col in col_def.expressions:
                    from_col_name = from_col.name if hasattr(from_col, "name") else str(from_col)
                    if from_col_name in columns_data:
                        columns_data[from_col_name]["is_fk"] = True

                if col_def.reference:
                    to_table = col_def.reference.name
                    to_cols = [e.name if hasattr(e, "name") else str(e) for e in col_def.reference.expressions]
                    for from_col in col_def.expressions:
                        from_col_name = from_col.name if hasattr(from_col, "name") else str(from_col)
                        if to_cols:
                            columns_data[from_col_name]["fk_ref"] = f"{to_table}.{to_cols[0]}"
                            fks.append({
                                "from_table": table_name,
                                "from_column": from_col_name,
                                "to_table": to_table,
                                "to_column": to_cols[0],
                            })

        return {
            "name": table_name,
            "columns": columns_data,
            "fks": fks,
            "pks": pks,
        }

    def _parse_reference(self, reference: exp.Reference, from_table: str, from_column: str) -> dict:
        """Parse a REFERENCES clause to extract to_table and to_column."""
        # Get the schema that contains the table reference
        ref_schema = reference.args.get('this')
        if isinstance(ref_schema, exp.Schema):
            # Get the table from the schema
            table_item = ref_schema.args.get('this')
            if isinstance(table_item, exp.Table):
                to_table = str(table_item.this)
            else:
                to_table = str(table_item) if table_item else reference.name

            # Get the column from the schema expressions
            to_cols = [str(e) if isinstance(e, exp.Identifier) else str(e) for e in ref_schema.expressions or []]
            to_column = to_cols[0] if to_cols else "id"
        else:
            # Fallback to older format
            to_table = reference.name or "unknown"
            to_cols = [e.name if hasattr(e, "name") else str(e) for e in (reference.expressions or [])]
            to_column = to_cols[0] if to_cols else "id"

        return {
            "from_table": from_table,
            "from_column": from_column,
            "to_table": to_table,
            "to_column": to_column,
        }

    def _normalize_type(self, db_type: str) -> str:
        """Map DB-native types to normalized types."""
        db_type_upper = db_type.upper()

        type_map = {
            "NUMBER": "decimal",
            "VARCHAR2": "varchar",
            "CHAR": "char",
            "SERIAL": "integer",
            "BIGSERIAL": "bigint",
            "INT": "integer",
            "INTEGER": "integer",
            "BIGINT": "bigint",
            "SMALLINT": "smallint",
            "DECIMAL": "decimal",
            "NUMERIC": "decimal",
            "FLOAT": "float",
            "DOUBLE": "double",
            "REAL": "real",
            "DATE": "date",
            "TIMESTAMP": "timestamp",
            "TIME": "time",
            "BOOLEAN": "boolean",
            "BOOL": "boolean",
            "TEXT": "text",
            "VARCHAR": "varchar",
            "CHAR": "char",
            "BLOB": "blob",
            "CLOB": "clob",
        }

        for key, normalized in type_map.items():
            if key in db_type_upper:
                return normalized

        return db_type.lower()

    def connect(self) -> None:
        """No-op for DDL adapter."""
        pass

    def extract_tables(self) -> list[TableIR]:
        """Extract all tables from parsed DDL."""
        tables = []
        for table_data in self.parsed_tables.values():
            columns = [
                ColumnIR(
                    name=col_data["name"],
                    data_type=col_data["type"],
                    nullable=col_data["nullable"],
                    is_pk=col_data["is_pk"],
                    is_fk=col_data["is_fk"],
                    fk_ref=col_data["fk_ref"],
                )
                for col_data in table_data["columns"].values()
            ]
            tables.append(TableIR(name=table_data["name"], columns=columns))

        return tables

    def extract_columns(self, table_name: str) -> list[ColumnIR]:
        """Extract columns for a specific table."""
        if table_name not in self.parsed_tables:
            return []

        table_data = self.parsed_tables[table_name]
        return [
            ColumnIR(
                name=col_data["name"],
                data_type=col_data["type"],
                nullable=col_data["nullable"],
                is_pk=col_data["is_pk"],
                is_fk=col_data["is_fk"],
                fk_ref=col_data["fk_ref"],
            )
            for col_data in table_data["columns"].values()
        ]

    def extract_foreign_keys(self) -> list[ForeignKeyIR]:
        """Extract all foreign keys."""
        fks = []
        for table_data in self.parsed_tables.values():
            for fk_data in table_data["fks"]:
                fks.append(ForeignKeyIR(**fk_data))

        return fks

    def extract_indexes(self, table_name: str) -> list[dict]:
        """Extract indexes (empty for DDL parser)."""
        return []

    def extract_table_comment(self, table_name: str) -> str:
        """Extract table comment (empty for DDL)."""
        return ""

    def extract_column_comments(self, table_name: str) -> dict[str, str]:
        """Extract column comments (empty for DDL)."""
        return {}
