import { History as HistoryIcon, Trash2 } from "lucide-react";
import type { HistoryItem } from "@/types/magic";
import { HoloCard } from "./HoloCard";
import { HoloLogo } from "./HoloLogo";
import { RoiStatsPanel } from "./RoiStatsPanel";

interface HistoryViewProps {
  history: HistoryItem[];
  onClear?: () => void;
}

export const HistoryView = ({ history, onClear }: HistoryViewProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <HoloLogo icon={HistoryIcon} size={40} />
          <div>
            <h2 className="text-sm font-display font-black uppercase tracking-[0.18em] holo-text">
              Historique
            </h2>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
              {history.length} analyses sauvegardées
            </p>
          </div>
        </div>
        {history.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="tap text-destructive p-2"
            aria-label="Vider"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <RoiStatsPanel history={history} />

      {history.length === 0 ? (
        <HoloCard variant="violet">
          <div className="p-8 text-center">
            <p className="text-xs text-muted-foreground">
              Aucune analyse sauvegardée pour le moment.
            </p>
          </div>
        </HoloCard>
      ) : (
        history.map((h) => (
          <HoloCard key={h.id} variant="cyan">
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-display font-black text-foreground uppercase tracking-wide truncate">
                  {h.title}
                </h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {h.date} · Confiance {h.confidence}%
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-display font-black holo-text">
                  {h.odds}
                </div>
                <div className="text-[10px] font-bold text-success">
                  {h.profit}
                </div>
              </div>
            </div>
          </HoloCard>
        ))
      )}
    </div>
  );
};
