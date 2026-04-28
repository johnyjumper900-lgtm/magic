/**
 * The Odds API client (https://the-odds-api.com).
 *
 * Provides REAL bookmaker odds and precise UTC commence times for football.
 * The user pastes their free API key in Settings → it's stored under
 * `magic.oddsApi.key` in localStorage and read here.
 *
 * If no key is provided we silently fall back to undefined → caller will
 * keep its existing simulated odds.
 */

const BASE = "https://api.the-odds-api.com/v4";

export type OddsApiBookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets: Array<{
    key: string; // 'h2h', 'totals', 'spreads'
    outcomes: Array<{ name: string; price: number; point?: number }>;
  }>;
};

export type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string; // ISO UTC
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

export interface RealOdds {
  /** Median odds for home / draw / away from all available bookmakers */
  home?: number;
  draw?: number;
  away?: number;
  /** Single best (highest) odd per outcome */
  bestHome?: number;
  bestDraw?: number;
  bestAway?: number;
  /** Bookmakers used */
  bookmakers: string[];
  /** ISO UTC commence time as returned by the API */
  commenceTimeUTC?: string;
  /** Implied probabilities derived from the median odds (sum normalized) */
  impliedHome?: number;
  impliedDraw?: number;
  impliedAway?: number;
}

const SOCCER_KEYS = [
  // Europe majeures
  "soccer_france_ligue_one",
  "soccer_france_ligue_two",
  "soccer_epl",
  "soccer_efl_champ",
  "soccer_spain_la_liga",
  "soccer_spain_segunda_division",
  "soccer_germany_bundesliga",
  "soccer_germany_bundesliga2",
  "soccer_italy_serie_a",
  "soccer_italy_serie_b",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_uefa_europa_conference_league",
  "soccer_uefa_nations_league",
  "soccer_uefa_european_championship",
  "soccer_portugal_primeira_liga",
  "soccer_netherlands_eredivisie",
  "soccer_belgium_first_div",
  "soccer_turkey_super_league",
  "soccer_greece_super_league",
  "soccer_switzerland_superleague",
  "soccer_austria_bundesliga",
  "soccer_denmark_superliga",
  "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien",
  // Amériques
  "soccer_conmebol_copa_libertadores",
  "soccer_conmebol_copa_sudamericana",
  "soccer_copa_america",
  "soccer_brazil_campeonato",
  "soccer_brazil_serie_b",
  "soccer_argentina_primera_division",
  "soccer_chile_campeonato",
  "soccer_mexico_ligamx",
  "soccer_usa_mls",
  // Asie / Afrique / Monde
  "soccer_japan_j_league",
  "soccer_korea_kleague1",
  "soccer_china_superleague",
  "soccer_australia_aleague",
  "soccer_saudi_professional_league",
  "soccer_africa_cup_of_nations",
  "soccer_fifa_world_cup",
  "soccer_fifa_club_world_cup",
  "soccer_fifa_world_cup_qualifiers_europe",
];

export function getOddsApiKey(): string | null {
  try {
    return (
      localStorage.getItem("magic.oddsApi.key") ||
      localStorage.getItem("magic_user_odds_key") ||
      null
    );
  } catch {
    return null;
  }
}

export function setOddsApiKey(k: string) {
  try {
    if (k) localStorage.setItem("magic.oddsApi.key", k);
    else localStorage.removeItem("magic.oddsApi.key");
  } catch {
    /* noop */
  }
}

export function hasOddsApiKey(): boolean {
  return !!getOddsApiKey();
}

function median(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function aggregateOdds(ev: OddsApiEvent): RealOdds {
  const home: number[] = [];
  const draw: number[] = [];
  const away: number[] = [];
  const books: string[] = [];
  for (const bk of ev.bookmakers) {
    const h2h = bk.markets.find((m) => m.key === "h2h");
    if (!h2h) continue;
    let pushed = false;
    for (const o of h2h.outcomes) {
      if (o.name === ev.home_team) {
        home.push(o.price);
        pushed = true;
      } else if (o.name === ev.away_team) {
        away.push(o.price);
        pushed = true;
      } else if (/draw|nul/i.test(o.name)) {
        draw.push(o.price);
        pushed = true;
      }
    }
    if (pushed) books.push(bk.title);
  }
  const mh = median(home);
  const md = median(draw);
  const ma = median(away);
  let impliedHome: number | undefined;
  let impliedDraw: number | undefined;
  let impliedAway: number | undefined;
  if (mh && md && ma) {
    const ih = 1 / mh;
    const id = 1 / md;
    const ia = 1 / ma;
    const sum = ih + id + ia;
    impliedHome = (ih / sum) * 100;
    impliedDraw = (id / sum) * 100;
    impliedAway = (ia / sum) * 100;
  }
  return {
    home: mh,
    draw: md,
    away: ma,
    bestHome: home.length ? Math.max(...home) : undefined,
    bestDraw: draw.length ? Math.max(...draw) : undefined,
    bestAway: away.length ? Math.max(...away) : undefined,
    bookmakers: [...new Set(books)],
    commenceTimeUTC: ev.commence_time,
    impliedHome,
    impliedDraw,
    impliedAway,
  };
}

/* ---------- caching ---------- */

const CACHE = new Map<string, { ts: number; events: OddsApiEvent[] }>();
const TTL_MS = 5 * 60 * 1000;

async function fetchSport(sport: string, key: string): Promise<OddsApiEvent[]> {
  const cached = CACHE.get(sport);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.events;
  const url = `${BASE}/sports/${sport}/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${encodeURIComponent(key)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = (await r.json()) as OddsApiEvent[];
    CACHE.set(sport, { ts: Date.now(), events: data });
    return data;
  } catch {
    return [];
  }
}

/** Fetch upcoming odds across all major football leagues. */
export async function fetchAllSoccerOdds(): Promise<OddsApiEvent[]> {
  const key = getOddsApiKey();
  if (!key) return [];
  const lists = await Promise.all(SOCCER_KEYS.map((s) => fetchSport(s, key)));
  return lists.flat();
}

/* ---------- matching helper ---------- */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(fc|cf|sc|ac|afc|ssc|club|sporting|olympique)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Try to find an OddsApi event matching a (home, away) pair. */
export function matchEvent(
  events: OddsApiEvent[],
  home: string,
  away: string,
): OddsApiEvent | undefined {
  const h = norm(home);
  const a = norm(away);
  return events.find((e) => {
    const eh = norm(e.home_team);
    const ea = norm(e.away_team);
    return (
      (eh.includes(h) || h.includes(eh)) && (ea.includes(a) || a.includes(ea))
    );
  });
}

/* ---------- date helpers ---------- */

/** Convert ISO UTC → "HH:mm" in Europe/Paris */
export function utcToParisHHMM(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Convert ISO UTC → "YYYY-MM-DD" in Europe/Paris */
export function utcToParisDate(iso: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** "samedi 27 avril · 21h00" */
export function utcToParisLong(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const time = d
      .toLocaleTimeString("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(":", "h");
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}
