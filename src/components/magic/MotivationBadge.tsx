import { Flame, Trophy, Shield, Crown } from "lucide-react";
import { detectMotivation } from "@/lib/motivation";

interface MotivationBadgeProps {
  home: string;
  away: string;
  league: string;
  compact?: boolean;
}

/**
 * Affiche les enjeux détectés (derby, finale, course au titre...).
 * Compact = inline 1 ligne pour la liste calendrier.
 */
export const MotivationBadge = ({ home, away, league, compact }: MotivationBadgeProps) => {
  const m = detectMotivation(home, away, league);
  if (m.level === 0) return null;

  const Icon =
    m.level === 3 ? Flame : m.level === 2 ? Trophy : m.level === 1 ? Shield : Crown;
  const colors =
    m.level === 3
      ? "bg-accent/15 border-accent/50 text-accent"
      : m.level === 2
        ? "bg-gold/15 border-gold/50 text-gold"
        : "bg-primary/10 border-primary/30 text-primary";

  if (compact) {
    if (m.level < 2) return null; // n'afficher que les enjeux forts dans la liste
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase tracking-widest border ${colors}`}
        title={m.reasoning}
      >
        <Icon size={9} />
        {m.tags[0]}
      </span>
    );
  }

  return (
    <div className={`rounded-xl p-3 border ${colors}`}>
      <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest mb-1">
        <Icon size={11} /> Enjeu détecté
      </div>
      <div className="flex flex-wrap gap-1 mb-1">
        {m.tags.map((t) => (
          <span
            key={t}
            className="px-1.5 py-0.5 rounded bg-background/40 border border-current/40 text-[9px] font-black uppercase tracking-widest"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="text-[9.5px] italic opacity-90 leading-snug">{m.reasoning}</p>
    </div>
  );
};
