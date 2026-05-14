// SC-3 완성본 — PULSE · CYCLE · SOXL 3탭 앱 루트
import { useState } from "react";
import TabBar   from "./components/common/TabBar";
import PulseTab from "./components/pulse/PulseTab";
import CycleTab from "./components/cycle/CycleTab";
import SoxlTab  from "./components/soxl/SoxlTab";
import { DARK } from "./constants/theme";

const TABS = [
  { id: "pulse", label: "⚡ PULSE" },
  { id: "cycle", label: "🔄 CYCLE" },
  { id: "soxl",  label: "✦ SOXL"  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("pulse");

  return (
    <div style={{ background: DARK.bg.page, minHeight: "100vh" }}>
      <AppHeader />
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "pulse" && <PulseTab />}
      {activeTab === "cycle" && <CycleTab />}
      {activeTab === "soxl"  && <SoxlTab  />}
    </div>
  );
}

function AppHeader() {
  return (
    <div style={{
      padding: "0 20px",
      height: "48px",
      background: DARK.bg.card,
      borderBottom: `1px solid ${DARK.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: DARK.text.primary, letterSpacing: "0.5px" }}>
        TERMINAL X · SEMICONDUCTOR ANALYSIS ENGINE
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
        <span style={{ fontSize: "11px", color: DARK.text.muted }}>DATA CONNECTED</span>
      </div>
    </div>
  );
}
