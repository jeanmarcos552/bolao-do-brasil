// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';

const handlers: Record<string, (...a: unknown[]) => void> = {};
const socket = {
  on: vi.fn((ev: string, cb: (...a: unknown[]) => void) => { handlers[ev] = cb; }),
  emit: vi.fn(),
  disconnect: vi.fn(),
};
const io = vi.fn(() => socket);
vi.mock('socket.io-client', () => ({ io: (...a: unknown[]) => (io as (...args: unknown[]) => typeof socket)(...a) }));

import { useMatchLive } from '@/hooks/useMatchLive';

function Probe({ active, onUpdate }: { active: boolean; onUpdate: () => void }) {
  useMatchLive('m1', active, onUpdate);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.NEXT_PUBLIC_WS_URL = 'https://ws.example';
  io.mockClear(); socket.on.mockClear(); socket.emit.mockClear(); socket.disconnect.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
});
afterEach(() => { vi.useRealTimers(); });

describe('useMatchLive', () => {
  it('conecta, entra na sala e responde ao match_update', () => {
    const onUpdate = vi.fn();
    render(<Probe active onUpdate={onUpdate} />);
    expect(io).toHaveBeenCalledWith('https://ws.example', expect.anything());
    handlers['connect']?.();
    expect(socket.emit).toHaveBeenCalledWith('join_event', { event_id: 'match:m1' });
    handlers['match_update']?.();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('faz polling a cada 25s', () => {
    const onUpdate = vi.fn();
    render(<Probe active onUpdate={onUpdate} />);
    vi.advanceTimersByTime(25000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(25000);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('inativo não conecta', () => {
    render(<Probe active={false} onUpdate={vi.fn()} />);
    expect(io).not.toHaveBeenCalled();
  });

  it('desmontar desconecta', () => {
    const { unmount } = render(<Probe active onUpdate={vi.fn()} />);
    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
