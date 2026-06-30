// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
const authValue: { profile: unknown; signOut: () => void } = { profile: null, signOut: vi.fn() };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => authValue }));

import Header from '@/components/Header';

describe('Header', () => {
  it('não mostra link Admin para não-admin', () => {
    authValue.profile = { name: 'Jean', isAdmin: false };
    render(<Header />);
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getByText('Jogos')).toBeInTheDocument();
  });

  it('mostra link Admin para admin', () => {
    authValue.profile = { name: 'Jean', isAdmin: true };
    render(<Header />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
