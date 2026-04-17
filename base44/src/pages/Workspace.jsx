import React, { useState } from "react";
import TopBar from "@/components/workspace/TopBar";
import ERDPanel from "@/components/workspace/ERDPanel";
import GraphPanel from "@/components/workspace/GraphPanel";
import StatusBar from "@/components/workspace/StatusBar";
import BottomTabs from "@/components/workspace/BottomTabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function Workspace() {
  const [mode, setMode] = useState("erd_to_graph");
  const [activeTab, setActiveTab] = useState("graph");

  return (
    <div className="h-screen flex flex-col">
      <TopBar mode={mode} onModeChange={setMode} />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={35} minSize={20}>
            <ERDPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={65} minSize={30}>
            <GraphPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <BottomTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <StatusBar />
    </div>
  );
}