import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/auth';
import { jsonError, toMatchDTO, toMillis } from '@/lib/api-helpers';
import { resolveRound, type ScoredBet } from '@/lib/round';
import type { BetDTO, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireUser(req);

    const matchSnap = await adminDb.collection('matches').doc(id).get();
    if (!matchSnap.exists) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 });
    const matchData = matchSnap.data() as Record<string, unknown>;
    const dto = toMatchDTO(id, matchData);

    const betsSnap = await adminDb.collection('matches').doc(id).collection('bets').get();
    const allBets = betsSnap.docs.map((d) => d.data() as BetDTO);

    const locked = Date.now() >= toMillis(matchData.kickoffAt);
    const bets = locked ? allBets : allBets.filter((b) => b.uid === u.uid);

    let round = null;
    if (dto.status === 'finished') {
      const scored: ScoredBet[] = [];
      for (const b of allBets) {
        const userSnap = await adminDb.collection('users').doc(b.uid).get();
        const pixKey = userSnap.exists ? (userSnap.data() as UserProfile).pixKey : '';
        scored.push({ uid: b.uid, userName: b.userName, pixKey, points: b.points ?? 0 });
      }
      round = resolveRound(scored, dto.cota);
    }

    return NextResponse.json({ match: dto, bets, round });
  } catch (e) {
    return jsonError(e);
  }
}
