import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/auth';

export function jsonError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
}
