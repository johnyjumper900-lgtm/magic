import { BarChart3, Home, History, Trophy, Mic, Ticket } from "lucide-react";
import { motion } from "framer-motion";

export type TabKey = "dashboard" | "calendar" | "top20" | "tickets" | "coach" | "history";

interface TabBarProps {
  active: TabKey;
  onChange: (k: TabKey) => void;
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof Home }> = [
  { key: "dashboard", label: "Analyse", icon: Home },
  { key: "calendar", label: "Match", icon: BarChart3 },
  { key: "top20", label: "Top 20", icon: Trophy },
  { key: "tickets", label: "Paris", icon: Ticket },
  { key: "coach", label: "Coach", icon: Mic },
  { key: "history", label: "Histo", icon: History },
];

export const TabBar = ({ active, onChange }: TabBarProps) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl bg-background/85 border-t border-border/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-6 max-w-md mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className="relative flex flex-col items-center justify-center py-2.5 gap-1 tap"
              aria-label={tab.label}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] bg-gradient-prism rounded-full shadow-holo"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon
                  size={15}
                  className={`transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  style={
                    isActive
                      ? { filter: "drop-shadow(0 0 6px hsl(var(--primary)))" }
                      : undefined
                  }
                />
              </div>
              <span
                className={`text-[7px] font-bold uppercase tracking-[0.1em] transition-colors ${
                  isActive ? "text-primary text-glow-cyan" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
