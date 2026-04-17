import React from "react";
import { SAMPLE_BANKING_SCHEMA, SAMPLE_GRAPH_DATA, SAMPLE_DOMAIN_DETECTION } from "@/lib/mockData";

export default function StatusBar() {
  const stats = [
    { label: "Tables", value: SAMPLE_BANKING_SCHEMA.tables.length },
    { label: "Columns", value: SAMPLE_BANKING_SCHEMA.tables.reduce((sum, t) => sum + t.columns.length, 0) },
    { label: "Nodes", value: SAMPLE_GRAPH_DATA.nodes.length },
    { label: "Edges", value: SAMPLE_GRAPH_DATA.edges.length },
    { label: "Domain", value: SAMPLE_DOMAIN_DETECTION.primary.name, highlight: true },
  ];

  return (
    <div className="h-7 border-t border-border bg-card/50 flex items-center px-4 gap-6 shrink-0">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{s.label}:</span>
          <span className={s.highlight ? "text-primary font-medium" : "text-foreground font-mono"}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}