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
  it('404 para jogo deletado', async () => {
    h.store.matches.set('mdel', { homeTeam: 'X', awayTeam: 'Y', kickoffAt: 1, cota: 10, status: 'deleted', homeScore: null, awayScore: null });
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/mdel', { headers }), ctx('mdel'));
    expect(res.status).toBe(404);
  });

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

  it('jogo ao vivo revela todos os palpites e devolve leaderboard com fotos', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW + 999999, cota: 10, status: 'live', homeScore: 2, awayScore: 0 });
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', pixKey: 'j@pix', email: '', isAdmin: false, photoURL: 'http://foto/jean.png' });
    h.store.users.set('u2', { uid: 'u2', name: 'Bia', pixKey: 'b@pix', email: '', isAdmin: false, photoURL: '' });
    h.store.bets.set('m1', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }], // crava 2x0 -> topo
      ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 0, awayGuess: 1, points: null }],  // eliminado
    ]));
    const headers = asUser(h, 'u2', 'bia@x.com', 'Bia');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.bets.length).toBe(2); // revelado mesmo antes do kickoff, porque está ao vivo
    expect(body.round).toBeNull();
    expect(body.leaderboard[0].uid).toBe('u1');
    expect(body.leaderboard[0].photoURL).toBe('http://foto/jean.png');
    expect(body.leaderboard[0].position).toBe(1);
    expect(body.leaderboard.find((r: any) => r.uid === 'u2').eliminated).toBe(true);
  });

  it('vencedor traz photoURL', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW - 1000, cota: 10, status: 'finished', homeScore: 2, awayScore: 0 });
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', pixKey: 'jean@pix', email: '', isAdmin: false, photoURL: 'http://foto/jean.png' });
    h.store.bets.set('m1', new Map([['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: 3 }]]));
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.round.winners[0].photoURL).toBe('http://foto/jean.png');
    expect(body.leaderboard).not.toBeNull();
  });
});
