import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/auth';
import { jsonError, toMatchDTO, toMillis } from '@/lib/api-helpers';
import { resolveRound, type ScoredBet } from '@/lib/round';
import { buildLeaderboard, type LiveBet } from '@/lib/leaderboard';
import type { BetDTO, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireUser(req);

    const matchSnap = await adminDb.collection('matches').doc(id).get();
    if (!matchSnap.exists) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 });
    const matchData = matchSnap.data() as Record<string, unknown>;
    if (matchData.status === 'deleted') return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 });
    const dto = toMatchDTO(id, matchData);

    const betsSnap = await adminDb.collection('matches').doc(id).collection('bets').get();
    const allBets = betsSnap.docs.map((d) => d.data() as BetDTO);

    // Revela todos os palpites quando o jogo saiu do agendado (ao vivo/encerrado) ou já começou.
    const revealed = dto.status !== 'scheduled' || Date.now() >= toMillis(matchData.kickoffAt);
    const bets = revealed ? allBets : allBets.filter((b) => b.uid === u.uid);

    // Cache de photoURL por uid (uma leitura por palpiteiro), reutilizado por leaderboard e vencedores.
    const photoByUid = new Map<string, string>();
    async function photoFor(uid: string): Promise<string> {
      if (photoByUid.has(uid)) return photoByUid.get(uid)!;
      const s = await adminDb.collection('users').doc(uid).get();
      const p = s.exists ? (s.data() as UserProfile).photoURL ?? '' : '';
      photoByUid.set(uid, p);
      return p;
    }

    let leaderboard = null;
    if (dto.status === 'live' || dto.status === 'finished') {
      const liveBets: LiveBet[] = [];
      for (const b of allBets) {
        liveBets.push({
          uid: b.uid,
          userName: b.userName,
          photoURL: await photoFor(b.uid),
          homeGuess: b.homeGuess,
          awayGuess: b.awayGuess,
        });
      }
      leaderboard = buildLeaderboard(liveBets, {
        homeScore: dto.homeScore ?? 0,
        awayScore: dto.awayScore ?? 0,
        penalties: dto.penalties,
        homePen: dto.homePen,
        awayPen: dto.awayPen,
        status: dto.status,
      });
    }

    let round = null;
    if (dto.status === 'finished') {
      const scored: ScoredBet[] = [];
      for (const b of allBets) {
        const userSnap = await adminDb.collection('users').doc(b.uid).get();
        const pixKey = userSnap.exists ? (userSnap.data() as UserProfile).pixKey : '';
        scored.push({ uid: b.uid, userName: b.userName, pixKey, points: b.points ?? 0 });
      }
      const r = resolveRound(scored, dto.cota);
      const winners = await Promise.all(r.winners.map(async (w) => ({ ...w, photoURL: await photoFor(w.uid) })));
      round = { ...r, winners };
    }

    return NextResponse.json({ match: dto, bets, leaderboard, round });
  } catch (e) {
    return jsonError(e);
  }
}
