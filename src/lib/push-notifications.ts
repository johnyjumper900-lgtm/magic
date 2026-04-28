/**
 * Wrapper minimal autour de Notification API — push navigateur natif.
 * Pas de dépendance, fonctionne hors-ligne (l'onglet doit rester ouvert
 * pour le mode "polling" actuel ; pour de vrais push background il
 * faudrait un service worker — futur).
 */

const ENABLED_KEY = "magic.push.enabled";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isPushEnabled(): boolean {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission === "granted") {
    try {
      localStorage.setItem(ENABLED_KEY, "1");
    } catch {
      /* noop */
    }
    return true;
  }
  if (Notification.permission === "denied") return false;
  const r = await Notification.requestPermission();
  if (r === "granted") {
    try {
      localStorage.setItem(ENABLED_KEY, "1");
    } catch {
      /* noop */
    }
    return true;
  }
  return false;
}

export function disablePush() {
  try {
    localStorage.setItem(ENABLED_KEY, "0");
  } catch {
    /* noop */
  }
}

export function pushNotify(title: string, options?: NotificationOptions) {
  if (!isPushEnabled()) return;
  try {
    new Notification(title, {
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      ...options,
    });
  } catch {
    /* iOS / unsupported -> silent */
  }
}
