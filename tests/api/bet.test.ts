import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
const NOW = 5000;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
  h.store.users.set('u1', { uid: 'u1', name: 'Jean', email: 'jean@x.com', pixKey: 'jean@pix', isAdmin: false, photoURL: '' });
  h.store.users.set('u2', { uid: 'u2', name: 'Sem Pix', email: 's@x.com', pixKey: '', isAdmin: false, photoURL: '' });
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function openMatch() {
  h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW + 1000, cota: 10, status: 'scheduled' });
}
function closedMatch() {
  h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW - 1, cota: 10, status: 'scheduled' });
}
const post = (headers: Record<string, string>, body: unknown) =>
  new Request('http://t/api/matches/m1/bet', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/matches/[id]/bet', () => {
  it('grava palpite antes do horário', async () => {
    openMatch();
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 2, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.bets.get('m1')!.get('u1')).toMatchObject({ homeGuess: 2, awayGuess: 1, points: null, userName: 'Jean' });
  });

  it('409 depois do horário (trava)', async () => {
    closedMatch();
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 2, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(409);
  });

  it('403 sem pixKey', async () => {
    openMatch();
    const headers = asUser(h, 'u2', 's@x.com', 'Sem Pix');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 1, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(403);
  });

  it('400 placar inválido', async () => {
    openMatch();
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: -1, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(400);
  });

  it('404 jogo inexistente', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 1, awayGuess: 1 }), ctx('xx'));
    expect(res.status).toBe(404);
  });
});
