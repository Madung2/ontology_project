import React, { useState } from "react";
import { Brain, CheckCircle2, AlertTriangle, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SAMPLE_DOMAIN_DETECTION } from "@/lib/mockData";
import { motion } from "framer-motion";

export default function DomainDetection() {
  const data = SAMPLE_DOMAIN_DETECTION;
  const [override, setOverride] = useState("");

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold mb-1">도메인 감지 결과</h1>
          <p className="text-sm text-muted-foreground mb-8">Phase 0 — 자동 도메인 감지 및 온톨로지 매핑</p>
        </motion.div>

        {/* Primary domain */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl border border-primary/30 bg-primary/5 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{data.primary.name}</h2>
                <p className="text-xs text-muted-foreground">Primary Domain • {data.primary.standard} 표준</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{data.primary.confidence}%</div>
              <p className="text-xs text-muted-foreground">신뢰도</p>
            </div>
          </div>
          <Progress value={data.primary.confidence} className="h-2" />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Matching signals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <h3 className="text-sm font-semibold mb-4">매칭 시그널</h3>

            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">테이블 히트</p>
              <div className="flex flex-wrap gap-1.5">
                {data.signals.table_hits.map((t) => (
                  <Badge key={t} className="bg-primary/10 text-primary border-primary/20 font-mono text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">컬럼 히트</p>
              <div className="flex flex-wrap gap-1.5">
                {data.signals.column_hits.map((c) => (
                  <Badge key={c} variant="outline" className="font-mono text-xs text-chart-3 border-chart-3/20">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Alternative domains */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <h3 className="text-sm font-semibold mb-4">대안 도메인 후보</h3>
            <div className="space-y-3">
              {data.alternatives.map((alt, i) => (
                <div key={alt.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{i + 2}위</span>
                    <span className="text-sm">{alt.name}</span>
                    <Badge variant="outline" className="text-[10px]">{alt.standard}</Badge>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{alt.confidence}%</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">수동 도메인 오버라이드</p>
              <Select value={override} onValueChange={setOverride}>
                <SelectTrigger className="bg-muted/30 text-sm">
                  <SelectValue placeholder="자동 감지 결과 사용" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finance">Finance / Banking</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="retail">Retail / E-Commerce</SelectItem>
                  <SelectItem value="generic">General Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        </div>

        {/* SLM confirm + Seed mappings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">SLM 확인</h3>
              {data.primary.confidence < 80 ? (
                <Badge className="bg-chart-3/15 text-chart-3 border-chart-3/20">
                  <AlertTriangle className="w-3 h-3 mr-1" /> 확인 필요
                </Badge>
              ) : (
                <Badge className="bg-chart-2/15 text-chart-2 border-chart-2/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> 신뢰 가능
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              신뢰도가 80% 미만일 경우 SLM(Small Language Model)을 통한 2차 확인을 권장합니다.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> SLM 확인 요청
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-5 rounded-xl border border-border bg-card"
          >
            <h3 className="text-sm font-semibold mb-4">시드 매핑 미리보기</h3>
            <div className="space-y-2">
              {data.seed_mappings.map((m) => (
                <div key={m.erd} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-xs">
                  <span className="font-mono text-foreground">{m.erd}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 font-mono text-[10px]">
                    {m.ontology}
                  </Badge>
                  <span className="text-muted-foreground font-mono">{(m.confidence * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}