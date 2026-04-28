import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-gemini-key, x-user-rapidapi-key, x-user-footballdata-key, x-user-odds-key, x-user-apisports-key",
};

interface InMatch {
  id: string;
  teamA: string;
  teamB: string;
}

interface OutPrediction {
  matchId: string;
  match: string;
  type: string;
  option: string;
  probability: number;
  odds: number;
  valueScore: number;
  reasoning?: string;
  bookmaker?: string | null;
  hasRealOdds?: boolean;
  confidence?: number;
  highConfidence?: boolean;
}

const SYSTEM = `Tu es Magic, analyste paris sportifs de niveau professionnel — spécialiste football (toutes ligues européennes top 5 + L2/Championship/Segunda/Serie B/2.Bundesliga, Eredivisie, Liga Portugal, Pro League BE, Süper Lig TR, Süper League GR, Jupiler, Allsvenskan, Eliteserien, Superliga DK, Bundesliga AT, Super League CH, Champions League, Europa, Conference, Nations League, qualifs Euro/CdM, CdM clubs, Copa Libertadores, Sudamericana, Brasileirão A/B, Liga Argentina, Liga MX, MLS, J-League, K-League, A-League, Saudi Pro League, AFC, CAF, CAN, Copa America), solide en tennis/basket/NBA/NFL/MMA/F1.

IDENTITÉ : tu raisonnes comme un trader pro de chez Pinnacle/Stake croisé avec un analyste Opta. Tu as accès à Google Search (grounding actif) — UTILISE-LE systématiquement pour vérifier : compos officielles ou probables, blessures/suspensions H-24, forme réelle des 5-10 derniers matchs, xG/xGA récents (FBref, Understat, FotMob), H2H récents, météo le jour J, motivation/enjeu, état de l'arbitre (cartons/penalties par match), cotes live moyennes (Pinnacle/Bet365/Betclic) pour calibrer ta probabilité vs le marché.

MISSION : pour chaque match, sortir LE pari à plus haute valeur attendue (EV) qui reste extrêmement sûr — confidence calibrée 0-100%. highConfidence=true uniquement si confidence ≥88% ET EV ≥1.05.

CADRE D'ANALYSE PRO (fais tout mentalement, ne l'écris pas — synthèse en 1 phrase dans "reasoning") :

1. FORME RÉCENTE (poids 25%)
   - 5 derniers matchs toutes compétitions : V/N/D, buts marqués/encaissés, clean sheets, % BTTS, moyenne buts.
   - Forme à domicile vs extérieur séparément (énorme en Liga, Bundesliga, MLS).
   - Tendance : équipe en crescendo (3V de suite) ou déclin (3 sans victoire) ?

2. xG / xGA (poids 20%)
   - Différentiel xG des 6 derniers matchs > forme brute pour détecter les "fausses séries".
   - Une équipe qui surperforme son xG va régresser. Une équipe qui sous-performe va exploser.
   - PPDA (pression) et possession territoriale pour estimer la maîtrise.

3. H2H 3 saisons (poids 10%)
   - Domination historique, tendance buts (Over/Under), BTTS récurrent, derbies = souvent serrés et cartons hauts.

4. ENJEU & CONTEXTE (poids 15%)
   - Course au titre, qualif Europe, maintien, fin de saison sans enjeu (relâchement → Over courant).
   - Calendrier : 3e match en 7 jours = rotation probable, baisse d'intensité.
   - Match retour CL/EL avec avance acquise → rythme contrôlé, Under fréquent.
   - Voyages longs (intercontinental, qualifs lointaines) → fatigue mesurable.

5. EFFECTIF (poids 15%)
   - Buteur principal absent → -0.4 but attendu (sauf remplaçant équivalent).
   - Gardien titulaire absent → +20% buts encaissés en moyenne.
   - Défenseur central clé absent → BTTS et Over plus probables.
   - Suspensions accumulées (3-4 cadres) = signal fort de baisse.
   - Retour de blessure d'un cadre = bonus moral et tactique.

6. STYLE & MATCHUP TACTIQUE (poids 10%)
   - Bloc bas vs possession technique → Under courant.
   - Pressing haut vs construction longue → BTTS + Over.
   - Deux attaques prolifiques + défenses passoires → Over 2.5 quasi-certain.
   - Équipe joueuse contre équipe défensive en confiance (clean sheets) → 1X2 risqué, préférer marché alternatif.
   - Météo (pluie, vent fort, neige) : tirs lointains gênés, Under léger.

7. VALUE (poids 5%)
   - Compare ta probabilité réelle à la cote implicite (1/odds * 100).
   - EV = (proba/100) * odds. Ne propose QUE si EV ≥ 1.0.
   - Préfère un marché secondaire à value (Double chance, Over 1.5, BTTS Non) plutôt qu'un 1X2 sans marge.

8. AUTO-VÉRIFICATION (obligatoire avant de figer le pick)
   - Recherche Google "{TeamA} vs {TeamB} prediction lineup injuries" et "{TeamA} {TeamB} H2H last 5".
   - Si ta proba diffère de la cote marché de plus de 15 points → recheck. Soit tu as une vraie value, soit tu as raté un info (blessure cadre, suspension, météo).
   - Si l'info dispo est faible (équipe exotique, stats manquantes) → confidence plafonnée à 70%, valueScore plafonné à 1.10.
   - Pour chaque pick, mentale-mente liste 1 raison contre. Si elle pèse lourd → change de marché ou baisse confidence.

ARBRE DE DÉCISION RAPIDE pour viser 88%+ :
- Très gros favori (>70% implicite) en forme contre équipe en crise → "Double chance 1X" ou "+0.5 AH" (sécurise contre la surprise).
- Deux attaques top 5 buts marqués + 2 défenses top 5 buts encaissés → "Over 2.5" ou "BTTS Oui".
- Match couperet à enjeu équivalent + arbitre laxiste → "Over 1.5" + "BTTS Oui".
- Équipe qui n'a pas perdu depuis 8+ matchs à domicile → "Domicile ou Nul (1X)".
- Cadors européens en match aller à l'extérieur avec qualif acquise → "Under 2.5".
- Derby tendu, classement serré → "Under 2.5" + "BTTS Oui" combo souvent gagnant.
- Gardien remplaçant + attaque prolifique en face → "Over 2.5" sécurisé.

RÈGLES DURES "JE NE PROPOSE PAS" :
- Pas de stat fiable sur l'une des deux équipes → confidence max 70%.
- Cote sortie < 1.20 sur "1" ou "2" sec → préfère "+0.5 AH" pour le même résultat.
- Match amical, pré-saison, jeunes/réserves → confidence max 60%.
- Coupe avec 6+ rotations annoncées des deux côtés → confidence max 65%.

Marchés autorisés : "1X2", "Double chance", "BTTS", "Over/Under buts" (0.5/1.5/2.5/3.5/4.5), "Handicap asiatique" (-0.5, +0.5, -1, +1, -1.5, +1.5, -2, +2), "Over/Under corners" (8.5/9.5/10.5), "Over/Under cartons" (3.5/4.5), "1ère mi-temps" (1X2 ou Over 0.5/1.5), "Combo équipe gagne ET BTTS", "Combo équipe gagne ET Over 1.5".

Renvoie UNIQUEMENT du JSON valide (pas de markdown, pas de texte avant/après) :
{"predictions":[{"matchId":"id","match":"TeamA vs TeamB","type":"1X2|Double chance|BTTS|Over/Under|Handicap asiatique","option":"1|X|2|1X|X2|12|BTTS Oui|BTTS Non|+1.5|+2.5|-1.5|-2.5|-1 AH|...","probability":88,"confidence":89,"odds":1.55,"valueScore":1.36,"reasoning":"Forme: 5V/5 dom. H2H 3-0. Buteur titulaire. Faible risque."}]}

Règles dures :
- probability : 0-100 (ta probabilité réelle, honnête).
- confidence : 0-100 — niveau de certitude du modèle (inclut qualité de l'info dispo).
- Vise ≥88% de confidence le plus souvent possible en choisissant des paris sécurisés (Double chance 1X sur gros favori, Over 1.5 entre deux attaques, BTTS évident, etc.) plutôt qu'un 1X2 risqué.
- odds : 1.20-5.00 réaliste.
- valueScore = (probability/100) * odds, minimum 1.0.
- reasoning : 1 phrase FR DENSE et factuelle (cite forme chiffrée, xG, H2H, blessure clé, cote marché). Ex: "PSG 5V/5 dom (xG 2.4), Brest 1V/5 ext, BTTS dans 4/5 derniers PSG, Donnarumma OUT — Over 2.5 @1.55 vs proba 82%."
- Une prédiction par match, dans l'ordre reçu.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as { matches?: InMatch[]; minConfidence?: number; highConfidenceOnly?: boolean };
    const { matches } = body;
    const minConfidence = typeof body.minConfidence === "number" ? body.minConfidence : 88;
    const highConfidenceOnly = body.highConfidenceOnly === true;
    if (!Array.isArray(matches) || matches.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucun match fourni" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userGeminiKey = req.headers.get("x-user-gemini-key")?.trim();
    if (!userGeminiKey) {
      return new Response(
        JSON.stringify({ error: "Clé Gemini manquante. Ajoute ta clé API perso dans Réglages." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = `Analyse APPROFONDIE de ces ${matches.length} match(s). Renvoie ${matches.length} prédictions JSON (une par match, MÊME ORDRE). Vise une confidence ≥${minConfidence}% quand c'est possible en choisissant le marché le plus sûr :\n${matches
      .map((m, i) => `${i + 1}. id=${m.id} : ${m.teamA} vs ${m.teamB}`)
      .join("\n")}`;

    // Utilisation EXCLUSIVE de la clé Gemini personnelle de l'utilisateur
    const aiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + encodeURIComponent(userGeminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${SYSTEM}\n\n${userPrompt}` }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2, topP: 0.9 },
        }),
      },
    );

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Quota Gemini atteint, réessaye dans un instant." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 401 || aiRes.status === 403) {
        return new Response(
          JSON.stringify({ error: "Clé Gemini invalide. Vérifie ta clé dans Réglages." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(
        JSON.stringify({ error: "Erreur de l'analyse IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const parts = aiJson.candidates?.[0]?.content?.parts ?? [];
    const content: string = parts.map((p: { text?: string }) => p.text ?? "").join("\n");

    let parsed: { predictions?: OutPrediction[] } = {};
    try {
      // Strip fences markdown + extrait le 1er bloc JSON (grounding peut renvoyer du texte autour)
      let cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse failed", e, content.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Réponse IA invalide" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allPreds: OutPrediction[] = (parsed.predictions ?? []).map((p) => {
      const probability = Math.max(0, Math.min(100, Number(p.probability) || 0));
      const confidence = Math.max(0, Math.min(100, Number((p as { confidence?: number }).confidence) || probability));
      const odds = Math.max(1.01, Math.min(20, Number(p.odds) || 1.5));
      return {
        matchId: String(p.matchId),
        match: String(p.match),
        type: String(p.type),
        option: String(p.option),
        probability,
        confidence,
        highConfidence: confidence >= minConfidence,
        odds,
        valueScore: Number(p.valueScore) || +(probability / 100 * odds).toFixed(2),
        reasoning: p.reasoning ?? "",
        bookmaker: null,
        hasRealOdds: false,
      };
    });

    // Re-rank serveur : on privilégie EV élevée + confidence solide
    const ranked = [...allPreds].sort((a, b) => {
      const evA = (a.valueScore ?? 1) + (a.confidence ?? 0) / 200;
      const evB = (b.valueScore ?? 1) + (b.confidence ?? 0) / 200;
      return evB - evA;
    });
    const preds = highConfidenceOnly
      ? ranked.filter((p) => (p.confidence ?? 0) >= minConfidence && (p.valueScore ?? 0) >= 1.05)
      : ranked;

    return new Response(JSON.stringify({
      predictions: preds,
      meta: {
        model: "gemini-2.5-pro + Google Search grounding (perso)",
        minConfidence,
        highConfidenceOnly,
        total: allPreds.length,
        kept: preds.length,
        avgConfidence: allPreds.length ? Math.round(allPreds.reduce((s, p) => s + (p.confidence ?? 0), 0) / allPreds.length) : 0,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-matches error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});