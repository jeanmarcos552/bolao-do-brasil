'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import Loading from '@/components/Loading';
import MatchCard from '@/components/MatchCard';
import BrasilCarousel from '@/components/BrasilCarousel';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: BetDTO | null };

export default function Home() {
  const { call } = useAuth();
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

  useEffect(() => { load(); }, [load]);

  if (matches === null) return <Loading />;

  const aoVivo = matches.filter((m) => m.status === 'live');
  const proximos = matches.filter((m) => m.status === 'scheduled');
  const encerrados = matches.filter((m) => m.status === 'finished');

  return (
    <main className="max-w-2xl mx-auto p-4">
      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

      {aoVivo.length > 0 && (
        <>
          <h2 className="text-red-600 font-extrabold text-sm uppercase tracking-wide border-l-4 border-red-600 pl-2 mb-2.5">🔴 Ao vivo</h2>
          {aoVivo.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}
        </>
      )}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5 mt-6">Próximos jogos</h2>
      {proximos.length === 0 && <p className="text-gray-500 text-sm mb-4">Nenhum jogo agendado.</p>}
      {proximos.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5 mt-6">Encerrados</h2>
      {encerrados.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo encerrado ainda.</p>}
      {encerrados.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}

      <BrasilCarousel />
    </main>
  );
}
