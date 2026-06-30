'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { formatBRL, formatKickoff, isLocked } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: Pick<BetDTO, 'homeGuess' | 'awayGuess' | 'points'> | null };

function Team({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-28">
      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-2xl">{flag}</div>
      <b className="text-sm text-center">{name}</b>
    </div>
  );
}

export default function MatchCard({ match, onSaved }: { match: MatchWithBet; onSaved: () => void }) {
  const { call } = useAuth();
  const locked = match.status === 'finished' || isLocked(match.kickoffAt);
  const [home, setHome] = useState(match.myBet ? String(match.myBet.homeGuess) : '');
  const [away, setAway] = useState(match.myBet ? String(match.myBet.awayGuess) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    try {
      await call(`/api/matches/${match.id}/bet`, { method: 'POST', body: { homeGuess: Number(home), awayGuess: Number(away) } });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar palpite');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md mb-2.5 p-4">
      <div className="flex justify-between text-[11px] uppercase tracking-wide text-gray-400 mb-2.5">
        <span>{match.competition} · {formatKickoff(match.kickoffAt)}</span>
        <span className="text-verde font-bold">Cota {formatBRL(match.cota)}</span>
      </div>

      <div className="flex items-center justify-center gap-3.5">
        <Team flag={match.homeFlag} name={match.homeTeam} />
        {match.status === 'finished' ? (
          <>
            <span className="text-3xl font-extrabold">{match.homeScore}</span>
            <span className="text-gray-400 font-bold text-sm">x</span>
            <span className="text-3xl font-extrabold">{match.awayScore}</span>
          </>
        ) : (
          <>
            <input aria-label="placar mandante" inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value)} disabled={locked}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
            <span className="text-gray-400 font-bold text-sm">x</span>
            <input aria-label="placar visitante" inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value)} disabled={locked}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
          </>
        )}
        <Team flag={match.awayFlag} name={match.awayTeam} />
      </div>

      {match.status !== 'finished' && !locked && (
        <>
          <button onClick={save} disabled={saving || home === '' || away === ''}
            className="mt-3 w-full bg-verde text-white font-extrabold py-2.5 rounded uppercase text-xs tracking-wide disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar palpite'}
          </button>
          <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Trava no apito inicial · {formatKickoff(match.kickoffAt)}</div>
        </>
      )}
      {match.status !== 'finished' && locked && (
        <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Palpites encerrados {match.myBet ? `· seu palpite: ${match.myBet.homeGuess} x ${match.myBet.awayGuess}` : '· você não palpitou'}</div>
      )}
      {match.status === 'finished' && (
        <div className="text-center mt-2.5 text-xs text-gray-600">
          {match.myBet ? <>Seu palpite: <b>{match.myBet.homeGuess} x {match.myBet.awayGuess}</b> &nbsp;
            <span className="bg-verde-claro text-verde rounded px-2 py-0.5 font-bold">+{match.myBet.points} ponto{match.myBet.points === 1 ? '' : 's'}</span></>
            : 'Você não palpitou neste jogo'}
          <div className="mt-2"><a href={`/jogo/${match.id}`} className="text-verde underline text-xs">Ver palpites e vencedor →</a></div>
        </div>
      )}
      {err && <p className="text-red-600 text-xs mt-2 text-center">{err}</p>}
    </div>
  );
}
