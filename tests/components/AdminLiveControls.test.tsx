// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const call = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));

import AdminLiveControls from '@/components/AdminLiveControls';
import type { MatchDTO } from '@/lib/types';

const base: MatchDTO = {
  id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '', awayFlag: '', competition: 'X',
  kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null,
  extraTime: false, penalties: false, homePen: 0, awayPen: 0,
};

beforeEach(() => call.mockClear());

describe('AdminLiveControls', () => {
  it('agendado: inicia o jogo ao vivo em 0x0', async () => {
    render(<AdminLiveControls match={base} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar jogo ao vivo/i }));
    expect(call).toHaveBeenCalledWith('/api/admin/matches/m1/live', { method: 'POST', body: { homeScore: 0, awayScore: 0 } });
  });

  it('ao vivo: atualizar placar chama /live', async () => {
    render(<AdminLiveControls match={{ ...base, status: 'live', homeScore: 1, awayScore: 0 }} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /atualizar placar/i }));
    expect(call).toHaveBeenCalledWith('/api/admin/matches/m1/live', { method: 'POST', body: { homeScore: 1, awayScore: 0 } });
  });

  it('ao vivo: encerrar jogo chama /result', async () => {
    render(<AdminLiveControls match={{ ...base, status: 'live', homeScore: 2, awayScore: 1 }} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /encerrar jogo/i }));
    expect(call).toHaveBeenCalledWith('/api/admin/matches/m1/result', expect.objectContaining({ method: 'POST' }));
    const body = call.mock.calls.find((c) => String(c[0]).endsWith('/result'))![1].body;
    expect(body).toMatchObject({ homeScore: 2, awayScore: 1 });
  });

  it('ao vivo com pênaltis marcado: mostra inputs de pênaltis', () => {
    render(<AdminLiveControls match={{ ...base, status: 'live', penalties: true }} onChanged={() => {}} />);
    expect(screen.getByLabelText(/pênaltis mandante/i)).toBeInTheDocument();
  });

  it('chama onChanged após a ação (re-fetch da página)', async () => {
    const onChanged = vi.fn();
    render(<AdminLiveControls match={{ ...base, status: 'live', homeScore: 1, awayScore: 0 }} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: /atualizar placar/i }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
