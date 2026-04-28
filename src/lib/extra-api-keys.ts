/**
 * Extra football API keys — user can add as many as they want.
 * - Provider auto-detection from the key shape
 * - Live verification against the provider's public "status"/"me" endpoints
 * - Stored in localStorage, re-routed to existing UserApiKeys when possible so
 *   the rest of the app (edge functions, odds) keeps using them seamlessly.
 */

import { setUserApiKey } from "./user-api-keys";

export type ExtraProvider =
  | "apiFootball"
  | "footballData"
  | "theOddsApi"
  | "theSportsDB"
  | "rapidApi"
  | "rapidApiFreeFootball"
  | "sportmonks"
  | "apiSports"
  | "unknown";

export interface ExtraProviderInfo {
  label: string;
  hint: string;
  /** Regex / heuristic to auto-detect a key of this provider */
  detect: (k: string) => boolean;
  /** Map to an existing UserApiKeys slot so the app keeps working */
  userKeySlot?:
    | "rapidApi"
    | "footballData"
    | "odds"
    | "apiSports"
    | "gemini";
}

export const EXTRA_PROVIDERS: Record<ExtraProvider, ExtraProviderInfo> = {
  apiFootball: {
    label: "API-Football",
    hint: "api-football.com (32-char hex)",
    detect: (k) => /^[a-f0-9]{32}$/i.test(k),
    userKeySlot: "apiSports",
  },
  apiSports: {
    label: "API-Sports",
    hint: "api-sports.io",
    detect: (k) => /^[a-f0-9]{30,40}$/i.test(k),
    userKeySlot: "apiSports",
  },
  footballData: {
    label: "Football-Data.org",
    hint: "football-data.org (32-char)",
    detect: (k) => /^[a-z0-9]{32}$/i.test(k) && !/^[a-f0-9]{32}$/i.test(k),
    userKeySlot: "footballData",
  },
  theOddsApi: {
    label: "The Odds API",
    hint: "the-odds-api.com (32-char)",
    detect: (k) => /^[a-f0-9]{32}$/i.test(k),
    userKeySlot: "odds",
  },
  theSportsDB: {
    label: "TheSportsDB",
    hint: "thesportsdb.com (numeric)",
    detect: (k) => /^\d{5,10}$/.test(k),
  },
  rapidApi: {
    label: "RapidAPI",
    hint: "rapidapi.com (50+ chars base64)",
    detect: (k) => k.length >= 48 && /^[A-Za-z0-9]+/.test(k) && !/^[a-f0-9]{32}$/i.test(k),
    userKeySlot: "rapidApi",
  },
  rapidApiFreeFootball: {
    label: "RapidAPI · Free Football Live",
    hint: "free-api-live-football-data (RapidAPI)",
    detect: (k) => /^[A-Za-z0-9]{45,60}$/.test(k) && k.includes("msh"),
    userKeySlot: "rapidApi",
  },
  sportmonks: {
    label: "Sportmonks",
    hint: "sportmonks.com (60+ chars)",
    detect: (k) => k.length >= 60 && /^[A-Za-z0-9]+$/.test(k),
  },
  unknown: {
    label: "Autre",
    hint: "Provider inconnu",
    detect: () => false,
  },
};

export interface ExtraApiKey {
  id: string;
  provider: ExtraProvider;
  label: string;
  key: string;
  addedAt: number;
  valid: boolean;
  message?: string;
}

const STORAGE_KEY = "magic.extraApiKeys";
const SEEDED_FLAG = "magic.extraApiKeys.seeded.v1";

/**
 * Clé RapidAPI "Free API Live Football Data" vérifiée et fournie par défaut.
 * Pré-remplie automatiquement au premier lancement, avec badge vert dans Réglages.
 */
const DEFAULT_SEEDED_KEYS: ExtraApiKey[] = [
  {
    id: "seed-rapidapi-free-football-v1",
    provider: "rapidApiFreeFootball",
    label: EXTRA_PROVIDERS.rapidApiFreeFootball.label,
    key: "9a91c11d76msh91463a21e197358p197679jsn44a8f49495ec",
    addedAt: Date.now(),
    valid: true,
    message: "Clé par défaut vérifiée ✓",
  },
];

function seedDefaultsIfNeeded() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(SEEDED_FLAG)) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: ExtraApiKey[] = raw ? JSON.parse(raw) : [];
    const toAdd = DEFAULT_SEEDED_KEYS.filter(
      (s) => !existing.some((e) => e.key === s.key),
    );
    const merged = [...toAdd, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    localStorage.setItem(SEEDED_FLAG, "1");
    syncToUserKeys(merged);
  } catch {
    /* noop */
  }
}

export function getExtraKeys(): ExtraApiKey[] {
  seedDefaultsIfNeeded();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ExtraApiKey[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: ExtraApiKey[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
  // Keep the "main" slots in sync so existing code paths work.
  syncToUserKeys(list);
}

function syncToUserKeys(list: ExtraApiKey[]) {
  // For each slot, take the latest VALID key; fall back to the latest key.
  const bySlot = new Map<string, ExtraApiKey>();
  for (const e of list) {
    const slot = EXTRA_PROVIDERS[e.provider]?.userKeySlot;
    if (!slot) continue;
    const prev = bySlot.get(slot);
    if (!prev) bySlot.set(slot, e);
    else if (!prev.valid && e.valid) bySlot.set(slot, e);
    else if (prev.valid === e.valid && e.addedAt > prev.addedAt) bySlot.set(slot, e);
  }
  bySlot.forEach((entry, slot) => {
    setUserApiKey(slot as "rapidApi" | "footballData" | "odds" | "apiSports" | "gemini", entry.key);
  });
}

export function addExtraKey(entry: ExtraApiKey): ExtraApiKey[] {
  const list = getExtraKeys();
  // Avoid storing the same key twice for the same provider
  const filtered = list.filter(
    (e) => !(e.provider === entry.provider && e.key === entry.key),
  );
  const next = [entry, ...filtered];
  saveAll(next);
  return next;
}

export function removeExtraKey(id: string): ExtraApiKey[] {
  const next = getExtraKeys().filter((e) => e.id !== id);
  saveAll(next);
  return next;
}

/** Best-effort provider detection from the key shape alone. */
export function detectProvider(key: string): ExtraProvider {
  const k = key.trim();
  // Order matters: most specific first
  const order: ExtraProvider[] = [
    "theSportsDB",
    "sportmonks",
    "rapidApiFreeFootball",
    "rapidApi",
    "apiFootball",
    "apiSports",
    "footballData",
    "theOddsApi",
  ];
  for (const p of order) {
    if (EXTRA_PROVIDERS[p].detect(k)) return p;
  }
  return "unknown";
}

export interface VerifyResult {
  valid: boolean;
  message: string;
}

/** Hit each provider's cheapest "status" or "me" endpoint to verify the key. */
export async function verifyKey(
  provider: ExtraProvider,
  key: string,
): Promise<VerifyResult> {
  try {
    switch (provider) {
      case "theOddsApi": {
        const r = await fetch(
          `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(key)}`,
        );
        if (r.ok) return { valid: true, message: "Odds API OK" };
        return { valid: false, message: `HTTP ${r.status}` };
      }
      case "footballData": {
        const r = await fetch("https://api.football-data.org/v4/competitions", {
          headers: { "X-Auth-Token": key },
        });
        if (r.ok) return { valid: true, message: "Football-Data OK" };
        return { valid: false, message: `HTTP ${r.status}` };
      }
      case "apiFootball":
      case "apiSports": {
        const r = await fetch("https://v3.football.api-sports.io/status", {
          headers: { "x-apisports-key": key },
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          const errs = Array.isArray(j.errors) ? j.errors : [];
          if (errs.length === 0) return { valid: true, message: "API-Sports OK" };
          return { valid: false, message: errs[0]?.token || "Clé refusée" };
        }
        return { valid: false, message: `HTTP ${r.status}` };
      }
      case "rapidApi": {
        // Noyau foot : on ne dépend plus d'api-football-v1 (supprimé).
        // On vérifie via Free Football Live qui est l'API RapidAPI officielle du projet.
        const r = await fetch(
          "https://free-api-live-football-data.p.rapidapi.com/football-players-search?search=m",
          {
            headers: {
              "X-RapidAPI-Key": key,
              "X-RapidAPI-Host": "free-api-live-football-data.p.rapidapi.com",
            },
          },
        );
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j?.status === "success")
            return { valid: true, message: "RapidAPI OK" };
          return { valid: false, message: "Réponse invalide" };
        }
        return { valid: false, message: `HTTP ${r.status}` };
      }
      case "rapidApiFreeFootball": {
        const r = await fetch(
          "https://free-api-live-football-data.p.rapidapi.com/football-players-search?search=m",
          {
            headers: {
              "X-RapidAPI-Key": key,
              "X-RapidAPI-Host": "free-api-live-football-data.p.rapidapi.com",
            },
          },
        );
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j?.status === "success")
            return { valid: true, message: "Free Football Live OK" };
          return { valid: false, message: "Réponse invalide" };
        }
        return { valid: false, message: `HTTP ${r.status}` };
      }
      case "theSportsDB": {
        const r = await fetch(
          `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/all_leagues.php`,
        );
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j && (j.leagues || j.countries))
            return { valid: true, message: "TheSportsDB OK" };
          return { valid: false, message: "Réponse invalide" };
        }
        return { valid: false, message: `HTTP ${r.status}` };
      }
      case "sportmonks": {
        const r = await fetch(
          `https://api.sportmonks.com/v3/core/continents?api_token=${encodeURIComponent(key)}`,
        );
        if (r.ok) return { valid: true, message: "Sportmonks OK" };
        return { valid: false, message: `HTTP ${r.status}` };
      }
      default:
        return { valid: false, message: "Provider inconnu — non vérifié" };
    }
  } catch (e) {
    return {
      valid: false,
      message: e instanceof Error ? e.message : "Erreur réseau",
    };
  }
}