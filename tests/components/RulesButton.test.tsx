// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesButton from '@/components/RulesButton';

describe('RulesButton', () => {
  it('abre o painel ao clicar, mostra as regras e fecha no X', async () => {
    const user = userEvent.setup();
    render(<RulesButton />);

    // fechado por padrão
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: /regras do bolão/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // regra fiel ao código (placar exato = 3, não 2)
    expect(screen.getByText(/Placar exato:/i)).toBeInTheDocument();
    expect(screen.getByText(/3 pontos/i)).toBeInTheDocument();
    expect(screen.getByText(/o perdedor paga o vencedor via pix/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /fechar/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fecha ao pressionar Escape', async () => {
    const user = userEvent.setup();
    render(<RulesButton />);
    await user.click(screen.getByRole('button', { name: /regras do bolão/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
