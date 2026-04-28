import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Send, Loader2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/magic";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";
import { CoachOrb3D } from "./CoachOrb3D";
import { getUserApiKeys, userKeysToHeaders } from "@/lib/user-api-keys";

type SRConstructor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
  }>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface VoiceCommands {
  /** Ajoute un match équipe A vs équipe B */
  onAddMatch?: (a: string, b: string) => void;
  /** Lance l'analyse IA */
  onAnalyze?: () => void;
  /** Sauvegarde le combiné courant */
  onSave?: () => void;
  /** Vide la liste d'analyse */
  onClear?: () => void;
  /** Change de page : "dashboard" | "calendar" | "top20" | "coach" | "history" */
  onNavigate?: (tab: "dashboard" | "calendar" | "top20" | "coach" | "history") => void;
  /** Envoie le prono courant (matchs déjà saisis) — équivalent navigation + analyse */
  onSendPicks?: () => void;
  /** Transfère une liste de matchs vers le dashboard et lance l'analyse */
  onTransferMatches?: (pairs: Array<{ a: string; b: string }>) => void;
}

/**
 * Extrait toutes les paires "Équipe A vs Équipe B" d'un texte libre.
 * Reconnaît : vs, v.s., versus, contre, -, –, —, "face à".
 */
function extractMatchPairs(text: string): Array<{ a: string; b: string }> {
  if (!text) return [];
  const cleaned = text.replace(/[*_`#>~]/g, " ");
  const sep = /\s+(?:vs\.?|v\.s\.?|versus|contre|face\s+à|—|–|-)\s+/i;
  const out: Array<{ a: string; b: string }> = [];
  const seen = new Set<string>();
  // Découpe par lignes ET phrases pour capter "PSG vs OM. Real vs Barça."
  const segments = cleaned
    .split(/[\n\r;.•·▪►→]+/)
    .flatMap((s) => s.split(/,(?=\s*[A-ZÀ-Ÿ])/));
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg || seg.length > 120) continue;
    const m = seg.match(
      /([A-Za-zÀ-ÿ0-9.'’&\- ]{2,40}?)\s+(?:vs\.?|v\.s\.?|versus|contre|face\s+à|—|–|-)\s+([A-Za-zÀ-ÿ0-9.'’&\- ]{2,40})/i,
    );
    if (!m) continue;
    const a = m[1].replace(/^[^A-Za-zÀ-ÿ0-9]+/, "").trim();
    const b = m[2].replace(/[^A-Za-zÀ-ÿ0-9]+$/, "").trim();
    if (a.length < 2 || b.length < 2) continue;
    const key = `${a.toLowerCase()}|${b.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ a, b });
    if (out.length >= 20) break;
  }
  return out;
}

interface VoiceCoachProps extends VoiceCommands {
  context?: string;
}

/**
 * Sélectionne la meilleure voix française masculine disponible.
 * Sur Chrome/Edge: "Google français", "Microsoft Paul"/"Henri".
 * Sur Safari/iOS: "Thomas", "Daniel".
 */
function pickFrenchMaleVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  if (fr.length === 0) return null;

  const malePatterns = [
    /paul/i, /henri/i, /thomas/i, /nicolas/i, /sebastien/i, /jean/i,
    /antoine/i, /etienne/i, /daniel/i, /alexandre/i,
    /\bmale\b/i, /homme/i, /masculin/i,
  ];
  for (const re of malePatterns) {
    const v = fr.find((v) => re.test(v.name));
    if (v) return v;
  }
  // Préférer "Google français" qui sonne plutôt grave
  const google = fr.find((v) => /google/i.test(v.name));
  if (google) return google;
  return fr[0] ?? null;
}

/**
 * Détecte une commande vocale et l'exécute.
 * `lastAssistantText` = dernier message de Magic, utilisé pour extraire ses pronos.
 */
function tryExecuteCommand(
  text: string,
  commands: VoiceCommands,
  speak: (s: string) => void,
  lastAssistantText: string,
  allAssistantText: string = "",
): boolean {
  const t = text.toLowerCase().trim();

  // Navigation
  const navMap: Array<[RegExp, "dashboard" | "calendar" | "top20" | "coach" | "history", string]> = [
    [/(va|aller|ouvre|montre).*(top\s*20|top vingt)/i, "top20", "J'ouvre le top 20."],
    [/(va|aller|ouvre|montre).*(calendrier|live|matchs?\s*du\s*jour)/i, "calendar", "J'ouvre le calendrier."],
    [/(va|aller|ouvre|montre).*(historique|sauvegard)/i, "history", "J'ouvre l'historique."],
    [/(va|aller|ouvre|montre|retour).*(dashboard|accueil|principal)/i, "dashboard", "Je reviens à l'analyse."],
  ];
  for (const [re, tab, msg] of navMap) {
    if (re.test(t)) {
      commands.onNavigate?.(tab);
      speak(msg);
      return true;
    }
  }

  // Effacer
  if (/(efface|vide|supprime|reset|nettoie).*(liste|analyse|match|tout)/i.test(t)) {
    commands.onClear?.();
    speak("Voilà, la liste d'analyse est vidée.");
    return true;
  }

  // Sauvegarder
  if (/(sauvegard|enregistr|garde|save).*(combin|prono|analyse|pari|ticket)/i.test(t) ||
      /^(sauvegarde|enregistre|garde|save)\b/i.test(t)) {
    commands.onSave?.();
    speak("Je sauvegarde ton combiné dans l'historique.");
    return true;
  }

  // Transférer les pronos de Magic vers Vos Matchs (intent très large)
  // Capte : "transfère", "envoie", "mets", "ajoute", "balance", "passe", "copie", "importe"
  // suivi (ou non) de "tes pronos / tes matchs / ça / les / dans l'analyse / vos matchs"
  const transferIntent =
    /(transf[eè]re|envoie|envoi|mets?|met|ajoute|balance|passe|copie|importe|pousse|injecte)\b.*?(prono|pr[ée]diction|match|pari|ça|cela|les|ceux-l[aà]|tout)/i.test(t) ||
    /(transf[eè]re|envoie|mets?|copie|importe)\s+(les|ça|cela|tout)\b/i.test(t) ||
    /(dans|vers|sur)\s+(vos|tes|mes|les)?\s*match/i.test(t) ||
    /dans\s+(l[' ]?analyse|le\s+dashboard|module)/i.test(t);

  if (transferIntent) {
    // Cherche dans le dernier message, puis dans TOUS les messages assistant
    let pairs = extractMatchPairs(lastAssistantText);
    if (pairs.length === 0 && allAssistantText) {
      const all = extractMatchPairs(allAssistantText);
      const seen = new Set<string>();
      for (const p of all) {
        const k = `${p.a.toLowerCase()}|${p.b.toLowerCase()}`;
        if (!seen.has(k)) { seen.add(k); pairs.push(p); }
      }
    }
    if (pairs.length > 0 && commands.onTransferMatches) {
      commands.onTransferMatches(pairs);
      speak(
        `Je transfère ${pairs.length} match${pairs.length > 1 ? "s" : ""} dans ton analyse et je lance les prédictions.`,
      );
      return true;
    }
    // Fallback : aucun match dans le chat → charge le calendrier réel et lance l'analyse
    commands.onSendPicks?.();
    speak(
      "Je n'ai pas encore de pronos prêts. Je charge les matchs du jour et je lance l'analyse maintenant.",
    );
    return true;
  }

  // Lancer analyse
  if (/(lance|démarre|demarre|start|fais|fait|génère|genere|analyse)\b.*(analyse|prono|prédiction|prediction|paris|matchs?)/i.test(t) ||
      /^(analyse|lance|démarre)\b/i.test(t)) {
    commands.onAnalyze?.();
    speak("Je lance l'analyse de tes matchs maintenant.");
    return true;
  }

  // Ajouter un match: "ajoute le match X contre Y" / "X versus Y"
  const addMatch = t.match(/ajoute\s+(?:le\s+)?(?:match\s+)?(.+?)\s+(?:contre|versus|vs|face\s+à)\s+(.+)/i);
  if (addMatch) {
    const a = addMatch[1].trim().replace(/[.,!?]+$/, "");
    const b = addMatch[2].trim().replace(/[.,!?]+$/, "");
    if (a && b) {
      commands.onAddMatch?.(a, b);
      speak(`J'ajoute ${a} contre ${b} à ta liste.`);
      return true;
    }
  }

  return false;
}

export const VoiceCoach = ({ context, ...commands }: VoiceCoachProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Salut, je suis Magic, ton coach IA football. Tu peux me parler : « ajoute Paris contre Marseille », « lance l'analyse », « envoie ton prono dans mes matchs », « ouvre le top 20 », « sauvegarde le combiné ». Je peux aussi répondre à tes questions tactiques.",
    },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const lastAssistantText = () => {
    for (let i = messagesRef.current.length - 1; i >= 0; i--) {
      const m = messagesRef.current[i];
      if (m.role === "assistant" && m.content && m.id !== "welcome") return m.content;
    }
    return "";
  };
  const allAssistantText = () =>
    messagesRef.current
      .filter((m) => m.role === "assistant" && m.id !== "welcome")
      .map((m) => m.content)
      .join("\n");

  // Charge la liste de voix (asynchrone sur Chrome)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      voiceRef.current = pickFrenchMaleVoice();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    // Débloque synthèse vocale + élément <audio> au 1er tap (iOS/Safari exigent un geste user)
    const unlock = () => {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch { /* noop */ }
      try {
        // Pré-crée l'élément <audio> dans le geste utilisateur pour iOS
        if (!audioRef.current) {
          const a = new Audio();
          a.preload = "auto";
          a.setAttribute("playsinline", "true");
          a.muted = true;
          // Silence WAV minimal (≈44 bytes) pour "armer" l'élément sur iOS
          a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
          a.play().then(() => { a.pause(); a.muted = false; a.currentTime = 0; }).catch(() => { /* noop */ });
          audioRef.current = a;
        }
      } catch { /* noop */ }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SRConstructor;
      webkitSpeechRecognition?: SRConstructor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") toast.error("Micro refusé");
      else if (e.error !== "aborted" && e.error !== "no-speech")
        toast.error(`Erreur micro : ${e.error}`);
    };
    rec.onresult = (e) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
      }
      const txt = final.trim();
      if (!txt) return;
      setInput(txt);

      // Tente d'exécuter une commande locale
      const handled = tryExecuteCommand(txt, commandsRef.current, speak, lastAssistantText(), allAssistantText());
      if (handled) {
        // Affiche la commande utilisateur dans le chat pour traçabilité
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "user", content: txt },
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "✅ Commande exécutée.",
          },
        ]);
        setInput("");
      } else {
        // Sinon, envoie à l'IA
        setTimeout(() => sendMessage(txt), 200);
      }
    };
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const speak = (text: string) => {
    if (!autoSpeak) return;
    const clean = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[*_#`>~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;

    if (!("speechSynthesis" in window)) return;
    const doSpeak = () => {
      try {
        window.speechSynthesis.cancel();
        // Découpe en phrases pour éviter la coupure ~15s de Chrome
        const chunks = clean.match(/[^.!?]+[.!?]?/g) ?? [clean];
        chunks.forEach((chunk) => {
          const u = new SpeechSynthesisUtterance(chunk.trim());
          u.lang = "fr-FR";
          u.rate = 1.0;
          u.pitch = 0.85;
          u.volume = 1;
          const v = voiceRef.current ?? pickFrenchMaleVoice();
          if (v) u.voice = v;
          u.onerror = (e) => console.warn("[VoiceCoach] speak error:", e);
          window.speechSynthesis.speak(u);
        });
      } catch (e) {
        console.warn("[VoiceCoach] speak failed:", e);
      }
    };
    // Si les voix ne sont pas encore prêtes, attendre puis parler
    if (!voiceRef.current && window.speechSynthesis.getVoices().length === 0) {
      const handler = () => {
        voiceRef.current = pickFrenchMaleVoice();
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      window.speechSynthesis.onvoiceschanged = handler;
      setTimeout(doSpeak, 300); // fallback
    } else {
      doSpeak();
    }
  };

  const sendMessage = async (textArg?: string) => {
    const text = (textArg ?? input).trim();
    if (!text || streaming) return;
    setInput("");

    // Tente d'abord une commande locale (transfert, navigation, sauvegarde…)
    const handledLocally = tryExecuteCommand(
      text,
      commandsRef.current,
      speak,
      lastAssistantText(),
      allAssistantText(),
    );
    if (handledLocally) {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "user", content: text },
        { id: crypto.randomUUID(), role: "assistant", content: "✅ Commande exécutée." },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const userKeys = getUserApiKeys();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/voice-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
          ...userKeysToHeaders(userKeys),
        },
        body: JSON.stringify({
          context,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text();
        let errMsg = "Erreur du coach IA";
        try {
          const j = JSON.parse(errText);
          if (j.error) errMsg = j.error;
        } catch {
          /* noop */
        }
        if (resp.status === 429) errMsg = "Trop de requêtes, réessaye dans un instant.";
        if (resp.status === 402) errMsg = "Crédits IA épuisés.";
        toast.error(errMsg);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: `⚠️ ${errMsg}` } : msg,
          ),
        );
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as
              | string
              | undefined;
            if (delta) {
              full += delta;
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: full } : msg,
                ),
              );
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (full) speak(full);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setStreaming(false);
    }
  };

  const toggleMic = async () => {
    if (!supported) {
      toast.error("Reconnaissance vocale non supportée");
      return;
    }
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      return;
    }
    try {
      if (navigator.mediaDevices?.getUserMedia)
        await navigator.mediaDevices.getUserMedia({ audio: true });
      rec.start();
    } catch {
      toast.error("Accès micro refusé");
    }
  };

  return (
    <HoloCard variant="magenta">
      <div className="flex flex-col h-[640px]">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HoloLogo icon={Mic} size={40} />
            <div>
              <h2 className="text-xs font-display font-black uppercase tracking-[0.2em] holo-text">
                Coach Vocal Magic
              </h2>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                3D · Voix homme · Contrôle vocal
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (autoSpeak && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
              }
              if (autoSpeak && audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
              }
              setAutoSpeak((v) => !v);
            }}
            className={`tap p-2 rounded-lg border ${
              autoSpeak
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
            aria-label="Synthèse vocale"
            title={autoSpeak ? "Désactiver la voix" : "Activer la voix"}
          >
            {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>

        <div className="p-3 pb-0">
          <CoachOrb3D listening={listening} streaming={streaming} />
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none"
        >
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[82%] px-3 py-2 rounded-2xl text-[12.5px] leading-snug ${
                  m.role === "user"
                    ? "bg-gradient-holo text-primary-foreground font-medium shadow-holo"
                    : "glass border border-border/60 text-foreground"
                }`}
              >
                {m.content || (
                  <span className="opacity-60 inline-flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Réflexion...
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-3 border-t border-border/60 flex items-center gap-2">
          <button
            onClick={toggleMic}
            disabled={!supported || streaming}
            className={`tap relative w-11 h-11 shrink-0 rounded-xl flex items-center justify-center border-2 ${
              listening
                ? "bg-accent border-accent text-accent-foreground"
                : "bg-card border-accent/40 text-accent"
            } disabled:opacity-50`}
            aria-label="Micro"
          >
            {listening && (
              <span className="absolute inset-0 rounded-xl bg-accent/40 animate-voice-pulse pointer-events-none" />
            )}
            {supported ? (
              <Mic size={18} className={listening ? "animate-pulse" : ""} />
            ) : (
              <MicOff size={18} />
            )}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={listening ? "J'écoute..." : "Parle ou tape ta demande..."}
            disabled={streaming}
            className="flex-1 px-3 py-2.5 rounded-xl bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="tap w-11 h-11 shrink-0 rounded-xl bg-gradient-holo flex items-center justify-center disabled:opacity-40 shadow-holo"
            aria-label="Envoyer"
          >
            {streaming ? (
              <Loader2 size={16} className="animate-spin text-primary-foreground" />
            ) : (
              <Send size={16} className="text-primary-foreground" />
            )}
          </button>
        </div>
      </div>
    </HoloCard>
  );
};
