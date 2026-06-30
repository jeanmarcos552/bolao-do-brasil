export type MatchStatus = 'scheduled' | 'finished' | 'deleted';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  pixKey: string;
  isAdmin: boolean;
}

/** Match serializado para a API (datas em epoch ms). */
export interface MatchDTO {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  competition: string;
  kickoffAt: number;
  cota: number;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface BetDTO {
  uid: string;
  userName: string;
  homeGuess: number;
  awayGuess: number;
  points: number | null;
}
