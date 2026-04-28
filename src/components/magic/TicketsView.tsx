import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket as TicketIcon,
  Trash2,
  Clock,
  Trophy,
  X,
  Upload,
  Radio,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import type { HistoryItem } from "@/types/magic";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";
import { ImportTicketDialog } from "./ImportTicketDialog";

interface TicketsViewProps {
  tickets: HistoryItem[];
  onValidate: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onSetPickResult?: (
    ticketId: string,
    pickIndex: number,
    result: "won" | "lost" | "pending",
  ) => void;
  onImport?: (ticket: HistoryItem) => void;
}

type GlobalStatus = "won" | "lost" | "live" | "draft";

const computeGlobalStatus = (t: HistoryItem): GlobalStatus => {
  if (t.status !== "validated") return "draft";
  const picks = t.picks ?? [];
  if (picks.length === 0) return "live";
  if (picks.some((p) => p.result === "lost")) return "lost";
  if (picks.every((p) => p.result === "won")) return "won";
  return "live";
};

type FilterKey = "all" | "live" | "won" | "lost" | "draft";

const FILTERS: Array<{ key: FilterKey; label: string; icon: typeof Radio }> = [
  { key: "all", label: "Tous", icon: TicketIcon },
  { key: "live", label: "En cours", icon: Radio },
  { key: "won", label: "Gagnés", icon: Trophy },
  { key: "lost", label: "Perdus", icon: XCircle },
  { key: "draft", label: "Brouillons", icon: Sparkles },
];

export const TicketsView = ({
  tickets,
  onValidate,
  onDelete,
  onClearAll,
  onImport,
}: TicketsViewProps) => {
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    const acc = { all: tickets.length, live: 0, won: 0, lost: 0, draft: 0 };
    for (const t of tickets) {
      const s = computeGlobalStatus(t);
      acc[s] += 1;
    }
    return acc;
  }, [tickets]);

  const visible = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => {
      const sa = computeGlobalStatus(a);
      const sb = computeGlobalStatus(b);
      // Ordre : live → draft → won → lost
      const order: Record<GlobalStatus, number> = { live: 0, draft: 1, won: 2, lost: 3 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return (b.validatedAt || b.date || "").localeCompare(a.validatedAt || a.date || "");
    });
    if (filter === "all") return sorted;
    return sorted.filter((t) => computeGlobalStatus(t) === filter);
  }, [tickets, filter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <HoloLogo icon={TicketIcon} size={40} />
          <div>
            <h2 className="text-sm font-display font-black uppercase tracking-[0.18em] holo-text">
              Mes Paris
            </h2>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
              {tickets.length} ticket{tickets.length > 1 ? "s" : ""} · suivi auto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onImport && (
            <button
              onClick={() => setImportOpen(true)}
              className="tap px-2.5 py-1.5 rounded-lg bg-gradient-holo text-primary-foreground flex items-center gap-1 text-[9px] font-black uppercase tracking-widest shadow-holo"
              aria-label="Importer"
            >
              <Upload size={11} />
              Importer
            </button>
          )}
          {tickets.length > 0 && (
            <button
              onClick={onClearAll}
              className="tap text-destructive p-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
              aria-label="Tout effacer"
            >
              <Trash2 size={12} />
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Filtres classement dynamique */}
      {tickets.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key];
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`tap shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9.5px] font-black uppercase tracking-widest border transition-all ${
                  active
                    ? "bg-gradient-holo text-primary-foreground border-transparent shadow-holo"
                    : "bg-muted/20 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                <Icon size={10} />
                {f.label}
                <span
                  className={`px-1.5 rounded-full text-[8.5px] ${
                    active ? "bg-background/25" : "bg-muted/40"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tickets.length === 0 ? (
        <HoloCard variant="violet">
          <div className="p-8 text-center">
            <p className="text-xs text-muted-foreground">
              Aucun ticket pour le moment.<br />
              Importe une photo ou un PDF de ton ticket — Gemini lit tout tout seul.
            </p>
          </div>
        </HoloCard>
      ) : visible.length === 0 ? (
        <div className="p-6 text-center text-[11px] text-muted-foreground">
          Aucun ticket dans cette catégorie.
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {visible.map((t) => {
            const status = computeGlobalStatus(t);
            const isValidated = t.status === "validated";
            const picks = t.picks ?? [];
            const wonCount = picks.filter((p) => p.result === "won").length;
            const lostCount = picks.filter((p) => p.result === "lost").length;
            const settled = wonCount + lostCount;
            const progressPct = picks.length ? (wonCount / picks.length) * 100 : 0;

            const badge =
              status === "won"
                ? { label: "Gagné", cls: "bg-success text-success-foreground", Icon: Trophy }
                : status === "lost"
                  ? { label: "Perdu", cls: "bg-destructive text-destructive-foreground", Icon: XCircle }
                  : status === "live"
                    ? { label: "En cours", cls: "bg-primary/20 text-primary border border-primary/40", Icon: Radio }
                    : { label: "Brouillon", cls: "bg-muted text-muted-foreground", Icon: Sparkles };

            const cardVariant =
              status === "won" ? "cyan" : status === "lost" ? "violet" : "violet";

            const BadgeIcon = badge.Icon;

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", damping: 24, stiffness: 260 }}
              >
                <HoloCard variant={cardVariant}>
                  <div className="p-4 flex flex-col gap-3 relative">
                    {/* Overlay gagné / perdu */}
                    {(status === "won" || status === "lost") && (
                      <div
                        className={`absolute -top-1 -right-1 w-14 h-14 rounded-full flex items-center justify-center pointer-events-none ${
                          status === "won"
                            ? "bg-success/20 border-2 border-success"
                            : "bg-destructive/20 border-2 border-destructive"
                        }`}
                        style={{
                          boxShadow:
                            status === "won"
                              ? "0 0 24px hsl(var(--success) / 0.6)"
                              : "0 0 24px hsl(var(--destructive) / 0.6)",
                        }}
                      >
                        {status === "won" ? (
                          <Trophy className="text-success" size={22} strokeWidth={2.5} />
                        ) : (
                          <X className="text-destructive" size={26} strokeWidth={3} />
                        )}
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border/40 pb-2 gap-2">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-foreground">
                            Combiné ({picks.length})
                          </span>
                          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                            #{t.id.slice(0, 6).toUpperCase()}
                          </span>
                        </div>
                        {/* Boules auto, lecture seule */}
                        {picks.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {picks.map((p, i) => {
                              const r = p.result ?? "pending";
                              const base =
                                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all";
                              const cls =
                                r === "won"
                                  ? "bg-success text-success-foreground shadow-[0_0_8px_hsl(var(--success)/0.6)]"
                                  : r === "lost"
                                    ? "bg-destructive text-destructive-foreground shadow-[0_0_8px_hsl(var(--destructive)/0.6)]"
                                    : "bg-muted text-muted-foreground border border-border animate-pulse";
                              return (
                                <div
                                  key={i}
                                  className={`${base} ${cls}`}
                                  aria-label={`Pari ${i + 1} ${r}`}
                                  title={`Pari ${i + 1} · ${r === "pending" ? "en cours" : r}`}
                                >
                                  {r === "won" ? (
                                    <Trophy size={11} strokeWidth={3} />
                                  ) : r === "lost" ? (
                                    <X size={12} strokeWidth={3} />
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${badge.cls}`}
                        >
                          <BadgeIcon size={10} />
                          {badge.label}
                        </span>
                        <button
                          onClick={() => onDelete(t.id)}
                          className="tap text-destructive p-1"
                          aria-label="Effacer ce ticket"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <h4 className="text-sm font-display font-black text-foreground uppercase tracking-wide">
                        {t.title}
                      </h4>
                      <p className="text-[9.5px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock size={9} />
                        {isValidated && t.validatedAt
                          ? `Validé le ${t.validatedAt}`
                          : `Créé le ${t.date}`}
                      </p>
                    </div>

                    {/* Progression */}
                    {isValidated && picks.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest mb-1">
                          <span className="text-muted-foreground">Progression auto</span>
                          <span className="text-primary">
                            {settled}/{picks.length} décidés · {wonCount} ✓ · {lostCount} ✗
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${status === "lost" ? 100 : progressPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={`h-full ${
                              status === "lost"
                                ? "bg-destructive"
                                : status === "won"
                                  ? "bg-success"
                                  : "bg-gradient-prism"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Picks list */}
                    {picks.length > 0 && (
                      <div className="flex flex-col gap-1.5 bg-muted/20 rounded-lg p-2 border border-border/40">
                        {picks.map((p, i) => {
                          const r = p.result ?? "pending";
                          const dotCls =
                            r === "won"
                              ? "bg-success"
                              : r === "lost"
                                ? "bg-destructive"
                                : "bg-muted-foreground/40 animate-pulse";
                          const optionCls =
                            r === "won"
                              ? "text-success"
                              : r === "lost"
                                ? "text-destructive line-through"
                                : "text-primary";
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 text-[10px]"
                            >
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-foreground truncate">
                                  {p.match}
                                </p>
                                <p className="text-muted-foreground truncate">
                                  {p.type} ·{" "}
                                  <span className={`font-black ${optionCls}`}>
                                    {p.option}
                                  </span>
                                </p>
                              </div>
                              <span className="font-display font-black holo-text shrink-0">
                                {p.odds.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Recap */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="glass rounded-lg p-2">
                        <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
                          Mise
                        </p>
                        <p className="text-xs font-display font-black text-foreground mt-0.5">
                          {(t.stake ?? 0).toFixed(0)}€
                        </p>
                      </div>
                      <div className="glass rounded-lg p-2">
                        <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
                          Cote totale
                        </p>
                        <p className="text-xs font-display font-black holo-text mt-0.5">
                          {t.odds}
                        </p>
                      </div>
                      <div className="glass rounded-lg p-2">
                        <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">
                          {status === "won"
                            ? "Gain"
                            : status === "lost"
                              ? "Perte"
                              : "Gain pot."}
                        </p>
                        <p
                          className={`text-xs font-display font-black mt-0.5 ${
                            status === "lost"
                              ? "text-destructive"
                              : status === "won"
                                ? "text-success"
                                : "text-gold"
                          }`}
                        >
                          {status === "lost"
                            ? `-${(t.stake ?? 0).toFixed(0)}€`
                            : t.profit}
                        </p>
                      </div>
                    </div>

                    {/* Actions : seulement pour les brouillons */}
                    {!isValidated && (
                      <button
                        onClick={() => onValidate(t.id)}
                        className="tap w-full py-2.5 rounded-xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-[0.18em] text-[10px] flex items-center justify-center gap-2 shadow-holo"
                      >
                        <CheckCircle2 size={14} />
                        Valider & suivre automatiquement
                      </button>
                    )}
                    {isValidated && status === "live" && (
                      <p className="text-center text-[9px] text-muted-foreground italic flex items-center justify-center gap-1">
                        <Radio size={10} className="text-primary animate-pulse" />
                        Résultats mis à jour automatiquement via le score réel
                      </p>
                    )}
                  </div>
                </HoloCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
      {onImport && (
        <ImportTicketDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImport={onImport}
        />
      )}
    </div>
  );
};
