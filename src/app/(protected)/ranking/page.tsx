'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import Loading from '@/components/Loading';

interface Row { uid: string; name: string; totalPoints: number; roundsWon: number }

export default function RankingPage() {
  const { call } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const d = await call<{ ranking: Row[] }>('/api/ranking'); setRows(d.ranking); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  if (rows === null) return <Loading />;

  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-verde-escuro font-extrabold text-xl mb-3">Ranking geral</h1>
      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
      <table className="w-full text-sm bg-white rounded border border-gray-200">
        <thead className="bg-verde text-white">
          <tr>
            <th className="py-2 px-3 text-left">#</th>
            <th className="py-2 px-3 text-left">Participante</th>
            <th className="py-2 px-3 text-right">Pontos</th>
            <th className="py-2 px-3 text-right">Vitórias</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.uid} className="border-b border-gray-100">
              <td className="py-2 px-3 font-bold text-gray-500">{i + 1}º</td>
              <td className="py-2 px-3">{r.name}</td>
              <td className="py-2 px-3 text-right font-extrabold text-verde">{r.totalPoints}</td>
              <td className="py-2 px-3 text-right">{r.roundsWon}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-3 px-3 text-gray-500">Sem pontuação ainda.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
