import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { HistoryItem } from "@/types/magic";
import { TheSportsDB, type SDBEvent } from "@/lib/thesportsdb";
import { celebrateWin } from "@/lib/celebration";
import { pushNotify } from "@/lib/push-notifications";

/**
 * Live alerts tied to validated tickets.
 *
 * For every validated ticket with at least one pending pick:
 *   - Detects kickoff (event becomes "in progress" or score appears)
 *   - Detects pick result update (won / lost) — toast with the ticket id
 *   - When ALL picks are settled, fires a final ticket toast
 *     (gagné / perdu) with the gain or stake lost.
 *
 * State lives in localStorage so we don't re-alert the same event after
 * a page refresh.
 */

type Pick = NonNullable<HistoryItem["picks"]>[number];

const SEEN_KEY = "magic.ticketAlerts.seen.v1";

interface SeenMap {
  /** ticketId -> { kickoffs: Set<eventId>, results: Set<pickKey>, finalSent: bool } */
  [ticketId: string]: {
    kickoffs: string[];
    results: string[];
    finalSent: boolean;
  };
}

function loadSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

function saveSeen(s: SeenMap) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

function ensureBucket(s: SeenMap, ticketId: string) {
  if (!s[ticketId]) {
    s[ticketId] = { kickoffs: [], results: [], finalSent: false };
  }
  return s[ticketId];
}

function norm(x: string) {
  return x
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim();
}

async function findEvent(pick: Pick): Promise<SDBEvent | null> {
  const sep = /\s+(?:vs\.?|v\.s\.?|versus|contre|-|–|—)\s+/i;
  const parts = pick.match.split(sep);
  if (parts.length < 2) return null;
  const [home, away] = parts.map((p) => p.trim());
  try {
    const q = `${home}_vs_${away}`.replace(/\s+/g, "_");
    const json = await TheSportsDB.searchEvents(q);
    const events: SDBEvent[] = json?.event ?? [];
    if (events.length === 0) return null;
    // most recent first
    events.sort((a, b) => (b.dateEvent || "").localeCompare(a.dateEvent || ""));
    return events[0];
  } catch {
    return null;
  }
}

function isInProgress(ev: SDBEvent): boolean {
  const s = (ev.strStatus || ev.strProgress || "").toLowerCase();
  if (/(ht|half|1h|2h|live|in play|in progress|\d+'?)/.test(s)) return true;
  // scores partial but not finished
  if (
    ev.intHomeScore != null &&
    ev.intAwayScore != null &&
    !/(ft|finished|terminé|aet|pen)/i.test(s)
  ) {
    return true;
  }
  return false;
}

function isFinished(ev: SDBEvent): boolean {
  const s = (ev.strStatus || ev.strProgress || "").toLowerCase();
  if (/(ft|finished|terminé|aet|pen)/i.test(s)) return true;
  return ev.intHomeScore != null && ev.intAwayScore != null && !s;
}

interface Options {
  history: HistoryItem[];
  intervalMs?: number;
}

export function useTicketAlerts({ history, intervalMs = 90_000 }: Options) {
  const lastFiredRef = useRef<number>(0);
  // Snapshot of previous picks state to detect transitions pending → won/lost
  const prevPicksRef = useRef<Map<string, Array<Pick["result"]>>>(new Map());

  // Detect synchronous transitions in pick state (purely from props)
  useEffect(() => {
    for (const t of history) {
      if (t.status !== "validated") continue;
      const picks = t.picks ?? [];
      const prev = prevPicksRef.current.get(t.id) ?? picks.map(() => "pending" as Pick["result"]);
      let changed = false;
      for (let i = 0; i < picks.length; i++) {
        const before = prev[i];
        const after = picks[i].result;
        if (before !== after && (after === "won" || after === "lost")) {
          const emoji = after === "won" ? "✅" : "❌";
          const title = `${emoji} Pari ${i + 1} · ${after === "won" ? "Gagné" : "Perdu"}`;
          const body = `${picks[i].match} · ${picks[i].option}`;
          toast.message(title, { description: body, duration: 6000 });
          pushNotify(title, { body, tag: `pick-${t.id}-${i}` });
          changed = true;
        }
      }
      // Final ticket result detection
      const allSettled =
        picks.length > 0 && picks.every((p) => p.result === "won" || p.result === "lost");
      const wasAllSettled =
        prev.length === picks.length &&
        prev.every((r) => r === "won" || r === "lost");
      if (allSettled && !wasAllSettled) {
        const won = picks.every((p) => p.result === "won");
        if (won) {
          celebrateWin();
          const title = `🏆 Ticket #${t.id.slice(0, 6).toUpperCase()} gagné !`;
          const body = `Cote ${t.odds} · Gain ${t.profit}`;
          toast.success(title, { description: body, duration: 9000 });
          pushNotify(title, { body, tag: `ticket-final-${t.id}` });
        } else {
          const title = `💥 Ticket #${t.id.slice(0, 6).toUpperCase()} perdu`;
          const body = `Mise perdue : -${(t.stake ?? 0).toFixed(0)}€`;
          toast.error(title, { description: body, duration: 9000 });
          pushNotify(title, { body, tag: `ticket-final-${t.id}` });
        }
        changed = true;
      }
      if (changed) {
        prevPicksRef.current.set(
          t.id,
          picks.map((p) => p.result ?? "pending"),
        );
      } else if (!prevPicksRef.current.has(t.id)) {
        prevPicksRef.current.set(
          t.id,
          picks.map((p) => p.result ?? "pending"),
        );
      }
    }
  }, [history]);

  // Polling: kickoff alerts (detected via TheSportsDB live status)
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const now = Date.now();
      if (now - lastFiredRef.current < 5_000) return;
      lastFiredRef.current = now;

      const seen = loadSeen();
      const validated = history.filter((t) => t.status === "validated");
      for (const t of validated) {
        const bucket = ensureBucket(seen, t.id);
        const picks = t.picks ?? [];
        for (let i = 0; i < picks.length; i++) {
          const p = picks[i];
          if (p.result && p.result !== "pending") continue;
          const ev = await findEvent(p);
          if (!ev || cancelled) continue;

          // Kickoff alert
          if (isInProgress(ev) && !bucket.kickoffs.includes(ev.idEvent)) {
            bucket.kickoffs.push(ev.idEvent);
            const title = `⚽ Coup d'envoi · ${ev.strHomeTeam} - ${ev.strAwayTeam}`;
            const body = `Ticket #${t.id.slice(0, 6).toUpperCase()} · ${p.option}`;
            toast(title, { description: body, duration: 6000 });
            pushNotify(title, { body, tag: `kickoff-${ev.idEvent}` });
          }
          // Score update alert (every change of partial score)
          if (
            ev.intHomeScore != null &&
            ev.intAwayScore != null &&
            !isFinished(ev)
          ) {
            const key = `${ev.idEvent}:${ev.intHomeScore}-${ev.intAwayScore}`;
            if (!bucket.results.includes(key)) {
              bucket.results.push(key);
              // limit toast spam: only when not 0-0
              if (!(ev.intHomeScore === "0" && ev.intAwayScore === "0")) {
                const title = `🥅 ${ev.strHomeTeam} ${ev.intHomeScore} - ${ev.intAwayScore} ${ev.strAwayTeam}`;
                const body = `Ticket #${t.id.slice(0, 6).toUpperCase()} · ${p.option}`;
                toast.message(title, { description: body, duration: 5000 });
                pushNotify(title, { body, tag: `score-${ev.idEvent}` });
              }
            }
          }
          await new Promise((res) => setTimeout(res, 250));
        }
      }
      if (!cancelled) saveSeen(seen);
    }

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [history, intervalMs]);
}
