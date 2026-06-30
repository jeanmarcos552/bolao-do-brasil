'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import { formatBRL, formatKickoff } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';

interface RoundResult { winners: Array<{ uid: string; userName: string; pixKey: string }>; topPoints: number; participants: number; totalCollected: number; perWinner: number; cota: number }
interface Detail { match: MatchDTO; bets: BetDTO[]; round: RoundResult | null }

export default function JogoPage() {
  const { id } = useParams<{ id: string }>();
  const { call } = useAuth();
  const { ready } = useRequireProfile();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await call<Detail>(`/api/matches/${id}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [call, id]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (!ready || data === null) return err ? <Main><p className="text-red-600">{err}</p></Main> : <Loading />;

  const { match, bets, round } = data;
  const sorted = [...bets].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  return (
    <Main>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{match.competition} · {formatKickoff(match.kickoffAt)}</div>
      <div className="flex items-center justify-center gap-3 my-3">
        <span className="font-bold w-28 text-right">{match.homeFlag} {match.homeTeam}</span>
        <span className="text-2xl font-extrabold">{match.status === 'finished' ? `${match.homeScore} x ${match.awayScore}` : 'x'}</span>
        <span className="font-bold w-28">{match.awayTeam} {match.awayFlag}</span>
      </div>

      {round && round.winners.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 my-3 text-sm">
          <div className="font-bold mb-1">🏆 Vencedor{round.winners.length > 1 ? 'es' : ''} da rodada</div>
          {round.winners.map((w) => (
            <div key={w.uid} className="flex justify-between">
              <span>{w.userName} · Pix: <b>{w.pixKey || '(sem Pix)'}</b></span>
              <span className="text-verde font-bold">recebe {formatBRL(round.perWinner)}</span>
            </div>
          ))}
          <div className="text-xs text-gray-500 mt-1">Arrecadado: {formatBRL(round.totalCollected)} · cota {formatBRL(round.cota)}</div>
        </div>
      )}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 my-2">Palpites</h2>
      <table className="w-full text-sm">
        <tbody>
          {sorted.map((b) => (
            <tr key={b.uid} className="border-b border-gray-100">
              <td className="py-1.5">{b.userName}</td>
              <td className="py-1.5 text-center">{b.homeGuess} x {b.awayGuess}</td>
              <td className="py-1.5 text-right font-bold text-verde">{b.points === null ? '—' : `${b.points} pt${b.points === 1 ? '' : 's'}`}</td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td className="py-2 text-gray-500">Ninguém palpitou neste jogo.</td></tr>}
        </tbody>
      </table>
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return (<><Header /><main className="max-w-2xl mx-auto p-4">{children}</main></>);
}
