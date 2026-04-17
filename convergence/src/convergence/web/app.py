"""FastAPI web server for the Convergence Module."""

import asyncio
import json
import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from convergence.adapters.ddl_adapter import DDLAdapter
from convergence.adapters.sqlalchemy_adapter import SQLAlchemyAdapter
from convergence.core.schema_ir import SchemaIR, TableClassification, GraphRole
from convergence.core.semantic_ir import SemanticIR
from convergence.domain.detector import DomainDetector
from convergence.pipeline.classifier import classify_all_tables, classify_table_heuristic
from convergence.pipeline.converter import Converter
from convergence.slm.client import SLMClient, SLMConfig


# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(title="Convergence Module", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory project store ──────────────────────────────────────────
projects: dict[str, dict] = {}
_project_counter = 0


def _next_id() -> str:
    global _project_counter
    _project_counter += 1
    return f"proj_{_project_counter}"


# ── Pydantic request/response models ────────────────────────────────
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str
    status: str
    domain: Optional[str] = None
    stats: dict = {}
    created_at: str = ""


class ConvertRequest(BaseModel):
    project_id: str


class DBConnectRequest(BaseModel):
    connection_url: str
    schema_name: Optional[str] = None
    include_views: bool = False


class ClassificationOverride(BaseModel):
    table_name: str
    classification: str  # ENTITY, JUNCTION, LOOKUP, AUDIT
    graph_role: str  # NODE, EDGE, SKIP


class SLMSettingsUpdate(BaseModel):
    base_url: str = "http://localhost:11434"
    model: str = "gemma3:4b"
    model_heavy: str = "gemma3:27b"
    temperature: float = 0.1


# ── Global state ─────────────────────────────────────────────────────
slm_config = SLMConfig()
slm_client = SLMClient(slm_config)
domain_detector = DomainDetector()
converter = Converter()


# ── Helper: load banking sample ──────────────────────────────────────
def _load_sample(sample_name: str) -> Optional[str]:
    """Load a sample DDL file."""
    fixtures_dir = Path(__file__).parent.parent.parent.parent / "tests" / "fixtures"
    sample_file = fixtures_dir / f"{sample_name}_sample.sql"
    if sample_file.exists():
        return sample_file.read_text()
    return None


def _run_pipeline_from_schema(schema_ir: SchemaIR) -> dict:
    """Run domain detection, classification, and conversion on SchemaIR."""
    domain_name, confidence, signals = domain_detector.detect(schema_ir)
    domain_profile = domain_detector.PROFILES.get(domain_name)
    seed_mappings = domain_profile.seed_mappings if domain_profile else {}

    # Phase 2: Classify tables (heuristic only, sync)
    classifications = {}
    for table in schema_ir.tables:
        cls, conf, role = classify_table_heuristic(table, schema_ir)
        classifications[table.name] = (cls, conf, role)

    # Phase 3: Convert
    semantic_ir = converter.convert(schema_ir, classifications, domain_name, seed_mappings)

    return {
        "schema_ir": schema_ir,
        "domain": {
            "name": domain_name,
            "confidence": confidence,
            "signals": signals,
            "ontology_ref": domain_profile.ontology_ref if domain_profile else "Schema.org",
            "seed_mappings": seed_mappings,
        },
        "classifications": classifications,
        "semantic_ir": semantic_ir,
    }


def _run_pipeline(ddl_text: str) -> dict:
    """Run the full conversion pipeline on DDL text."""
    adapter = DDLAdapter(ddl_text)
    schema_ir = adapter.extract_schema(dialect=adapter.dialect)
    return _run_pipeline_from_schema(schema_ir)


def _store_pipeline_result(project_id: str, result: dict, source: dict) -> None:
    """Persist pipeline result into the in-memory project store."""
    proj = projects[project_id]
    proj["schema_ir"] = result["schema_ir"]
    proj["domain"] = result["domain"]
    proj["classifications"] = result["classifications"]
    proj["semantic_ir"] = result["semantic_ir"]
    proj["source"] = source
    proj["status"] = "converted"


def _mask_connection_url(connection_url: str) -> str:
    """Hide credentials before storing or returning a connection URL."""
    parts = urlsplit(connection_url)
    if not parts.password:
        return connection_url

    host = parts.hostname or ""
    if parts.port:
        host = f"{host}:{parts.port}"
    if parts.username:
        host = f"{parts.username}:***@{host}"

    return urlunsplit((parts.scheme, host, parts.path, parts.query, parts.fragment))


# ── API Routes ───────────────────────────────────────────────────────

@app.get("/api/projects")
def list_projects():
    """List all projects."""
    result = []
    for pid, proj in projects.items():
        stats = {}
        if "schema_ir" in proj:
            sir = proj["schema_ir"]
            stats["tables"] = len(sir.tables)
            stats["columns"] = sum(len(t.columns) for t in sir.tables)
        if "semantic_ir" in proj:
            sem = proj["semantic_ir"]
            stats["nodes"] = len(sem.nodes)
            stats["edges"] = len(sem.edges)
        result.append({
            "id": pid,
            "name": proj.get("name", "Untitled"),
            "description": proj.get("description", ""),
            "status": proj.get("status", "draft"),
            "domain": proj.get("domain", {}).get("name") if proj.get("domain") else None,
            "stats": stats,
        })
    return result


@app.post("/api/projects")
def create_project(req: ProjectCreate):
    """Create a new project."""
    pid = _next_id()
    projects[pid] = {
        "name": req.name,
        "description": req.description,
        "status": "draft",
    }
    return {"id": pid, "name": req.name, "status": "draft"}


@app.post("/api/projects/{project_id}/upload-ddl")
async def upload_ddl(project_id: str, file: UploadFile = File(...)):
    """Upload DDL file and run pipeline."""
    if project_id not in projects:
        raise HTTPException(404, "Project not found")

    ddl_text = (await file.read()).decode("utf-8")
    try:
        result = _run_pipeline(ddl_text)
        projects[project_id]["ddl_text"] = ddl_text
        _store_pipeline_result(project_id, result, {"type": "ddl_upload"})
        return {"status": "ok", "message": "Pipeline completed"}
    except Exception as e:
        raise HTTPException(400, f"DDL parsing failed: {str(e)}")


@app.post("/api/projects/{project_id}/load-sample")
def load_sample(project_id: str, sample_name: str = "banking"):
    """Load a sample DDL and run pipeline."""
    if project_id not in projects:
        raise HTTPException(404, "Project not found")

    ddl_text = _load_sample(sample_name)
    if not ddl_text:
        raise HTTPException(404, f"Sample '{sample_name}' not found")

    result = _run_pipeline(ddl_text)
    proj = projects[project_id]
    proj["ddl_text"] = ddl_text
    _store_pipeline_result(project_id, result, {"type": "sample", "sample_name": sample_name})
    return {"status": "ok", "message": f"Sample '{sample_name}' loaded"}


@app.post("/api/projects/{project_id}/connect-db")
def connect_database(project_id: str, req: DBConnectRequest):
    """Connect to a live database, reflect metadata, and run the pipeline."""
    if project_id not in projects:
        raise HTTPException(404, "Project not found")

    if not req.connection_url.strip():
        raise HTTPException(400, "connection_url is required")

    try:
        adapter = SQLAlchemyAdapter(
            req.connection_url,
            schema_name=req.schema_name,
            include_views=req.include_views,
        )
        schema_ir = adapter.extract_schema(dialect=adapter.dialect)
        result = _run_pipeline_from_schema(schema_ir)
        _store_pipeline_result(
            project_id,
            result,
            {
                "type": "database",
                "dialect": schema_ir.dialect,
                "schema_name": req.schema_name,
                "include_views": req.include_views,
                "connection_url": _mask_connection_url(req.connection_url),
            },
        )
    except ConnectionError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(400, f"Database reflection failed: {exc}")

    return {
        "status": "ok",
        "message": "Database schema reflected and pipeline completed",
        "dialect": schema_ir.dialect,
        "tables": len(schema_ir.tables),
        "foreign_keys": len(schema_ir.foreign_keys),
    }


@app.get("/api/projects/{project_id}/schema")
def get_schema(project_id: str):
    """Get parsed schema IR."""
    proj = projects.get(project_id)
    if not proj or "schema_ir" not in proj:
        raise HTTPException(404, "Schema not found")

    schema_ir: SchemaIR = proj["schema_ir"]
    return {
        "dialect": schema_ir.dialect,
        "tables": [
            {
                "name": t.name,
                "columns": [
                    {
                        "name": c.name,
                        "data_type": c.data_type,
                        "nullable": c.nullable,
                        "is_pk": c.is_pk,
                        "is_fk": c.is_fk,
                        "fk_ref": c.fk_ref,
                    }
                    for c in t.columns
                ],
                "column_count": len(t.columns),
            }
            for t in schema_ir.tables
        ],
        "foreign_keys": [
            {
                "from_table": fk.from_table,
                "from_column": fk.from_column,
                "to_table": fk.to_table,
                "to_column": fk.to_column,
            }
            for fk in schema_ir.foreign_keys
        ],
    }


@app.get("/api/projects/{project_id}/domain")
def get_domain(project_id: str):
    """Get domain detection result."""
    proj = projects.get(project_id)
    if not proj or "domain" not in proj:
        raise HTTPException(404, "Domain detection not run")
    return proj["domain"]


@app.get("/api/projects/{project_id}/classification")
def get_classification(project_id: str):
    """Get table classifications."""
    proj = projects.get(project_id)
    if not proj or "classifications" not in proj:
        raise HTTPException(404, "Classification not run")

    classifications = proj["classifications"]
    result = []
    for table_name, (cls, conf, role) in classifications.items():
        result.append({
            "table_name": table_name,
            "classification": cls.value,
            "confidence": conf,
            "graph_role": role.value,
            "source": "heuristic",
        })
    return result


@app.post("/api/projects/{project_id}/classification/override")
def override_classification(project_id: str, req: ClassificationOverride):
    """Override a table's classification."""
    proj = projects.get(project_id)
    if not proj or "classifications" not in proj:
        raise HTTPException(404, "Classification not run")

    try:
        cls = TableClassification(req.classification)
        role = GraphRole(req.graph_role)
    except ValueError as e:
        raise HTTPException(400, str(e))

    proj["classifications"][req.table_name] = (cls, 1.0, role)
    return {"status": "ok"}


@app.get("/api/projects/{project_id}/semantic-ir")
def get_semantic_ir(project_id: str):
    """Get semantic IR."""
    proj = projects.get(project_id)
    if not proj or "semantic_ir" not in proj:
        raise HTTPException(404, "SemanticIR not available")

    sem: SemanticIR = proj["semantic_ir"]
    return {
        "nodes": [
            {
                "id": n.id,
                "label": n.label,
                "source_table": n.source_table,
                "properties": [
                    {"name": p.name, "data_type": p.data_type, "source_column": p.source_column}
                    for p in n.properties
                ],
                "domain_mapping": n.domain_mapping,
            }
            for n in sem.nodes
        ],
        "edges": [
            {
                "id": e.id,
                "edge_type": e.edge_type,
                "from_node": e.from_node,
                "to_node": e.to_node,
                "cardinality": e.cardinality,
                "properties": [
                    {"name": p.name, "data_type": p.data_type, "source_column": p.source_column}
                    for p in e.properties
                ],
                "source_fk": e.source_fk,
                "domain_mapping": e.domain_mapping,
            }
            for e in sem.edges
        ],
        "trace_links": [
            {
                "source_table": t.source_table,
                "source_column": t.source_column,
                "target_type": t.target_type,
                "target_id": t.target_id,
                "transform_type": t.transform_type,
            }
            for t in sem.trace_links
        ],
        "stats": sem.stats,
        "domain_mappings": sem.domain_mappings,
    }


@app.get("/api/projects/{project_id}/trace")
def get_trace(project_id: str):
    """Get trace links for visualization."""
    proj = projects.get(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    sem: SemanticIR = proj.get("semantic_ir")
    schema_ir: SchemaIR = proj.get("schema_ir")
    classifications = proj.get("classifications", {})

    if not sem or not schema_ir:
        raise HTTPException(404, "Pipeline not run")

    rows = []
    for table in schema_ir.tables:
        cls, conf, role = classifications.get(
            table.name, (TableClassification.UNKNOWN, 0.5, GraphRole.NODE)
        )

        # Find matching trace link
        trace = next(
            (t for t in sem.trace_links if t.source_table == table.name and t.source_column is None),
            None,
        )

        # Find semantic element
        semantic_desc = "—"
        graph_element = "—"
        transform_type = "direct"

        if trace:
            transform_type = trace.transform_type
            if trace.target_type == "node":
                node = next((n for n in sem.nodes if n.id == trace.target_id), None)
                if node:
                    semantic_desc = f"{node.label} (Node)"
                    graph_element = f":{node.label}"
            elif trace.target_type == "edge":
                edge = next((e for e in sem.edges if e.id == trace.target_id), None)
                if edge:
                    semantic_desc = f"{edge.edge_type} (Edge)"
                    graph_element = f"[:{edge.edge_type}]"
        elif cls == TableClassification.LOOKUP:
            semantic_desc = "— (Skipped)"
            graph_element = "— (Lookup)"
        elif cls == TableClassification.AUDIT:
            semantic_desc = "— (Skipped)"
            graph_element = "— (Audit)"

        rows.append({
            "table_name": table.name,
            "classification": cls.value,
            "semantic_ir": semantic_desc,
            "graph_element": graph_element,
            "transform_type": transform_type,
        })

    return rows


@app.get("/api/projects/{project_id}/export/{format}")
def export_code(project_id: str, format: str):
    """Export semantic IR in various formats."""
    proj = projects.get(project_id)
    if not proj or "semantic_ir" not in proj:
        raise HTTPException(404, "SemanticIR not available")

    sem: SemanticIR = proj["semantic_ir"]
    schema_ir: SchemaIR = proj.get("schema_ir")

    if format == "cypher":
        return {"format": "cypher", "code": _export_cypher(sem, schema_ir)}
    elif format == "mermaid":
        return {"format": "mermaid", "code": _export_mermaid(sem)}
    elif format == "json":
        return {"format": "json", "code": json.dumps(sem.model_dump(), indent=2, default=str)}
    elif format == "yaml":
        return {"format": "yaml", "code": _export_yaml(sem)}
    elif format == "rdf-owl":
        return {"format": "rdf-owl", "code": _export_rdf_owl(sem)}
    else:
        raise HTTPException(400, f"Unknown format: {format}")


@app.post("/api/projects/{project_id}/reconvert")
def reconvert(project_id: str):
    """Re-run conversion with current classifications."""
    proj = projects.get(project_id)
    if not proj or "schema_ir" not in proj:
        raise HTTPException(404, "Schema not found")

    schema_ir = proj["schema_ir"]
    classifications = proj["classifications"]
    domain = proj.get("domain", {})
    domain_name = domain.get("name", "generic")
    seed_mappings = domain.get("seed_mappings", {})

    sem = converter.convert(schema_ir, classifications, domain_name, seed_mappings)
    proj["semantic_ir"] = sem
    proj["status"] = "converted"
    return {"status": "ok"}


@app.get("/api/slm/status")
async def slm_status():
    """Check SLM availability."""
    available = await slm_client.is_available()
    return {"available": available, "config": slm_config.model_dump()}


@app.post("/api/slm/settings")
def update_slm_settings(req: SLMSettingsUpdate):
    """Update SLM settings."""
    global slm_config, slm_client
    slm_config = SLMConfig(
        base_url=req.base_url,
        model=req.model,
        model_heavy=req.model_heavy,
        temperature=req.temperature,
    )
    slm_client = SLMClient(slm_config)
    return {"status": "ok", "config": slm_config.model_dump()}


# ── Export helpers ───────────────────────────────────────────────────

def _export_cypher(sem: SemanticIR, schema_ir: SchemaIR = None) -> str:
    lines = ["// Node creation"]
    for node in sem.nodes:
        props = ", ".join(
            f"{p.name}: ${p.name}" for p in node.properties
            if not p.name.endswith("_id")
        )
        lines.append(f"CREATE (:{node.label} {{{props}}});")

    lines.append("")
    lines.append("// Relationship creation")
    for edge in sem.edges:
        from_node = next((n for n in sem.nodes if n.id == edge.from_node), None)
        to_node = next((n for n in sem.nodes if n.id == edge.to_node), None)
        if from_node and to_node:
            fl = from_node.label[0].lower()
            tl = to_node.label[0].lower()
            if fl == tl:
                tl = tl + "2"

            # Build edge type (simplify)
            et = edge.edge_type
            for prefix in [from_node.label + "_", to_node.label + "_"]:
                et = et.replace(prefix, "")

            if edge.properties:
                props = ", ".join(f"{p.name}: ${p.name}" for p in edge.properties)
                lines.append(
                    f"MATCH ({fl}:{from_node.label}), ({tl}:{to_node.label})")
                lines.append(
                    f"CREATE ({fl})-[:{et} {{{props}}}]->({tl});")
            else:
                lines.append(
                    f"MATCH ({fl}:{from_node.label}), ({tl}:{to_node.label})")
                lines.append(f"CREATE ({fl})-[:{et}]->({tl});")
            lines.append("")

    # Indexes
    lines.append("// Index creation")
    for node in sem.nodes:
        for p in node.properties:
            if p.name in ("email", "status", "txn_date", "account_number"):
                idx = f"{node.label.lower()}_{p.name}_idx"
                nl = node.label[0].lower()
                lines.append(
                    f"CREATE INDEX {idx} FOR ({nl}:{node.label}) ON ({nl}.{p.name});"
                )

    return "\n".join(lines)


def _export_mermaid(sem: SemanticIR) -> str:
    lines = ["graph LR"]
    for node in sem.nodes:
        props_count = len(node.properties)
        lines.append(f"    {node.id}(({node.label}<br/>{props_count} props))")

    for edge in sem.edges:
        et = edge.edge_type
        # Simplify edge type
        for node in sem.nodes:
            et = et.replace(f"{node.label}_", "")
        lines.append(f"    {edge.from_node} -->|{et}| {edge.to_node}")

    return "\n".join(lines)


def _export_yaml(sem: SemanticIR) -> str:
    lines = ["# Convergence Semantic IR Export", "nodes:"]
    for node in sem.nodes:
        lines.append(f"  - id: {node.id}")
        lines.append(f"    label: {node.label}")
        lines.append(f"    source_table: {node.source_table}")
        if node.domain_mapping:
            lines.append(f"    domain_mapping: {node.domain_mapping}")
        lines.append(f"    properties:")
        for p in node.properties:
            lines.append(f"      - name: {p.name}")
            lines.append(f"        type: {p.data_type}")

    lines.append("")
    lines.append("edges:")
    for edge in sem.edges:
        lines.append(f"  - id: {edge.id}")
        lines.append(f"    type: {edge.edge_type}")
        lines.append(f"    from: {edge.from_node}")
        lines.append(f"    to: {edge.to_node}")
        lines.append(f"    cardinality: {edge.cardinality}")

    return "\n".join(lines)


def _export_rdf_owl(sem: SemanticIR) -> str:
    lines = [
        '<?xml version="1.0"?>',
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
        '         xmlns:owl="http://www.w3.org/2002/07/owl#"',
        '         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"',
        '         xmlns:conv="http://convergence.dev/ontology#">',
        "",
        "  <!-- Classes -->",
    ]
    for node in sem.nodes:
        lines.append(f'  <owl:Class rdf:about="conv:{node.label}">')
        lines.append(f'    <rdfs:label>{node.label}</rdfs:label>')
        if node.domain_mapping:
            ont = node.domain_mapping.get("ontology", "")
            lines.append(f'    <rdfs:comment>Mapped to {ont}</rdfs:comment>')
        lines.append(f'  </owl:Class>')

    lines.append("")
    lines.append("  <!-- Object Properties -->")
    for edge in sem.edges:
        et = edge.edge_type.replace(" ", "_")
        lines.append(f'  <owl:ObjectProperty rdf:about="conv:{et}">')
        from_node = next((n for n in sem.nodes if n.id == edge.from_node), None)
        to_node = next((n for n in sem.nodes if n.id == edge.to_node), None)
        if from_node:
            lines.append(f'    <rdfs:domain rdf:resource="conv:{from_node.label}"/>')
        if to_node:
            lines.append(f'    <rdfs:range rdf:resource="conv:{to_node.label}"/>')
        lines.append(f'  </owl:ObjectProperty>')

    lines.append("")
    lines.append("</rdf:RDF>")
    return "\n".join(lines)


# ── Static files ─────────────────────────────────────────────────────
FRONTEND_DIR = Path(__file__).parent.parent.parent.parent / "frontend"


@app.get("/")
def serve_index():
    """Serve the frontend."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Convergence Module API. Frontend not found."}


if FRONTEND_DIR.exists() and (FRONTEND_DIR / "static").exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")
