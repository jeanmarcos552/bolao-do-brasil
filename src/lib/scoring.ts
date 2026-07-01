export function outcome(home: number, away: number): -1 | 0 | 1 {
  if (home > away) return 1;
  if (home < away) return -1;
  return 0;
}

export function scoreBet(
  homeGuess: number,
  awayGuess: number,
  homeFinal: number,
  awayFinal: number,
): 0 | 1 | 3 {
  if (homeGuess === homeFinal && awayGuess === awayFinal) return 3;
  if (outcome(homeGuess, awayGuess) === outcome(homeFinal, awayFinal)) return 1;
  return 0;
}

export function scoreBetPenalties(
  homeGuess: number,
  awayGuess: number,
  homePen: number,
  awayPen: number,
): 0 | 1 {
  const guessed = outcome(homeGuess, awayGuess); // vencedor que o palpiteiro escolheu
  const winner = outcome(homePen, awayPen);      // quem venceu nos pênaltis
  if (winner === 0) return 0;                     // pênaltis empatados => ninguém pontua
  return guessed === winner ? 1 : 0;
}

export interface MatchScoreState {
  homeScore: number;
  awayScore: number;
  penalties: boolean;
  homePen: number;
  awayPen: number;
}

export function scoreBetForMatch(
  bet: { homeGuess: number; awayGuess: number },
  m: MatchScoreState,
): number {
  if (m.penalties) return scoreBetPenalties(bet.homeGuess, bet.awayGuess, m.homePen, m.awayPen);
  return scoreBet(bet.homeGuess, bet.awayGuess, m.homeScore, m.awayScore);
}
