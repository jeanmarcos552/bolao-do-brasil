// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ replace, push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({ matches: [] });
const profileRef = { profile: { isAdmin: true } as { isAdmin: boolean } | null };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call, profile: profileRef.profile }) }));

import AdminPage from '@/app/(protected)/admin/page';

describe('AdminPage', () => {
  it('admin vê o formulário de cadastro de jogo', async () => {
    profileRef.profile = { isAdmin: true };
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /cadastrar jogo/i })).toBeInTheDocument());
  });

  it('não-admin é redirecionado para a home', async () => {
    profileRef.profile = { isAdmin: false };
    render(<AdminPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });
});
