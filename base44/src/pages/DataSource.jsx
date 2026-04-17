import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Database, Upload, Server, CheckCircle2, XCircle, Loader2, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/ProjectContext";
import * as api from "@/api/convergenceClient";

const DB_TYPES = [
  { id: "oracle", label: "Oracle", icon: "🔴" },
  { id: "postgresql", label: "PostgreSQL", icon: "🐘" },
  { id: "mysql", label: "MySQL", icon: "🐬" },
  { id: "sqlserver", label: "SQL Server", icon: "🟦" },
];

const RECENT_CONNECTIONS = [
  { name: "prod-banking-db", type: "postgresql", host: "db.example.com:5432", date: "2026-04-15" },
  { name: "dev-ehr-schema", type: "oracle", host: "oracle.local:1521", date: "2026-04-14" },
];

export default function DataSource() {
  const navigate = useNavigate();
  const { createProject, currentProjectId, selectProject } = useProject();
  const [mode, setMode] = useState(null); // "file" | "db"
  const [dbType, setDbType] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [jdbcUrl, setJdbcUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const ensureProject = async () => {
    if (currentProjectId) return currentProjectId;
    const proj = await createProject("New Project");
    return proj.id;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleFileUpload = async () => {
    setUploading(true);
    try {
      const pid = await ensureProject();
      if (selectedFile) {
        await api.uploadDDL(pid, selectedFile);
      } else {
        await api.loadSample(pid, "banking");
      }
      navigate("/workspace");
    } catch {
      navigate("/workspace"); // fallback to mock
    } finally {
      setUploading(false);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    try {
      const pid = await ensureProject();
      await api.connectDB(pid, jdbcUrl);
      setConnectionStatus("success");
    } catch {
      setConnectionStatus("error");
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold mb-1">데이터 소스 연결</h1>
          <p className="text-sm text-muted-foreground mb-8">DDL 파일을 업로드하거나 라이브 DB에 직접 연결하세요.</p>
        </motion.div>

        {/* Connection mode selector */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { id: "file", icon: Upload, title: "DDL 파일 업로드", desc: "SQL DDL 파일을 드래그하여 업로드" },
            { id: "db", icon: Server, title: "DB 직접 연결", desc: "JDBC URL로 라이브 DB 연결" },
          ].map((opt) => (
            <motion.button
              key={opt.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => { setMode(opt.id); setConnectionStatus(null); }}
              className={cn(
                "p-6 rounded-xl border text-left transition-all",
                mode === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground/30"
              )}
            >
              <opt.icon className={cn("w-6 h-6 mb-3", mode === opt.id ? "text-primary" : "text-muted-foreground")} />
              <p className="font-medium text-sm mb-1">{opt.title}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* File upload */}
          {mode === "file" && (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div
                className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/40 transition-colors cursor-pointer bg-muted/20"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input ref={fileInputRef} type="file" accept=".sql,.ddl" className="hidden" onChange={handleFileSelect} />
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                {selectedFile ? (
                  <p className="text-sm font-medium mb-1 text-primary">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm font-medium mb-1">DDL 파일을 여기에 드래그하세요</p>
                )}
                <p className="text-xs text-muted-foreground">.sql, .ddl 파일 지원</p>
              </div>
              <Button
                onClick={handleFileUpload}
                disabled={uploading}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                스키마 분석 시작 <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* DB connection */}
          {mode === "db" && (
            <motion.div
              key="db"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* DB Type selector */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">DB 타입 선택</Label>
                <div className="grid grid-cols-4 gap-3">
                  {DB_TYPES.map((db) => (
                    <button
                      key={db.id}
                      onClick={() => setDbType(db.id)}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-all",
                        dbType === db.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-muted-foreground/30"
                      )}
                    >
                      <span className="text-2xl block mb-1">{db.icon}</span>
                      <span className="text-xs">{db.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* JDBC URL */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">JDBC URL</Label>
                <Input
                  value={jdbcUrl}
                  onChange={(e) => setJdbcUrl(e.target.value)}
                  placeholder="jdbc:postgresql://localhost:5432/mydb"
                  className="font-mono text-sm bg-muted/30"
                />
              </div>

              {/* Schema dropdown */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">스키마 / 카탈로그</Label>
                <Select>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder="연결 후 선택 가능" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">public</SelectItem>
                    <SelectItem value="banking">banking</SelectItem>
                    <SelectItem value="core">core</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Test + Status */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={connectionStatus === "testing"}
                  className="gap-2"
                >
                  {connectionStatus === "testing" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  연결 테스트
                </Button>
                {connectionStatus === "success" && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-chart-2 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> 연결 성공
                  </motion.div>
                )}
                {connectionStatus === "error" && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-destructive text-sm">
                    <XCircle className="w-4 h-4" /> 연결 실패
                  </motion.div>
                )}
              </div>

              <Button
                onClick={() => navigate("/workspace")}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={connectionStatus !== "success"}
              >
                스키마 분석 시작 <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent connections */}
        <div className="mt-10">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">최근 연결</h3>
          <div className="space-y-2">
            {RECENT_CONNECTIONS.map((conn) => (
              <div
                key={conn.name}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{conn.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{conn.host}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{conn.type}</Badge>
                  <span className="text-xs text-muted-foreground">{conn.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}