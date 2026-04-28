import { useEffect, useRef, useState } from "react";
import { Crown, Mic, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { HoloCard } from "./HoloCard";

const CREATOR_KEY = "magic.creator.name";
const VOICE_FP_KEY = "magic.voice.fingerprint";

/**
 * Calcule une "empreinte vocale" simple à partir d'une capture de 3s :
 * - Moyenne FFT par bande (16 bandes) → hash stable, non réversible.
 * Ce n'est pas une reconnaissance cryptographique, juste un marqueur.
 */
async function captureVoiceFingerprint(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);

    const bandCount = 16;
    const bins = analyser.frequencyBinCount;
    const binsPerBand = Math.floor(bins / bandCount);
    const accum = new Array(bandCount).fill(0);
    let samples = 0;

    const started = performance.now();
    const buf = new Uint8Array(bins);
    await new Promise<void>((resolve) => {
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        for (let b = 0; b < bandCount; b++) {
          let s = 0;
          for (let i = 0; i < binsPerBand; i++) s += buf[b * binsPerBand + i];
          accum[b] += s / binsPerBand;
        }
        samples += 1;
        if (performance.now() - started < 3000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    try { ctx.close(); } catch { /* noop */ }
    const avg = accum.map((v) => Math.round(v / Math.max(1, samples)));
    return avg.map((n) => n.toString(16).padStart(2, "0")).join("");
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export const CreatorIdentity = () => {
  const [name, setName] = useState<string>(() => {
    try { return localStorage.getItem(CREATOR_KEY) || ""; } catch { return ""; }
  });
  const [fp, setFp] = useState<string>(() => {
    try { return localStorage.getItem(VOICE_FP_KEY) || ""; } catch { return ""; }
  });
  const [recording, setRecording] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(CREATOR_KEY, name.trim()); } catch { /* noop */ }
    }, 400);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [name]);

  const handleRecord = async () => {
    if (recording) return;
    setRecording(true);
    toast.message("Parle normalement 3 secondes pour enregistrer ta voix…");
    try {
      const hash = await captureVoiceFingerprint();
      localStorage.setItem(VOICE_FP_KEY, hash);
      setFp(hash);
      toast.success("Empreinte vocale enregistrée · Magic reconnaît ta voix");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Micro indisponible");
    } finally {
      setRecording(false);
    }
  };

  const clearFp = () => {
    localStorage.removeItem(VOICE_FP_KEY);
    setFp("");
    toast.success("Empreinte vocale effacée");
  };

  return (
    <HoloCard variant="cyan">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] holo-text">
            Identité du créateur
          </h3>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Nom / pseudo du créateur</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Ex : Boss, Karim, Baby…"
            className="h-10 rounded-xl bg-card/60 border border-primary/30 px-3 text-sm focus:outline-none focus:border-primary"
          />
          <span className="text-[10px] text-muted-foreground/80">
            Magic se souviendra de toi comme son créateur dans toutes ses réponses vocales.
          </span>
        </label>

        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-card/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
              <Mic className="w-4 h-4 text-primary" />
              Empreinte vocale
            </div>
            {fp ? (
              <span className="flex items-center gap-1 text-[10px] text-success font-bold uppercase tracking-widest">
                <CheckCircle2 className="w-3 h-3" />
                Enregistrée
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Aucune</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRecord}
              disabled={recording}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest disabled:opacity-60 active:scale-[0.98] transition"
            >
              {recording ? "Enregistrement… 3s" : fp ? "Réenregistrer" : "Enregistrer ma voix"}
            </button>
            {fp && (
              <button
                onClick={clearFp}
                className="h-10 w-10 rounded-lg border border-destructive/50 text-destructive flex items-center justify-center hover:bg-destructive/10 transition"
                aria-label="Effacer l'empreinte"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/80 leading-snug">
            Capture 3 secondes de timbre vocal (moyenne FFT locale, non envoyée). Stocké sur ton appareil.
          </p>
        </div>
      </div>
    </HoloCard>
  );
};
