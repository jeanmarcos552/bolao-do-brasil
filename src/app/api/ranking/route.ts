import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';
import { resolveRound, type ScoredBet } from '@/lib/round';

export const runtime = 'nodejs';

interface Row { uid: string; name: string; totalPoints: number; roundsWon: number }

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const matchesSnap = await adminDb.collection('matches').get();
    const rows = new Map<string, Row>();

    for (const matchDoc of matchesSnap.docs) {
      const m = matchDoc.data() as Record<string, unknown>;
      if (m.status !== 'finished') continue;
      const betsSnap = await adminDb.collection('matches').doc(matchDoc.id).collection('bets').get();
      const scored: ScoredBet[] = betsSnap.docs.map((d) => {
        const b = d.data() as { uid: string; userName: string; points: number | null };
        const row = rows.get(b.uid) ?? { uid: b.uid, name: b.userName, totalPoints: 0, roundsWon: 0 };
        row.totalPoints += b.points ?? 0;
        rows.set(b.uid, row);
        return { uid: b.uid, userName: b.userName, pixKey: '', points: b.points ?? 0 };
      });
      const result = resolveRound(scored, Number(m.cota ?? 0));
      if (result.topPoints > 0) {
        for (const w of result.winners) {
          const row = rows.get(w.uid);
          if (row) row.roundsWon += 1;
        }
      }
    }

    const ranking = [...rows.values()].sort(
      (a, b) => b.totalPoints - a.totalPoints || b.roundsWon - a.roundsWon,
    );
    return NextResponse.json({ ranking });
  } catch (e) {
    return jsonError(e);
  }
}
