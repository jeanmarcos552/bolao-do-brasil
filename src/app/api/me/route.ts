import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser, isAdminEmail } from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';
import type { UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

async function loadOrCreate(uid: string, email: string, name: string, photoURL: string): Promise<UserProfile> {
  const ref = adminDb.collection('users').doc(uid);
  const snap = await ref.get();
  const admin = isAdminEmail(email);
  if (!snap.exists) {
    const profile: UserProfile = { uid, name, email, photoURL, pixKey: '', isAdmin: admin };
    await ref.set(profile);
    return profile;
  }
  const data = snap.data() as UserProfile;
  // mantém isAdmin sincronizado com a env var
  if (data.isAdmin !== admin) { await ref.update({ isAdmin: admin }); data.isAdmin = admin; }
  return { ...data, uid };
}

export async function GET(req: Request) {
  try {
    const u = await requireUser(req);
    const profile = await loadOrCreate(u.uid, u.email, u.name, u.picture);
    return NextResponse.json(profile);
  } catch (e) {
    return jsonError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const u = await requireUser(req);
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const pixKey = typeof body.pixKey === 'string' ? body.pixKey.trim() : '';
    if (!name || !pixKey) {
      return NextResponse.json({ error: 'Nome e chave Pix são obrigatórios' }, { status: 400 });
    }
    await loadOrCreate(u.uid, u.email, u.name, u.picture);
    await adminDb.collection('users').doc(u.uid).update({ name, pixKey });
    const snap = await adminDb.collection('users').doc(u.uid).get();
    return NextResponse.json({ ...(snap.data() as UserProfile), uid: u.uid });
  } catch (e) {
    return jsonError(e);
  }
}
