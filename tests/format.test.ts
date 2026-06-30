import { describe, it, expect } from 'vitest';
import { formatBRL, formatKickoff, isLocked, outcomeLabel } from '@/lib/format';

describe('formatBRL', () => {
  it('formata reais', () => expect(formatBRL(10)).toBe('R$ 10,00'));
  it('formata com centavos', () => expect(formatBRL(12.5)).toBe('R$ 12,50'));
});

describe('formatKickoff', () => {
  it('formata data/hora em America/Sao_Paulo', () => {
    // 2026-06-30T21:30:00-03:00 == 2026-07-01T00:30:00Z
    const ms = Date.UTC(2026, 6, 1, 0, 30, 0);
    expect(formatKickoff(ms)).toBe('30/06 21:30');
  });
});

describe('isLocked', () => {
  it('antes do horário: não travado', () => expect(isLocked(1000, 500)).toBe(false));
  it('no horário exato: travado', () => expect(isLocked(1000, 1000)).toBe(true));
  it('depois: travado', () => expect(isLocked(1000, 1500)).toBe(true));
});

describe('outcomeLabel', () => {
  it('vitória do mandante', () => expect(outcomeLabel(2, 1)).toBe('Vitória'));
  it('empate', () => expect(outcomeLabel(1, 1)).toBe('Empate'));
  it('derrota', () => expect(outcomeLabel(0, 2)).toBe('Derrota'));
});
