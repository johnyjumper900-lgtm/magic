/**
 * Value Bet helpers — compare la probabilité estimée par Magic à la
 * probabilité implicite de la cote bookmaker. Une "value" existe quand
 * Magic estime la proba > proba implicite (cote sous-évaluée).
 */

export interface ValueAssessment {
  /** edge en points de % (positif = value pour le parieur) */
  edgePct: number;
  /** Niveau qualitatif : neutral / value / hot */
  level: "neutral" | "value" | "hot";
  /** "+8.4%" formatté pour l'UI */
  label: string;
}

/** edge = probaEstimée - probaImplicite (1/cote * 100) */
export function assessValue(estimatedProbPct: number, odds: number): ValueAssessment {
  if (!odds || odds <= 1.01) {
    return { edgePct: 0, level: "neutral", label: "0%" };
  }
  const implied = (1 / odds) * 100;
  const edge = estimatedProbPct - implied;
  const level: ValueAssessment["level"] =
    edge >= 8 ? "hot" : edge >= 3 ? "value" : "neutral";
  const sign = edge >= 0 ? "+" : "";
  return {
    edgePct: edge,
    level,
    label: `${sign}${edge.toFixed(1)}%`,
  };
}
