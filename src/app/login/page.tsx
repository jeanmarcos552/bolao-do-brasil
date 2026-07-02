'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';

export default function LoginPage() {
  const { user, loading, signInGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-end pb-10 sm:pb-16 bg-verde-escuro relative overflow-hidden">
      <img src="/bg_login.webp" alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
      <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="text-3xl mb-2 drop-shadow">⚽🇧🇷</div>
        <h1 className="text-2xl font-extrabold text-white mb-1 drop-shadow">Bolão da Seleção</h1>
        <p className="text-sm text-white/80 mb-6">Palpite nos jogos do Brasil e dispute o ranking com a galera.</p>
        <button
          onClick={() => signInGoogle()}
          className="w-full bg-verde text-white font-bold py-3 rounded-md uppercase text-sm tracking-wide hover:brightness-95"
        >
          Entrar com Google
        </button>
      </div>
    </main>
  );
}
