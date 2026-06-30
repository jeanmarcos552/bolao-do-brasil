import { describe, it, expect, beforeEach } from 'vitest';

describe('isAdminEmail', () => {
  beforeEach(() => { process.env.ADMIN_EMAILS = 'a@x.com, B@X.com'; });

  it('reconhece e-mail admin (case-insensitive)', async () => {
    const { isAdminEmail } = await import('@/lib/auth');
    expect(isAdminEmail('A@X.com')).toBe(true);
    expect(isAdminEmail('b@x.com')).toBe(true);
  });

  it('nega e-mail fora da lista', async () => {
    const { isAdminEmail } = await import('@/lib/auth');
    expect(isAdminEmail('outro@x.com')).toBe(false);
  });
});
