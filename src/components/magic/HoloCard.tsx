import { motion } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HoloCardProps {
  children: ReactNode;
  variant?: "cyan" | "violet" | "magenta" | "gold";
  className?: string;
  glow?: boolean;
  scan?: boolean;
}

const variantBg: Record<string, string> = {
  cyan: "from-primary/40 via-secondary/30 to-accent/30",
  violet: "from-secondary/40 via-accent/30 to-primary/30",
  magenta: "from-accent/40 via-secondary/30 to-primary/30",
  gold: "from-gold/40 via-accent/20 to-primary/20",
};

/**
 * Holographic glass card with rotating iridescent border.
 * No RGB cycling — uses a single subtle prismatic gradient.
 */
export const HoloCard = forwardRef<HTMLDivElement, HoloCardProps>(function HoloCard(
  { children, variant = "cyan", className, glow = true, scan = false },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-2xl overflow-hidden p-[1.5px] group",
        className,
      )}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className={cn(
          "absolute inset-[-100%] opacity-50 group-hover:opacity-90 transition-opacity bg-gradient-to-tr",
          variantBg[variant],
        )}
        style={{
          backgroundImage: `conic-gradient(from 180deg at 50% 50%, transparent 0deg, hsl(var(--primary)) 90deg, hsl(var(--secondary)) 180deg, hsl(var(--accent)) 270deg, transparent 360deg)`,
        }}
      />
      <div
        className={cn(
          "relative z-10 glass rounded-[calc(theme(borderRadius.2xl)-1.5px)] h-full w-full overflow-hidden",
          glow && scan && "holo-scan",
        )}
      >
        {children}
      </div>
    </div>
  );
});
