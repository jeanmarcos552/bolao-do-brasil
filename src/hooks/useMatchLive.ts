'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Enquanto `active`, escuta o "aviso" do WS (match_update) para o jogo e faz
 * polling de fallback a cada 25s. Toda vez que algo muda, chama `onUpdate`
 * (que deve refazer o GET autoritativo).
 */
export function useMatchLive(matchId: string, active: boolean, onUpdate: () => void): void {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    if (!active) return;
    const url = process.env.NEXT_PUBLIC_WS_URL;
    let socket: Socket | null = null;
    if (url) {
      socket = io(url, { transports: ['websocket'] });
      socket.on('connect', () => socket?.emit('join_event', { event_id: `match:${matchId}` }));
      socket.on('match_update', () => cb.current());
    }
    const poll = setInterval(() => cb.current(), 25000);
    return () => {
      clearInterval(poll);
      socket?.disconnect();
    };
  }, [matchId, active]);
}
