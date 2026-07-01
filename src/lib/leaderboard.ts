import { outcome, scoreBetForMatch } from '@/lib/scoring';

export interface LiveBet {
  uid: string;
  userName: string;
  photoURL: string;
  homeGuess: number;
  awayGuess: number;
}

export interface LeaderRow {
  uid: string;
  userName: string;
  photoURL: string;
  points: number;
  position: number;
  eliminated: boolean;
}

export interface MatchLeaderState {
  homeScore: number;
  awayScore: number;
  penalties: boolean;
  homePen: number;
  awayPen: number;
  status: string;
}

/** Eliminado = não pode mais cravar o placar exato E o resultado atual está contra o palpite. */
export function isEliminated(
  bet: { homeGuess: number; awayGuess: number },
  m: MatchLeaderState,
): boolean {
  if (m.penalties) {
    const w = outcome(m.homePen, m.awayPen);
    return w !== 0 && outcome(bet.homeGuess, bet.awayGuess) !== w;
  }
  const final = m.status === 'finished';
  const exactReachable = final
    ? bet.homeGuess === m.homeScore && bet.awayGuess === m.awayScore
    : bet.homeGuess >= m.homeScore && bet.awayGuess >= m.awayScore;
  if (exactReachable) return false;
  if (final) return true; // match finished, exact not reached => eliminated
  return outcome(bet.homeGuess, bet.awayGuess) !== outcome(m.homeScore, m.awayScore);
}

export function buildLeaderboard(bets: LiveBet[], m: MatchLeaderState): LeaderRow[] {
  const rows = bets.map((b) => ({
    b,
    points: scoreBetForMatch(b, m),
    eliminated: isEliminated(b, m),
    proximity: Math.abs(b.homeGuess - m.homeScore) + Math.abs(b.awayGuess - m.awayScore),
  }));
  rows.sort((x, y) => {
    if (x.eliminated !== y.eliminated) return x.eliminated ? 1 : -1; // eliminados por último
    if (y.points !== x.points) return y.points - x.points;           // mais pontos primeiro
    if (x.proximity !== y.proximity) return x.proximity - y.proximity; // mais perto do exato
    return x.b.userName.localeCompare(y.b.userName);                  // desempate estável por nome
  });
  return rows.map((r, i) => ({
    uid: r.b.uid,
    userName: r.b.userName,
    photoURL: r.b.photoURL,
    points: r.points,
    position: i + 1,
    eliminated: r.eliminated,
  }));
}
