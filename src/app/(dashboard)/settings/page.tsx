"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings, RefreshCw, Copy, Trash2, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { SystemInfo } from "@/components/SystemInfo";
import { IntegrationStatus } from "@/components/IntegrationStatus";
import { QuickActions } from "@/components/QuickActions";

interface SystemData {
  agent: {
    name: string;
    creature: string;
    emoji: string;
  };
  system: {
    uptime: number;
    uptimeFormatted: string;
    nodeVersion: string;
    model: string;
    workspacePath: string;
    platform: string;
    hostname: string;
    memory: {
      total: number;
      free: number;
      used: number;
    };
  };
  integrations: Array<{
    id: string;
    name: string;
    status: "connected" | "disconnected" | "configured" | "not_configured";
    icon: string;
    lastActivity: string | null;
  }>;
  timestamp: string;
}

export default function SettingsPage() {
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [actionLogs, setActionLogs] = useState<string[]>([]);

  const fetchSystemData = async () => {
    try {
      const res = await fetch(`/api/system`);
      const data = await res.json();
      setSystemData(data);
      try { localStorage.setItem("settings_system_cache", JSON.stringify(data)); } catch {}
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch system data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem("settings_system_cache");
      if (cached) setSystemData(JSON.parse(cached));
      const cachedLogs = localStorage.getItem("settings_action_logs");
      if (cachedLogs) setActionLogs(JSON.parse(cachedLogs));
    } catch {}

    setLoading(true);
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchSystemData();
  };

  const appendLog = (entry: string) => {
    setActionLogs((prev) => {
      const next = [entry, ...prev].slice(0, 200);
      try { localStorage.setItem("settings_action_logs", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const logsText = useMemo(() => actionLogs.join("\n\n"), [actionLogs]);

  const integrationSummary = useMemo(() => {
    const list = systemData?.integrations || [];
    const good = list.filter((i) => i.status === "connected" || i.status === "configured").length;
    const warnings = list.length - good;
    return { total: list.length, good, warnings };
  }, [systemData]);

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logsText || "(no logs yet)");
    } catch (error) {
      console.error("Failed to copy logs", error);
    }
  };

  const statusLabel = systemData ? "Operational" : "Loading";
  const workspaceName = systemData?.system.workspacePath?.split("/").pop() || "workspace";

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            <Settings className="w-7 h-7" style={{ color: "var(--accent)" }} />
            Settings
          </h1>
          <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
            Runtime configuration, integration health, and maintenance controls.
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2 py-1 rounded-md" style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Status: <strong style={{ color: "var(--text-primary)" }}>{statusLabel}</strong>
            </span>
            <span className="px-2 py-1 rounded-md" style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Workspace: <strong style={{ color: "var(--text-primary)" }}>{workspaceName}</strong>
            </span>
            {lastRefresh && (
              <span className="px-2 py-1 rounded-md" style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Last update: <strong style={{ color: "var(--text-primary)" }}>{lastRefresh.toLocaleTimeString()}</strong>
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Integration health</div>
          <div className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{integrationSummary.good}/{integrationSummary.total || 0}</div>
          <div className="text-xs mt-1 flex items-center gap-2" style={{ color: integrationSummary.warnings > 0 ? "var(--warning)" : "var(--success)" }}>
            {integrationSummary.warnings > 0 ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {integrationSummary.warnings > 0 ? `${integrationSummary.warnings} need attention` : "All integrations healthy"}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Action logs</div>
          <div className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{actionLogs.length}</div>
          <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Last 200 actions retained locally</div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Dynamic refresh</div>
          <div className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>60s</div>
          <div className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <Link2 className="w-3 h-3" />
            Static shell + live telemetry updates
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <SystemInfo data={systemData} />
        </div>

        <IntegrationStatus integrations={systemData?.integrations || null} />
        <QuickActions onActionComplete={handleRefresh} onActionLog={appendLog} />
      </div>

      {/* Action Console */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Task Output Console</h3>
          <div className="flex gap-2">
            <button
              onClick={copyLogs}
              className="px-2 py-1 rounded border text-xs flex items-center gap-1"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              onClick={() => {
                setActionLogs([]);
                try { localStorage.setItem("settings_action_logs", JSON.stringify([])); } catch {}
              }}
              className="px-2 py-1 rounded border text-xs flex items-center gap-1"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={logsText}
          placeholder="Run quick actions to see output logs here..."
          className="w-full h-56 p-3 rounded-lg font-mono text-xs"
          style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      </div>
    </div>
  );
}
