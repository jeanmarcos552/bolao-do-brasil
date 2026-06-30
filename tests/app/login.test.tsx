// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: push, push }) }));
const authValue = { user: null as unknown, loading: false, signInGoogle: vi.fn() };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => authValue }));

import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('botão chama signInGoogle', async () => {
    authValue.user = null; authValue.loading = false;
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));
    expect(authValue.signInGoogle).toHaveBeenCalled();
  });
});
