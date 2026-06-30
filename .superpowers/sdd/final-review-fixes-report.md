## Fix pass (final review)

### Fix 1 — Soft-deleted matches must not leak through read routes

**a) `src/lib/types.ts`**
Widened `MatchStatus` to include `'deleted'`:
```ts
export type MatchStatus = 'scheduled' | 'finished' | 'deleted';
```

**b) `src/app/api/matches/route.ts` (GET list)**
Added `.filter((m) => m.status !== 'deleted')` to the returned matches array after sorting, so deleted matches are excluded from the list response.

**c) `src/app/api/matches/[id]/route.ts` (GET detail)**
Added an explicit check after the `!matchSnap.exists` guard: if `matchData.status === 'deleted'`, return `404 Jogo não encontrado`. Keeps the two guards on separate lines for clarity.

---

### Fix 2 — Ranking must NOT count a "round won" when nobody scored

**`src/app/api/ranking/route.ts`**
Wrapped the `for (const w of result.winners)` loop in `if (result.topPoints > 0)`. Points continue to accumulate regardless; only `roundsWon` is guarded. Uses `result.topPoints` from `RoundResult` (already present in `src/lib/round.ts`).

---

### Fix 3 — DRY: hoist `isValidScore` into `api-helpers.ts`

**`src/lib/api-helpers.ts`**
Added:
```ts
export function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99;
}
```

**`src/app/api/matches/[id]/bet/route.ts`**
Removed local `isValidScore` definition; updated import to `import { jsonError, toMillis, isValidScore } from '@/lib/api-helpers'`.

**`src/app/api/admin/matches/[id]/result/route.ts`**
Removed local `isValidScore` definition; updated import to `import { jsonError, isValidScore } from '@/lib/api-helpers'`.

---

### New Tests

**`tests/api/matches.test.ts`** — `'não lista jogos deletados'`
Seeds a match with `status: 'deleted'`, calls `GET /api/matches`, and asserts the deleted match is not present in `body.matches`.

**`tests/api/match-detail.test.ts`** — `'404 para jogo deletado'`
Seeds a match with `status: 'deleted'`, calls `GET /api/matches/mdel`, and asserts `res.status === 404`.

**`tests/api/ranking.test.ts`** — `'rodada 0 a 0 (todos zerados) não conta vitória'`
Clears store, seeds one finished match where all bets have `points: 0`, and asserts both users have `roundsWon === 0`.

---

### Verification Results

| Check | Result |
|-------|--------|
| `npm run test` | 48/48 tests pass (10 test files) |
| `npx tsc --noEmit` | Clean (no output / no errors) |
| `npm run build` | Compiled successfully — 10 routes, no errors |

Previous suite count: 45. New suite count: 48 (+3 tests added).
