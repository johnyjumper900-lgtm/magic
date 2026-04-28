import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  PlusCircle,
  RefreshCw,
  Search,
  AlertCircle,
  X,
  MapPin,
  Trophy,
  TrendingUp,
  History as HistoryIcon,
  Building2,
  Sparkles,
  Activity,
} from "lucide-react";
import { invokeFn } from "@/lib/api";
import type { CalendarMatch } from "@/types/magic";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";
import { TeamCrest, CountryFlag, TeamKit } from "./TeamCrest";
import { TheSportsDB, type SDBEvent } from "@/lib/thesportsdb";
import { fetchTeamMeta, type TeamMeta } from "@/lib/team-meta";
import { utcToParisLong, hasOddsApiKey } from "@/lib/odds-api";
import { onKeysUpdated } from "@/lib/keys-events";
import { MotivationBadge } from "./MotivationBadge";
import { WeatherCard } from "./WeatherCard";
import { TeamRadar } from "./TeamRadar";
import { GoalsHeatmap } from "./GoalsHeatmap";

interface MatchCalendarProps {
  onAddMatch: (m: CalendarMatch) => void;
}

interface TeamForm {
  meta: TeamMeta;
  lastEvents: SDBEvent[];
  /** "W" / "D" / "L" sequence for the last 5 finished games */
  form: Array<"W" | "D" | "L">;
  goalsFor: number;
  goalsAgainst: number;
}

interface H2HSummary {
  total: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  recent: SDBEvent[];
}

function computeForm(team: string, evs: SDBEvent[]): TeamForm["form"] {
  const t = team.toLowerCase();
  return evs
    .filter((e) => e.intHomeScore != null && e.intAwayScore != null)
    .slice(0, 5)
    .map((e) => {
      const h = parseInt(e.intHomeScore || "0", 10);
      const a = parseInt(e.intAwayScore || "0", 10);
      const isHome = e.strHomeTeam?.toLowerCase().includes(t);
      if (h === a) return "D" as const;
      if (isHome) return h > a ? "W" : "L";
      return a > h ? "W" : "L";
    });
}

function sumGoals(team: string, evs: SDBEvent[]) {
  const t = team.toLowerCase();
  let gf = 0;
  let ga = 0;
  for (const e of evs.slice(0, 5)) {
    const h = parseInt(e.intHomeScore || "0", 10);
    const a = parseInt(e.intAwayScore || "0", 10);
    if (Number.isNaN(h) || Number.isNaN(a)) continue;
    const isHome = e.strHomeTeam?.toLowerCase().includes(t);
    if (isHome) {
      gf += h;
      ga += a;
    } else {
      gf += a;
      ga += h;
    }
  }
  return { gf, ga };
}

function computeH2H(home: string, away: string, evs: SDBEvent[]): H2HSummary {
  const h = home.toLowerCase();
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  const finished = evs.filter(
    (e) => e.intHomeScore != null && e.intAwayScore != null,
  );
  for (const e of finished) {
    const sh = parseInt(e.intHomeScore || "0", 10);
    const sa = parseInt(e.intAwayScore || "0", 10);
    if (sh === sa) {
      draws++;
      continue;
    }
    const homeIsHomeTeam = e.strHomeTeam?.toLowerCase().includes(h);
    const winnerIsHome = sh > sa;
    if (homeIsHomeTeam === winnerIsHome) homeWins++;
    else awayWins++;
  }
  return {
    total: finished.length,
    homeWins,
    awayWins,
    draws,
    recent: finished.slice(0, 5),
  };
}

const FormBadge = ({ r }: { r: "W" | "D" | "L" }) => {
  const cls =
    r === "W"
      ? "bg-success text-success-foreground"
      : r === "L"
        ? "bg-destructive text-destructive-foreground"
        : "bg-muted text-muted-foreground border border-border";
  return (
    <span
      className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black ${cls}`}
    >
      {r}
    </span>
  );
};

export const MatchCalendar = ({ onAddMatch }: MatchCalendarProps) => {
  const [matches, setMatches] = useState<CalendarMatch[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CalendarMatch | null>(null);

  // Detail-modal enriched data
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [homeForm, setHomeForm] = useState<TeamForm | null>(null);
  const [awayForm, setAwayForm] = useState<TeamForm | null>(null);
  const [h2h, setH2h] = useState<H2HSummary | null>(null);

  const refresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await invokeFn<{
        matches?: CalendarMatch[];
        error?: string;
      }>("fetch-matches", { body: {} });
      if (invokeErr) throw invokeErr;
      if (data?.error) {
        setError(data.error);
        setMatches([]);
      } else {
        setMatches((data?.matches ?? []) as CalendarMatch[]);
        setLastUpdate(new Date());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setMatches([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh whenever the user adds/updates/removes an API key in Settings
  // so matches, kickoff times, dates and odds reflect the new sources instantly.
  useEffect(() => {
    return onKeysUpdated(() => {
      refresh();
    });
  }, []);

  // Whenever a match is selected, load deep info (parallel)
  useEffect(() => {
    if (!detail) {
      setHomeForm(null);
      setAwayForm(null);
      setH2h(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setHomeForm(null);
    setAwayForm(null);
    setH2h(null);

    (async () => {
      try {
        const [metaA, metaB, h2hRaw] = await Promise.all([
          fetchTeamMeta(detail.teamA),
          fetchTeamMeta(detail.teamB),
          TheSportsDB.headToHead(detail.teamA, detail.teamB).catch(() => null),
        ]);

        const [lastA, lastB] = await Promise.all([
          metaA.id
            ? TheSportsDB.lastTeamEvents(metaA.id).catch(() => null)
            : Promise.resolve(null),
          metaB.id
            ? TheSportsDB.lastTeamEvents(metaB.id).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const evsA: SDBEvent[] = (lastA as { results?: SDBEvent[] } | null)?.results ?? [];
        const evsB: SDBEvent[] = (lastB as { results?: SDBEvent[] } | null)?.results ?? [];
        const ga = sumGoals(detail.teamA, evsA);
        const gb = sumGoals(detail.teamB, evsB);
        setHomeForm({
          meta: metaA,
          lastEvents: evsA,
          form: computeForm(detail.teamA, evsA),
          goalsFor: ga.gf,
          goalsAgainst: ga.ga,
        });
        setAwayForm({
          meta: metaB,
          lastEvents: evsB,
          form: computeForm(detail.teamB, evsB),
          goalsFor: gb.gf,
          goalsAgainst: gb.ga,
        });

        const h2hEvents: SDBEvent[] = (h2hRaw as { event?: SDBEvent[] } | null)?.event ?? [];
        setH2h(computeH2H(detail.teamA, detail.teamB, h2hEvents));
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detail]);

  const dates = useMemo(
    () => Array.from(new Set(matches.map((m) => m.date))).slice(0, 10),
    [matches],
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return matches.filter((m) => {
      const matchSearch =
        !term ||
        m.teamA.toLowerCase().includes(term) ||
        m.teamB.toLowerCase().includes(term) ||
        m.league.toLowerCase().includes(term);
      const matchDate = selectedDate === "all" || m.date === selectedDate;
      return matchSearch && matchDate;
    });
  }, [matches, search, selectedDate]);

  return (
    <>
      <HoloCard variant="cyan">
        <div className="flex flex-col">
          <div className="p-4 border-b border-border/60">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <HoloLogo icon={Calendar} size={38} />
                <div className="min-w-0">
                  <h2 className="text-xs font-display font-black uppercase tracking-[0.2em] holo-text truncate">
                    Calendrier · Live
                  </h2>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5 truncate">
                    {hasOddsApiKey() ? "Cotes réelles · Auto 10min" : "Heure FR · Auto 10min"}
                  </p>
                </div>
              </div>
              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="tap flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest shrink-0"
                aria-label="Rafraîchir"
              >
                <RefreshCw
                  size={11}
                  className={isRefreshing ? "animate-spin text-primary" : ""}
                />
                {lastUpdate.toLocaleTimeString("fr-FR", {
                  timeZone: "Europe/Paris",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </button>
            </div>

            <div className="relative mb-3">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Équipe, ligue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-input/60 border border-border rounded-lg pl-9 pr-3 py-2.5 text-[13px] font-bold text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              <button
                onClick={() => setSelectedDate("all")}
                className={`shrink-0 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                  selectedDate === "all"
                    ? "bg-gradient-prism text-primary-foreground border-transparent shadow-holo"
                    : "bg-muted/40 border-border text-muted-foreground"
                }`}
              >
                Tous
              </button>
              {dates.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                    selectedDate === d
                      ? "bg-gradient-prism text-primary-foreground border-transparent shadow-holo"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[460px] overflow-y-auto p-2 space-y-1.5 scrollbar-none">
            {error && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <AlertCircle size={28} className="text-accent mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">
                  {error}
                </p>
              </div>
            )}

            {!error && isRefreshing && matches.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-60">
                <RefreshCw size={28} className="text-primary mb-2 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Chargement...
                </p>
              </div>
            )}

            {!error && !isRefreshing && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-40">
                <Calendar size={28} className="text-muted-foreground mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Aucun match
                </p>
              </div>
            )}

            {filtered.slice(0, 80).map((m) => (
              <button
                key={m.id}
                onClick={() => setDetail(m)}
                className="tap w-full p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <TeamCrest src={m.teamALogo} name={m.teamA} size={26} />
                  <span className="text-muted-foreground italic text-[8px]">VS</span>
                  <TeamCrest src={m.teamBLogo} name={m.teamB} size={26} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 min-w-0">
                    <CountryFlag code={m.countryCode} size={12} />
                    <span className="text-[8px] font-black text-primary uppercase tracking-widest truncate">
                      {m.league}
                    </span>
                    <MotivationBadge home={m.teamA} away={m.teamB} league={m.league} compact />
                    {m.realOdds && (
                      <span className="ml-auto px-1.5 py-0.5 rounded bg-success/15 border border-success/40 text-success text-[7.5px] font-black uppercase tracking-widest">
                        Cotes ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-display font-black text-foreground uppercase tracking-wider truncate">
                    <span>{m.teamA}</span>
                    <span className="text-muted-foreground italic mx-1">vs</span>
                    <span>{m.teamB}</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    <Clock size={10} />
                    <span className="truncate">{m.date} · {m.time}</span>
                  </div>
                  {/* Mini cotes 1X2 */}
                  {m.realOdds && (m.realOdds.home || m.realOdds.draw || m.realOdds.away) && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary text-[9px] font-black">
                        1 · {m.realOdds.home?.toFixed(2) ?? "—"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground text-[9px] font-black">
                        N · {m.realOdds.draw?.toFixed(2) ?? "—"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary text-[9px] font-black">
                        2 · {m.realOdds.away?.toFixed(2) ?? "—"}
                      </span>
                    </div>
                  )}
                </div>
                <PlusCircle size={18} className="text-primary shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </HoloCard>

      {/* Detailed modal — H2H, form, real odds, kits, country */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-md p-4"
          onClick={() => setDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl glass-strong shadow-prism animate-fade-in-up"
          >
            <div className="relative p-5 border-b border-border/60">
              <button
                onClick={() => setDetail(null)}
                className="tap absolute top-4 right-4 w-9 h-9 rounded-full glass flex items-center justify-center"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <CountryFlag code={detail.countryCode || homeForm?.meta.countryCode} size={14} />
                <p className="text-[9px] font-black uppercase tracking-widest text-primary truncate">
                  {detail.league}
                </p>
              </div>

              {/* Logos + kits */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <TeamCrest src={detail.teamALogo || homeForm?.meta.badge} name={detail.teamA} size={56} />
                  <TeamKit src={homeForm?.meta.kit} name={detail.teamA} size={52} />
                  <p className="text-[11px] font-display font-black text-foreground uppercase text-center break-words leading-tight">
                    {detail.teamA}
                  </p>
                  {homeForm?.meta.country && (
                    <div className="flex items-center gap-1">
                      <CountryFlag code={homeForm.meta.countryCode} size={10} />
                      <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
                        {homeForm.meta.country}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-center shrink-0 px-2">
                  <div className="text-2xl font-display font-black holo-text">VS</div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                    {detail.parisTime || detail.time}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <TeamCrest src={detail.teamBLogo || awayForm?.meta.badge} name={detail.teamB} size={56} />
                  <TeamKit src={awayForm?.meta.kit} name={detail.teamB} size={52} />
                  <p className="text-[11px] font-display font-black text-foreground uppercase text-center break-words leading-tight">
                    {detail.teamB}
                  </p>
                  {awayForm?.meta.country && (
                    <div className="flex items-center gap-1">
                      <CountryFlag code={awayForm.meta.countryCode} size={10} />
                      <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
                        {awayForm.meta.country}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {/* Date / heure / stade en haut */}
              <div className="grid grid-cols-2 gap-2">
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    <Calendar size={10} /> Date · Heure FR
                  </div>
                  <p className="text-[11px] font-display font-black text-foreground leading-tight">
                    {detail.utcDate ? utcToParisLong(detail.utcDate) : `${detail.date} · ${detail.time}`}
                  </p>
                </div>
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    <Clock size={10} /> Coup d'envoi
                  </div>
                  <p className="text-xs font-display font-black holo-text">
                    {detail.parisTime || detail.time}
                  </p>
                </div>
                {(detail.venue || homeForm?.meta.stadium) && (
                  <div className="glass rounded-xl p-3 col-span-2">
                    <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      <MapPin size={10} /> Stade
                    </div>
                    <p className="text-xs font-display font-black text-foreground truncate">
                      {detail.venue || homeForm?.meta.stadium}
                    </p>
                  </div>
                )}
              </div>

              {/* Vraies cotes */}
              {detail.realOdds && (
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground">
                      <TrendingUp size={10} /> Cotes bookmakers
                    </div>
                    <span className="text-[8px] font-bold text-success uppercase tracking-widest">
                      ✓ Réelles
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { k: "1", label: "Domicile", o: detail.realOdds.home, p: detail.realOdds.impliedHome },
                      { k: "N", label: "Nul", o: detail.realOdds.draw, p: detail.realOdds.impliedDraw },
                      { k: "2", label: "Extérieur", o: detail.realOdds.away, p: detail.realOdds.impliedAway },
                    ].map((c) => (
                      <div key={c.k} className="rounded-lg bg-primary/5 border border-primary/30 p-2 text-center">
                        <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                          {c.label}
                        </div>
                        <div className="text-base font-display font-black holo-text mt-0.5">
                          {c.o ? c.o.toFixed(2) : "—"}
                        </div>
                        {c.p != null && (
                          <div className="text-[8px] font-bold text-primary/80 mt-0.5">
                            {Math.round(c.p)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {detail.realOdds.bookmakers.length > 0 && (
                    <p className="mt-2 text-[8px] text-muted-foreground italic truncate">
                      Médiane sur {detail.realOdds.bookmakers.length} bookmakers : {detail.realOdds.bookmakers.slice(0, 4).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {!detail.realOdds && (
                <div className="glass rounded-xl p-3 border border-dashed border-border">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    <Sparkles size={10} className="text-primary" /> Cotes réelles
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Active une clé The Odds API gratuite dans les Réglages pour afficher les vraies cotes bookmakers (1X2, médiane EU).
                  </p>
                </div>
              )}

              {/* Forme récente */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { who: detail.teamA, form: homeForm },
                  { who: detail.teamB, form: awayForm },
                ].map((side) => (
                  <div key={side.who} className="glass rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      <Trophy size={10} /> Forme · 5 derniers
                    </div>
                    {loadingDetail && !side.form ? (
                      <p className="text-[9px] text-muted-foreground italic">Chargement...</p>
                    ) : side.form?.form.length ? (
                      <>
                        <div className="flex gap-1 mb-2">
                          {side.form.form.map((r, i) => (
                            <FormBadge key={i} r={r} />
                          ))}
                        </div>
                        <p className="text-[9px] text-muted-foreground font-bold">
                          Buts · {side.form.goalsFor} <span className="opacity-60">/</span>{" "}
                          {side.form.goalsAgainst}
                        </p>
                      </>
                    ) : (
                      <p className="text-[9px] text-muted-foreground italic">Pas de données</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Enjeux du match */}
              <MotivationBadge home={detail.teamA} away={detail.teamB} league={detail.league} />

              {/* Météo au coup d'envoi */}
              <WeatherCard venue={detail.venue || homeForm?.meta.stadium} utcDate={detail.utcDate} />

              {/* Radar comparatif des équipes */}
              {(homeForm?.lastEvents.length || awayForm?.lastEvents.length) ? (
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    <Activity size={10} /> Radar comparatif
                  </div>
                  <TeamRadar
                    homeName={detail.teamA}
                    awayName={detail.teamB}
                    homeEvents={homeForm?.lastEvents ?? []}
                    awayEvents={awayForm?.lastEvents ?? []}
                  />
                </div>
              ) : null}

              {/* Heatmap des buts */}
              {(homeForm?.lastEvents.length || awayForm?.lastEvents.length) ? (
                <div className="glass rounded-xl p-3 space-y-3">
                  {homeForm?.lastEvents.length ? (
                    <GoalsHeatmap team={detail.teamA} events={homeForm.lastEvents} />
                  ) : null}
                  {awayForm?.lastEvents.length ? (
                    <GoalsHeatmap team={detail.teamB} events={awayForm.lastEvents} />
                  ) : null}
                </div>
              ) : null}
              <div className="glass rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  <HistoryIcon size={10} /> Confrontations directes
                </div>
                {loadingDetail && !h2h ? (
                  <p className="text-[9px] text-muted-foreground italic">Chargement...</p>
                ) : h2h && h2h.total > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div className="rounded-md bg-primary/10 border border-primary/30 p-1.5 text-center">
                        <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                          {detail.teamA.split(" ")[0]}
                        </div>
                        <div className="text-sm font-display font-black holo-text">
                          {h2h.homeWins}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/40 border border-border p-1.5 text-center">
                        <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                          Nuls
                        </div>
                        <div className="text-sm font-display font-black text-muted-foreground">
                          {h2h.draws}
                        </div>
                      </div>
                      <div className="rounded-md bg-primary/10 border border-primary/30 p-1.5 text-center">
                        <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                          {detail.teamB.split(" ")[0]}
                        </div>
                        <div className="text-sm font-display font-black holo-text">
                          {h2h.awayWins}
                        </div>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground font-bold">
                      {h2h.total} confrontation{h2h.total > 1 ? "s" : ""} analysée{h2h.total > 1 ? "s" : ""}
                    </p>
                    {h2h.recent.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {h2h.recent.slice(0, 3).map((e) => (
                          <div
                            key={e.idEvent}
                            className="flex items-center justify-between text-[9px] py-0.5 border-t border-border/30 pt-1"
                          >
                            <span className="text-muted-foreground truncate flex-1">
                              {e.dateEvent}
                            </span>
                            <span className="font-bold text-foreground truncate flex-[2]">
                              {e.strHomeTeam} <span className="holo-text font-display font-black">{e.intHomeScore}-{e.intAwayScore}</span> {e.strAwayTeam}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[9px] text-muted-foreground italic">
                    Aucune confrontation directe trouvée
                  </p>
                )}
              </div>

              {/* Description / club info */}
              {(homeForm?.meta.founded || awayForm?.meta.founded) && (
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    <Building2 size={10} /> Fiche clubs
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[9px]">
                    {[homeForm?.meta, awayForm?.meta].map((m, i) => (
                      <div key={i} className="space-y-0.5">
                        <p className="font-black text-foreground truncate">
                          {m?.name}
                        </p>
                        {m?.founded && (
                          <p className="text-muted-foreground">Fondé · {m.founded}</p>
                        )}
                        {m?.stadium && (
                          <p className="text-muted-foreground truncate">{m.stadium}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  onAddMatch(detail);
                  setDetail(null);
                }}
                className="tap w-full py-3 rounded-xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-[0.2em] text-[10.5px] flex items-center justify-center gap-2 shadow-holo"
              >
                <PlusCircle size={14} />
                Sélectionner ce match
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
