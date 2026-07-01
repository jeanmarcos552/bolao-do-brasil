'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Assina em tempo real as salas `match:<id>` de vários jogos ao vivo numa única
 * conexão socket.io e chama `onUpdate` a cada `match_update`. Best-effort: sem
 * NEXT_PUBLIC_WS_URL vira só polling. O poll de 25s é a rede de segurança
 * (cobre transições de status e queda do WS). Sem jogos ao vivo, não conecta.
 */
export function useMatchesLive(matchIds: string[], onUpdate: () => void): void {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;
  const key = matchIds.join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) return;

    const url = process.env.NEXT_PUBLIC_WS_URL;
    let socket: Socket | null = null;
    if (url) {
      socket = io(url, { transports: ['websocket'] });
      socket.on('connect', () => ids.forEach((id) => socket?.emit('join_event', { event_id: `match:${id}` })));
      socket.on('match_update', () => cb.current());
    }

    const poll = setInterval(() => cb.current(), 25000);
    return () => { clearInterval(poll); socket?.disconnect(); };
  }, [key]);
}
