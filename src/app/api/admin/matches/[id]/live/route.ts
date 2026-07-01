import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireAdmin, HttpError } from '@/lib/auth';
import { jsonError, isValidScore } from '@/lib/api-helpers';
import { notifyMatchUpdate } from '@/lib/wsNotify';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await requireAdmin(req);
    const b = await req.json();

    const update: Record<string, unknown> = {};
    for (const field of ['homeScore', 'awayScore', 'homePen', 'awayPen'] as const) {
      if (b[field] !== undefined) {
        if (!isValidScore(b[field])) return NextResponse.json({ error: 'Placar inválido' }, { status: 400 });
        update[field] = b[field];
      }
    }
    if (typeof b.extraTime === 'boolean') update.extraTime = b.extraTime;
    if (typeof b.penalties === 'boolean') update.penalties = b.penalties;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    const matchRef = adminDb.collection('matches').doc(id);
    const snap = await matchRef.get();
    if (!snap.exists) throw new HttpError(404, 'Jogo não encontrado');
    const status = (snap.data() as { status: string }).status;
    if (status === 'finished' || status === 'deleted') {
      throw new HttpError(409, 'Jogo não está em andamento');
    }
    if (status === 'scheduled') {
      update.status = 'live';
      update.startedAt = Timestamp.now();
    }

    await matchRef.update(update);
    // Aviso best-effort: o placar já foi gravado, então nunca deixe o nudge
    // do WS derrubar a resposta (notifyMatchUpdate já é no-throw por contrato).
    await notifyMatchUpdate(id).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
