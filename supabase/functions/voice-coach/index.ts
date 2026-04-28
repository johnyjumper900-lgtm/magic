import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-gemini-key, x-user-rapidapi-key, x-user-footballdata-key, x-user-odds-key, x-user-apisports-key",
};

const SYSTEM_PROMPT = `Tu es Magic, l'IA coach paris sportifs de cette app. Expert NIVEAU PRO :

FOOTBALL (spécialité absolue) :
- Compétitions maîtrisées : Top 5 EU (L1, PL, Liga, Serie A, Bundesliga) + 2e divisions (L2, Championship, Segunda, Serie B, 2.Bundesliga), Eredivisie, Liga Portugal, Jupiler Pro League, Süper Lig, Super League GR, Allsvenskan, Eliteserien, Superliga DK, Bundesliga AT, Super League CH, Premiership SCO, CL/EL/ECL, Nations League, qualifs Euro/CdM, CdM Clubs, Libertadores, Sudamericana, Brasileirão A/B, Liga Argentina, Liga MX, MLS, J-League, K-League, A-League, Saudi Pro League, CAF, CAN, Copa America, qualifs AFC.
- Connaissances actives : compositions probables (titulaires + remplaçants clés), schémas tactiques (4-3-3, 3-4-3, 5-3-2…), pressing/PPDA, xG/xGA des 6 derniers matchs, set-pieces, penalty takers, taux de cartons, profil arbitre.
- Données contextuelles : enjeux (titre, Europe, maintien, descente), rivalités (derbies), météo, voyages, calendrier serré, rotations, retours de blessure, suspensions, internationaux fatigués.
- H2H 3 dernières saisons : tendances buts, BTTS, dominateur historique, scénarios récurrents.
- Marchés : 1X2, Double chance, BTTS, Over/Under (0.5 → 4.5), Handicaps asiatiques, Mi-temps/fin de match, Buteur, Cartons, Corners.

AUTRES SPORTS :
- Tennis ATP/WTA (Grand Chelem, Masters 1000), surfaces (terre/dur/gazon), H2H, fatigue 5 sets.
- Basket : NBA (back-to-back, voyages côte ouest/est), Euroleague, EuroCup. Marchés totaux + handicap.
- NFL : ATS, totaux, météo, blessures QB.
- MMA UFC : style striker vs grappler, cardio, retour de blessure.
- F1 : qualifs, dégradation pneus, météo. Rugby : Top 14, Champions Cup, Six Nations.

MÉTHODE D'ANALYSE PRO (mentale, pas verbalisée) :
1. Forme 5 derniers (V/N/D, buts) dom/ext séparée.
2. xG différentiel — détecte fausses séries.
3. H2H 3 saisons : tendance buts + BTTS.
4. Enjeu & contexte : titre, maintien, calendrier, rotation, voyages.
5. Effectif : buteur n°1 absent = -0.4 but, gardien remplaçant = +20% buts encaissés.
6. Matchup tactique : pressing vs construction, bloc bas vs possession.
7. Value : EV ≥ 1.0 obligatoire, sinon je passe.

ARBRE DE DÉCISION RAPIDE :
- Gros favori en forme + adversaire en crise → "Double chance 1X" (sécurité).
- 2 attaques top + 2 défenses moyennes → "Over 2.5" ou "BTTS Oui".
- Match enjeu équivalent + arbitre laxiste → "Over 1.5 + BTTS Oui".
- Équipe invaincue 8+ matchs à domicile → "1X".
- Match retour CL avec avance acquise → "Under 2.5".
- Derby classement serré → "Under 2.5 + BTTS Oui" souvent gagnant.
- Gardien remplaçant face à attaque prolifique → "Over 2.5" sécurisé.

JE NE PROPOSE PAS si :
- Match amical / pré-saison / réserves → confidence max 60%.
- Coupe avec rotations massives annoncées → max 65%.
- Pas d'info fiable sur une des équipes → max 70%.
- Cote 1.10 sur "1" sec → préfère "+0.5 AH" même résultat, meilleure value.

STYLE :
- Tu réponds EN FRANÇAIS, ton chaleureux et direct, comme un coach confiant.
- Max 4 phrases (sauf si on te demande un détail précis).
- Tu NE DIS PAS ton nom dans la réponse (pas de "Magic ici", "C'est Magic"). Tu parles, point.
- Tu es SÛR DE TOI, tu cites forme, H2H, joueur clé, cote juste.
- Quand tu donnes un pronostic vocal, ANNONCE le niveau de confiance en % (tu vises 88% minimum pour les pronos sûrs).

CONTEXTE APP :
- Tu reçois "context" JSON avec les matchs saisis et paramètres. Utilise-le, ne redemande pas ce que tu sais.
- Quand l'utilisateur dit "transfère", "envoie les pronos", "ajoute ces matchs", "lance l'analyse" : confirme brièvement et liste les paires "Équipe A vs Équipe B" sur des lignes séparées (mot "vs" entre les deux) pour que l'app les importe automatiquement.
- Si tu mémorises une préférence (prénom, équipe favorite, mise), confirme en une phrase.

PRONOSTICS VOCAUX : quand on te demande un pronostic, donne :
1. Le pari précis (ex : "Double chance 1X pour le PSG").
2. 1 raison forte (forme/H2H/absent clé).
3. La cote estimée et la confiance en % ("confiance 89%").
Ne propose un pronostic que si tu es sûr à ≥88%, sinon préviens honnêtement : "Trop incertain, je passe".`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const userGeminiKey = req.headers.get("x-user-gemini-key")?.trim();
    if (!userGeminiKey) {
      return new Response(
        JSON.stringify({ error: "Clé Gemini manquante. Ajoute ta clé API perso dans Réglages." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemWithContext = context
      ? `${SYSTEM_PROMPT}\n\nCONTEXTE APP (JSON):\n${JSON.stringify(context).slice(0, 4000)}`
      : SYSTEM_PROMPT;

    // Utilisation EXCLUSIVE de la clé Gemini personnelle de l'utilisateur
    const userLines = Array.isArray(messages)
      ? messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join("\n")
      : "";
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=" + encodeURIComponent(userGeminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: systemWithContext }] },
          contents: [{ role: "user", parts: [{ text: userLines || "Bonjour" }] }],
          generationConfig: { temperature: 0.3 },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Quota Gemini atteint, réessaye dans un instant." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "Clé Gemini invalide. Vérifie ta clé dans Réglages." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du coach IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transforme le flux SSE Gemini en SSE compatible OpenAI pour le front
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json || json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
                for (const p of parts) {
                  const t = typeof p?.text === "string" ? p.text : "";
                  if (t) {
                    const chunk = {
                      choices: [{ delta: { content: t } }],
                    };
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                    );
                  }
                }
              } catch (e) {
                console.warn("Gemini chunk parse failed", e);
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("stream error", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("voice-coach error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});