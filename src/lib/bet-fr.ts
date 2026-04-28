// Traduction garantie en français des types/options de paris.
// L'IA peut renvoyer de l'anglais résiduel — on normalise tout côté client.

const TYPE_MAP: Array<[RegExp, string]> = [
  [/^\s*1x2\s*$/i, "1N2"],
  [/match\s*winner|moneyline|h2h|head\s*to\s*head/i, "1N2"],
  [/double\s*chance/i, "Double chance"],
  [/over\s*\/?\s*under|totals?|o\/u/i, "Plus / Moins"],
  [/btts|both\s*teams?\s*to\s*score/i, "Les deux équipes marquent"],
  [/asian\s*handicap|handicap\s*asiatique/i, "Handicap asiatique"],
  [/handicap/i, "Handicap"],
  [/correct\s*score/i, "Score exact"],
  [/draw\s*no\s*bet|dnb/i, "Remboursé si nul"],
  [/clean\s*sheet/i, "Cage inviolée"],
  [/half[\s-]?time|mi[\s-]?temps/i, "Mi-temps"],
];

export function translateBetType(type: string | undefined | null): string {
  if (!type) return "Pari";
  for (const [re, fr] of TYPE_MAP) if (re.test(type)) return fr;
  return type;
}

const OPTION_MAP: Array<[RegExp, string]> = [
  [/\bhome\s*win\b|\b1\s*$|\bvictoire\s*domicile/i, "Victoire domicile"],
  [/\baway\s*win\b|\b2\s*$|\bvictoire\s*ext[ée]rieur/i, "Victoire extérieur"],
  [/\bdraw\b|\bnul\b|\bx\b/i, "Match nul"],
  [/\bover\s*0?\.?5\b/i, "Plus de 0,5 but"],
  [/\bover\s*1?\.?5\b/i, "Plus de 1,5 but"],
  [/\bover\s*2?\.?5\b/i, "Plus de 2,5 buts"],
  [/\bover\s*3?\.?5\b/i, "Plus de 3,5 buts"],
  [/\bunder\s*0?\.?5\b/i, "Moins de 0,5 but"],
  [/\bunder\s*1?\.?5\b/i, "Moins de 1,5 but"],
  [/\bunder\s*2?\.?5\b/i, "Moins de 2,5 buts"],
  [/\bunder\s*3?\.?5\b/i, "Moins de 3,5 buts"],
  [/\b(btts\s*)?yes\b|\boui\b/i, "Oui"],
  [/\b(btts\s*)?no\b|\bnon\b/i, "Non"],
  [/\b1x\b/i, "1 ou Nul"],
  [/\bx2\b/i, "Nul ou 2"],
  [/\b12\b/i, "1 ou 2"],
];

export function translateBetOption(opt: string | undefined | null): string {
  if (!opt) return "—";
  let res = opt;
  for (const [re, fr] of OPTION_MAP) {
    if (re.test(res)) {
      res = res.replace(re, fr);
    }
  }
  // remplacer mots résiduels courants
  res = res
    .replace(/\bWin\b/gi, "Victoire")
    .replace(/\bDraw\b/gi, "Nul")
    .replace(/\bGoals?\b/gi, "buts")
    .replace(/\bOver\b/gi, "Plus de")
    .replace(/\bUnder\b/gi, "Moins de")
    .replace(/\bYes\b/gi, "Oui")
    .replace(/\bNo\b/gi, "Non");
  return res;
}
