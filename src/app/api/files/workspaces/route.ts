import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface OpenClawConfigAgent {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    emoji?: string;
  };
}

interface OpenClawConfig {
  agents?: {
    list?: OpenClawConfigAgent[];
  };
}

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/root/.openclaw';

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

function extractEmoji(raw: string): string | null {
  const cleaned = raw.trim();

  // Ignore placeholders like _(not set)_ / unset / none
  if (/not\s*set|unset|none|n\/a/i.test(cleaned)) {
    return null;
  }

  // Pull first emoji grapheme when present
  const match = cleaned.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u);
  return match?.[0] ?? null;
}

function readOpenClawConfig(): OpenClawConfig {
  const configPath = path.join(OPENCLAW_DIR, 'openclaw.json');
  try {
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as OpenClawConfig;
  } catch {
    return {};
  }
}

function getConfigAgentInfo(config: OpenClawConfig, workspaceId: string): { name: string; emoji: string } | null {
  const agentId = workspaceId === 'workspace' ? 'jarvis' : workspaceId.replace(/^workspace-/, '');
  const entry = config.agents?.list?.find((agent) => agent.id === agentId);
  if (!entry) return null;

  const name = entry.identity?.name?.trim() || entry.name?.trim() || '';
  const emoji = extractEmoji(entry.identity?.emoji ?? '') ?? '🤖';
  return { name, emoji };
}

function getIdentityMdInfo(workspacePath: string): { name: string; emoji: string } | null {
  const identityPath = path.join(workspacePath, 'IDENTITY.md');

  if (!fs.existsSync(identityPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(identityPath, 'utf-8');

    const nameMatch = content.match(/- \*\*Name:\*\*\s*(.+)/i);
    const emojiMatch = content.match(/- \*\*Emoji:\*\*\s*(.+)/i);

    const emoji = emojiMatch ? extractEmoji(emojiMatch[1]) ?? '📁' : '📁';

    return {
      name: nameMatch ? nameMatch[1].trim() : '',
      emoji,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const workspaces: Workspace[] = [];
    const config = readOpenClawConfig();

    // Main workspace
    const mainWorkspace = path.join(OPENCLAW_DIR, 'workspace');
    if (fs.existsSync(mainWorkspace)) {
      const configInfo = getConfigAgentInfo(config, 'workspace');
      const fallbackInfo = getIdentityMdInfo(mainWorkspace);
      const mainInfo = configInfo ?? fallbackInfo;

      workspaces.push({
        id: 'workspace',
        name: 'Workspace Principal',
        emoji: mainInfo?.emoji || '🦞',
        path: mainWorkspace,
        agentName: mainInfo?.name || 'Tenacitas',
      });
    }

    // Agent workspaces
    const entries = fs.readdirSync(OPENCLAW_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('workspace-')) {
        const workspacePath = path.join(OPENCLAW_DIR, entry.name);
        const configInfo = getConfigAgentInfo(config, entry.name);
        const fallbackInfo = getIdentityMdInfo(workspacePath);
        const agentInfo = configInfo ?? fallbackInfo;

        const agentId = entry.name.replace('workspace-', '');
        // Friendly workspace name: capitalize the directory id (e.g. "academic" → "Academic")
        const workspaceLabel = agentId.charAt(0).toUpperCase() + agentId.slice(1);

        workspaces.push({
          id: entry.name,
          name: workspaceLabel,
          emoji: agentInfo?.emoji || '🤖',
          path: workspacePath,
          agentName: agentInfo?.name || undefined,
        });
      }
    }
    
    // Sort: main first, then alphabetically
    workspaces.sort((a, b) => {
      if (a.id === 'workspace') return -1;
      if (b.id === 'workspace') return 1;
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return NextResponse.json({ workspaces: [] }, { status: 500 });
  }
}
