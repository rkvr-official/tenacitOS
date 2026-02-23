"use client";

import { Server, Clock, Cpu, Brain, FolderOpen, HardDrive } from "lucide-react";

interface SystemInfoProps {
  data: {
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
  } | null;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export function SystemInfo({ data }: SystemInfoProps) {
  if (!data) {
    return (
      <div className="rounded-xl p-6 animate-pulse" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="h-6 rounded w-1/3 mb-4" style={{ backgroundColor: "var(--border)" }}></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}></div>
          ))}
        </div>
      </div>
    );
  }

  const memoryPercent = data.system.memory.total > 0
    ? (data.system.memory.used / data.system.memory.total) * 100
    : 0;

  const infoItems = [
    {
      icon: Server,
      label: "Agent",
      value: `${data.agent.emoji} ${data.agent.name}`,
      sublabel: data.agent.creature,
    },
    {
      icon: Clock,
      label: "Uptime",
      value: data.system.uptimeFormatted,
      sublabel: data.system.hostname,
    },
    {
      icon: Cpu,
      label: "Node.js",
      value: data.system.nodeVersion,
      sublabel: data.system.platform,
    },
    {
      icon: Brain,
      label: "Model",
      value: data.system.model.split("/").pop() || data.system.model,
      sublabel: data.system.model.includes("/") ? data.system.model.split("/")[0] : "provider",
    },
    {
      icon: FolderOpen,
      label: "Workspace",
      value: data.system.workspacePath.split("/").pop() || "workspace",
      sublabel: data.system.workspacePath,
    },
  ];

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
        <Server className="w-5 h-5" style={{ color: "var(--accent)" }} />
        System Information
      </h2>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        Static host profile + live runtime metrics.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {infoItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex items-start gap-4 p-4 rounded-lg"
              style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}
            >
              <div className="p-2 rounded-lg" style={{ backgroundColor: "var(--accent-soft)" }}>
                <Icon className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                  {item.label}
                </div>
                <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {item.value}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {item.sublabel}
                </div>
              </div>
            </div>
          );
        })}

        <div className="p-4 rounded-lg md:col-span-2" style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <HardDrive className="w-4 h-4" />
              <span className="text-sm">Memory</span>
            </div>
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {formatBytes(data.system.memory.used)} / {formatBytes(data.system.memory.total)}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-elevated)" }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, memoryPercent))}%`,
                backgroundColor: memoryPercent > 85 ? "var(--error)" : memoryPercent > 70 ? "var(--warning)" : "var(--success)",
              }}
            />
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {formatBytes(data.system.memory.free)} free
          </div>
        </div>
      </div>
    </div>
  );
}
