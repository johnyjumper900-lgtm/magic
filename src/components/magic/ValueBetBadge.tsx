import { Sparkles, Flame } from "lucide-react";
import { assessValue } from "@/lib/value-bet";

interface ValueBetBadgeProps {
  /** probabilité estimée par Magic en % (0-100) */
  probability: number;
  /** cote bookmaker / IA */
  odds: number;
  size?: "sm" | "md";
}

/**
 * Badge "Value Bet" — affiche +x.x% d'edge, et un 🔥 si edge ≥ 8%.
 */
export const ValueBetBadge = ({ probability, odds, size = "sm" }: ValueBetBadgeProps) => {
  const v = assessValue(probability, odds);
  if (v.level === "neutral") return null;
  const isHot = v.level === "hot";
  const sizing =
    size === "sm" ? "text-[8.5px] px-1.5 py-0.5 gap-1" : "text-[10px] px-2 py-1 gap-1.5";
  return (
    <span
      className={`inline-flex items-center rounded font-black uppercase tracking-widest border ${sizing} ${
        isHot
          ? "bg-gold/15 text-gold border-gold/50 shadow-[0_0_8px_hsl(var(--gold)/0.5)]"
          : "bg-success/15 text-success border-success/50"
      }`}
      title={`Edge ${v.label} (proba Magic ${probability.toFixed(0)}% vs cote ${odds.toFixed(2)})`}
    >
      {isHot ? <Flame size={10} /> : <Sparkles size={9} />}
      Value {v.label}
    </span>
  );
};
