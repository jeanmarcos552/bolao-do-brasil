import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
  h.store.matches.set('m1', {
    homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪',
    competition: 'Eliminatórias', kickoffAt: 2000, cota: 10, status: 'scheduled',
    homeScore: null, awayScore: null,
  });
  h.store.matches.set('m2', {
    homeTeam: 'Brasil', awayTeam: 'Japão', homeFlag: '🇧🇷', awayFlag: '🇯🇵',
    competition: 'Amistoso', kickoffAt: 1000, cota: 20, status: 'scheduled',
    homeScore: null, awayScore: null,
  });
  h.store.bets.set('m1', new Map([['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }]]));
});

describe('GET /api/matches', () => {
  it('lista jogos ordenados por kickoff e inclui meu palpite', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/matches/route');
    const res = await GET(new Request('http://t/api/matches', { headers }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.matches.map((m: any) => m.id)).toEqual(['m2', 'm1']); // 1000 antes de 2000
    const m1 = body.matches.find((m: any) => m.id === 'm1');
    expect(m1.myBet.homeGuess).toBe(2);
    const m2 = body.matches.find((m: any) => m.id === 'm2');
    expect(m2.myBet).toBeNull();
  });
});
