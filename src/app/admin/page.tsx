'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import { formatKickoff } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: BetDTO | null };

export default function AdminPage() {
  const { call } = useAuth();
  const { ready, profile } = useRequireProfile();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchWithBet[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // form de cadastro
  const [form, setForm] = useState({ homeTeam: 'Brasil', awayTeam: '', homeFlag: '🇧🇷', awayFlag: '', competition: 'Eliminatórias', kickoff: '', cota: '10' });

  const load = useCallback(async () => {
    try { const d = await call<{ matches: MatchWithBet[] }>('/api/matches'); setMatches(d.matches); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [call]);

  useEffect(() => {
    if (ready && profile && !profile.isAdmin) { router.replace('/'); return; }
    if (ready && profile?.isAdmin) load();
  }, [ready, profile, router, load]);

  if (!ready || !profile?.isAdmin || matches === null) {
    return <Loading />; // não-admin é redirecionado p/ '/' pelo useEffect acima
  }

  async function criar() {
    setErr(null);
    try {
      const kickoffAt = new Date(form.kickoff).getTime(); // datetime-local → epoch ms
      await call('/api/admin/matches', { method: 'POST', body: {
        homeTeam: form.homeTeam, awayTeam: form.awayTeam, homeFlag: form.homeFlag, awayFlag: form.awayFlag,
        competition: form.competition, kickoffAt, cota: Number(form.cota),
      } });
      setForm({ ...form, awayTeam: '', awayFlag: '', kickoff: '' });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao cadastrar'); }
  }

  const scheduled = matches.filter((m) => m.status === 'scheduled');

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto p-4">
        <h1 className="text-verde-escuro font-extrabold text-xl mb-3">Admin</h1>
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

        <section className="bg-white border border-gray-200 rounded p-4 mb-6">
          <h2 className="font-bold mb-2">Cadastrar jogo</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col">Mandante<input value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Visitante<input value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Bandeira mandante<input value={form.homeFlag} onChange={(e) => setForm({ ...form, homeFlag: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Bandeira visitante<input value={form.awayFlag} onChange={(e) => setForm({ ...form, awayFlag: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Competição<input value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Cota (R$)<input type="number" value={form.cota} onChange={(e) => setForm({ ...form, cota: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col col-span-2">Data e hora do jogo<input type="datetime-local" value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} className="border rounded p-1.5" /></label>
          </div>
          <button onClick={criar} disabled={!form.awayTeam || !form.kickoff}
            className="mt-3 bg-verde text-white font-bold py-2 px-4 rounded uppercase text-xs disabled:opacity-50">Cadastrar jogo</button>
        </section>

        <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2">Lançar placar</h2>
        {scheduled.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo agendado.</p>}
        {scheduled.map((m) => <ResultRow key={m.id} match={m} onDone={load} />)}
      </main>
    </>
  );
}

function ResultRow({ match, onDone }: { match: MatchDTO; onDone: () => void }) {
  const { call } = useAuth();
  const [h, setH] = useState(''); const [a, setA] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function lancar() {
    setErr(null);
    try {
      await call(`/api/admin/matches/${match.id}/result`, { method: 'POST', body: { homeScore: Number(h), awayScore: Number(a) } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao lançar'); }
  }
  return (
    <div className="bg-white border border-gray-200 rounded p-3 mb-2 flex items-center gap-2 text-sm">
      <span className="flex-1">{match.homeFlag} {match.homeTeam} x {match.awayTeam} {match.awayFlag} <span className="text-gray-400">· {formatKickoff(match.kickoffAt)}</span></span>
      <input aria-label={`placar mandante ${match.id}`} value={h} onChange={(e) => setH(e.target.value)} className="w-10 border rounded text-center" />
      <span>x</span>
      <input aria-label={`placar visitante ${match.id}`} value={a} onChange={(e) => setA(e.target.value)} className="w-10 border rounded text-center" />
      <button onClick={lancar} disabled={h === '' || a === ''} className="bg-verde text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-50">Lançar</button>
      {err && <span className="text-red-600 text-xs">{err}</span>}
    </div>
  );
}
