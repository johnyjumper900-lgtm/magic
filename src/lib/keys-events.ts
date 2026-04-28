/**
 * Tiny event bus used to notify the whole app that the user changed/added
 * an API key. Views listening to this (calendar, live tickets, top 20...)
 * refresh their data automatically so the user sees up-to-date matches,
 * odds, kickoff times and dates immediately.
 */
export const KEYS_UPDATED_EVENT = "magic:keys-updated";

export type KeysUpdatedDetail = {
  /** which provider slot was touched, optional */
  provider?: string;
  /** action performed */
  action?: "add" | "update" | "remove" | "verify" | "save-all";
};

export function emitKeysUpdated(detail: KeysUpdatedDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<KeysUpdatedDetail>(KEYS_UPDATED_EVENT, { detail }),
  );
}

export function onKeysUpdated(
  cb: (detail: KeysUpdatedDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const ce = e as CustomEvent<KeysUpdatedDetail>;
    cb(ce.detail ?? {});
  };
  window.addEventListener(KEYS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(KEYS_UPDATED_EVENT, handler);
}
