import { describe, it, expect } from 'vitest';
import { scoreBet, outcome } from '@/lib/scoring';

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
