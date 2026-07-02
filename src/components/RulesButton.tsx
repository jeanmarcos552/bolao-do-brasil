'use client';
import { useEffect, useState } from 'react';

// Botão (📖) que fica no Header ao lado do avatar e abre um painel com as regras.
// O texto reflete o comportamento REAL do app (scoring.ts, bet/route.ts, ranking/route.ts),
// não um rascunho — placar exato vale 3 (não 2), palpite editável até o início do jogo, etc.
export default function RulesButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Regras do bolão"
        title="Regras do bolão"
        className="text-white/90 hover:text-white text-xl leading-none"
      >
        📖
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} />

          <div className="absolute top-3 right-3 w-[calc(100%-1.5rem)] max-w-sm max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl bg-white shadow-2xl animate-slide-in-right">
            <div className="sticky top-0 flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-3">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-600 shrink-0" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 8h6M8 12h8M8 16h5" />
              </svg>
              <h2 id="rules-title" className="font-extrabold text-gray-900">Regras do bolão</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar"
                className="ml-auto text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            <div className="px-4 py-4 text-sm text-gray-700 space-y-5">
              <section>
                <h3 className="text-red-600 font-bold mb-1.5">Pontuação</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><b>Placar exato:</b> 3 pontos</li>
                  <li>Resultado certo (vitória ou empate, sem cravar o placar): 1 ponto</li>
                  <li>Errou o resultado: 0 pontos</li>
                  <li>Decidido nos pênaltis: 1 ponto para quem acertou o time que passou (empate nos pênaltis não pontua)</li>
                </ul>
              </section>

              <section>
                <h3 className="text-red-600 font-bold mb-1.5">Palpites</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li className="text-red-600 font-semibold">Um palpite por jogo — dá para alterar até o início do jogo; depois trava.</li>
                  <li>Cadastre sua chave Pix antes de palpitar.</li>
                  <li>Cada jogo fecha no seu horário de início (mostrado no card do jogo).</li>
                </ul>
              </section>

              <section>
                <h3 className="text-red-600 font-bold mb-1.5">Ranking</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Classificação pelo total de pontos na temporada.</li>
                  <li>Empate: desempata por mais rodadas vencidas.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
