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
