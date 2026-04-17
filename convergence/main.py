"""Main entry point for Convergence Module pipeline."""

import asyncio
import sys
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from convergence.adapters.ddl_adapter import DDLAdapter
from convergence.domain.detector import DomainDetector
from convergence.pipeline.classifier import classify_all_tables
from convergence.pipeline.converter import Converter


async def main():
    """Run the full pipeline on banking_sample.sql."""
    console = Console()

    # Load DDL file
    sql_file = Path(__file__).parent / "tests" / "fixtures" / "banking_sample.sql"
    if not sql_file.exists():
        console.print(f"[red]Error: {sql_file} not found[/red]")
        sys.exit(1)

    ddl_text = sql_file.read_text()
    console.print(f"[green]Loaded DDL from {sql_file}[/green]\n")

    # Step 1: Parse DDL → SchemaIR
    console.print("[cyan]Step 1: Parsing DDL...[/cyan]")
    adapter = DDLAdapter(ddl_text)
    schema_ir = adapter.extract_schema(dialect=adapter.dialect)
    console.print(f"[green]✓ Parsed {len(schema_ir.tables)} tables, {len(schema_ir.foreign_keys)} foreign keys[/green]\n")

    # Step 2: Detect domain
    console.print("[cyan]Step 2: Detecting domain...[/cyan]")
    detector = DomainDetector()
    domain_name, confidence, signals = detector.detect(schema_ir)
    console.print(f"[green]✓ Detected domain: {domain_name} (confidence: {confidence:.2f})[/green]\n")

    # Step 3: Classify tables
    console.print("[cyan]Step 3: Classifying tables...[/cyan]")
    classifications = await classify_all_tables(schema_ir)
    console.print(f"[green]✓ Classified {len(classifications)} tables[/green]\n")

    # Show classification table
    classification_table = Table(title="Table Classifications")
    classification_table.add_column("Table", style="cyan")
    classification_table.add_column("Classification", style="magenta")
    classification_table.add_column("Confidence", style="yellow")
    classification_table.add_column("Role", style="green")

    for table_name in sorted(classifications.keys()):
        classification, confidence, role = classifications[table_name]
        classification_table.add_row(
            table_name,
            classification.value,
            f"{confidence:.2f}",
            role.value,
        )

    console.print(classification_table)
    console.print()

    # Step 4: Convert to SemanticIR
    console.print("[cyan]Step 4: Converting to SemanticIR...[/cyan]")
    domain_profiles = DomainDetector.PROFILES
    seed_mappings = domain_profiles.get(domain_name).seed_mappings if domain_name in domain_profiles else {}

    converter = Converter()
    semantic_ir = converter.convert(schema_ir, classifications, domain_name, seed_mappings)
    console.print(f"[green]✓ Converted to semantic graph[/green]\n")

    # Show summary
    summary_table = Table(title="Semantic Graph Summary")
    summary_table.add_column("Metric", style="cyan")
    summary_table.add_column("Count", style="yellow")

    stats = semantic_ir.stats
    for key, value in stats.items():
        summary_table.add_row(key.replace("_", " ").title(), str(value))

    console.print(summary_table)
    console.print()

    # Show nodes
    if semantic_ir.nodes:
        nodes_table = Table(title="Graph Nodes")
        nodes_table.add_column("ID", style="cyan")
        nodes_table.add_column("Label", style="magenta")
        nodes_table.add_column("Source Table", style="yellow")
        nodes_table.add_column("Properties", style="green")

        for node in semantic_ir.nodes:
            nodes_table.add_row(
                node.id,
                node.label,
                node.source_table,
                str(len(node.properties)),
            )

        console.print(nodes_table)
        console.print()

    # Show edges
    if semantic_ir.edges:
        edges_table = Table(title="Graph Edges")
        edges_table.add_column("ID", style="cyan")
        edges_table.add_column("Type", style="magenta")
        edges_table.add_column("From", style="yellow")
        edges_table.add_column("To", style="yellow")
        edges_table.add_column("Cardinality", style="green")

        for edge in semantic_ir.edges:
            edges_table.add_row(
                edge.id,
                edge.edge_type,
                edge.from_node,
                edge.to_node,
                edge.cardinality,
            )

        console.print(edges_table)
        console.print()

    # Final summary
    console.print(Panel(
        f"[green]Pipeline completed successfully![/green]\n"
        f"Domain: {domain_name}\n"
        f"Tables: {len(schema_ir.tables)}\n"
        f"Nodes: {stats['nodes']}\n"
        f"Edges: {stats['edges']}\n"
        f"Trace Links: {stats['trace_links']}",
        title="[bold]Convergence Module Summary[/bold]",
        border_style="green",
    ))


if __name__ == "__main__":
    asyncio.run(main())
