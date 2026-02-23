import { execFileSync } from "child_process";

function buildEnv() {
  const extraPath = [
    "/home/linuxbrew/.linuxbrew/bin",
    "/root/.npm-global/bin",
    "/root/.local/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ];

  return {
    ...process.env,
    PATH: [...extraPath, process.env.PATH || ""].filter(Boolean).join(":"),
  };
}

function runText(args: string[], timeout = 20000): string {
  const attempts: Array<{ cmd: string; argv: string[] }> = [
    { cmd: "clawhub", argv: args },
    { cmd: "npx", argv: ["--yes", "clawhub", ...args] },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return execFileSync(attempt.cmd, attempt.argv, {
        encoding: "utf-8",
        timeout,
        maxBuffer: 8 * 1024 * 1024,
        env: buildEnv(),
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export interface HubSkill {
  slug: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
}

export function hubSearch(query: string, limit = 50): HubSkill[] {
  const raw = runText(["search", query, "--limit", String(limit)]);
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("- "));

  const skills: HubSkill[] = [];

  for (const line of lines) {
    // Current clawhub CLI format:
    // slug v1.0.0  Display Name  (3.663)
    const current = line.match(/^(\S+)\s+v([^\s]+)\s+(.+?)\s+\(([^)]+)\)$/);
    if (current) {
      skills.push({
        slug: current[1],
        version: current[2],
        name: current[3].trim(),
        description: `Relevance ${current[4]}`,
      });
      continue;
    }

    // Older fallback format:
    // slug Name - description
    if (line.includes(" - ")) {
      const [left, ...rest] = line.split(" - ");
      const description = rest.join(" - ").trim();
      const legacy = left.match(/^([^\s]+)\s+(.+)$/);
      if (legacy) {
        skills.push({
          slug: legacy[1],
          name: legacy[2].trim(),
          description,
        });
      }
    }
  }

  return skills;
}

export function hubInspect(slug: string): any {
  const raw = runText(["inspect", slug, "--json"]);
  const jsonStart = raw.indexOf("{");
  const safe = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
  return JSON.parse(safe);
}

export function hubExplore(
  limit = 200,
  sort: "newest" | "downloads" | "rating" | "installs" | "installsAllTime" | "trending" = "newest"
): any[] {
  const raw = runText(["explore", "--limit", String(limit), "--sort", sort, "--json"]);
  const jsonStart = raw.indexOf("{");
  const safe = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
  const parsed = JSON.parse(safe);
  return parsed.items || parsed.skills || [];
}

export function hubSkillMd(slug: string): string {
  try {
    return runText(["inspect", slug, "--file", "SKILL.md"], 25000);
  } catch {
    return "SKILL.md preview unavailable";
  }
}

export function hubInstall(slug: string): { ok: boolean; output: string } {
  const output = runText(["install", slug, "--force"], 60000);
  return { ok: true, output };
}
