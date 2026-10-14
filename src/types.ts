export interface Info { handle: string; rating?: number; maxRating?: number; rank?: string; avatar?: string }
export interface RatingChange { t: number; contest: string; rank: number; oldRating: number; newRating: number }
export interface Count { name: string; count: number }
export interface Profile {
  info: Info;
  ratingHistory: RatingChange[];
  solved: number;
  submissions: number;
  verdicts: Count[];
  tags: Count[];
  ratings: { bucket: number; count: number }[];
  unrated: number;
}
export interface SolvedProblem { id: string; name: string; rating?: number; tags: string[]; t: number; url: string }
export interface LeaderboardEntry {
  info: Info; isSelf: boolean; count: number; points: number; problems: SolvedProblem[]; error?: string;
}
export interface Leaderboard { weekStart: number; entries: LeaderboardEntry[] }
