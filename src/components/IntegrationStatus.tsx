"use client";

import { MessageCircle, Twitter, Mail, CheckCircle, XCircle, AlertCircle, Github, Search, Slack } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ComponentType, CSSProperties } from "react";

interface Integration {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "configured" | "not_configured";
  icon: string;
  lastActivity: string | null;
  detail?: string | null;
}

interface IntegrationStatusProps {
  integrations: Integration[] | null;
}

const iconMap: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  MessageCircle,
  Twitter,
  Mail,
  Github,
  Search,
  Slack,
};

const statusConfig = {
  connected: {
    icon: CheckCircle,
    color: "var(--success)",
    chipBg: "rgba(52, 199, 89, 0.15)",
    chipBorder: "rgba(52, 199, 89, 0.35)",
    label: "Connected",
    rank: 0,
  },
  configured: {
    icon: CheckCircle,
    color: "#3b82f6",
    chipBg: "rgba(59, 130, 246, 0.15)",
    chipBorder: "rgba(59, 130, 246, 0.35)",
    label: "Configured",
    rank: 1,
  },
  not_configured: {
    icon: AlertCircle,
    color: "var(--warning)",
    chipBg: "rgba(245, 158, 11, 0.15)",
    chipBorder: "rgba(245, 158, 11, 0.35)",
    label: "Not configured",
    rank: 2,
  },
  disconnected: {
    icon: XCircle,
    color: "var(--error)",
    chipBg: "rgba(239, 68, 68, 0.15)",
    chipBorder: "rgba(239, 68, 68, 0.35)",
    label: "Disconnected",
    rank: 3,
  },
} as const;

export function IntegrationStatus({ integrations }: IntegrationStatusProps) {
  if (!integrations) {
    return (
      <div className="rounded-xl p-6 animate-pulse" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="h-6 rounded w-1/3 mb-4" style={{ backgroundColor: "var(--border)" }}></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}></div>
          ))}
        </div>
      </div>
    );
  }

  const list = [...integrations].sort(
    (a, b) => statusConfig[a.status].rank - statusConfig[b.status].rank || a.name.localeCompare(b.name)
  );

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
        <MessageCircle className="w-5 h-5" style={{ color: "var(--accent)" }} />
        Integrations
      </h2>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        Connection health and last-known activity.
      </p>

      <div className="space-y-3">
        {list.map((integration) => {
          const Icon = iconMap[integration.icon] || MessageCircle;
          const status = statusConfig[integration.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={integration.id}
              className="flex items-center justify-between p-4 rounded-lg"
              style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--surface-elevated)" }}>
                  <Icon className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{integration.name}</div>
                  {integration.lastActivity && (
                    <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      Active {formatDistanceToNow(new Date(integration.lastActivity), { addSuffix: true })}
                    </div>
                  )}
                  {integration.detail && (
                    <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{integration.detail}</div>
                  )}
                </div>
              </div>

              <div
                className="flex items-center gap-2 px-2 py-1 rounded-md"
                style={{
                  color: status.color,
                  backgroundColor: status.chipBg,
                  border: `1px solid ${status.chipBorder}`,
                }}
              >
                <StatusIcon className="w-4 h-4" />
                <span className="text-xs font-semibold">{status.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
