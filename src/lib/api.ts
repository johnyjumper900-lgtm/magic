import { getUserApiKeys, userKeysToHeaders } from "./user-api-keys";
import {
  fetchAllMatchesMultiProvider,
  type EnrichedMatch,
} from "./multi-provider-matches";

// Re-export pour compat avec les imports existants
export type { EnrichedMatch } from "./multi-provider-matches";

/**
 * Récupère automatiquement tous les matchs disponibles sur 30 jours via
 * l'ensemble des API dont la clé utilisateur est valide (hors rotation
 * RapidAPI) : TheSportsDB, Football-Data.org, API-Sports, The Odds API.
 */
async function fetchMatchesLocal(): Promise<{
  matches: EnrichedMatch[];
  providersUsed?: string[];
  counts?: Record<string, number>;
}> {
  const res = await fetchAllMatchesMultiProvider(30);
  return {
    matches: res.matches,
    providersUsed: res.providersUsed,
    counts: res.counts,
  };
}

/**
 * invokeFn — drop-in replacement for the original Supabase edge-function caller.
 * - "fetch-matches" runs locally via TheSportsDB v1 + The Odds API
 * - other names are forwarded to Supabase Functions if available, else return a soft error
 */
export async function invokeFn<T = unknown>(
  name: string,
  options: { body?: unknown } = {},
): Promise<{ data: T | null; error: Error | null }> {
  try {
    if (name === "fetch-matches") {
      const data = await fetchMatchesLocal();
      return { data: data as T, error: null };
    }

    // Appel direct via fetch pour conserver le corps JSON même sur 4xx/5xx
    const userKeys = getUserApiKeys();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        ...userKeysToHeaders(userKeys),
      },
      body: JSON.stringify(options.body ?? {}),
    });
    const text = await resp.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* noop */ }
    if (!resp.ok) {
      const msg =
        (parsed as { error?: string } | null)?.error ||
        `HTTP ${resp.status}`;
      return { data: parsed as T | null, error: new Error(msg) };
    }
    return { data: parsed as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error("Network error"),
    };
  }
}
