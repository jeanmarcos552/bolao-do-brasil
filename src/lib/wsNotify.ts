/**
 * Avisa o serviço de WebSocket (node-ws-boilerplate) que um jogo mudou.
 * Contrato do serviço: POST em WS_PUBLISH_URL (ex.: .../events/checkin) com
 * header X-API-KEY e body { event, payload: { event_id } }. O serviço faz
 * broadcast do socket `event` para a sala nomeada por `event_id`. O client
 * (useMatchLive) entra na sala `match:<id>` via `join_event` e ouve `match_update`.
 * Best-effort: sem env vira no-op; falha de rede é ignorada (o placar já foi gravado).
 */
export async function notifyMatchUpdate(matchId: string): Promise<void> {
  const url = process.env.WS_PUBLISH_URL;
  const key = process.env.WS_API_KEY;
  if (!url || !key) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify({ event: 'match_update', payload: { event_id: `match:${matchId}` } }),
    });
  } catch (e) {
    console.error('notifyMatchUpdate falhou (ignorado):', e);
  }
}
