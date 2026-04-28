import { Save, Zap } from "lucide-react";

interface ActionFooterProps {
  onSave: () => void;
  onDeepAnalysis: () => void;
  isAnalyzing: boolean;
}

export const ActionFooter = ({
  onSave,
  onDeepAnalysis,
  isAnalyzing,
}: ActionFooterProps) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onSave}
        className="tap glass rounded-xl py-2.5 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest text-foreground border border-border hover:border-primary/50 transition"
      >
        <Save size={13} className="text-primary" />
        Sauvegarder
      </button>
      <button
        onClick={onDeepAnalysis}
        disabled={isAnalyzing}
        className="tap glass rounded-xl py-2.5 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest text-foreground border border-border hover:border-accent/50 disabled:opacity-50 transition"
      >
        <Zap
          size={13}
          className={`text-accent ${isAnalyzing ? "animate-pulse" : ""}`}
        />
        Re-analyse
      </button>
    </div>
  );
};
