import React, { useState } from "react";
import { ChevronDown, ChevronRight, Key, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SAMPLE_BANKING_SCHEMA } from "@/lib/mockData";

function TableCard({ table }) {
  const [expanded, setExpanded] = useState(table.name === "customers");

  const classificationColors = {
    entity: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    junction: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    lookup: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
    audit: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50 hover:border-primary/20 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="font-mono text-sm font-medium">{table.name}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", classificationColors[table.classification])}>
            {table.classification}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{table.columns.length} cols</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-1">
          {table.columns.map((col) => (
            <div key={col.name} className="flex items-center gap-2 py-0.5 text-xs">
              <div className="flex items-center gap-1 w-4">
                {col.pk && <Key className="w-3 h-3 text-yellow-400" />}
                {col.fk && <Link2 className="w-3 h-3 text-primary" />}
              </div>
              <span className="font-mono text-foreground">{col.name}</span>
              <span className="text-muted-foreground font-mono ml-auto">{col.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ERDPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ERD Schema</h3>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {SAMPLE_BANKING_SCHEMA.tables.map((table) => (
            <TableCard key={table.name} table={table} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}