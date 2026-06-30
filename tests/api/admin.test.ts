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

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

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

describe('POST /api/admin/matches — validação', () => {
  it('400 quando falta campo obrigatório', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/route');
    const res = await POST(body(headers, { homeTeam: 'Brasil' })); // faltam awayTeam, kickoffAt, cota
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/admin/matches/[id]', () => {
  const put = (headers: Record<string, string>, data: unknown) =>
    new Request('http://t/api/admin/matches/m1', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });

  it('403 para não-admin', async () => {
    h.store.matches.set('m1', { homeTeam: 'A', awayTeam: 'B', kickoffAt: 1, cota: 10, status: 'scheduled' });
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { PUT } = await import('@/app/api/admin/matches/[id]/route');
    const res = await PUT(put(headers, { cota: 20 }), ctx('m1'));
    expect(res.status).toBe(403);
  });

  it('404 jogo inexistente', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { PUT } = await import('@/app/api/admin/matches/[id]/route');
    const res = await PUT(new Request('http://t/api/admin/matches/xx', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ cota: 20 }) }), ctx('xx'));
    expect(res.status).toBe(404);
  });

  it('409 editar jogo finalizado', async () => {
    h.store.matches.set('m1', { homeTeam: 'A', awayTeam: 'B', kickoffAt: 1, cota: 10, status: 'finished' });
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { PUT } = await import('@/app/api/admin/matches/[id]/route');
    const res = await PUT(put(headers, { cota: 20 }), ctx('m1'));
    expect(res.status).toBe(409);
  });

  it('200 edita campos enquanto scheduled', async () => {
    h.store.matches.set('m1', { homeTeam: 'A', awayTeam: 'B', kickoffAt: 1, cota: 10, status: 'scheduled' });
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { PUT } = await import('@/app/api/admin/matches/[id]/route');
    const res = await PUT(put(headers, { cota: 25, homeTeam: 'Brasil' }), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.matches.get('m1')!.cota).toBe(25);
    expect(h.store.matches.get('m1')!.homeTeam).toBe('Brasil');
  });

  it('400 quando não há nada para atualizar', async () => {
    h.store.matches.set('m1', { homeTeam: 'A', awayTeam: 'B', kickoffAt: 1, cota: 10, status: 'scheduled' });
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { PUT } = await import('@/app/api/admin/matches/[id]/route');
    const res = await PUT(put(headers, { foo: 'bar' }), ctx('m1'));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/matches/[id]', () => {
  const del = (headers: Record<string, string>) =>
    new Request('http://t/api/admin/matches/m1', { method: 'DELETE', headers });

  it('403 para não-admin', async () => {
    h.store.matches.set('m1', { homeTeam: 'A', awayTeam: 'B', kickoffAt: 1, cota: 10, status: 'scheduled' });
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { DELETE } = await import('@/app/api/admin/matches/[id]/route');
    const res = await DELETE(del(headers), ctx('m1'));
    expect(res.status).toBe(403);
  });

  it('soft-delete marca status deleted', async () => {
    h.store.matches.set('m1', { homeTeam: 'A', awayTeam: 'B', kickoffAt: 1, cota: 10, status: 'scheduled' });
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { DELETE } = await import('@/app/api/admin/matches/[id]/route');
    const res = await DELETE(del(headers), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.matches.get('m1')!.status).toBe('deleted');
  });

  it('409 deletar jogo finalizado', async () => {
    h.store.matches.set('m1', { homeTeam: 'A', awayTeam: 'B', kickoffAt: 1, cota: 10, status: 'finished' });
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { DELETE } = await import('@/app/api/admin/matches/[id]/route');
    const res = await DELETE(del(headers), ctx('m1'));
    expect(res.status).toBe(409);
  });
});
