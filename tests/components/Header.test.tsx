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

  it('mostra a foto do Google quando o perfil tem photoURL', () => {
    authValue.profile = { name: 'Jean Silva', isAdmin: false, photoURL: 'http://foto/jean.png' };
    render(<Header />);
    const img = screen.getByAltText('Jean Silva') as HTMLImageElement;
    expect(img.src).toContain('http://foto/jean.png');
  });

  it('cai para as iniciais quando não há photoURL', () => {
    authValue.profile = { name: 'Jean Silva', isAdmin: false, photoURL: '' };
    render(<Header />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('JS')).toBeInTheDocument();
  });
});
