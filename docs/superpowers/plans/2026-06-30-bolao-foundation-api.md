# Bolão da Seleção — Plano 1: Fundação + Domínio + API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o backend testável do bolão — scaffolding Next.js, funções puras de pontuação/premiação (TDD) e todas as rotas de API com Firebase Admin.

**Architecture:** Projeto único Next.js (App Router). Lógica de negócio sensível mora nos Route Handlers (`src/app/api/**`) e em funções puras (`src/lib/scoring.ts`, `src/lib/round.ts`). Toda escrita no Firestore passa pelo Firebase Admin SDK no servidor; o cliente envia o ID token do Firebase Auth (Google) no header `Authorization: Bearer`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vitest, Firebase Admin SDK (`firebase-admin`), Firebase client SDK (`firebase`).

## Global Constraints

- Linguagem: **TypeScript** em modo `strict`.
- Runtime das rotas de API: **Node.js** (`export const runtime = 'nodejs'` em cada `route.ts` que usa `firebase-admin`).
- Pontuação: **3** (placar exato) / **1** (acertou só o resultado) / **0** (errou).
- Premiação por jogo: vencedor = maior pontuação; em empate de `K`, valor arrecadado `cota × (N − K)` dividido igualmente entre os `K` vencedores.
- Palpite trava quando `agora >= kickoffAt`. Servidor é a fonte da verdade (rejeita fora do prazo).
- Usuário sem `pixKey` não pode palpitar.
- Admin = e-mail presente em `ADMIN_EMAILS` (lista separada por vírgula, comparação case-insensitive).
- Datas trafegam na API como **epoch em milissegundos** (number); no Firestore são `Timestamp`.
- Test runner: **Vitest**. Cada feature começa pelo teste que falha (TDD).
- Commits frequentes, um por task no mínimo.

---

## File Structure (todo o app — este plano cobre lib/ + api/)

```
bolao-brasil/
  package.json, tsconfig.json, next.config.mjs, tailwind.config.ts,
  postcss.config.mjs, vitest.config.ts, .env.example
  public/bg_login.webp
  src/
    lib/
      types.ts            # tipos compartilhados
      scoring.ts          # PURA: scoreBet, outcome
      round.ts            # PURA: resolveRound (vencedores + rateio)
      firebaseAdmin.ts    # singleton Admin SDK (adminDb, adminAuth)
      firebaseClient.ts   # init do SDK cliente (Plano 2 usa de fato)
      auth.ts             # requireUser, requireAdmin, isAdminEmail, HttpError
      api-helpers.ts      # jsonError, toMatchDTO
    app/api/
      me/route.ts
      matches/route.ts
      matches/[id]/route.ts
      matches/[id]/bet/route.ts
      ranking/route.ts
      admin/matches/route.ts
      admin/matches/[id]/route.ts
      admin/matches/[id]/result/route.ts
  tests/
    scoring.test.ts
    round.test.ts
    auth.test.ts
    helpers/mockAdmin.ts  # fake do firebaseAdmin p/ testar rotas
    api/me.test.ts
    api/matches.test.ts
    api/bet.test.ts
    api/result.test.ts
```

---

### Task 1: Scaffolding (Next.js + TS + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/lib/types.ts`
- Move: `bg_login.webp` → `public/bg_login.webp`

**Interfaces:**
- Produces: tipos em `src/lib/types.ts` (`MatchStatus`, `UserProfile`, `MatchDTO`, `BetDTO`) usados por todas as tasks seguintes.

- [ ] **Step 1: Criar o projeto base e instalar dependências**

```bash
cd /c/Users/jeans/Documents/jean/bolao-brasil
npm init -y
npm pkg set name="bolao-brasil" version="0.1.0" private=true
npm pkg set scripts.dev="next dev" scripts.build="next build" scripts.start="next start -p ${PORT:-3000}" scripts.lint="next lint" scripts.test="vitest run" scripts.test:watch="vitest"
npm install next@15 react@18 react-dom@18 firebase firebase-admin
npm install -D typescript @types/react @types/node @types/react-dom tailwindcss postcss autoprefixer vitest @vitejs/plugin-react
```

- [ ] **Step 2: Configurar TypeScript** — `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Configurar Next (standalone p/ Docker no Plano 3)** — `next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};
export default nextConfig;
```

- [ ] **Step 4: Configurar Tailwind** — `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: { escuro: '#00501f', DEFAULT: '#009c3b', claro: '#eafaef' },
        amarelo: '#ffdf00',
      },
    },
  },
  plugins: [],
};
export default config;
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { background: #f0f0f0; color: #222; }
```

- [ ] **Step 5: Layout e página inicial mínima** — `src/app/layout.tsx`, `src/app/page.tsx`

`src/app/layout.tsx`:
```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bolão da Seleção',
  description: 'Bolão dos próximos jogos da Seleção Brasileira',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <main className="p-8 text-2xl font-bold text-verde-escuro">Bolão da Seleção ⚽</main>;
}
```

- [ ] **Step 6: Tipos compartilhados** — `src/lib/types.ts`

```ts
export type MatchStatus = 'scheduled' | 'finished';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  pixKey: string;
  isAdmin: boolean;
}

/** Match serializado para a API (datas em epoch ms). */
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
}

export interface BetDTO {
  uid: string;
  userName: string;
  homeGuess: number;
  awayGuess: number;
  points: number | null;
}
```

- [ ] **Step 7: Configurar Vitest** — `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 8: Mover o background do login**

```bash
mkdir -p public && mv bg_login.webp public/bg_login.webp
```

- [ ] **Step 9: `.env.example` (commitado; valores reais ficam em `.env.local`)**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
ADMIN_EMAILS=jean.silva@b2agencia.com.br
PORT=3000
```

- [ ] **Step 10: Verificar build do app**

Run: `npm run build`
Expected: build conclui sem erros; aparece a rota `/` na lista.

- [ ] **Step 11: Verificar test runner**

Run: `npm run test`
Expected: `No test files found` (ainda sem testes) — confirma que o Vitest roda.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TS + Tailwind + Vitest + tipos base"
```

---

### Task 2: Função pura de pontuação (`scoring.ts`)

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Produces:
  - `outcome(home: number, away: number): -1 | 0 | 1`
  - `scoreBet(homeGuess: number, awayGuess: number, homeFinal: number, awayFinal: number): 0 | 1 | 3`

- [ ] **Step 1: Escrever o teste que falha** — `tests/scoring.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { scoreBet, outcome } from '@/lib/scoring';

describe('outcome', () => {
  it('mandante vence => 1', () => expect(outcome(2, 1)).toBe(1));
  it('visitante vence => -1', () => expect(outcome(0, 3)).toBe(-1));
  it('empate => 0', () => expect(outcome(1, 1)).toBe(0));
});

describe('scoreBet', () => {
  it('placar exato => 3', () => expect(scoreBet(2, 1, 2, 1)).toBe(3));
  it('acertou só o vencedor => 1', () => expect(scoreBet(2, 1, 3, 0)).toBe(1));
  it('acertou só o empate => 1', () => expect(scoreBet(1, 1, 2, 2)).toBe(1));
  it('errou o resultado => 0', () => expect(scoreBet(2, 1, 0, 1)).toBe(0));
  it('errou empate vs vitória => 0', () => expect(scoreBet(1, 1, 2, 0)).toBe(0));
  it('placar exato com gols altos => 3', () => expect(scoreBet(4, 3, 4, 3)).toBe(3));
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/scoring"`.

- [ ] **Step 3: Implementar** — `src/lib/scoring.ts`

```ts
export function outcome(home: number, away: number): -1 | 0 | 1 {
  if (home > away) return 1;
  if (home < away) return -1;
  return 0;
}

export function scoreBet(
  homeGuess: number,
  awayGuess: number,
  homeFinal: number,
  awayFinal: number,
): 0 | 1 | 3 {
  if (homeGuess === homeFinal && awayGuess === awayFinal) return 3;
  if (outcome(homeGuess, awayGuess) === outcome(homeFinal, awayFinal)) return 1;
  return 0;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/scoring.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/scoring.test.ts
git commit -m "feat: função pura de pontuação (3/1/0)"
```

---

### Task 3: Função pura de premiação (`round.ts`)

**Files:**
- Create: `src/lib/round.ts`
- Test: `tests/round.test.ts`

**Interfaces:**
- Consumes: nada (pura).
- Produces:
  - `interface ScoredBet { uid: string; userName: string; pixKey: string; points: number }`
  - `interface RoundWinner { uid: string; userName: string; pixKey: string }`
  - `interface RoundResult { winners: RoundWinner[]; topPoints: number; participants: number; totalCollected: number; perWinner: number; cota: number }`
  - `resolveRound(bets: ScoredBet[], cota: number): RoundResult`

- [ ] **Step 1: Escrever o teste que falha** — `tests/round.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { resolveRound, type ScoredBet } from '@/lib/round';

const b = (uid: string, points: number): ScoredBet => ({
  uid, userName: uid, pixKey: `${uid}@pix`, points,
});

describe('resolveRound', () => {
  it('um vencedor: arrecada cota dos demais', () => {
    const r = resolveRound([b('a', 3), b('b', 1), b('c', 0)], 10);
    expect(r.winners.map(w => w.uid)).toEqual(['a']);
    expect(r.topPoints).toBe(3);
    expect(r.participants).toBe(3);
    expect(r.totalCollected).toBe(20); // 10 * (3 - 1)
    expect(r.perWinner).toBe(20);
  });

  it('empate de 2: divide o arrecadado igualmente', () => {
    const r = resolveRound([b('a', 3), b('b', 3), b('c', 0), b('d', 1)], 10);
    expect(r.winners.map(w => w.uid).sort()).toEqual(['a', 'b']);
    expect(r.totalCollected).toBe(20); // 10 * (4 - 2)
    expect(r.perWinner).toBe(10);      // 20 / 2
  });

  it('todos zerados: todos vencem, nada a arrecadar', () => {
    const r = resolveRound([b('a', 0), b('b', 0)], 10);
    expect(r.winners.length).toBe(2);
    expect(r.totalCollected).toBe(0);
    expect(r.perWinner).toBe(0);
  });

  it('sem palpites: resultado vazio', () => {
    const r = resolveRound([], 10);
    expect(r.winners).toEqual([]);
    expect(r.participants).toBe(0);
    expect(r.totalCollected).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/round.test.ts`
Expected: FAIL — import não resolvido.

- [ ] **Step 3: Implementar** — `src/lib/round.ts`

```ts
export interface ScoredBet {
  uid: string;
  userName: string;
  pixKey: string;
  points: number;
}

export interface RoundWinner {
  uid: string;
  userName: string;
  pixKey: string;
}

export interface RoundResult {
  winners: RoundWinner[];
  topPoints: number;
  participants: number;
  totalCollected: number;
  perWinner: number;
  cota: number;
}

export function resolveRound(bets: ScoredBet[], cota: number): RoundResult {
  if (bets.length === 0) {
    return { winners: [], topPoints: 0, participants: 0, totalCollected: 0, perWinner: 0, cota };
  }
  const topPoints = Math.max(...bets.map((b) => b.points));
  const winners = bets.filter((b) => b.points === topPoints);
  const losers = bets.length - winners.length;
  const totalCollected = cota * losers;
  const perWinner = winners.length > 0 ? totalCollected / winners.length : 0;
  return {
    winners: winners.map((w) => ({ uid: w.uid, userName: w.userName, pixKey: w.pixKey })),
    topPoints,
    participants: bets.length,
    totalCollected,
    perWinner,
    cota,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/round.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/round.ts tests/round.test.ts
git commit -m "feat: função pura de premiação por rodada (vencedores + rateio)"
```

---

### Task 4: Inicialização do Firebase (Admin + Client)

**Files:**
- Create: `src/lib/firebaseAdmin.ts`, `src/lib/firebaseClient.ts`

**Interfaces:**
- Produces:
  - `firebaseAdmin.ts`: `adminDb: Firestore`, `adminAuth: Auth`, `Timestamp` (re-export).
  - `firebaseClient.ts`: `firebaseApp`, `auth`, `googleProvider` (consumidos no Plano 2).

> Não há teste unitário aqui (é I/O de infra). A verificação é o `build` compilar. As rotas que dependem disso são testadas com o fake da Task 6.

- [ ] **Step 1: Admin SDK singleton** — `src/lib/firebaseAdmin.ts`

```ts
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

// Init LAZY (via Proxy): apenas importar este módulo não tem efeito colateral,
// então build e testes não precisam de credenciais reais. A inicialização
// acontece no primeiro uso (tempo de request).
let cachedApp: App | undefined;
function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  cachedApp = existing.length
    ? existing[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          // a private key vem com \n escapados nas env vars
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
  return cachedApp;
}

let cachedDb: Firestore | undefined;
let cachedAuth: Auth | undefined;
function db(): Firestore { return (cachedDb ??= getFirestore(getAdminApp())); }
function authImpl(): Auth { return (cachedAuth ??= getAuth(getAdminApp())); }

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_t, prop) {
    const real = db() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_t, prop) {
    const real = authImpl() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
export { Timestamp };
```

- [ ] **Step 2: Client SDK** — `src/lib/firebaseClient.ts`

```ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
```

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebaseAdmin.ts src/lib/firebaseClient.ts
git commit -m "feat: inicialização do Firebase Admin e Client SDK"
```

---

### Task 5: Auth helpers (`auth.ts`)

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/api-helpers.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `adminAuth` de `@/lib/firebaseAdmin`.
- Produces:
  - `class HttpError extends Error { status: number }`
  - `isAdminEmail(email: string): boolean`
  - `requireUser(req: Request): Promise<{ uid: string; email: string; name: string; picture: string }>`
  - `requireAdmin(req: Request): Promise<{ uid; email; name; picture }>`
  - `jsonError(e: unknown): Response` (em `api-helpers.ts`)

- [ ] **Step 1: Teste que falha (foco no `isAdminEmail`, que é puro)** — `tests/auth.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('isAdminEmail', () => {
  beforeEach(() => { process.env.ADMIN_EMAILS = 'a@x.com, B@X.com'; });

  it('reconhece e-mail admin (case-insensitive)', async () => {
    const { isAdminEmail } = await import('@/lib/auth');
    expect(isAdminEmail('A@X.com')).toBe(true);
    expect(isAdminEmail('b@x.com')).toBe(true);
  });

  it('nega e-mail fora da lista', async () => {
    const { isAdminEmail } = await import('@/lib/auth');
    expect(isAdminEmail('outro@x.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL — import não resolvido.

- [ ] **Step 3: Implementar** — `src/lib/auth.ts`

```ts
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
```

- [ ] **Step 4: Implementar helper de resposta de erro** — `src/lib/api-helpers.ts`

```ts
import { NextResponse } from 'next/server';
import { HttpError } from '@/lib/auth';

export function jsonError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/auth.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/api-helpers.ts tests/auth.test.ts
git commit -m "feat: auth helpers (requireUser/requireAdmin/isAdminEmail) e jsonError"
```

---

### Task 6: Fake do Firebase Admin + rota `/api/me`

**Files:**
- Create: `tests/helpers/mockAdmin.ts`, `src/app/api/me/route.ts`
- Test: `tests/api/me.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `adminDb`.
- Produces (fake reutilizado por todas as tasks de API):
  - `mockAdmin.ts` exporta `installAdminMock({ users?, matches? })` que faz `vi.mock('@/lib/firebaseAdmin', ...)` e devolve handles para inspecionar dados, e `bearer(uid, email, name)` para montar o header.
  - Rota `GET /api/me` → perfil (cria doc no 1º acesso, marcando `isAdmin` via `isAdminEmail`).
  - Rota `PUT /api/me` → atualiza `name` e `pixKey`.

- [ ] **Step 1: Escrever o fake do Admin SDK** — `tests/helpers/mockAdmin.ts`

```ts
import { vi } from 'vitest';

type Doc = Record<string, unknown>;
interface Store { users: Map<string, Doc>; matches: Map<string, Doc>; bets: Map<string, Map<string, Doc>>; }

export function makeStore(): Store {
  return { users: new Map(), matches: new Map(), bets: new Map() };
}

/** Fake mínimo da API encadeada do Firestore usada pelas rotas. */
function makeFirestore(store: Store) {
  const docRef = (col: 'users' | 'matches', id: string) => ({
    async get() {
      const data = store[col].get(id);
      return { exists: !!data, id, data: () => data };
    },
    async set(data: Doc, opts?: { merge?: boolean }) {
      const prev = opts?.merge ? store[col].get(id) ?? {} : {};
      store[col].set(id, { ...prev, ...data });
    },
    async update(data: Doc) {
      store[col].set(id, { ...(store[col].get(id) ?? {}), ...data });
    },
    collection(sub: 'bets') {
      if (!store.bets.has(id)) store.bets.set(id, new Map());
      const sub2 = store.bets.get(id)!;
      return {
        doc: (betId: string) => ({
          async get() { const d = sub2.get(betId); return { exists: !!d, id: betId, data: () => d }; },
          async set(data: Doc, opts?: { merge?: boolean }) {
            const prev = opts?.merge ? sub2.get(betId) ?? {} : {};
            sub2.set(betId, { ...prev, ...data });
          },
        }),
        async get() {
          return { docs: [...sub2.entries()].map(([bid, d]) => ({ id: bid, data: () => d })) };
        },
      };
    },
  });

  const collection = (col: 'users' | 'matches') => ({
    doc: (id: string) => docRef(col, id),
    async get() {
      return { docs: [...store[col].entries()].map(([id, d]) => ({ id, data: () => d })) };
    },
    async add(data: Doc) {
      const id = `gen-${store[col].size + 1}`;
      store[col].set(id, data);
      return { id };
    },
  });

  return { collection } as const;
}

export interface MockHandles {
  store: Store;
  verifyIdToken: ReturnType<typeof vi.fn>;
}

/** Chame ANTES de importar a rota (vi.mock é hoisted). Retorna handles. */
export function installAdminMock(): MockHandles {
  const store = makeStore();
  const verifyIdToken = vi.fn();
  vi.doMock('@/lib/firebaseAdmin', () => ({
    adminDb: makeFirestore(store),
    adminAuth: { verifyIdToken },
    Timestamp: {
      fromMillis: (ms: number) => ({ toMillis: () => ms, _ms: ms }),
      now: () => ({ toMillis: () => 0, _ms: 0 }),
    },
  }));
  return { store, verifyIdToken };
}

/** Header Authorization e resposta padrão do verifyIdToken. */
export function asUser(h: MockHandles, uid: string, email: string, name = uid) {
  h.verifyIdToken.mockResolvedValue({ uid, email, name, picture: '' });
  return { Authorization: `Bearer fake-${uid}` };
}
```

- [ ] **Step 2: Escrever o teste que falha** — `tests/api/me.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = 'admin@x.com';
  h = installAdminMock();
});

async function loadRoute() {
  return import('@/app/api/me/route');
}

describe('GET /api/me', () => {
  it('cria o perfil no primeiro acesso e marca isAdmin', async () => {
    const headers = asUser(h, 'u1', 'admin@x.com', 'Jean');
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://t/api/me', { headers }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.uid).toBe('u1');
    expect(body.isAdmin).toBe(true);
    expect(body.pixKey).toBe('');
    expect(h.store.users.get('u1')).toBeTruthy();
  });

  it('401 sem token', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request('http://t/api/me'));
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/me', () => {
  it('atualiza nome e pixKey', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { PUT } = await loadRoute();
    const res = await PUT(new Request('http://t/api/me', {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jean S', pixKey: 'jean@pix' }),
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pixKey).toBe('jean@pix');
    expect(h.store.users.get('u1')!.pixKey).toBe('jean@pix');
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/me.test.ts`
Expected: FAIL — `@/app/api/me/route` não existe.

- [ ] **Step 4: Implementar a rota** — `src/app/api/me/route.ts`

```ts
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
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/me.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/mockAdmin.ts src/app/api/me/route.ts tests/api/me.test.ts
git commit -m "feat: rota /api/me (perfil + pix) e fake do Firestore para testes"
```

---

### Task 7: Rota `/api/matches` (listar jogos + palpite do usuário)

**Files:**
- Create: `src/app/api/matches/route.ts`
- Modify: `src/lib/api-helpers.ts` (adicionar `toMatchDTO`)
- Test: `tests/api/matches.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `adminDb`, `MatchDTO`, `BetDTO`.
- Produces:
  - `toMatchDTO(id: string, data: Record<string, unknown>): MatchDTO` em `api-helpers.ts`.
  - `GET /api/matches` → `{ matches: Array<MatchDTO & { myBet: BetDTO | null }> }`, ordenado por `kickoffAt` asc.

- [ ] **Step 1: Adicionar `toMatchDTO`** — editar `src/lib/api-helpers.ts` (acrescentar ao final)

```ts
import type { MatchDTO } from '@/lib/types';

interface TsLike { toMillis: () => number }
function toMillis(v: unknown): number {
  if (v && typeof (v as TsLike).toMillis === 'function') return (v as TsLike).toMillis();
  if (typeof v === 'number') return v;
  return 0;
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
```

- [ ] **Step 2: Escrever o teste que falha** — `tests/api/matches.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
  h.store.matches.set('m1', {
    homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪',
    competition: 'Eliminatórias', kickoffAt: 2000, cota: 10, status: 'scheduled',
    homeScore: null, awayScore: null,
  });
  h.store.matches.set('m2', {
    homeTeam: 'Brasil', awayTeam: 'Japão', homeFlag: '🇧🇷', awayFlag: '🇯🇵',
    competition: 'Amistoso', kickoffAt: 1000, cota: 20, status: 'scheduled',
    homeScore: null, awayScore: null,
  });
  h.store.bets.set('m1', new Map([['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }]]));
});

describe('GET /api/matches', () => {
  it('lista jogos ordenados por kickoff e inclui meu palpite', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/matches/route');
    const res = await GET(new Request('http://t/api/matches', { headers }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.matches.map((m: any) => m.id)).toEqual(['m2', 'm1']); // 1000 antes de 2000
    const m1 = body.matches.find((m: any) => m.id === 'm1');
    expect(m1.myBet.homeGuess).toBe(2);
    const m2 = body.matches.find((m: any) => m.id === 'm2');
    expect(m2.myBet).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/matches.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 4: Implementar** — `src/app/api/matches/route.ts`

```ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/auth';
import { jsonError, toMatchDTO } from '@/lib/api-helpers';
import type { BetDTO } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const u = await requireUser(req);
    const snap = await adminDb.collection('matches').get();
    const matches = await Promise.all(
      snap.docs.map(async (doc) => {
        const dto = toMatchDTO(doc.id, doc.data() as Record<string, unknown>);
        const betSnap = await adminDb.collection('matches').doc(doc.id).collection('bets').doc(u.uid).get();
        const myBet: BetDTO | null = betSnap.exists ? (betSnap.data() as BetDTO) : null;
        return { ...dto, myBet };
      }),
    );
    matches.sort((a, b) => a.kickoffAt - b.kickoffAt);
    return NextResponse.json({ matches });
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/matches.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/matches/route.ts src/lib/api-helpers.ts tests/api/matches.test.ts
git commit -m "feat: rota GET /api/matches (lista + palpite do usuário)"
```

---

### Task 8: Rota `/api/matches/[id]/bet` (criar/editar palpite com trava)

**Files:**
- Create: `src/app/api/matches/[id]/bet/route.ts`
- Test: `tests/api/bet.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `adminDb`, `Timestamp`.
- Produces: `POST /api/matches/[id]/bet`. Body `{ homeGuess: number, awayGuess: number }`. Regras:
  - 401 sem token; 404 se o jogo não existe; 400 se placar inválido (não inteiro ≥ 0);
  - 403 se o usuário não tem `pixKey`; 409 se `agora >= kickoffAt`.
  - Sucesso: grava/atualiza `bets/{uid}` com `userName`, `points: null`. Assinatura do handler: `POST(req, ctx: { params: Promise<{ id: string }> })`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/api/bet.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
const NOW = 5000;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
  h.store.users.set('u1', { uid: 'u1', name: 'Jean', email: 'jean@x.com', pixKey: 'jean@pix', isAdmin: false, photoURL: '' });
  h.store.users.set('u2', { uid: 'u2', name: 'Sem Pix', email: 's@x.com', pixKey: '', isAdmin: false, photoURL: '' });
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function openMatch() {
  h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW + 1000, cota: 10, status: 'scheduled' });
}
function closedMatch() {
  h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW - 1, cota: 10, status: 'scheduled' });
}
const post = (headers: Record<string, string>, body: unknown) =>
  new Request('http://t/api/matches/m1/bet', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/matches/[id]/bet', () => {
  it('grava palpite antes do horário', async () => {
    openMatch();
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 2, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(200);
    expect(h.store.bets.get('m1')!.get('u1')).toMatchObject({ homeGuess: 2, awayGuess: 1, points: null, userName: 'Jean' });
  });

  it('409 depois do horário (trava)', async () => {
    closedMatch();
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 2, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(409);
  });

  it('403 sem pixKey', async () => {
    openMatch();
    const headers = asUser(h, 'u2', 's@x.com', 'Sem Pix');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 1, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(403);
  });

  it('400 placar inválido', async () => {
    openMatch();
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: -1, awayGuess: 1 }), ctx('m1'));
    expect(res.status).toBe(400);
  });

  it('404 jogo inexistente', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/matches/[id]/bet/route');
    const res = await POST(post(headers, { homeGuess: 1, awayGuess: 1 }), ctx('xx'));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/bet.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/api/matches/[id]/bet/route.ts`

```ts
import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireUser, HttpError } from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';
import type { UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99;
}

interface TsLike { toMillis: () => number }
function ms(v: unknown): number {
  if (v && typeof (v as TsLike).toMillis === 'function') return (v as TsLike).toMillis();
  return typeof v === 'number' ? v : 0;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireUser(req);

    const userSnap = await adminDb.collection('users').doc(u.uid).get();
    const profile = userSnap.exists ? (userSnap.data() as UserProfile) : null;
    if (!profile?.pixKey) throw new HttpError(403, 'Cadastre sua chave Pix antes de palpitar');

    const matchSnap = await adminDb.collection('matches').doc(id).get();
    if (!matchSnap.exists) throw new HttpError(404, 'Jogo não encontrado');
    const match = matchSnap.data() as Record<string, unknown>;

    if (Date.now() >= ms(match.kickoffAt)) throw new HttpError(409, 'Palpites encerrados para este jogo');

    const body = await req.json();
    if (!isValidScore(body.homeGuess) || !isValidScore(body.awayGuess)) {
      return NextResponse.json({ error: 'Placar inválido' }, { status: 400 });
    }

    await adminDb.collection('matches').doc(id).collection('bets').doc(u.uid).set(
      {
        uid: u.uid,
        userName: profile.name || u.name,
        homeGuess: body.homeGuess,
        awayGuess: body.awayGuess,
        points: null,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, homeGuess: body.homeGuess, awayGuess: body.awayGuess });
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/bet.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/matches/[id]/bet/route.ts" tests/api/bet.test.ts
git commit -m "feat: rota POST /api/matches/[id]/bet (trava por horário + exige pix)"
```

---

### Task 9: Rota `/api/matches/[id]` (detalhe com palpites e vencedor)

**Files:**
- Create: `src/app/api/matches/[id]/route.ts`
- Test: `tests/api/match-detail.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `adminDb`, `toMatchDTO`, `resolveRound`.
- Produces: `GET /api/matches/[id]` → `{ match: MatchDTO, bets: BetDTO[], round: RoundResult | null }`.
  - Palpites de terceiros só aparecem se `agora >= kickoffAt` (antes disso, retorna só o próprio).
  - `round` preenchido só quando `status === 'finished'`. Assinatura: `GET(req, ctx: { params: Promise<{ id: string }> })`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/api/match-detail.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
const NOW = 5000;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
});

describe('GET /api/matches/[id]', () => {
  it('antes da trava, só mostra o próprio palpite', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW + 1000, cota: 10, status: 'scheduled', homeScore: null, awayScore: null });
    h.store.bets.set('m1', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }],
      ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 1, points: null }],
    ]));
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.bets.map((b: any) => b.uid)).toEqual(['u1']);
    expect(body.round).toBeNull();
  });

  it('jogo encerrado mostra todos os palpites e o vencedor', async () => {
    h.store.matches.set('m1', { homeTeam: 'Brasil', awayTeam: 'Peru', kickoffAt: NOW - 1000, cota: 10, status: 'finished', homeScore: 2, awayScore: 0 });
    h.store.users.set('u1', { uid: 'u1', name: 'Jean', pixKey: 'jean@pix', email: '', isAdmin: false, photoURL: '' });
    h.store.users.set('u2', { uid: 'u2', name: 'Bia', pixKey: 'bia@pix', email: '', isAdmin: false, photoURL: '' });
    h.store.bets.set('m1', new Map([
      ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: 3 }],
      ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: 1 }],
    ]));
    const headers = asUser(h, 'u2', 'bia@x.com', 'Bia');
    const { GET } = await import('@/app/api/matches/[id]/route');
    const res = await GET(new Request('http://t/api/matches/m1', { headers }), ctx('m1'));
    const body = await res.json();
    expect(body.bets.length).toBe(2);
    expect(body.round.winners.map((w: any) => w.uid)).toEqual(['u1']);
    expect(body.round.totalCollected).toBe(10);
    expect(body.round.winners[0].pixKey).toBe('jean@pix');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/match-detail.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/api/matches/[id]/route.ts`

```ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/auth';
import { jsonError, toMatchDTO } from '@/lib/api-helpers';
import { resolveRound, type ScoredBet } from '@/lib/round';
import type { BetDTO, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

interface TsLike { toMillis: () => number }
function ms(v: unknown): number {
  if (v && typeof (v as TsLike).toMillis === 'function') return (v as TsLike).toMillis();
  return typeof v === 'number' ? v : 0;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const u = await requireUser(req);

    const matchSnap = await adminDb.collection('matches').doc(id).get();
    if (!matchSnap.exists) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 });
    const matchData = matchSnap.data() as Record<string, unknown>;
    const dto = toMatchDTO(id, matchData);

    const betsSnap = await adminDb.collection('matches').doc(id).collection('bets').get();
    const allBets = betsSnap.docs.map((d) => d.data() as BetDTO);

    const locked = Date.now() >= ms(matchData.kickoffAt);
    const bets = locked ? allBets : allBets.filter((b) => b.uid === u.uid);

    let round = null;
    if (dto.status === 'finished') {
      const scored: ScoredBet[] = [];
      for (const b of allBets) {
        const userSnap = await adminDb.collection('users').doc(b.uid).get();
        const pixKey = userSnap.exists ? (userSnap.data() as UserProfile).pixKey : '';
        scored.push({ uid: b.uid, userName: b.userName, pixKey, points: b.points ?? 0 });
      }
      round = resolveRound(scored, dto.cota);
    }

    return NextResponse.json({ match: dto, bets, round });
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/match-detail.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/matches/[id]/route.ts" tests/api/match-detail.test.ts
git commit -m "feat: rota GET /api/matches/[id] (detalhe + vencedor da rodada)"
```

---

### Task 10: Rota `/api/ranking` (ranking geral)

**Files:**
- Create: `src/app/api/ranking/route.ts`
- Test: `tests/api/ranking.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `adminDb`.
- Produces: `GET /api/ranking` → `{ ranking: Array<{ uid: string; name: string; totalPoints: number; roundsWon: number }> }`, ordenado por `totalPoints` desc, depois `roundsWon` desc. Só considera jogos `finished`.

- [ ] **Step 1: Escrever o teste que falha** — `tests/api/ranking.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = '';
  h = installAdminMock();
  h.store.matches.set('m1', { status: 'finished', cota: 10, kickoffAt: 1 });
  h.store.matches.set('m2', { status: 'finished', cota: 10, kickoffAt: 2 });
  h.store.matches.set('m3', { status: 'scheduled', cota: 10, kickoffAt: 9 }); // ignorado
  h.store.bets.set('m1', new Map([
    ['u1', { uid: 'u1', userName: 'Jean', points: 3 }],
    ['u2', { uid: 'u2', userName: 'Bia', points: 1 }],
  ]));
  h.store.bets.set('m2', new Map([
    ['u1', { uid: 'u1', userName: 'Jean', points: 1 }],
    ['u2', { uid: 'u2', userName: 'Bia', points: 3 }],
  ]));
  h.store.bets.set('m3', new Map([['u1', { uid: 'u1', userName: 'Jean', points: null }]]));
});

describe('GET /api/ranking', () => {
  it('soma pontos e conta rodadas vencidas, ignorando jogos não finalizados', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { GET } = await import('@/app/api/ranking/route');
    const res = await GET(new Request('http://t/api/ranking', { headers }));
    const body = await res.json();
    expect(res.status).toBe(200);
    // Jean: 3+1=4, venceu m1. Bia: 1+3=4, venceu m2. Empate em pontos -> ordem estável por roundsWon (igual=1) -> ambos 4 pts, 1 vitória
    const byUid = Object.fromEntries(body.ranking.map((r: any) => [r.uid, r]));
    expect(byUid['u1'].totalPoints).toBe(4);
    expect(byUid['u2'].totalPoints).toBe(4);
    expect(byUid['u1'].roundsWon).toBe(1);
    expect(byUid['u2'].roundsWon).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/ranking.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/api/ranking/route.ts`

```ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';
import { resolveRound, type ScoredBet } from '@/lib/round';

export const runtime = 'nodejs';

interface Row { uid: string; name: string; totalPoints: number; roundsWon: number }

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const matchesSnap = await adminDb.collection('matches').get();
    const rows = new Map<string, Row>();

    for (const matchDoc of matchesSnap.docs) {
      const m = matchDoc.data() as Record<string, unknown>;
      if (m.status !== 'finished') continue;
      const betsSnap = await adminDb.collection('matches').doc(matchDoc.id).collection('bets').get();
      const scored: ScoredBet[] = betsSnap.docs.map((d) => {
        const b = d.data() as { uid: string; userName: string; points: number | null };
        const row = rows.get(b.uid) ?? { uid: b.uid, name: b.userName, totalPoints: 0, roundsWon: 0 };
        row.totalPoints += b.points ?? 0;
        rows.set(b.uid, row);
        return { uid: b.uid, userName: b.userName, pixKey: '', points: b.points ?? 0 };
      });
      const result = resolveRound(scored, Number(m.cota ?? 0));
      for (const w of result.winners) {
        const row = rows.get(w.uid);
        if (row) row.roundsWon += 1;
      }
    }

    const ranking = [...rows.values()].sort(
      (a, b) => b.totalPoints - a.totalPoints || b.roundsWon - a.roundsWon,
    );
    return NextResponse.json({ ranking });
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/ranking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ranking/route.ts tests/api/ranking.test.ts
git commit -m "feat: rota GET /api/ranking (pontos totais + rodadas vencidas)"
```

---

### Task 11: Rotas de admin (criar/editar jogo + lançar placar)

**Files:**
- Create: `src/app/api/admin/matches/route.ts`, `src/app/api/admin/matches/[id]/route.ts`, `src/app/api/admin/matches/[id]/result/route.ts`
- Test: `tests/api/admin.test.ts`, `tests/api/result.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `adminDb`, `Timestamp`, `scoreBet`.
- Produces:
  - `POST /api/admin/matches` — body `{ homeTeam, awayTeam, homeFlag, awayFlag, competition, kickoffAt(ms), cota }` → cria jogo `scheduled`. Retorna `{ id }`.
  - `PUT /api/admin/matches/[id]` — edita campos do jogo enquanto `scheduled`.
  - `POST /api/admin/matches/[id]/result` — body `{ homeScore, awayScore }` → pontua todos os palpites (via `scoreBet`), grava `points` em cada bet, marca o jogo `finished`. 409 se já `finished`.
  - Não-admin recebe 403 em todas.

- [ ] **Step 1: Teste que falha — criação e permissão** — `tests/api/admin.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installAdminMock, asUser, type MockHandles } from '../helpers/mockAdmin';

let h: MockHandles;
beforeEach(() => {
  vi.resetModules();
  process.env.ADMIN_EMAILS = 'admin@x.com';
  h = installAdminMock();
});

const body = (headers: Record<string, string>, data: unknown) =>
  new Request('http://t/api/admin/matches', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/admin/matches', () => {
  it('admin cria jogo', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/route');
    const res = await POST(body(headers, {
      homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪',
      competition: 'Eliminatórias', kickoffAt: 123456, cota: 10,
    }));
    const out = await res.json();
    expect(res.status).toBe(200);
    expect(out.id).toBeTruthy();
    expect(h.store.matches.get(out.id)).toMatchObject({ homeTeam: 'Brasil', status: 'scheduled', cota: 10 });
  });

  it('não-admin recebe 403', async () => {
    const headers = asUser(h, 'u1', 'jean@x.com', 'Jean');
    const { POST } = await import('@/app/api/admin/matches/route');
    const res = await POST(body(headers, { homeTeam: 'X', awayTeam: 'Y', kickoffAt: 1, cota: 1 }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Teste que falha — lançar placar e pontuar** — `tests/api/result.test.ts`

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
  h.store.bets.set('m1', new Map([
    ['u1', { uid: 'u1', userName: 'Jean', homeGuess: 2, awayGuess: 0, points: null }], // exato -> 3
    ['u2', { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: null }],  // só resultado -> 1
    ['u3', { uid: 'u3', userName: 'Léo', homeGuess: 0, awayGuess: 2, points: null }],  // errou -> 0
  ]));
});

const send = (headers: Record<string, string>, data: unknown) =>
  new Request('http://t/api/admin/matches/m1/result', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/admin/matches/[id]/result', () => {
  it('pontua todos e marca finished', async () => {
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/result/route');
    const res = await POST(send(headers, { homeScore: 2, awayScore: 0 }), ctx('m1'));
    expect(res.status).toBe(200);
    const bets = h.store.bets.get('m1')!;
    expect(bets.get('u1')!.points).toBe(3);
    expect(bets.get('u2')!.points).toBe(1);
    expect(bets.get('u3')!.points).toBe(0);
    expect(h.store.matches.get('m1')!.status).toBe('finished');
    expect(h.store.matches.get('m1')!.homeScore).toBe(2);
  });

  it('409 se já finalizado', async () => {
    h.store.matches.get('m1')!.status = 'finished';
    const headers = asUser(h, 'a1', 'admin@x.com', 'Admin');
    const { POST } = await import('@/app/api/admin/matches/[id]/result/route');
    const res = await POST(send(headers, { homeScore: 1, awayScore: 1 }), ctx('m1'));
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falham**

Run: `npx vitest run tests/api/admin.test.ts tests/api/result.test.ts`
Expected: FAIL — rotas não existem.

- [ ] **Step 4: Implementar criação** — `src/app/api/admin/matches/route.ts`

```ts
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
```

- [ ] **Step 5: Implementar edição** — `src/app/api/admin/matches/[id]/route.ts`

```ts
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
```

> Nota: `DELETE` faz soft-delete (`status: 'deleted'`) por simplicidade do fake; o filtro de listagem do Plano 2 ignora `status === 'deleted'`. Se preferir remoção física, troque por exclusão real ao integrar com o Firestore real.

- [ ] **Step 6: Implementar lançamento de placar** — `src/app/api/admin/matches/[id]/result/route.ts`

```ts
import { NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebaseAdmin';
import { requireAdmin, HttpError } from '@/lib/auth';
import { jsonError } from '@/lib/api-helpers';
import { scoreBet } from '@/lib/scoring';

export const runtime = 'nodejs';

function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await requireAdmin(req);

    const b = await req.json();
    if (!isValidScore(b.homeScore) || !isValidScore(b.awayScore)) {
      return NextResponse.json({ error: 'Placar inválido' }, { status: 400 });
    }

    const matchRef = adminDb.collection('matches').doc(id);
    const snap = await matchRef.get();
    if (!snap.exists) throw new HttpError(404, 'Jogo não encontrado');
    if ((snap.data() as { status: string }).status === 'finished') {
      throw new HttpError(409, 'Jogo já finalizado');
    }

    const betsSnap = await matchRef.collection('bets').get();
    for (const betDoc of betsSnap.docs) {
      const bet = betDoc.data() as { homeGuess: number; awayGuess: number };
      const points = scoreBet(bet.homeGuess, bet.awayGuess, b.homeScore, b.awayScore);
      await matchRef.collection('bets').doc(betDoc.id).set({ points }, { merge: true });
    }

    await matchRef.update({
      status: 'finished',
      homeScore: b.homeScore,
      awayScore: b.awayScore,
      finishedAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true, scored: betsSnap.docs.length });
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 7: Rodar e confirmar que passam**

Run: `npx vitest run tests/api/admin.test.ts tests/api/result.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm run test`
Expected: PASS — todos os arquivos de teste verdes.

- [ ] **Step 9: Verificar build de produção**

Run: `npm run build`
Expected: build conclui; rotas de API aparecem na listagem.

- [ ] **Step 10: Commit**

```bash
git add "src/app/api/admin" tests/api/admin.test.ts tests/api/result.test.ts
git commit -m "feat: rotas de admin (criar/editar jogo + lançar placar e pontuar)"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** pontuação 3/1/0 (Task 2) ✓ · premiação e empate (Task 3) ✓ · trava por horário (Task 8) ✓ · exige Pix (Task 8) ✓ · admin via ADMIN_EMAILS (Task 5, 11) ✓ · perfil/Pix (Task 6) ✓ · listagem/detalhe/ranking (Tasks 7, 9, 10) ✓ · visibilidade de palpites pós-trava (Task 9) ✓ · lançar placar pontua todos (Task 11) ✓. **Frontend (telas) e Deploy (Docker/Nginx) ficam nos Planos 2 e 3.**
- **Placeholders:** nenhum — todo passo de código mostra o código completo.
- **Consistência de tipos:** `MatchDTO`/`BetDTO`/`UserProfile` definidos na Task 1; `ScoredBet`/`RoundResult` na Task 3; `toMatchDTO`/`jsonError` em `api-helpers.ts`; assinatura `ctx: { params: Promise<{ id: string }> }` usada uniformemente (Next 15).

## Dependências para o Plano 2 (Frontend)
- Endpoints e formatos de resposta definidos nas Tasks 6–11.
- `firebaseClient.ts` (`auth`, `googleProvider`) da Task 4.
- Paleta Tailwind (`verde.escuro`, `verde`, `amarelo`) da Task 1.
- `public/bg_login.webp` para a tela de login.
```
