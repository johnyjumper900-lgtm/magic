/**
 * Team metadata helpers — enriches matches with country, kit (jersey),
 * stadium and recent form using TheSportsDB v1.
 *
 * Cached in-memory + localStorage to limit API calls.
 */

import { TheSportsDB } from "./thesportsdb";

export interface TeamMeta {
  id?: string;
  name: string;
  badge?: string;
  /** Jersey / kit image URL (TheSportsDB strKitDetails or strTeamJersey) */
  kit?: string;
  country?: string;
  /** ISO 3166-1 alpha-2 (lowercase) for flag rendering */
  countryCode?: string;
  stadium?: string;
  founded?: string;
  website?: string;
  description?: string;
}

/* ---------- country code map (FR-friendly) ---------- */

const COUNTRY_TO_CODE: Record<string, string> = {
  france: "fr",
  england: "gb-eng",
  "great britain": "gb",
  scotland: "gb-sct",
  wales: "gb-wls",
  spain: "es",
  germany: "de",
  italy: "it",
  portugal: "pt",
  netherlands: "nl",
  belgium: "be",
  brazil: "br",
  argentina: "ar",
  "united states": "us",
  usa: "us",
  mexico: "mx",
  japan: "jp",
  "south korea": "kr",
  korea: "kr",
  saudi: "sa",
  "saudi arabia": "sa",
  qatar: "qa",
  uae: "ae",
  "united arab emirates": "ae",
  turkey: "tr",
  greece: "gr",
  switzerland: "ch",
  austria: "at",
  denmark: "dk",
  sweden: "se",
  norway: "no",
  finland: "fi",
  poland: "pl",
  russia: "ru",
  ukraine: "ua",
  croatia: "hr",
  serbia: "rs",
  romania: "ro",
  czech: "cz",
  "czech republic": "cz",
  hungary: "hu",
  morocco: "ma",
  algeria: "dz",
  tunisia: "tn",
  egypt: "eg",
  senegal: "sn",
  "ivory coast": "ci",
  cameroon: "cm",
  nigeria: "ng",
  ghana: "gh",
  australia: "au",
  canada: "ca",
  uruguay: "uy",
  chile: "cl",
  colombia: "co",
  peru: "pe",
  ecuador: "ec",
  paraguay: "py",
  bolivia: "bo",
  venezuela: "ve",
  ireland: "ie",
  "northern ireland": "gb-nir",
  iceland: "is",
};

export function countryToCode(country?: string): string | undefined {
  if (!country) return undefined;
  return COUNTRY_TO_CODE[country.trim().toLowerCase()];
}

/* ---------- caching ---------- */

const MEM = new Map<string, TeamMeta>();
const LS_KEY = "magic.teamMeta.v1";

function loadCache(): Record<string, TeamMeta> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TeamMeta>) : {};
  } catch {
    return {};
  }
}

function saveCache(map: Record<string, TeamMeta>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* quota exceeded — ignore */
  }
}

let _disk: Record<string, TeamMeta> | null = null;
function disk(): Record<string, TeamMeta> {
  if (_disk) return _disk;
  if (typeof window === "undefined") return (_disk = {});
  _disk = loadCache();
  return _disk;
}

function persist(name: string, meta: TeamMeta) {
  MEM.set(name.toLowerCase(), meta);
  if (typeof window === "undefined") return;
  const d = disk();
  d[name.toLowerCase()] = meta;
  saveCache(d);
}

/* ---------- main fetcher ---------- */

interface SDBTeamRaw {
  idTeam?: string;
  strTeam?: string;
  strBadge?: string;
  strTeamBadge?: string;
  strTeamJersey?: string;
  strKitDetails?: string;
  strKitColours?: string;
  strCountry?: string;
  strStadium?: string;
  intFormedYear?: string;
  strWebsite?: string;
  strDescriptionEN?: string;
  strDescriptionFR?: string;
}

export async function fetchTeamMeta(name: string): Promise<TeamMeta> {
  if (!name) return { name };
  const key = name.toLowerCase();
  if (MEM.has(key)) return MEM.get(key)!;
  const d = disk();
  if (d[key]) {
    MEM.set(key, d[key]);
    return d[key];
  }
  try {
    const json = await TheSportsDB.searchTeams(name);
    const teams: SDBTeamRaw[] = json?.teams ?? [];
    const t = teams[0];
    if (!t) {
      const empty: TeamMeta = { name };
      persist(name, empty);
      return empty;
    }
    const meta: TeamMeta = {
      id: t.idTeam,
      name: t.strTeam || name,
      badge: t.strBadge || t.strTeamBadge,
      kit: t.strTeamJersey || undefined,
      country: t.strCountry || undefined,
      countryCode: countryToCode(t.strCountry),
      stadium: t.strStadium || undefined,
      founded: t.intFormedYear || undefined,
      website: t.strWebsite || undefined,
      description: t.strDescriptionFR || t.strDescriptionEN || undefined,
    };
    persist(name, meta);
    return meta;
  } catch {
    const fallback: TeamMeta = { name };
    persist(name, fallback);
    return fallback;
  }
}

/** Pre-fetch a list of names in parallel (with concurrency cap). */
export async function fetchTeamMetas(
  names: string[],
  concurrency = 4,
): Promise<Map<string, TeamMeta>> {
  const out = new Map<string, TeamMeta>();
  const queue = [...new Set(names.filter(Boolean))];
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const idx = i++;
      const n = queue[idx];
      const m = await fetchTeamMeta(n);
      out.set(n.toLowerCase(), m);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}
