import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitBranch, FileJson, FileCode, Route } from "lucide-react";
import { Link } from "react-router-dom";

export default function BottomTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: "graph", label: "Graph 시각화", icon: GitBranch },
    { id: "schema", label: "상세 스키마", icon: FileJson, link: "/semantic-ir" },
    { id: "export", label: "코드 출력", icon: FileCode, link: "/export" },
    { id: "trace", label: "Trace Map", icon: Route, link: "/trace" },
  ];

  return (
    <div className="h-9 border-t border-border bg-card/30 flex items-center px-4 shrink-0">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Wrapper = tab.link ? Link : "button";
          const wrapperProps = tab.link ? { to: tab.link } : { onClick: () => onTabChange(tab.id) };
          return (
            <Wrapper
              key={tab.id}
              {...wrapperProps}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}