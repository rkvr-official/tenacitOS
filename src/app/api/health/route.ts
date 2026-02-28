/**
 * Health check endpoint
 * GET /api/health - Check health of all services and integrations
 */
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ServiceCheck {
  name: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  latency?: number;
  details?: string;
  url?: string;
}

async function checkUrl(url: string, timeoutMs = 5000): Promise<{ status: 'up' | 'down'; latency: number; httpCode?: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    return { status: res.ok || res.status < 500 ? 'up' : 'down', latency, httpCode: res.status };
  } catch {
    return { status: 'down', latency: Date.now() - start };
  }
}

async function checkSystemdService(name: string): Promise<ServiceCheck> {
  try {
    const unit = name.includes(".") ? name : `${name}.service`;
    // systemctl exits non-zero for inactive/failed units; don't treat that as "not found".
    const { stdout } = await execAsync(`systemctl is-active ${unit} 2>/dev/null || true`);
    const state = stdout.trim();
    const active = state === "active";
    const exists = state.length > 0;
    return {
      name,
      status: active ? "up" : exists ? "down" : "unknown",
      details: state || "unknown",
    };
  } catch (e) {
    return { name, status: "unknown", details: e instanceof Error ? e.message : "unknown" };
  }
}

async function checkPm2Service(name: string): Promise<ServiceCheck> {
  try {
    const { stdout } = await execAsync('pm2 jlist 2>/dev/null');
    const list = JSON.parse(stdout);
    const proc = list.find((p: { name: string }) => p.name === name);
    if (!proc) return { name, status: 'unknown', details: 'not found in pm2' };
    const status = proc.pm2_env?.status === 'online' ? 'up' : 'down';
    return { name, status, details: `${proc.pm2_env?.status} · restarts: ${proc.pm2_env?.restart_time}` };
  } catch {
    return { name, status: 'unknown', details: 'pm2 not available' };
  }
}

export async function GET() {
  const checks: ServiceCheck[] = [];

  // Internal services
  const [tenacitos, gateway] = await Promise.all([
    checkSystemdService('tenacitos'),
    checkSystemdService('openclaw-gateway'),
  ]);
  checks.push({ ...tenacitos, name: 'TenacitOS' });
  checks.push({ ...gateway, name: 'OpenClaw Gateway' });

  // PM2 services (optional). If pm2 isn't available, treat as informational.
  const pm2Services = ['classvault', 'content-vault', 'brain'];
  const pm2Checks = await Promise.all(pm2Services.map(checkPm2Service));
  checks.push(...pm2Checks);

  // External URLs
  const urlChecks = await Promise.all([
    checkUrl('https://tenacitas.cazaustre.dev'),
    checkUrl('https://api.anthropic.com', 3000),
  ]);

  checks.push({
    name: 'tenacitas.cazaustre.dev',
    status: urlChecks[0].status,
    latency: urlChecks[0].latency,
    url: 'https://tenacitas.cazaustre.dev',
  });

  checks.push({
    name: 'Anthropic API',
    status: urlChecks[1].status === 'up' || (urlChecks[1] as { httpCode?: number }).httpCode === 401 ? 'up' : urlChecks[1].status,
    latency: urlChecks[1].latency,
    url: 'https://api.anthropic.com',
    details: urlChecks[1].status === 'up' || (urlChecks[1] as { httpCode?: number }).httpCode === 401 ? 'reachable' : 'unreachable',
  });

  // Overall status
  const downCount = checks.filter((c) => c.status === 'down').length;
  // Do not treat 'unknown' (e.g. pm2 not installed) as a failure.
  const effectiveTotal = checks.filter((c) => c.status !== 'unknown').length || 1;
  const overallStatus = downCount === 0 ? 'healthy' : downCount < effectiveTotal / 2 ? 'degraded' : 'critical';

  return NextResponse.json({
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
