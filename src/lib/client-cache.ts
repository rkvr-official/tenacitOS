/**
 * Small client-side localStorage JSON cache helpers.
 *
 * Important: Next.js client components still pre-render on the server.
 * Always call these from effects / event handlers (or guard with typeof window).
 */

export function readJsonCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonCache(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / serialization issues
  }
}
