"""End-to-end tests for banking sample schema."""

import pytest
from pathlib import Path

from convergence.adapters.ddl_adapter import DDLAdapter
from convergence.core.schema_ir import TableClassification, GraphRole
from convergence.domain.detector import DomainDetector
from convergence.pipeline.classifier import classify_all_tables
from convergence.pipeline.converter import Converter


@pytest.fixture
def banking_ddl():
    """Load banking sample DDL."""
    sql_file = Path(__file__).parent / "fixtures" / "banking_sample.sql"
    return sql_file.read_text()


@pytest.fixture
def schema_ir(banking_ddl):
    """Parse DDL into SchemaIR."""
    adapter = DDLAdapter(banking_ddl)
    return adapter.extract_schema(dialect="postgres")


class TestDDLParsing:
    """Test DDL parsing functionality."""

    def test_table_count(self, schema_ir):
        """Test that 9 tables are parsed."""
        assert len(schema_ir.tables) == 9

    def test_column_parsing(self, schema_ir):
        """Test that columns are parsed correctly."""
        customers = schema_ir.get_table("customers")
        assert customers is not None
        assert len(customers.columns) > 0

        # Check specific columns
        col_names = {col.name for col in customers.columns}
        assert "customer_id" in col_names
        assert "first_name" in col_names
        assert "email" in col_names

    def test_fk_detection(self, schema_ir):
        """Test foreign key detection."""
        assert len(schema_ir.foreign_keys) > 0

        # Check specific FKs
        fks_from_accounts = schema_ir.get_fks_from("accounts")
        assert len(fks_from_accounts) >= 2

    def test_dialect_detection(self, banking_ddl):
        """Test that dialect is detected as postgres."""
        adapter = DDLAdapter(banking_ddl)
        assert adapter.dialect == "postgres"

    def test_pk_detection(self, schema_ir):
        """Test primary key detection."""
        customers = schema_ir.get_table("customers")
        pk_columns = [col for col in customers.columns if col.is_pk]
        assert len(pk_columns) == 1
        assert pk_columns[0].name == "customer_id"

    def test_type_normalization(self, schema_ir):
        """Test type normalization."""
        accounts = schema_ir.get_table("accounts")
        balance_col = next((col for col in accounts.columns if col.name == "balance"), None)
        assert balance_col is not None
        assert balance_col.data_type == "decimal"

    def test_junction_table_detection(self, schema_ir):
        """Test that junction table is detected."""
        junction = schema_ir.get_table("customer_branch")
        assert junction is not None

        pk_columns = [col for col in junction.columns if col.is_pk]
        assert len(pk_columns) == 2


class TestDomainDetection:
    """Test domain detection functionality."""

    def test_finance_detection(self, schema_ir):
        """Test that finance domain is detected."""
        detector = DomainDetector()
        domain_name, confidence, signals = detector.detect(schema_ir)
        assert domain_name == "finance"

    def test_confidence_score(self, schema_ir):
        """Test that confidence score is reasonable."""
        detector = DomainDetector()
        domain_name, confidence, signals = detector.detect(schema_ir)
        assert confidence > 0.5


class TestTableClassification:
    """Test table classification functionality."""

    @pytest.mark.asyncio
    async def test_entity_classification(self, schema_ir):
        """Test that entity tables are classified correctly."""
        classifications = await classify_all_tables(schema_ir)

        customers = classifications["customers"]
        assert customers[0] in (TableClassification.ENTITY, TableClassification.UNKNOWN)
        assert customers[2] == GraphRole.NODE

    @pytest.mark.asyncio
    async def test_junction_classification(self, schema_ir):
        """Test that junction tables are classified correctly."""
        classifications = await classify_all_tables(schema_ir)

        junction = classifications["customer_branch"]
        assert junction[0] == TableClassification.JUNCTION
        assert junction[2] == GraphRole.EDGE

    @pytest.mark.asyncio
    async def test_audit_classification(self, schema_ir):
        """Test audit table classification (if exists)."""
        classifications = await classify_all_tables(schema_ir)
        # Banking sample doesn't have audit tables, just verify no errors
        assert len(classifications) == len(schema_ir.tables)


class TestConversion:
    """Test SchemaIR to SemanticIR conversion."""

    @pytest.mark.asyncio
    async def test_node_creation(self, schema_ir):
        """Test that nodes are created from entity tables."""
        classifications = await classify_all_tables(schema_ir)
        converter = Converter()
        semantic_ir = converter.convert(schema_ir, classifications, "finance")

        assert len(semantic_ir.nodes) > 0

        # Check for customer node
        customer_node = next((n for n in semantic_ir.nodes if "customer" in n.label.lower()), None)
        assert customer_node is not None

    @pytest.mark.asyncio
    async def test_edge_creation(self, schema_ir):
        """Test that edges are created from foreign keys."""
        classifications = await classify_all_tables(schema_ir)
        converter = Converter()
        semantic_ir = converter.convert(schema_ir, classifications, "finance")

        assert len(semantic_ir.edges) > 0

    @pytest.mark.asyncio
    async def test_trace_links(self, schema_ir):
        """Test that trace links are created."""
        classifications = await classify_all_tables(schema_ir)
        converter = Converter()
        semantic_ir = converter.convert(schema_ir, classifications, "finance")

        assert len(semantic_ir.trace_links) > 0

        # Check that trace links point to valid targets
        node_ids = {n.id for n in semantic_ir.nodes}
        edge_ids = {e.id for e in semantic_ir.edges}

        for link in semantic_ir.trace_links:
            assert link.target_id in node_ids or link.target_id in edge_ids

    @pytest.mark.asyncio
    async def test_domain_mapping(self, schema_ir):
        """Test domain mapping application."""
        classifications = await classify_all_tables(schema_ir)
        seed_mappings = {
            "customers": "FIBO:Customer",
            "accounts": "FIBO:Account",
        }
        converter = Converter()
        semantic_ir = converter.convert(
            schema_ir, classifications, "finance", seed_mappings
        )

        # Check that domain mappings are stored
        assert "customers" in semantic_ir.domain_mappings

    @pytest.mark.asyncio
    async def test_label_generation(self, schema_ir):
        """Test that labels are generated correctly."""
        classifications = await classify_all_tables(schema_ir)
        converter = Converter()
        semantic_ir = converter.convert(schema_ir, classifications, "finance")

        # Check label format (PascalCase, singular)
        for node in semantic_ir.nodes:
            assert node.label[0].isupper()  # First letter capitalized

    @pytest.mark.asyncio
    async def test_junction_edge_conversion(self, schema_ir):
        """Test that junction tables become edges."""
        classifications = await classify_all_tables(schema_ir)
        converter = Converter()
        semantic_ir = converter.convert(schema_ir, classifications, "finance")

        # Find junction edge
        junction_edges = [e for e in semantic_ir.edges if e.cardinality == "M:N"]
        assert len(junction_edges) > 0

    @pytest.mark.asyncio
    async def test_stats(self, schema_ir):
        """Test semantic IR statistics."""
        classifications = await classify_all_tables(schema_ir)
        converter = Converter()
        semantic_ir = converter.convert(schema_ir, classifications, "finance")

        stats = semantic_ir.stats
        assert stats["nodes"] > 0
        assert "edges" in stats
        assert "trace_links" in stats

        # Test summary
        summary = semantic_ir.to_summary()
        assert "SemanticIR" in summary
        assert "nodes" in summary
