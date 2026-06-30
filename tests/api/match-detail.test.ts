import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
const NOW = 5000;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
});

describe('GET /api/matches/[id]', () => {
  it('antes da trava, só mostra o próprio palpite', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW + 1000, cota: 10, status: 'scheduled', homeScore: null, awayScore: null });
    h.store.bets.set('m1', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }],
      ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 1, points: null }],
    ]));
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.bets.map((b: any) => b.uid)).toEqual(['u1']);
    expect(body.round).toBeNull();
  });

  it('jogo encerrado mostra todos os palpites e o vencedor', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW - 1000, cota: 10, status: 'finished', homeScore: 2, awayScore: 0 });
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', pixKey: 'jean@pix', email: '', isAdmin: false, photoURL: '' });
    h.store.users.set('u2', { uid: 'u2', name: 'Bia', pixKey: 'bia@pix', email: '', isAdmin: false, photoURL: '' });
    h.store.bets.set('m1', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: 3 }],
      ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: 1 }],
    ]));
    const headers = asUser(h, 'u2', 'bia@x.com', 'Bia');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.bets.length).toBe(2);
    expect(body.round.winners.map((w: any) => w.uid)).toEqual(['u1']);
    expect(body.round.totalCollected).toBe(10);
    expect(body.round.winners[0].pixKey).toBe('jean@pix');
  });
});
