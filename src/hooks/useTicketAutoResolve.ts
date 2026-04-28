import { useEffect, useRef } from "react";
import type { HistoryItem } from "@/types/magic";
import { TheSportsDB, type SDBEvent } from "@/lib/thesportsdb";

/**
 * Scans validated tickets that still have pending picks, looks up the real
 * score on TheSportsDB by team names, and resolves each pick to "won" / "lost".
 *
 * Heuristic resolver:
 *  - "1" / "Domicile" / home team name => home wins
 *  - "2" / "Extérieur" / away team name => away wins
 *  - "X" / "Nul" => draw
 *  - "BTTS" / "Les deux marquent" => both teams scored
 *  - "+1.5" / "+2.5" => total goals over the threshold
 *  - default: pending if event not finished / unknown bet type
 */

type Pick = NonNullable<HistoryItem["picks"]>[number];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim();
}

function teamMatches(name: string, candidate: string) {
  const a = normalize(name);
  const b = normalize(candidate);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

async function findEventForPick(pick: Pick): Promise<SDBEvent | null> {
  // pick.match is like "PSG vs Marseille"
  const sep = /\s+(?:vs\.?|v\.s\.?|versus|contre|-|–|—)\s+/i;
  const parts = pick.match.split(sep);
  if (parts.length < 2) return null;
  const [home, away] = parts.map((p) => p.trim());

  // Try TheSportsDB searchevents endpoint with "Home_vs_Away"
  try {
    const q = `${home}_vs_${away}`.replace(/\s+/g, "_");
    const json = await TheSportsDB.searchEvents(q);
    const events: SDBEvent[] = json?.event ?? [];
    if (events.length === 0) return null;
    // Pick the most recent finished event
    const finished = events.filter((e) => e.intHomeScore != null && e.intAwayScore != null);
    if (finished.length === 0) return events[0];
    finished.sort((a, b) => (b.dateEvent || "").localeCompare(a.dateEvent || ""));
    return finished[0];
  } catch {
    return null;
  }
}

function isFinished(ev: SDBEvent): boolean {
  if (ev.intHomeScore == null || ev.intAwayScore == null) return false;
  const status = (ev.strStatus || ev.strProgress || "").toLowerCase();
  if (!status) return true; // scores present, assume finished
  return /(ft|finished|match\s*fini|terminé|aet|pen)/i.test(status);
}

function resolvePick(pick: Pick, ev: SDBEvent): "won" | "lost" | "pending" {
  if (!isFinished(ev)) return "pending";
  const h = parseInt(ev.intHomeScore ?? "", 10);
  const a = parseInt(ev.intAwayScore ?? "", 10);
  if (Number.isNaN(h) || Number.isNaN(a)) return "pending";
  const total = h + a;
  const opt = normalize(pick.option);
  const home = normalize(ev.strHomeTeam || "");
  const away = normalize(ev.strAwayTeam || "");

  // Double chance — TESTER EN PREMIER (ex "1x" contient "1")
  if (/\b1x\b/.test(opt) || opt.includes("1 ou nul") || opt.includes("domicile ou nul")) {
    return h >= a ? "won" : "lost";
  }
  if (/\bx2\b/.test(opt) || opt.includes("nul ou 2") || opt.includes("nul ou exterieur") || opt.includes("nul ou visiteur")) {
    return a >= h ? "won" : "lost";
  }
  if (/\b12\b/.test(opt) || opt.includes("pas de nul") || opt.includes("1 ou 2")) {
    return h !== a ? "won" : "lost";
  }

  // Over/Under X.5  (avant 1/X/2 pour éviter "+1.5" pris pour autre chose)
  const over = opt.match(/(?:\+|over|plus\s*de\s*)(\d+(?:[.,]\d+)?)/);
  if (over) {
    const t = parseFloat(over[1].replace(",", "."));
    return total > t ? "won" : "lost";
  }
  const under = opt.match(/(?:^-\s*|under|moins\s*de\s*)(\d+(?:[.,]\d+)?)/);
  if (under) {
    const t = parseFloat(under[1].replace(",", "."));
    return total < t ? "won" : "lost";
  }

  // BTTS Non (tester avant le Oui)
  if ((opt.includes("btts") || opt.includes("les deux") || opt.includes("both")) &&
      (opt.includes("non") || /\bno\b/.test(opt))) {
    return h === 0 || a === 0 ? "won" : "lost";
  }
  // BTTS Oui
  if (opt.includes("btts") || opt.includes("les deux") || opt.includes("both")) {
    return h > 0 && a > 0 ? "won" : "lost";
  }

  // Home win
  if (opt === "1" || opt.includes("domicile") || (home && opt.includes(home))) {
    return h > a ? "won" : "lost";
  }
  // Away win
  if (opt === "2" || opt.includes("exterieur") || opt.includes("visiteur") || (away && opt.includes(away))) {
    return a > h ? "won" : "lost";
  }
  // Draw
  if (opt === "x" || opt.includes("nul") || opt.includes("draw")) {
    return h === a ? "won" : "lost";
  }

  return "pending";
}

interface Options {
  history: HistoryItem[];
  onSetPickResult: (ticketId: string, pickIndex: number, result: "won" | "lost" | "pending") => void;
  intervalMs?: number;
}

export function useTicketAutoResolve({ history, onSetPickResult, intervalMs = 60_000 }: Options) {
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const now = Date.now();
      if (now - lastRunRef.current < 5_000) return;
      lastRunRef.current = now;

      const tickets = history.filter((t) => t.status === "validated");
      for (const t of tickets) {
        const picks = t.picks ?? [];
        for (let i = 0; i < picks.length; i++) {
          const p = picks[i];
          if (p.result === "won" || p.result === "lost") continue;
          const ev = await findEventForPick(p);
          if (!ev || cancelled) continue;
          const r = resolvePick(p, ev);
          if (r !== "pending") {
            onSetPickResult(t.id, i, r);
          }
          // small delay to avoid hammering API
          await new Promise((res) => setTimeout(res, 250));
        }
      }
    }

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [history, onSetPickResult, intervalMs]);
}
