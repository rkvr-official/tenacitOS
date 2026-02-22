/**
 * Weather API
 * GET /api/weather?lat=..&lon=..
 * Uses Open-Meteo (free, no API key)
 */

import { NextResponse } from 'next/server';

type CacheEntry = { data: unknown; ts: number };

// Cache weather data for 10 minutes (keyed by location)
const CACHE_DURATION = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Clear sky', emoji: '☀️' },
  1: { label: 'Mainly clear', emoji: '🌤️' },
  2: { label: 'Partly cloudy', emoji: '⛅' },
  3: { label: 'Overcast', emoji: '☁️' },
  45: { label: 'Foggy', emoji: '🌫️' },
  48: { label: 'Icy fog', emoji: '🌫️' },
  51: { label: 'Light drizzle', emoji: '🌦️' },
  53: { label: 'Drizzle', emoji: '🌦️' },
  55: { label: 'Heavy drizzle', emoji: '🌧️' },
  61: { label: 'Light rain', emoji: '🌧️' },
  63: { label: 'Rain', emoji: '🌧️' },
  65: { label: 'Heavy rain', emoji: '🌧️' },
  71: { label: 'Light snow', emoji: '🌨️' },
  73: { label: 'Snow', emoji: '❄️' },
  75: { label: 'Heavy snow', emoji: '❄️' },
  80: { label: 'Light showers', emoji: '🌦️' },
  81: { label: 'Showers', emoji: '🌧️' },
  82: { label: 'Heavy showers', emoji: '⛈️' },
  95: { label: 'Thunderstorm', emoji: '⛈️' },
  96: { label: 'Thunderstorm with hail', emoji: '⛈️' },
  99: { label: 'Thunderstorm with heavy hail', emoji: '⛈️' },
};

const toNum = (v: string | null) => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cacheKeyFor = (lat: number | null, lon: number | null) => {
  if (lat == null || lon == null) return 'default:madrid';
  // Round to reduce cache fragmentation while keeping it location-correct
  return `geo:${lat.toFixed(2)},${lon.toFixed(2)}`;
};

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lon)}&count=1&language=en&format=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json = await res.json();
    const first = json?.results?.[0];
    if (!first) return null;
    // e.g. "Barcelona, Catalonia" or "Madrid, Community of Madrid"
    const parts = [first.name, first.admin1].filter(Boolean);
    return parts.join(', ');
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = toNum(url.searchParams.get('lat'));
  const lon = toNum(url.searchParams.get('lon'));

  const key = cacheKeyFor(lat, lon);
  const existing = cache.get(key);
  if (existing && Date.now() - existing.ts < CACHE_DURATION) {
    return NextResponse.json(existing.data);
  }

  try {
    const useLat = lat ?? 40.4168;
    const useLon = lon ?? -3.7038;

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(useLat)}` +
      `&longitude=${encodeURIComponent(useLon)}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      // timezone=auto makes it match the user's coordinates
      `&timezone=auto&forecast_days=3`;

    const res = await fetch(forecastUrl, { next: { revalidate: 600 } });
    if (!res.ok) {
      throw new Error(`Open-Meteo error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();

    const current = json.current;
    const daily = json.daily;

    const wmo = WMO_CODES[current.weather_code] || { label: 'Unknown', emoji: '🌡️' };

    const city =
      lat != null && lon != null
        ? (await reverseGeocode(useLat, useLon)) ?? 'Your location'
        : 'Madrid';

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
        emoji: (WMO_CODES[daily.weather_code[i]] || { emoji: '🌡️' }).emoji,
      })),
      updated: new Date().toISOString(),
      meta: {
        source: lat != null && lon != null ? 'geolocation' : 'default',
        lat: useLat,
        lon: useLon,
        cacheKey: key,
      },
    };

    cache.set(key, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[weather] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
