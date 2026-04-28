import { TrendingUp, Trophy, Target, Flame, Award } from "lucide-react";
import type { HistoryItem } from "@/types/magic";
import { computeRoiStats } from "@/lib/roi";
import { HoloCard } from "./HoloCard";

interface RoiStatsPanelProps {
  history: HistoryItem[];
}

/**
 * Mini-dashboard ROI affiché en haut de l'historique.
 */
export const RoiStatsPanel = ({ history }: RoiStatsPanelProps) => {
  const s = computeRoiStats(history);
  if (s.totalTickets === 0) return null;

  const roiColor =
    s.roiPct > 5 ? "text-success" : s.roiPct < -5 ? "text-destructive" : "text-foreground";
  const profitColor =
    s.netProfit > 0 ? "text-success" : s.netProfit < 0 ? "text-destructive" : "text-foreground";

  return (
    <HoloCard variant="cyan">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground">
          <TrendingUp size={11} className="text-primary" /> Performance perso
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="glass rounded-lg p-2">
            <p className="text-[7.5px] uppercase tracking-widest text-muted-foreground font-bold">
              ROI
            </p>
            <p className={`text-base font-display font-black mt-0.5 ${roiColor}`}>
              {s.roiPct >= 0 ? "+" : ""}
              {s.roiPct.toFixed(1)}%
            </p>
          </div>
          <div className="glass rounded-lg p-2">
            <p className="text-[7.5px] uppercase tracking-widest text-muted-foreground font-bold">
              Gain net
            </p>
            <p className={`text-base font-display font-black mt-0.5 ${profitColor}`}>
              {s.netProfit >= 0 ? "+" : ""}
              {s.netProfit.toFixed(0)}€
            </p>
          </div>
          <div className="glass rounded-lg p-2">
            <p className="text-[7.5px] uppercase tracking-widest text-muted-foreground font-bold">
              Réussite
            </p>
            <p className="text-base font-display font-black holo-text mt-0.5">
              {s.winRate.toFixed(0)}%
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="glass rounded-lg p-2 flex flex-col items-center">
            <Trophy size={11} className="text-success mb-0.5" />
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
              Gagnés
            </p>
            <p className="text-xs font-display font-black text-success mt-0.5">
              {s.wonTickets}
            </p>
          </div>
          <div className="glass rounded-lg p-2 flex flex-col items-center">
            <Target size={11} className="text-destructive mb-0.5" />
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
              Perdus
            </p>
            <p className="text-xs font-display font-black text-destructive mt-0.5">
              {s.lostTickets}
            </p>
          </div>
          <div className="glass rounded-lg p-2 flex flex-col items-center">
            <Flame size={11} className="text-gold mb-0.5" />
            <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
              Série
            </p>
            <p className="text-xs font-display font-black text-gold mt-0.5">
              {s.currentStreak} / {s.bestStreak}
            </p>
          </div>
        </div>
        {s.byType.length > 0 && (
          <div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
              <Award size={10} /> Type le plus rentable
            </p>
            <div className="flex flex-wrap gap-1.5">
              {s.byType.slice(0, 4).map((t) => (
                <span
                  key={t.type}
                  className={`px-2 py-1 rounded-full text-[8.5px] font-black uppercase tracking-widest border ${
                    t.winRate >= 60
                      ? "bg-success/15 border-success/40 text-success"
                      : t.winRate >= 40
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                  title={`${t.won}/${t.count} gagnés`}
                >
                  {t.type} · {t.winRate.toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </HoloCard>
  );
};
