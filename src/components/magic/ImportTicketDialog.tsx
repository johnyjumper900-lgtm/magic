import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Sparkles, Loader2, Image as ImageIcon, FileUp } from "lucide-react";
import { toast } from "sonner";
import { invokeFn } from "@/lib/api";
import type { HistoryItem } from "@/types/magic";

interface ImportTicketDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (ticket: HistoryItem) => void;
}

interface ParsedPick {
  match: string;
  teamA: string;
  teamB: string;
  option: string;
  type: string;
  odds: number;
}

interface ParsedTicket {
  picks: ParsedPick[];
  stake?: number;
  totalOdds?: number;
  bookmaker?: string;
  error?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ImportTicketDialog = ({ open, onClose, onImport }: ImportTicketDialogProps) => {
  const [text, setText] = useState("");
  const [stake, setStake] = useState(10);
  const [preview, setPreview] = useState<ParsedPick[]>([]);
  const [bookmaker, setBookmaker] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const runAiParse = async (opts: { fileBase64?: string; mimeType?: string; raw?: string }) => {
    setLoading(true);
    try {
      const { data, error } = await invokeFn<ParsedTicket>("analyze-ticket", {
        body: {
          fileBase64: opts.fileBase64,
          mimeType: opts.mimeType,
          text: opts.raw,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const picks = data?.picks ?? [];
      if (picks.length === 0) {
        toast.warning("Gemini n'a détecté aucun pari sur ce ticket");
      } else {
        toast.success(`${picks.length} pari(s) lus par Gemini`);
      }
      setPreview(picks);
      setBookmaker(data?.bookmaker);
      if (data?.stake) setStake(data.stake);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de lecture");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isImage || isPdf) {
        const b64 = await fileToBase64(file);
        await runAiParse({
          fileBase64: b64,
          mimeType: isPdf ? "application/pdf" : file.type || "image/jpeg",
        });
      } else {
        const raw = await file.text();
        setText(raw);
        await runAiParse({ raw });
      }
    } catch (e) {
      toast.error("Lecture du fichier impossible");
    }
  };

  const handleImport = () => {
    if (preview.length === 0) {
      toast.error("Aucun pari à importer");
      return;
    }
    const totalOdds = preview.reduce((a, p) => a * p.odds, 1);
    const ticket: HistoryItem = {
      id: crypto.randomUUID(),
      title:
        preview.length === 1
          ? preview[0].match
          : `Combiné ${bookmaker ? bookmaker + " · " : ""}${preview.length} matchs`,
      odds: totalOdds.toFixed(2),
      confidence: "—",
      profit: `+${(stake * totalOdds).toFixed(0)}€`,
      date: new Date().toLocaleDateString("fr-FR"),
      stake,
      // Auto-validation : le ticket est suivi automatiquement dès l'import
      status: "validated",
      validatedAt: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      potentialWin: stake * totalOdds,
      picks: preview.map((p) => ({
        match: p.match,
        option: p.option,
        type: p.type,
        odds: p.odds,
        probability: Math.round(100 / p.odds),
        result: "pending" as const,
      })),
    };
    onImport(ticket);
    setText("");
    setPreview([]);
    setFileName(null);
    setBookmaker(undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-md p-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md glass-strong holo-border rounded-3xl p-4 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-display font-black uppercase tracking-[0.2em] holo-text">
                  Import IA · Gemini
                </h3>
              </div>
              <button onClick={onClose} className="tap p-1.5 text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Gemini lit directement ta <strong className="text-foreground">photo</strong>,
              ton <strong className="text-foreground">PDF</strong> ou le texte du ticket et
              extrait tous tes paris automatiquement.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className="tap flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 cursor-pointer">
                <ImageIcon size={16} />
                <span className="text-[9.5px] font-bold uppercase tracking-widest">
                  Photo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
              <label className="tap flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 cursor-pointer">
                <FileUp size={16} />
                <span className="text-[9.5px] font-bold uppercase tracking-widest">
                  PDF / Fichier
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/*,text/plain,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </div>

            {fileName && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-2 py-1.5">
                <FileText size={11} className="text-primary" />
                <span className="truncate">{fileName}</span>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-3 text-primary">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Gemini lit le ticket…
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
              <div className="flex-1 h-px bg-border" />
              ou texte collé
              <div className="flex-1 h-px bg-border" />
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Colle le texte du ticket (ex Winamax / Betclic)…`}
              rows={4}
              className="w-full px-3 py-2 rounded-xl bg-background/60 border border-border text-[11px] text-foreground placeholder:text-muted-foreground font-mono resize-none focus:border-primary focus:outline-none"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => runAiParse({ raw: text })}
                disabled={!text.trim() || loading}
                className="tap flex-1 py-2 rounded-xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Sparkles size={12} />
                Analyser avec Gemini
              </button>
              <div className="flex items-center gap-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Mise
                </label>
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value) || 0)}
                  className="w-14 px-2 py-1.5 rounded-lg bg-background/60 border border-border text-[11px] text-foreground text-center focus:border-primary focus:outline-none"
                />
                <span className="text-[10px] text-muted-foreground">€</span>
              </div>
            </div>

            {preview.length > 0 && (
              <div className="flex flex-col gap-1.5 bg-muted/20 rounded-xl p-2 border border-border/40">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Aperçu IA · {preview.length} pari{preview.length > 1 ? "s" : ""}
                  {bookmaker ? ` · ${bookmaker}` : ""}
                </p>
                {preview.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[10.5px] gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground truncate">{p.match}</p>
                      <p className="text-muted-foreground truncate">
                        {p.type} · <span className="text-primary font-black">{p.option}</span>
                      </p>
                    </div>
                    <span className="font-display font-black holo-text">
                      {p.odds.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-border/40 text-[10px]">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest">
                    Cote totale
                  </span>
                  <span className="font-display font-black holo-text text-sm">
                    {preview.reduce((a, p) => a * p.odds, 1).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={preview.length === 0}
              className="tap w-full py-2.5 rounded-xl bg-success text-success-foreground font-display font-black uppercase tracking-[0.18em] text-[10px] disabled:opacity-40"
            >
              Importer & suivre auto
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
