import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = 'admin@x.com';
  h = installAdminMock();
});

async function loadRoute() {
  return import('@/app/api/me/route');
}

describe('GET /api/me', () => {
  it('cria o perfil no primeiro acesso e marca isAdmin', async () => {
    const headers = asUser(h, 'u1', 'admin@x.com', 'Jean');
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://t/api/me', { headers }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.uid).toBe('u1');
    expect(body.isAdmin).toBe(true);
    expect(body.pixKey).toBe('');
    expect(h.store.users.get('u1')).toBeTruthy();
  });

  it('401 sem token', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://t/api/me'));
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/me', () => {
  it('atualiza nome e pixKey', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { PUT } = await loadRoute();
    const res = await PUT(new Request('http://t/api/me', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jean S', pixKey: 'jean@pix' }),
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pixKey).toBe('jean@pix');
    expect(h.store.users.get('u1')!.pixKey).toBe('jean@pix');
  });

  it('400 quando falta nome ou pix', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { PUT } = await loadRoute();
    const res = await PUT(new Request('http://t/api/me', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', pixKey: '' }),
    }));
    expect(res.status).toBe(400);
  });
});
