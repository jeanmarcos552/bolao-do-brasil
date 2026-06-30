import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireAdmin, HttpError } from '@/lib/auth';
import { jsonError, isValidScore } from '@/lib/api-helpers';
import { scoreBet } from '@/lib/scoring';

export const runtime = 'nodejs';


export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await requireAdmin(req);

    const b = await req.json();
    if (!isValidScore(b.homeScore) || !isValidScore(b.awayScore)) {
      return NextResponse.json({ error: 'Placar inválido' }, { status: 400 });
    }

    const matchRef = adminDb.collection('matches').doc(id);
    const snap = await matchRef.get();
    if (!snap.exists) throw new HttpError(404, 'Jogo não encontrado');
    if ((snap.data() as { status: string }).status === 'finished') {
      throw new HttpError(409, 'Jogo já finalizado');
    }

    const betsSnap = await matchRef.collection('bets').get();
    for (const betDoc of betsSnap.docs) {
      const bet = betDoc.data() as { homeGuess: number; awayGuess: number };
      const points = scoreBet(bet.homeGuess, bet.awayGuess, b.homeScore, b.awayScore);
      await matchRef.collection('bets').doc(betDoc.id).set({ points }, { merge: true });
    }

    await matchRef.update({
      status: 'finished',
      homeScore: b.homeScore,
      awayScore: b.awayScore,
      finishedAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true, scored: betsSnap.docs.length });
  } catch (e) {
    return jsonError(e);
  }
}
