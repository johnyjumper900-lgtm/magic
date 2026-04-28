/**
 * Open-Meteo weather client — gratuit, pas de clé requise.
 * Renvoie la météo prévue pour le coup d'envoi d'un match.
 */

export interface MatchWeather {
  tempC: number;
  windKmh: number;
  precipMm: number;
  /** code WMO simplifié */
  condition: "clear" | "cloudy" | "rain" | "snow" | "storm" | "fog";
  emoji: string;
  label: string;
}

const WMO: Record<number, MatchWeather["condition"]> = {
  0: "clear",
  1: "clear",
  2: "cloudy",
  3: "cloudy",
  45: "fog",
  48: "fog",
  51: "rain",
  53: "rain",
  55: "rain",
  61: "rain",
  63: "rain",
  65: "rain",
  71: "snow",
  73: "snow",
  75: "snow",
  80: "rain",
  81: "rain",
  82: "rain",
  95: "storm",
  96: "storm",
  99: "storm",
};

const EMOJI: Record<MatchWeather["condition"], string> = {
  clear: "☀️",
  cloudy: "☁️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
  fog: "🌫️",
};

const LABEL: Record<MatchWeather["condition"], string> = {
  clear: "Dégagé",
  cloudy: "Nuageux",
  rain: "Pluie",
  snow: "Neige",
  storm: "Orage",
  fog: "Brouillard",
};

const CACHE = new Map<string, { ts: number; data: MatchWeather }>();
const TTL = 30 * 60 * 1000;

export async function fetchMatchWeather(
  lat: number,
  lon: number,
  isoUtc: string,
): Promise<MatchWeather | null> {
  const k = `${lat.toFixed(2)},${lon.toFixed(2)}@${isoUtc.slice(0, 13)}`;
  const c = CACHE.get(k);
  if (c && Date.now() - c.ts < TTL) return c.data;
  try {
    const day = isoUtc.slice(0, 10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m,weather_code&start_date=${day}&end_date=${day}&timezone=UTC&wind_speed_unit=kmh`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const json = (await r.json()) as {
      hourly?: {
        time?: string[];
        temperature_2m?: number[];
        precipitation?: number[];
        wind_speed_10m?: number[];
        weather_code?: number[];
      };
    };
    const times = json.hourly?.time ?? [];
    const target = isoUtc.slice(0, 13); // YYYY-MM-DDTHH
    const idx = times.findIndex((t) => t.startsWith(target));
    if (idx < 0) return null;
    const code = json.hourly?.weather_code?.[idx] ?? 0;
    const cond = WMO[code] ?? "cloudy";
    const data: MatchWeather = {
      tempC: Math.round(json.hourly?.temperature_2m?.[idx] ?? 0),
      windKmh: Math.round(json.hourly?.wind_speed_10m?.[idx] ?? 0),
      precipMm: Math.round((json.hourly?.precipitation?.[idx] ?? 0) * 10) / 10,
      condition: cond,
      emoji: EMOJI[cond],
      label: LABEL[cond],
    };
    CACHE.set(k, { ts: Date.now(), data });
    return data;
  } catch {
    return null;
  }
}

/* ---------- Geocoding gratuit Open-Meteo (par nom de stade/ville) ---------- */

const GEO_CACHE = new Map<string, { lat: number; lon: number } | null>();

export async function geocode(name: string): Promise<{ lat: number; lon: number } | null> {
  if (!name) return null;
  const k = name.toLowerCase().trim();
  if (GEO_CACHE.has(k)) return GEO_CACHE.get(k) ?? null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=fr&format=json`;
    const r = await fetch(url);
    if (!r.ok) {
      GEO_CACHE.set(k, null);
      return null;
    }
    const json = (await r.json()) as {
      results?: Array<{ latitude: number; longitude: number }>;
    };
    const first = json.results?.[0];
    if (!first) {
      GEO_CACHE.set(k, null);
      return null;
    }
    const out = { lat: first.latitude, lon: first.longitude };
    GEO_CACHE.set(k, out);
    return out;
  } catch {
    GEO_CACHE.set(k, null);
    return null;
  }
}
