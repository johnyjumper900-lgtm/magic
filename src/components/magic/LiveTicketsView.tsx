import { useEffect, useMemo, useState } from "react";
import { Radio, Trophy, X, RotateCw, TrendingDown, Banknote } from "lucide-react";
import type { HistoryItem } from "@/types/magic";
import { TheSportsDB, type SDBEvent } from "@/lib/thesportsdb";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";

interface LiveTicketsViewProps {
  tickets: HistoryItem[];
}

type Pick = NonNullable<HistoryItem["picks"]>[number];

interface LivePick {
  pick: Pick;
  event: SDBEvent | null;
  status: "scheduled" | "live" | "finished" | "unknown";
  homeScore: number | null;
  awayScore: number | null;
  /** Estimation gagnant/perdant en cours, "won" si déjà résolu */
  liveResult: "won" | "lost" | "pending" | "unknown";
}

const sep = /\s+(?:vs\.?|v\.s\.?|versus|contre|-|–|—)\s+/i;

function parseTeams(label: string): [string, string] | null {
  const parts = label.split(sep);
  if (parts.length < 2) return null;
  return [parts[0].trim(), parts[1].trim()];
}

async function findEvent(pick: Pick): Promise<SDBEvent | null> {
  if (pick.eventId) {
    try {
      const j = await TheSportsDB.lookupEvent(pick.eventId);
      const ev = (j?.events ?? [])[0] as SDBEvent | undefined;
      if (ev) return ev;
    } catch {
      /* fallback */
    }
  }
  const teams = parseTeams(pick.match);
  if (!teams) return null;
  const [home, away] = teams;
  try {
    const j = await TheSportsDB.searchEvents(`${home}_vs_${away}`.replace(/\s+/g, "_"));
    const events: SDBEvent[] = j?.event ?? [];
    if (!events.length) return null;
    events.sort((a, b) => (b.dateEvent || "").localeCompare(a.dateEvent || ""));
    return events[0];
  } catch {
    return null;
  }
}

function classifyEvent(ev: SDBEvent | null): {
  status: LivePick["status"];
  homeScore: number | null;
  awayScore: number | null;
} {
  if (!ev) return { status: "unknown", homeScore: null, awayScore: null };
  const s = (ev.strStatus || ev.strProgress || "").toLowerCase();
  const h = ev.intHomeScore != null ? parseInt(ev.intHomeScore, 10) : null;
  const a = ev.intAwayScore != null ? parseInt(ev.intAwayScore, 10) : null;
  if (/(ft|finished|terminé|aet|pen)/i.test(s)) {
    return { status: "finished", homeScore: h, awayScore: a };
  }
  if (/(ht|half|1h|2h|live|in play|in progress|\d+'?)/.test(s)) {
    return { status: "live", homeScore: h, awayScore: a };
  }
  if (h != null && a != null) return { status: "live", homeScore: h, awayScore: a };
  return { status: "scheduled", homeScore: null, awayScore: null };
}

/**
 * Tente d'évaluer si un pari est gagnant/perdant à l'instant T pour les
 * marchés simples (1X2, BTTS, Over/Under). Pour les autres → "unknown".
 */
function judgePick(pick: Pick, h: number | null, a: number | null): LivePick["liveResult"] {
  if (h == null || a == null) return "pending";
  const opt = (pick.option || "").toLowerCase();
  const type = (pick.type || "").toLowerCase();

  // 1X2
  if (/h2h|1x2|résultat|match winner|moneyline/.test(type) || /domicile|home|extérieur|away|nul|draw|x|^1$|^2$/.test(opt)) {
    if (/domicile|home|^1\b/.test(opt)) return h > a ? "won" : "lost";
    if (/extérieur|away|^2\b/.test(opt)) return a > h ? "won" : "lost";
    if (/nul|draw|^x\b/.test(opt)) return h === a ? "won" : "lost";
  }
  // BTTS
  if (/btts|both teams|deux/.test(type) || /btts/.test(opt)) {
    const yes = /yes|oui/.test(opt);
    const both = h > 0 && a > 0;
    return both === yes ? "won" : "lost";
  }
  // Over/Under
  const ouMatch = opt.match(/(over|under|plus|moins)\s*(\d+(?:[.,]\d+)?)/);
  if (ouMatch) {
    const total = h + a;
    const line = parseFloat(ouMatch[2].replace(",", "."));
    const over = /over|plus/.test(ouMatch[1]);
    if (over) return total > line ? "won" : "lost";
    return total < line ? "won" : "lost";
  }
  return "unknown";
}

export const LiveTicketsView = ({ tickets }: LiveTicketsViewProps) => {
  const validated = useMemo(
    () => tickets.filter((t) => t.status === "validated"),
    [tickets],
  );
  const [liveByTicket, setLiveByTicket] = useState<Record<string, LivePick[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      setRefreshing(true);
      const out: Record<string, LivePick[]> = {};
      for (const t of validated) {
        const picks = t.picks ?? [];
        const arr: LivePick[] = [];
        for (const p of picks) {
          const ev = await findEvent(p);
          const cls = classifyEvent(ev);
          const judged = p.result && p.result !== "pending"
            ? p.result
            : cls.status === "finished" || cls.status === "live"
              ? judgePick(p, cls.homeScore, cls.awayScore)
              : "pending";
          arr.push({
            pick: p,
            event: ev,
            status: cls.status,
            homeScore: cls.homeScore,
            awayScore: cls.awayScore,
            liveResult: judged as LivePick["liveResult"],
          });
          await new Promise((r) => setTimeout(r, 200));
        }
        out[t.id] = arr;
      }
      if (!cancelled) {
        setLiveByTicket(out);
        setLastUpdate(new Date());
        setRefreshing(false);
      }
    }
    if (validated.length > 0) {
      tick();
      const id = setInterval(tick, 60_000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    } else {
      setLiveByTicket({});
    }
  }, [validated]);

  if (validated.length === 0) {
    return (
      <HoloCard variant="violet">
        <div className="p-8 text-center">
          <HoloLogo icon={Radio} size={48} />
          <p className="mt-3 text-xs text-muted-foreground">
            Aucun ticket validé.<br />Valide un ticket pour le suivre en direct ici.
          </p>
        </div>
      </HoloCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <HoloLogo icon={Radio} size={40} />
          <div>
            <h2 className="text-sm font-display font-black uppercase tracking-[0.18em] holo-text">
              Tickets en Direct
            </h2>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
              {validated.length} ticket{validated.length > 1 ? "s" : ""} suivis · auto 60s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
          <RotateCw size={11} className={refreshing ? "animate-spin text-primary" : ""} />
          {lastUpdate?.toLocaleTimeString("fr-FR", {
            timeZone: "Europe/Paris",
            hour: "2-digit",
            minute: "2-digit",
          }) || "—"}
        </div>
      </div>

      {validated.map((t) => {
        const live = liveByTicket[t.id] ?? [];
        const settled = live.filter((l) => l.liveResult === "won" || l.liveResult === "lost").length;
        const wonCount = live.filter((l) => l.liveResult === "won").length;
        const lostAlready = live.some((l) => l.liveResult === "lost");
        const allWon = live.length > 0 && live.every((l) => l.liveResult === "won");
        const totalOdds = parseFloat(t.odds || "1");
        const stake = t.stake ?? 0;
        const potential = stake * totalOdds;
        const progressPct = live.length > 0 ? (wonCount / live.length) * 100 : 0;

        // Cash Out simulé : moyenne pondérée des cotes restantes (90% pour rester réaliste)
        const remaining = live.filter((l) => l.liveResult === "pending" || l.liveResult === "unknown");
        const wonOdds = live
          .filter((l) => l.liveResult === "won")
          .reduce((acc, l) => acc * l.pick.odds, 1);
        // value tickets : si tous les paris pendants ont chacun 60% de réussir → cashout = stake * wonOdds * 0.6^N * 0.92
        const remainingProb = remaining.reduce(
          (acc, l) => acc * (l.pick.probability / 100),
          1,
        );
        const cashOut = lostAlready
          ? 0
          : Math.max(0, stake * wonOdds * remainingProb * totalOdds * 0.92 / Math.max(totalOdds, 1));

        return (
          <HoloCard key={t.id} variant={lostAlready ? "violet" : allWon ? "cyan" : "cyan"}>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Ticket #{t.id.slice(0, 6).toUpperCase()}
                  </p>
                  <p className="text-sm font-display font-black text-foreground truncate">
                    {t.title}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-display font-black holo-text leading-none">
                    {totalOdds.toFixed(2)}
                  </div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                    cote totale
                  </div>
                </div>
              </div>

              {/* Barre de progression */}
              <div>
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest mb-1">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="text-primary">
                    {settled}/{live.length} décidés · {wonCount} gagnés
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      lostAlready ? "bg-destructive" : "bg-gradient-prism"
                    }`}
                    style={{ width: `${lostAlready ? 100 : progressPct}%` }}
                  />
                </div>
              </div>

              {/* Live picks */}
              <div className="space-y-2">
                {live.map((l, i) => {
                  const r = l.liveResult;
                  const cls =
                    r === "won"
                      ? "text-success border-success/40 bg-success/5"
                      : r === "lost"
                        ? "text-destructive border-destructive/40 bg-destructive/5"
                        : "text-muted-foreground border-border bg-muted/30";
                  return (
                    <div
                      key={i}
                      className={`rounded-lg p-2 border ${cls}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              r === "won"
                                ? "bg-success text-success-foreground"
                                : r === "lost"
                                  ? "bg-destructive text-destructive-foreground"
                                  : l.status === "live"
                                    ? "bg-primary/20 text-primary border border-primary/40 animate-pulse"
                                    : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {r === "won" ? (
                              <Trophy size={11} strokeWidth={3} />
                            ) : r === "lost" ? (
                              <X size={12} strokeWidth={3} />
                            ) : l.status === "live" ? (
                              <span className="text-[8px] font-black">LIVE</span>
                            ) : (
                              <span className="text-[8px] font-black">--</span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10.5px] font-bold text-foreground truncate">
                              {l.pick.match}
                            </p>
                            <p className="text-[9px] truncate">
                              {l.pick.type} · <span className="font-black">{l.pick.option}</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {l.homeScore != null && l.awayScore != null ? (
                            <div className="text-sm font-display font-black holo-text leading-none">
                              {l.homeScore}-{l.awayScore}
                            </div>
                          ) : (
                            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                              à venir
                            </div>
                          )}
                          <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                            {l.pick.odds.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cash Out + gain potentiel */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="glass rounded-lg p-2">
                  <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
                    Mise
                  </p>
                  <p className="text-xs font-display font-black text-foreground mt-0.5">
                    {stake.toFixed(0)}€
                  </p>
                </div>
                <div className="glass rounded-lg p-2">
                  <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold flex items-center justify-center gap-1">
                    <Banknote size={9} /> Cash Out
                  </p>
                  <p
                    className={`text-xs font-display font-black mt-0.5 ${
                      lostAlready ? "text-destructive" : "text-gold"
                    }`}
                  >
                    {lostAlready ? "0€" : `${cashOut.toFixed(0)}€`}
                  </p>
                </div>
                <div className="glass rounded-lg p-2">
                  <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
                    Si gagné
                  </p>
                  <p className="text-xs font-display font-black holo-text mt-0.5">
                    {potential.toFixed(0)}€
                  </p>
                </div>
              </div>

              {lostAlready && (
                <div className="flex items-center gap-2 text-[10px] text-destructive font-bold">
                  <TrendingDown size={12} />
                  Au moins un pari est perdu — le ticket est mort.
                </div>
              )}
            </div>
          </HoloCard>
        );
      })}
    </div>
  );
};
