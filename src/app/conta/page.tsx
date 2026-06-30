'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';

export default function ContaPage() {
  const { profile, call, refreshProfile } = useAuth();
  const { ready } = useRequireProfile();
  const [name, setName] = useState(profile?.name ?? '');
  const [pixKey, setPixKey] = useState(profile?.pixKey ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ready && !profile) return <Loading />;

  async function save() {
    setSaving(true); setMsg(null); setErr(null);
    try {
      await call('/api/me', { method: 'PUT', body: { name, pixKey } });
      await refreshProfile();
      setMsg('Salvo!');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto p-4">
        <h1 className="text-verde-escuro font-extrabold text-xl mb-1">Minha conta</h1>
        {profile && !profile.pixKey && (
          <p className="bg-amarelo/30 border border-amarelo rounded p-2 text-sm mb-3">
            Cadastre sua chave Pix para poder palpitar.
          </p>
        )}
        <label className="block text-sm font-semibold mt-3" htmlFor="name">Nome</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full border rounded p-2 mt-1" />
        <label className="block text-sm font-semibold mt-3" htmlFor="pix">Chave Pix</label>
        <input id="pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)}
          placeholder="e-mail, telefone, CPF ou aleatória"
          className="w-full border rounded p-2 mt-1" />
        <button onClick={save} disabled={saving || !name.trim() || !pixKey.trim()}
          className="mt-4 w-full bg-verde text-white font-bold py-2.5 rounded uppercase text-sm disabled:opacity-50">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {msg && <p className="text-verde mt-2 text-sm">{msg}</p>}
        {err && <p className="text-red-600 mt-2 text-sm">{err}</p>}
      </main>
    </>
  );
}
