export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  teamALogo?: string;
  teamBLogo?: string;
}

export interface Prediction {
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
  teamALogo?: string;
  teamBLogo?: string;
}

export interface CalendarMatch extends Match {
  date: string;
  time: string;
  league: string;
  leagueEmblem?: string;
  countryFlag?: string;
  countryCode?: string;
  utcDate?: string;
  venue?: string;
  status?: string;
  /** Real bookmaker odds aggregated from The Odds API (when key is set) */
  realOdds?: {
    home?: number;
    draw?: number;
    away?: number;
    bestHome?: number;
    bestDraw?: number;
    bestAway?: number;
    bookmakers: string[];
    commenceTimeUTC?: string;
    impliedHome?: number;
    impliedDraw?: number;
    impliedAway?: number;
  };
  parisDate?: string;
  parisTime?: string;
  /** Lat/long du stade pour la météo (rempli quand connu). */
  venueLat?: number;
  venueLon?: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  odds: string;
  confidence: string;
  profit: string;
  date: string;
  stake?: number;
  status?: "draft" | "validated";
  validatedAt?: string;
  potentialWin?: number;
  picks?: Array<{
    match: string;
    option: string;
    type: string;
    odds: number;
    probability: number;
    result?: "won" | "lost" | "pending";
    /** Identifiant TheSportsDB du match (rempli pour le suivi live). */
    eventId?: string;
  }>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
