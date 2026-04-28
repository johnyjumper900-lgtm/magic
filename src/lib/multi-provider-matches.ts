/**
 * Multi-provider match aggregator — récupère automatiquement tous les matchs
 * de football disponibles sur les 30 prochains jours, en interrogeant en
 * parallèle toutes les API dont la clé utilisateur est valide.
 *
 * Fournisseurs interrogés (hors rotation RapidAPI) :
 *  - TheSportsDB v1 (clé de test "3" ou clé premium localStorage)
 *  - Football-Data.org  (header X-Auth-Token)
 *  - API-Sports / API-Football v3 (header x-apisports-key)
 *  - The Odds API (apiKey query param) — sert aussi de source de cotes réelles
 *
 * Les résultats sont dédupliqués (même équipe domicile/extérieur à la même
 * date Paris), enrichis avec les cotes réelles The Odds API si dispo, puis
 * triés (matchs avec cotes d'abord, puis chronologique).
 */

import type { CalendarMatch } from "@/types/magic";
import { getUserApiKeys } from "./user-api-keys";
// TheSportsDB désactivé du pipeline multi-provider (CORS/échecs en lot 30j).
// On garde l'import du module ailleurs (auto-résolution tickets) mais plus ici.
import {
  fetchAllSoccerOdds,
  matchEvent,
  aggregateOdds,
  utcToParisDate,
  utcToParisHHMM,
  type OddsApiEvent,
  type RealOdds,
} from "./odds-api";
import { countryToCode } from "./team-meta";

export interface EnrichedMatch extends CalendarMatch {
  realOdds?: RealOdds;
  parisDate?: string;
  parisTime?: string;
  /** Provider de provenance — utile pour le debug/UI */
  source?: string;
}

/* ------------------------------------------------------------------ */
/*                         petits helpers                              */
/* ------------------------------------------------------------------ */

function normTeam(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(fc|cf|sc|ac|afc|ssc|club|sporting)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKey(m: EnrichedMatch): string {
  return `${m.parisDate || m.date}|${normTeam(m.teamA)}|${normTeam(m.teamB)}`;
}

function isoToParisPair(iso?: string, fallbackDate?: string, fallbackTime?: string) {
  if (iso) {
    return { date: utcToParisDate(iso), time: utcToParisHHMM(iso) };
  }
  return { date: fallbackDate || "", time: fallbackTime || "—" };
}

function buildDayList(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*                  RapidAPI — free-api-live-football-data             */
/* ------------------------------------------------------------------ */

interface RapidMatch {
  id?: number | string;
  time?: string; // "HH:MM"
  status?: { utcTime?: string; finished?: boolean; started?: boolean };
  home?: { id?: number; name?: string; longName?: string; logo?: string };
  away?: { id?: number; name?: string; longName?: string; logo?: string };
  tournament?: { name?: string; leagueName?: string; ccode?: string };
}

interface RapidLeagueGroup {
  ccode?: string;
  name?: string;
  matches?: RapidMatch[];
}

interface RapidByDateResp {
  status?: string;
  response?: { matches?: Array<{ league?: RapidLeagueGroup; matches?: RapidMatch[] }> | RapidLeagueGroup[] };
}

async function fetchRapidApiByDate(key: string, day: string): Promise<EnrichedMatch[]> {
  // day = YYYY-MM-DD → endpoint attend YYYYMMDD
  const yyyymmdd = day.replace(/-/g, "");
  try {
    const r = await fetch(
      `https://free-api-live-football-data.p.rapidapi.com/football-get-matches-by-date?date=${yyyymmdd}`,
      {
        headers: {
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": "free-api-live-football-data.p.rapidapi.com",
        },
      },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as RapidByDateResp;
    const groups = (j?.response?.matches ?? []) as Array<RapidLeagueGroup | { league?: RapidLeagueGroup; matches?: RapidMatch[] }>;
    const out: EnrichedMatch[] = [];
    for (const g of groups) {
      // Deux schémas possibles selon endpoints
      const leagueInfo: RapidLeagueGroup =
        ("league" in g && g.league) ? g.league : (g as RapidLeagueGroup);
      const list: RapidMatch[] =
        ("matches" in g && g.matches) ? g.matches as RapidMatch[] : ((g as RapidLeagueGroup).matches ?? []);
      for (const m of list) {
        const iso = m.status?.utcTime || (m.time ? `${day}T${m.time}:00Z` : undefined);
        const { date, time } = isoToParisPair(iso, day, m.time);
        const home = m.home?.name || m.home?.longName;
        const away = m.away?.name || m.away?.longName;
        if (!home || !away) continue;
        out.push({
          id: `rapid-${m.id ?? `${home}-${away}-${day}`}`,
          teamA: home,
          teamB: away,
          teamALogo: m.home?.logo,
          teamBLogo: m.away?.logo,
          date,
          time,
          league: leagueInfo?.name || m.tournament?.name || m.tournament?.leagueName || "—",
          countryCode: (leagueInfo?.ccode || m.tournament?.ccode || "").toLowerCase() || undefined,
          utcDate: iso,
          status: m.status?.finished ? "FINISHED" : m.status?.started ? "LIVE" : "SCHEDULED",
          parisDate: date,
          parisTime: time,
          source: "RapidAPI",
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchRapidApiRange(key: string, days: string[]): Promise<EnrichedMatch[]> {
  // limite à 7 jours pour rester dans les quotas free
  const sample = days.filter((_, i) => i < 7);
  const out: EnrichedMatch[] = [];
  for (const d of sample) {
    const list = await fetchRapidApiByDate(key, d);
    out.push(...list);
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*                    Football-Data.org (range)                        */
/* ------------------------------------------------------------------ */

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  competition: { name: string; emblem?: string; area?: { code?: string; flag?: string } };
  homeTeam: { name: string; crest?: string };
  awayTeam: { name: string; crest?: string };
}

async function fetchFootballData(key: string, from: string, to: string): Promise<EnrichedMatch[]> {
  try {
    const url = `https://api.football-data.org/v4/matches?dateFrom=${from}&dateTo=${to}`;
    const r = await fetch(url, { headers: { "X-Auth-Token": key } });
    if (!r.ok) return [];
    const j = (await r.json()) as { matches?: FDMatch[] };
    const out: EnrichedMatch[] = [];
    for (const m of j.matches ?? []) {
      const { date, time } = isoToParisPair(m.utcDate);
      out.push({
        id: `fd-${m.id}`,
        teamA: m.homeTeam.name,
        teamB: m.awayTeam.name,
        teamALogo: m.homeTeam.crest,
        teamBLogo: m.awayTeam.crest,
        date,
        time,
        league: m.competition?.name || "—",
        leagueEmblem: m.competition?.emblem,
        countryFlag: m.competition?.area?.flag,
        countryCode: m.competition?.area?.code?.toLowerCase(),
        utcDate: m.utcDate,
        status: m.status,
        parisDate: date,
        parisTime: time,
        source: "Football-Data",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*                  API-Sports / API-Football (range)                  */
/* ------------------------------------------------------------------ */

interface APSFixture {
  fixture: { id: number; date: string; status: { short?: string; long?: string }; venue?: { name?: string } };
  league: { name: string; logo?: string; country?: string; flag?: string };
  teams: { home: { name: string; logo?: string }; away: { name: string; logo?: string } };
}

async function fetchApiSportsRange(key: string, days: string[]): Promise<EnrichedMatch[]> {
  // API-Sports free ≈ 100 req/jour → on interroge par semaine (≈ 4-5 req)
  // via `fixtures?date=YYYY-MM-DD` qui est l'endpoint le plus fiable free-tier.
  const out: EnrichedMatch[] = [];
  // limite à 7 requêtes max pour économiser le quota free
  const sample = days.filter((_, i) => i < 7);
  for (const d of sample) {
    try {
      const r = await fetch(`https://v3.football.api-sports.io/fixtures?date=${d}`, {
        headers: { "x-apisports-key": key },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { response?: APSFixture[]; errors?: unknown };
      const arr = j.response ?? [];
      for (const f of arr) {
        const { date, time } = isoToParisPair(f.fixture.date);
        out.push({
          id: `aps-${f.fixture.id}`,
          teamA: f.teams.home.name,
          teamB: f.teams.away.name,
          teamALogo: f.teams.home.logo,
          teamBLogo: f.teams.away.logo,
          date,
          time,
          league: f.league.name,
          leagueEmblem: f.league.logo,
          countryFlag: f.league.flag,
          countryCode: countryToCode(f.league.country),
          utcDate: f.fixture.date,
          venue: f.fixture.venue?.name,
          status: f.fixture.status.long || f.fixture.status.short,
          parisDate: date,
          parisTime: time,
          source: "API-Sports",
        });
      }
    } catch {
      /* noop */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*                    The Odds API (upcoming global)                   */
/* ------------------------------------------------------------------ */

function oddsEventsToMatches(events: OddsApiEvent[]): EnrichedMatch[] {
  return events.map((e) => {
    const { date, time } = isoToParisPair(e.commence_time);
    const real = aggregateOdds(e);
    return {
      id: `odds-${e.id}`,
      teamA: e.home_team,
      teamB: e.away_team,
      date,
      time,
      league: e.sport_title || "—",
      utcDate: e.commence_time,
      status: "SCHEDULED",
      realOdds: real,
      parisDate: date,
      parisTime: time,
      source: "The Odds API",
    } as EnrichedMatch;
  });
}

/* ------------------------------------------------------------------ */
/*                        Agrégation principale                        */
/* ------------------------------------------------------------------ */

export interface AggregateResult {
  matches: EnrichedMatch[];
  providersUsed: string[];
  providersFailed: string[];
  counts: Record<string, number>;
}

export async function fetchAllMatchesMultiProvider(
  daysAhead = 30,
): Promise<AggregateResult> {
  const days = buildDayList(daysAhead);
  const from = days[0];
  const to = days[days.length - 1];
  const keys = getUserApiKeys();

  const tasks: Array<Promise<{ name: string; list: EnrichedMatch[] }>> = [];

  // Football-Data.org
  if (keys.footballData) {
    tasks.push(
      fetchFootballData(keys.footballData, from, to).then((list) => ({
        name: "Football-Data",
        list,
      })),
    );
  }

  // API-Sports / API-Football
  if (keys.apiSports) {
    tasks.push(
      fetchApiSportsRange(keys.apiSports, days).then((list) => ({
        name: "API-Sports",
        list,
      })),
    );
  }

  // The Odds API (sert aussi de provider de matchs)
  let oddsEvents: OddsApiEvent[] = [];
  if (keys.odds) {
    tasks.push(
      fetchAllSoccerOdds().then((events) => {
        oddsEvents = events;
        return { name: "The Odds API", list: oddsEventsToMatches(events) };
      }),
    );
  }

  // RapidAPI — free-api-live-football-data
  if (keys.rapidApi) {
    tasks.push(
      fetchRapidApiRange(keys.rapidApi, days).then((list) => ({
        name: "RapidAPI",
        list,
      })),
    );
  }

  const settled = await Promise.allSettled(tasks);

  const providersUsed: string[] = [];
  const providersFailed: string[] = [];
  const counts: Record<string, number> = {};
  const buckets: EnrichedMatch[][] = [];

  settled.forEach((s) => {
    if (s.status === "fulfilled") {
      const { name, list } = s.value;
      providersUsed.push(name);
      counts[name] = list.length;
      buckets.push(list);
    } else {
      providersFailed.push("unknown");
    }
  });

  // Fusion + dédup (garde la 1re occurrence, mais préfère celle avec cote réelle)
  const byKey = new Map<string, EnrichedMatch>();
  buckets.flat().forEach((m) => {
    if (!m.teamA || !m.teamB) return;
    // Injecte la cote réelle si on trouve un match correspondant
    if (!m.realOdds && oddsEvents.length) {
      const found = matchEvent(oddsEvents, m.teamA, m.teamB);
      if (found) m.realOdds = aggregateOdds(found);
    }
    const k = dedupeKey(m);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, m);
    } else {
      // préfère la version la plus riche (logos + cotes)
      const score = (x: EnrichedMatch) =>
        (x.realOdds ? 4 : 0) +
        (x.teamALogo ? 1 : 0) +
        (x.teamBLogo ? 1 : 0) +
        (x.leagueEmblem ? 1 : 0);
      if (score(m) > score(prev)) byKey.set(k, { ...prev, ...m });
    }
  });

  const all = [...byKey.values()].sort((a, b) => {
    if (!!b.realOdds !== !!a.realOdds) return b.realOdds ? 1 : -1;
    return (a.utcDate || "").localeCompare(b.utcDate || "");
  });

  // Limite raisonnable pour le rendu (~1200 matchs sur 30j suffit largement)
  return {
    matches: all.slice(0, 1200),
    providersUsed,
    providersFailed,
    counts,
  };
}
