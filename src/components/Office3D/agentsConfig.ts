/**
 * Office 3D — Agent Configuration
 *
 * This file defines the visual layout of agents in the 3D office.
 * Names, emojis and roles are loaded at runtime from the OpenClaw API
 * (/api/agents → openclaw.json), so you only need to set positions and colors here.
 *
 * Agent IDs correspond to workspace directory suffixes:
 *   id: "main"     → workspace/          (main agent)
 *   id: "studio"   → workspace-studio/
 *   id: "infra"    → workspace-infra/
 *   etc.
 *
 * Add, remove or reposition agents to match your own OpenClaw setup.
 */

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number]; // x, y, z
  color: string;
  role: string;
}

export const AGENTS: AgentConfig[] = [
  // These ids should match openclaw.json agent ids.
  // If you add new agents, append here or they’ll be assigned to the next free desk slot.
  {
    id: "jarvis",
    name: "Jarvis",
    emoji: "🤖",
    position: [0, 0, 0],
    color: "#FFCC00",
    role: "Orchestrator",
  },
  {
    id: "devon",
    name: "Devon",
    emoji: "🛠️",
    position: [4, 0, -3],
    color: "#E91E63",
    role: "Engineering",
  },
  {
    id: "avery",
    name: "Avery",
    emoji: "📋",
    position: [-4, 0, -3],
    color: "#4CAF50",
    role: "Ops",
  },
  {
    id: "sana",
    name: "Sana",
    emoji: "🔎",
    position: [-4, 0, 3],
    color: "#0077B5",
    role: "Research",
  },
  {
    id: "mila",
    name: "Mila",
    emoji: "📈",
    position: [4, 0, 3],
    color: "#9C27B0",
    role: "Growth",
  },
  {
    id: "priya",
    name: "Priya",
    emoji: "💼",
    position: [0, 0, 6],
    color: "#607D8B",
    role: "RevOps",
  },
  {
    id: "rowan",
    name: "Rowan",
    emoji: "🛡️",
    position: [0, 0, -6],
    color: "#F97316",
    role: "Security",
  },
];

export type AgentStatus = "idle" | "working" | "thinking" | "error";

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: string;
  model?: string; // opus, sonnet, haiku
  tokensPerHour?: number;
  tasksInQueue?: number;
  uptime?: number; // days
}
