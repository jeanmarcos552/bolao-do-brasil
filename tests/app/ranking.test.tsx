// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/ranking', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({ ranking: [
  { uid: 'u1', name: 'Jean', totalPoints: 7, roundsWon: 2 },
  { uid: 'u2', name: 'Bia', totalPoints: 4, roundsWon: 1 },
] });
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));
vi.mock('@/hooks/useRequireProfile', () => ({ useRequireProfile: () => ({ ready: true, profile: { isAdmin: false } }) }));

import RankingPage from '@/app/ranking/page';

describe('RankingPage', () => {
  it('lista os participantes com pontos', async () => {
    render(<RankingPage />);
    await waitFor(() => expect(screen.getByText('Jean')).toBeInTheDocument());
    expect(screen.getByText('Bia')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
