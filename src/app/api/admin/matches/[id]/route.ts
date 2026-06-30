import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireAdmin, HttpError } from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';

export const runtime = 'nodejs';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await requireAdmin(req);
    const snap = await adminDb.collection('matches').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Jogo não encontrado');
    if ((snap.data() as { status: string }).status === 'finished') {
      throw new HttpError(409, 'Jogo já finalizado não pode ser editado');
    }
    const b = await req.json();
    const update: Record<string, unknown> = {};
    for (const k of ['homeTeam', 'awayTeam', 'homeFlag', 'awayFlag', 'competition'] as const) {
      if (typeof b[k] === 'string') update[k] = b[k];
    }
    if (b.cota !== undefined) update.cota = Number(b.cota);
    if (b.kickoffAt !== undefined) update.kickoffAt = Timestamp.fromMillis(Number(b.kickoffAt));
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }
    await adminDb.collection('matches').doc(id).update(update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await requireAdmin(req);
    const snap = await adminDb.collection('matches').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Jogo não encontrado');
    if ((snap.data() as { status: string }).status === 'finished') {
      throw new HttpError(409, 'Jogo finalizado não pode ser removido');
    }
    await adminDb.collection('matches').doc(id).update({ status: 'deleted' });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
