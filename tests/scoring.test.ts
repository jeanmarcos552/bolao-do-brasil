import { describe, it, expect } from 'vitest';
import { scoreBet, outcome, scoreBetPenalties, scoreBetForMatch } from '@/lib/scoring';

describe('outcome', () => {
  it('mandante vence => 1', () => expect(outcome(2, 1)).toBe(1));
  it('visitante vence => -1', () => expect(outcome(0, 3)).toBe(-1));
  it('empate => 0', () => expect(outcome(1, 1)).toBe(0));
});

describe('scoreBet', () => {
  it('placar exato => 3', () => expect(scoreBet(2, 1, 2, 1)).toBe(3));
  it('acertou só o vencedor => 1', () => expect(scoreBet(2, 1, 3, 0)).toBe(1));
  it('acertou só o empate => 1', () => expect(scoreBet(1, 1, 2, 2)).toBe(1));
  it('errou o resultado => 0', () => expect(scoreBet(2, 1, 0, 1)).toBe(0));
  it('errou empate vs vitória => 0', () => expect(scoreBet(1, 1, 2, 0)).toBe(0));
  it('placar exato com gols altos => 3', () => expect(scoreBet(4, 3, 4, 3)).toBe(3));
});

describe('scoreBetPenalties', () => {
  it('apostou no mandante e mandante venceu os pênaltis => 1', () => expect(scoreBetPenalties(1, 0, 4, 2)).toBe(1));
  it('apostou no visitante e mandante venceu => 0', () => expect(scoreBetPenalties(0, 1, 4, 2)).toBe(0));
  it('apostou empate => 0 (não escolheu vencedor)', () => expect(scoreBetPenalties(1, 1, 4, 2)).toBe(0));
  it('pênaltis empatados no momento => 0', () => expect(scoreBetPenalties(1, 0, 2, 2)).toBe(0));
});

describe('scoreBetForMatch', () => {
  it('sem pênaltis usa scoreBet (exato => 3)', () =>
    expect(scoreBetForMatch({ homeGuess: 2, awayGuess: 0 }, { homeScore: 2, awayScore: 0, penalties: false, homePen: 0, awayPen: 0 })).toBe(3));
  it('sem pênaltis, só resultado => 1', () =>
    expect(scoreBetForMatch({ homeGuess: 3, awayGuess: 1 }, { homeScore: 2, awayScore: 0, penalties: false, homePen: 0, awayPen: 0 })).toBe(1));
  it('com pênaltis, acertou o vencedor => 1', () =>
    expect(scoreBetForMatch({ homeGuess: 1, awayGuess: 0 }, { homeScore: 1, awayScore: 1, penalties: true, homePen: 5, awayPen: 4 })).toBe(1));
  it('com pênaltis, errou o vencedor => 0', () =>
    expect(scoreBetForMatch({ homeGuess: 0, awayGuess: 1 }, { homeScore: 1, awayScore: 1, penalties: true, homePen: 5, awayPen: 4 })).toBe(0));
});
