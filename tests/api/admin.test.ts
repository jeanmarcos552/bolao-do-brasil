import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = 'admin@x.com';
  h = installAdminMock();
});

const body = (headers: Record<string, string>, data: unknown) =>
  new Request('http://t/api/admin/matches', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/admin/matches', () => {
  it('admin cria jogo', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/route');
    const res = await POST(body(headers, {
      homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪',
      competition: 'Eliminatórias', kickoffAt: 123456, cota: 10,
    }));
    const out = await res.json();
    expect(res.status).toBe(200);
    expect(out.id).toBeTruthy();
    expect(h.store.matches.get(out.id)).toMatchObject({ homeTeam: 'Brasil', status: 'scheduled', cota: 10 });
  });

  it('não-admin recebe 403', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/admin/matches/route');
    const res = await POST(body(headers, { homeTeam: 'X', awayTeam: 'Y', kickoffAt: 1, cota: 1 }));
    expect(res.status).toBe(403);
  });
});
