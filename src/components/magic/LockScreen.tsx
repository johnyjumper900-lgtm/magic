import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete } from "lucide-react";
import { toast } from "sonner";

// Codes acceptés (insensibles à la casse). "187" = raccourci rapide.
const UNLOCK_CODES = ["187code", "187"];
// Durée de session déverrouillée (12 heures)
export const UNLOCK_SESSION_MS = 12 * 60 * 60 * 1000;
export const UNLOCK_STORAGE_KEY = "magic.unlock.until";

export const isUnlockedNow = () => {
  try {
    const raw = localStorage.getItem(UNLOCK_STORAGE_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
};

const persistUnlock = () => {
  try {
    localStorage.setItem(
      UNLOCK_STORAGE_KEY,
      String(Date.now() + UNLOCK_SESSION_MS),
    );
  } catch {
    /* noop */
  }
};

interface LockScreenProps {
  onUnlock: () => void;
}

// Web Speech API typings (loose)
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const haptic = (ms = 10) => {
  try {
    if ("vibrate" in navigator) (navigator as any).vibrate?.(ms);
  } catch {
    /* noop */
  }
};

/** Realistic padlock (SVG) — metallic shackle + brushed body + keyhole */
const RealisticPadlock = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 240 280"
    className="w-full h-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)]"
    aria-hidden
  >
    <defs>
      {/* Shackle — polished steel */}
      <linearGradient id="shackle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f4f6fa" />
        <stop offset="18%" stopColor="#c9ced6" />
        <stop offset="45%" stopColor="#7d8591" />
        <stop offset="70%" stopColor="#b6bcc6" />
        <stop offset="100%" stopColor="#4a5260" />
      </linearGradient>
      <linearGradient id="shackleInner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2a2f38" />
        <stop offset="100%" stopColor="#0e1116" />
      </linearGradient>
      {/* Body — brushed dark metal with primary tint */}
      <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(var(--primary) / 0.35)" />
        <stop offset="30%" stopColor="#1e232c" />
        <stop offset="65%" stopColor="#0c0f14" />
        <stop offset="100%" stopColor="#05070a" />
      </linearGradient>
      <linearGradient id="bodyEdge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
      </linearGradient>
      <radialGradient id="bodyHighlight" cx="0.3" cy="0.2" r="0.7">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
      </radialGradient>
      <filter id="soft">
        <feGaussianBlur stdDeviation="1.1" />
      </filter>
    </defs>

    {/* Aura */}
    <ellipse cx="120" cy="270" rx="90" ry="8" fill="#000" opacity="0.45" />
    <circle cx="120" cy="175" r="120" fill="url(#glow)" />

    {/* Shackle */}
    <g>
      <motion.path
        initial={false}
        animate={{ y: open ? -22 : 0, rotate: open ? -14 : 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        style={{ transformOrigin: "178px 110px" }}
        d="M 62 140 V 92 a 58 58 0 0 1 116 0 V 140"
        fill="none"
        stroke="url(#shackle)"
        strokeWidth="26"
        strokeLinecap="round"
      />
      {/* Inner shadow line on shackle */}
      <motion.path
        initial={false}
        animate={{ y: open ? -22 : 0, rotate: open ? -14 : 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        style={{ transformOrigin: "178px 110px" }}
        d="M 62 140 V 92 a 58 58 0 0 1 116 0 V 140"
        fill="none"
        stroke="url(#shackleInner)"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Shackle highlight */}
      <motion.path
        initial={false}
        animate={{ y: open ? -22 : 0, rotate: open ? -14 : 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        style={{ transformOrigin: "178px 110px" }}
        d="M 70 138 V 94 a 50 50 0 0 1 50 -50"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
        filter="url(#soft)"
      />
    </g>

    {/* Body */}
    <g>
      <rect x="28" y="132" width="184" height="128" rx="26" fill="url(#body)" />
      <rect
        x="28"
        y="132"
        width="184"
        height="128"
        rx="26"
        fill="url(#bodyHighlight)"
      />
      <rect
        x="28.5"
        y="132.5"
        width="183"
        height="127"
        rx="25.5"
        fill="none"
        stroke="url(#bodyEdge)"
        strokeWidth="1"
      />
      {/* Primary edge glow */}
      <rect
        x="28"
        y="132"
        width="184"
        height="128"
        rx="26"
        fill="none"
        stroke="hsl(var(--primary) / 0.7)"
        strokeWidth="1.2"
      />
      {/* Top reflection */}
      <rect
        x="40"
        y="140"
        width="160"
        height="22"
        rx="12"
        fill="#ffffff"
        opacity="0.06"
      />
      {/* Keyhole */}
      <g transform="translate(120 200)">
        <circle r="14" fill="#05070a" />
        <circle r="14" fill="none" stroke="hsl(var(--primary) / 0.6)" strokeWidth="1" />
        <rect x="-3" y="4" width="6" height="22" rx="2" fill="#05070a" />
        <circle r="5" fill="hsl(var(--primary) / 0.35)" />
      </g>
      {/* Rivets */}
      {[
        [48, 152],
        [192, 152],
        [48, 240],
        [192, 240],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="4" fill="#2a2f38" />
          <circle cx={cx - 1} cy={cy - 1} r="1.5" fill="#ffffff" opacity="0.5" />
        </g>
      ))}
    </g>
  </svg>
);

export const LockScreen = ({ onUnlock }: LockScreenProps) => {
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const doUnlock = () => {
    setUnlocked(true);
    haptic(30);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setTimeout(() => onUnlock(), 750);
  };

  // Silent voice unlock: listens in background for « bébé » (never shown in UI)
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec: SpeechRecognitionLike = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "fr-FR";

    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = String(e.results[i][0].transcript || "")
          .toLowerCase()
          .trim();
        const matches =
          transcript.includes("bébé") ||
          transcript.includes("bebe") ||
          transcript.includes("baby") ||
          transcript.includes("magic ouvre") ||
          transcript.includes("ouvre magic") ||
          /\bbé\s*bé\b/.test(transcript);
        if (matches) {
          persistUnlock();
          doUnlock();
          return;
        }
      }
    };
    rec.onerror = () => {
      /* silent */
    };
    rec.onend = () => {
      try {
        rec.start();
      } catch {
        /* noop */
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      /* noop — will retry on user gesture */
    }

    // Best-effort re-arm on first user gesture (iOS Safari)
    const rearm = () => {
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };
    window.addEventListener("pointerdown", rearm, { once: true });
    window.addEventListener("touchstart", rearm, { once: true });

    return () => {
      window.removeEventListener("pointerdown", rearm);
      window.removeEventListener("touchstart", rearm);
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryCode = (value: string) => {
    const v = value.trim().toLowerCase();
    if (UNLOCK_CODES.includes(v)) {
      toast.success("Accès autorisé");
      persistUnlock();
      doUnlock();
    } else {
      setShake(true);
      haptic(80);
      toast.error("Code incorrect");
      setTimeout(() => setShake(false), 500);
      setCode("");
    }
  };

  const pressKey = (k: string) => {
    haptic(8);
    setCode((c) => (c.length >= 12 ? c : c + k));
  };
  const backspace = () => {
    haptic(8);
    setCode((c) => c.slice(0, -1));
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "c", "0", "⌫"];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden select-none"
      style={{
        background:
          "radial-gradient(140% 90% at 50% 0%, hsl(var(--primary) / 0.18), transparent 55%), linear-gradient(180deg, #05070a 0%, #0a0d14 100%)",
        paddingTop: "max(env(safe-area-inset-top), 1.25rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
        paddingLeft: "max(env(safe-area-inset-left), 1rem)",
        paddingRight: "max(env(safe-area-inset-right), 1rem)",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        WebkitUserSelect: "none",
      }}
    >
      {/* Title */}
      <div className="relative z-10 flex flex-col items-center pt-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary/80">
          Zone protégée
        </p>
        <h1 className="mt-1 text-xl font-display font-black uppercase tracking-[0.28em] holo-text">
          Magic verrouillé
        </h1>
      </div>

      {/* Padlock — occupies available space */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-2">
        <motion.div
          animate={
            shake
              ? { x: [-10, 10, -8, 8, -4, 4, 0] }
              : unlocked
                ? { scale: [1, 1.08, 0.9], opacity: [1, 1, 0] }
                : { y: [0, -6, 0] }
          }
          transition={
            shake
              ? { duration: 0.5 }
              : unlocked
                ? { duration: 0.7 }
                : { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }
          className="w-[min(62vw,240px)] aspect-[240/280]"
        >
          <RealisticPadlock open={unlocked} />
        </motion.div>
      </div>

      {/* Code dots */}
      <div className="relative z-10 flex justify-center gap-2.5 mb-3">
        {Array.from({ length: Math.max(6, code.length) }).map((_, i) => {
          const filled = i < code.length;
          return (
            <motion.div
              key={i}
              animate={shake ? { x: [-6, 6, -4, 4, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: filled
                  ? "hsl(var(--primary))"
                  : "hsl(var(--muted-foreground) / 0.25)",
                boxShadow: filled
                  ? "0 0 12px hsl(var(--primary) / 0.9)"
                  : "none",
              }}
            />
          );
        })}
      </div>

      {/* Hidden input for hardware keyboards / autofill */}
      <input
        aria-label="Code"
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value.slice(0, 12))}
        onKeyDown={(e) => {
          if (e.key === "Enter") tryCode(code);
        }}
        className="sr-only"
      />

      {/* Keypad */}
      <div className="relative z-10 mx-auto w-full max-w-[320px] grid grid-cols-3 gap-2.5 px-2">
        {keys.map((k) => {
          if (k === "⌫") {
            return (
              <button
                key={k}
                type="button"
                onClick={backspace}
                className="h-14 rounded-2xl bg-card/50 border border-border/60 flex items-center justify-center text-muted-foreground active:scale-95 active:bg-card/80 transition"
                style={{ WebkitTapHighlightColor: "transparent" }}
                aria-label="Effacer"
              >
                <Delete className="w-5 h-5" />
              </button>
            );
          }
          if (k === "c") {
            return (
              <button
                key={k}
                type="button"
                onClick={() => pressKey("code")}
                className="h-14 rounded-2xl bg-card/50 border border-border/60 flex items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-primary active:scale-95 active:bg-card/80 transition"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                code
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              onClick={() => pressKey(k)}
              className="h-14 rounded-2xl bg-card/60 border border-border/60 flex items-center justify-center text-2xl font-semibold text-foreground active:scale-95 active:bg-card/90 transition"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {k}
            </button>
          );
        })}
      </div>

      {/* Validate */}
      <div className="relative z-10 mx-auto w-full max-w-[320px] px-2 mt-3">
        <button
          type="button"
          onClick={() => tryCode(code)}
          disabled={code.length === 0 || unlocked}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-[0.25em] text-xs active:scale-[0.98] disabled:opacity-40 transition"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Déverrouiller
        </button>
      </div>

      <AnimatePresence>
        {unlocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.35), transparent 60%)",
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
