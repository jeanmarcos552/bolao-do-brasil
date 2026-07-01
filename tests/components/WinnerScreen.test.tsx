// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WinnerScreen from '@/components/WinnerScreen';

const round = {
  winners: [{ uid: 'u1', userName: 'Jean', pixKey: 'jean@pix', photoURL: 'http://foto/j.png' }],
  perWinner: 30,
  totalCollected: 30,
  cota: 10,
};

describe('WinnerScreen', () => {
  it('mostra o vencedor, a chave Pix e o confete', () => {
    render(<WinnerScreen round={round} />);
    expect(screen.getByText('Jean')).toBeInTheDocument();
    expect(screen.getByText('jean@pix')).toBeInTheDocument();
    expect(screen.getByTestId('confetti')).toBeInTheDocument();
    const img = screen.getByAltText('Jean') as HTMLImageElement;
    expect(img.style.width).toBe('480px');
  });

  it('copiar Pix chama a clipboard e dá feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WinnerScreen round={round} />);
    await userEvent.click(screen.getByRole('button', { name: /copiar pix/i }));
    expect(writeText).toHaveBeenCalledWith('jean@pix');
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument();
  });
});
