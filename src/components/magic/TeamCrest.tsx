import { useState } from "react";

interface TeamCrestProps {
  src?: string;
  name: string;
  size?: number;
}

/**
 * Football club crest with graceful fallback to initials medallion.
 */
export const TeamCrest = ({ src, name, size = 28 }: TeamCrestProps) => {
  const [errored, setErrored] = useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const px = `${size}px`;

  if (!src || errored) {
    return (
      <div
        className="rounded-full bg-gradient-holo flex items-center justify-center shrink-0 shadow-holo border border-primary/30"
        style={{ width: px, height: px }}
        aria-label={name}
      >
        <span
          className="font-display font-black text-primary-foreground"
          style={{ fontSize: Math.max(8, size * 0.32) }}
        >
          {initials || "?"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-full glass flex items-center justify-center shrink-0 overflow-hidden border border-primary/30"
      style={{ width: px, height: px }}
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setErrored(true)}
        style={{ width: size * 0.85, height: size * 0.85, objectFit: "contain" }}
      />
    </div>
  );
};

interface CountryFlagProps {
  code?: string;
  size?: number;
}

/**
 * Country flag fetched from flagcdn.com (free, no auth).
 * Pass ISO 3166-1 alpha-2 code lowercase. Falls back to nothing.
 */
export const CountryFlag = ({ code, size = 14 }: CountryFlagProps) => {
  const [errored, setErrored] = useState(false);
  if (!code || errored) return null;
  const url = `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  return (
    <img
      src={url}
      alt={code}
      loading="lazy"
      onError={() => setErrored(true)}
      className="inline-block rounded-sm shrink-0"
      style={{
        width: size,
        height: size * 0.7,
        objectFit: "cover",
        boxShadow: "0 0 4px hsl(var(--primary) / 0.5)",
      }}
    />
  );
};

interface TeamKitProps {
  src?: string;
  name: string;
  size?: number;
}

/**
 * Jersey / kit visual for a club. Falls back to a stylized shirt silhouette
 * when no kit image is available.
 */
export const TeamKit = ({ src, name, size = 64 }: TeamKitProps) => {
  const [errored, setErrored] = useState(false);
  const px = `${size}px`;
  if (src && !errored) {
    return (
      <div
        className="rounded-xl glass flex items-center justify-center overflow-hidden border border-primary/30 shadow-holo"
        style={{ width: px, height: px }}
      >
        <img
          src={src}
          alt={`Maillot ${name}`}
          loading="lazy"
          onError={() => setErrored(true)}
          style={{ width: size * 0.85, height: size * 0.85, objectFit: "contain" }}
        />
      </div>
    );
  }
  // Fallback: minimal jersey silhouette
  return (
    <div
      className="rounded-xl glass flex items-center justify-center border border-primary/30"
      style={{ width: px, height: px }}
      aria-label={`Maillot ${name}`}
      title={`Maillot ${name}`}
    >
      <svg viewBox="0 0 64 64" width={size * 0.7} height={size * 0.7} className="text-primary/80">
        <path
          fill="currentColor"
          opacity="0.85"
          d="M20 8l-12 6 4 12 8-3v33h28V23l8 3 4-12-12-6-6 4a10 10 0 0 1-16 0z"
        />
      </svg>
    </div>
  );
};
