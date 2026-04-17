import React, { useRef, useState, useEffect, useCallback } from "react";
import { SAMPLE_GRAPH_DATA } from "@/lib/mockData";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const NODE_RADIUS = 36;

export default function GraphPanel() {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null);
  const [nodePositions, setNodePositions] = useState(() => {
    const pos = {};
    SAMPLE_GRAPH_DATA.nodes.forEach((n) => {
      pos[n.id] = { x: n.x, y: n.y };
    });
    return pos;
  });

  const handleMouseDown = useCallback((nodeId, e) => {
    e.stopPropagation();
    setDragging({ nodeId, startX: e.clientX, startY: e.clientY, origX: nodePositions[nodeId].x, origY: nodePositions[nodeId].y });
  }, [nodePositions]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / zoom;
    const dy = (e.clientY - dragging.startY) / zoom;
    setNodePositions((prev) => ({
      ...prev,
      [dragging.nodeId]: { x: dragging.origX + dx, y: dragging.origY + dy },
    }));
  }, [dragging, zoom]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const getEdgePath = (edge) => {
    const from = nodePositions[edge.from];
    const to = nodePositions[edge.to];
    if (!from || !to) return "";
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    const sx = from.x + nx * NODE_RADIUS;
    const sy = from.y + ny * NODE_RADIUS;
    const ex = to.x - nx * NODE_RADIUS;
    const ey = to.y - ny * NODE_RADIUS;
    const mx = (sx + ex) / 2 + ny * 30;
    const my = (sy + ey) / 2 - nx * 30;
    return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
  };

  const getEdgeLabelPos = (edge) => {
    const from = nodePositions[edge.from];
    const to = nodePositions[edge.to];
    if (!from || !to) return { x: 0, y: 0 };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    return { x: (from.x + to.x) / 2 + ny * 18, y: (from.y + to.y) / 2 - nx * 18 };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Graph Visualization</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-background">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ cursor: dragging ? "grabbing" : "default" }}
        >
          <defs>
            <marker id="arrowhead" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(185, 72%, 48%)" opacity="0.6" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {SAMPLE_GRAPH_DATA.edges.map((edge) => {
              const labelPos = getEdgeLabelPos(edge);
              return (
                <g key={edge.id}>
                  <path
                    d={getEdgePath(edge)}
                    fill="none"
                    stroke="hsl(185, 72%, 48%)"
                    strokeWidth="1.5"
                    opacity="0.4"
                    markerEnd="url(#arrowhead)"
                  />
                  <text x={labelPos.x} y={labelPos.y} textAnchor="middle" fill="hsl(185, 72%, 48%)" fontSize="9" fontFamily="var(--font-mono)" opacity="0.8">
                    {edge.type}
                  </text>
                  <text x={labelPos.x} y={labelPos.y + 12} textAnchor="middle" fill="hsl(215, 12%, 50%)" fontSize="8" fontFamily="var(--font-mono)">
                    {edge.cardinality}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {SAMPLE_GRAPH_DATA.nodes.map((node) => {
              const pos = nodePositions[node.id];
              const hasDomain = !!node.domain_mapping;
              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  style={{ cursor: "grab" }}
                >
                  <circle r={NODE_RADIUS} fill="hsl(220, 18%, 10%)" stroke={hasDomain ? "hsl(43, 74%, 66%)" : "hsl(185, 72%, 48%)"} strokeWidth={hasDomain ? 2 : 1.5} opacity="0.9" filter="url(#glow)" />
                  <text textAnchor="middle" dy="0.3em" fill="hsl(210, 20%, 92%)" fontSize="11" fontWeight="600" fontFamily="var(--font-sans)">
                    {node.label}
                  </text>
                  <text textAnchor="middle" dy="2.2em" fill="hsl(215, 12%, 50%)" fontSize="7" fontFamily="var(--font-mono)">
                    {node.properties.length} props
                  </text>
                  {hasDomain && (
                    <circle r="5" cx={NODE_RADIUS - 4} cy={-NODE_RADIUS + 4} fill="hsl(43, 74%, 66%)" />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}