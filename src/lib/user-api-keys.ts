// localStorage keys for user-provided external API credentials.
// Stored locally and forwarded as headers to edge functions on each call.
export const USER_API_STORAGE_KEYS = {
  rapidApi: "magic_user_rapidapi_key",
  footballData: "magic_user_footballdata_key",
  odds: "magic_user_odds_key",
  apiSports: "magic_user_apisports_key",
  gemini: "magic_user_gemini_key",
} as const;

export interface UserApiKeys {
  rapidApi: string;
  footballData: string;
  odds: string;
  apiSports: string;
  gemini: string;
}

const empty = (): UserApiKeys => ({
  rapidApi: "",
  footballData: "",
  odds: "",
  apiSports: "",
  gemini: "",
});

export function getUserApiKeys(): UserApiKeys {
  if (typeof window === "undefined") return empty();
  return {
    rapidApi: localStorage.getItem(USER_API_STORAGE_KEYS.rapidApi) ?? "",
    footballData: localStorage.getItem(USER_API_STORAGE_KEYS.footballData) ?? "",
    odds: localStorage.getItem(USER_API_STORAGE_KEYS.odds) ?? "",
    apiSports: localStorage.getItem(USER_API_STORAGE_KEYS.apiSports) ?? "",
    gemini: localStorage.getItem(USER_API_STORAGE_KEYS.gemini) ?? "",
  };
}

export function setUserApiKey(field: keyof UserApiKeys, value: string) {
  if (typeof window === "undefined") return;
  const k = USER_API_STORAGE_KEYS[field];
  if (value) localStorage.setItem(k, value);
  else localStorage.removeItem(k);
}

// Forwarded header names — picked up by Supabase edge functions.
export const USER_KEY_HEADERS: Record<keyof UserApiKeys, string> = {
  rapidApi: "x-user-rapidapi-key",
  footballData: "x-user-footballdata-key",
  odds: "x-user-odds-key",
  apiSports: "x-user-apisports-key",
  gemini: "x-user-gemini-key",
};

export function userKeysToHeaders(keys: UserApiKeys): Record<string, string> {
  const h: Record<string, string> = {};
  (Object.keys(keys) as Array<keyof UserApiKeys>).forEach((k) => {
    if (keys[k]) h[USER_KEY_HEADERS[k]] = keys[k];
  });
  return h;
}
