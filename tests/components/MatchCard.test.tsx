// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const call = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));

import MatchCard from '@/components/MatchCard';

const base = {
  id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪',
  competition: 'Eliminatórias', cota: 10, homeScore: null as number | null, awayScore: null as number | null,
  extraTime: false, penalties: false, homePen: 0, awayPen: 0,
  myBet: null as null | { homeGuess: number; awayGuess: number; points: number | null },
};

describe('MatchCard', () => {
  it('jogo aberto mostra o formulário de palpite', () => {
    render(<MatchCard match={{ ...base, status: 'scheduled', kickoffAt: Date.now() + 3_600_000 }} onSaved={() => {}} />);
    expect(screen.getByRole('button', { name: /salvar palpite/i })).toBeInTheDocument();
  });

  it('jogo encerrado mostra o placar final e os pontos', () => {
    render(<MatchCard match={{ ...base, status: 'finished', kickoffAt: 1, homeScore: 3, awayScore: 0, myBet: { homeGuess: 2, awayGuess: 0, points: 1 } }} onSaved={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/\+1 ponto/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar palpite/i })).toBeNull();
  });

  it('jogo encerrado com pontuação ainda não calculada não mostra "+null"', () => {
    render(<MatchCard match={{ ...base, status: 'finished', kickoffAt: 1, homeScore: 2, awayScore: 0, myBet: { homeGuess: 1, awayGuess: 1, points: null } }} onSaved={() => {}} />);
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('jogo ao vivo mostra o placar corrente, o badge e o link', () => {
    render(<MatchCard match={{ ...base, status: 'live', kickoffAt: 1, homeScore: 1, awayScore: 0 }} onSaved={() => {}} />);
    // "ao vivo" bate no badge E no link; asserta o badge pelo texto exato (o link é "Acompanhar ao vivo →").
    expect(screen.getByText('🔴 Ao vivo')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /acompanhar ao vivo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar palpite/i })).toBeNull();
  });
});
