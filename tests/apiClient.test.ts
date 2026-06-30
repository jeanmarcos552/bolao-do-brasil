import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '@/lib/apiClient';

beforeEach(() => { vi.restoreAllMocks(); });

describe('apiFetch', () => {
  it('anexa o Bearer token e parseia JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hi: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await apiFetch<{ hi: number }>('/api/x', { token: 'tkn' });
    expect(out.hi).toBe(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tkn');
  });

  it('serializa body e seta content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/x', { method: 'POST', body: { a: 1 }, token: 't' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('lança Error com a mensagem do servidor em status !ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Palpites encerrados' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/api/x', { token: 't' })).rejects.toThrow('Palpites encerrados');
  });
});
