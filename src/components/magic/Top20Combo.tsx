import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Star,
  Trophy,
  RefreshCw,
  AlertCircle,
  X,
  TrendingUp,
  Brain,
  CheckCircle2,
} from "lucide-react";
import { invokeFn } from "@/lib/api";
import { translateBetType, translateBetOption } from "@/lib/bet-fr";
import type { CalendarMatch, Prediction } from "@/types/magic";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";
import { TeamCrest, CountryFlag } from "./TeamCrest";

interface ComboItem {
  rank: number;
  matchId: string;
  match: string;
  teamA: string;
  teamB: string;
  teamALogo?: string;
  teamBLogo?: string;
  countryCode?: string;
  option: string;
  type: string;
  odds: number;
  probability: number;
  valueScore: number;
  reasoning?: string;
  league: string;
  date: string;
  time: string;
  hasRealOdds: boolean;
  bookmaker?: string | null;
}

const CACHE_KEY = "magic.top20.cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min — aligné sur l'auto-refresh

export const Top20Combo = () => {
  const [items, setItems] = useState<ComboItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [detail, setDetail] = useState<ComboItem | null>(null);

  const generate = async (force = false) => {
    // Cache instantané
    if (!force) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { ts: number; items: ComboItem[] };
          if (Date.now() - cached.ts < CACHE_TTL_MS && cached.items?.length) {
            setItems(cached.items);
            setUpdatedAt(new Date(cached.ts));
            return;
          }
        }
      } catch { /* noop */ }
    }

    setLoading(true);
    setError(null);
    try {
      const calRes = await invokeFn<{
        matches?: CalendarMatch[];
        error?: string;
      }>("fetch-matches", { body: {} });
      if (calRes.error) throw calRes.error;
      if (calRes.data?.error) throw new Error(calRes.data.error);

      const calendar = (calRes.data?.matches ?? []) as CalendarMatch[];
      if (calendar.length === 0) {
        setItems([]);
        setError("Aucun match dans le calendrier — réessaye plus tard");
        return;
      }

      const today = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      });
      const todayMatches = calendar.filter((m) => m.date === today);
      const otherMatches = calendar.filter((m) => m.date !== today);
      // 22 matchs (au lieu de 30) → analyse IA ~30% plus rapide
      const picked = [...todayMatches, ...otherMatches].slice(0, 22);
      const analyseRes = await invokeFn<{
        predictions?: Prediction[];
        error?: string;
      }>("analyze-matches", {
        body: {
          matches: picked.map((m) => ({
            id: m.id,
            teamA: m.teamA,
            teamB: m.teamB,
          })),
        },
      });
      if (analyseRes.error) throw analyseRes.error;
      if (analyseRes.data?.error) throw new Error(analyseRes.data.error);

      const preds = analyseRes.data?.predictions ?? [];
      const byId = new Map(picked.map((m) => [m.id, m]));

      const ranked: ComboItem[] = preds
        .map((p) => {
          const m = byId.get(p.matchId);
          return {
            matchId: p.matchId,
            match: p.match,
            teamA: m?.teamA ?? p.match.split(" vs ")[0] ?? "",
            teamB: m?.teamB ?? p.match.split(" vs ")[1] ?? "",
            teamALogo: m?.teamALogo,
            teamBLogo: m?.teamBLogo,
            countryCode: m?.countryCode,
            option: translateBetOption(p.option),
            type: translateBetType(p.type),
            odds: p.odds,
            probability: p.probability,
            valueScore: p.valueScore,
            reasoning: p.reasoning,
            league: m?.league ?? "—",
            date: m?.date ?? "",
            time: m?.time ?? "",
            hasRealOdds: !!p.hasRealOdds,
            bookmaker: p.bookmaker,
          };
        })
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 20)
        .map((it, i) => ({ ...it, rank: i + 1 }));

      setItems(ranked);
      const now = Date.now();
      setUpdatedAt(new Date(now));
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: now, items: ranked }));
      } catch { /* noop */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
    // Auto-refresh toutes les 10 minutes
    const interval = setInterval(() => generate(true), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <HoloCard variant="violet">
        <div className="flex flex-col">
          <div className="p-4 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <HoloLogo icon={Trophy} size={40} />
              <div className="min-w-0">
                <h2 className="text-xs font-display font-black uppercase tracking-[0.2em] holo-text truncate">
                  Top 20 du jour
                </h2>
                <p className="text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5 truncate">
                  {updatedAt
                    ? `MAJ ${updatedAt.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} · Auto 10min`
                    : "Génération..."}
                </p>
              </div>
            </div>
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="tap p-2.5 rounded-lg glass border border-border shrink-0"
              aria-label="Régénérer"
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin text-primary" : "text-foreground"}
              />
            </button>
          </div>

          <div className="max-h-[480px] overflow-y-auto p-2 space-y-1.5 scrollbar-none">
            {error && (
              <div className="flex flex-col items-center py-10 text-center">
                <AlertCircle size={28} className="text-accent mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">
                  {error}
                </p>
              </div>
            )}

            {loading && items.length === 0 && !error && (
              <div className="flex flex-col items-center py-10 opacity-60">
                <RefreshCw size={28} className="text-primary mb-2 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Analyse IA en cours...
                </p>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center">
                <Trophy size={28} className="text-muted-foreground mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Aucune prédiction disponible
                </p>
                <button
                  onClick={() => generate(true)}
                  className="mt-3 tap text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-gradient-holo text-primary-foreground"
                >
                  Réessayer
                </button>
              </div>
            )}


            {items.map((it) => (
              <motion.button
                key={it.rank}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: it.rank * 0.02 }}
                onClick={() => setDetail(it)}
                className="tap w-full p-3 bg-muted/30 border border-border rounded-lg flex items-center gap-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-holo flex items-center justify-center shrink-0 font-display font-black text-xs text-primary-foreground shadow-holo">
                  {it.rank}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TeamCrest src={it.teamALogo} name={it.teamA} size={22} />
                  <TeamCrest src={it.teamBLogo} name={it.teamB} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-primary uppercase tracking-widest truncate">
                    {it.league}
                  </p>
                  <p className="text-[11px] font-display font-black text-foreground uppercase truncate">
                    {it.match}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {it.option}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-display font-black holo-text">
                    {it.odds.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <Star size={9} className="text-gold" />
                    {Math.round(it.probability)}%
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </HoloCard>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-md p-4"
          onClick={() => setDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl glass-strong shadow-prism animate-fade-in-up"
          >
            <div className="relative p-5 border-b border-border/60">
              <button
                onClick={() => setDetail(null)}
                className="tap absolute top-4 right-4 w-9 h-9 rounded-full glass flex items-center justify-center"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-gradient-holo text-primary-foreground shadow-holo">
                  #{detail.rank}
                </span>
                <CountryFlag code={detail.countryCode} size={14} />
                <p className="text-[9px] font-black uppercase tracking-widest text-primary truncate">
                  {detail.league}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <TeamCrest src={detail.teamALogo} name={detail.teamA} size={56} />
                  <p className="text-[11px] font-display font-black text-foreground uppercase text-center break-words leading-tight">
                    {detail.teamA}
                  </p>
                </div>
                <div className="text-center shrink-0 px-2">
                  <div className="text-2xl font-display font-black holo-text">VS</div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                    {detail.date} {detail.time}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <TeamCrest src={detail.teamBLogo} name={detail.teamB} size={56} />
                  <p className="text-[11px] font-display font-black text-foreground uppercase text-center break-words leading-tight">
                    {detail.teamB}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="glass rounded-xl p-3 text-center">
                  <TrendingUp size={12} className="text-primary mx-auto mb-1" />
                  <p className="text-base font-display font-black holo-text">
                    {detail.odds.toFixed(2)}
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Cote</p>
                </div>
                <div className="glass rounded-xl p-3 text-center">
                  <Star size={12} className="text-gold mx-auto mb-1" />
                  <p className="text-base font-display font-black text-foreground">
                    {Math.round(detail.probability)}%
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Confiance</p>
                </div>
                <div className="glass rounded-xl p-3 text-center">
                  <CheckCircle2 size={12} className="text-success mx-auto mb-1" />
                  <p className="text-base font-display font-black text-foreground">
                    ×{detail.valueScore.toFixed(2)}
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Value</p>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <p className="text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Pari recommandé · {detail.type}
                </p>
                <p className="text-sm font-display font-black text-foreground uppercase break-words leading-tight">
                  {detail.option}
                </p>
              </div>

              {detail.reasoning && (
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-widest text-secondary mb-2">
                    <Brain size={10} /> Analyse stratégique
                  </div>
                  <p className="text-[12px] text-foreground leading-snug">
                    {detail.reasoning}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest pt-2 border-t border-border/40">
                <span
                  className={
                    detail.hasRealOdds ? "text-success" : "text-muted-foreground"
                  }
                >
                  {detail.hasRealOdds
                    ? `Cote réelle · ${detail.bookmaker}`
                    : "Cote estimée IA"}
                </span>
                <span className="text-muted-foreground truncate ml-2">
                  Rang #{detail.rank} / 20
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
