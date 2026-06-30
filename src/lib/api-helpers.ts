import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/auth';
import type { MatchDTO } from '@/lib/types';

export function jsonError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
}

interface TsLike { toMillis: () => number }
export function toMillis(v: unknown): number {
  if (v && typeof (v as TsLike).toMillis === 'function') return (v as TsLike).toMillis();
  if (typeof v === 'number') return v;
  return 0;
}

export function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99;
}

export function toMatchDTO(id: string, d: Record<string, unknown>): MatchDTO {
  return {
    id,
    homeTeam: String(d.homeTeam ?? ''),
    awayTeam: String(d.awayTeam ?? ''),
    homeFlag: String(d.homeFlag ?? ''),
    awayFlag: String(d.awayFlag ?? ''),
    competition: String(d.competition ?? ''),
    kickoffAt: toMillis(d.kickoffAt),
    cota: Number(d.cota ?? 0),
    status: (d.status as MatchDTO['status']) ?? 'scheduled',
    homeScore: d.homeScore === null || d.homeScore === undefined ? null : Number(d.homeScore),
    awayScore: d.awayScore === null || d.awayScore === undefined ? null : Number(d.awayScore),
  };
}
