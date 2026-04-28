/**
 * Calcule des stats de performance perso à partir de l'historique des
 * tickets validés (gain net, ROI, taux de réussite, meilleure série,
 * type de pari le plus rentable).
 */
import type { HistoryItem } from "@/types/magic";

export interface RoiStats {
  totalTickets: number;
  settledTickets: number;
  wonTickets: number;
  lostTickets: number;
  pendingTickets: number;
  winRate: number; // %
  totalStake: number;
  totalReturn: number; // somme des (stake * cote) pour les gagnants
  netProfit: number;
  roiPct: number; // (netProfit / totalStake) * 100
  bestStreak: number;
  currentStreak: number;
  /** type de pari -> { count, won, winRate } */
  byType: Array<{ type: string; count: number; won: number; winRate: number }>;
}

function computeStatus(t: HistoryItem): "won" | "lost" | "pending" {
  const picks = t.picks ?? [];
  if (picks.length === 0) return "pending";
  if (picks.some((p) => p.result === "lost")) return "lost";
  if (picks.every((p) => p.result === "won")) return "won";
  return "pending";
}

export function computeRoiStats(history: HistoryItem[]): RoiStats {
  let totalStake = 0;
  let totalReturn = 0;
  let won = 0;
  let lost = 0;
  let pending = 0;
  let bestStreak = 0;
  let currentStreak = 0;
  const types = new Map<string, { count: number; won: number }>();

  // Tri du plus ancien au plus récent pour la série
  const ordered = [...history].reverse();

  for (const t of history) {
    const stake = t.stake ?? 0;
    if (t.status !== "validated") continue;
    totalStake += stake;
    const status = computeStatus(t);
    if (status === "won") {
      won++;
      const odds = parseFloat(t.odds || "1");
      totalReturn += stake * (Number.isFinite(odds) ? odds : 1);
    } else if (status === "lost") {
      lost++;
    } else {
      pending++;
    }
    for (const p of t.picks ?? []) {
      const k = p.type || "Autre";
      const cur = types.get(k) ?? { count: 0, won: 0 };
      cur.count++;
      if (p.result === "won") cur.won++;
      types.set(k, cur);
    }
  }

  // Série en cours et meilleure
  let streak = 0;
  for (const t of ordered) {
    if (t.status !== "validated") continue;
    const s = computeStatus(t);
    if (s === "won") {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else if (s === "lost") {
      streak = 0;
    }
    // pending: on ne casse pas la série
  }
  currentStreak = streak;

  const settled = won + lost;
  const winRate = settled > 0 ? (won / settled) * 100 : 0;
  const netProfit = totalReturn - totalStake;
  const roiPct = totalStake > 0 ? (netProfit / totalStake) * 100 : 0;

  const byType = Array.from(types.entries())
    .map(([type, v]) => ({
      type,
      count: v.count,
      won: v.won,
      winRate: v.count > 0 ? (v.won / v.count) * 100 : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate);

  return {
    totalTickets: history.length,
    settledTickets: settled,
    wonTickets: won,
    lostTickets: lost,
    pendingTickets: pending,
    winRate,
    totalStake,
    totalReturn,
    netProfit,
    roiPct,
    bestStreak,
    currentStreak,
    byType,
  };
}
