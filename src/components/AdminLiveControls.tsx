'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import type { MatchDTO } from '@/lib/types';

export default function AdminLiveControls({ match, onChanged }: { match: MatchDTO; onChanged: () => void }) {
  const { call } = useAuth();
  const [home, setHome] = useState(String(match.homeScore ?? 0));
  const [away, setAway] = useState(String(match.awayScore ?? 0));
  const [hPen, setHPen] = useState(String(match.homePen ?? 0));
  const [aPen, setAPen] = useState(String(match.awayPen ?? 0));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function live(body: Record<string, unknown>) {
    setErr(null);
    setBusy(true);
    try {
      await call(`/api/admin/matches/${match.id}/live`, { method: 'POST', body });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setErr(null);
    setBusy(true);
    try {
      await call(`/api/admin/matches/${match.id}/result`, {
        method: 'POST',
        body: {
          homeScore: Number(home),
          awayScore: Number(away),
          extraTime: match.extraTime,
          penalties: match.penalties,
          homePen: Number(hPen),
          awayPen: Number(aPen),
        },
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  if (match.status === 'scheduled') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 my-3">
        <button
          onClick={() => live({ homeScore: 0, awayScore: 0 })}
          disabled={busy}
          className="bg-verde text-white font-bold px-4 py-2 rounded text-xs uppercase disabled:opacity-50"
        >
          Iniciar jogo ao vivo
        </button>
        {err && <p className="text-red-600 text-xs mt-2">{err}</p>}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3 my-3 space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <input aria-label="placar mandante" type="number" min={0} value={home} onChange={(e) => setHome(e.target.value)} className="w-14 border rounded text-center" />
        <span>x</span>
        <input aria-label="placar visitante" type="number" min={0} value={away} onChange={(e) => setAway(e.target.value)} className="w-14 border rounded text-center" />
        <button onClick={() => live({ homeScore: Number(home), awayScore: Number(away) })} disabled={busy} className="bg-verde text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-50">
          Atualizar placar
        </button>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={match.extraTime} onChange={(e) => live({ extraTime: e.target.checked })} />
        Prorrogação
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={match.penalties} onChange={(e) => live({ penalties: e.target.checked })} />
        Foi para pênaltis
      </label>
      {match.penalties && (
        <div className="flex items-center gap-2">
          <span>Pênaltis:</span>
          <input aria-label="pênaltis mandante" type="number" min={0} value={hPen} onChange={(e) => setHPen(e.target.value)} className="w-14 border rounded text-center" />
          <span>x</span>
          <input aria-label="pênaltis visitante" type="number" min={0} value={aPen} onChange={(e) => setAPen(e.target.value)} className="w-14 border rounded text-center" />
          <button onClick={() => live({ homePen: Number(hPen), awayPen: Number(aPen) })} disabled={busy} className="bg-verde text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-50">
            Atualizar pênaltis
          </button>
        </div>
      )}
      <button onClick={finish} disabled={busy} className="bg-verde-escuro text-white font-bold px-4 py-2 rounded text-xs uppercase disabled:opacity-50">
        Encerrar jogo
      </button>
      {err && <p className="text-red-600 text-xs">{err}</p>}
    </div>
  );
}
