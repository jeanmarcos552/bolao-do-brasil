// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/conta', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({ name: 'Jean', pixKey: 'jean@pix', isAdmin: false });
const refreshProfile = vi.fn();
const authValue = { user: { uid: 'u1' }, profile: { name: 'Jean', email: 'j@x.com', pixKey: '', isAdmin: false }, loading: false, call, refreshProfile };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => authValue }));

import ContaPage from '@/app/(protected)/conta/page';

describe('ContaPage', () => {
  it('salva nome e pix via PUT /api/me', async () => {
    render(<ContaPage />);
    const pix = screen.getByLabelText(/chave pix/i);
    await userEvent.clear(pix);
    await userEvent.type(pix, 'jean@pix');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(call).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'PUT' }));
  });
});
