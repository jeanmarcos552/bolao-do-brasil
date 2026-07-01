// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from '@/components/Avatar';

describe('Avatar', () => {
  it('renderiza a foto com o tamanho pedido', () => {
    render(<Avatar photoURL="http://foto/x.png" name="Jean Silva" size={240} />);
    const img = screen.getByAltText('Jean Silva') as HTMLImageElement;
    expect(img.src).toContain('http://foto/x.png');
    expect(img.style.width).toBe('240px');
    expect(img.style.height).toBe('240px');
  });

  it('sem foto, mostra iniciais', () => {
    render(<Avatar photoURL="" name="Jean Silva" size={120} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('grayscale aplica o filtro', () => {
    const { container } = render(<Avatar photoURL="http://foto/x.png" name="Ana" size={120} grayscale />);
    const img = container.querySelector('img')!;
    expect(img.style.filter).toContain('grayscale');
  });
});
