// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'm1' }), usePathname: () => '/jogo/m1', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({
  match: { id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪', competition: 'Eliminatórias', kickoffAt: 1, cota: 10, status: 'finished', homeScore: 3, awayScore: 0 },
  bets: [{ uid: 'u1', userName: 'Jean', homeGuess: 3, awayGuess: 0, points: 3 }, { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: 1 }],
  round: { winners: [{ uid: 'u1', userName: 'Jean', pixKey: 'jean@pix' }], topPoints: 3, participants: 2, totalCollected: 10, perWinner: 10, cota: 10 },
});
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));
vi.mock('@/hooks/useRequireProfile', () => ({ useRequireProfile: () => ({ ready: true, profile: { isAdmin: false } }) }));

import JogoPage from '@/app/(protected)/jogo/[id]/page';

describe('JogoPage', () => {
  it('mostra o vencedor e a chave Pix', async () => {
    render(<JogoPage />);
    await waitFor(() => expect(screen.getByText(/jean@pix/i)).toBeInTheDocument());
    expect(screen.getByText('Jean')).toBeInTheDocument();
    expect(screen.getByText('Bia')).toBeInTheDocument();
  });
});
