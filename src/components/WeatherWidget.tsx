"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Wind, Droplets, Thermometer } from "lucide-react";

interface Forecast {
  day: string;
  max: number;
  min: number;
  emoji: string;
}

interface WeatherMeta {
  source?: string;
  lat?: number;
  lon?: number;
  cacheKey?: string;
}

interface WeatherData {
  city: string;
  temp: number;
  feels_like: number;
  humidity: number;
  wind: number;
  precipitation: number;
  condition: string;
  emoji: string;
  forecast: Forecast[];
  updated: string;
  meta?: WeatherMeta;
}

type GeoDebug = {
  status: "init" | "ok" | "denied" | "error" | "unavailable";
  message?: string;
  lat?: number;
  lon?: number;
  usedStored?: boolean;
};

const STORAGE_KEY = "tenacitos.weather.coords";

type StoredCoords = { lat: number; lon: number; ts: number };

function readStoredCoords(): StoredCoords | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat === "number" &&
      typeof parsed?.lon === "number" &&
      typeof parsed?.ts === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredCoords(lat: number, lon: number) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat, lon, ts: Date.now() } satisfies StoredCoords)
    );
  } catch {
    // ignore
  }
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [geoDebug, setGeoDebug] = useState<GeoDebug>({ status: "init" });

  const showDebug = useMemo(() => {
    if (typeof window === "undefined") return false;
    const sp = new URLSearchParams(window.location.search);
    return sp.get("weatherDebug") === "1" || localStorage.getItem("weatherDebug") === "1";
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async (coords?: { lat: number; lon: number }, usedStored?: boolean) => {
      const qs = coords
        ? `?lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`
        : "";
      const res = await fetch(`/api/weather${qs}`);
      const d = (await res.json()) as WeatherData;

      if (!cancelled) {
        setWeather(d);
        setLoading(false);
        if (coords) {
          setGeoDebug((prev) => ({
            ...prev,
            status: "ok",
            lat: coords.lat,
            lon: coords.lon,
            usedStored: !!usedStored,
          }));
        }
      }
    };

    const run = async () => {
      // If geolocation isn't available (non-HTTPS, some webviews), fall back to stored coords or default.
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setGeoDebug({ status: "unavailable", message: "navigator.geolocation not available" });
        const stored = readStoredCoords();
        return fetchWeather(stored ? { lat: stored.lat, lon: stored.lon } : undefined, true);
      }

      // Try stored coords first (fast paint)
      const stored = readStoredCoords();
      if (stored) {
        fetchWeather({ lat: stored.lat, lon: stored.lon }, true).catch(() => {
          // ignore; we'll try live coords below
        });
      }

      // Then request fresh coords (will prompt if needed)
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            writeStoredCoords(lat, lon);
            fetchWeather({ lat, lon }, false).finally(() => resolve());
          },
          (err) => {
            const msg = `${err.code} ${err.message}`;
            setGeoDebug({ status: err.code === 1 ? "denied" : "error", message: msg });

            // If we already painted from stored, keep it. Otherwise fallback to default.
            if (!stored) {
              fetchWeather(undefined).finally(() => resolve());
            } else {
              resolve();
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 6000,
            maximumAge: 5 * 60 * 1000,
          }
        );
      });

      if (!stored) {
        // In case geo succeeded but fetch failed, ensure we don't hang
        if (!cancelled) setLoading(false);
      }
    };

    run().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          padding: "1.25rem",
          backgroundColor: "var(--card)",
          borderRadius: "0.75rem",
          border: "1px solid var(--border)",
          minHeight: "120px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Loading weather...
        </span>
      </div>
    );
  }

  if (!weather || (weather as unknown as Record<string, unknown>).error) {
    return null;
  }

  return (
    <div
      style={{
        position: "relative",
        padding: "1.25rem",
        backgroundColor: "var(--card)",
        borderRadius: "0.75rem",
        border: "1px solid var(--border)",
        background:
          "linear-gradient(135deg, var(--card) 0%, color-mix(in srgb, var(--accent) 5%, var(--card)) 100%)",
      }}
    >
      {showDebug && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            padding: "0.5rem 0.6rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "rgba(0,0,0,0.55)",
            color: "white",
            fontSize: 11,
            maxWidth: 260,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>weatherDebug</div>
          <div>geo: {geoDebug.status}</div>
          {geoDebug.message && <div style={{ opacity: 0.85 }}>{geoDebug.message}</div>}
          <div>
            coords: {weather.meta?.lat?.toFixed?.(4) ?? "-"},{" "}
            {weather.meta?.lon?.toFixed?.(4) ?? "-"}
          </div>
          <div>source: {weather.meta?.source ?? "-"}</div>
          <div style={{ opacity: 0.8 }}>cacheKey: {weather.meta?.cacheKey ?? "-"}</div>
        </div>
      )}

      {/* Header: city + clock */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.125rem",
            }}
          >
            📍 {weather.city}
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1,
              letterSpacing: "-1px",
            }}
          >
            {format(now, "HH:mm")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
            {format(now, "EEEE, d MMM")}
          </div>
        </div>

        {/* Current temp */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>{weather.emoji}</div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            {weather.temp}°C
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.125rem" }}>
            {weather.condition}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "0.875rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
          }}
        >
          <Thermometer className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
          Feels {weather.feels_like}°C
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
          }}
        >
          <Droplets className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
          {weather.humidity}%
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
          }}
        >
          <Wind className="w-3.5 h-3.5" style={{ color: "#94a3b8" }} />
          {weather.wind} km/h
        </div>
      </div>

      {/* 3-day forecast */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {weather.forecast.map((day, i) => {
          const dayName = i === 0 ? "Today" : i === 1 ? "Tmrw" : format(new Date(day.day), "EEE");
          return (
            <div
              key={day.day}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "0.5rem 0.375rem",
                backgroundColor: i === 0 ? "rgba(255,59,48,0.08)" : "var(--card-elevated)",
                borderRadius: "0.5rem",
                border: i === 0 ? "1px solid rgba(255,59,48,0.2)" : "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                {dayName}
              </div>
              <div style={{ fontSize: "1.25rem", lineHeight: 1, marginBottom: "0.25rem" }}>{day.emoji}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>{day.max}°</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{day.min}°</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
