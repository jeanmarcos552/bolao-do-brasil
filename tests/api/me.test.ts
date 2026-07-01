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

  it('captura a foto do Google (picture) no primeiro acesso', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean', 'http://foto/jean.png');
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://t/api/me', { headers }));
    const body = await res.json();
    expect(body.photoURL).toBe('http://foto/jean.png');
    expect(h.store.users.get('u1')!.photoURL).toBe('http://foto/jean.png');
  });

  it('atualiza a photoURL de usuário existente quando o Google muda', async () => {
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', email: 'jean@x.com', photoURL: '', pixKey: 'j@pix', isAdmin: false });
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean', 'http://foto/nova.png');
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://t/api/me', { headers }));
    const body = await res.json();
    expect(body.photoURL).toBe('http://foto/nova.png');
    expect(h.store.users.get('u1')!.photoURL).toBe('http://foto/nova.png');
  });

  it('não apaga a photoURL existente quando o token não traz picture', async () => {
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', email: 'jean@x.com', photoURL: 'http://foto/antiga.png', pixKey: 'j@pix', isAdmin: false });
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean', '');
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://t/api/me', { headers }));
    const body = await res.json();
    expect(body.photoURL).toBe('http://foto/antiga.png');
    expect(h.store.users.get('u1')!.photoURL).toBe('http://foto/antiga.png');
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
