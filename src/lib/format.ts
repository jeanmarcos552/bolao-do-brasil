const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function formatBRL(value: number): string {
  return brl.format(value).replace(/ /g, ' ');
}

const dt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
export function formatKickoff(ms: number): string {
  // pt-BR produz "30/06, 21:30"; normalizamos para "30/06 21:30"
  const parts = dt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}

export function isLocked(kickoffAtMs: number, now: number = Date.now()): boolean {
  return now >= kickoffAtMs;
}

export function outcomeLabel(home: number, away: number): 'Vitória' | 'Empate' | 'Derrota' {
  if (home > away) return 'Vitória';
  if (home < away) return 'Derrota';
  return 'Empate';
}
