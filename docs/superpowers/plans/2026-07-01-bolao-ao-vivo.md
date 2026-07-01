# Acompanhamento ao Vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o admin conduza um jogo ao vivo (placar, prorrogação, pênaltis) e que os palpiteiros acompanhem em tempo quase real o "campeão do momento", com tela de vencedor (confete + avatar grande + copiar Pix) ao encerrar.

**Architecture:** Next.js App Router + Route Handlers (Node) sobre Firestore via Admin SDK apenas. Tempo real = WebSocket "aviso" (nudge) + API como fonte da verdade + polling de fallback de 25s. Toda a pontuação vive em funções puras no servidor; o WS carrega só `{matchId}` e o cliente refaz o GET autoritativo.

**Tech Stack:** TypeScript, Next.js 15, Firebase Admin SDK, Tailwind, Vitest + React Testing Library (jsdom por arquivo via `// @vitest-environment jsdom`), socket.io-client.

## Global Constraints

- Firestore só via Admin SDK; o cliente nunca acessa direto (regras bloqueadas). Não abrir regras de leitura no cliente.
- O app **nunca** movimenta dinheiro — só exibe a chave Pix.
- Paleta Tailwind: `verde.escuro #00501f`, `verde #009c3b`, `verde.claro #eafaef`, `amarelo #ffdf00`. Vermelho de eliminado: `red-500`/`red-600` do Tailwind.
- Pontuação: `scoreBet` = 3 (placar exato) / 1 (só resultado) / 0. **Pênaltis = 1 ponto** para quem apostou no time que venceu nos pênaltis; empate ou outro time = 0.
- Tamanhos do avatar no leaderboard ao vivo: **1º 240px, 2º 200px, 3º 180px, demais 120px**. Avatar do vencedor: **480px** (240px cada se houver vários empatados).
- **Eliminado**: placar exato já impossível (gols só sobem ⇒ exige `homeGuess ≥ homeScore && awayGuess ≥ awayScore`) **e** resultado atual contra o palpite. Nos pênaltis: apostou em quem está perdendo. Eliminado renderiza a 120px, **sem medalha**, com **borda vermelha de 2px** e **foto em preto e branco (grayscale)**.
- Textos em pt-BR. Segue os padrões visuais e de código já existentes (classes utilitárias, `<img>` simples para fotos/bandeiras, sem next/image).
- WS best-effort: falha de notificação **não** interrompe o lançamento do placar. Sem env de WS → tudo funciona só com polling.
- `.env.local` sem vírgulas/aspas sobrando. Não commitar segredos.
- TDD: teste falhando primeiro, implementação mínima, teste passando, commit. Rodar a suíte com `npm test`; um arquivo com `npx vitest run <caminho>`.

---

## File Structure

**Criar:**
- `src/lib/leaderboard.ts` — `isEliminated`, `buildLeaderboard`, tipos `LiveBet`/`LeaderRow`/`MatchLeaderState`.
- `src/lib/wsNotify.ts` — `notifyMatchUpdate` (nudge best-effort ao serviço WS).
- `src/lib/initials.ts` — util de iniciais (extraído do Header, reusado pelo Avatar).
- `src/app/api/admin/matches/[id]/live/route.ts` — `POST` de atualização ao vivo.
- `src/hooks/useMatchLive.ts` — hook socket.io + polling.
- `src/components/Avatar.tsx` — avatar circular reutilizável.
- `src/components/LiveLeaderboard.tsx` — faixa horizontal de avatares ranqueados.
- `src/components/Confetti.tsx` — confete CSS puro.
- `src/components/WinnerScreen.tsx` — bloco do vencedor (avatar 480px + copiar Pix + confete).
- `src/components/AdminLiveControls.tsx` — controles inline do admin.

**Modificar:**
- `src/lib/types.ts` — `MatchStatus` + `'live'`; `MatchDTO` ganha `extraTime/penalties/homePen/awayPen`.
- `src/lib/api-helpers.ts` — `toMatchDTO` inclui os campos novos.
- `src/lib/scoring.ts` — `scoreBetPenalties`, `scoreBetForMatch`.
- `src/app/api/admin/matches/[id]/result/route.ts` — aceita pênaltis, pontua com `scoreBetForMatch`, notifica WS.
- `src/app/api/matches/[id]/route.ts` — inclui `leaderboard`, `photoURL` nos vencedores, revela palpites quando live/finished.
- `src/components/Header.tsx` — passa a importar `initials` do util.
- `src/components/MatchCard.tsx` — estado `live` (badge, placar, link "acompanhar").
- `src/app/(protected)/jogo/[id]/page.tsx` — integra placar ao vivo, leaderboard, tela do vencedor, controles do admin, `useMatchLive`.
- `src/app/(protected)/page.tsx` — seção "Ao vivo" na Home.
- `package.json` — dependência `socket.io-client`.

**Testes (criar/estender):**
- `tests/api-helpers.test.ts` (novo), `tests/scoring.test.ts` (estende), `tests/leaderboard.test.ts` (novo), `tests/lib/wsNotify.test.ts` (novo), `tests/api/live.test.ts` (novo), `tests/api/result.test.ts` (estende), `tests/api/match-detail.test.ts` (estende), `tests/components/Avatar.test.tsx` (novo), `tests/components/LiveLeaderboard.test.tsx` (novo), `tests/components/WinnerScreen.test.tsx` (novo), `tests/components/AdminLiveControls.test.tsx` (novo), `tests/hooks/useMatchLive.test.tsx` (novo), `tests/app/jogo.test.tsx` (estende), `tests/components/MatchCard.test.tsx` (estende).

---

## Task 1: Tipos e DTO (status `live` + campos de pênaltis/prorrogação)

**Files:**
- Modify: `src/lib/types.ts:1` e `src/lib/types.ts:13-25`
- Modify: `src/lib/api-helpers.ts:24-38`
- Test: `tests/api-helpers.test.ts` (criar)

**Interfaces:**
- Consumes: nada.
- Produces: `MatchStatus` inclui `'live'`; `MatchDTO` ganha `extraTime: boolean; penalties: boolean; homePen: number; awayPen: number`. `toMatchDTO(id, d)` popula esses campos com defaults (`extraTime/penalties` = `d.x === true`; `homePen/awayPen` = `Number(d.x ?? 0)`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/api-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toMatchDTO } from '@/lib/api-helpers';

describe('toMatchDTO', () => {
  it('preenche defaults dos campos ao vivo quando ausentes', () => {
    const dto = toMatchDTO('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null });
    expect(dto.extraTime).toBe(false);
    expect(dto.penalties).toBe(false);
    expect(dto.homePen).toBe(0);
    expect(dto.awayPen).toBe(0);
    expect(dto.status).toBe('scheduled');
  });

  it('propaga os campos ao vivo quando presentes', () => {
    const dto = toMatchDTO('m1', { status: 'live', homeScore: 1, awayScore: 1, extraTime: true, penalties: true, homePen: 4, awayPen: 2 });
    expect(dto.status).toBe('live');
    expect(dto.extraTime).toBe(true);
    expect(dto.penalties).toBe(true);
    expect(dto.homePen).toBe(4);
    expect(dto.awayPen).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api-helpers.test.ts`
Expected: FAIL — `dto.extraTime` é `undefined` (campo ainda não existe).

- [ ] **Step 3: Atualizar os tipos**

Em `src/lib/types.ts`, trocar a linha 1:

```ts
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'deleted';
```

E o `MatchDTO` (adicionar os 4 campos após `awayScore`):

```ts
export interface MatchDTO {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  competition: string;
  kickoffAt: number;
  cota: number;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  extraTime: boolean;
  penalties: boolean;
  homePen: number;
  awayPen: number;
}
```

- [ ] **Step 4: Atualizar `toMatchDTO`**

Em `src/lib/api-helpers.ts`, substituir o corpo do `return` de `toMatchDTO` para incluir os campos novos:

```ts
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
    extraTime: d.extraTime === true,
    penalties: d.penalties === true,
    homePen: Number(d.homePen ?? 0),
    awayPen: Number(d.awayPen ?? 0),
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/api-helpers.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Rodar a suíte inteira (nenhuma regressão)**

Run: `npm test`
Expected: todos os testes passam (os DTOs existentes ganham campos novos, sem quebrar asserts).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/api-helpers.ts tests/api-helpers.test.ts
git commit -m "feat: add live status and penalty fields to Match types/DTO"
```

---

## Task 2: Pontuação de pênaltis (funções puras)

**Files:**
- Modify: `src/lib/scoring.ts` (adicionar ao final)
- Test: `tests/scoring.test.ts` (estender)

**Interfaces:**
- Consumes: `outcome`, `scoreBet` (já existem em `src/lib/scoring.ts`).
- Produces:
  - `scoreBetPenalties(homeGuess: number, awayGuess: number, homePen: number, awayPen: number): 0 | 1`
  - `interface MatchScoreState { homeScore: number; awayScore: number; penalties: boolean; homePen: number; awayPen: number }`
  - `scoreBetForMatch(bet: { homeGuess: number; awayGuess: number }, m: MatchScoreState): number`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/scoring.test.ts`:

```ts
import { scoreBetPenalties, scoreBetForMatch } from '@/lib/scoring';

describe('scoreBetPenalties', () => {
  it('apostou no mandante e mandante venceu os pênaltis => 1', () => expect(scoreBetPenalties(1, 0, 4, 2)).toBe(1));
  it('apostou no visitante e mandante venceu => 0', () => expect(scoreBetPenalties(0, 1, 4, 2)).toBe(0));
  it('apostou empate => 0 (não escolheu vencedor)', () => expect(scoreBetPenalties(1, 1, 4, 2)).toBe(0));
  it('pênaltis empatados no momento => 0', () => expect(scoreBetPenalties(1, 0, 2, 2)).toBe(0));
});

describe('scoreBetForMatch', () => {
  it('sem pênaltis usa scoreBet (exato => 3)', () =>
    expect(scoreBetForMatch({ homeGuess: 2, awayGuess: 0 }, { homeScore: 2, awayScore: 0, penalties: false, homePen: 0, awayPen: 0 })).toBe(3));
  it('sem pênaltis, só resultado => 1', () =>
    expect(scoreBetForMatch({ homeGuess: 3, awayGuess: 1 }, { homeScore: 2, awayScore: 0, penalties: false, homePen: 0, awayPen: 0 })).toBe(1));
  it('com pênaltis, acertou o vencedor => 1', () =>
    expect(scoreBetForMatch({ homeGuess: 1, awayGuess: 0 }, { homeScore: 1, awayScore: 1, penalties: true, homePen: 5, awayPen: 4 })).toBe(1));
  it('com pênaltis, errou o vencedor => 0', () =>
    expect(scoreBetForMatch({ homeGuess: 0, awayGuess: 1 }, { homeScore: 1, awayScore: 1, penalties: true, homePen: 5, awayPen: 4 })).toBe(0));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL — `scoreBetPenalties`/`scoreBetForMatch` não existem.

- [ ] **Step 3: Implementar as funções**

Adicionar ao final de `src/lib/scoring.ts`:

```ts
export function scoreBetPenalties(
  homeGuess: number,
  awayGuess: number,
  homePen: number,
  awayPen: number,
): 0 | 1 {
  const guessed = outcome(homeGuess, awayGuess); // vencedor que o palpiteiro escolheu
  const winner = outcome(homePen, awayPen);      // quem venceu nos pênaltis
  if (winner === 0) return 0;                     // pênaltis empatados => ninguém pontua
  return guessed === winner ? 1 : 0;
}

export interface MatchScoreState {
  homeScore: number;
  awayScore: number;
  penalties: boolean;
  homePen: number;
  awayPen: number;
}

export function scoreBetForMatch(
  bet: { homeGuess: number; awayGuess: number },
  m: MatchScoreState,
): number {
  if (m.penalties) return scoreBetPenalties(bet.homeGuess, bet.awayGuess, m.homePen, m.awayPen);
  return scoreBet(bet.homeGuess, bet.awayGuess, m.homeScore, m.awayScore);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/scoring.test.ts`
Expected: PASS (incluindo os testes existentes de `outcome`/`scoreBet`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/scoring.test.ts
git commit -m "feat: add penalty scoring (scoreBetPenalties, scoreBetForMatch)"
```

---

## Task 3: Leaderboard e eliminados (funções puras)

**Files:**
- Create: `src/lib/leaderboard.ts`
- Test: `tests/leaderboard.test.ts` (criar)

**Interfaces:**
- Consumes: `outcome`, `scoreBetForMatch`, `MatchScoreState` (de `src/lib/scoring.ts`).
- Produces:
  - `interface LiveBet { uid: string; userName: string; photoURL: string; homeGuess: number; awayGuess: number }`
  - `interface LeaderRow { uid: string; userName: string; photoURL: string; points: number; position: number; eliminated: boolean }`
  - `interface MatchLeaderState { homeScore: number; awayScore: number; penalties: boolean; homePen: number; awayPen: number; status: string }`
  - `isEliminated(bet: { homeGuess: number; awayGuess: number }, m: MatchLeaderState): boolean`
  - `buildLeaderboard(bets: LiveBet[], m: MatchLeaderState): LeaderRow[]`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/leaderboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isEliminated, buildLeaderboard, type LiveBet, type MatchLeaderState } from '@/lib/leaderboard';

const live = (over: Partial<MatchLeaderState> = {}): MatchLeaderState =>
  ({ homeScore: 0, awayScore: 0, penalties: false, homePen: 0, awayPen: 0, status: 'live', ...over });

describe('isEliminated (jogo ao vivo)', () => {
  it('apostou 1x0 e o jogo está 0x1 => eliminado', () =>
    expect(isEliminated({ homeGuess: 1, awayGuess: 0 }, live({ homeScore: 0, awayScore: 1 }))).toBe(true));
  it('apostou 2x1 e o jogo está 0x1 => NÃO eliminado (2x1 ainda alcançável)', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 1 }, live({ homeScore: 0, awayScore: 1 }))).toBe(false));
  it('apostou 1x0 e o jogo está 1x0 => NÃO eliminado (ainda pode cravar)', () =>
    expect(isEliminated({ homeGuess: 1, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0 }))).toBe(false));
  it('apostou 2x0 e o jogo está 1x0 => NÃO eliminado (2x0 alcançável)', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0 }))).toBe(false));
  it('apostou 0x0 e o jogo está 1x0 => eliminado', () =>
    expect(isEliminated({ homeGuess: 0, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0 }))).toBe(true));
});

describe('isEliminated (pênaltis)', () => {
  const pen = live({ homeScore: 1, awayScore: 1, penalties: true, homePen: 5, awayPen: 4 });
  it('apostou no perdedor dos pênaltis => eliminado', () =>
    expect(isEliminated({ homeGuess: 0, awayGuess: 1 }, pen)).toBe(true));
  it('apostou no vencedor dos pênaltis => NÃO eliminado', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 0 }, pen)).toBe(false));
  it('pênaltis empatados no momento => ninguém eliminado', () =>
    expect(isEliminated({ homeGuess: 0, awayGuess: 1 }, live({ penalties: true, homePen: 2, awayPen: 2 }))).toBe(false));
});

describe('isEliminated (jogo encerrado)', () => {
  it('apostou 2x0 e terminou 1x0 => eliminado (exato exige ===)', () =>
    expect(isEliminated({ homeGuess: 2, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0, status: 'finished' }))).toBe(true));
  it('apostou 1x0 e terminou 1x0 => NÃO eliminado (exato)', () =>
    expect(isEliminated({ homeGuess: 1, awayGuess: 0 }, live({ homeScore: 1, awayScore: 0, status: 'finished' }))).toBe(false));
});

describe('buildLeaderboard', () => {
  const bet = (uid: string, userName: string, h: number, a: number): LiveBet =>
    ({ uid, userName, photoURL: '', homeGuess: h, awayGuess: a });

  it('ordena por pontos e atribui posições sequenciais', () => {
    const rows = buildLeaderboard(
      [bet('u1', 'Ana', 0, 0), bet('u2', 'Bia', 2, 0), bet('u3', 'Léo', 1, 0)],
      live({ homeScore: 2, awayScore: 0 }),
    );
    // Bia crava 2x0 (3pts, pos 1), Léo acerta resultado (1pt, pos 2), Ana erra (0, pos 3)
    expect(rows.map((r) => r.uid)).toEqual(['u2', 'u3', 'u1']);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(rows[0].points).toBe(3);
  });

  it('manda eliminados para o fim mesmo com mesma pontuação', () => {
    // jogo 0x1: quem apostou vitória do visitante mas não pode cravar fica atrás
    const rows = buildLeaderboard(
      [bet('elim', 'Zé', 1, 0), bet('vivo', 'Duda', 2, 1)],
      live({ homeScore: 0, awayScore: 1 }),
    );
    expect(rows[rows.length - 1].uid).toBe('elim');
    expect(rows.find((r) => r.uid === 'elim')!.eliminated).toBe(true);
    expect(rows.find((r) => r.uid === 'vivo')!.eliminated).toBe(false);
  });

  it('desempata por proximidade e depois por nome', () => {
    // jogo 0x0: ninguém pontua; proximidade decide; empate de proximidade => nome
    const rows = buildLeaderboard(
      [bet('u1', 'Carla', 1, 0), bet('u2', 'Bruno', 0, 1)],
      live({ homeScore: 0, awayScore: 0 }),
    );
    // proximidade igual (1) => ordena por nome: Bruno antes de Carla
    expect(rows.map((r) => r.userName)).toEqual(['Bruno', 'Carla']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/leaderboard.test.ts`
Expected: FAIL — módulo `@/lib/leaderboard` não existe.

- [ ] **Step 3: Implementar `src/lib/leaderboard.ts`**

```ts
import { outcome, scoreBetForMatch } from '@/lib/scoring';

export interface LiveBet {
  uid: string;
  userName: string;
  photoURL: string;
  homeGuess: number;
  awayGuess: number;
}

export interface LeaderRow {
  uid: string;
  userName: string;
  photoURL: string;
  points: number;
  position: number;
  eliminated: boolean;
}

export interface MatchLeaderState {
  homeScore: number;
  awayScore: number;
  penalties: boolean;
  homePen: number;
  awayPen: number;
  status: string;
}

/** Eliminado = não pode mais cravar o placar exato E o resultado atual está contra o palpite. */
export function isEliminated(
  bet: { homeGuess: number; awayGuess: number },
  m: MatchLeaderState,
): boolean {
  if (m.penalties) {
    const w = outcome(m.homePen, m.awayPen);
    return w !== 0 && outcome(bet.homeGuess, bet.awayGuess) !== w;
  }
  const final = m.status === 'finished';
  const exactReachable = final
    ? bet.homeGuess === m.homeScore && bet.awayGuess === m.awayScore
    : bet.homeGuess >= m.homeScore && bet.awayGuess >= m.awayScore;
  if (exactReachable) return false;
  return outcome(bet.homeGuess, bet.awayGuess) !== outcome(m.homeScore, m.awayScore);
}

export function buildLeaderboard(bets: LiveBet[], m: MatchLeaderState): LeaderRow[] {
  const rows = bets.map((b) => ({
    b,
    points: scoreBetForMatch(b, m),
    eliminated: isEliminated(b, m),
    proximity: Math.abs(b.homeGuess - m.homeScore) + Math.abs(b.awayGuess - m.awayScore),
  }));
  rows.sort((x, y) => {
    if (x.eliminated !== y.eliminated) return x.eliminated ? 1 : -1; // eliminados por último
    if (y.points !== x.points) return y.points - x.points;           // mais pontos primeiro
    if (x.proximity !== y.proximity) return x.proximity - y.proximity; // mais perto do exato
    return x.b.userName.localeCompare(y.b.userName);                  // desempate estável por nome
  });
  return rows.map((r, i) => ({
    uid: r.b.uid,
    userName: r.b.userName,
    photoURL: r.b.photoURL,
    points: r.points,
    position: i + 1,
    eliminated: r.eliminated,
  }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/leaderboard.test.ts`
Expected: PASS (todos os grupos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts tests/leaderboard.test.ts
git commit -m "feat: add live leaderboard + elimination pure functions"
```

---

## Task 4: Aviso via WebSocket (`notifyMatchUpdate`)

**Files:**
- Create: `src/lib/wsNotify.ts`
- Test: `tests/lib/wsNotify.test.ts` (criar)

**Interfaces:**
- Consumes: `process.env.WS_PUBLISH_URL`, `process.env.WS_API_KEY`, `fetch` global.
- Produces: `notifyMatchUpdate(matchId: string): Promise<void>` — no-op se faltar env; nunca lança (captura erro de `fetch`).

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/lib/wsNotify.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notifyMatchUpdate } from '@/lib/wsNotify';

beforeEach(() => {
  delete process.env.WS_PUBLISH_URL;
  delete process.env.WS_API_KEY;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('notifyMatchUpdate', () => {
  it('no-op sem env: não chama fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));
    await notifyMatchUpdate('m1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('com env: faz POST com X-API-KEY e body do evento', async () => {
    process.env.WS_PUBLISH_URL = 'https://ws.example/events/checkin';
    process.env.WS_API_KEY = 'secret';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null));
    await notifyMatchUpdate('m1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://ws.example/events/checkin');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-API-KEY']).toBe('secret');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ event: 'match_update', room: 'match:m1', matchId: 'm1' });
  });

  it('não lança se o fetch rejeitar', async () => {
    process.env.WS_PUBLISH_URL = 'https://ws.example/events/checkin';
    process.env.WS_API_KEY = 'secret';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('rede caiu'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(notifyMatchUpdate('m1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/lib/wsNotify.test.ts`
Expected: FAIL — módulo `@/lib/wsNotify` não existe.

- [ ] **Step 3: Implementar `src/lib/wsNotify.ts`**

```ts
/**
 * Avisa o serviço de WebSocket (node-ws-boilerplate) que um jogo mudou.
 * Best-effort: sem env vira no-op; falha de rede é ignorada (o placar já foi gravado).
 */
export async function notifyMatchUpdate(matchId: string): Promise<void> {
  const url = process.env.WS_PUBLISH_URL;
  const key = process.env.WS_API_KEY;
  if (!url || !key) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
      body: JSON.stringify({ event: 'match_update', room: `match:${matchId}`, matchId }),
    });
  } catch (e) {
    console.error('notifyMatchUpdate falhou (ignorado):', e);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/lib/wsNotify.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/wsNotify.ts tests/lib/wsNotify.test.ts
git commit -m "feat: add best-effort WebSocket nudge (notifyMatchUpdate)"
```

---

## Task 5: Endpoint `POST /api/admin/matches/[id]/live`

**Files:**
- Create: `src/app/api/admin/matches/[id]/live/route.ts`
- Test: `tests/api/live.test.ts` (criar)

**Interfaces:**
- Consumes: `requireAdmin`, `HttpError` (`@/lib/auth`); `isValidScore`, `jsonError` (`@/lib/api-helpers`); `adminDb`, `Timestamp` (`@/lib/firebaseAdmin`); `notifyMatchUpdate` (`@/lib/wsNotify`).
- Produces: `POST(req, ctx)` que aplica atualizações parciais ao jogo ao vivo, transiciona `scheduled → live` (grava `startedAt`), 409 em `finished`/`deleted`, 400 em placar inválido ou body vazio, e chama `notifyMatchUpdate`. Resposta `{ ok: true }`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/api/live.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = 'admin@x.com';
  h = installAdminMock();
  h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null });
});

const send = (headers: Record<string, string>, data: unknown) =>
  new Request('http://t/api/admin/matches/m1/live', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/admin/matches/[id]/live', () => {
  it('inicia o jogo ao vivo (scheduled -> live, 0x0)', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 0, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(200);
    const m = h.store.matches.get('m1')!;
    expect(m.status).toBe('live');
    expect(m.homeScore).toBe(0);
    expect(m.startedAt).toBeDefined();
  });

  it('atualiza o placar de um jogo já ao vivo', async () => {
    h.store.matches.get('m1')!.status = 'live';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 2, awayScore: 1 }), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.matches.get('m1')!.homeScore).toBe(2);
    expect(h.store.matches.get('m1')!.status).toBe('live');
  });

  it('marca pênaltis sem mexer no status', async () => {
    h.store.matches.get('m1')!.status = 'live';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { penalties: true, homePen: 1, awayPen: 0 }), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.matches.get('m1')!.penalties).toBe(true);
    expect(h.store.matches.get('m1')!.homePen).toBe(1);
  });

  it('400 para placar inválido', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: -1, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(400);
  });

  it('400 quando não há nada para atualizar', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, {}), ctx('m1'));
    expect(res.status).toBe(400);
  });

  it('409 se o jogo já finalizou', async () => {
    h.store.matches.get('m1')!.status = 'finished';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(409);
  });

  it('403 para não-admin', async () => {
    const headers = asUser(h, 'u1', 'user@x.com', 'User');
    const { POST } = await import('@/app/api/admin/matches/[id]/live/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/live.test.ts`
Expected: FAIL — rota `@/app/api/admin/matches/[id]/live/route` não existe.

- [ ] **Step 3: Implementar a rota**

Criar `src/app/api/admin/matches/[id]/live/route.ts`:

```ts
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
    await notifyMatchUpdate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/api/live.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/matches/[id]/live/route.ts" tests/api/live.test.ts
git commit -m "feat: add POST /api/admin/matches/[id]/live endpoint"
```

---

## Task 6: Encerrar jogo com pênaltis (rota `result`)

**Files:**
- Modify: `src/app/api/admin/matches/[id]/result/route.ts`
- Test: `tests/api/result.test.ts` (estender)

**Interfaces:**
- Consumes: `scoreBetForMatch` (`@/lib/scoring`), `notifyMatchUpdate` (`@/lib/wsNotify`), demais já usados.
- Produces: `POST` aceita `penalties?/homePen?/awayPen?/extraTime?`; se `penalties === true`, exige `homePen`/`awayPen` válidos e diferentes (400 senão); pontua com `scoreBetForMatch`; grava campos finais; chama `notifyMatchUpdate`. Resposta inalterada `{ ok: true, scored: N }`.

- [ ] **Step 1: Escrever os testes que falham (estender)**

Adicionar dentro do `describe('POST /api/admin/matches/[id]/result', ...)` em `tests/api/result.test.ts`:

```ts
  it('encerra nos pênaltis pontuando por vencedor (1/0)', async () => {
    // regulamento 1x1, pênaltis 5x4 (mandante vence)
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: 1, cota: 10, status: 'live', homeScore: 1, awayScore: 1 });
    h.store.bets.set('m1', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }], // apostou mandante -> 1
      ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 0, awayGuess: 1, points: null }],  // apostou visitante -> 0
      ['u3', { uid: 'u3', userName: 'Léo', homeGuess: 1, awayGuess: 1, points: null }],  // empate -> 0
    ]));
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/result/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 1, penalties: true, homePen: 5, awayPen: 4 }), ctx('m1'));
    expect(res.status).toBe(200);
    const bets = h.store.bets.get('m1')!;
    expect(bets.get('u1')!.points).toBe(1);
    expect(bets.get('u2')!.points).toBe(0);
    expect(bets.get('u3')!.points).toBe(0);
    const m = h.store.matches.get('m1')!;
    expect(m.status).toBe('finished');
    expect(m.penalties).toBe(true);
    expect(m.homePen).toBe(5);
  });

  it('400 se pênaltis marcado mas empatado', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/result/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 1, penalties: true, homePen: 3, awayPen: 3 }), ctx('m1'));
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/result.test.ts`
Expected: FAIL — os pontos de pênaltis ainda usam `scoreBet` (u1 daria 0, não 1) e não há validação de pênaltis empatado.

- [ ] **Step 3: Reescrever a rota `result`**

Substituir todo o conteúdo de `src/app/api/admin/matches/[id]/result/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireAdmin, HttpError } from '@/lib/auth';
import { jsonError, isValidScore } from '@/lib/api-helpers';
import { scoreBetForMatch } from '@/lib/scoring';
import { notifyMatchUpdate } from '@/lib/wsNotify';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await requireAdmin(req);

    const b = await req.json();
    if (!isValidScore(b.homeScore) || !isValidScore(b.awayScore)) {
      return NextResponse.json({ error: 'Placar inválido' }, { status: 400 });
    }
    const penalties = b.penalties === true;
    if (penalties && (!isValidScore(b.homePen) || !isValidScore(b.awayPen) || b.homePen === b.awayPen)) {
      return NextResponse.json({ error: 'Pênaltis inválidos' }, { status: 400 });
    }

    const matchRef = adminDb.collection('matches').doc(id);
    const snap = await matchRef.get();
    if (!snap.exists) throw new HttpError(404, 'Jogo não encontrado');
    if ((snap.data() as { status: string }).status === 'finished') {
      throw new HttpError(409, 'Jogo já finalizado');
    }

    const matchState = {
      homeScore: b.homeScore,
      awayScore: b.awayScore,
      penalties,
      homePen: penalties ? b.homePen : 0,
      awayPen: penalties ? b.awayPen : 0,
    };

    const betsSnap = await matchRef.collection('bets').get();
    for (const betDoc of betsSnap.docs) {
      const bet = betDoc.data() as { homeGuess: number; awayGuess: number };
      const points = scoreBetForMatch(bet, matchState);
      await matchRef.collection('bets').doc(betDoc.id).set({ points }, { merge: true });
    }

    await matchRef.update({
      status: 'finished',
      homeScore: b.homeScore,
      awayScore: b.awayScore,
      extraTime: b.extraTime === true,
      penalties,
      homePen: matchState.homePen,
      awayPen: matchState.awayPen,
      finishedAt: Timestamp.now(),
    });

    await notifyMatchUpdate(id);
    return NextResponse.json({ ok: true, scored: betsSnap.docs.length });
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/api/result.test.ts`
Expected: PASS — os 2 testes existentes (placar normal, 409) e os 2 novos (pênaltis, 400 empatado).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/matches/[id]/result/route.ts" tests/api/result.test.ts
git commit -m "feat: score penalties on finalize + WS nudge in result route"
```

---

## Task 7: `GET /api/matches/[id]` devolve leaderboard, fotos e revela ao vivo

**Files:**
- Modify: `src/app/api/matches/[id]/route.ts`
- Test: `tests/api/match-detail.test.ts` (estender)

**Interfaces:**
- Consumes: `buildLeaderboard`, `type LiveBet` (`@/lib/leaderboard`); `type MatchDTO` implícito via `toMatchDTO`.
- Produces: resposta `{ match, bets, leaderboard, round }`. `leaderboard: LeaderRow[] | null` quando `live`/`finished`. `round.winners[i]` ganha `photoURL: string`. Palpites revelados quando `status !== 'scheduled'` OU passou o kickoff.

- [ ] **Step 1: Escrever os testes que falham (estender)**

Adicionar ao `describe('GET /api/matches/[id]', ...)` em `tests/api/match-detail.test.ts`:

```ts
  it('jogo ao vivo revela todos os palpites e devolve leaderboard com fotos', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW + 999999, cota: 10, status: 'live', homeScore: 2, awayScore: 0 });
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', pixKey: 'j@pix', email: '', isAdmin: false, photoURL: 'http://foto/jean.png' });
    h.store.users.set('u2', { uid: 'u2', name: 'Bia', pixKey: 'b@pix', email: '', isAdmin: false, photoURL: '' });
    h.store.bets.set('m1', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }], // crava 2x0 -> topo
      ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 0, awayGuess: 1, points: null }],  // eliminado
    ]));
    const headers = asUser(h, 'u2', 'bia@x.com', 'Bia');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.bets.length).toBe(2); // revelado mesmo antes do kickoff, porque está ao vivo
    expect(body.round).toBeNull();
    expect(body.leaderboard[0].uid).toBe('u1');
    expect(body.leaderboard[0].photoURL).toBe('http://foto/jean.png');
    expect(body.leaderboard[0].position).toBe(1);
    expect(body.leaderboard.find((r: any) => r.uid === 'u2').eliminated).toBe(true);
  });

  it('vencedor traz photoURL', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW - 1000, cota: 10, status: 'finished', homeScore: 2, awayScore: 0 });
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', pixKey: 'jean@pix', email: '', isAdmin: false, photoURL: 'http://foto/jean.png' });
    h.store.bets.set('m1', new Map([['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: 3 }]]));
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.round.winners[0].photoURL).toBe('http://foto/jean.png');
    expect(body.leaderboard).not.toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/api/match-detail.test.ts`
Expected: FAIL — `body.leaderboard` é `undefined` e `winners[0].photoURL` é `undefined`.

- [ ] **Step 3: Reescrever o `GET`**

Substituir todo o conteúdo de `src/app/api/matches/[id]/route.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/api/match-detail.test.ts`
Expected: PASS — os 3 testes existentes + os 2 novos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/matches/[id]/route.ts" tests/api/match-detail.test.ts
git commit -m "feat: return leaderboard + winner photoURL and reveal live bets in match detail"
```

---

## Task 8: Componente `Avatar` (+ util `initials`)

**Files:**
- Create: `src/lib/initials.ts`
- Create: `src/components/Avatar.tsx`
- Modify: `src/components/Header.tsx:6-8` (usar o util)
- Test: `tests/components/Avatar.test.tsx` (criar)

**Interfaces:**
- Produces:
  - `initials(name: string): string` — mesma lógica atual do Header (`name.split(' ').filter(Boolean).slice(0,2).map(p => p[0]?.toUpperCase()).join('') || '?'`).
  - `Avatar({ photoURL, name, size, grayscale }: { photoURL: string; name: string; size: number; grayscale?: boolean })` — `<img>` circular se houver `photoURL`; senão círculo verde com iniciais. `grayscale` aplica `filter: grayscale(1)`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/components/Avatar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from '@/components/Avatar';

describe('Avatar', () => {
  it('renderiza a foto com o tamanho pedido', () => {
    render(<Avatar photoURL="http://foto/x.png" name="Jean Silva" size={240} />);
    const img = screen.getByAltText('Jean Silva') as HTMLImageElement;
    expect(img.src).toContain('http://foto/x.png');
    expect(img.style.width).toBe('240px');
    expect(img.style.height).toBe('240px');
  });

  it('sem foto, mostra iniciais', () => {
    render(<Avatar photoURL="" name="Jean Silva" size={120} />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('grayscale aplica o filtro', () => {
    const { container } = render(<Avatar photoURL="http://foto/x.png" name="Ana" size={120} grayscale />);
    const img = container.querySelector('img')!;
    expect(img.style.filter).toContain('grayscale');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/Avatar.test.tsx`
Expected: FAIL — `@/components/Avatar` não existe.

- [ ] **Step 3: Criar o util `src/lib/initials.ts`**

```ts
export function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}
```

- [ ] **Step 4: Criar `src/components/Avatar.tsx`**

```tsx
import { initials } from '@/lib/initials';

export default function Avatar({
  photoURL,
  name,
  size,
  grayscale = false,
}: {
  photoURL: string;
  name: string;
  size: number;
  grayscale?: boolean;
}) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    filter: grayscale ? 'grayscale(1)' : undefined,
  };
  if (photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoURL} alt={name} style={style} className="rounded-full object-cover bg-gray-100" />;
  }
  return (
    <div style={style} className="rounded-full bg-verde text-white flex items-center justify-center font-bold">
      <span style={{ fontSize: Math.max(12, size * 0.4) }}>{initials(name)}</span>
    </div>
  );
}
```

- [ ] **Step 5: Reaproveitar o util no Header**

Em `src/components/Header.tsx`, remover a função local `initials` (linhas 6-8) e adicionar o import após a linha do `useAuth`:

```tsx
import { initials } from '@/lib/initials';
```

O uso `{initials(profile?.name ?? '')}` permanece igual.

- [ ] **Step 6: Rodar e ver passar (Avatar + Header)**

Run: `npx vitest run tests/components/Avatar.test.tsx tests/components/Header.test.tsx`
Expected: PASS — Avatar (3) e o teste existente do Header continuam verdes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/initials.ts src/components/Avatar.tsx src/components/Header.tsx tests/components/Avatar.test.tsx
git commit -m "feat: add reusable Avatar component and shared initials util"
```

---

## Task 9: Componente `LiveLeaderboard`

**Files:**
- Create: `src/components/LiveLeaderboard.tsx`
- Test: `tests/components/LiveLeaderboard.test.tsx` (criar)

**Interfaces:**
- Consumes: `Avatar` (`@/components/Avatar`), `type LeaderRow` (`@/lib/leaderboard`).
- Produces: `LiveLeaderboard({ rows }: { rows: LeaderRow[] })`. Cada item num `div` com `data-testid={`leader-${uid}`}` e largura = tamanho do avatar (240/200/180/120; eliminado sempre 120). Medalha 🥇/🥈/🥉 nas 3 primeiras posições **exceto eliminados**. Eliminado: wrapper do avatar com `border-2 border-red-500` e `Avatar grayscale`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/components/LiveLeaderboard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import type { LeaderRow } from '@/lib/leaderboard';

const row = (over: Partial<LeaderRow>): LeaderRow =>
  ({ uid: 'u', userName: 'X', photoURL: '', points: 0, position: 1, eliminated: false, ...over });

describe('LiveLeaderboard', () => {
  const rows: LeaderRow[] = [
    row({ uid: 'u1', userName: 'Ana', position: 1 }),
    row({ uid: 'u2', userName: 'Bia', position: 2 }),
    row({ uid: 'u3', userName: 'Léo', position: 3 }),
    row({ uid: 'u4', userName: 'Duda', position: 4 }),
    row({ uid: 'u5', userName: 'Zé', position: 5, eliminated: true }),
  ];

  it('dá o tamanho certo por posição', () => {
    render(<LiveLeaderboard rows={rows} />);
    expect((screen.getByTestId('leader-u1') as HTMLElement).style.width).toBe('240px');
    expect((screen.getByTestId('leader-u2') as HTMLElement).style.width).toBe('200px');
    expect((screen.getByTestId('leader-u3') as HTMLElement).style.width).toBe('180px');
    expect((screen.getByTestId('leader-u4') as HTMLElement).style.width).toBe('120px');
  });

  it('mostra medalha só no top-3 não-eliminado', () => {
    render(<LiveLeaderboard rows={rows} />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('eliminado: 120px, borda vermelha e sem medalha', () => {
    render(<LiveLeaderboard rows={rows} />);
    const el = screen.getByTestId('leader-u5') as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(el.innerHTML).toContain('border-red-500');
    const img = el.querySelector('img');
    // Zé não tem foto -> fallback com iniciais; garante que o wrapper marca grayscale via classe/filtro
    expect(el.querySelector('.border-2')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/LiveLeaderboard.test.tsx`
Expected: FAIL — `@/components/LiveLeaderboard` não existe.

- [ ] **Step 3: Criar `src/components/LiveLeaderboard.tsx`**

```tsx
import Avatar from '@/components/Avatar';
import type { LeaderRow } from '@/lib/leaderboard';

const MEDALS = ['🥇', '🥈', '🥉'];

function sizeFor(position: number): number {
  if (position === 1) return 240;
  if (position === 2) return 200;
  if (position === 3) return 180;
  return 120;
}

export default function LiveLeaderboard({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto py-3">
      {rows.map((r) => {
        const size = r.eliminated ? 120 : sizeFor(r.position);
        const medal = !r.eliminated && r.position <= 3 ? MEDALS[r.position - 1] : null;
        return (
          <div key={r.uid} data-testid={`leader-${r.uid}`} className="flex flex-col items-center gap-1 shrink-0" style={{ width: size }}>
            <div className="h-7 text-2xl leading-none">{medal}</div>
            <div className={`rounded-full ${r.eliminated ? 'border-2 border-red-500' : ''}`}>
              <Avatar photoURL={r.photoURL} name={r.userName} size={size} grayscale={r.eliminated} />
            </div>
            <div className="font-bold text-sm">{r.position}º</div>
            <div className="text-xs text-center text-gray-600 truncate w-full">{r.userName}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/components/LiveLeaderboard.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveLeaderboard.tsx tests/components/LiveLeaderboard.test.tsx
git commit -m "feat: add LiveLeaderboard component (sizes, medals, eliminated styling)"
```

---

## Task 10: Tela do vencedor (`WinnerScreen` + `Confetti`)

**Files:**
- Create: `src/components/Confetti.tsx`
- Create: `src/components/WinnerScreen.tsx`
- Test: `tests/components/WinnerScreen.test.tsx` (criar)

**Interfaces:**
- Consumes: `Avatar` (`@/components/Avatar`), `formatBRL` (`@/lib/format`).
- Produces:
  - `Confetti({ count }: { count?: number })` — `count` default 40; container com `data-testid="confetti"`; peças posicionadas de forma determinística (sem `Math.random`).
  - `interface RoundWinnerView { uid: string; userName: string; pixKey: string; photoURL: string }`
  - `interface RoundView { winners: RoundWinnerView[]; perWinner: number; totalCollected: number; cota: number }`
  - `WinnerScreen({ round }: { round: RoundView })` — avatar 480px se 1 vencedor, 240px se vários; botão "Copiar Pix" por vencedor (`navigator.clipboard.writeText`, feedback "Copiado!" ~2s); mostra `perWinner`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/components/WinnerScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WinnerScreen from '@/components/WinnerScreen';

const round = {
  winners: [{ uid: 'u1', userName: 'Jean', pixKey: 'jean@pix', photoURL: 'http://foto/j.png' }],
  perWinner: 30,
  totalCollected: 30,
  cota: 10,
};

describe('WinnerScreen', () => {
  it('mostra o vencedor, a chave Pix e o confete', () => {
    render(<WinnerScreen round={round} />);
    expect(screen.getByText('Jean')).toBeInTheDocument();
    expect(screen.getByText('jean@pix')).toBeInTheDocument();
    expect(screen.getByTestId('confetti')).toBeInTheDocument();
    const img = screen.getByAltText('Jean') as HTMLImageElement;
    expect(img.style.width).toBe('480px');
  });

  it('copiar Pix chama a clipboard e dá feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WinnerScreen round={round} />);
    await userEvent.click(screen.getByRole('button', { name: /copiar pix/i }));
    expect(writeText).toHaveBeenCalledWith('jean@pix');
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/WinnerScreen.test.tsx`
Expected: FAIL — `@/components/WinnerScreen` não existe.

- [ ] **Step 3: Criar `src/components/Confetti.tsx`**

```tsx
const COLORS = ['#009c3b', '#ffdf00', '#ffffff'];

export default function Confetti({ count = 40 }: { count?: number }) {
  return (
    <div aria-hidden data-testid="confetti" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 97) % 100;
        const delay = (i % 10) * 0.15;
        const duration = 2.5 + (i % 5) * 0.4;
        const color = COLORS[i % COLORS.length];
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10px',
              left: `${left}%`,
              width: 8,
              height: 8,
              background: color,
              borderRadius: 2,
              animation: `confetti-fall ${duration}s linear ${delay}s infinite`,
            }}
          />
        );
      })}
      <style>{`@keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(360deg); opacity: 0.7; } }`}</style>
    </div>
  );
}
```

- [ ] **Step 4: Criar `src/components/WinnerScreen.tsx`**

```tsx
'use client';
import { useState } from 'react';
import Avatar from '@/components/Avatar';
import Confetti from '@/components/Confetti';
import { formatBRL } from '@/lib/format';

export interface RoundWinnerView {
  uid: string;
  userName: string;
  pixKey: string;
  photoURL: string;
}
export interface RoundView {
  winners: RoundWinnerView[];
  perWinner: number;
  totalCollected: number;
  cota: number;
}

function WinnerCard({ w, size, perWinner }: { w: RoundWinnerView; size: number; perWinner: number }) {
  const [copied, setCopied] = useState(false);
  async function copyPix() {
    try {
      await navigator.clipboard.writeText(w.pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }
  return (
    <div className="flex flex-col items-center gap-2" style={{ maxWidth: size }}>
      <Avatar photoURL={w.photoURL} name={w.userName} size={size} />
      <div className="font-bold">{w.userName}</div>
      <div className="text-verde font-extrabold">recebe {formatBRL(perWinner)}</div>
      <div className="text-sm">Pix: <b>{w.pixKey || '(sem Pix)'}</b></div>
      <button
        onClick={copyPix}
        disabled={!w.pixKey}
        className="bg-verde text-white font-bold px-4 py-2 rounded text-xs uppercase disabled:opacity-50"
      >
        {copied ? 'Copiado!' : 'Copiar Pix'}
      </button>
    </div>
  );
}

export default function WinnerScreen({ round }: { round: RoundView }) {
  const single = round.winners.length === 1;
  const size = single ? 480 : 240;
  return (
    <div className="relative bg-amber-50 border border-amber-200 rounded p-4 my-3 overflow-hidden">
      <Confetti />
      <div className="relative text-center">
        <div className="font-extrabold text-lg mb-3">🏆 Vencedor{single ? '' : 'es'} da rodada</div>
        <div className="flex flex-wrap items-start justify-center gap-4">
          {round.winners.map((w) => (
            <WinnerCard key={w.uid} w={w} size={size} perWinner={round.perWinner} />
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-3">
          Arrecadado: {formatBRL(round.totalCollected)} · cota {formatBRL(round.cota)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/components/WinnerScreen.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add src/components/Confetti.tsx src/components/WinnerScreen.tsx tests/components/WinnerScreen.test.tsx
git commit -m "feat: add WinnerScreen (confetti, 480px avatar, copy-Pix)"
```

---

## Task 11: Hook `useMatchLive` (socket.io + polling) e dependência

**Files:**
- Modify: `package.json` (dependência `socket.io-client`)
- Create: `src/hooks/useMatchLive.ts`
- Test: `tests/hooks/useMatchLive.test.tsx` (criar)

**Interfaces:**
- Consumes: `socket.io-client` (`io`), `process.env.NEXT_PUBLIC_WS_URL`.
- Produces: `useMatchLive(matchId: string, active: boolean, onUpdate: () => void): void` — quando `active`, conecta ao WS (se houver `NEXT_PUBLIC_WS_URL`), entra na sala `match:{id}` no `connect`, chama `onUpdate` em `match_update`, e faz polling a cada 25000ms. Desconecta/limpa ao desmontar ou quando `active` fica falso.

- [ ] **Step 1: Instalar a dependência**

Run: `npm install socket.io-client`
Expected: `socket.io-client` aparece em `dependencies` do `package.json`.
(Se estiver offline, adicionar manualmente `"socket.io-client": "^4.8.1"` em `dependencies` e rodar `npm install` depois.)

- [ ] **Step 2: Escrever o teste que falha**

Criar `tests/hooks/useMatchLive.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';

const handlers: Record<string, (...a: unknown[]) => void> = {};
const socket = {
  on: vi.fn((ev: string, cb: (...a: unknown[]) => void) => { handlers[ev] = cb; }),
  emit: vi.fn(),
  disconnect: vi.fn(),
};
const io = vi.fn(() => socket);
vi.mock('socket.io-client', () => ({ io: (...a: unknown[]) => io(...a) }));

import { useMatchLive } from '@/hooks/useMatchLive';

function Probe({ active, onUpdate }: { active: boolean; onUpdate: () => void }) {
  useMatchLive('m1', active, onUpdate);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  process.env.NEXT_PUBLIC_WS_URL = 'https://ws.example';
  io.mockClear(); socket.on.mockClear(); socket.emit.mockClear(); socket.disconnect.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
});
afterEach(() => { vi.useRealTimers(); });

describe('useMatchLive', () => {
  it('conecta, entra na sala e responde ao match_update', () => {
    const onUpdate = vi.fn();
    render(<Probe active onUpdate={onUpdate} />);
    expect(io).toHaveBeenCalledWith('https://ws.example', expect.anything());
    handlers['connect']?.();
    expect(socket.emit).toHaveBeenCalledWith('join_event', { event_id: 'match:m1' });
    handlers['match_update']?.();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('faz polling a cada 25s', () => {
    const onUpdate = vi.fn();
    render(<Probe active onUpdate={onUpdate} />);
    vi.advanceTimersByTime(25000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(25000);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('inativo não conecta', () => {
    render(<Probe active={false} onUpdate={vi.fn()} />);
    expect(io).not.toHaveBeenCalled();
  });

  it('desmontar desconecta', () => {
    const { unmount } = render(<Probe active onUpdate={vi.fn()} />);
    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/hooks/useMatchLive.test.tsx`
Expected: FAIL — `@/hooks/useMatchLive` não existe.

- [ ] **Step 4: Criar `src/hooks/useMatchLive.ts`**

```ts
'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Enquanto `active`, escuta o "aviso" do WS (match_update) para o jogo e faz
 * polling de fallback a cada 25s. Toda vez que algo muda, chama `onUpdate`
 * (que deve refazer o GET autoritativo).
 */
export function useMatchLive(matchId: string, active: boolean, onUpdate: () => void): void {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    if (!active) return;
    const url = process.env.NEXT_PUBLIC_WS_URL;
    let socket: Socket | null = null;
    if (url) {
      socket = io(url, { transports: ['websocket'] });
      socket.on('connect', () => socket?.emit('join_event', { event_id: `match:${matchId}` }));
      socket.on('match_update', () => cb.current());
    }
    const poll = setInterval(() => cb.current(), 25000);
    return () => {
      clearInterval(poll);
      socket?.disconnect();
    };
  }, [matchId, active]);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/hooks/useMatchLive.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/hooks/useMatchLive.ts tests/hooks/useMatchLive.test.tsx
git commit -m "feat: add useMatchLive hook (socket.io nudge + 25s polling)"
```

---

## Task 12: Controles inline do admin (`AdminLiveControls`)

**Files:**
- Create: `src/components/AdminLiveControls.tsx`
- Test: `tests/components/AdminLiveControls.test.tsx` (criar)

**Interfaces:**
- Consumes: `useAuth().call` (`@/context/AuthProvider`), `type MatchDTO` (`@/lib/types`).
- Produces: `AdminLiveControls({ match, onChanged }: { match: MatchDTO; onChanged: () => void })`. Se `scheduled`: botão "Iniciar jogo ao vivo" → `POST /api/admin/matches/{id}/live` com `{ homeScore: 0, awayScore: 0 }`. Se `live`: inputs de placar + "Atualizar placar" (POST live), toggles "Prorrogação"/"Foi para pênaltis" (POST live), inputs de pênaltis quando `match.penalties`, e "Encerrar jogo" → `POST /api/admin/matches/{id}/result`. Chama `onChanged` após cada ação.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/components/AdminLiveControls.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const call = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));

import AdminLiveControls from '@/components/AdminLiveControls';
import type { MatchDTO } from '@/lib/types';

const base: MatchDTO = {
  id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '', awayFlag: '', competition: 'X',
  kickoffAt: 1, cota: 10, status: 'scheduled', homeScore: null, awayScore: null,
  extraTime: false, penalties: false, homePen: 0, awayPen: 0,
};

beforeEach(() => call.mockClear());

describe('AdminLiveControls', () => {
  it('agendado: inicia o jogo ao vivo em 0x0', async () => {
    render(<AdminLiveControls match={base} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar jogo ao vivo/i }));
    expect(call).toHaveBeenCalledWith('/api/admin/matches/m1/live', { method: 'POST', body: { homeScore: 0, awayScore: 0 } });
  });

  it('ao vivo: atualizar placar chama /live', async () => {
    render(<AdminLiveControls match={{ ...base, status: 'live', homeScore: 1, awayScore: 0 }} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /atualizar placar/i }));
    expect(call).toHaveBeenCalledWith('/api/admin/matches/m1/live', { method: 'POST', body: { homeScore: 1, awayScore: 0 } });
  });

  it('ao vivo: encerrar jogo chama /result', async () => {
    render(<AdminLiveControls match={{ ...base, status: 'live', homeScore: 2, awayScore: 1 }} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /encerrar jogo/i }));
    expect(call).toHaveBeenCalledWith('/api/admin/matches/m1/result', expect.objectContaining({ method: 'POST' }));
    const body = call.mock.calls.find((c) => String(c[0]).endsWith('/result'))![1].body;
    expect(body).toMatchObject({ homeScore: 2, awayScore: 1 });
  });

  it('ao vivo com pênaltis marcado: mostra inputs de pênaltis', () => {
    render(<AdminLiveControls match={{ ...base, status: 'live', penalties: true }} onChanged={() => {}} />);
    expect(screen.getByLabelText(/pênaltis mandante/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/AdminLiveControls.test.tsx`
Expected: FAIL — `@/components/AdminLiveControls` não existe.

- [ ] **Step 3: Criar `src/components/AdminLiveControls.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import type { MatchDTO } from '@/lib/types';

export default function AdminLiveControls({ match, onChanged }: { match: MatchDTO; onChanged: () => void }) {
  const { call } = useAuth();
  const [home, setHome] = useState(String(match.homeScore ?? 0));
  const [away, setAway] = useState(String(match.awayScore ?? 0));
  const [hPen, setHPen] = useState(String(match.homePen ?? 0));
  const [aPen, setAPen] = useState(String(match.awayPen ?? 0));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function live(body: Record<string, unknown>) {
    setErr(null);
    setBusy(true);
    try {
      await call(`/api/admin/matches/${match.id}/live`, { method: 'POST', body });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setErr(null);
    setBusy(true);
    try {
      await call(`/api/admin/matches/${match.id}/result`, {
        method: 'POST',
        body: {
          homeScore: Number(home),
          awayScore: Number(away),
          extraTime: match.extraTime,
          penalties: match.penalties,
          homePen: Number(hPen),
          awayPen: Number(aPen),
        },
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  if (match.status === 'scheduled') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-3 my-3">
        <button
          onClick={() => live({ homeScore: 0, awayScore: 0 })}
          disabled={busy}
          className="bg-verde text-white font-bold px-4 py-2 rounded text-xs uppercase disabled:opacity-50"
        >
          Iniciar jogo ao vivo
        </button>
        {err && <p className="text-red-600 text-xs mt-2">{err}</p>}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3 my-3 space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <input aria-label="placar mandante" type="number" min={0} value={home} onChange={(e) => setHome(e.target.value)} className="w-14 border rounded text-center" />
        <span>x</span>
        <input aria-label="placar visitante" type="number" min={0} value={away} onChange={(e) => setAway(e.target.value)} className="w-14 border rounded text-center" />
        <button onClick={() => live({ homeScore: Number(home), awayScore: Number(away) })} disabled={busy} className="bg-verde text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-50">
          Atualizar placar
        </button>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={match.extraTime} onChange={(e) => live({ extraTime: e.target.checked })} />
        Prorrogação
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={match.penalties} onChange={(e) => live({ penalties: e.target.checked })} />
        Foi para pênaltis
      </label>
      {match.penalties && (
        <div className="flex items-center gap-2">
          <span>Pênaltis:</span>
          <input aria-label="pênaltis mandante" type="number" min={0} value={hPen} onChange={(e) => setHPen(e.target.value)} className="w-14 border rounded text-center" />
          <span>x</span>
          <input aria-label="pênaltis visitante" type="number" min={0} value={aPen} onChange={(e) => setAPen(e.target.value)} className="w-14 border rounded text-center" />
          <button onClick={() => live({ homePen: Number(hPen), awayPen: Number(aPen) })} disabled={busy} className="bg-verde text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-50">
            Atualizar pênaltis
          </button>
        </div>
      )}
      <button onClick={finish} disabled={busy} className="bg-verde-escuro text-white font-bold px-4 py-2 rounded text-xs uppercase disabled:opacity-50">
        Encerrar jogo
      </button>
      {err && <p className="text-red-600 text-xs">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/components/AdminLiveControls.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminLiveControls.tsx tests/components/AdminLiveControls.test.tsx
git commit -m "feat: add AdminLiveControls (start/update/penalties/finish inline)"
```

---

## Task 13: Integrar a página do jogo `/jogo/[id]`

**Files:**
- Modify: `src/app/(protected)/jogo/[id]/page.tsx` (reescrita)
- Test: `tests/app/jogo.test.tsx` (estender)

**Interfaces:**
- Consumes: `useAuth` (`call`, `profile`), `useMatchLive`, `Flag`, `Loading`, `LiveLeaderboard`, `WinnerScreen`, `AdminLiveControls`, `formatKickoff`, `type MatchDTO`/`BetDTO`, `type LeaderRow`.
- Produces: página que carrega `{ match, bets, leaderboard, round }`, escuta `useMatchLive` quando `status === 'live'`, mostra placar/label do momento, controles do admin (se `profile.isAdmin` e não finalizado), tela do vencedor (finished), o leaderboard (live/finished) e a tabela de palpites.

- [ ] **Step 1: Escrever/estender os testes que falham**

Substituir `tests/app/jogo.test.tsx` por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'm1' }), usePathname: () => '/jogo/m1', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }));

const call = vi.fn();
const profileRef = { profile: { isAdmin: false } as { isAdmin: boolean } | null };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call, profile: profileRef.profile }) }));

import JogoPage from '@/app/(protected)/jogo/[id]/page';

const finishedData = {
  match: { id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪', competition: 'Eliminatórias', kickoffAt: 1, cota: 10, status: 'finished', homeScore: 3, awayScore: 0, extraTime: false, penalties: false, homePen: 0, awayPen: 0 },
  bets: [{ uid: 'u1', userName: 'Jean', homeGuess: 3, awayGuess: 0, points: 3 }, { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: 1 }],
  leaderboard: [{ uid: 'u1', userName: 'Jean', photoURL: '', points: 3, position: 1, eliminated: false }, { uid: 'u2', userName: 'Bia', photoURL: '', points: 1, position: 2, eliminated: false }],
  round: { winners: [{ uid: 'u1', userName: 'Jean', pixKey: 'jean@pix', photoURL: '' }], topPoints: 3, participants: 2, totalCollected: 10, perWinner: 10, cota: 10 },
};

describe('JogoPage', () => {
  it('jogo encerrado: mostra vencedor, chave Pix e palpites', async () => {
    profileRef.profile = { isAdmin: false };
    call.mockResolvedValue(finishedData);
    render(<JogoPage />);
    await waitFor(() => expect(screen.getByText(/jean@pix/i)).toBeInTheDocument());
    expect(screen.getByText('Bia')).toBeInTheDocument();
  });

  it('admin em jogo ao vivo vê os controles', async () => {
    profileRef.profile = { isAdmin: true };
    call.mockResolvedValue({
      match: { ...finishedData.match, status: 'live', homeScore: 1, awayScore: 0 },
      bets: [{ uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }],
      leaderboard: [{ uid: 'u1', userName: 'Jean', photoURL: '', points: 1, position: 1, eliminated: false }],
      round: null,
    });
    render(<JogoPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /encerrar jogo/i })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/app/jogo.test.tsx`
Expected: FAIL — a página ainda não renderiza `WinnerScreen`/controles (o teste do admin não acha "Encerrar jogo").

- [ ] **Step 3: Reescrever a página**

Substituir todo o conteúdo de `src/app/(protected)/jogo/[id]/page.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useMatchLive } from '@/hooks/useMatchLive';
import Loading from '@/components/Loading';
import Flag from '@/components/Flag';
import LiveLeaderboard from '@/components/LiveLeaderboard';
import WinnerScreen, { type RoundView } from '@/components/WinnerScreen';
import AdminLiveControls from '@/components/AdminLiveControls';
import { formatKickoff } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';
import type { LeaderRow } from '@/lib/leaderboard';

interface Detail {
  match: MatchDTO;
  bets: BetDTO[];
  leaderboard: LeaderRow[] | null;
  round: RoundView | null;
}

function scoreLabel(m: MatchDTO): string {
  if (m.status === 'scheduled') return 'x';
  const base = `${m.homeScore ?? 0} x ${m.awayScore ?? 0}`;
  return m.penalties ? `${base} (pên. ${m.homePen} x ${m.awayPen})` : base;
}

function momentLabel(m: MatchDTO): string | null {
  if (m.status !== 'live') return null;
  if (m.penalties) return 'Pênaltis';
  if (m.extraTime) return 'Prorrogação';
  return '🔴 Ao vivo';
}

export default function JogoPage() {
  const { id } = useParams<{ id: string }>();
  const { call, profile } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await call<Detail>(`/api/matches/${id}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [call, id]);

  useEffect(() => {
    load();
  }, [load]);

  useMatchLive(id, data?.match.status === 'live', load);

  if (data === null) {
    return err ? (
      <main className="max-w-2xl mx-auto p-4">
        <p className="text-red-600">{err}</p>
      </main>
    ) : (
      <Loading />
    );
  }

  const { match, bets, leaderboard, round } = data;
  const sorted = [...bets].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const moment = momentLabel(match);

  return (
    <main className="max-w-2xl mx-auto p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
        {match.competition} · {formatKickoff(match.kickoffAt)}
      </div>
      <div className="flex items-center justify-center gap-3 my-3">
        <span className="font-bold w-28 inline-flex items-center justify-end gap-1.5">
          <Flag src={match.homeFlag} alt={match.homeTeam} className="w-6 h-5" /> {match.homeTeam}
        </span>
        <span className="text-2xl font-extrabold text-center">{scoreLabel(match)}</span>
        <span className="font-bold w-28 inline-flex items-center gap-1.5">
          {match.awayTeam} <Flag src={match.awayFlag} alt={match.awayTeam} className="w-6 h-5" />
        </span>
      </div>
      {moment && <div className="text-center text-sm font-bold text-red-600 mb-3">{moment}</div>}

      {profile?.isAdmin && match.status !== 'finished' && <AdminLiveControls match={match} onChanged={load} />}

      {round && round.winners.length > 0 && <WinnerScreen round={round} />}

      {leaderboard && leaderboard.length > 0 && (
        <>
          <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 my-2">
            {match.status === 'finished' ? 'Classificação final' : 'Campeão do momento'}
          </h2>
          <LiveLeaderboard rows={leaderboard} />
        </>
      )}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 my-2">Palpites</h2>
      <table className="w-full text-sm">
        <tbody>
          {sorted.map((b) => (
            <tr key={b.uid} className="border-b border-gray-100">
              <td className="py-1.5">{b.userName}</td>
              <td className="py-1.5 text-center">{b.homeGuess} x {b.awayGuess}</td>
              <td className="py-1.5 text-right font-bold text-verde">
                {b.points === null ? '—' : `${b.points} pt${b.points === 1 ? '' : 's'}`}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td className="py-2 text-gray-500">Ninguém palpitou neste jogo.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/app/jogo.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/jogo/[id]/page.tsx" tests/app/jogo.test.tsx
git commit -m "feat: wire live scoreboard, leaderboard, winner screen and admin controls into match page"
```

---

## Task 14: Estado `live` no `MatchCard` e seção "Ao vivo" na Home

**Files:**
- Modify: `src/components/MatchCard.tsx` (reescrita)
- Modify: `src/app/(protected)/page.tsx`
- Test: `tests/components/MatchCard.test.tsx` (estender)

**Interfaces:**
- Consumes: `type MatchDTO`/`BetDTO`, `Flag`, `Link`, `isLocked`, `formatBRL`, `formatKickoff`, `useAuth().call`.
- Produces: `MatchCard` mostra badge "🔴 Ao vivo" e placar corrente quando `status === 'live'`, com link "Acompanhar ao vivo →"; comportamento de `scheduled`/`finished` inalterado. Home ganha seção "Ao vivo" no topo, antes de "Próximos jogos".

- [ ] **Step 1: Escrever o teste que falha (estender)**

Adicionar ao `describe('MatchCard', ...)` em `tests/components/MatchCard.test.tsx`:

```tsx
  it('jogo ao vivo mostra o placar corrente, o badge e o link', () => {
    render(<MatchCard match={{ ...base, status: 'live', kickoffAt: 1, homeScore: 1, awayScore: 0 }} onSaved={() => {}} />);
    expect(screen.getByText(/ao vivo/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /acompanhar ao vivo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar palpite/i })).toBeNull();
  });
```

Observação: o objeto `base` no arquivo precisa dos campos novos do `MatchDTO`. Atualizar a constante `base` para incluir `extraTime: false, penalties: false, homePen: 0, awayPen: 0` (adicionar ao literal existente).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/components/MatchCard.test.tsx`
Expected: FAIL — o card não mostra "Ao vivo" nem o link para jogo ao vivo.

- [ ] **Step 3: Reescrever `src/components/MatchCard.tsx`**

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { formatBRL, formatKickoff, isLocked } from '@/lib/format';
import Flag from '@/components/Flag';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: Pick<BetDTO, 'homeGuess' | 'awayGuess' | 'points'> | null };

function Team({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-28">
      <Flag src={flag} alt={name} className="w-10 h-10 rounded" />
      <b className="text-sm text-center">{name}</b>
    </div>
  );
}

export default function MatchCard({ match, onSaved }: { match: MatchWithBet; onSaved: () => void }) {
  const { call } = useAuth();
  const isLive = match.status === 'live';
  const showScore = match.status === 'finished' || isLive;
  const canBet = match.status === 'scheduled' && !isLocked(match.kickoffAt);
  const [home, setHome] = useState(match.myBet ? String(match.myBet.homeGuess) : '');
  const [away, setAway] = useState(match.myBet ? String(match.myBet.awayGuess) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await call(`/api/matches/${match.id}/bet`, { method: 'POST', body: { homeGuess: Number(home), awayGuess: Number(away) } });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar palpite');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md mb-2.5 p-4">
      <div className="flex justify-between text-[11px] uppercase tracking-wide text-gray-400 mb-2.5">
        <span>{match.competition} · {formatKickoff(match.kickoffAt)}</span>
        {isLive ? (
          <span className="text-red-600 font-bold">🔴 Ao vivo</span>
        ) : (
          <span className="text-verde font-bold">Cota {formatBRL(match.cota)}</span>
        )}
      </div>

      <div className="flex items-center justify-center gap-3.5">
        <Team flag={match.homeFlag} name={match.homeTeam} />
        {showScore ? (
          <>
            <span className="text-3xl font-extrabold">{match.homeScore ?? 0}</span>
            <span className="text-gray-400 font-bold text-sm">x</span>
            <span className="text-3xl font-extrabold">{match.awayScore ?? 0}</span>
          </>
        ) : (
          <>
            <input aria-label="placar mandante" inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value)} disabled={!canBet}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
            <span className="text-gray-400 font-bold text-sm">x</span>
            <input aria-label="placar visitante" inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value)} disabled={!canBet}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
          </>
        )}
        <Team flag={match.awayFlag} name={match.awayTeam} />
      </div>

      {canBet && (
        <>
          <button onClick={save} disabled={saving || home === '' || away === ''}
            className="mt-3 w-full bg-verde text-white font-extrabold py-2.5 rounded uppercase text-xs tracking-wide disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar palpite'}
          </button>
          <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Trava no apito inicial · {formatKickoff(match.kickoffAt)}</div>
        </>
      )}
      {match.status === 'scheduled' && !canBet && (
        <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Palpites encerrados {match.myBet ? `· seu palpite: ${match.myBet.homeGuess} x ${match.myBet.awayGuess}` : '· você não palpitou'}</div>
      )}
      {isLive && (
        <div className="text-center mt-2.5 text-xs">
          <Link href={`/jogo/${match.id}`} className="text-verde underline">Acompanhar ao vivo →</Link>
        </div>
      )}
      {match.status === 'finished' && (
        <div className="text-center mt-2.5 text-xs text-gray-600">
          {match.myBet ? (
            <>
              Seu palpite: <b>{match.myBet.homeGuess} x {match.myBet.awayGuess}</b> &nbsp;
              {match.myBet.points != null && <span className="bg-verde-claro text-verde rounded px-2 py-0.5 font-bold">+{match.myBet.points} ponto{match.myBet.points === 1 ? '' : 's'}</span>}
            </>
          ) : (
            'Você não palpitou neste jogo'
          )}
          <div className="mt-2"><Link href={`/jogo/${match.id}`} className="text-verde underline text-xs">Ver palpites e vencedor →</Link></div>
        </div>
      )}
      {err && <p className="text-red-600 text-xs mt-2 text-center">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Adicionar a seção "Ao vivo" na Home**

Em `src/app/(protected)/page.tsx`, substituir o bloco de derivação e o `return`:

```tsx
  const aoVivo = matches.filter((m) => m.status === 'live');
  const proximos = matches.filter((m) => m.status === 'scheduled');
  const encerrados = matches.filter((m) => m.status === 'finished');

  return (
    <main className="max-w-2xl mx-auto p-4">
      {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

      {aoVivo.length > 0 && (
        <>
          <h2 className="text-red-600 font-extrabold text-sm uppercase tracking-wide border-l-4 border-red-600 pl-2 mb-2.5">🔴 Ao vivo</h2>
          {aoVivo.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}
        </>
      )}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5 mt-6">Próximos jogos</h2>
      {proximos.length === 0 && <p className="text-gray-500 text-sm mb-4">Nenhum jogo agendado.</p>}
      {proximos.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5 mt-6">Encerrados</h2>
      {encerrados.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo encerrado ainda.</p>}
      {encerrados.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}

      <BrasilCarousel />
    </main>
  );
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/components/MatchCard.test.tsx`
Expected: PASS — os 3 testes existentes + o novo de jogo ao vivo.

- [ ] **Step 6: Rodar a suíte inteira e o build**

Run: `npm test`
Expected: todos os testes passam.

Run: `npm run build`
Expected: build do Next conclui sem erros de tipo (valida a integração de tipos entre DTO, leaderboard e componentes).

- [ ] **Step 7: Commit**

```bash
git add src/components/MatchCard.tsx "src/app/(protected)/page.tsx" tests/components/MatchCard.test.tsx
git commit -m "feat: show live matches in card and home 'ao vivo' section"
```

---

## Notas de configuração (fora do código, para o deploy — não bloqueia as tarefas)

- **Envs de servidor:** `WS_PUBLISH_URL` (ex.: `https://ws.jeansilva.app.br/events/checkin`), `WS_API_KEY`. **Env de cliente:** `NEXT_PUBLIC_WS_URL` (ex.: `https://ws.jeansilva.app.br`). Ausência → app funciona só com polling de 25s.
- **Serviço WS (node-ws-boilerplate, fora deste repo):** precisa de um handler HTTP que valide `X-API-KEY` e faça broadcast do evento `match_update` na sala `match:{id}`. Snippet a ser fornecido ao operador; não faz parte deste plano.

---

## Self-Review

**1. Cobertura da spec:**
- §1 Modelo de dados → Task 1 (tipos/DTO) + rotas gravam os campos (Tasks 5/6).
- §2 Pontuação/leaderboard/eliminados → Tasks 2 e 3.
- §3 API (`/live`, `result`, `GET [id]`, `GET matches`) → Tasks 5, 6, 7 (o `GET /api/matches` de listagem já flui pelo `toMatchDTO` da Task 1; o badge é cliente, Task 14).
- §4 WebSocket (nudge + fallback) → Task 4 (`wsNotify`) + Task 11 (`useMatchLive`).
- §5 Tela ao vivo (Avatar, LiveScoreboard, LiveLeaderboard) → Tasks 8, 9, 13 (o "LiveScoreboard" virou `scoreLabel`/`momentLabel` inline na página).
- §6 Tela do vencedor (Confetti, copiar Pix, avatar 480) → Task 10.
- §7 Controles do admin inline → Task 12 + Task 13 (montagem só p/ admin e não-finalizado).
- §8 Testes → cada task traz seus testes; casos de eliminado (incl. 1x0 vs 0x1) na Task 3.

**2. Placeholders:** nenhum "TBD/TODO"; todo passo de código traz o código completo.

**3. Consistência de tipos:** `MatchScoreState` (scoring) é subconjunto estrutural de `MatchLeaderState` (leaderboard) — `buildLeaderboard` passa `m` para `scoreBetForMatch` sem erro. `LeaderRow` idêntico entre `leaderboard.ts`, API, `LiveLeaderboard` e página. `RoundView`/`RoundWinnerView` exportados de `WinnerScreen` e reusados na página. `useMatchLive(matchId, active, onUpdate)` com a mesma assinatura na página. `AdminLiveControls({ match, onChanged })` e `LiveLeaderboard({ rows })` batem com o uso na página. `toMatchDTO` da Task 1 alimenta os campos que a Task 7 lê no `dto`.
