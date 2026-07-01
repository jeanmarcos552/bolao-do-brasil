import { describe, it, expect } from 'vitest';
import { isEliminated, buildLeaderboard, type LiveBet, type MatchLeaderState } from '@/lib/leaderboard';

const live = (over: Partial<MatchLeaderState> = {}): MatchLeaderState =>
  ({ homeScore: 0, awayScore: 0, penalties: false, homePen: 0, awayPen: 0, status: 'live', ...over });

describe('isEliminated (jogo ao vivo)', () => {
  it('apostou 1x0 e o jogo está 0x1 => eliminado', () =>
    expect(isEliminated({ homeGuess: 1, awayGuess: 0 }, live({ homeScore: 0, awayScore: 1 }))).toBe(true));
  it('apostou 2x1 e o jogo está 0x1 => NÃO eliminado (2x1 ainda alcançável)', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 1 }, live({ homeScore: 0, awayScore: 1 }))).toBe(false));
  it('apostou 1x0 e o jogo está 1x0 => NÃO eliminado (ainda pode cravar)', () =>
    expect(isEliminated({ homeGuess: 1, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0 }))).toBe(false));
  it('apostou 2x0 e o jogo está 1x0 => NÃO eliminado (2x0 alcançável)', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0 }))).toBe(false));
  it('apostou 0x0 e o jogo está 1x0 => eliminado', () =>
    expect(isEliminated({ homeGuess: 0, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0 }))).toBe(true));
});

describe('isEliminated (pênaltis)', () => {
  const pen = live({ homeScore: 1, awayScore: 1, penalties: true, homePen: 5, awayPen: 4 });
  it('apostou no perdedor dos pênaltis => eliminado', () =>
    expect(isEliminated({ homeGuess: 0, awayGuess: 1 }, pen)).toBe(true));
  it('apostou no vencedor dos pênaltis => NÃO eliminado', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 0 }, pen)).toBe(false));
  it('pênaltis empatados no momento => ninguém eliminado', () =>
    expect(isEliminated({ homeGuess: 0, awayGuess: 1 }, live({ penalties: true, homePen: 2, awayPen: 2 }))).toBe(false));
});

describe('isEliminated (jogo encerrado)', () => {
  it('apostou 2x0 e terminou 1x0 => eliminado (exato exige ===)', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0, status: 'finished' }))).toBe(true));
  it('apostou 1x0 e terminou 1x0 => NÃO eliminado (exato)', () =>
    expect(isEliminated({ homeGuess: 1, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0, status: 'finished' }))).toBe(false));
});

describe('buildLeaderboard', () => {
  const bet = (uid: string, userName: string, h: number, a: number): LiveBet =>
    ({ uid, userName, photoURL: '', homeGuess: h, awayGuess: a });

  it('ordena por pontos e atribui posições sequenciais', () => {
    const rows = buildLeaderboard(
      [bet('u1', 'Ana', 0, 0), bet('u2', 'Bia', 2, 0), bet('u3', 'Léo', 1, 0)],
      live({ homeScore: 2, awayScore: 0 }),
    );
    // Bia crava 2x0 (3pts, pos 1), Léo acerta resultado (1pt, pos 2), Ana erra (0, pos 3)
    expect(rows.map((r) => r.uid)).toEqual(['u2', 'u3', 'u1']);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(rows[0].points).toBe(3);
  });

  it('manda eliminados para o fim mesmo com mesma pontuação', () => {
    // jogo 0x1: quem apostou vitória do visitante mas não pode cravar fica atrás
    const rows = buildLeaderboard(
      [bet('elim', 'Zé', 1, 0), bet('vivo', 'Duda', 2, 1)],
      live({ homeScore: 0, awayScore: 1 }),
    );
    expect(rows[rows.length - 1].uid).toBe('elim');
    expect(rows.find((r) => r.uid === 'elim')!.eliminated).toBe(true);
    expect(rows.find((r) => r.uid === 'vivo')!.eliminated).toBe(false);
  });

  it('desempata por proximidade e depois por nome', () => {
    // jogo 0x0: ninguém pontua; proximidade decide; empate de proximidade => nome
    const rows = buildLeaderboard(
      [bet('u1', 'Carla', 1, 0), bet('u2', 'Bruno', 0, 1)],
      live({ homeScore: 0, awayScore: 0 }),
    );
    // proximidade igual (1) => ordena por nome: Bruno antes de Carla
    expect(rows.map((r) => r.userName)).toEqual(['Bruno', 'Carla']);
  });
});
