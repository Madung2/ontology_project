import React, { useState } from "react";
import { ChevronRight, ChevronDown, FileJson, Circle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SAMPLE_SEMANTIC_IR } from "@/lib/mockData";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function TreeNode({ label, type, children, badge, onSelect, isSelected }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = children && children.length > 0;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          if (onSelect) onSelect();
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded hover:bg-muted/50 transition-colors text-left",
          isSelected && "bg-primary/10 text-primary"
        )}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
        ) : (
          <Circle className="w-2 h-2 shrink-0 ml-0.5 mr-0.5" />
        )}
        <span className="font-mono">{label}</span>
        {type && <span className="text-muted-foreground ml-1">({type})</span>}
        {badge && (
          <Badge className="ml-auto text-[9px] px-1 py-0 bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
            {badge}
          </Badge>
        )}
      </button>
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="pl-4 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailPanel({ selected }) {
  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        좌측 트리에서 요소를 선택하세요
      </div>
    );
  }

  const isNode = selected.type === "node";
  const item = selected.data;

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-bold">{item.label || item.type}</h3>
        <Badge variant="outline" className="text-xs">
          {isNode ? "Node" : "Edge"}
        </Badge>
        {isNode && item.domain_mapping && (
          <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-xs">
            {item.domain_mapping.standard}:{item.domain_mapping.concept}
          </Badge>
        )}
      </div>

      <div className="space-y-4 text-sm">
        {isNode && (
          <>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Source Table</label>
              <p className="font-mono mt-1">{item.source_table}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Properties ({item.properties.length})</label>
              <div className="mt-2 space-y-1">
                {item.properties.map((p) => (
                  <div key={p.name} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs font-mono">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{p.type}</span>
                      <span className="text-muted-foreground/50">← {p.source_column}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {item.domain_mapping && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Domain Mapping</label>
                <div className="mt-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-yellow-400 font-medium">{item.domain_mapping.standard}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono">{item.domain_mapping.concept}</span>
                    <span className="text-muted-foreground ml-auto">{(item.domain_mapping.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!isNode && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">From</label>
                <p className="font-mono mt-1">{item.from}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">To</label>
                <p className="font-mono mt-1">{item.to}</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Cardinality</label>
              <p className="font-mono mt-1">{item.cardinality}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Source FK</label>
              <p className="font-mono mt-1">{item.source_fk}</p>
            </div>
            {item.properties.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Properties</label>
                <div className="mt-2 space-y-1">
                  {item.properties.map((p) => (
                    <div key={p.name} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs font-mono">
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">{p.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function SemanticIR() {
  const [selected, setSelected] = useState(null);
  const ir = SAMPLE_SEMANTIC_IR;

  return (
    <div className="h-screen flex flex-col">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-bold mb-1">Semantic IR Inspector</h1>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Nodes: <span className="text-primary font-mono">{ir.statistics.nodes}</span></span>
          <span>Edges: <span className="text-primary font-mono">{ir.statistics.edges}</span></span>
          <span>Properties: <span className="text-foreground font-mono">{ir.statistics.properties}</span></span>
          <span>Domain Mappings: <span className="text-yellow-400 font-mono">{ir.statistics.domain_mappings}</span></span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Tree view */}
        <div className="w-80 border-r border-border shrink-0">
          <ScrollArea className="h-full p-3">
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1">Nodes</p>
              {ir.nodes.map((node) => (
                <TreeNode
                  key={node.id}
                  label={node.label}
                  type="Node"
                  badge={node.domain_mapping ? `${node.domain_mapping.standard}` : null}
                  onSelect={() => setSelected({ type: "node", data: node })}
                  isSelected={selected?.data.id === node.id && selected?.type === "node"}
                >
                  {node.properties.map((p) => (
                    <TreeNode key={p.name} label={p.name} type={p.type} />
                  ))}
                </TreeNode>
              ))}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1 mt-3">Edges</p>
              {ir.edges.map((edge) => (
                <TreeNode
                  key={edge.id}
                  label={`${edge.from} → ${edge.to}`}
                  type={edge.type}
                  onSelect={() => setSelected({ type: "edge", data: edge })}
                  isSelected={selected?.data.id === edge.id && selected?.type === "edge"}
                >
                  {edge.properties.map((p) => (
                    <TreeNode key={p.name} label={p.name} type={p.type} />
                  ))}
                </TreeNode>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Detail panel */}
        <div className="flex-1">
          <ScrollArea className="h-full">
            <DetailPanel selected={selected} />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}