/**
 * Avisa o serviço de WebSocket (node-ws-boilerplate) que um jogo mudou.
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
      body: JSON.stringify({ event: 'match_update', room: `match:${matchId}`, matchId }),
    });
  } catch (e) {
    console.error('notifyMatchUpdate falhou (ignorado):', e);
  }
}
