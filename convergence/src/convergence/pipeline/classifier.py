"""Table classification for semantic role detection."""

import json
from convergence.core.schema_ir import (
    TableIR, SchemaIR, TableClassification, GraphRole
)
from convergence.slm.client import SLMClient


def classify_table_heuristic(
    table: TableIR,
    schema: SchemaIR
) -> tuple[TableClassification, float, GraphRole]:
    """
    Classify a table using heuristic rules.

    Returns:
        (classification, confidence_0_to_1, graph_role)
    """
    # Get primary key and foreign key columns
    pk_columns = [col for col in table.columns if col.is_pk]
    fk_columns = [col for col in table.columns if col.is_fk]

    # Count outgoing and incoming FKs
    outgoing_fks = len(schema.get_fks_from(table.name))
    incoming_fks = len(schema.get_fks_to(table.name))

    # Rule 1: Junction table (composite PK with mostly FKs)
    if len(pk_columns) >= 2 and len([c for c in pk_columns if c.is_fk]) >= 2:
        return TableClassification.JUNCTION, 0.95, GraphRole.EDGE

    # Rule 2: Audit table (name ends with _log, _audit, _history)
    table_name_lower = table.name.lower()
    if any(table_name_lower.endswith(suffix) for suffix in ["_log", "_audit", "_history"]):
        return TableClassification.AUDIT, 0.9, GraphRole.SKIP

    # Rule 3: Lookup/code table (small table with reference-data naming)
    lookup_name_tokens = [
        "type", "code", "status", "category", "currency", "country",
        "state", "region", "lookup", "reference", "enum"
    ]
    lookup_column_tokens = ["code", "type", "status", "name", "description"]
    lookup_name_hit = any(token in table_name_lower for token in lookup_name_tokens)
    lookup_column_hits = sum(
        1
        for col in table.columns
        if any(token in col.name.lower() for token in lookup_column_tokens)
    )
    if len(table.columns) <= 4 and outgoing_fks == 0 and (
        lookup_name_hit or lookup_column_hits >= 2
    ):
        return TableClassification.LOOKUP, 0.85, GraphRole.SKIP

    # Rule 4: Entity table (has single-column PK)
    if len(pk_columns) == 1:
        return TableClassification.ENTITY, 0.8, GraphRole.NODE

    # Rule 5: Hybrid (3+ FK columns)
    if len(fk_columns) >= 3:
        return TableClassification.ENTITY, 0.7, GraphRole.NODE

    # Default
    return TableClassification.UNKNOWN, 0.5, GraphRole.NODE


async def classify_table_slm(
    table: TableIR,
    schema: SchemaIR,
    slm_client: SLMClient
) -> tuple[TableClassification, float, GraphRole]:
    """
    Classify a table using SLM (Small Language Model).

    Returns:
        (classification, confidence_0_to_1, graph_role)
    """
    # Build context about the table
    columns_desc = ", ".join([f"{col.name} ({col.data_type})" for col in table.columns])
    fks_desc = ", ".join([f"{fk.from_column} → {fk.to_table}" for fk in schema.get_fks_from(table.name)])
    fks_in = schema.get_fks_to(table.name)

    prompt = f"""Classify this database table semantically. Respond with ONLY a JSON object.

Table: {table.name}
Columns: {columns_desc}
Outgoing FKs: {fks_desc if fks_desc else "none"}
Incoming FKs: {len(fks_in)}

Respond with JSON:
{{"classification": "ENTITY|JUNCTION|LOOKUP|AUDIT|UNKNOWN", "confidence": 0.0-1.0, "reasoning": "..."}}"""

    try:
        response = await slm_client.generate(prompt, json_mode=True)
        data = json.loads(response)
        classification = TableClassification(data["classification"])
        confidence = float(data.get("confidence", 0.5))
    except Exception:
        # Fallback to heuristic
        return classify_table_heuristic(table, schema)

    # Determine graph role from classification
    role_map = {
        TableClassification.ENTITY: GraphRole.NODE,
        TableClassification.JUNCTION: GraphRole.EDGE,
        TableClassification.LOOKUP: GraphRole.SKIP,
        TableClassification.AUDIT: GraphRole.SKIP,
        TableClassification.UNKNOWN: GraphRole.NODE,
    }

    return classification, confidence, role_map.get(classification, GraphRole.NODE)


async def classify_all_tables(
    schema: SchemaIR,
    slm_client: SLMClient = None
) -> dict[str, tuple[TableClassification, float, GraphRole]]:
    """
    Classify all tables in the schema.

    Uses heuristic first, SLM only for low-confidence results.

    Returns:
        dict mapping table_name → (classification, confidence, graph_role)
    """
    results = {}

    for table in schema.tables:
        # Try heuristic first
        classification, confidence, role = classify_table_heuristic(table, schema)

        # If confidence is low and SLM is available, try SLM
        if confidence < 0.8 and slm_client:
            try:
                classification, confidence, role = await classify_table_slm(table, schema, slm_client)
            except Exception:
                # Keep heuristic result
                pass

        results[table.name] = (classification, confidence, role)

    return results
