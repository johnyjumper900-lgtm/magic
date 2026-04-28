/**
 * Détection automatique des enjeux d'un match : derby, finale, course
 * au titre, lutte pour le maintien, qualif Coupe d'Europe.
 *
 * Heuristique 100% locale (pas d'appel réseau). Magic peut s'appuyer
 * dessus pour ajuster son score sans dépendance externe.
 */

export interface MotivationContext {
  level: 0 | 1 | 2 | 3; // 0 = anodin, 3 = énorme
  tags: string[]; // ex: ["Derby", "Coupe d'Europe"]
  reasoning: string;
}

const DERBYS: Array<[RegExp, RegExp, string]> = [
  [/paris|psg/i, /marseille|om|olympique de marseille/i, "Le Classique"],
  [/real madrid/i, /barcelon|barça/i, "Clasico"],
  [/manchester united|man utd/i, /manchester city|man city/i, "Derby de Manchester"],
  [/liverpool/i, /everton/i, "Derby du Merseyside"],
  [/inter|internazionale/i, /milan ac|ac milan|^milan$/i, "Derby della Madonnina"],
  [/juventus/i, /torino/i, "Derby della Mole"],
  [/roma/i, /lazio/i, "Derby della Capitale"],
  [/bayern/i, /dortmund|bvb/i, "Der Klassiker"],
  [/ajax/i, /feyenoord/i, "De Klassieker"],
  [/celtic/i, /rangers/i, "Old Firm"],
  [/arsenal/i, /tottenham|spurs/i, "Derby du Nord de Londres"],
  [/atlético|atletico madrid/i, /real madrid/i, "Derbi madrileño"],
  [/lyon|ol/i, /saint-?etienne|asse/i, "Derby du Rhône"],
  [/nice|ogcn/i, /monaco|asm/i, "Derby de la Côte d'Azur"],
];

export function detectMotivation(
  home: string,
  away: string,
  league: string,
): MotivationContext {
  const tags: string[] = [];
  let level = 0;

  // Derby
  for (const [a, b, name] of DERBYS) {
    if ((a.test(home) && b.test(away)) || (a.test(away) && b.test(home))) {
      tags.push(name);
      level = Math.max(level, 3) as 0 | 1 | 2 | 3;
      break;
    }
  }

  // Compétitions à enjeu fort
  if (/champions league|ligue des champions/i.test(league)) {
    tags.push("Ligue des Champions");
    level = Math.max(level, 3) as 0 | 1 | 2 | 3;
  } else if (/europa league|ligue europa/i.test(league)) {
    tags.push("Europa League");
    level = Math.max(level, 2) as 0 | 1 | 2 | 3;
  } else if (/conference league|conf[eé]rence/i.test(league)) {
    tags.push("Conference League");
    level = Math.max(level, 2) as 0 | 1 | 2 | 3;
  } else if (/cup|coupe|copa|pokal/i.test(league)) {
    tags.push("Match de Coupe");
    level = Math.max(level, 2) as 0 | 1 | 2 | 3;
  }

  // Mots-clés de phase
  if (/final/i.test(league)) {
    tags.push("Phase finale");
    level = Math.max(level, 3) as 0 | 1 | 2 | 3;
  }
  if (/semi.?final|demi.?finale/i.test(league)) {
    tags.push("Demi-finale");
    level = Math.max(level, 3) as 0 | 1 | 2 | 3;
  }
  if (/quarter.?final|quart de finale/i.test(league)) {
    tags.push("Quart de finale");
    level = Math.max(level, 2) as 0 | 1 | 2 | 3;
  }

  if (tags.length === 0) {
    tags.push("Championnat");
    level = 1;
  }

  const reasoning =
    level >= 3
      ? "Match à enjeu maximal — pression, motivation et public au max."
      : level === 2
        ? "Enjeu sportif important : à élimination directe ou rivalité forte."
        : "Match de saison régulière classique.";

  return { level: level as 0 | 1 | 2 | 3, tags, reasoning };
}
