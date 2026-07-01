'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import Loading from '@/components/Loading';
import Flag from '@/components/Flag';
import { formatKickoff } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: BetDTO | null };

export default function AdminPage() {
  const { call, profile } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchWithBet[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({ homeTeam: 'Brasil', awayTeam: '', homeFlag: '', awayFlag: '', competition: 'Eliminatórias', kickoff: '', cota: '10' });

  const load = useCallback(async () => {
    try { const d = await call<{ matches: MatchWithBet[] }>('/api/matches'); setMatches(d.matches); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [call]);

  useEffect(() => {
    if (profile && !profile.isAdmin) { router.replace('/'); return; }
    if (profile?.isAdmin) load();
  }, [profile, router, load]);

  if (!profile?.isAdmin || matches === null) {
    return <Loading />;
  }

  async function criar() {
    setErr(null);
    try {
      const kickoffAt = new Date(form.kickoff).getTime();
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
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-verde-escuro font-extrabold text-xl mb-3">Admin</h1>
      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

      <section className="bg-white border border-gray-200 rounded p-4 mb-6">
        <h2 className="font-bold mb-2">Cadastrar jogo</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex flex-col">Mandante<input value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} className="border rounded p-1.5" /></label>
          <label className="flex flex-col">Visitante<input value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} className="border rounded p-1.5" /></label>
          <label className="flex flex-col col-span-2">URL bandeira mandante (.svg)<input value={form.homeFlag} onChange={(e) => setForm({ ...form, homeFlag: e.target.value })} placeholder="https://s.sde.globo.com/.../Brasil.svg" className="border rounded p-1.5" /></label>
          <label className="flex flex-col col-span-2">URL bandeira visitante (.svg)<input value={form.awayFlag} onChange={(e) => setForm({ ...form, awayFlag: e.target.value })} placeholder="https://s.sde.globo.com/.../Noruega.svg" className="border rounded p-1.5" /></label>
          <label className="flex flex-col">Competição<input value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} className="border rounded p-1.5" /></label>
          <label className="flex flex-col">Cota (R$)<input type="number" value={form.cota} onChange={(e) => setForm({ ...form, cota: e.target.value })} className="border rounded p-1.5" /></label>
          <label className="flex flex-col col-span-2">Data e hora do jogo<input type="datetime-local" value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} className="border rounded p-1.5" /></label>
        </div>
        <button onClick={criar} disabled={!form.homeTeam || !form.awayTeam || !form.kickoff}
          className="mt-3 bg-verde text-white font-bold py-2 px-4 rounded uppercase text-xs disabled:opacity-50">Cadastrar jogo</button>
      </section>

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2">Lançar placar</h2>
      {scheduled.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo agendado.</p>}
      {scheduled.map((m) => <ResultRow key={m.id} match={m} onDone={load} />)}
    </main>
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
    <div className="bg-white border border-gray-200 rounded p-3 mb-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="flex-1 flex items-center gap-1 flex-wrap">
          <Flag src={match.homeFlag} alt={match.homeTeam} className="w-5 h-4" /> {match.homeTeam} x {match.awayTeam} <Flag src={match.awayFlag} alt={match.awayTeam} className="w-5 h-4" />
          <span className="text-gray-400">· {formatKickoff(match.kickoffAt)}</span>
        </span>
        <input type="number" inputMode="numeric" min={0} aria-label={`placar mandante ${match.id}`} value={h} onChange={(e) => setH(e.target.value)} className="w-12 border rounded text-center" />
        <span>x</span>
        <input type="number" inputMode="numeric" min={0} aria-label={`placar visitante ${match.id}`} value={a} onChange={(e) => setA(e.target.value)} className="w-12 border rounded text-center" />
        <button onClick={lancar} disabled={h === '' || a === '' || Number.isNaN(Number(h)) || Number.isNaN(Number(a))} className="bg-verde text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-50">Lançar</button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Link href={`/jogo/${match.id}`} className="text-verde underline text-xs">Conduzir ao vivo →</Link>
        {err && <span className="text-red-600 text-xs">{err}</span>}
      </div>
    </div>
  );
}
