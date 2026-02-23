"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, RefreshCw, AlertCircle, LayoutGrid, CalendarDays, Zap } from "lucide-react";
import { addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { CronJobCard, type CronJob } from "@/components/CronJobCard";
import { CronWeeklyTimeline } from "@/components/CronWeeklyTimeline";

type ViewMode = "cards" | "timeline";

interface RunEntry {
  id: string;
  jobId: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  durationMs: number | null;
  error: string | null;
  summary: string | null;
  runAtMs: number | null;
  model?: string;
  provider?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
}

export default function CronJobsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunEntry[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunEntry | null>(null);
  const [historyWeekOffset, setHistoryWeekOffset] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [runToast, setRunToast] = useState<{ id: string; status: "success" | "error"; name: string } | null>(null);

  const fetchRecentRuns = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/cron/runs?all=1&limit=200");
      if (!res.ok) throw new Error("Failed to fetch runs");
      const data = await res.json();
      const rawRuns = Array.isArray(data?.runs) ? data.runs : [];

      // Keep only previous 7 days in client memory (static-first + lightweight)
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const nextRuns = rawRuns
        .filter((r: RunEntry) => (r.runAtMs || 0) >= cutoff)
        .sort((a: RunEntry, b: RunEntry) => (b.runAtMs || 0) - (a.runAtMs || 0));

      setRecentRuns(nextRuns);
      setSelectedRun((prev) => (prev && !nextRuns.find((r: RunEntry) => r.id === prev.id) ? null : prev));
      try { localStorage.setItem("cron_runs_cache", JSON.stringify(nextRuns)); } catch {}
    } catch {
      if (!silent) setError((prev) => prev || "Failed to load run history");
    }
  }, []);

  const fetchJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const res = await fetch("/api/cron");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      const nextJobs = Array.isArray(data) ? data : [];
      setJobs(nextJobs);
      try { localStorage.setItem("cron_jobs_cache", JSON.stringify(nextJobs)); } catch {}
      fetchRecentRuns(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [fetchRecentRuns]);

  useEffect(() => {
    try {
      const cachedJobs = localStorage.getItem("cron_jobs_cache");
      if (cachedJobs) setJobs(JSON.parse(cachedJobs));
      const cachedRuns = localStorage.getItem("cron_runs_cache");
      if (cachedRuns) setRecentRuns(JSON.parse(cachedRuns));
    } catch {}
    fetchJobs(true);
  }, [fetchJobs]);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/cron", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error("Failed to update job");
      setJobs((prev) =>
        prev.map((job) => (job.id === id ? { ...job, enabled } : job))
      );
    } catch (err) {
      console.error("Toggle error:", err);
      setError("Failed to update job status");
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    try {
      const res = await fetch(`/api/cron?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete job");
      setJobs((prev) => prev.filter((job) => job.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete job");
    }
  };

  const handleRun = async (id: string) => {
    const job = jobs.find((j) => j.id === id);
    const res = await fetch("/api/cron/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setRunToast({ id, status: "error", name: job?.name || id });
      setTimeout(() => setRunToast(null), 4000);
      throw new Error(data.error || "Trigger failed");
    }

    setRunToast({ id, status: "success", name: job?.name || id });
    setTimeout(() => setRunToast(null), 4000);
  };

  const activeJobs = jobs.filter((j) => j.enabled).length;
  const pausedJobs = jobs.length - activeJobs;

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), historyWeekOffset);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekRuns = recentRuns.filter((r) => {
    const ts = r.runAtMs || 0;
    return ts >= weekStart.getTime() && ts <= weekEnd.getTime();
  });

  const runsByDay = weekDays.map((day) => ({
    day,
    runs: weekRuns
      .filter((r) => r.runAtMs && isSameDay(new Date(r.runAtMs), day))
      .sort((a, b) => (b.runAtMs || 0) - (a.runAtMs || 0)),
  }));

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ 
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)'
          }}>
            Cron Jobs
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
            Scheduled tasks from OpenClaw Gateway
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* View mode toggle */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '3px',
            }}
          >
            <button
              onClick={() => setViewMode("cards")}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '0.35rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: viewMode === "cards" ? 'var(--accent)' : 'transparent',
                color: viewMode === "cards" ? 'white' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '0.35rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                backgroundColor: viewMode === "timeline" ? 'var(--accent)' : 'transparent',
                color: viewMode === "timeline" ? 'white' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Timeline
            </button>
          </div>

          <button
            onClick={() => { fetchJobs(); fetchRecentRuns(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--card)',
              color: 'var(--text-primary)',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'opacity 0.2s'
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-8">
        <div style={{
          backgroundColor: 'color-mix(in srgb, var(--card) 50%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'color-mix(in srgb, var(--info) 20%, transparent)', borderRadius: '0.5rem' }}>
            <Clock className="w-6 h-6" style={{ color: 'var(--info)' }} />
          </div>
          <div>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{jobs.length}</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total Jobs</p>
          </div>
        </div>
        <div style={{
          backgroundColor: 'color-mix(in srgb, var(--card) 50%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'color-mix(in srgb, var(--success) 20%, transparent)', borderRadius: '0.5rem' }}>
            <RefreshCw className="w-6 h-6" style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{activeJobs}</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Active</p>
          </div>
        </div>
        <div style={{
          backgroundColor: 'color-mix(in srgb, var(--card) 50%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'color-mix(in srgb, var(--warning) 20%, transparent)', borderRadius: '0.5rem' }}>
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--warning)' }} />
          </div>
          <div>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{pausedJobs}</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Paused</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle className="w-5 h-5" style={{ color: 'var(--error)' }} />
          <span style={{ color: 'var(--error)' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Loading hint (static-first; keep existing content visible) */}
      {isLoading && (
        <div style={{
          marginBottom: '0.75rem',
          padding: '0.65rem 0.9rem',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--card-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '0.82rem'
        }}>
          Syncing latest cron state from OpenClaw…
        </div>
      )}

      {jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <Clock className="w-8 h-8 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            No cron jobs found
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Create cron jobs via Telegram or the OpenClaw CLI
          </p>
        </div>
      ) : viewMode === "timeline" ? (
        /* Timeline View */
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <CalendarDays className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-heading)',
              }}
            >
              7-Day Schedule Overview
            </h2>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--card-elevated)',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.35rem',
              }}
            >
              All times in local timezone
            </span>
          </div>
          <CronWeeklyTimeline jobs={jobs} />

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Run History Timeline (Mon–Sun)
              </h3>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={() => setHistoryWeekOffset((w) => w - 1)}
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card-elevated)', color: 'var(--text-secondary)', borderRadius: '0.4rem', padding: '0.2rem 0.55rem', fontSize: '0.78rem' }}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
                </span>
                <button
                  onClick={() => setHistoryWeekOffset((w) => Math.min(0, w + 1))}
                  disabled={historyWeekOffset >= 0}
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card-elevated)', color: 'var(--text-secondary)', borderRadius: '0.4rem', padding: '0.2rem 0.55rem', fontSize: '0.78rem', opacity: historyWeekOffset >= 0 ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {runsByDay.map(({ day, runs }) => (
                <div key={day.toISOString()} style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card-elevated)', borderRadius: '0.6rem', minHeight: '110px' }}>
                  <div style={{ padding: '0.45rem 0.55rem', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {format(day, 'EEE d')}
                  </div>
                  <div style={{ padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {runs.length === 0 ? (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.7 }}>—</div>
                    ) : runs.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => setSelectedRun(run)}
                        style={{
                          textAlign: 'left',
                          padding: '0.35rem 0.45rem',
                          borderRadius: '0.45rem',
                          border: selectedRun?.id === run.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                          backgroundColor: selectedRun?.id === run.id ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface-elevated)',
                          color: 'var(--text-primary)',
                          fontSize: '0.68rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.3rem' }}>
                          <span>{format(new Date(run.runAtMs || Date.now()), 'HH:mm')}</span>
                          <span style={{ color: run.status === 'ok' ? 'var(--success)' : 'var(--error)' }}>{run.status}</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.12rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {run.jobId}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '0.7rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Client memory keeps only previous 7 days of run history for fast static rendering.
            </div>

            <div style={{ marginTop: '0.9rem', border: '1px solid var(--border)', backgroundColor: 'var(--card-elevated)', borderRadius: '0.65rem', padding: '0.8rem' }}>
              {!selectedRun ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Click a run in the timeline to inspect its output.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.45rem' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {selectedRun.jobId}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: selectedRun.status === 'ok' ? 'var(--success)' : 'var(--error)' }}>
                      {selectedRun.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {selectedRun.runAtMs ? new Date(selectedRun.runAtMs).toLocaleString() : 'Unknown run time'}
                    {typeof selectedRun.durationMs === 'number' ? ` · ${Math.round(selectedRun.durationMs / 1000)}s` : ''}
                    {selectedRun.model ? ` · ${selectedRun.model}` : ''}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '16rem', overflow: 'auto' }}>
                    {selectedRun.summary || selectedRun.error || '(no output captured)'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {jobs.map((job) => (
            <div key={job.id} style={{ position: 'relative' }}>
              <CronJobCard
                job={job}
                onToggle={handleToggle}
                onEdit={() => {}}
                onDelete={handleDelete}
                onRun={handleRun}
              />
              {deleteConfirm === job.id && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundColor: 'rgba(12, 12, 12, 0.9)',
                  borderRadius: '0.75rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                  zIndex: 10,
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Delete &quot;{job.name}&quot;?</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button onClick={() => setDeleteConfirm(null)}
                        style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', background: 'none', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={() => handleDelete(job.id)}
                        style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--error)', color: 'var(--text-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Run toast notification */}
      {runToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2.5rem',
            right: '1.5rem',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1.25rem',
            borderRadius: '0.75rem',
            backdropFilter: 'blur(12px)',
            backgroundColor: runToast.status === "success"
              ? 'color-mix(in srgb, var(--success) 15%, rgba(12,12,12,0.95))'
              : 'color-mix(in srgb, var(--error) 15%, rgba(12,12,12,0.95))',
            border: `1px solid ${runToast.status === "success" ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'color-mix(in srgb, var(--error) 40%, transparent)'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontWeight: 500,
            animation: 'slideInRight 0.3s ease',
          }}
        >
          <Zap
            className="w-4 h-4"
            style={{ color: runToast.status === "success" ? 'var(--success)' : 'var(--error)' }}
          />
          {runToast.status === "success"
            ? `✓ "${runToast.name}" triggered!`
            : `✗ Failed to trigger "${runToast.name}"`}
        </div>
      )}

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(2rem); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
