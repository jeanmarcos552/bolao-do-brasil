import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = 'admin@x.com';
  h = installAdminMock();
  h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null });
  h.store.bets.set('m1', new Map([
    ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }], // exato -> 3
    ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: null }],  // só resultado -> 1
    ['u3', { uid: 'u3', userName: 'Léo', homeGuess: 0, awayGuess: 2, points: null }],  // errou -> 0
  ]));
});

const send = (headers: Record<string, string>, data: unknown) =>
  new Request('http://t/api/admin/matches/m1/result', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/admin/matches/[id]/result', () => {
  it('pontua todos e marca finished', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/result/route');
    const res = await POST(send(headers, { homeScore: 2, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(200);
    const bets = h.store.bets.get('m1')!;
    expect(bets.get('u1')!.points).toBe(3);
    expect(bets.get('u2')!.points).toBe(1);
    expect(bets.get('u3')!.points).toBe(0);
    expect(h.store.matches.get('m1')!.status).toBe('finished');
    expect(h.store.matches.get('m1')!.homeScore).toBe(2);
  });

  it('409 se já finalizado', async () => {
    h.store.matches.get('m1')!.status = 'finished';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/result/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 1 }), ctx('m1'));
    expect(res.status).toBe(409);
  });
});
