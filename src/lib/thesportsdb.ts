/**
 * TheSportsDB v1 API client
 * Base URL configured per user request: https://www.thesportsdb.com/api/v1/json
 * Free tier uses key "3" (test key). Replace with user's premium key in localStorage if available.
 */

const BASE = "https://www.thesportsdb.com/api/v1/json";

function getKey(): string {
  try {
    return localStorage.getItem("thesportsdb.apikey") || "3";
  } catch {
    return "3";
  }
}

export const TheSportsDB = {
  baseUrl: BASE,
  /** Search teams by name */
  async searchTeams(name: string) {
    const r = await fetch(`${BASE}/${getKey()}/searchteams.php?t=${encodeURIComponent(name)}`);
    return r.json();
  },
  /** Search events by name e.g. "Arsenal_vs_Chelsea" */
  async searchEvents(query: string) {
    const r = await fetch(`${BASE}/${getKey()}/searchevents.php?e=${encodeURIComponent(query)}`);
    return r.json();
  },
  /** Next 15 events for a league (id) */
  async leagueNextEvents(leagueId: string) {
    const r = await fetch(`${BASE}/${getKey()}/eventsnextleague.php?id=${leagueId}`);
    return r.json();
  },
  /** All events on a date — d=YYYY-MM-DD, s=Soccer */
  async eventsOnDate(date: string, sport = "Soccer") {
    const r = await fetch(`${BASE}/${getKey()}/eventsday.php?d=${date}&s=${sport}`);
    return r.json();
  },
  /** Past events of a league */
  async leaguePastEvents(leagueId: string) {
    const r = await fetch(`${BASE}/${getKey()}/eventspastleague.php?id=${leagueId}`);
    return r.json();
  },
  /** Lookup event by id (live score check) */
  async lookupEvent(eventId: string) {
    const r = await fetch(`${BASE}/${getKey()}/lookupevent.php?id=${eventId}`);
    return r.json();
  },
  /** All leagues */
  async allLeagues() {
    const r = await fetch(`${BASE}/${getKey()}/all_leagues.php`);
    return r.json();
  },
  /** Lookup full team by id */
  async lookupTeam(teamId: string) {
    const r = await fetch(`${BASE}/${getKey()}/lookupteam.php?id=${teamId}`);
    return r.json();
  },
  /** Last 5 events of a team */
  async lastTeamEvents(teamId: string) {
    const r = await fetch(`${BASE}/${getKey()}/eventslast.php?id=${teamId}`);
    return r.json();
  },
  /** Next 5 events of a team */
  async nextTeamEvents(teamId: string) {
    const r = await fetch(`${BASE}/${getKey()}/eventsnext.php?id=${teamId}`);
    return r.json();
  },
  /** Head-to-head: searches recent events containing both team names */
  async headToHead(teamA: string, teamB: string) {
    const q = `${teamA}_vs_${teamB}`.replace(/\s+/g, "_");
    const r = await fetch(`${BASE}/${getKey()}/searchevents.php?e=${encodeURIComponent(q)}`);
    return r.json();
  },
};

export type SDBEvent = {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus?: string;
  strProgress?: string;
  dateEvent?: string;
  strTime?: string;
  strLeague?: string;
  strLeagueBadge?: string;
  strCountry?: string;
  strVenue?: string;
};
