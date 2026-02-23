"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityLineChart } from "@/components/charts/ActivityLineChart";
import { ActivityPieChart } from "@/components/charts/ActivityPieChart";
import { HourlyHeatmap } from "@/components/charts/HourlyHeatmap";
import { SuccessRateGauge } from "@/components/charts/SuccessRateGauge";
import { BarChart3, TrendingUp, Clock, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { readJsonCache, writeJsonCache } from "@/lib/client-cache";

interface AnalyticsData {
  byDay: { date: string; count: number }[];
  byType: { type: string; count: number }[];
  byHour: { hour: number; day: number; count: number }[];
  successRate: number;
}

const CACHE_KEY = "tenacitos:analytics:v1";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prefer cached data to render immediately (static-first).
    const cached = readJsonCache<AnalyticsData>(CACHE_KEY);
    if (cached) {
      setData(cached);
      setLoading(false);
      setStale(true);
    }

    fetch("/api/analytics")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((fresh: AnalyticsData) => {
        setData(fresh);
        writeJsonCache(CACHE_KEY, fresh);
        setError(null);
      })
      .catch((e) => {
        if (!cached) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        setLoading(false);
        setStale(false);
      });
  }, []);

  const totalThisWeek = useMemo(() => data?.byDay?.reduce((sum, d) => sum + d.count, 0) ?? 0, [data]);
  const mostActiveDay = useMemo(() => {
    if (!data?.byDay?.length) return "-";
    return (
      data.byDay.reduce((max, d) => (d.count > max.count ? d : max), data.byDay[0])?.date || "-"
    );
  }, [data]);

  const showSkeleton = loading && !data;

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <div className="mb-4 md:mb-8">
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            📊 Analytics
          </h1>
          {(stale || loading) && (
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
              }}
            >
              {stale ? "cached" : "loading"}
            </span>
          )}
        </div>
        <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
          Insights and trends from agent activity
        </p>
        {error && !data && (
          <p className="text-sm mt-2" style={{ color: "var(--error)" }}>
            Failed to load analytics data ({error})
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl p-3 md:p-4"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            {showSkeleton ? (
              <>
                <Skeleton className="h-3 w-24 mb-3" />
                <Skeleton className="h-7 w-16" />
              </>
            ) : i === 0 ? (
              <>
                <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                  Total This Week
                </p>
                <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {totalThisWeek}
                </p>
              </>
            ) : i === 1 ? (
              <>
                <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                  Most Active Day
                </p>
                <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--accent)" }}>
                  {mostActiveDay}
                </p>
              </>
            ) : i === 2 ? (
              <>
                <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                  Top Activity Type
                </p>
                <p className="text-xl md:text-2xl font-bold capitalize" style={{ color: "var(--info)" }}>
                  {data?.byType?.[0]?.type || "-"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs md:text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                  Success Rate
                </p>
                <p className="text-xl md:text-2xl font-bold" style={{ color: "var(--success)" }}>
                  {data ? `${data.successRate.toFixed(0)}%` : "-"}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Activity Over Time */}
        <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg md:text-xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Activity Over Time
            </h2>
          </div>
          {showSkeleton ? <Skeleton className="h-[260px] w-full" /> : data ? <ActivityLineChart data={data.byDay} /> : null}
        </div>

        {/* Activity by Type */}
        <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <BarChart3 className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg md:text-xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Activity by Type
            </h2>
          </div>
          {showSkeleton ? <Skeleton className="h-[260px] w-full" /> : data ? <ActivityPieChart data={data.byType} /> : null}
        </div>

        {/* Hourly Heatmap */}
        <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <Clock className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg md:text-xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Activity by Hour
            </h2>
          </div>
          {showSkeleton ? <Skeleton className="h-[260px] w-full" /> : data ? <HourlyHeatmap data={data.byHour} /> : null}
        </div>

        {/* Success Rate Gauge */}
        <div className="rounded-xl p-4 md:p-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
            <Target className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg md:text-xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Success Rate
            </h2>
          </div>
          {showSkeleton ? <Skeleton className="h-[260px] w-full" /> : data ? <SuccessRateGauge rate={data.successRate} /> : null}
        </div>
      </div>
    </div>
  );
}
