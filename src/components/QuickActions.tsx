"use client";

import { useState } from "react";
import {
  RefreshCw,
  Trash2,
  FileText,
  Key,
  Loader2,
  CheckCircle,
  AlertCircle,
  Activity,
  Cpu,
} from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface QuickActionsProps {
  onActionComplete?: () => void;
  onActionLog?: (entry: string) => void;
}

interface ActionButton {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "safe" | "warn" | "danger";
  action: () => Promise<void> | void;
}

export function QuickActions({ onActionComplete, onActionLog }: QuickActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const appendLog = (text: string) => {
    onActionLog?.(`[${new Date().toISOString()}] ${text}`);
  };

  const callAction = async (id: string, action: string) => {
    setLoadingAction(id);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || data.status === "error") {
        throw new Error(data?.output || data?.error || "Action failed");
      }

      const rawOutput = String(data.output || "");
      const output = rawOutput.slice(0, 180).replace(/\n+/g, " · ");
      showNotification("success", `${action} ok${output ? `: ${output}` : ""}`);
      appendLog(`${action} ✅\n${rawOutput || "(no output)"}`);
      onActionComplete?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      showNotification("error", msg);
      appendLog(`${action} ❌\n${msg}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClearActivityLog = async () => {
    setLoadingAction("clear_log");
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_activity_log" }),
      });

      if (!res.ok) throw new Error("Failed to clear log");

      showNotification("success", "Activity log cleared successfully");
      appendLog("clear_activity_log ✅\nActivity log cleared successfully");
      onActionComplete?.();
    } catch {
      showNotification("error", "Failed to clear activity log");
      appendLog("clear_activity_log ❌\nFailed to clear activity log");
    } finally {
      setLoadingAction(null);
    }
  };

  const actions: ActionButton[] = [
    {
      id: "restart_gateway",
      label: "Restart Gateway",
      icon: RefreshCw,
      tone: "warn",
      action: () => callAction("restart_gateway", "restart-gateway"),
    },
    {
      id: "gateway_status",
      label: "Gateway Status",
      icon: Activity,
      tone: "safe",
      action: () => callAction("gateway_status", "gateway-status"),
    },
    {
      id: "openclaw_status",
      label: "OpenClaw Status",
      icon: Activity,
      tone: "safe",
      action: () => callAction("openclaw_status", "openclaw-status"),
    },
    {
      id: "sessions",
      label: "Sessions List",
      icon: FileText,
      tone: "neutral",
      action: () => callAction("sessions", "sessions-list"),
    },
    {
      id: "models",
      label: "Models List",
      icon: FileText,
      tone: "neutral",
      action: () => callAction("models", "models-list"),
    },
    {
      id: "cron",
      label: "Cron Jobs",
      icon: FileText,
      tone: "neutral",
      action: () => callAction("cron", "cron-list"),
    },
    {
      id: "heartbeat",
      label: "Run Health Check",
      icon: Activity,
      tone: "safe",
      action: () => callAction("heartbeat", "heartbeat"),
    },
    {
      id: "usage",
      label: "Usage Snapshot",
      icon: Cpu,
      tone: "neutral",
      action: () => callAction("usage", "usage-stats"),
    },
    {
      id: "git_status",
      label: "Workspace Git Status",
      icon: FileText,
      tone: "safe",
      action: () => callAction("git_status", "git-status"),
    },
    {
      id: "clear_log",
      label: "Clear Activity Log",
      icon: Trash2,
      tone: "warn",
      action: handleClearActivityLog,
    },
    {
      id: "change_password",
      label: "Change Password",
      icon: Key,
      tone: "danger",
      action: () => setShowPasswordModal(true),
    },
  ];

  const toneStyle: Record<ActionButton["tone"], { bg: string; color: string; border: string }> = {
    neutral: { bg: "var(--surface-elevated)", color: "var(--text-primary)", border: "var(--border)" },
    safe: { bg: "rgba(52, 199, 89, 0.12)", color: "var(--success)", border: "rgba(52, 199, 89, 0.32)" },
    warn: { bg: "rgba(245, 158, 11, 0.12)", color: "var(--warning)", border: "rgba(245, 158, 11, 0.32)" },
    danger: { bg: "rgba(239, 68, 68, 0.12)", color: "var(--error)", border: "rgba(239, 68, 68, 0.32)" },
  };

  return (
    <>
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
          <RefreshCw className="w-5 h-5" style={{ color: "var(--accent)" }} />
          Quick Actions
        </h2>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Operational shortcuts for runtime checks and maintenance.
        </p>

        {notification && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg mb-4"
            style={{
              backgroundColor: notification.type === "success" ? "rgba(52, 199, 89, 0.12)" : "rgba(239, 68, 68, 0.12)",
              color: notification.type === "success" ? "var(--success)" : "var(--error)",
              border: `1px solid ${notification.type === "success" ? "rgba(52, 199, 89, 0.32)" : "rgba(239, 68, 68, 0.32)"}`,
            }}
          >
            {notification.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm">{notification.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            const isLoading = loadingAction === action.id;
            const tone = toneStyle[action.tone];

            return (
              <button
                key={action.id}
                onClick={() => action.action()}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: tone.bg, color: tone.color, borderColor: tone.border }}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                <span className="font-medium text-sm">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          showNotification("success", "Password changed (restart tenacitos to apply)");
          setShowPasswordModal(false);
        }}
      />
    </>
  );
}
