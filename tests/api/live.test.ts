import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = 'admin@x.com';
  h = installAdminMock();
  h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null });
});

const send = (headers: Record<string, string>, data: unknown) =>
  new Request('http://t/api/admin/matches/m1/live', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/admin/matches/[id]/live', () => {
  it('inicia o jogo ao vivo (scheduled -> live, 0x0)', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 0, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(200);
    const m = h.store.matches.get('m1')!;
    expect(m.status).toBe('live');
    expect(m.homeScore).toBe(0);
    expect(m.startedAt).toBeDefined();
  });

  it('atualiza o placar de um jogo já ao vivo', async () => {
    h.store.matches.get('m1')!.status = 'live';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 2, awayScore: 1 }), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.matches.get('m1')!.homeScore).toBe(2);
    expect(h.store.matches.get('m1')!.status).toBe('live');
  });

  it('marca pênaltis sem mexer no status', async () => {
    h.store.matches.get('m1')!.status = 'live';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { penalties: true, homePen: 1, awayPen: 0 }), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.matches.get('m1')!.penalties).toBe(true);
    expect(h.store.matches.get('m1')!.homePen).toBe(1);
  });

  it('400 para placar inválido', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: -1, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(400);
  });

  it('400 quando não há nada para atualizar', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, {}), ctx('m1'));
    expect(res.status).toBe(400);
  });

  it('409 se o jogo já finalizou', async () => {
    h.store.matches.get('m1')!.status = 'finished';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(409);
  });

  it('403 para não-admin', async () => {
    const headers = asUser(h, 'u1', 'user@x.com', 'User');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(403);
  });
});
