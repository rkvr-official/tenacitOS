import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/root/.openclaw';

interface Workspace {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

type Identity = { name: string; emoji: string };

function getConfigIdentityMap(): Map<string, Identity> {
  const out = new Map<string, Identity>();
  try {
    const configPath = path.join(OPENCLAW_DIR, 'openclaw.json');
    if (!fs.existsSync(configPath)) return out;

    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const list = config?.agents?.list;
    if (!Array.isArray(list)) return out;

    for (const a of list) {
      const id = a?.id;
      const name = a?.identity?.name || a?.name;
      const emoji = a?.identity?.emoji || a?.ui?.emoji;
      if (typeof id === 'string' && typeof name === 'string' && typeof emoji === 'string') {
        out.set(id, { name, emoji });
      }
    }
  } catch {
    // ignore config parse/read errors
  }
  return out;
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

function getAgentInfo(workspacePath: string): { name: string; emoji: string } | null {
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
    const configIdentity = getConfigIdentityMap();

    // Main workspace
    const mainWorkspace = path.join(OPENCLAW_DIR, 'workspace');
    if (fs.existsSync(mainWorkspace)) {
      const mainInfo = getAgentInfo(mainWorkspace);
      const mainFromConfig = configIdentity.get('jarvis');
      workspaces.push({
        id: 'workspace',
        name: 'Workspace Principal',
        emoji: mainFromConfig?.emoji || mainInfo?.emoji || '🦞',
        path: mainWorkspace,
        agentName: mainFromConfig?.name || mainInfo?.name || 'Tenacitas',
      });
    }

    // Agent workspaces
    const entries = fs.readdirSync(OPENCLAW_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('workspace-')) {
        const workspacePath = path.join(OPENCLAW_DIR, entry.name);
        const agentInfo = getAgentInfo(workspacePath);

        const agentId = entry.name.replace('workspace-', '');
        const configInfo = configIdentity.get(agentId);
        // Friendly workspace name: capitalize the directory id (e.g. "academic" → "Academic")
        const workspaceLabel = agentId.charAt(0).toUpperCase() + agentId.slice(1);

        workspaces.push({
          id: entry.name,
          name: workspaceLabel,
          emoji: configInfo?.emoji || agentInfo?.emoji || '🤖',
          path: workspacePath,
          agentName: configInfo?.name || agentInfo?.name || undefined,
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
