import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notifyMatchUpdate } from '@/lib/wsNotify';

beforeEach(() => {
  delete process.env.WS_PUBLISH_URL;
  delete process.env.WS_API_KEY;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('notifyMatchUpdate', () => {
  it('no-op sem env: não chama fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));
    await notifyMatchUpdate('m1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('com env: faz POST com X-API-KEY e body do evento', async () => {
    process.env.WS_PUBLISH_URL = 'https://ws.example/events/checkin';
    process.env.WS_API_KEY = 'secret';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));
    await notifyMatchUpdate('m1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://ws.example/events/checkin');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-API-KEY']).toBe('secret');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ event: 'match_update', room: 'match:m1', matchId: 'm1' });
  });

  it('não lança se o fetch rejeitar', async () => {
    process.env.WS_PUBLISH_URL = 'https://ws.example/events/checkin';
    process.env.WS_API_KEY = 'secret';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('rede caiu'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyMatchUpdate('m1')).resolves.toBeUndefined();
  });
});
