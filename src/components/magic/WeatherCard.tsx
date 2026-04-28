import { useEffect, useState } from "react";
import { Cloud } from "lucide-react";
import { fetchMatchWeather, geocode, type MatchWeather } from "@/lib/weather";

interface WeatherCardProps {
  venue?: string;
  utcDate?: string;
  lat?: number;
  lon?: number;
}

/**
 * Carte météo prévue au coup d'envoi. Utilise lat/lon si fournis,
 * sinon géocode le nom du stade ou de la ville. Open-Meteo (gratuit).
 */
export const WeatherCard = ({ venue, utcDate, lat, lon }: WeatherCardProps) => {
  const [data, setData] = useState<MatchWeather | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!utcDate) return;
    let cancelled = false;
    setLoading(true);
    setData(null);

    (async () => {
      try {
        let coords: { lat: number; lon: number } | null = null;
        if (lat != null && lon != null) coords = { lat, lon };
        else if (venue) coords = await geocode(venue);
        if (!coords || cancelled) return;
        const w = await fetchMatchWeather(coords.lat, coords.lon, utcDate);
        if (!cancelled) setData(w);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [venue, utcDate, lat, lon]);

  if (!utcDate) return null;
  if (loading && !data) {
    return (
      <div className="glass rounded-xl p-3 flex items-center gap-2">
        <Cloud size={14} className="text-muted-foreground animate-pulse" />
        <span className="text-[9px] text-muted-foreground italic">Météo en cours...</span>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        <Cloud size={10} /> Météo au coup d'envoi
      </div>
      <div className="flex items-center gap-3">
        <div className="text-3xl leading-none">{data.emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-display font-black text-foreground">
            {data.label} · {data.tempC}°C
          </p>
          <div className="flex gap-3 mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>💨 {data.windKmh} km/h</span>
            <span>💧 {data.precipMm} mm</span>
          </div>
        </div>
      </div>
      {(data.windKmh > 30 || data.precipMm > 2 || data.condition === "snow") && (
        <p className="mt-2 text-[9px] text-gold font-bold italic">
          ⚠️ Conditions difficiles — favoriser l'Under et les paris défensifs.
        </p>
      )}
    </div>
  );
};
