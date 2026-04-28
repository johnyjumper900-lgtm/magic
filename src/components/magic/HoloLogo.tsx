import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface HoloLogoProps {
  icon: LucideIcon;
  size?: number;
  orbit?: boolean;
}

/**
 * Holographic emblem: glass disk + iridescent conic backdrop +
 * pulsing rings + optional orbiting particle.
 * No RGB hue-rotate; uses a static prismatic conic gradient.
 */
export const HoloLogo = ({
  icon: Icon,
  size = 44,
  orbit = true,
}: HoloLogoProps) => {
  const px = `${size}px`;
  const inner = size - 6;

  return (
    <div
      className="relative shrink-0 inline-flex items-center justify-center"
      style={{ width: px, height: px }}
    >
      {/* Outer pulsing ring */}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "0 0 14px hsl(var(--primary) / 0.55), 0 0 26px hsl(var(--secondary) / 0.35)",
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Conic iridescent backdrop */}
      <motion.div
        className="absolute inset-0 rounded-full bg-iridescent"
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner glass disk */}
      <div
        className="absolute rounded-full glass-strong flex items-center justify-center"
        style={{ width: `${inner}px`, height: `${inner}px` }}
      >
        <motion.div
          animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon
            size={Math.round(inner * 0.5)}
            className="text-foreground drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
          />
        </motion.div>
      </div>

      {/* Orbiting particle */}
      {orbit && (
        <span
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -mt-[3px] -ml-[3px] rounded-full bg-primary-glow"
          style={{
            boxShadow: "0 0 10px 2px hsl(var(--primary-glow))",
            animation: `orbit 4s linear infinite`,
            transformOrigin: `0 0`,
          }}
        />
      )}
    </div>
  );
};
