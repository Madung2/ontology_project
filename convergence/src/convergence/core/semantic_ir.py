"""The pipeline's central representation."""

from pydantic import BaseModel, Field
from typing import Optional


class NodeProperty(BaseModel):
    """A property of a graph node."""
    name: str
    data_type: str
    source_column: str


class EdgeProperty(BaseModel):
    """A property of a graph edge."""
    name: str
    data_type: str
    source_column: str


class GraphNode(BaseModel):
    """A node in the graph."""
    id: str
    label: str
    source_table: str
    properties: list[NodeProperty] = Field(default_factory=list)
    domain_mapping: Optional[dict] = None


class GraphEdge(BaseModel):
    """An edge in the graph."""
    id: str
    edge_type: str
    from_node: str
    to_node: str
    cardinality: str = "1:N"
    properties: list[EdgeProperty] = Field(default_factory=list)
    source_fk: Optional[str] = None
    domain_mapping: Optional[dict] = None


class TraceLink(BaseModel):
    """A link tracing semantic graph element back to source schema."""
    source_table: str
    source_column: Optional[str] = None
    target_type: str  # "node" | "edge" | "property"
    target_id: str
    transform_type: str  # "direct" | "slm_enriched" | "junction_merge"


class SemanticIR(BaseModel):
    """Semantic intermediate representation."""
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    trace_links: list[TraceLink] = Field(default_factory=list)
    domain_mappings: dict = Field(default_factory=dict)

    @property
    def stats(self) -> dict:
        """Return statistics about the semantic graph."""
        return {
            "nodes": len(self.nodes),
            "edges": len(self.edges),
            "trace_links": len(self.trace_links),
            "node_properties": sum(len(n.properties) for n in self.nodes),
            "edge_properties": sum(len(e.properties) for e in self.edges),
        }

    def to_summary(self) -> str:
        """Return a summary for UI display."""
        stats = self.stats
        return (
            f"SemanticIR: {stats['nodes']} nodes, {stats['edges']} edges, "
            f"{stats['node_properties']} node properties, {stats['edge_properties']} edge properties"
        )
