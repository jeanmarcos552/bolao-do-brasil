'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useMatchLive } from '@/hooks/useMatchLive';
import Loading from '@/components/Loading';
import Flag from '@/components/Flag';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import WinnerScreen, { type RoundView } from '@/components/WinnerScreen';
import AdminLiveControls from '@/components/AdminLiveControls';
import { formatKickoff } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';
import type { LeaderRow } from '@/lib/leaderboard';

interface Detail {
  match: MatchDTO;
  bets: BetDTO[];
  leaderboard: LeaderRow[] | null;
  round: RoundView | null;
}

function scoreLabel(m: MatchDTO): string {
  if (m.status === 'scheduled') return 'x';
  const base = `${m.homeScore ?? 0} x ${m.awayScore ?? 0}`;
  return m.penalties ? `${base} (pên. ${m.homePen} x ${m.awayPen})` : base;
}

function momentLabel(m: MatchDTO): string | null {
  if (m.status !== 'live') return null;
  if (m.penalties) return 'Pênaltis';
  if (m.extraTime) return 'Prorrogação';
  return '🔴 Ao vivo';
}

export default function JogoPage() {
  const { id } = useParams<{ id: string }>();
  const { call, profile } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await call<Detail>(`/api/matches/${id}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [call, id]);

  useEffect(() => {
    load();
  }, [load]);

  useMatchLive(id, data?.match.status === 'live', load);

  if (data === null) {
    return err ? (
      <main className="max-w-2xl mx-auto p-4">
        <p className="text-red-600">{err}</p>
      </main>
    ) : (
      <Loading />
    );
  }

  const { match, bets, leaderboard, round } = data;
  const sorted = [...bets].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const moment = momentLabel(match);

  return (
    <main className="max-w-2xl mx-auto p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
        {match.competition} · {formatKickoff(match.kickoffAt)}
      </div>
      <div className="flex items-center justify-center gap-3 my-3">
        <span className="font-bold w-28 inline-flex items-center justify-end gap-1.5">
          <Flag src={match.homeFlag} alt={match.homeTeam} className="w-6 h-5" /> {match.homeTeam}
        </span>
        <span className="text-2xl font-extrabold text-center">{scoreLabel(match)}</span>
        <span className="font-bold w-28 inline-flex items-center gap-1.5">
          {match.awayTeam} <Flag src={match.awayFlag} alt={match.awayTeam} className="w-6 h-5" />
        </span>
      </div>
      {moment && <div className="text-center text-sm font-bold text-red-600 mb-3">{moment}</div>}

      {profile?.isAdmin && match.status !== 'finished' && <AdminLiveControls match={match} onChanged={load} />}

      {round && round.winners.length > 0 && <WinnerScreen round={round} />}

      {leaderboard && leaderboard.length > 0 && (
        <>
          <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 my-2">
            {match.status === 'finished' ? 'Classificação final' : 'Campeão do momento'}
          </h2>
          <LiveLeaderboard rows={leaderboard} />
        </>
      )}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 my-2">Palpites</h2>
      <table className="w-full text-sm">
        <tbody>
          {sorted.map((b) => (
            <tr key={b.uid} className="border-b border-gray-100">
              <td className="py-1.5">{b.userName}</td>
              <td className="py-1.5 text-center">{b.homeGuess} x {b.awayGuess}</td>
              <td className="py-1.5 text-right font-bold text-verde">
                {b.points === null ? '—' : `${b.points} pt${b.points === 1 ? '' : 's'}`}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td className="py-2 text-gray-500">Ninguém palpitou neste jogo.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
