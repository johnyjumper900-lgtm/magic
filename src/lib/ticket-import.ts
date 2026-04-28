/**
 * Parse un ticket brut (texte collé / OCR d'une photo de ticket bookmaker)
 * et extrait une liste de pronos avec cotes.
 *
 * Reconnaît les formats classiques :
 *   - "PSG vs Marseille  1.85"
 *   - "PSG - OM   Victoire PSG   1.85"
 *   - "Real Madrid - Barcelone | Plus de 2.5 buts | 1.72"
 *   - lignes à la Betclic/Unibet/Winamax
 */

export interface ImportedPick {
  match: string;
  teamA: string;
  teamB: string;
  option: string;
  type: string;
  odds: number;
}

export interface ImportedTicket {
  picks: ImportedPick[];
  totalOdds?: number;
  stake?: number;
}

const SEP = /\s+(?:vs\.?|v\.s\.?|versus|contre|—|–|-)\s+/i;

const OPTION_PATTERNS: Array<{ re: RegExp; type: string; label: (m: RegExpMatchArray) => string }> = [
  { re: /\b(?:plus|\+)\s*de?\s*(\d+[.,]?\d*)\s*buts?\b/i, type: "Total buts", label: (m) => `+${m[1].replace(",", ".")} buts` },
  { re: /\b(?:moins|-)\s*de?\s*(\d+[.,]?\d*)\s*buts?\b/i, type: "Total buts", label: (m) => `-${m[1].replace(",", ".")} buts` },
  { re: /\bles?\s*2?\s*[ée]quipes?\s*marquent?\b|\bbtts\s*oui\b|\bbtts\b/i, type: "Les deux marquent", label: () => "Oui" },
  { re: /\b1x2\b.*?\b(1|x|2)\b/i, type: "1X2", label: (m) => m[1].toUpperCase() },
  { re: /\bvictoire\s+(.+?)(?:\s*@|\s*\d|$)/i, type: "1X2", label: (m) => `Victoire ${m[1].trim()}` },
  { re: /\bmatch\s*nul\b|\bnul\b/i, type: "1X2", label: () => "Nul" },
  { re: /\bdouble\s*chance\s*(1x|x2|12)/i, type: "Double chance", label: (m) => m[1].toUpperCase() },
];

function detectOption(line: string): { option: string; type: string } {
  for (const p of OPTION_PATTERNS) {
    const m = line.match(p.re);
    if (m) return { option: p.label(m), type: p.type };
  }
  return { option: "Victoire", type: "1X2" };
}

function parseOdds(line: string): number | null {
  // Préfère la dernière cote (souvent en fin de ligne)
  const all = [...line.matchAll(/(?<![0-9])(\d[.,]\d{1,2})(?![0-9])/g)].map((m) =>
    parseFloat(m[1].replace(",", ".")),
  );
  const valid = all.filter((n) => n >= 1.01 && n <= 50);
  if (valid.length === 0) return null;
  return valid[valid.length - 1];
}

export function parseTicketText(raw: string): ImportedTicket {
  const text = raw.replace(/\r/g, "").trim();
  const picks: ImportedPick[] = [];

  // Mise & cote totale globales (facultatif)
  const stakeM = text.match(/mise[^0-9]{0,6}(\d+[.,]?\d*)\s*€?/i);
  const totalM = text.match(/cote\s*(?:totale|finale)[^0-9]{0,6}(\d+[.,]?\d*)/i);

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.length < 4 || line.length > 220) continue;
    const mm = line.match(
      /([A-Za-zÀ-ÿ0-9.'’&\- ]{2,40}?)\s+(?:vs\.?|v\.s\.?|versus|contre|—|–|-)\s+([A-Za-zÀ-ÿ0-9.'’&\- ]{2,40})/i,
    );
    if (!mm) continue;
    const teamA = mm[1].trim();
    const teamB = mm[2].trim().replace(/[.,;].*$/, "").trim();
    if (!teamA || !teamB) continue;

    const odds = parseOdds(line);
    if (!odds) continue;
    const { option, type } = detectOption(line);
    picks.push({
      match: `${teamA} vs ${teamB}`,
      teamA,
      teamB,
      option,
      type,
      odds,
    });
  }

  return {
    picks,
    stake: stakeM ? parseFloat(stakeM[1].replace(",", ".")) : undefined,
    totalOdds: totalM ? parseFloat(totalM[1].replace(",", ".")) : undefined,
  };
}
