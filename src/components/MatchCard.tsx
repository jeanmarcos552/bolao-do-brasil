'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { formatBRL, formatKickoff, isLocked } from '@/lib/format';
import Flag from '@/components/Flag';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: Pick<BetDTO, 'homeGuess' | 'awayGuess' | 'points' | 'updatedAt'> | null };

function Team({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-28">
      <Flag src={flag} alt={name} className="w-10 h-10 rounded" />
      <b className="text-sm text-center">{name}</b>
    </div>
  );
}

export default function MatchCard({ match, onSaved }: { match: MatchWithBet; onSaved: () => void }) {
  const { call } = useAuth();
  const isLive = match.status === 'live';
  const showScore = match.status === 'finished' || isLive;
  const canBet = match.status === 'scheduled' && !isLocked(match.kickoffAt);
  const [home, setHome] = useState(match.myBet ? String(match.myBet.homeGuess) : '');
  const [away, setAway] = useState(match.myBet ? String(match.myBet.awayGuess) : '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await call(`/api/matches/${match.id}/bet`, { method: 'POST', body: { homeGuess: Number(home), awayGuess: Number(away) } });
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar palpite');
    } finally {
      setSaving(false);
    }
  }

  const hasBet = match.myBet != null || savedAt != null;
  // Horário do save: o desta sessão (savedAt) ou o persistido (myBet.updatedAt), pra o feedback
  // reaparecer ao voltar na página, não só logo após clicar.
  const savedTime = savedAt ?? (match.myBet?.updatedAt
    ? new Date(match.myBet.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null);

  return (
    <div className="bg-white border border-gray-200 rounded-md mb-2.5 p-4">
      <div className="flex justify-between text-[11px] uppercase tracking-wide text-gray-400 mb-2.5">
        <span>{match.competition} · {formatKickoff(match.kickoffAt)}</span>
        {isLive ? (
          <span className="text-red-600 font-bold">🔴 Ao vivo</span>
        ) : (
          <span className="text-verde font-bold">Cota {formatBRL(match.cota)}</span>
        )}
      </div>

      <div className="flex items-center justify-center gap-3.5">
        <Team flag={match.homeFlag} name={match.homeTeam} />
        {showScore ? (
          <>
            <span className="text-3xl font-extrabold">{match.homeScore ?? 0}</span>
            <span className="text-gray-400 font-bold text-sm">x</span>
            <span className="text-3xl font-extrabold">{match.awayScore ?? 0}</span>
          </>
        ) : (
          <>
            <input aria-label="placar mandante" inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value)} disabled={!canBet}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
            <span className="text-gray-400 font-bold text-sm">x</span>
            <input aria-label="placar visitante" inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value)} disabled={!canBet}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
          </>
        )}
        <Team flag={match.awayFlag} name={match.awayTeam} />
      </div>

      {canBet && (
        <>
          {savedTime && (
            <div className="mt-3 bg-verde-claro border border-verde-escuro text-verde-escuro rounded px-3 py-2 text-xs text-center">
              ✓ Palpite salvo às {savedTime}. Você pode alterar até o início do jogo.
            </div>
          )}
          <button onClick={save} disabled={saving || home === '' || away === ''}
            className="mt-3 w-full bg-verde text-white font-extrabold py-2.5 rounded uppercase text-xs tracking-wide disabled:opacity-50">
            {saving ? 'Salvando…' : hasBet ? 'Alterar palpite' : 'Salvar palpite'}
          </button>
          <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Trava no apito inicial · {formatKickoff(match.kickoffAt)}</div>
        </>
      )}
      {match.status === 'scheduled' && !canBet && (
        <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Palpites encerrados {match.myBet ? `· seu palpite: ${match.myBet.homeGuess} x ${match.myBet.awayGuess}` : '· você não palpitou'}</div>
      )}
      {isLive && (
        <div className="text-center mt-2.5 text-xs">
          <Link href={`/jogo/${match.id}`} className="text-verde underline">Acompanhar ao vivo →</Link>
        </div>
      )}
      {match.status === 'finished' && (
        <div className="text-center mt-2.5 text-xs text-gray-600">
          {match.myBet ? (
            <>
              Seu palpite: <b>{match.myBet.homeGuess} x {match.myBet.awayGuess}</b> &nbsp;
              {match.myBet.points != null && <span className="bg-verde-claro text-verde rounded px-2 py-0.5 font-bold">+{match.myBet.points} ponto{match.myBet.points === 1 ? '' : 's'}</span>}
            </>
          ) : (
            'Você não palpitou neste jogo'
          )}
          <div className="mt-2"><Link href={`/jogo/${match.id}`} className="text-verde underline text-xs">Ver palpites e vencedor →</Link></div>
        </div>
      )}
      {err && <p className="text-red-600 text-xs mt-2 text-center">{err}</p>}
    </div>
  );
}
