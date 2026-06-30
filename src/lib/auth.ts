import { adminAuth } from '@/lib/firebaseAdmin';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthedUser {
  uid: string;
  email: string;
  name: string;
  picture: string;
}

export function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireUser(req: Request): Promise<AuthedUser> {
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer (.+)$/);
  if (!m) throw new HttpError(401, 'Token de autenticação ausente');
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(m[1]);
  } catch {
    throw new HttpError(401, 'Token inválido ou expirado');
  }
  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    name: decoded.name ?? '',
    picture: decoded.picture ?? '',
  };
}

export async function requireAdmin(req: Request): Promise<AuthedUser> {
  const user = await requireUser(req);
  if (!isAdminEmail(user.email)) throw new HttpError(403, 'Acesso restrito ao administrador');
  return user;
}
