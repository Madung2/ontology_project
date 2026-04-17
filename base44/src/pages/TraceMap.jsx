import React, { useState } from "react";
import { Route, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SAMPLE_TRACE_MAP } from "@/lib/mockData";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const CONVERSION_COLORS = {
  direct: { bg: "bg-chart-2/10", text: "text-chart-2", border: "border-chart-2/20", label: "Direct" },
  slm_enriched: { bg: "bg-chart-4/10", text: "text-chart-4", border: "border-chart-4/20", label: "SLM Enriched" },
  junction_merge: { bg: "bg-chart-3/10", text: "text-chart-3", border: "border-chart-3/20", label: "Junction Merge" },
};

export default function TraceMap() {
  const [filter, setFilter] = useState("all");
  const [selectedRow, setSelectedRow] = useState(null);

  const filtered = filter === "all"
    ? SAMPLE_TRACE_MAP
    : SAMPLE_TRACE_MAP.filter((r) => r.conversion_type === filter);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold mb-1">Trace Map</h1>
          <p className="text-sm text-muted-foreground mb-6">양방향 추적 — ERD ↔ Semantic IR ↔ Graph</p>
        </motion.div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 bg-muted/30 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 보기</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="slm_enriched">SLM Enriched</SelectItem>
              <SelectItem value="junction_merge">Junction Merge</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 3-column headers */}
        <div className="grid grid-cols-4 gap-2 mb-3 px-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ERD Table</div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Semantic IR</div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Graph Element</div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">변환 타입</div>
        </div>

        {/* Trace rows */}
        <div className="space-y-1.5">
          {filtered.map((row, i) => {
            const colors = CONVERSION_COLORS[row.conversion_type];
            const isSelected = selectedRow === i;
            return (
              <motion.div
                key={row.erd_table}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedRow(isSelected ? null : i)}
                className={cn(
                  "grid grid-cols-4 gap-2 items-center p-3 rounded-lg border cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/20"
                )}
              >
                {/* ERD */}
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isSelected ? "bg-primary" : "bg-muted-foreground/30")} />
                  <span className="font-mono text-sm">{row.erd_table}</span>
                </div>

                {/* Connector line + Semantic IR */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-px bg-border relative">
                    <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full", isSelected ? "bg-primary" : "bg-muted-foreground/30")} />
                  </div>
                  <span className="text-sm text-muted-foreground">{row.semantic_ir}</span>
                </div>

                {/* Graph Element */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-px bg-border relative">
                    <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full", isSelected ? "bg-primary" : "bg-muted-foreground/30")} />
                  </div>
                  <span className="font-mono text-sm text-primary">{row.graph_element}</span>
                </div>

                {/* Conversion type */}
                <div className="flex justify-end">
                  <Badge variant="outline" className={cn("text-[10px] font-mono", colors.text, colors.border, colors.bg)}>
                    {colors.label}
                  </Badge>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}