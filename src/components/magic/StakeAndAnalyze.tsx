import { Sparkles, Wallet } from "lucide-react";

interface StakeAndAnalyzeProps {
  stake: number;
  onStakeChange: (n: number) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  hasMatches: boolean;
}

export const StakeAndAnalyze = ({
  stake,
  onStakeChange,
  onAnalyze,
  isAnalyzing,
  hasMatches,
}: StakeAndAnalyzeProps) => {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <div className="glass rounded-2xl flex items-center gap-2 px-3 py-2.5">
        <Wallet size={14} className="text-primary" />
        <input
          type="number"
          inputMode="decimal"
          min={1}
          value={stake}
          onChange={(e) => onStakeChange(Number(e.target.value) || 0)}
          className="w-16 bg-transparent text-foreground font-bold text-sm focus:outline-none"
        />
        <span className="text-primary font-black text-sm">€</span>
      </div>
      <button
        onClick={onAnalyze}
        disabled={isAnalyzing || !hasMatches}
        className="tap py-3 px-5 rounded-2xl bg-gradient-holo text-primary-foreground font-display font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 shadow-holo disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles size={14} className={isAnalyzing ? "animate-spin" : ""} />
        {isAnalyzing ? "Analyse..." : "Analyser"}
      </button>
    </div>
  );
};
