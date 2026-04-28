import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles, User, Check } from "lucide-react";
import { toast } from "sonner";
import { HoloLogo } from "./HoloLogo";

export interface UserProfile {
  firstName: string;
  voiceFingerprint?: number[]; // averaged frequency spectrum
  createdAt: string;
}

const PROFILE_KEY = "magic.user.profile.v1";

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveUserProfile(p: UserProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* noop */
  }
}

/**
 * Capture an average frequency spectrum from ~3s of microphone audio.
 * This serves as a lightweight "voice fingerprint" usable for cosine
 * similarity comparison on subsequent recordings.
 */
async function captureVoiceFingerprint(seconds = 3): Promise<number[]> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const bins = analyser.frequencyBinCount;
  const sum = new Float32Array(bins);
  let frames = 0;

  const start = Date.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const arr = new Uint8Array(bins);
      analyser.getByteFrequencyData(arr);
      let energy = 0;
      for (let i = 0; i < bins; i++) {
        sum[i] += arr[i];
        energy += arr[i];
      }
      if (energy > 50) frames++;
      if (Date.now() - start >= seconds * 1000) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });

  stream.getTracks().forEach((t) => t.stop());
  ctx.close();

  if (frames < 5) throw new Error("Pas assez de voix captée — réessaie en parlant plus fort");
  const fp = Array.from(sum).map((v) => v / Math.max(frames, 1));
  // L2 normalize
  const norm = Math.sqrt(fp.reduce((s, x) => s + x * x, 0)) || 1;
  return fp.map((x) => x / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

interface Props {
  onComplete: (p: UserProfile) => void;
}

export const OnboardingScreen = ({ onComplete }: Props) => {
  const [step, setStep] = useState<"name" | "voice" | "done">("name");
  const [name, setName] = useState("");
  const [recording, setRecording] = useState(false);
  const fpRef = useRef<number[] | null>(null);

  const handleNameNext = () => {
    if (name.trim().length < 2) {
      toast.error("Donne-moi ton prénom (au moins 2 lettres)");
      return;
    }
    setStep("voice");
  };

  const handleRecord = async () => {
    if (recording) return;
    setRecording(true);
    try {
      toast.info("Parle pendant 3 secondes : présente-toi à voix haute");
      const fp = await captureVoiceFingerprint(3);
      fpRef.current = fp;
      toast.success("Voix mémorisée ✨");
      setStep("done");
    } catch (e: any) {
      toast.error(e.message || "Capture audio échouée");
    } finally {
      setRecording(false);
    }
  };

  const handleSkipVoice = () => {
    setStep("done");
  };

  const handleFinish = () => {
    const profile: UserProfile = {
      firstName: name.trim(),
      voiceFingerprint: fpRef.current ?? undefined,
      createdAt: new Date().toISOString(),
    };
    saveUserProfile(profile);
    onComplete(profile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background">
      <div className="absolute inset-0 grid-floor opacity-30 pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm glass-strong holo-border rounded-3xl p-6 flex flex-col gap-5 z-10"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <HoloLogo icon={Sparkles} size={56} />
          <h1 className="text-xl font-display font-black uppercase tracking-[0.18em] holo-text">
            Bienvenue
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Configuration · Première utilisation
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "name" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex flex-col gap-3"
            >
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <User size={12} /> Comment je dois t'appeler ?
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNameNext()}
                placeholder="Ton prénom"
                autoFocus
                className="px-3.5 py-3 rounded-xl bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleNameNext}
                className="tap w-full py-3 rounded-xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-[0.18em] text-[11px] shadow-holo"
              >
                Suivant
              </button>
            </motion.div>
          )}

          {step === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex flex-col gap-3"
            >
              <p className="text-xs text-foreground text-center">
                Salut <span className="holo-text font-black">{name}</span> !<br />
                Enregistre ta voix pour que je te reconnaisse.
              </p>
              <p className="text-[10px] text-muted-foreground text-center italic">
                Astuce : dis "Je m'appelle {name}, je suis le boss du Magicien"
              </p>
              <button
                onClick={handleRecord}
                disabled={recording}
                className={`tap w-full py-4 rounded-xl flex items-center justify-center gap-2 font-display font-black uppercase tracking-[0.18em] text-[11px] ${
                  recording
                    ? "bg-destructive/80 text-white animate-pulse"
                    : "bg-gradient-holo text-primary-foreground shadow-holo"
                }`}
              >
                <Mic size={16} className={recording ? "animate-pulse" : ""} />
                {recording ? "Écoute… (3s)" : "Enregistrer ma voix"}
              </button>
              <button
                onClick={handleSkipVoice}
                className="tap text-[10px] uppercase tracking-widest text-muted-foreground py-2"
              >
                Passer cette étape
              </button>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-success/20 border border-success/40 flex items-center justify-center">
                  <Check size={22} className="text-success" />
                </div>
                <p className="text-xs text-foreground">
                  Tout est prêt, <span className="holo-text font-black">{name}</span>.
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {fpRef.current
                    ? "Voix mémorisée — je te reconnaîtrai à la prochaine ouverture"
                    : "Tu pourras enregistrer ta voix plus tard dans Réglages"}
                </p>
              </div>
              <button
                onClick={handleFinish}
                className="tap w-full py-3 rounded-xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-[0.18em] text-[11px] shadow-holo"
              >
                Entrer dans le Magicien
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
