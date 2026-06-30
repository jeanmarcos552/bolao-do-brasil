export interface ScoredBet {
  uid: string;
  userName: string;
  pixKey: string;
  points: number;
}

export interface RoundWinner {
  uid: string;
  userName: string;
  pixKey: string;
}

export interface RoundResult {
  winners: RoundWinner[];
  topPoints: number;
  participants: number;
  totalCollected: number;
  perWinner: number;
  cota: number;
}

export function resolveRound(bets: ScoredBet[], cota: number): RoundResult {
  if (bets.length === 0) {
    return { winners: [], topPoints: 0, participants: 0, totalCollected: 0, perWinner: 0, cota };
  }
  const topPoints = Math.max(...bets.map((b) => b.points));
  const winners = bets.filter((b) => b.points === topPoints);
  const losers = bets.length - winners.length;
  const totalCollected = cota * losers;
  const perWinner = winners.length > 0 ? totalCollected / winners.length : 0;
  return {
    winners: winners.map((w) => ({ uid: w.uid, userName: w.userName, pixKey: w.pixKey })),
    topPoints,
    participants: bets.length,
    totalCollected,
    perWinner,
    cota,
  };
}
