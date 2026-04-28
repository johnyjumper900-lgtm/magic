import { useState, useRef } from "react";
import { X, Plus, ListPlus, Trash2, Mic, MicOff } from "lucide-react";
import type { Match } from "@/types/magic";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface MatchInputProps {
  matches: Match[];
  onAddMatch: (a: string, b: string) => void;
  onRemoveMatch: (id: string) => void;
  onClearAll?: () => void;
}

export const MatchInput = ({
  matches,
  onAddMatch,
  onRemoveMatch,
  onClearAll,
}: MatchInputProps) => {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const handleAdd = () => {
    if (teamA.trim() && teamB.trim()) {
      onAddMatch(teamA.trim(), teamB.trim());
      setTeamA("");
      setTeamB("");
    }
  };

  const parsePairs = (text: string): Array<{ a: string; b: string }> => {
    if (!text) return [];
    const cleaned = text.replace(/[*_`#>~]/g, " ");
    const sep = /\s+(?:vs\.?|v\.s\.?|versus|contre|face\s+\xe0|—|–|-)\s+/i;
    const out: Array<{ a: string; b: string }> = [];
    const parts = cleaned.split(/(?:[,;]|\s+puis\s+|\s+et\s+|\s+ensuite\s+|\.)/i);
    for (const p of parts) {
      const m = p.trim().split(sep);
      if (m.length >= 2) {
        const a = m[0].trim();
        const b = m[1].trim();
        if (a.length > 1 && b.length > 1) out.push({ a, b });
      }
    }
    return out;
  };

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Reconnaissance vocale non supportée par ce navigateur");
      return;
    }
    if (listening) {
      try { recRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const txt = e.results[0]?.[0]?.transcript ?? "";
      const pairs = parsePairs(txt);
      if (pairs.length === 0) {
        toast.warning(`Je n'ai pas compris : "${txt}". Dis par ex. : "PSG vs Marseille"`);
        return;
      }
      pairs.forEach((p) => onAddMatch(p.a, p.b));
      toast.success(`${pairs.length} match(s) ajouté(s) par la voix`);
    };
    rec.onerror = (e: any) => {
      toast.error(`Micro : ${e.error || "erreur"}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
    toast.info('Je t\'\xe9coute… Dis par ex. : "PSG vs Marseille"');
  };

  return (
    <HoloCard variant="cyan">
      <div className="p-3.5 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <HoloLogo icon={ListPlus} size={40} />
            <div>
              <h2 className="text-sm font-display font-black uppercase tracking-[0.18em] text-foreground">
                Tes matchs
              </h2>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                {matches.length}/20 sélectionnés
              </p>
            </div>
          </div>
          {matches.length > 0 && onClearAll && (
            <button
              onClick={onClearAll}
              className="tap p-2 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 transition shrink-0"
              aria-label="Effacer la liste d'analyse"
              title="Effacer la liste d'analyse"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="flex items-stretch gap-1.5 w-full">
          <input
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            placeholder="Équipe A"
            className="flex-1 min-w-0 w-0 px-2.5 py-2.5 rounded-xl bg-background/60 border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            autoCapitalize="words"
          />
          <span className="shrink-0 self-center text-muted-foreground text-[10px] font-black px-0.5">
            VS
          </span>
          <input
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            placeholder="Équipe B"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 min-w-0 w-0 px-2.5 py-2.5 rounded-xl bg-background/60 border border-border text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            autoCapitalize="words"
          />
          <button
            onClick={startVoice}
            className={`tap shrink-0 w-10 h-10 self-center rounded-xl flex items-center justify-center transition ${
              listening
                ? "bg-destructive/80 shadow-prism animate-pulse"
                : "bg-secondary/80 hover:bg-secondary shadow-holo"
            }`}
            aria-label={listening ? "Arrêter le micro" : "Dicter X vs Y"}
            title={listening ? "Arrêter" : "Dicter X vs Y"}
          >
            {listening ? <MicOff size={16} className="text-white" /> : <Mic size={16} className="text-white" />}
          </button>
          <button
            onClick={handleAdd}
            className="tap shrink-0 w-10 h-10 self-center rounded-xl bg-gradient-holo flex items-center justify-center shadow-holo"
            aria-label="Ajouter"
          >
            <Plus size={18} className="text-primary-foreground" />
          </button>
        </div>

        {matches.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto scrollbar-none">
            <AnimatePresence>
              {matches.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/60"
                >
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">
                    {m.teamA}{" "}
                    <span className="text-muted-foreground italic">vs</span>{" "}
                    {m.teamB}
                  </span>
                  <button
                    onClick={() => onRemoveMatch(m.id)}
                    className="tap text-destructive shrink-0"
                    aria-label="Retirer"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </HoloCard>
  );
};
