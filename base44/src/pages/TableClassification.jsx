import React, { useState } from "react";
import { TableProperties, Sparkles, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SAMPLE_BANKING_SCHEMA } from "@/lib/mockData";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const CLASSIFICATION_COLORS = {
  entity: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  junction: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  lookup: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
  audit: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
};

const ROLE_COLORS = {
  Node: "text-primary",
  Edge: "text-chart-3",
  Skip: "text-muted-foreground",
};

export default function TableClassification() {
  const [tables, setTables] = useState(SAMPLE_BANKING_SCHEMA.tables);

  const handleReclassify = (tableName, newClass) => {
    setTables((prev) =>
      prev.map((t) =>
        t.name === tableName ? { ...t, classification: newClass, source: "manual" } : t
      )
    );
  };

  const counts = tables.reduce((acc, t) => {
    acc[t.classification] = (acc[t.classification] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-bold mb-1">테이블 분류</h1>
              <p className="text-sm text-muted-foreground">Phase 1 — 테이블 역할 분류 및 Graph Role 할당</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCcw className="w-3.5 h-3.5" /> SLM 전체 재분석
            </Button>
          </div>
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {Object.entries(CLASSIFICATION_COLORS).map(([key, colors]) => (
            <div key={key} className={cn("p-3 rounded-lg border", colors.border, colors.bg)}>
              <div className={cn("text-xl font-bold", colors.text)}>{counts[key] || 0}</div>
              <div className="text-xs text-muted-foreground capitalize">{key}</div>
            </div>
          ))}
        </div>

        {/* Table list */}
        <div className="space-y-3">
          {tables.map((table, i) => {
            const colors = CLASSIFICATION_COLORS[table.classification];
            return (
              <motion.div
                key={table.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">{table.name}</span>
                    <Badge variant="outline" className={cn("text-[10px]", colors.text, colors.border, colors.bg)}>
                      {table.classification}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      src: {table.source}
                    </Badge>
                    <span className={cn("text-xs font-medium", ROLE_COLORS[table.graphRole])}>
                      {table.graphRole}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={table.classification}
                      onValueChange={(v) => handleReclassify(table.name, v)}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entity">Entity</SelectItem>
                        <SelectItem value="junction">Junction</SelectItem>
                        <SelectItem value="lookup">Lookup</SelectItem>
                        <SelectItem value="audit">Audit</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={table.confidence * 100} className="h-1.5 flex-1" />
                  <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                    {(table.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}