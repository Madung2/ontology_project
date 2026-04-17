import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Play, Download, FolderOpen } from "lucide-react";

export default function TopBar({ mode, onModeChange, projectName }) {
  return (
    <div className="h-12 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">{projectName || "Banking Core Schema"}</h2>
        <Badge variant="outline" className="text-xs font-mono">8 tables</Badge>
      </div>

      <div className="flex items-center gap-2">
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && onModeChange(v)} className="bg-muted/50 rounded-md p-0.5">
          <ToggleGroupItem value="erd_to_graph" className="text-xs px-3 py-1 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            ERD → Graph
          </ToggleGroupItem>
          <ToggleGroupItem value="graph_to_erd" className="text-xs px-3 py-1 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Graph → ERD
          </ToggleGroupItem>
          <ToggleGroupItem value="bidirectional" className="text-xs px-3 py-1 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            Bidirectional
          </ToggleGroupItem>
        </ToggleGroup>

        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs">
          <Play className="w-3 h-3" /> Convert
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
          <FolderOpen className="w-3 h-3" /> Sample
        </Button>
      </div>
    </div>
  );
}