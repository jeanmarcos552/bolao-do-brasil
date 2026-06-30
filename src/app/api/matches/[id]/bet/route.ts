import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireUser, HttpError } from '@/lib/auth';
import { jsonError, toMillis } from '@/lib/api-helpers';
import type { UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireUser(req);

    const matchSnap = await adminDb.collection('matches').doc(id).get();
    if (!matchSnap.exists) throw new HttpError(404, 'Jogo não encontrado');
    const match = matchSnap.data() as Record<string, unknown>;

    const userSnap = await adminDb.collection('users').doc(u.uid).get();
    const profile = userSnap.exists ? (userSnap.data() as UserProfile) : null;
    if (!profile?.pixKey) throw new HttpError(403, 'Cadastre sua chave Pix antes de palpitar');

    if (Date.now() >= toMillis(match.kickoffAt)) throw new HttpError(409, 'Palpites encerrados para este jogo');

    const body = await req.json();
    if (!isValidScore(body.homeGuess) || !isValidScore(body.awayGuess)) {
      return NextResponse.json({ error: 'Placar inválido' }, { status: 400 });
    }

    await adminDb.collection('matches').doc(id).collection('bets').doc(u.uid).set(
      {
        uid: u.uid,
        userName: profile.name || u.name,
        homeGuess: body.homeGuess,
        awayGuess: body.awayGuess,
        points: null,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, homeGuess: body.homeGuess, awayGuess: body.awayGuess });
  } catch (e) {
    return jsonError(e);
  }
}
