// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

  it('jogo agendado tem link "Conduzir ao vivo" para a página do jogo', async () => {
    profileRef.profile = { isAdmin: true };
    call.mockResolvedValue({
      matches: [{
        id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '', awayFlag: '', competition: 'Eliminatórias',
        kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null,
        extraTime: false, penalties: false, homePen: 0, awayPen: 0, myBet: null,
      }],
    });
    render(<AdminPage />);
    const link = await screen.findByRole('link', { name: /conduzir ao vivo/i });
    expect(link).toHaveAttribute('href', '/jogo/m1');
  });

  it('selecionar time no seletor visitante envia nome e bandeira corretos no POST', async () => {
    profileRef.profile = { isAdmin: true };
    call.mockResolvedValue({ matches: [] });
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /cadastrar jogo/i })).toBeInTheDocument());

    // 2 selects: [0] = mandante, [1] = visitante
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    fireEvent.change(selects[1], { target: { value: 'Argentina' } });

    // kickoff é obrigatório para habilitar o botão
    fireEvent.change(screen.getByLabelText(/data e hora/i), { target: { value: '2026-06-20T16:00' } });

    call.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /cadastrar jogo/i }));

    await waitFor(() => {
      const post = call.mock.calls.find((c) => c[0] === '/api/admin/matches');
      expect(post).toBeTruthy();
      expect(post![1].body).toMatchObject({
        homeTeam: 'Brasil',
        homeFlag: '/flags/br.svg',
        awayTeam: 'Argentina',
        awayFlag: '/flags/ar.svg',
      });
    });
  });
});
