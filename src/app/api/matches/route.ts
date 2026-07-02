import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/auth';
import { jsonError, toMatchDTO, toMillis } from '@/lib/api-helpers';
import type { BetDTO } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const u = await requireUser(req);
    const snap = await adminDb.collection('matches').get();
    const matches = await Promise.all(
      snap.docs.map(async (doc) => {
        const dto = toMatchDTO(doc.id, doc.data() as Record<string, unknown>);
        const betSnap = await adminDb.collection('matches').doc(doc.id).collection('bets').doc(u.uid).get();
        let myBet: BetDTO | null = null;
        if (betSnap.exists) {
          const b = betSnap.data() as BetDTO & { updatedAt?: unknown };
          const savedMs = toMillis(b.updatedAt);
          myBet = {
            uid: b.uid, userName: b.userName,
            homeGuess: b.homeGuess, awayGuess: b.awayGuess,
            points: b.points ?? null,
            updatedAt: savedMs || null,
          };
        }
        return { ...dto, myBet };
      }),
    );
    matches.sort((a, b) => a.kickoffAt - b.kickoffAt);
    return NextResponse.json({ matches: matches.filter((m) => m.status !== 'deleted') });
  } catch (e) {
    return jsonError(e);
  }
}
