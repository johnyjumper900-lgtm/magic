import type { SDBEvent } from "@/lib/thesportsdb";

interface GoalsHeatmapProps {
  team: string;
  events: SDBEvent[];
}

/**
 * Heatmap simplifiée : on n'a pas la minute exacte des buts via SDB
 * gratuit, donc on segmente en 6 tranches de 15min et on attribue
 * uniformément les buts (+ légère pondération fin de match) histoire
 * de visualiser quand l'équipe a tendance à marquer.
 */
function distribute(goals: number, slots: number) {
  // Distribution observée moyenne en L1 : un peu plus de buts en 2e mi-temps
  const weights = [0.9, 1.0, 1.05, 1.05, 1.1, 1.1];
  const w = weights.slice(0, slots);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (goals * x) / sum);
}

export const GoalsHeatmap = ({ team, events }: GoalsHeatmapProps) => {
  const t = team.toLowerCase();
  let scored = 0;
  let conceded = 0;
  for (const e of events.slice(0, 5)) {
    const h = parseInt(e.intHomeScore || "", 10);
    const a = parseInt(e.intAwayScore || "", 10);
    if (Number.isNaN(h) || Number.isNaN(a)) continue;
    const isHome = e.strHomeTeam?.toLowerCase().includes(t);
    if (isHome) {
      scored += h;
      conceded += a;
    } else {
      scored += a;
      conceded += h;
    }
  }
  const slots = 6;
  const sc = distribute(scored, slots);
  const cn = distribute(conceded, slots);
  const max = Math.max(...sc, ...cn, 0.1);
  const labels = ["0-15", "15-30", "30-45", "45-60", "60-75", "75-90"];

  return (
    <div className="space-y-1.5">
      <p className="text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground">
        {team} — Tendance par tranche (5 derniers)
      </p>
      <div className="flex gap-[3px] items-end h-12">
        {sc.map((v, i) => (
          <div key={`s${i}`} className="flex-1 flex flex-col gap-[2px]">
            <div
              className="rounded-t bg-success/70"
              style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
              title={`Marqués · ${v.toFixed(1)}`}
            />
            <div
              className="rounded-b bg-destructive/70"
              style={{ height: `${Math.max(2, (cn[i] / max) * 100)}%` }}
              title={`Encaissés · ${cn[i].toFixed(1)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[7.5px] text-muted-foreground font-bold">
        {labels.map((l) => (
          <span key={l}>{l}'</span>
        ))}
      </div>
      <div className="flex gap-3 text-[8px] font-bold uppercase tracking-widest pt-0.5">
        <span className="flex items-center gap-1 text-success">
          <span className="w-2 h-2 rounded-sm bg-success" /> Marqués · {scored}
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <span className="w-2 h-2 rounded-sm bg-destructive" /> Encaissés · {conceded}
        </span>
      </div>
    </div>
  );
};
