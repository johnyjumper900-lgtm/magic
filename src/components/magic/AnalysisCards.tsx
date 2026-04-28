import { motion } from "framer-motion";
import { Brain, CheckCircle2, AlertTriangle, Sparkles, Flame } from "lucide-react";
import type { Prediction } from "@/types/magic";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";
import { TeamCrest } from "./TeamCrest";
import { translateBetType, translateBetOption } from "@/lib/bet-fr";

interface AnalysisCardsProps {
  predictions: Prediction[];
}

export const AnalysisCards = ({ predictions }: AnalysisCardsProps) => {
  if (predictions.length === 0) {
    return (
      <HoloCard variant="cyan">
        <div className="p-8 flex flex-col items-center text-center gap-3">
          <HoloLogo icon={Brain} size={56} />
          <h3 className="text-sm font-display font-black uppercase tracking-[0.18em] holo-text">
            En attente d'analyse
          </h3>
          <p className="text-[11px] text-muted-foreground max-w-[240px] leading-snug">
            Ajoute des matchs et lance le moteur IA pour révéler les meilleures
            opportunités de la journée.
          </p>
        </div>
      </HoloCard>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {predictions.map((p, i) => {
        const isValue = p.valueScore > 1;
        const conf = Math.round(p.confidence ?? p.probability);
        const isTopConf = (p.confidence ?? p.probability) >= 88 || p.highConfidence === true;
        const [teamA = "", teamB = ""] = p.match.split(" vs ");
        return (
          <motion.div
            key={`${p.matchId}-${i}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <HoloCard variant={isTopConf ? "cyan" : isValue ? "cyan" : "violet"}>
              <div className="p-4 flex flex-col gap-2">
                {isTopConf && (
                  <div className="flex items-center gap-1.5 self-start rounded-full bg-gradient-prism px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-background shadow">
                    <Flame size={10} />
                    <span>Confiance Magic · {conf}%</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1 shrink-0">
                      <TeamCrest src={p.teamALogo} name={teamA} size={24} />
                      <TeamCrest src={p.teamBLogo} name={teamB} size={24} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground truncate">
                        {translateBetType(p.type)}
                      </p>
                      <h4 className="text-xs font-display font-black text-foreground uppercase tracking-wide truncate mt-0.5">
                        {p.match}
                      </h4>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-display font-black holo-text leading-none">
                      {p.odds.toFixed(2)}
                    </div>
                    <div className="text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                      cote
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isValue ? (
                    <CheckCircle2 size={13} className="text-success shrink-0" />
                  ) : (
                    <AlertTriangle size={13} className="text-gold shrink-0" />
                  )}
                  <span className="text-xs font-bold text-foreground truncate flex-1">
                    {translateBetOption(p.option)}
                  </span>
                  <span className="ml-auto text-[10px] font-black text-primary shrink-0">
                    {conf}%
                  </span>
                </div>

                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${conf}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-prism"
                  />
                </div>

                {p.reasoning && (
                  <p className="text-[10.5px] text-muted-foreground italic leading-snug break-words">
                    {p.reasoning}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-widest pt-1 border-t border-border/40">
                  <span
                    className={`flex items-center gap-1 truncate ${
                      p.hasRealOdds ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    <Sparkles size={10} className="shrink-0" />
                    <span className="truncate">
                      {p.hasRealOdds
                        ? `Cote réelle · ${p.bookmaker}`
                        : "Estimation IA"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 ${
                      isValue ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    Value × {p.valueScore.toFixed(2)}
                  </span>
                </div>
              </div>
            </HoloCard>
          </motion.div>
        );
      })}
    </div>
  );
};
