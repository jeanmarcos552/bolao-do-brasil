'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import MatchCard from '@/components/MatchCard';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: BetDTO | null };

export default function Home() {
  const { call } = useAuth();
  const { ready } = useRequireProfile();
  const [matches, setMatches] = useState<MatchWithBet[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await call<{ matches: MatchWithBet[] }>('/api/matches');
      setMatches(data.matches);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [call]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (!ready || matches === null) return <Loading />;

  const proximos = matches.filter((m) => m.status === 'scheduled');
  const encerrados = matches.filter((m) => m.status === 'finished');

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto p-4">
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

        <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5">Próximos jogos</h2>
        {proximos.length === 0 && <p className="text-gray-500 text-sm mb-4">Nenhum jogo agendado.</p>}
        {proximos.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}

        <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5 mt-6">Encerrados</h2>
        {encerrados.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo encerrado ainda.</p>}
        {encerrados.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}
      </main>
    </>
  );
}
