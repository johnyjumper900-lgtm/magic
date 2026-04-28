import type { SDBEvent } from "@/lib/thesportsdb";

interface TeamRadarProps {
  /** Nom de l'équipe domicile (pour reconnaître home/away dans les events) */
  homeName: string;
  awayName: string;
  homeEvents: SDBEvent[];
  awayEvents: SDBEvent[];
  size?: number;
}

/**
 * Radar simple à 5 axes : Attaque, Défense, Forme, Domicile, Extérieur.
 * Calculé à partir des 5 derniers matchs SDB de chaque équipe.
 * Échelle 0-100. Polygone bleu = équipe A, polygone violet = équipe B.
 */
function metrics(team: string, evs: SDBEvent[]) {
  const t = team.toLowerCase();
  let gf = 0;
  let ga = 0;
  let n = 0;
  let pts = 0;
  let homeGames = 0;
  let homePts = 0;
  let awayGames = 0;
  let awayPts = 0;
  for (const e of evs.slice(0, 5)) {
    const h = parseInt(e.intHomeScore || "", 10);
    const a = parseInt(e.intAwayScore || "", 10);
    if (Number.isNaN(h) || Number.isNaN(a)) continue;
    n++;
    const isHome = e.strHomeTeam?.toLowerCase().includes(t);
    const my = isHome ? h : a;
    const opp = isHome ? a : h;
    gf += my;
    ga += opp;
    let p = 0;
    if (my > opp) p = 3;
    else if (my === opp) p = 1;
    pts += p;
    if (isHome) {
      homeGames++;
      homePts += p;
    } else {
      awayGames++;
      awayPts += p;
    }
  }
  if (n === 0) return null;
  // Échelles 0-100
  const attack = Math.min(100, (gf / n) * 33); // 3 buts/match -> 100
  const defense = Math.max(0, 100 - (ga / n) * 33);
  const form = (pts / (n * 3)) * 100;
  const homeRating = homeGames > 0 ? (homePts / (homeGames * 3)) * 100 : form;
  const awayRating = awayGames > 0 ? (awayPts / (awayGames * 3)) * 100 : form;
  return { attack, defense, form, home: homeRating, away: awayRating };
}

export const TeamRadar = ({
  homeName,
  awayName,
  homeEvents,
  awayEvents,
  size = 220,
}: TeamRadarProps) => {
  const a = metrics(homeName, homeEvents);
  const b = metrics(awayName, awayEvents);
  const labels = ["Attaque", "Défense", "Forme", "Domicile", "Extérieur"];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 28;
  const N = 5;

  const points = (vals: number[]) =>
    vals
      .map((v, i) => {
        const ang = (Math.PI * 2 * i) / N - Math.PI / 2;
        const rr = (r * Math.max(0, Math.min(100, v))) / 100;
        return `${cx + rr * Math.cos(ang)},${cy + rr * Math.sin(ang)}`;
      })
      .join(" ");

  // grille
  const rings = [0.25, 0.5, 0.75, 1].map((k) =>
    Array.from({ length: N }, (_, i) => {
      const ang = (Math.PI * 2 * i) / N - Math.PI / 2;
      return `${cx + r * k * Math.cos(ang)},${cy + r * k * Math.sin(ang)}`;
    }).join(" "),
  );

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => (
          <polygon
            key={i}
            points={ring}
            fill="none"
            stroke="hsl(var(--border))"
            strokeOpacity={0.5}
            strokeWidth={0.7}
          />
        ))}
        {/* axes */}
        {Array.from({ length: N }, (_, i) => {
          const ang = (Math.PI * 2 * i) / N - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + r * Math.cos(ang)}
              y2={cy + r * Math.sin(ang)}
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              strokeWidth={0.5}
            />
          );
        })}
        {b && (
          <polygon
            points={points([b.attack, b.defense, b.form, b.home, b.away])}
            fill="hsl(var(--secondary) / 0.25)"
            stroke="hsl(var(--secondary))"
            strokeWidth={1.2}
          />
        )}
        {a && (
          <polygon
            points={points([a.attack, a.defense, a.form, a.home, a.away])}
            fill="hsl(var(--primary) / 0.25)"
            stroke="hsl(var(--primary))"
            strokeWidth={1.2}
          />
        )}
        {/* labels */}
        {labels.map((l, i) => {
          const ang = (Math.PI * 2 * i) / N - Math.PI / 2;
          const lx = cx + (r + 16) * Math.cos(ang);
          const ly = cy + (r + 16) * Math.sin(ang);
          return (
            <text
              key={l}
              x={lx}
              y={ly}
              fontSize={8}
              fill="hsl(var(--muted-foreground))"
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-bold uppercase tracking-widest"
            >
              {l}
            </text>
          );
        })}
      </svg>
      {(!a && !b) && (
        <p className="text-[9px] text-muted-foreground italic mt-1">Données insuffisantes</p>
      )}
      <div className="flex gap-3 text-[9px] font-bold uppercase tracking-widest mt-1">
        <span className="flex items-center gap-1 text-primary">
          <span className="w-2 h-2 rounded-full bg-primary" />
          {homeName.split(" ")[0]}
        </span>
        <span className="flex items-center gap-1 text-secondary">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          {awayName.split(" ")[0]}
        </span>
      </div>
    </div>
  );
};
