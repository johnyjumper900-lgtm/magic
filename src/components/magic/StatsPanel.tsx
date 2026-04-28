import { TrendingUp, Target, Coins, Award } from "lucide-react";
import type { Prediction } from "@/types/magic";
import { HoloCard } from "./HoloCard";

interface StatsPanelProps {
  predictions: Prediction[];
  stake: number;
}

export const StatsPanel = ({ predictions, stake }: StatsPanelProps) => {
  if (predictions.length === 0) return null;

  const totalOdds = predictions.reduce((acc, p) => acc * p.odds, 1);
  const avgConfidence = Math.round(
    predictions.reduce((acc, p) => acc + p.probability, 0) / predictions.length,
  );
  const potential = (stake * totalOdds).toFixed(0);
  const valueCount = predictions.filter((p) => p.valueScore > 1).length;

  const items = [
    {
      label: "Cote totale",
      value: totalOdds.toFixed(2),
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "Confiance",
      value: `${avgConfidence}%`,
      icon: Target,
      color: "text-secondary",
    },
    {
      label: "Gain pot.",
      value: `${potential}€`,
      icon: Coins,
      color: "text-accent",
    },
    {
      label: "Value bets",
      value: `${valueCount}`,
      icon: Award,
      color: "text-gold",
    },
  ];

  return (
    <HoloCard variant="violet">
      <div className="grid grid-cols-4 p-3 gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.label}
              className="flex flex-col items-center text-center gap-1"
            >
              <Icon size={14} className={it.color} />
              <span className="text-base font-display font-black text-foreground">
                {it.value}
              </span>
              <span className="text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground">
                {it.label}
              </span>
            </div>
          );
        })}
      </div>
    </HoloCard>
  );
};
