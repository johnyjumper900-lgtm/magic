import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Check,
  Trash2,
  Info,
  Sliders,
  Globe,
  Bell,
  BellOff,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { HoloCard } from "./HoloCard";
import { CreatorIdentity } from "./CreatorIdentity";
import {
  getUserApiKeys,
  setUserApiKey,
  type UserApiKeys,
} from "@/lib/user-api-keys";
import {
  getExtraKeys,
  addExtraKey,
  removeExtraKey,
  detectProvider,
  verifyKey,
  EXTRA_PROVIDERS,
  type ExtraApiKey,
  type ExtraProvider,
} from "@/lib/extra-api-keys";
import { emitKeysUpdated } from "@/lib/keys-events";
import {
  isPushSupported,
  isPushEnabled,
  requestPushPermission,
  disablePush,
  pushNotify,
} from "@/lib/push-notifications";

interface SettingsViewProps {
  onBack: () => void;
  defaultStake: number;
  onDefaultStakeChange: (n: number) => void;
  onResetHistory: () => void;
}

const KEY_FIELDS: Array<{
  field: keyof UserApiKeys;
  label: string;
  hint: string;
  placeholder: string;
  url: string;
  highlight?: boolean;
}> = [
  {
    field: "gemini",
    label: "Google Gemini API",
    hint: "Cerveau du stratège — clé Google AI Studio (gratuit, 1500 req/jour).",
    placeholder: "AIza...",
    url: "https://aistudio.google.com/apikey",
    highlight: true,
  },
];

export const SettingsView = ({
  onBack,
  defaultStake,
  onDefaultStakeChange,
  onResetHistory,
}: SettingsViewProps) => {
  const [keys, setKeys] = useState<UserApiKeys>(getUserApiKeys());
  const [show, setShow] = useState<Record<keyof UserApiKeys, boolean>>({
    rapidApi: false,
    footballData: false,
    odds: false,
    apiSports: false,
    gemini: false,
  });
  const [pushOn, setPushOn] = useState<boolean>(() => isPushEnabled());
  const pushSupported = isPushSupported();

  const [extras, setExtras] = useState<ExtraApiKey[]>(() => getExtraKeys());
  const [newKey, setNewKey] = useState("");
  const [newProvider, setNewProvider] = useState<ExtraProvider | "auto">("auto");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setKeys(getUserApiKeys());
    setPushOn(isPushEnabled());
    setExtras(getExtraKeys());
  }, []);

  const togglePush = async () => {
    if (pushOn) {
      disablePush();
      setPushOn(false);
      toast.success("Notifications push désactivées");
      return;
    }
    const ok = await requestPushPermission();
    setPushOn(ok);
    if (ok) {
      toast.success("Notifications push activées");
      pushNotify("Magic activé 🔮", {
        body: "Tu recevras les alertes de tes tickets en direct.",
      });
    } else {
      toast.error("Permission refusée par le navigateur");
    }
  };

  const update = (f: keyof UserApiKeys, v: string) =>
    setKeys((p) => ({ ...p, [f]: v }));

  const saveAll = () => {
    (Object.keys(keys) as Array<keyof UserApiKeys>).forEach((k) =>
      setUserApiKey(k, keys[k].trim()),
    );
    toast.success("Clés enregistrées — actualisation des matchs…");
    emitKeysUpdated({ action: "save-all" });
  };

  const clearOne = (f: keyof UserApiKeys) => {
    setUserApiKey(f, "");
    setKeys((p) => ({ ...p, [f]: "" }));
    toast.success("Clé effacée");
    emitKeysUpdated({ provider: f, action: "remove" });
  };

  const handleAddExtra = async () => {
    const raw = newKey.trim();
    if (!raw) {
      toast.error("Saisis une clé API");
      return;
    }
    const provider: ExtraProvider =
      newProvider === "auto" ? detectProvider(raw) : newProvider;
    setVerifying(true);
    try {
      const result = await verifyKey(provider, raw);
      const entry: ExtraApiKey = {
        id: crypto.randomUUID(),
        provider,
        key: raw,
        label: EXTRA_PROVIDERS[provider].label,
        addedAt: Date.now(),
        valid: result.valid,
        message: result.message,
      };
      const next = addExtraKey(entry);
      setExtras(next);
      setNewKey("");
      setNewProvider("auto");
      if (result.valid) {
        toast.success(`Clé ${entry.label} vérifiée ✓ — matchs & cotes actualisés`);
      } else {
        toast.warning(`Clé ajoutée mais non vérifiée : ${result.message}`);
      }
      emitKeysUpdated({ provider: entry.provider, action: "add" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec vérification");
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveExtra = (id: string) => {
    setExtras(removeExtraKey(id));
    toast.success("Clé supprimée");
    emitKeysUpdated({ action: "remove" });
  };

  const handleReverify = async (entry: ExtraApiKey) => {
    setVerifying(true);
    try {
      const result = await verifyKey(entry.provider, entry.key);
      const next = extras.map((e) =>
        e.id === entry.id ? { ...e, valid: result.valid, message: result.message } : e,
      );
      setExtras(next);
      localStorage.setItem("magic.extraApiKeys", JSON.stringify(next));
      toast[result.valid ? "success" : "warning"](
        result.valid ? "Clé toujours valide ✓" : `Invalide : ${result.message}`,
      );
      emitKeysUpdated({ provider: entry.provider, action: "verify" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center gap-3 px-1">
        <button
          onClick={onBack}
          className="tap w-11 h-11 rounded-xl glass flex items-center justify-center shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-display font-black uppercase tracking-[0.2em] holo-text truncate">
            Paramètres
          </h2>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5 truncate">
            Clés API · Configuration
          </p>
        </div>
      </div>

      <HoloCard variant="cyan">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={16} className="text-primary shrink-0" />
            <h3 className="text-xs font-display font-black uppercase tracking-[0.2em] text-foreground truncate">
              Clés API · Global
            </h3>
          </div>
          <p className="text-[9.5px] text-muted-foreground mb-4 leading-snug">
            <strong className="text-primary">Une seule config pour toute l'app</strong> :
            calendrier, cotes, scores temps réel, coach IA — tous les modules réutilisent ces clés.
            Stockées localement sur ton appareil, envoyées uniquement comme en-têtes sécurisés.
          </p>

          {KEY_FIELDS.map(({ field, label, hint, placeholder, url, highlight }) => (
            <div
              key={field}
              className={`space-y-1.5 mb-4 ${
                highlight
                  ? "p-3 -mx-2 rounded-xl bg-gradient-holo-soft border border-primary/30"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  className={`text-[9.5px] font-bold uppercase tracking-widest truncate ${
                    highlight ? "text-primary text-glow-cyan" : "text-primary"
                  }`}
                >
                  {highlight && "★ "}
                  {label}
                </label>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[8.5px] uppercase tracking-widest text-muted-foreground hover:text-primary transition shrink-0"
                >
                  Obtenir
                </a>
              </div>
              <div className="relative">
                <input
                  type={show[field] ? "text" : "password"}
                  value={keys[field]}
                  onChange={(e) => update(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full pr-20 px-3 py-2.5 rounded-xl bg-background/60 border border-border text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setShow((s) => ({ ...s, [field]: !s[field] }))
                    }
                    className="tap p-1.5 text-muted-foreground"
                    aria-label="Voir/masquer"
                  >
                    {show[field] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {keys[field] && (
                    <button
                      type="button"
                      onClick={() => clearOne(field)}
                      className="tap p-1.5 text-destructive"
                      aria-label="Effacer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[9.5px] text-muted-foreground leading-snug">
                {hint}
              </p>
            </div>
          ))}

          <button
            onClick={saveAll}
            className="tap w-full py-3 rounded-xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-widest text-[10.5px] flex items-center justify-center gap-2 shadow-holo"
          >
            <Check size={14} /> Enregistrer
          </button>
        </div>
      </HoloCard>

      <HoloCard variant="violet">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Plus size={16} className="text-secondary shrink-0" />
            <h3 className="text-xs font-display font-black uppercase tracking-[0.2em] text-foreground truncate">
              Clés API Foot · À volonté
            </h3>
          </div>
          <p className="text-[9.5px] text-muted-foreground mb-4 leading-snug">
            Ajoute autant de clés que tu veux (API-Football, Football-Data, Odds API,
            TheSportsDB, RapidAPI, Sportmonks…). Le provider est{" "}
            <strong className="text-secondary">détecté automatiquement</strong> et la
            clé est <strong className="text-secondary">vérifiée en direct</strong>.
          </p>

          <div className="flex gap-2 mb-2">
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value as ExtraProvider | "auto")}
              className="px-2 py-2 rounded-xl bg-background/60 border border-border text-[11px] text-foreground focus:border-secondary focus:outline-none"
            >
              <option value="auto">Auto-détection</option>
              {(Object.keys(EXTRA_PROVIDERS) as ExtraProvider[]).map((p) => (
                <option key={p} value={p}>
                  {EXTRA_PROVIDERS[p].label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Colle ta clé API ici..."
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-background/60 border border-border text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-secondary focus:outline-none"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button
            onClick={handleAddExtra}
            disabled={verifying || !newKey.trim()}
            className="tap w-full py-2.5 rounded-xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-widest text-[10.5px] flex items-center justify-center gap-2 shadow-holo disabled:opacity-50"
          >
            {verifying ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Vérification…
              </>
            ) : (
              <>
                <Plus size={14} /> Ajouter & vérifier
              </>
            )}
          </button>

          {extras.length > 0 && (
            <div className="mt-4 space-y-2">
              {extras.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-background/40 border border-border"
                >
                  {e.valid ? (
                    <CheckCircle2 size={14} className="text-success shrink-0" />
                  ) : (
                    <XCircle size={14} className="text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-foreground truncate">
                      {e.label}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      {e.key.slice(0, 6)}…{e.key.slice(-4)} ·{" "}
                      {e.valid ? "Validée" : e.message || "Non vérifiée"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReverify(e)}
                    disabled={verifying}
                    className="tap p-1.5 text-muted-foreground hover:text-secondary"
                    aria-label="Re-vérifier"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => handleRemoveExtra(e.id)}
                    className="tap p-1.5 text-destructive"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </HoloCard>

      <CreatorIdentity />

      <HoloCard variant="cyan">
        <div className="p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {pushOn ? (
                <Bell size={16} className="text-primary shrink-0" />
              ) : (
                <BellOff size={16} className="text-muted-foreground shrink-0" />
              )}
              <h3 className="text-xs font-display font-black uppercase tracking-[0.2em] text-foreground truncate">
                Notifications push
              </h3>
            </div>
            <button
              onClick={togglePush}
              disabled={!pushSupported}
              className={`tap shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                pushOn
                  ? "bg-gradient-prism text-primary-foreground border-transparent shadow-holo"
                  : "bg-card/40 text-muted-foreground border-border"
              } ${!pushSupported ? "opacity-40" : ""}`}
            >
              {pushOn ? "Activées" : "Activer"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {pushSupported
              ? "Reçois les coups d'envoi, mises à jour de score et résultats finaux de tes tickets validés directement sur ton appareil — même si l'onglet est en arrière-plan."
              : "Ton navigateur ne supporte pas les notifications push (essaie Safari/Chrome récent)."}
          </p>
        </div>
      </HoloCard>

      <HoloCard variant="violet">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sliders size={16} className="text-secondary shrink-0" />
            <h3 className="text-xs font-display font-black uppercase tracking-[0.2em] text-foreground truncate">
              Mise par défaut
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={defaultStake}
              onChange={(e) =>
                onDefaultStakeChange(Number(e.target.value) || 0)
              }
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-background/60 border border-border text-foreground text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-2xl font-display font-black holo-text shrink-0">€</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[5, 10, 25, 50].map((v) => (
              <button
                key={v}
                onClick={() => onDefaultStakeChange(v)}
                className={`tap py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                  defaultStake === v
                    ? "bg-gradient-prism text-primary-foreground shadow-holo"
                    : "bg-card/40 border border-border text-muted-foreground"
                }`}
              >
                {v}€
              </button>
            ))}
          </div>
        </div>
      </HoloCard>

      <HoloCard variant="magenta">
        <div className="p-5">
          <h3 className="text-xs font-display font-black uppercase tracking-[0.2em] text-destructive mb-3 truncate">
            Zone dangereuse
          </h3>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("magic.unlock.until");
              } catch { /* noop */ }
              toast.success("Magic verrouillé");
              setTimeout(() => window.location.reload(), 300);
            }}
            className="tap w-full py-2.5 mb-2 rounded-xl border border-primary/40 bg-primary/10 text-primary font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
          >
            <Lock size={12} /> Verrouiller maintenant
          </button>
          <button
            onClick={() => {
              onResetHistory();
              toast.success("Historique réinitialisé");
            }}
            className="tap w-full py-2.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
          >
            <Trash2 size={12} /> Réinitialiser l'historique
          </button>
        </div>
      </HoloCard>

      <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
        <Info size={12} />
        <span className="text-[9px] font-bold uppercase tracking-widest">
          Magic · iPhone Edition
        </span>
      </div>
    </motion.div>
  );
};
