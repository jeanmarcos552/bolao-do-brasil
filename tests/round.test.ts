import { describe, it, expect } from 'vitest';
import { resolveRound, type ScoredBet } from '@/lib/round';

const b = (uid: string, points: number): ScoredBet => ({
  uid, userName: uid, pixKey: `${uid}@pix`, points,
});

describe('resolveRound', () => {
  it('um vencedor: arrecada cota dos demais', () => {
    const r = resolveRound([b('a', 3), b('b', 1), b('c', 0)], 10);
    expect(r.winners.map(w => w.uid)).toEqual(['a']);
    expect(r.topPoints).toBe(3);
    expect(r.participants).toBe(3);
    expect(r.totalCollected).toBe(20); // 10 * (3 - 1)
    expect(r.perWinner).toBe(20);
  });

  it('empate de 2: divide o arrecadado igualmente', () => {
    const r = resolveRound([b('a', 3), b('b', 3), b('c', 0), b('d', 1)], 10);
    expect(r.winners.map(w => w.uid).sort()).toEqual(['a', 'b']);
    expect(r.totalCollected).toBe(20); // 10 * (4 - 2)
    expect(r.perWinner).toBe(10);      // 20 / 2
  });

  it('todos zerados: todos vencem, nada a arrecadar', () => {
    const r = resolveRound([b('a', 0), b('b', 0)], 10);
    expect(r.winners.length).toBe(2);
    expect(r.totalCollected).toBe(0);
    expect(r.perWinner).toBe(0);
  });

  it('sem palpites: resultado vazio', () => {
    const r = resolveRound([], 10);
    expect(r.winners).toEqual([]);
    expect(r.participants).toBe(0);
    expect(r.totalCollected).toBe(0);
  });
});
