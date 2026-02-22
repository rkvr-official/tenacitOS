/**
 * Office 3D — Layout Configuration
 *
 * The list of agents (id/name/emoji/color/model/workspace) is loaded at runtime
 * from `/api/agents` which reads `~/.openclaw/openclaw.json`.
 *
 * This file only defines where each agent desk should be placed in the 3D office.
 * If an agent id is unknown, we fall back to an auto-generated grid.
 */

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number]; // x, y, z
  color: string;
  role?: string;
}

export type AgentStatus = "idle" | "working" | "thinking" | "error";

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: string;
  model?: string;
  tokensPerHour?: number;
  tasksInQueue?: number;
  uptime?: number;
}

// Current RKVR OpenClaw agent setup (from ~/.openclaw/openclaw.json)
// These positions are the authoritative layout for Arnau's environment.
export const OFFICE_POSITIONS: Record<string, [number, number, number]> = {
  jarvis: [0, 0, 0],
  devon: [-4, 0, -3],
  avery: [4, 0, -3],
  mila: [-4, 0, 3],
  sana: [4, 0, 3],
  priya: [0, 0, 6],
  rowan: [0, 0, -6],
};

export function getOfficePosition(agentId: string, index: number): [number, number, number] {
  const known = OFFICE_POSITIONS[agentId];
  if (known) return known;

  // Fallback: simple grid around the center
  const cols = 3;
  const spacingX = 4;
  const spacingZ = 3.5;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [(col - 1) * spacingX, 0, (row - 1) * spacingZ];
}
