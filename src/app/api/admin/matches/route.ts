import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const b = await req.json();
    const required = ['homeTeam', 'awayTeam', 'kickoffAt', 'cota'];
    for (const k of required) {
      if (b[k] === undefined || b[k] === null || b[k] === '') {
        return NextResponse.json({ error: `Campo obrigatório: ${k}` }, { status: 400 });
      }
    }
    const ref = await adminDb.collection('matches').add({
      homeTeam: String(b.homeTeam),
      awayTeam: String(b.awayTeam),
      homeFlag: String(b.homeFlag ?? ''),
      awayFlag: String(b.awayFlag ?? ''),
      competition: String(b.competition ?? ''),
      kickoffAt: Timestamp.fromMillis(Number(b.kickoffAt)),
      cota: Number(b.cota),
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      createdBy: admin.uid,
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    return jsonError(e);
  }
}
