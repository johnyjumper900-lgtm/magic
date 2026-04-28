import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-gemini-key",
};

interface ParsedPick {
  match: string;
  teamA: string;
  teamB: string;
  option: string;
  type: string;
  odds: number;
}

interface ParsedTicket {
  picks: ParsedPick[];
  stake?: number;
  totalOdds?: number;
  bookmaker?: string;
}

const SYSTEM = `Tu es un extracteur expert de tickets de paris sportifs (Betclic, Winamax, Unibet, Bwin, PMU, PSEL, FDJ, Parions Sport, Zebet, Betway, Bet365, 1xBet, etc.).

MISSION : lire le document fourni (image photo, capture d'écran, ou PDF) et extraire avec précision **TOUS** les paris du ticket.

Pour chaque pari retourne :
- "teamA" : équipe/joueur 1 (ex: "Paris SG")
- "teamB" : équipe/joueur 2 (ex: "Marseille")
- "match" : "TeamA vs TeamB"
- "type" : marché parmi "1X2", "Double chance", "BTTS", "Over/Under buts", "Handicap asiatique", "Score exact", "Buteur", "Nombre de cartons", "Corners", "Mi-temps/Fin de match"
- "option" : choix précis en FR (ex: "1", "X", "2", "1X", "X2", "12", "BTTS Oui", "BTTS Non", "+1.5 buts", "+2.5 buts", "-2.5 buts", "Victoire Paris SG", "Nul", etc.)
- "odds" : cote décimale (nombre, ex 1.85)

Également, si visible :
- "stake" : mise en € (nombre)
- "totalOdds" : cote totale combinée
- "bookmaker" : nom du site (ex "Winamax")

RÈGLES STRICTES :
- Reconstruis proprement les noms d'équipes si l'OCR est imparfait.
- Ignore le texte promo/banner.
- Si un pari est illisible, essaie le meilleur effort mais garde-le.
- Réponds UNIQUEMENT avec du JSON valide, sans markdown ni texte autour :
{"picks":[{"teamA":"...","teamB":"...","match":"... vs ...","type":"...","option":"...","odds":1.85}],"stake":10,"totalOdds":3.2,"bookmaker":"Winamax"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as {
      fileBase64?: string;
      mimeType?: string;
      text?: string;
    };
    const { fileBase64, mimeType, text } = body;

    if (!fileBase64 && !text) {
      return new Response(
        JSON.stringify({ error: "Fournis un fichier (image/PDF) ou du texte" }),
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

    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
      { text: SYSTEM },
    ];
    if (fileBase64 && mimeType) {
      parts.push({ inline_data: { mime_type: mimeType, data: fileBase64 } });
      parts.push({ text: "Extrait tous les paris de ce ticket." });
    }
    if (text) {
      parts.push({ text: `Texte du ticket :\n${text}` });
    }

    const aiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        encodeURIComponent(userGeminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      },
    );

    if (!aiRes.ok) {
      if (aiRes.status === 401 || aiRes.status === 403) {
        return new Response(
          JSON.stringify({ error: "Clé Gemini invalide. Vérifie ta clé dans Réglages." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Quota Gemini atteint, réessaye plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return new Response(
        JSON.stringify({ error: "Erreur Gemini pendant la lecture du ticket" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let parsed: ParsedTicket = { picks: [] };
    try {
      const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse failed", e, content.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Réponse Gemini invalide" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalisation
    const picks: ParsedPick[] = (parsed.picks ?? [])
      .map((p) => ({
        teamA: String(p.teamA || "").trim(),
        teamB: String(p.teamB || "").trim(),
        match: String(p.match || `${p.teamA} vs ${p.teamB}`).trim(),
        type: String(p.type || "1X2"),
        option: String(p.option || "Victoire"),
        odds: Math.max(1.01, Math.min(100, Number(p.odds) || 0)),
      }))
      .filter((p) => p.teamA && p.teamB && p.odds >= 1.01);

    return new Response(
      JSON.stringify({
        picks,
        stake: typeof parsed.stake === "number" ? parsed.stake : undefined,
        totalOdds: typeof parsed.totalOdds === "number" ? parsed.totalOdds : undefined,
        bookmaker: parsed.bookmaker,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analyze-ticket error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
