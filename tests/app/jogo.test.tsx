// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'm1' }), usePathname: () => '/jogo/m1', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }));

const call = vi.fn();
const profileRef = { profile: { isAdmin: false } as { isAdmin: boolean } | null };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call, profile: profileRef.profile }) }));

import JogoPage from '@/app/(protected)/jogo/[id]/page';

const finishedData = {
  match: { id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪', competition: 'Eliminatórias', kickoffAt: 1, cota: 10, status: 'finished', homeScore: 3, awayScore: 0, extraTime: false, penalties: false, homePen: 0, awayPen: 0 },
  bets: [{ uid: 'u1', userName: 'Jean', homeGuess: 3, awayGuess: 0, points: 3 }, { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: 1 }],
  leaderboard: [{ uid: 'u1', userName: 'Jean', photoURL: '', points: 3, position: 1, eliminated: false }, { uid: 'u2', userName: 'Bia', photoURL: '', points: 1, position: 2, eliminated: false }],
  round: { winners: [{ uid: 'u1', userName: 'Jean', pixKey: 'jean@pix', photoURL: '' }], topPoints: 3, participants: 2, totalCollected: 10, perWinner: 10, cota: 10 },
};

describe('JogoPage', () => {
  it('jogo encerrado: mostra vencedor, chave Pix e palpites', async () => {
    profileRef.profile = { isAdmin: false };
    call.mockResolvedValue(finishedData);
    render(<JogoPage />);
    await waitFor(() => expect(screen.getByText(/jean@pix/i)).toBeInTheDocument());
    expect(screen.getAllByText('Bia')[0]).toBeInTheDocument();
  });

  it('admin em jogo ao vivo vê os controles', async () => {
    profileRef.profile = { isAdmin: true };
    call.mockResolvedValue({
      match: { ...finishedData.match, status: 'live', homeScore: 1, awayScore: 0 },
      bets: [{ uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }],
      leaderboard: [{ uid: 'u1', userName: 'Jean', photoURL: '', points: 1, position: 1, eliminated: false }],
      round: null,
    });
    render(<JogoPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /encerrar jogo/i })).toBeInTheDocument());
  });
});
