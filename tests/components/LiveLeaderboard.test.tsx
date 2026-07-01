// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import type { LeaderRow } from '@/lib/leaderboard';

const row = (over: Partial<LeaderRow>): LeaderRow =>
  ({ uid: 'u', userName: 'X', photoURL: '', points: 0, position: 1, eliminated: false, ...over });

describe('LiveLeaderboard', () => {
  const rows: LeaderRow[] = [
    row({ uid: 'u1', userName: 'Ana', position: 1 }),
    row({ uid: 'u2', userName: 'Bia', position: 2 }),
    row({ uid: 'u3', userName: 'Léo', position: 3 }),
    row({ uid: 'u4', userName: 'Duda', position: 4 }),
    row({ uid: 'u5', userName: 'Zé', position: 5, eliminated: true }),
  ];

  it('dá o tamanho certo por posição', () => {
    render(<LiveLeaderboard rows={rows} />);
    expect((screen.getByTestId('leader-u1') as HTMLElement).style.width).toBe('240px');
    expect((screen.getByTestId('leader-u2') as HTMLElement).style.width).toBe('200px');
    expect((screen.getByTestId('leader-u3') as HTMLElement).style.width).toBe('180px');
    expect((screen.getByTestId('leader-u4') as HTMLElement).style.width).toBe('120px');
  });

  it('mostra medalha só no top-3 não-eliminado', () => {
    render(<LiveLeaderboard rows={rows} />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('eliminado: 120px, borda vermelha, grayscale e sem medalha', () => {
    render(<LiveLeaderboard rows={rows} />);
    const el = screen.getByTestId('leader-u5') as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(el.innerHTML).toContain('border-red-500');
    expect(el.querySelector('.border-2')).not.toBeNull();
    // Avatar recebe grayscale => filtro grayscale(1) chega ao DOM (guarda contra remover o prop).
    expect(el.innerHTML).toContain('grayscale');
  });

  it('eliminado no topo (posição 1) força 120px e sem medalha', () => {
    render(<LiveLeaderboard rows={[row({ uid: 'x1', userName: 'Zé', position: 1, eliminated: true })]} />);
    const el = screen.getByTestId('leader-x1') as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(screen.queryByText('🥇')).toBeNull();
  });
});
