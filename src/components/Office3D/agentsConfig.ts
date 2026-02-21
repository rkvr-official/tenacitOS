export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number]; // x, y, z
  color: string; // color primario del escritorio
  role: string;
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'main',
    name: process.env.NEXT_PUBLIC_AGENT_NAME || 'Mission Control',
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || '🦞',
    position: [0, 0, 0], // Centro, más grande
    color: '#FFCC00', // Amarillo
    role: 'COO - Coordinador General',
  },
  {
    id: 'academic',
    name: 'Profe',
    emoji: '🎓',
    position: [-4, 0, -3], // Izquierda arriba
    color: '#4CAF50', // Verde
    role: 'Docencia Universidad Europea',
  },
  {
    id: 'studio',
    name: 'Studio',
    emoji: '🎬',
    position: [4, 0, -3], // Derecha arriba
    color: '#E91E63', // Rosa/magenta
    role: 'YouTube - Guiones, SEO, Thumbnails',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Pro',
    emoji: '💼',
    position: [-4, 0, 3], // Izquierda abajo
    color: '#0077B5', // Azul LinkedIn
    role: 'Autoridad en LinkedIn',
  },
  {
    id: 'social',
    name: 'Social',
    emoji: '📱',
    position: [4, 0, 3], // Derecha abajo
    color: '#9C27B0', // Púrpura
    role: 'IG, X, TikTok',
  },
  {
    id: 'infra',
    name: 'Infra',
    emoji: '🔧',
    position: [0, 0, 6], // Fondo centro
    color: '#607D8B', // Gris azulado
    role: 'DevOps, Deploys, PM2, Caddy',
  },
];

export type AgentStatus = 'idle' | 'working' | 'thinking' | 'error';

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: string;
  model?: string; // opus, sonnet, haiku
  tokensPerHour?: number;
  tasksInQueue?: number;
  uptime?: number; // días
}
