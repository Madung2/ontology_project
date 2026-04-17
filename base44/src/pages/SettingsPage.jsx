import React, { useState, useEffect } from "react";
import { Settings, Sparkles, Palette, Sliders, Database, CheckCircle2, Loader2, XCircle } from "lucide-react";
import * as api from "@/api/convergenceClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [model, setModel] = useState("gemma4:4b");
  const [slmStatus, setSlmStatus] = useState(null);
  const [pluralize, setPluralize] = useState(true);
  const [includeFkNodes, setIncludeFkNodes] = useState(false);
  const [minConfidence, setMinConfidence] = useState([70]);

  useEffect(() => {
    api.getSLMStatus().then((data) => {
      if (data.config) {
        setOllamaUrl(data.config.base_url || ollamaUrl);
        setModel(data.config.model || model);
      }
      setSlmStatus(data.available ? "success" : null);
    }).catch(() => {});
  }, []);

  const testSLM = async () => {
    setSlmStatus("testing");
    try {
      await api.updateSLMSettings({ base_url: ollamaUrl, model, temperature: 0.1 });
      const status = await api.getSLMStatus();
      setSlmStatus(status.available ? "success" : "error");
    } catch {
      setSlmStatus("error");
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold mb-1">설정</h1>
          <p className="text-sm text-muted-foreground mb-8">SLM, 도메인, 변환 옵션을 관리합니다.</p>
        </motion.div>

        <div className="space-y-8">
          {/* SLM Settings */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">SLM 설정</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ollama URL</Label>
                <Input
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="font-mono text-sm bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">모델 선택</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemma4:4b">gemma4:4b (빠름)</SelectItem>
                    <SelectItem value="gemma4:27b">gemma4:27b (정확)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={testSLM} disabled={slmStatus === "testing"} className="gap-1.5">
                  {slmStatus === "testing" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Database className="w-3.5 h-3.5" />
                  )}
                  연결 테스트
                </Button>
                {slmStatus === "success" && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-chart-2 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> 연결 성공
                  </motion.span>
                )}
                {slmStatus === "error" && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-destructive text-sm">
                    <XCircle className="w-4 h-4" /> 연결 실패
                  </motion.span>
                )}
              </div>
            </div>
          </motion.section>

          {/* Domain profiles */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-5">
              <Database className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">도메인 프로필 관리</h2>
            </div>

            <div className="space-y-3">
              {["Finance / Banking", "Healthcare", "Insurance", "Retail / E-Commerce"].map((domain) => (
                <div
                  key={domain}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border"
                >
                  <span className="text-sm">{domain}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">built-in</Badge>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">편집</Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2">
                + 커스텀 도메인 추가
              </Button>
            </div>
          </motion.section>

          {/* Conversion options */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-5">
              <Sliders className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">변환 옵션</h2>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">복수형 처리</p>
                  <p className="text-xs text-muted-foreground">테이블 이름을 단수형으로 변환합니다</p>
                </div>
                <Switch checked={pluralize} onCheckedChange={setPluralize} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">FK 컬럼 노드 포함</p>
                  <p className="text-xs text-muted-foreground">외래 키 컬럼을 노드 프로퍼티에 포함합니다</p>
                </div>
                <Switch checked={includeFkNodes} onCheckedChange={setIncludeFkNodes} />
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">최소 신뢰도 임계값</p>
                    <p className="text-xs text-muted-foreground">이 값 미만의 분류 결과는 수동 확인을 요청합니다</p>
                  </div>
                  <span className="text-sm font-mono text-primary">{minConfidence[0]}%</span>
                </div>
                <Slider
                  value={minConfidence}
                  onValueChange={setMinConfidence}
                  min={50}
                  max={95}
                  step={5}
                  className="mt-2"
                />
              </div>
            </div>
          </motion.section>

          {/* Theme */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 mb-5">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">테마</h2>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-lg border-2 border-primary bg-primary/5 text-sm font-medium">
                🌙 Dark
              </div>
              <div className="px-4 py-2 rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground cursor-not-allowed">
                ☀️ Light (준비 중)
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}