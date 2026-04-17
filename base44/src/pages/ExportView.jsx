import React, { useState } from "react";
import { Copy, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SAMPLE_CYPHER, SAMPLE_SEMANTIC_IR } from "@/lib/mockData";
import { motion } from "framer-motion";
import { toast } from "sonner";

const MERMAID_CODE = `graph LR
  Customer -->|OWNS 1:N| Account
  Account -->|HAS_TRANSACTION 1:N| Transaction
  Transaction -->|CREDITS N:1| Account
  Customer -->|MANAGES 1:1| Branch
  Customer -->|HAS_LOAN 1:N| Loan`;

const RDF_CODE = `@prefix fibo: <https://spec.edmcouncil.org/fibo/ontology/> .
@prefix : <http://example.org/banking#> .

:Customer a fibo:Customer ;
  :has_name "string" ;
  :has_email "string" ;
  :has_phone "string" .

:Account a fibo:Account ;
  :has_balance "decimal" ;
  :has_currency "string" ;
  :has_status "string" .

:Customer :owns :Account .
:Account :has_transaction :Transaction .
:Customer :manages :Branch .
:Customer :has_loan :Loan .`;

const YAML_CODE = `nodes:
  - id: Customer
    label: Customer
    source_table: customers
    properties:
      - { name: first_name, type: string }
      - { name: last_name, type: string }
      - { name: email, type: string }
  - id: Account
    label: Account
    source_table: accounts
    properties:
      - { name: balance, type: decimal }
      - { name: currency, type: string }

edges:
  - type: OWNS
    from: Customer
    to: Account
    cardinality: "1:N"
  - type: HAS_TRANSACTION
    from: Account
    to: Transaction
    cardinality: "1:N"`;

const FORMATS = {
  cypher: { label: "Cypher", code: SAMPLE_CYPHER },
  mermaid: { label: "Mermaid", code: MERMAID_CODE },
  rdf: { label: "RDF-OWL", code: RDF_CODE },
  json: { label: "JSON", code: JSON.stringify(SAMPLE_SEMANTIC_IR, null, 2) },
  yaml: { label: "YAML", code: YAML_CODE },
};

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("클립보드에 복사되었습니다");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = { cypher: "cypher", mermaid: "mmd", rdf: "ttl", json: "json", yaml: "yaml" };
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema.${ext[language] || "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative rounded-lg border border-border bg-muted/20 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-border bg-muted/30">
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleCopy}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "복사됨" : "복사"}
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleDownload}>
          <Download className="w-3 h-3" /> 다운로드
        </Button>
      </div>

      <ScrollArea className="max-h-[65vh]">
        <div className="p-4 font-mono text-xs leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="w-8 text-right mr-4 text-muted-foreground/40 select-none shrink-0">{i + 1}</span>
              <span className="whitespace-pre text-foreground/90">
                {highlightLine(line, language)}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function highlightLine(line, lang) {
  // Simple keyword highlighting
  if (lang === "cypher") {
    return line
      .replace(/(CREATE|MATCH|WHERE|INDEX|FOR|ON)/g, '\u200B$1')
      .split('\u200B')
      .map((part, i) => {
        if (/^(CREATE|MATCH|WHERE|INDEX|FOR|ON)/.test(part)) {
          const keyword = part.match(/^(CREATE|MATCH|WHERE|INDEX|FOR|ON)/)[0];
          const rest = part.slice(keyword.length);
          return <span key={i}><span className="text-primary font-medium">{keyword}</span>{rest}</span>;
        }
        return <span key={i}>{part}</span>;
      });
  }
  if (line.startsWith("//") || line.startsWith("#")) {
    return <span className="text-muted-foreground">{line}</span>;
  }
  return line;
}

export default function ExportView() {
  const [format, setFormat] = useState("cypher");

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold mb-1">코드 출력</h1>
          <p className="text-sm text-muted-foreground mb-6">변환된 스키마를 다양한 포맷으로 내보냅니다.</p>
        </motion.div>

        <Tabs value={format} onValueChange={setFormat}>
          <TabsList className="bg-muted/50 mb-4">
            {Object.entries(FORMATS).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key} className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(FORMATS).map(([key, { code }]) => (
            <TabsContent key={key} value={key}>
              <CodeBlock code={code} language={key} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}