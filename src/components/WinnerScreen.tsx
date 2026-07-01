'use client';
import { useState } from 'react';
import Avatar from '@/components/Avatar';
import Confetti from '@/components/Confetti';
import { formatBRL } from '@/lib/format';

export interface RoundWinnerView {
  uid: string;
  userName: string;
  pixKey: string;
  photoURL: string;
}
export interface RoundView {
  winners: RoundWinnerView[];
  perWinner: number;
  totalCollected: number;
  cota: number;
}

function WinnerCard({ w, size, perWinner }: { w: RoundWinnerView; size: number; perWinner: number }) {
  const [copied, setCopied] = useState(false);
  async function copyPix() {
    try {
      await navigator.clipboard.writeText(w.pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }
  return (
    <div className="flex flex-col items-center gap-2" style={{ maxWidth: size }}>
      <Avatar photoURL={w.photoURL} name={w.userName} size={size} />
      <div className="font-bold">{w.userName}</div>
      <div className="text-verde font-extrabold">recebe {formatBRL(perWinner)}</div>
      <div className="text-sm">Pix: <b>{w.pixKey || '(sem Pix)'}</b></div>
      <button
        onClick={copyPix}
        disabled={!w.pixKey}
        className="bg-verde text-white font-bold px-4 py-2 rounded text-xs uppercase disabled:opacity-50"
      >
        {copied ? 'Copiado!' : 'Copiar Pix'}
      </button>
    </div>
  );
}

export default function WinnerScreen({ round }: { round: RoundView }) {
  const single = round.winners.length === 1;
  const size = single ? 480 : 240;
  return (
    <div className="relative bg-amber-50 border border-amber-200 rounded p-4 my-3 overflow-hidden">
      <Confetti />
      <div className="relative text-center">
        <div className="font-extrabold text-lg mb-3">🏆 Vencedor{single ? '' : 'es'} da rodada</div>
        <div className="flex flex-wrap items-start justify-center gap-4">
          {round.winners.map((w) => (
            <WinnerCard key={w.uid} w={w} size={size} perWinner={round.perWinner} />
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-3">
          Arrecadado: {formatBRL(round.totalCollected)} · cota {formatBRL(round.cota)}
        </div>
      </div>
    </div>
  );
}
