import { execFileSync } from "child_process";

function runText(args: string[], timeout = 20000): string {
  return execFileSync("clawhub", args, {
    encoding: "utf-8",
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
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
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  return lines
    .filter((l) => l.includes(" - "))
    .map((line) => {
      const [left, ...rest] = line.split(" - ");
      const description = rest.join(" - ").trim();
      const m = left.match(/^([^\s]+)\s+(.+)$/);
      if (!m) return null;
      return {
        slug: m[1],
        name: m[2],
        description,
      } as HubSkill;
    })
    .filter(Boolean) as HubSkill[];
}

export function hubInspect(slug: string): any {
  const raw = runText(["inspect", slug, "--json"]);
  return JSON.parse(raw);
}

export function hubExplore(limit = 200, sort: "newest" | "downloads" | "rating" | "installs" | "installsAllTime" | "trending" = "newest"): any[] {
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
