"""SchemaIR to SemanticIR transformation."""

import re
from convergence.core.schema_ir import (
    SchemaIR, TableIR, TableClassification, GraphRole
)
from convergence.core.semantic_ir import (
    SemanticIR, GraphNode, GraphEdge, NodeProperty, EdgeProperty, TraceLink
)


class Converter:
    """Convert SchemaIR to SemanticIR."""

    def convert(
        self,
        schema_ir: SchemaIR,
        classifications: dict[str, tuple[TableClassification, float, GraphRole]],
        domain_name: str = "generic",
        seed_mappings: dict = None,
    ) -> SemanticIR:
        """
        Convert schema to semantic graph.

        Args:
            schema_ir: The RDB schema intermediate representation
            classifications: dict mapping table_name → (classification, confidence, graph_role)
            domain_name: Detected domain name
            seed_mappings: Domain seed mappings

        Returns:
            SemanticIR with nodes, edges, and trace links
        """
        seed_mappings = seed_mappings or {}
        semantic_ir = SemanticIR()
        semantic_ir.domain_mappings = seed_mappings

        # Step 1: Create nodes from entity tables
        node_map = {}  # table_name → node.id
        for table in schema_ir.tables:
            classification, confidence, role = classifications.get(
                table.name, (TableClassification.UNKNOWN, 0.5, GraphRole.NODE)
            )

            if role == GraphRole.NODE:
                node = self._make_node(table, schema_ir, seed_mappings)
                semantic_ir.nodes.append(node)
                node_map[table.name] = node.id

                # Trace link
                semantic_ir.trace_links.append(
                    TraceLink(
                        source_table=table.name,
                        target_type="node",
                        target_id=node.id,
                        transform_type="direct",
                    )
                )

        # Step 2: Create edges from FKs between entity tables
        fk_edge_id_counter = 1
        for fk in schema_ir.foreign_keys:
            from_table_role = classifications.get(fk.from_table, (None, None, GraphRole.SKIP))[2]
            to_table_role = classifications.get(fk.to_table, (None, None, GraphRole.SKIP))[2]

            if from_table_role == GraphRole.NODE and to_table_role == GraphRole.NODE:
                from_node_id = node_map.get(fk.from_table)
                to_node_id = node_map.get(fk.to_table)

                if from_node_id and to_node_id:
                    from_label = next(n.label for n in semantic_ir.nodes if n.id == from_node_id)
                    to_label = next(n.label for n in semantic_ir.nodes if n.id == to_node_id)

                    edge = GraphEdge(
                        id=f"edge_{fk_edge_id_counter}",
                        edge_type=self._make_edge_type(from_label, to_label, fk.from_column),
                        from_node=from_node_id,
                        to_node=to_node_id,
                        cardinality="1:N",
                        source_fk=f"{fk.from_table}.{fk.from_column}",
                    )
                    semantic_ir.edges.append(edge)
                    fk_edge_id_counter += 1

                    # Trace link
                    semantic_ir.trace_links.append(
                        TraceLink(
                            source_table=fk.from_table,
                            source_column=fk.from_column,
                            target_type="edge",
                            target_id=edge.id,
                            transform_type="direct",
                        )
                    )

        # Step 3: Convert junction tables to edges
        for table in schema_ir.tables:
            classification, confidence, role = classifications.get(
                table.name, (TableClassification.UNKNOWN, 0.5, GraphRole.NODE)
            )

            if role == GraphRole.EDGE and classification == TableClassification.JUNCTION:
                # Find the two FK columns (usually the PK columns)
                fks_from = schema_ir.get_fks_from(table.name)
                if len(fks_from) >= 2:
                    fk1, fk2 = fks_from[0], fks_from[1]
                    from_node_id = node_map.get(fk1.to_table)
                    to_node_id = node_map.get(fk2.to_table)

                    if from_node_id and to_node_id:
                        # Create edge from junction table
                        edge = GraphEdge(
                            id=f"junction_edge_{table.name}",
                            edge_type=f"{fk1.to_table}_{fk2.to_table}",
                            from_node=from_node_id,
                            to_node=to_node_id,
                            cardinality="M:N",
                            source_fk=table.name,
                        )

                        # Add non-FK columns as properties
                        pk_column_names = {col.name for col in table.columns if col.is_pk}
                        for col in table.columns:
                            if col.name not in pk_column_names and not col.is_fk:
                                edge.properties.append(
                                    EdgeProperty(
                                        name=col.name,
                                        data_type=col.data_type,
                                        source_column=col.name,
                                    )
                                )

                        semantic_ir.edges.append(edge)

                        # Trace link for edge
                        semantic_ir.trace_links.append(
                            TraceLink(
                                source_table=table.name,
                                target_type="edge",
                                target_id=edge.id,
                                transform_type="junction_merge",
                            )
                        )

        return semantic_ir

    def _make_node(
        self,
        table: TableIR,
        schema_ir: SchemaIR,
        seed_mappings: dict,
    ) -> GraphNode:
        """Create a GraphNode from a table."""
        node_id = self._make_label(table.name)
        label = self._make_label(table.name)

        # Create properties from columns
        properties = []
        for col in table.columns:
            properties.append(
                NodeProperty(
                    name=col.name,
                    data_type=col.data_type,
                    source_column=col.name,
                )
            )

        # Get domain mapping if available
        domain_mapping = None
        if table.name.lower() in seed_mappings:
            domain_mapping = {
                "ontology": seed_mappings[table.name.lower()],
            }

        return GraphNode(
            id=node_id,
            label=label,
            source_table=table.name,
            properties=properties,
            domain_mapping=domain_mapping,
        )

    def _make_label(self, name: str) -> str:
        """Convert table name to PascalCase label, handling plurals."""
        # Split by underscore
        parts = name.split("_")

        # Capitalize each part
        capitalized = [part.capitalize() for part in parts]

        # Join
        result = "".join(capitalized)

        # Simple plural removal
        # Handle common patterns: branches→Branch, employees→Employee, etc.
        if result.endswith("ies"):
            result = result[:-3] + "y"  # Categories → Category
        elif result.endswith("ches") or result.endswith("shes") or result.endswith("xes") or result.endswith("ses") or result.endswith("zes"):
            result = result[:-2]  # Branches → Branch, Addresses → Address
        elif result.endswith("s") and not result.endswith(("ss", "us", "is")):
            result = result[:-1]  # Customers → Customer

        return result

    def _make_edge_type(self, from_label: str, to_label: str, fk_column: str) -> str:
        """Derive relationship name from labels and FK column."""
        # Common relationship patterns
        if "customer" in fk_column.lower():
            return f"{from_label}_OWNS_{to_label}"
        elif "branch" in fk_column.lower():
            return f"{from_label}_AT_{to_label}"
        elif "employee" in fk_column.lower():
            return f"{from_label}_MANAGED_BY_{to_label}"
        elif "manager" in fk_column.lower():
            return f"{from_label}_MANAGES_{to_label}"
        elif "account" in fk_column.lower():
            return f"{from_label}_HAS_{to_label}"
        elif "type" in fk_column.lower():
            return f"{from_label}_IS_TYPE_{to_label}"
        else:
            # Generic relationship
            return f"{from_label}_REFERENCES_{to_label}"
