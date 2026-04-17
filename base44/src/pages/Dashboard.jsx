import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Database, GitBranch, ArrowRight, Hexagon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SAMPLE_PROJECTS } from "@/lib/mockData";
import { useProject } from "@/lib/ProjectContext";
import * as api from "@/api/convergenceClient";
import { motion } from "framer-motion";

const DB_ICONS = {
  postgresql: "🐘",
  oracle: "🔴",
  mysql: "🐬",
  sqlserver: "🟦",
  ddl_file: "📄",
};

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  analyzing: "bg-chart-4/15 text-chart-4 border-chart-4/20",
  converted: "bg-primary/15 text-primary border-primary/20",
  exported: "bg-chart-2/15 text-chart-2 border-chart-2/20",
};

function ProjectCard({ project, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link
        to="/workspace"
        className="group block p-5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{DB_ICONS[project.db_source]}</span>
            <div>
              <h3 className="font-medium text-sm text-card-foreground group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{project.domain}</p>
            </div>
          </div>
          <Badge variant="outline" className={STATUS_STYLES[project.status]}>
            {project.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{project.table_count} tables</span>
          <span className="w-px h-3 bg-border" />
          <span>{project.node_count} nodes</span>
          <span className="w-px h-3 bg-border" />
          <span>{project.edge_count} edges</span>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">{project.updated}</span>
          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Open <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

const SAMPLE_STARTERS = [
  { name: "Banking", icon: "🏦", tables: 8 },
  { name: "Healthcare", icon: "🏥", tables: 14 },
  { name: "E-Commerce", icon: "🛒", tables: 22 },
];

export default function Dashboard() {
  const { projects: liveProjects, refreshProjects, selectProject } = useProject();
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    refreshProjects().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false));
  }, [refreshProjects]);

  const displayProjects = liveProjects.length > 0 ? liveProjects : SAMPLE_PROJECTS;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Hexagon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Graphify</h1>
              <p className="text-sm text-muted-foreground">ERD ↔ Graph Schema Converter</p>
            </div>
          </div>
          {!backendOnline && (
            <p className="text-xs text-chart-3 mt-2">Backend offline — showing sample data</p>
          )}
        </motion.div>

        {/* Actions */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/connect">
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4" /> 새 프로젝트
            </Button>
          </Link>
        </div>

        {/* Recent Projects */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            최근 프로젝트
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayProjects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        </section>

        {/* Quick Start */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            샘플 프로젝트로 빠른 시작
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SAMPLE_STARTERS.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <Link
                  to="/workspace"
                  className="group flex items-center gap-4 p-4 rounded-xl border border-dashed border-border hover:border-primary/40 bg-muted/30 hover:bg-muted/50 transition-all"
                >
                  <span className="text-3xl">{s.icon}</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.tables} tables sample</p>
                  </div>
                  <Sparkles className="w-4 h-4 text-muted-foreground group-hover:text-primary ml-auto transition-colors" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}