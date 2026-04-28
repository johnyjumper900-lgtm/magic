import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { Cpu, Check, Sparkles } from "lucide-react";
import type {
  CalendarMatch,
  HistoryItem,
  Match,
  Prediction,
} from "@/types/magic";
import { invokeFn } from "@/lib/api";
import { translateBetOption, translateBetType } from "@/lib/bet-fr";

const HISTORY_KEY = "magic.history.v1";

import { TabBar, type TabKey } from "@/components/magic/TabBar";
import { SettingsView } from "@/components/magic/SettingsView";
import { MagicHero } from "@/components/magic/MagicHero";
import { MatchInput } from "@/components/magic/MatchInput";
import { StakeAndAnalyze } from "@/components/magic/StakeAndAnalyze";
import { StatsPanel } from "@/components/magic/StatsPanel";
import { AnalysisCards } from "@/components/magic/AnalysisCards";
import { ActionFooter } from "@/components/magic/ActionFooter";
import { MatchCalendar } from "@/components/magic/MatchCalendar";
import { Top20Combo } from "@/components/magic/Top20Combo";
import { VoiceCoach } from "@/components/magic/VoiceCoach";
import { HistoryView } from "@/components/magic/HistoryView";
import { TicketsView } from "@/components/magic/TicketsView";
import { HoloLogo } from "@/components/magic/HoloLogo";
import { LockScreen, isUnlockedNow, UNLOCK_STORAGE_KEY } from "@/components/magic/LockScreen";
import { useTicketAutoResolve } from "@/hooks/useTicketAutoResolve";
import { useTicketAlerts } from "@/hooks/useTicketAlerts";
import { detectMotivation } from "@/lib/motivation";

const MagicApp = () => {
  const [locked, setLocked] = useState<boolean>(() => !isUnlockedNow());
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stake, setStake] = useState<number>(10);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [highConfOnly, setHighConfOnly] = useState<boolean>(() => {
    try { return localStorage.getItem("magic.highConfOnly") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("magic.highConfOnly", highConfOnly ? "1" : "0"); } catch { /* noop */ }
  }, [highConfOnly]);
  const [actionFlash, setActionFlash] = useState<{ id: number; label: string } | null>(null);
  const flashAction = (label: string) => {
    setActionFlash({ id: Date.now(), label });
    window.setTimeout(() => setActionFlash(null), 1400);
  };
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });

  // Persist history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* noop */
    }
  }, [history]);

  const clearAnalysis = () => {
    setMatches([]);
    setPredictions([]);
    toast.success("Liste d'analyse effacée");
    flashAction("Liste effacée");
  };

  const addMatch = (a: string, b: string, logos?: { a?: string; b?: string }) => {
    if (matches.length >= 20) {
      toast.warning("Limite de 20 matchs");
      return;
    }
    setMatches((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        teamA: a,
        teamB: b,
        teamALogo: logos?.a,
        teamBLogo: logos?.b,
      },
    ]);
    flashAction(`+ ${a} vs ${b}`);
  };

  const removeMatch = (id: string) => {
    setMatches((p) => p.filter((m) => m.id !== id));
    setPredictions((p) => p.filter((x) => x.matchId !== id));
  };

  const handleMagicMode = async () => {
    try {
      const { data, error } = await invokeFn<{
        matches?: CalendarMatch[];
        error?: string;
      }>("fetch-matches", { body: {} });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const calendar = data?.matches ?? [];
      if (calendar.length === 0) {
        toast.warning("Aucun match disponible");
        return;
      }
      // Magic décide : on prend les matchs des prochaines 36h en heure FR.
      const todayParis = new Date().toLocaleDateString("fr-CA", {
        timeZone: "Europe/Paris",
      });
      const tomorrow = new Date(Date.now() + 24 * 3600_000).toLocaleDateString(
        "fr-CA",
        { timeZone: "Europe/Paris" },
      );
      let pool = calendar.filter(
        (m) => m.date === todayParis || m.date === tomorrow,
      );
      if (pool.length === 0) pool = calendar;

      /**
       * Magic decision engine :
       *  - score = priorité aux matchs avec cotes réelles (+50)
       *  - meilleure value sur le favori dont la cote est entre 1.45 et 2.30
       *  - écarte les matchs trop serrés (favori > 2.85)
       */
      const scored = pool.map((m) => {
        const o = m.realOdds;
        let score = 0;
        if (o) {
          score += 50;
          const minOdds = Math.min(
            o.home ?? 99,
            o.draw ?? 99,
            o.away ?? 99,
          );
          if (minOdds >= 1.45 && minOdds <= 2.3) score += 40;
          if (minOdds > 2.85) score -= 30;
          // implied prob > 55% → favorit clair
          const maxImplied = Math.max(
            o.impliedHome ?? 0,
            o.impliedDraw ?? 0,
            o.impliedAway ?? 0,
          );
          score += maxImplied / 2;
        }
        // Boost motivation : derbys, finales, Coupes d'Europe — Magic adore l'enjeu
        const motiv = detectMotivation(m.teamA, m.teamB, m.league || "");
        score += motiv.level * 12; // 0/12/24/36 pts
        // un peu de bruit pour ne pas reproduire la même sélection
        score += Math.random() * 8;
        return { m, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const selected = scored.slice(0, 8).map((s) => s.m);

      setMatches(
        selected.map((m) => ({
          id: crypto.randomUUID(),
          teamA: m.teamA,
          teamB: m.teamB,
          teamALogo: m.teamALogo,
          teamBLogo: m.teamBLogo,
        })),
      );
      const withRealOdds = selected.filter((m) => m.realOdds).length;
      toast.success(
        `Magic a sélectionné ${selected.length} matchs${
          withRealOdds ? ` · ${withRealOdds} avec cotes réelles` : ""
        }`,
      );
      setTab("dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleAnalyze = async () => {
    if (matches.length === 0) {
      toast.error("Ajoute au moins un match");
      return;
    }
    setIsAnalyzing(true);
    try {
      const { data, error } = await invokeFn<{
        predictions?: Prediction[];
        meta?: { avgConfidence?: number; total?: number; kept?: number; model?: string };
        error?: string;
      }>("analyze-matches", {
        body: { matches, minConfidence: 88, highConfidenceOnly: highConfOnly },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const preds = data?.predictions ?? [];
      // Re-attach logos from matches by id
      const byId = new Map(matches.map((m) => [m.id, m]));
      const enriched = preds.map((p) => {
        const m = byId.get(p.matchId);
        return {
          ...p,
          teamALogo: m?.teamALogo,
          teamBLogo: m?.teamBLogo,
        };
      });
      setPredictions(enriched);
      const avg = data?.meta?.avgConfidence;
      const kept = data?.meta?.kept ?? preds.length;
      const total = data?.meta?.total ?? preds.length;
      const label = highConfOnly
        ? `${kept}/${total} pronos ≥88% · conf. moy. ${avg ?? "?"}%`
        : `${preds.length} pronos · conf. moy. ${avg ?? "?"}%`;
      toast.success(label);
      flashAction(label);
      if (highConfOnly && kept === 0) {
        toast.warning("Magic n'a trouvé aucun pronostic à ≥88% sur ces matchs. Filtre désactivé.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'analyse");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (predictions.length === 0) {
      toast.warning("Lance d'abord une analyse pour sauvegarder");
      return;
    }
    const totalOdds = predictions.reduce((a, p) => a * p.odds, 1);
    const conf = Math.round(
      predictions.reduce((a, p) => a + p.probability, 0) / predictions.length,
    );
    const potentialWin = stake * totalOdds;
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      title:
        predictions.length === 1
          ? predictions[0].match
          : `Combiné ${predictions.length} matchs`,
      odds: totalOdds.toFixed(2),
      confidence: String(conf),
      profit: `+${potentialWin.toFixed(0)}€`,
      date: new Date().toLocaleDateString("fr-FR"),
      stake,
      status: "draft",
      potentialWin,
      picks: predictions.map((p) => ({
        match: p.match,
        option: translateBetOption(p.option),
        type: translateBetType(p.type),
        odds: p.odds,
        probability: p.probability,
      })),
    };
    setHistory((p) => [item, ...p]);
    toast.success(
      `Ticket créé · cote ${totalOdds.toFixed(2)} · va dans Mes Paris`,
    );
    flashAction("Ticket sauvegardé");
    setTab("tickets");
  };

  const validateTicket = (id: string) => {
    setHistory((p) =>
      p.map((t) =>
        t.id === id
          ? {
              ...t,
              status: "validated" as const,
              validatedAt: new Date().toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : t,
      ),
    );
    toast.success("Ticket validé !");
  };

  const deleteTicket = (id: string) => {
    setHistory((p) => p.filter((t) => t.id !== id));
    toast.success("Ticket supprimé");
  };

  const setPickResult = (
    ticketId: string,
    pickIndex: number,
    result: "won" | "lost" | "pending",
  ) => {
    setHistory((p) =>
      p.map((t) => {
        if (t.id !== ticketId || !t.picks) return t;
        const picks = t.picks.map((pk, i) =>
          i === pickIndex ? { ...pk, result } : pk,
        );
        return { ...t, picks };
      }),
    );
  };

  // Résolution automatique des tickets en cours via TheSportsDB
  // (vert/rouge mis à jour dès que le score réel est disponible)
  useTicketAutoResolve({ history, onSetPickResult: setPickResult, intervalMs: 90_000 });
  // Alertes live reliées aux tickets en cours (kickoff, score, résultat final)
  useTicketAlerts({ history, intervalMs: 90_000 });

  // Commande vocale : "envoie ton prono dans vos matchs"
  // Si aucun match → charger depuis le calendrier puis analyser.
  const handleSendPicks = async () => {
    setTab("dashboard");
    if (matches.length === 0) {
      await handleMagicMode();
      setTimeout(() => handleAnalyze(), 400);
    } else {
      handleAnalyze();
    }
  };

  // Magic transfère ses propres pronos (paires d'équipes) vers Vos Matchs
  const handleTransferMatches = (pairs: Array<{ a: string; b: string }>) => {
    if (!pairs.length) return;
    const newMatches: Match[] = pairs.slice(0, 20).map((p) => ({
      id: crypto.randomUUID(),
      teamA: p.a,
      teamB: p.b,
    }));
    setMatches(newMatches);
    setPredictions([]);
    setTab("dashboard");
    toast.success(`${newMatches.length} matchs transférés par Magic`);
    flashAction(`${newMatches.length} matchs transférés`);
    // Lance l'analyse une fois l'état appliqué
    setTimeout(() => {
      (async () => {
        setIsAnalyzing(true);
        try {
          const { data, error } = await invokeFn<{
            predictions?: Prediction[];
            error?: string;
          }>("analyze-matches", { body: { matches: newMatches } });
          if (error) throw error;
          if (data?.error) {
            toast.error(data.error);
            return;
          }
          setPredictions(data?.predictions ?? []);
          toast.success(`${data?.predictions?.length ?? 0} prédictions générées`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erreur d'analyse");
        } finally {
          setIsAnalyzing(false);
        }
      })();
    }, 200);
  };
  // 🧠 Mémoire persistante : créateur + empreinte vocale
  const creatorMemory = (() => {
    try {
      const name = localStorage.getItem("magic.creator.name") || "son créateur (à lui demander une fois)";
      const fp = localStorage.getItem("magic.voice.fingerprint");
      const voicePart = fp ? ` Empreinte vocale enregistrée (hash ${fp.slice(0, 12)}…) — reconnaît sa voix.` : " Pas encore d'empreinte vocale enregistrée.";
      return `Magic a un créateur officiel : ${name}. C'est son patron, son boss, son référent absolu — Magic le respecte et s'en souvient toujours.${voicePart}`;
    } catch { return ""; }
  })();
  const matchesContext =
    matches.length > 0
      ? `L'utilisateur a ${matches.length} matchs sélectionnés : ${matches
          .map((m) => `${m.teamA} vs ${m.teamB}`)
          .join(", ")}.${
          predictions.length > 0
            ? ` Prédictions actuelles : ${predictions
                .slice(0, 5)
                .map(
                  (p) =>
                    `${p.match} → ${p.option} (cote ${p.odds.toFixed(2)}, ${Math.round(
                      p.probability,
                    )}%)`,
                )
                .join("; ")}.`
            : ""
        } Mise par défaut : ${stake}€.`
      : `L'utilisateur n'a pas encore sélectionné de match. Mise par défaut ${stake}€.`;
  const coachContext = `${creatorMemory}\n\n${matchesContext}`;

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="min-h-screen pb-28 safe-top relative">
      <div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-prism z-50 pointer-events-none"
        style={{ boxShadow: "0 0 18px hsl(var(--primary) / 0.6)" }}
      />
      <Toaster theme="dark" position="top-center" richColors />

      {/* Confirmation flash overlay : preuve visuelle qu'une action a été effectuée */}
      <AnimatePresence>
        {actionFlash && (
          <motion.div
            key={actionFlash.id}
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-full glass-strong holo-border backdrop-blur-xl"
              style={{ boxShadow: "0 0 30px hsl(var(--primary) / 0.55)" }}
            >
              <motion.span
                initial={{ rotate: -90, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.05, type: "spring", stiffness: 400 }}
                className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20"
              >
                <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />
              </motion.span>
              <span className="text-sm font-bold tracking-wide holo-text">
                {actionFlash.label}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-primary/80 animate-pulse" />
            </div>
            {/* halo radiating */}
            <motion.div
              initial={{ opacity: 0.6, scale: 0.6 }}
              animate={{ opacity: 0, scale: 2.4 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="absolute inset-0 rounded-full bg-primary/30 blur-2xl -z-10"
            />
          </motion.div>
        )}
      </AnimatePresence>


      <header className="px-4 pt-3 pb-2 flex items-center justify-center max-w-md mx-auto w-full">
        {/* The single big logo opens settings on tap */}
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="flex items-center gap-3 tap"
          aria-label={showSettings ? "Retour" : "Paramètres"}
        >
          <HoloLogo icon={Cpu} size={56} />
          <div className="text-left">
            <h1 className="text-xl font-display font-black uppercase tracking-[0.22em] holo-text leading-none">
              Magic
            </h1>
            <p className="text-[8.5px] font-bold uppercase tracking-[0.3em] text-primary/85 mt-1.5">
              {showSettings ? "Fermer" : "Tap = Réglages"}
            </p>
          </div>
        </button>
      </header>

      <main className="px-4 pt-2 max-w-md mx-auto w-full">
        {showSettings ? (
          <SettingsView
            onBack={() => setShowSettings(false)}
            defaultStake={stake}
            onDefaultStakeChange={setStake}
            onResetHistory={() => setHistory([])}
          />
        ) : (
          <AnimatePresence mode="wait">
            {tab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-4"
              >
                <MagicHero
                  onMagicMode={handleMagicMode}
                  isLoading={isAnalyzing}
                />
                <MatchInput
                  matches={matches}
                  onAddMatch={(a, b) => addMatch(a, b)}
                  onRemoveMatch={removeMatch}
                  onClearAll={clearAnalysis}
                />
                <StakeAndAnalyze
                  stake={stake}
                  onStakeChange={setStake}
                  onAnalyze={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                  hasMatches={matches.length > 0}
                />
                <button
                  type="button"
                  onClick={() => setHighConfOnly((v) => !v)}
                  className={`group flex items-center justify-between gap-3 w-full rounded-xl border px-4 py-3 text-left transition ${
                    highConfOnly
                      ? "border-primary/70 bg-gradient-prism text-background shadow-[0_0_18px_hsl(var(--primary)/.45)]"
                      : "border-border/60 bg-card/50 text-foreground hover:border-primary/50"
                  }`}
                  aria-pressed={highConfOnly}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className={highConfOnly ? "" : "text-primary"} />
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.22em]">
                        Mode Magic · Confiance ≥ 88%
                      </div>
                      <div className={`text-[10px] mt-0.5 ${highConfOnly ? "opacity-90" : "text-muted-foreground"}`}>
                        Ne garde que les pronos très sûrs selon le modèle.
                      </div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      highConfOnly ? "bg-background/20" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {highConfOnly ? "ON" : "OFF"}
                  </span>
                </button>
                <StatsPanel predictions={predictions} stake={stake} />
                <AnalysisCards predictions={predictions} />
                <ActionFooter
                  onSave={handleSave}
                  onDeepAnalysis={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                />
              </motion.div>
            )}

            {tab === "calendar" && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <MatchCalendar
                  onAddMatch={(m) => {
                    addMatch(m.teamA, m.teamB, {
                      a: m.teamALogo,
                      b: m.teamBLogo,
                    });
                    toast.success(`${m.teamA} vs ${m.teamB} ajouté`);
                  }}
                />
              </motion.div>
            )}

            {tab === "top20" && (
              <motion.div
                key="top20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <Top20Combo />
              </motion.div>
            )}

            {tab === "tickets" && (
              <motion.div
                key="tickets"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <TicketsView
                  tickets={history}
                  onValidate={validateTicket}
                  onDelete={deleteTicket}
                  onClearAll={() => setHistory([])}
                  onSetPickResult={setPickResult}
                  onImport={(ticket) => {
                    setHistory((p) => [ticket, ...p]);
                    toast.success("Ticket importé");
                    flashAction("Ticket importé");
                  }}
                />
              </motion.div>
            )}

            {tab === "coach" && (
              <motion.div
                key="coach"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <VoiceCoach
                  context={coachContext}
                  onAddMatch={(a, b) => addMatch(a, b)}
                  onAnalyze={handleAnalyze}
                  onSave={handleSave}
                  onClear={clearAnalysis}
                  onNavigate={(t) => {
                    setTab(t);
                    flashAction(`Navigation → ${t}`);
                  }}
                  onSendPicks={handleSendPicks}
                  onTransferMatches={handleTransferMatches}
                />
              </motion.div>
            )}

            {tab === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <HistoryView
                  history={history}
                  onClear={() => setHistory([])}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {!showSettings && <TabBar active={tab} onChange={setTab} />}
    </div>
  );
};

export default MagicApp;
