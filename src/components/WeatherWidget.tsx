"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Wind, Droplets, Thermometer } from "lucide-react";

interface Forecast {
  day: string;
  max: number;
  min: number;
  emoji: string;
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
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather(pos: GeolocationPosition | null) {
      const url = pos
        ? `/api/weather?lat=${encodeURIComponent(pos.coords.latitude)}&lon=${encodeURIComponent(pos.coords.longitude)}`
        : "/api/weather";
      const d = await fetch(url, { cache: "no-store" }).then((r) => r.json());
      if (cancelled) return;
      setWeather(d);
    }

    async function load() {
      try {
        // Prefer user geolocation (browser permission prompt). If denied, fall back to Madrid.
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
          );
        });

        if (!pos) setGeoBlocked(true);
        else setGeoBlocked(false);

        await fetchWeather(pos);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // If user accepts the permission prompt after first render,
    // re-check on focus (common on mobile/webviews).
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);

    void load();

    // Update clock every second
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        padding: "1.25rem",
        backgroundColor: "var(--card)",
        borderRadius: "0.75rem",
        border: "1px solid var(--border)",
        minHeight: "120px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading weather...</span>
      </div>
    );
  }

  if (!weather || (weather as unknown as Record<string, unknown>).error) {
    return null;
  }

  return (
    <div style={{
      padding: "1.25rem",
      backgroundColor: "var(--card)",
      borderRadius: "0.75rem",
      border: "1px solid var(--border)",
      background: "linear-gradient(135deg, var(--card) 0%, color-mix(in srgb, var(--accent) 5%, var(--card)) 100%)",
    }}>
      {/* Header: city + clock */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        {geoBlocked ? (
          <div style={{ position: "absolute", marginTop: "-0.25rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Location blocked/failed → showing Madrid. Allow location + refocus the tab to retry.
          </div>
        ) : null}
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.125rem" }}>
            📍 {weather.city}
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1, letterSpacing: "-1px" }}>
            {format(now, "HH:mm")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
            {format(now, "EEEE, d MMM")}
          </div>
        </div>

        {/* Current temp */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>{weather.emoji}</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>
            {weather.temp}°C
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.125rem" }}>
            {weather.condition}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.875rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <Thermometer className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
          Feels {weather.feels_like}°C
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <Droplets className="w-3.5 h-3.5" style={{ color: "#60a5fa" }} />
          {weather.humidity}%
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
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
                flex: 1, textAlign: "center", padding: "0.5rem 0.375rem",
                backgroundColor: i === 0 ? "rgba(255,59,48,0.08)" : "var(--card-elevated)",
                borderRadius: "0.5rem",
                border: i === 0 ? "1px solid rgba(255,59,48,0.2)" : "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>{dayName}</div>
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
