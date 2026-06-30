import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
  h.store.matches.set('m1', { status: 'finished', cota: 10, kickoffAt: 1 });
  h.store.matches.set('m2', { status: 'finished', cota: 10, kickoffAt: 2 });
  h.store.matches.set('m3', { status: 'scheduled', cota: 10, kickoffAt: 9 }); // ignorado
  h.store.bets.set('m1', new Map([
    ['u1', { uid: 'u1', userName: 'Jean', points: 3 }],
    ['u2', { uid: 'u2', userName: 'Bia', points: 1 }],
  ]));
  h.store.bets.set('m2', new Map([
    ['u1', { uid: 'u1', userName: 'Jean', points: 1 }],
    ['u2', { uid: 'u2', userName: 'Bia', points: 3 }],
  ]));
  h.store.bets.set('m3', new Map([['u1', { uid: 'u1', userName: 'Jean', points: null }]]));
});

describe('GET /api/ranking', () => {
  it('rodada 0 a 0 (todos zerados) não conta vitória', async () => {
    h.store.matches.clear(); h.store.bets.clear();
    h.store.matches.set('mz', { status: 'finished', cota: 10, kickoffAt: 1 });
    h.store.bets.set('mz', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', points: 0 }],
      ['u2', { uid: 'u2', userName: 'Bia', points: 0 }],
    ]));
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/ranking/route');
    const res = await GET(new Request('http://t/api/ranking', { headers }));
    const body = await res.json();
    const byUid = Object.fromEntries(body.ranking.map((r: any) => [r.uid, r]));
    expect(byUid['u1'].roundsWon).toBe(0);
    expect(byUid['u2'].roundsWon).toBe(0);
  });

  it('soma pontos e conta rodadas vencidas, ignorando jogos não finalizados', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/ranking/route');
    const res = await GET(new Request('http://t/api/ranking', { headers }));
    const body = await res.json();
    expect(res.status).toBe(200);
    // Jean: 3+1=4, venceu m1. Bia: 1+3=4, venceu m2. Empate em pontos -> ordem estável por roundsWon (igual=1) -> ambos 4 pts, 1 vitória
    const byUid = Object.fromEntries(body.ranking.map((r: any) => [r.uid, r]));
    expect(byUid['u1'].totalPoints).toBe(4);
    expect(byUid['u2'].totalPoints).toBe(4);
    expect(byUid['u1'].roundsWon).toBe(1);
    expect(byUid['u2'].roundsWon).toBe(1);
  });
});
