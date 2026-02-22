/**
 * Weather API
 * GET /api/weather?lat=<number>&lon=<number>
 * Uses Open-Meteo (free, no API key)
 *
 * - If lat/lon are omitted, falls back to Madrid.
 * - Caches per (rounded) location for 10 minutes.
 */
import { NextResponse } from 'next/server';

// Cache weather data for 10 minutes (per location)
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_DURATION = 10 * 60 * 1000;

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: "Clear sky", emoji: "☀️" },
  1: { label: "Mainly clear", emoji: "🌤️" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Foggy", emoji: "🌫️" },
  48: { label: "Icy fog", emoji: "🌫️" },
  51: { label: "Light drizzle", emoji: "🌦️" },
  53: { label: "Drizzle", emoji: "🌦️" },
  55: { label: "Heavy drizzle", emoji: "🌧️" },
  61: { label: "Light rain", emoji: "🌧️" },
  63: { label: "Rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  71: { label: "Light snow", emoji: "🌨️" },
  73: { label: "Snow", emoji: "❄️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  80: { label: "Light showers", emoji: "🌦️" },
  81: { label: "Showers", emoji: "🌧️" },
  82: { label: "Heavy showers", emoji: "⛈️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm with hail", emoji: "⛈️" },
  99: { label: "Thunderstorm with heavy hail", emoji: "⛈️" },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");

  const latRaw = latParam ? Number(latParam) : 40.4168;
  const lonRaw = lonParam ? Number(lonParam) : -3.7038;

  const lat = Number.isFinite(latRaw) ? Math.max(-90, Math.min(90, latRaw)) : 40.4168;
  const lon = Number.isFinite(lonRaw) ? Math.max(-180, Math.min(180, lonRaw)) : -3.7038;

  // Cache key: round to reduce cache fragmentation
  const key = `${Math.round(lat * 100) / 100},${Math.round(lon * 100) / 100}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  try {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=3`;

    const [forecastRes, reverseRes] = await Promise.all([
      fetch(forecastUrl, { next: { revalidate: 600 } }),
      fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&language=en&format=json`,
        { next: { revalidate: 86400 } }
      ),
    ]);

    const forecastJson = await forecastRes.json();
    const reverseJson = await reverseRes.json();

    const current = forecastJson.current;
    const daily = forecastJson.daily;

    const wmo = WMO_CODES[current.weather_code] || { label: "Unknown", emoji: "🌡️" };

    const place = reverseJson?.results?.[0];
    const city = place?.name ? String(place.name) : (latParam && lonParam ? "Your location" : "Madrid");

    const data = {
      city,
      temp: Math.round(current.temperature_2m),
      feels_like: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      wind: Math.round(current.wind_speed_10m),
      precipitation: current.precipitation,
      condition: wmo.label,
      emoji: wmo.emoji,
      forecast: daily.time.slice(0, 3).map((day: string, i: number) => ({
        day,
        max: Math.round(daily.temperature_2m_max[i]),
        min: Math.round(daily.temperature_2m_min[i]),
        emoji: (WMO_CODES[daily.weather_code[i]] || { emoji: "🌡️" }).emoji,
      })),
      updated: new Date().toISOString(),
    };

    cache.set(key, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[weather] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
