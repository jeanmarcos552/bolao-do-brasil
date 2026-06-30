# Bolão da Seleção — Plano 2: Frontend (telas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir as 7 telas do bolão (login, jogos, detalhe, ranking, conta, admin) no visual verde estilo Globo Esporte, consumindo a API do Plano 1 via Firebase Auth (Google).

**Architecture:** Next.js App Router com componentes de cliente. Um `AuthProvider` (React context) gerencia o login Google do Firebase, expõe o perfil (`/api/me`) e um método `call()` que injeta o ID token nas chamadas à API. Toda comunicação com o backend passa por um cliente tipado (`lib/apiClient.ts`); o navegador nunca fala direto com o Firestore. As páginas são protegidas por um hook de guarda que redireciona para `/login` (sem sessão) ou `/conta` (sem chave Pix).

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS, Firebase Auth (Google), Vitest + React Testing Library (jsdom).

## Global Constraints

- TypeScript `strict`. Componentes que usam hooks/contexto começam com `'use client'`.
- **Pinar `@types/react` e `@types/react-dom` em `^18`** (resolveram v19 com react@18 no Plano 1).
- Paleta (já no `tailwind.config.ts`): `verde.escuro #00501f` (barra de título), `verde #009c3b` (abas/botões/detalhes), `verde.claro #eafaef`, `amarelo #ffdf00` (destaques). Fundo `#f0f0f0`, cards brancos. Visual = portal esportivo (Globo Esporte).
- **Toda chamada à API anexa o ID token do Firebase** em `Authorization: Bearer <token>`. O token é obtido por requisição via `user.getIdToken()` (auto-renova).
- O cliente **nunca** lê/escreve no Firestore direto — só via as rotas `/api/*`.
- Dinheiro é **somente exibição**: mostra a chave Pix do vencedor e o valor; o app nunca movimenta dinheiro.
- Fundo do login: `public/bg_login.webp` (animação do Paquetá).
- Datas da API são epoch ms (number). Formatação de data/hora usa timezone `America/Sao_Paulo`.
- Login Google via **popup** (`signInWithPopup`).
- Test runner: **Vitest**. Componentes/handlers testáveis começam pelo teste que falha (TDD). Testes de UI usam `// @vitest-environment jsdom`.

## Formas de resposta da API (do Plano 1 — para referência)

```ts
// GET /api/me  e  PUT /api/me (body {name, pixKey})  -> UserProfile
interface UserProfile { uid: string; name: string; email: string; photoURL: string; pixKey: string; isAdmin: boolean }
// GET /api/matches -> { matches: Array<MatchDTO & { myBet: BetDTO | null }> }  (ordenado por kickoffAt asc; sem deletados)
interface MatchDTO { id: string; homeTeam: string; awayTeam: string; homeFlag: string; awayFlag: string; competition: string; kickoffAt: number; cota: number; status: 'scheduled'|'finished'|'deleted'; homeScore: number|null; awayScore: number|null }
interface BetDTO { uid: string; userName: string; homeGuess: number; awayGuess: number; points: number|null }
// POST /api/matches/:id/bet (body {homeGuess, awayGuess}) -> { ok, homeGuess, awayGuess }  | erros 400/403/404/409
// GET /api/matches/:id -> { match: MatchDTO; bets: BetDTO[]; round: RoundResult | null }
interface RoundResult { winners: Array<{uid:string; userName:string; pixKey:string}>; topPoints:number; participants:number; totalCollected:number; perWinner:number; cota:number }
// GET /api/ranking -> { ranking: Array<{ uid:string; name:string; totalPoints:number; roundsWon:number }> }
// Admin: POST /api/admin/matches (body {homeTeam,awayTeam,homeFlag,awayFlag,competition,kickoffAt(ms),cota}) -> {id}
//        PUT /api/admin/matches/:id ; DELETE /api/admin/matches/:id
//        POST /api/admin/matches/:id/result (body {homeScore, awayScore}) -> { ok, scored }
```

---

## File Structure (este plano cobre o frontend)

```
src/
  lib/
    format.ts          # formatBRL, formatKickoff, isLocked, outcomeLabel (puras)
    apiClient.ts       # apiFetch<T>(path, {method?, body?, token})
  context/
    AuthProvider.tsx   # contexto: user, profile, loading, signInGoogle, signOut, call(), refreshProfile
  hooks/
    useRequireProfile.ts # guarda: redireciona p/ /login (sem user) ou /conta (sem pix)
  components/
    Header.tsx         # barra verde + nav + link admin condicional + avatar/sair
    MatchCard.tsx      # card aberto (form de palpite, trava) e card encerrado (resultado + pontos + vencedor/pix)
    Loading.tsx        # estado de carregamento simples
  app/
    layout.tsx         # (modificar) envolve children no AuthProvider
    page.tsx           # (substituir) Home/Jogos
    login/page.tsx
    conta/page.tsx
    jogo/[id]/page.tsx
    ranking/page.tsx
    admin/page.tsx
vitest.setup.ts        # importa matchers do @testing-library/jest-dom
tests/
  format.test.ts
  apiClient.test.ts
  components/Header.test.tsx
  components/MatchCard.test.tsx
```

---

### Task 1: Setup do frontend + helpers puros

**Files:**
- Modify: `package.json` (deps + pin @types v18), `vitest.config.ts`
- Create: `vitest.setup.ts`, `src/lib/format.ts`, `src/lib/apiClient.ts`
- Test: `tests/format.test.ts`, `tests/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `formatBRL(value: number): string` — "R$ 10,00"
  - `formatKickoff(ms: number): string` — ex: "30/06 21:30" (timezone America/Sao_Paulo)
  - `isLocked(kickoffAtMs: number, now?: number): boolean` — `now >= kickoffAtMs`
  - `outcomeLabel(home: number, away: number): 'Vitória'|'Empate'|'Derrota'` (do ponto de vista do mandante)
  - `apiFetch<T>(path: string, opts?: { method?: string; body?: unknown; token?: string | null }): Promise<T>`

- [ ] **Step 1: Instalar deps de teste e pinar @types v18**

```bash
cd /c/Users/jeans/Documents/jean/bolao-brasil
npm install -D @testing-library/react@16 @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
npm install -D @types/react@^18 @types/react-dom@^18
```

- [ ] **Step 2: Setup do jsdom matchers** — `vitest.setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Atualizar `vitest.config.ts`** (manter node como padrão; testes de UI declaram jsdom por arquivo; registrar setup e incluir .tsx)

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 4: Teste que falha** — `tests/format.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { formatBRL, formatKickoff, isLocked, outcomeLabel } from '@/lib/format';

describe('formatBRL', () => {
  it('formata reais', () => expect(formatBRL(10)).toBe('R$ 10,00'));
  it('formata com centavos', () => expect(formatBRL(12.5)).toBe('R$ 12,50'));
});

describe('formatKickoff', () => {
  it('formata data/hora em America/Sao_Paulo', () => {
    // 2026-06-30T21:30:00-03:00 == 2026-07-01T00:30:00Z
    const ms = Date.UTC(2026, 6, 1, 0, 30, 0);
    expect(formatKickoff(ms)).toBe('30/06 21:30');
  });
});

describe('isLocked', () => {
  it('antes do horário: não travado', () => expect(isLocked(1000, 500)).toBe(false));
  it('no horário exato: travado', () => expect(isLocked(1000, 1000)).toBe(true));
  it('depois: travado', () => expect(isLocked(1000, 1500)).toBe(true));
});

describe('outcomeLabel', () => {
  it('vitória do mandante', () => expect(outcomeLabel(2, 1)).toBe('Vitória'));
  it('empate', () => expect(outcomeLabel(1, 1)).toBe('Empate'));
  it('derrota', () => expect(outcomeLabel(0, 2)).toBe('Derrota'));
});
```

- [ ] **Step 5: Rodar e confirmar que falha**

Run: `npx vitest run tests/format.test.ts`
Expected: FAIL — `@/lib/format` não existe.

- [ ] **Step 6: Implementar** — `src/lib/format.ts`

```ts
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function formatBRL(value: number): string {
  return brl.format(value);
}

const dt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
export function formatKickoff(ms: number): string {
  // pt-BR produz "30/06, 21:30"; normalizamos para "30/06 21:30"
  const parts = dt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}

export function isLocked(kickoffAtMs: number, now: number = Date.now()): boolean {
  return now >= kickoffAtMs;
}

export function outcomeLabel(home: number, away: number): 'Vitória' | 'Empate' | 'Derrota' {
  if (home > away) return 'Vitória';
  if (home < away) return 'Derrota';
  return 'Empate';
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npx vitest run tests/format.test.ts`
Expected: PASS (9 testes). Se `formatBRL` falhar pelo caractere de espaço, confirme que é o NBSP (` `) que o Intl usa em pt-BR — o teste já espera isso.

- [ ] **Step 8: Teste que falha** — `tests/apiClient.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '@/lib/apiClient';

beforeEach(() => { vi.restoreAllMocks(); });

describe('apiFetch', () => {
  it('anexa o Bearer token e parseia JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hi: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await apiFetch<{ hi: number }>('/api/x', { token: 'tkn' });
    expect(out.hi).toBe(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tkn');
  });

  it('serializa body e seta content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/x', { method: 'POST', body: { a: 1 }, token: 't' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('lança Error com a mensagem do servidor em status !ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Palpites encerrados' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/api/x', { token: 't' })).rejects.toThrow('Palpites encerrados');
  });
});
```

- [ ] **Step 9: Rodar e confirmar que falha**

Run: `npx vitest run tests/apiClient.test.ts`
Expected: FAIL — `@/lib/apiClient` não existe.

- [ ] **Step 10: Implementar** — `src/lib/apiClient.ts`

```ts
export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Erro ${res.status}`);
  }
  return data as T;
}
```

- [ ] **Step 11: Rodar suíte e confirmar que passa**

Run: `npm run test`
Expected: PASS — todos verdes (incluindo a suíte do backend do Plano 1).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(front): setup de teste (RTL/jsdom), pin @types v18, helpers format + apiClient"
```

---

### Task 2: AuthProvider (contexto de autenticação)

**Files:**
- Create: `src/context/AuthProvider.tsx`
- Test: `tests/context/AuthProvider.test.tsx`

**Interfaces:**
- Consumes: `auth`, `googleProvider` de `@/lib/firebaseClient`; `apiFetch` de `@/lib/apiClient`; `UserProfile` de `@/lib/types`.
- Produces: `useAuth()` retornando
  `{ user: User | null; profile: UserProfile | null; loading: boolean; signInGoogle(): Promise<void>; signOut(): Promise<void>; refreshProfile(): Promise<void>; call<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<T> }`
  e o componente `<AuthProvider>`.

- [ ] **Step 1: Teste que falha** — `tests/context/AuthProvider.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock do firebaseClient e do firebase/auth ANTES de importar o provider
const onAuthCbs: Array<(u: unknown) => void> = [];
vi.mock('@/lib/firebaseClient', () => ({
  auth: {},
  googleProvider: {},
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => { onAuthCbs.push(cb); return () => {}; },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

beforeEach(() => { onAuthCbs.length = 0; vi.restoreAllMocks(); });

import { AuthProvider, useAuth } from '@/context/AuthProvider';

function Probe() {
  const { user, profile, loading } = useAuth();
  return <div>{loading ? 'loading' : user ? `user:${profile?.name ?? '?'}` : 'anon'}</div>;
}

describe('AuthProvider', () => {
  it('começa carregando e vira anônimo quando não há usuário', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
    onAuthCbs[0](null); // dispara onAuthStateChanged com null
    await waitFor(() => expect(screen.getByText('anon')).toBeInTheDocument());
  });

  it('com usuário, busca o perfil via /api/me', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'Jean', pixKey: 'x', isAdmin: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthProvider><Probe /></AuthProvider>);
    onAuthCbs[0]({ uid: 'u1', getIdToken: async () => 'tok' });
    await waitFor(() => expect(screen.getByText('user:Jean')).toBeInTheDocument());
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/me');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/context/AuthProvider.test.tsx`
Expected: FAIL — `@/context/AuthProvider` não existe.

- [ ] **Step 3: Implementar** — `src/context/AuthProvider.tsx`

```tsx
'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebaseClient';
import { apiFetch } from '@/lib/apiClient';
import type { UserProfile } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  call: <T>(path: string, opts?: { method?: string; body?: unknown }) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const call = useCallback(async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
    const token = user ? await user.getIdToken() : null;
    return apiFetch<T>(path, { ...opts, token });
  }, [user]);

  const loadProfile = useCallback(async (u: User) => {
    const token = await u.getIdToken();
    const p = await apiFetch<UserProfile>('/api/me', { token });
    setProfile(p);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try { await loadProfile(u); } catch { setProfile(null); }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [loadProfile]);

  const signInGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInGoogle, signOut, refreshProfile, call }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/context/AuthProvider.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/context/AuthProvider.tsx tests/context/AuthProvider.test.tsx
git commit -m "feat(front): AuthProvider (login Google + perfil + call autenticado)"
```

---

### Task 3: App shell (layout + Header + guarda de rota)

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/Header.tsx`, `src/components/Loading.tsx`, `src/hooks/useRequireProfile.ts`
- Test: `tests/components/Header.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`.
- Produces:
  - `<Header active?: 'jogos'|'ranking'|'conta'|'admin'>` — barra verde com nav; link "Admin" só se `profile.isAdmin`; avatar com iniciais + botão sair.
  - `<Loading />`.
  - `useRequireProfile(): { ready: boolean; profile: UserProfile | null }` — redireciona p/ `/login` se sem user (após loading) e p/ `/conta` se `profile.pixKey` vazio (exceto já em `/conta`).

- [ ] **Step 1: Teste que falha** — `tests/components/Header.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
const authValue: { profile: unknown; signOut: () => void } = { profile: null, signOut: vi.fn() };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => authValue }));

import Header from '@/components/Header';

describe('Header', () => {
  it('não mostra link Admin para não-admin', () => {
    authValue.profile = { name: 'Jean', isAdmin: false };
    render(<Header />);
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getByText('Jogos')).toBeInTheDocument();
  });

  it('mostra link Admin para admin', () => {
    authValue.profile = { name: 'Jean', isAdmin: true };
    render(<Header />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/components/Header.test.tsx`
Expected: FAIL — `@/components/Header` não existe.

- [ ] **Step 3: Implementar `Loading`** — `src/components/Loading.tsx`

```tsx
export default function Loading() {
  return <div className="flex items-center justify-center min-h-[60vh] text-verde-escuro font-bold">Carregando…</div>;
}
```

- [ ] **Step 4: Implementar `Header`** — `src/components/Header.tsx`

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export default function Header() {
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const links: Array<{ href: string; label: string }> = [
    { href: '/', label: 'Jogos' },
    { href: '/ranking', label: 'Ranking' },
    { href: '/conta', label: 'Minha conta' },
  ];
  if (profile?.isAdmin) links.push({ href: '/admin', label: 'Admin' });

  return (
    <header>
      <div className="bg-verde-escuro text-white px-4 py-3 flex items-center justify-between">
        <div className="font-extrabold text-lg tracking-wide flex items-center gap-2">
          <span className="bg-amarelo text-verde-escuro rounded-full w-7 h-7 inline-flex items-center justify-center">⚽</span>
          BOLÃO DA SELEÇÃO
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-amarelo text-verde-escuro rounded-full w-8 h-8 inline-flex items-center justify-center font-bold text-xs">
            {initials(profile?.name ?? '')}
          </span>
          <button onClick={() => signOut()} className="text-xs underline opacity-90">Sair</button>
        </div>
      </div>
      <nav className="bg-verde flex gap-1 px-2">
        {links.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={`text-white text-sm font-semibold px-4 py-2.5 ${active ? 'shadow-[inset_0_-3px_0_#ffdf00] opacity-100' : 'opacity-85'}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/components/Header.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 6: Implementar guarda** — `src/hooks/useRequireProfile.ts`

```ts
'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import type { UserProfile } from '@/lib/types';

export function useRequireProfile(): { ready: boolean; profile: UserProfile | null } {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (profile && !profile.pixKey && path !== '/conta') { router.replace('/conta'); }
  }, [loading, user, profile, path, router]);

  const ready = !loading && !!user && !!profile && (!!profile.pixKey || path === '/conta');
  return { ready, profile };
}
```

- [ ] **Step 7: Modificar layout para envolver no AuthProvider** — `src/app/layout.tsx`

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthProvider';

export const metadata: Metadata = {
  title: 'Bolão da Seleção',
  description: 'Bolão dos próximos jogos da Seleção Brasileira',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Rodar suíte + build**

Run: `npm run test && npm run build`
Expected: testes verdes; build conclui (as páginas ainda são as antigas, ok).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(front): layout com AuthProvider, Header (admin condicional) e guarda useRequireProfile"
```

---

### Task 4: Tela de Login

**Files:**
- Create: `src/app/login/page.tsx`
- Test: `tests/app/login.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`user`, `loading`, `signInGoogle`).
- Produces: rota `/login`. Mostra fundo `bg_login.webp` + botão "Entrar com Google". Se já logado, redireciona p/ `/`.

- [ ] **Step 1: Teste que falha** — `tests/app/login.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: push, push }) }));
const authValue = { user: null as unknown, loading: false, signInGoogle: vi.fn() };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => authValue }));

import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('botão chama signInGoogle', async () => {
    authValue.user = null; authValue.loading = false;
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));
    expect(authValue.signInGoogle).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/app/login.test.tsx`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/login/page.tsx`

```tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';

export default function LoginPage() {
  const { user, loading, signInGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-verde-escuro relative overflow-hidden">
      <img src="/bg_login.webp" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="relative z-10 bg-white rounded-xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="text-3xl mb-2">⚽🇧🇷</div>
        <h1 className="text-2xl font-extrabold text-verde-escuro mb-1">Bolão da Seleção</h1>
        <p className="text-sm text-gray-500 mb-6">Palpite nos jogos do Brasil e dispute o ranking com a galera.</p>
        <button
          onClick={() => signInGoogle()}
          className="w-full bg-verde text-white font-bold py-3 rounded-md uppercase text-sm tracking-wide hover:brightness-95"
        >
          Entrar com Google
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/app/login.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx tests/app/login.test.tsx
git commit -m "feat(front): tela de login (Google + fundo Paquetá)"
```

---

### Task 5: Tela Minha Conta (cadastro/edição do Pix)

**Files:**
- Create: `src/app/conta/page.tsx`
- Test: `tests/app/conta.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`profile`, `loading`, `user`, `call`, `refreshProfile`), `useRequireProfile()`, `Header`, `Loading`.
- Produces: rota `/conta`. Form com nome e chave Pix; salva via `PUT /api/me`; mostra aviso se Pix ainda não cadastrado.

- [ ] **Step 1: Teste que falha** — `tests/app/conta.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/conta', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({ name: 'Jean', pixKey: 'jean@pix', isAdmin: false });
const refreshProfile = vi.fn();
const authValue = { user: { uid: 'u1' }, profile: { name: 'Jean', email: 'j@x.com', pixKey: '', isAdmin: false }, loading: false, call, refreshProfile };
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => authValue }));

import ContaPage from '@/app/conta/page';

describe('ContaPage', () => {
  it('salva nome e pix via PUT /api/me', async () => {
    render(<ContaPage />);
    const pix = screen.getByLabelText(/chave pix/i);
    await userEvent.clear(pix);
    await userEvent.type(pix, 'jean@pix');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(call).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'PUT' }));
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/app/conta.test.tsx`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/conta/page.tsx`

```tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';

export default function ContaPage() {
  const { profile, call, refreshProfile } = useAuth();
  const { ready } = useRequireProfile();
  const [name, setName] = useState(profile?.name ?? '');
  const [pixKey, setPixKey] = useState(profile?.pixKey ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ready && !profile) return <Loading />;

  async function save() {
    setSaving(true); setMsg(null); setErr(null);
    try {
      await call('/api/me', { method: 'PUT', body: { name, pixKey } });
      await refreshProfile();
      setMsg('Salvo!');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto p-4">
        <h1 className="text-verde-escuro font-extrabold text-xl mb-1">Minha conta</h1>
        {profile && !profile.pixKey && (
          <p className="bg-amarelo/30 border border-amarelo rounded p-2 text-sm mb-3">
            Cadastre sua chave Pix para poder palpitar.
          </p>
        )}
        <label className="block text-sm font-semibold mt-3" htmlFor="name">Nome</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full border rounded p-2 mt-1" />
        <label className="block text-sm font-semibold mt-3" htmlFor="pix">Chave Pix</label>
        <input id="pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)}
          placeholder="e-mail, telefone, CPF ou aleatória"
          className="w-full border rounded p-2 mt-1" />
        <button onClick={save} disabled={saving || !name.trim() || !pixKey.trim()}
          className="mt-4 w-full bg-verde text-white font-bold py-2.5 rounded uppercase text-sm disabled:opacity-50">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {msg && <p className="text-verde mt-2 text-sm">{msg}</p>}
        {err && <p className="text-red-600 mt-2 text-sm">{err}</p>}
      </main>
    </>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/app/conta.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/conta/page.tsx tests/app/conta.test.tsx
git commit -m "feat(front): tela Minha Conta (cadastro/edição de Pix)"
```

---

### Task 6: Home / Jogos + componente MatchCard

**Files:**
- Create: `src/components/MatchCard.tsx`, `src/app/page.tsx` (substituir o placeholder)
- Test: `tests/components/MatchCard.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`call`), `useRequireProfile()`, `Header`, `Loading`, helpers de `@/lib/format`, `MatchDTO`/`BetDTO`.
- Produces:
  - `<MatchCard match onSaved>` — se `status==='scheduled'` e não travado: form de palpite (2 inputs + "Salvar palpite"); se travado ou encerrado: mostra placar/seu palpite/pontos. Recebe `match: MatchDTO & { myBet: BetDTO | null }`.
  - Home: busca `GET /api/matches`, separa em "Próximos jogos" e "Encerrados".

- [ ] **Step 1: Teste que falha** — `tests/components/MatchCard.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const call = vi.fn().mockResolvedValue({ ok: true });
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));

import MatchCard from '@/components/MatchCard';

const base = {
  id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪',
  competition: 'Eliminatórias', cota: 10, homeScore: null as number | null, awayScore: null as number | null,
  myBet: null as null | { homeGuess: number; awayGuess: number; points: number | null },
};

describe('MatchCard', () => {
  it('jogo aberto mostra o formulário de palpite', () => {
    render(<MatchCard match={{ ...base, status: 'scheduled', kickoffAt: Date.now() + 3_600_000 }} onSaved={() => {}} />);
    expect(screen.getByRole('button', { name: /salvar palpite/i })).toBeInTheDocument();
  });

  it('jogo encerrado mostra o placar final e os pontos', () => {
    render(<MatchCard match={{ ...base, status: 'finished', kickoffAt: 1, homeScore: 3, awayScore: 0, myBet: { homeGuess: 2, awayGuess: 0, points: 1 } }} onSaved={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/\+1 ponto/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar palpite/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/components/MatchCard.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar `MatchCard`** — `src/components/MatchCard.tsx`

```tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { formatBRL, formatKickoff, isLocked } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: BetDTO | null };

function Team({ flag, name }: { flag: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-28">
      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-2xl">{flag}</div>
      <b className="text-sm text-center">{name}</b>
    </div>
  );
}

export default function MatchCard({ match, onSaved }: { match: MatchWithBet; onSaved: () => void }) {
  const { call } = useAuth();
  const locked = match.status === 'finished' || isLocked(match.kickoffAt);
  const [home, setHome] = useState(match.myBet ? String(match.myBet.homeGuess) : '');
  const [away, setAway] = useState(match.myBet ? String(match.myBet.awayGuess) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
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
        <span className="text-verde font-bold">Cota {formatBRL(match.cota)}</span>
      </div>

      <div className="flex items-center justify-center gap-3.5">
        <Team flag={match.homeFlag} name={match.homeTeam} />
        {match.status === 'finished' ? (
          <>
            <span className="text-3xl font-extrabold">{match.homeScore}</span>
            <span className="text-gray-400 font-bold text-sm">x</span>
            <span className="text-3xl font-extrabold">{match.awayScore}</span>
          </>
        ) : (
          <>
            <input aria-label="placar mandante" inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value)} disabled={locked}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
            <span className="text-gray-400 font-bold text-sm">x</span>
            <input aria-label="placar visitante" inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value)} disabled={locked}
              className="w-11 h-11 border-2 border-verde rounded text-center text-2xl font-extrabold disabled:bg-gray-100 disabled:border-gray-300" />
          </>
        )}
        <Team flag={match.awayFlag} name={match.awayTeam} />
      </div>

      {match.status !== 'finished' && !locked && (
        <>
          <button onClick={save} disabled={saving || home === '' || away === ''}
            className="mt-3 w-full bg-verde text-white font-extrabold py-2.5 rounded uppercase text-xs tracking-wide disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar palpite'}
          </button>
          <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Trava no apito inicial · {formatKickoff(match.kickoffAt)}</div>
        </>
      )}
      {match.status !== 'finished' && locked && (
        <div className="text-center text-[11px] text-gray-400 mt-2">🔒 Palpites encerrados {match.myBet ? `· seu palpite: ${match.myBet.homeGuess} x ${match.myBet.awayGuess}` : '· você não palpitou'}</div>
      )}
      {match.status === 'finished' && (
        <div className="text-center mt-2.5 text-xs text-gray-600">
          {match.myBet ? <>Seu palpite: <b>{match.myBet.homeGuess} x {match.myBet.awayGuess}</b> &nbsp;
            <span className="bg-verde-claro text-verde rounded px-2 py-0.5 font-bold">+{match.myBet.points} ponto{match.myBet.points === 1 ? '' : 's'}</span></>
            : 'Você não palpitou neste jogo'}
          <div className="mt-2"><a href={`/jogo/${match.id}`} className="text-verde underline text-xs">Ver palpites e vencedor →</a></div>
        </div>
      )}
      {err && <p className="text-red-600 text-xs mt-2 text-center">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/components/MatchCard.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Implementar Home** — `src/app/page.tsx` (substituir o conteúdo atual)

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import MatchCard from '@/components/MatchCard';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: BetDTO | null };

export default function Home() {
  const { call } = useAuth();
  const { ready } = useRequireProfile();
  const [matches, setMatches] = useState<MatchWithBet[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await call<{ matches: MatchWithBet[] }>('/api/matches');
      setMatches(data.matches);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [call]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (!ready || matches === null) return <Loading />;

  const proximos = matches.filter((m) => m.status === 'scheduled');
  const encerrados = matches.filter((m) => m.status === 'finished');

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto p-4">
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

        <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5">Próximos jogos</h2>
        {proximos.length === 0 && <p className="text-gray-500 text-sm mb-4">Nenhum jogo agendado.</p>}
        {proximos.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}

        <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2.5 mt-6">Encerrados</h2>
        {encerrados.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo encerrado ainda.</p>}
        {encerrados.map((m) => <MatchCard key={m.id} match={m} onSaved={load} />)}
      </main>
    </>
  );
}
```

- [ ] **Step 6: Rodar suíte e confirmar que passa**

Run: `npm run test`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(front): Home/Jogos + MatchCard (palpite com trava, resultado, pontos)"
```

---

### Task 7: Tela de Detalhe do Jogo

**Files:**
- Create: `src/app/jogo/[id]/page.tsx`
- Test: `tests/app/jogo.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`call`), `useRequireProfile()`, `useParams` de `next/navigation`, `Header`, `Loading`, helpers, `MatchDTO`/`BetDTO`/`RoundResult`.
- Produces: rota `/jogo/[id]`. Busca `GET /api/matches/:id`; lista os palpites com pontos; se encerrado, destaca vencedor(es) + chave Pix + valor por vencedor.

- [ ] **Step 1: Teste que falha** — `tests/app/jogo.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'm1' }), usePathname: () => '/jogo/m1', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({
  match: { id: 'm1', homeTeam: 'Brasil', awayTeam: 'Peru', homeFlag: '🇧🇷', awayFlag: '🇵🇪', competition: 'Eliminatórias', kickoffAt: 1, cota: 10, status: 'finished', homeScore: 3, awayScore: 0 },
  bets: [{ uid: 'u1', userName: 'Jean', homeGuess: 3, awayGuess: 0, points: 3 }, { uid: 'u2', userName: 'Bia', homeGuess: 1, awayGuess: 0, points: 1 }],
  round: { winners: [{ uid: 'u1', userName: 'Jean', pixKey: 'jean@pix' }], topPoints: 3, participants: 2, totalCollected: 10, perWinner: 10, cota: 10 },
});
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));
vi.mock('@/hooks/useRequireProfile', () => ({ useRequireProfile: () => ({ ready: true, profile: { isAdmin: false } }) }));

import JogoPage from '@/app/jogo/[id]/page';

describe('JogoPage', () => {
  it('mostra o vencedor e a chave Pix', async () => {
    render(<JogoPage />);
    await waitFor(() => expect(screen.getByText(/jean@pix/i)).toBeInTheDocument());
    expect(screen.getByText('Jean')).toBeInTheDocument();
    expect(screen.getByText('Bia')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/app/jogo.test.tsx`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/jogo/[id]/page.tsx`

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import { formatBRL, formatKickoff } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';

interface RoundResult { winners: Array<{ uid: string; userName: string; pixKey: string }>; topPoints: number; participants: number; totalCollected: number; perWinner: number; cota: number }
interface Detail { match: MatchDTO; bets: BetDTO[]; round: RoundResult | null }

export default function JogoPage() {
  const { id } = useParams<{ id: string }>();
  const { call } = useAuth();
  const { ready } = useRequireProfile();
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await call<Detail>(`/api/matches/${id}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [call, id]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (!ready || data === null) return err ? <Main><p className="text-red-600">{err}</p></Main> : <Loading />;

  const { match, bets, round } = data;
  const sorted = [...bets].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  return (
    <Main>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{match.competition} · {formatKickoff(match.kickoffAt)}</div>
      <div className="flex items-center justify-center gap-3 my-3">
        <span className="font-bold w-28 text-right">{match.homeFlag} {match.homeTeam}</span>
        <span className="text-2xl font-extrabold">{match.status === 'finished' ? `${match.homeScore} x ${match.awayScore}` : 'x'}</span>
        <span className="font-bold w-28">{match.awayTeam} {match.awayFlag}</span>
      </div>

      {round && round.winners.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 my-3 text-sm">
          <div className="font-bold mb-1">🏆 Vencedor{round.winners.length > 1 ? 'es' : ''} da rodada</div>
          {round.winners.map((w) => (
            <div key={w.uid} className="flex justify-between">
              <span>{w.userName} · Pix: <b>{w.pixKey || '(sem Pix)'}</b></span>
              <span className="text-verde font-bold">recebe {formatBRL(round.perWinner)}</span>
            </div>
          ))}
          <div className="text-xs text-gray-500 mt-1">Arrecadado: {formatBRL(round.totalCollected)} · cota {formatBRL(round.cota)}</div>
        </div>
      )}

      <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 my-2">Palpites</h2>
      <table className="w-full text-sm">
        <tbody>
          {sorted.map((b) => (
            <tr key={b.uid} className="border-b border-gray-100">
              <td className="py-1.5">{b.userName}</td>
              <td className="py-1.5 text-center">{b.homeGuess} x {b.awayGuess}</td>
              <td className="py-1.5 text-right font-bold text-verde">{b.points === null ? '—' : `${b.points} pt${b.points === 1 ? '' : 's'}`}</td>
            </tr>
          ))}
          {sorted.length === 0 && <tr><td className="py-2 text-gray-500">Ninguém palpitou neste jogo.</td></tr>}
        </tbody>
      </table>
    </Main>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return (<><Header /><main className="max-w-2xl mx-auto p-4">{children}</main></>);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/app/jogo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/jogo tests/app/jogo.test.tsx
git commit -m "feat(front): tela de detalhe do jogo (palpites + vencedor + Pix)"
```

---

### Task 8: Tela de Ranking

**Files:**
- Create: `src/app/ranking/page.tsx`
- Test: `tests/app/ranking.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`call`), `useRequireProfile()`, `Header`, `Loading`.
- Produces: rota `/ranking`. Busca `GET /api/ranking`; tabela com posição, nome, pontos e rodadas vencidas.

- [ ] **Step 1: Teste que falha** — `tests/app/ranking.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/ranking', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({ ranking: [
  { uid: 'u1', name: 'Jean', totalPoints: 7, roundsWon: 2 },
  { uid: 'u2', name: 'Bia', totalPoints: 4, roundsWon: 1 },
] });
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));
vi.mock('@/hooks/useRequireProfile', () => ({ useRequireProfile: () => ({ ready: true, profile: { isAdmin: false } }) }));

import RankingPage from '@/app/ranking/page';

describe('RankingPage', () => {
  it('lista os participantes com pontos', async () => {
    render(<RankingPage />);
    await waitFor(() => expect(screen.getByText('Jean')).toBeInTheDocument());
    expect(screen.getByText('Bia')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/app/ranking.test.tsx`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/ranking/page.tsx`

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';

interface Row { uid: string; name: string; totalPoints: number; roundsWon: number }

export default function RankingPage() {
  const { call } = useAuth();
  const { ready } = useRequireProfile();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const d = await call<{ ranking: Row[] }>('/api/ranking'); setRows(d.ranking); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [call]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  if (!ready || rows === null) return <Loading />;

  return (
    <>
      <Header />
      <main className="max-w-xl mx-auto p-4">
        <h1 className="text-verde-escuro font-extrabold text-xl mb-3">Ranking geral</h1>
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
        <table className="w-full text-sm bg-white rounded border border-gray-200">
          <thead className="bg-verde text-white">
            <tr><th className="py-2 px-3 text-left">#</th><th className="py-2 px-3 text-left">Participante</th><th className="py-2 px-3 text-right">Pontos</th><th className="py-2 px-3 text-right">Vitórias</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.uid} className="border-b border-gray-100">
                <td className="py-2 px-3 font-bold text-gray-500">{i + 1}º</td>
                <td className="py-2 px-3">{r.name}</td>
                <td className="py-2 px-3 text-right font-extrabold text-verde">{r.totalPoints}</td>
                <td className="py-2 px-3 text-right">{r.roundsWon}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="py-3 px-3 text-gray-500">Sem pontuação ainda.</td></tr>}
          </tbody>
        </table>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/app/ranking.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/ranking tests/app/ranking.test.tsx
git commit -m "feat(front): tela de ranking geral"
```

---

### Task 9: Tela de Admin (cadastrar jogo + lançar placar)

**Files:**
- Create: `src/app/admin/page.tsx`
- Test: `tests/app/admin.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`call`), `useRequireProfile()`, `Header`, `Loading`, helpers, `MatchDTO`/`BetDTO`.
- Produces: rota `/admin` (só admin — não-admin é redirecionado p/ `/`). Form de cadastrar jogo (`POST /api/admin/matches`, convertendo data/hora local p/ epoch ms), lista de jogos `scheduled` com form de lançar placar (`POST /api/admin/matches/:id/result`).

- [ ] **Step 1: Teste que falha** — `tests/app/admin.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ replace, push: vi.fn() }) }));
const call = vi.fn().mockResolvedValue({ matches: [] });
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ call }) }));
const profileRef = { ready: true, profile: { isAdmin: true } as { isAdmin: boolean } };
vi.mock('@/hooks/useRequireProfile', () => ({ useRequireProfile: () => profileRef }));

import AdminPage from '@/app/admin/page';

describe('AdminPage', () => {
  it('admin vê o formulário de cadastro de jogo', async () => {
    profileRef.profile = { isAdmin: true };
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /cadastrar jogo/i })).toBeInTheDocument());
  });

  it('não-admin é redirecionado para a home', async () => {
    profileRef.profile = { isAdmin: false };
    render(<AdminPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/app/admin.test.tsx`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar** — `src/app/admin/page.tsx`

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useRequireProfile } from '@/hooks/useRequireProfile';
import Header from '@/components/Header';
import Loading from '@/components/Loading';
import { formatKickoff } from '@/lib/format';
import type { MatchDTO, BetDTO } from '@/lib/types';

type MatchWithBet = MatchDTO & { myBet: BetDTO | null };

export default function AdminPage() {
  const { call } = useAuth();
  const { ready, profile } = useRequireProfile();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchWithBet[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // form de cadastro
  const [form, setForm] = useState({ homeTeam: 'Brasil', awayTeam: '', homeFlag: '🇧🇷', awayFlag: '', competition: 'Eliminatórias', kickoff: '', cota: '10' });

  const load = useCallback(async () => {
    try { const d = await call<{ matches: MatchWithBet[] }>('/api/matches'); setMatches(d.matches); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao carregar'); }
  }, [call]);

  useEffect(() => {
    if (ready && profile && !profile.isAdmin) { router.replace('/'); return; }
    if (ready && profile?.isAdmin) load();
  }, [ready, profile, router, load]);

  if (!ready || !profile?.isAdmin || matches === null) {
    return <Loading />; // não-admin é redirecionado p/ '/' pelo useEffect acima
  }

  async function criar() {
    setErr(null);
    try {
      const kickoffAt = new Date(form.kickoff).getTime(); // datetime-local → epoch ms
      await call('/api/admin/matches', { method: 'POST', body: {
        homeTeam: form.homeTeam, awayTeam: form.awayTeam, homeFlag: form.homeFlag, awayFlag: form.awayFlag,
        competition: form.competition, kickoffAt, cota: Number(form.cota),
      } });
      setForm({ ...form, awayTeam: '', awayFlag: '', kickoff: '' });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao cadastrar'); }
  }

  const scheduled = matches.filter((m) => m.status === 'scheduled');

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto p-4">
        <h1 className="text-verde-escuro font-extrabold text-xl mb-3">Admin</h1>
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}

        <section className="bg-white border border-gray-200 rounded p-4 mb-6">
          <h2 className="font-bold mb-2">Cadastrar jogo</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col">Mandante<input value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Visitante<input value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Bandeira mandante<input value={form.homeFlag} onChange={(e) => setForm({ ...form, homeFlag: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Bandeira visitante<input value={form.awayFlag} onChange={(e) => setForm({ ...form, awayFlag: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Competição<input value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col">Cota (R$)<input type="number" value={form.cota} onChange={(e) => setForm({ ...form, cota: e.target.value })} className="border rounded p-1.5" /></label>
            <label className="flex flex-col col-span-2">Data e hora do jogo<input type="datetime-local" value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} className="border rounded p-1.5" /></label>
          </div>
          <button onClick={criar} disabled={!form.awayTeam || !form.kickoff}
            className="mt-3 bg-verde text-white font-bold py-2 px-4 rounded uppercase text-xs disabled:opacity-50">Cadastrar jogo</button>
        </section>

        <h2 className="text-verde font-extrabold text-sm uppercase tracking-wide border-l-4 border-verde pl-2 mb-2">Lançar placar</h2>
        {scheduled.length === 0 && <p className="text-gray-500 text-sm">Nenhum jogo agendado.</p>}
        {scheduled.map((m) => <ResultRow key={m.id} match={m} onDone={load} />)}
      </main>
    </>
  );
}

function ResultRow({ match, onDone }: { match: MatchDTO; onDone: () => void }) {
  const { call } = useAuth();
  const [h, setH] = useState(''); const [a, setA] = useState('');
  const [err, setErr] = useState<string | null>(null);
  async function lancar() {
    setErr(null);
    try {
      await call(`/api/admin/matches/${match.id}/result`, { method: 'POST', body: { homeScore: Number(h), awayScore: Number(a) } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao lançar'); }
  }
  return (
    <div className="bg-white border border-gray-200 rounded p-3 mb-2 flex items-center gap-2 text-sm">
      <span className="flex-1">{match.homeFlag} {match.homeTeam} x {match.awayTeam} {match.awayFlag} <span className="text-gray-400">· {formatKickoff(match.kickoffAt)}</span></span>
      <input aria-label={`placar mandante ${match.id}`} value={h} onChange={(e) => setH(e.target.value)} className="w-10 border rounded text-center" />
      <span>x</span>
      <input aria-label={`placar visitante ${match.id}`} value={a} onChange={(e) => setA(e.target.value)} className="w-10 border rounded text-center" />
      <button onClick={lancar} disabled={h === '' || a === ''} className="bg-verde text-white font-bold px-3 py-1.5 rounded text-xs disabled:opacity-50">Lançar</button>
      {err && <span className="text-red-600 text-xs">{err}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/app/admin.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar suíte inteira + build**

Run: `npm run test && npm run build`
Expected: todos os testes verdes; `npm run build` conclui com todas as rotas/páginas listadas e SEM credenciais (o front não inicializa o Admin SDK no build).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin tests/app/admin.test.tsx
git commit -m "feat(front): tela de admin (cadastrar jogo + lançar placar)"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec (telas, seção 7):** Login (Task 4) ✓ · Primeiro acesso/Pix (Task 5) ✓ · Home/Jogos com palpite e trava (Task 6) ✓ · Detalhe do jogo + vencedor + Pix (Task 7) ✓ · Ranking (Task 8) ✓ · Minha conta (Task 5) ✓ · Admin (Task 9) ✓. Visual verde GE aplicado via classes Tailwind da paleta (Tasks 3–9).
- **Regras de UX do spec:** trava do palpite no horário (MatchCard usa `isLocked`, e o servidor é a verdade) ✓; usuário sem Pix é levado pra `/conta` (`useRequireProfile`) ✓; admin só vê painel/aba se `isAdmin` (Header + guarda na página admin) ✓; dinheiro é só exibição (mostra Pix/valor, nunca movimenta) ✓.
- **Placeholders:** nenhum — todo passo de código mostra o código completo.
- **Consistência de tipos:** `useAuth()` expõe `call`/`profile`/`user`/`loading`/`signInGoogle`/`signOut`/`refreshProfile` (Task 2), usados igualzinho nas Tasks 3–9; formas de resposta da API batem com o Plano 1; `MatchWithBet = MatchDTO & { myBet: BetDTO | null }` usado consistentemente.
- **Dependência externa:** as telas que fazem login de verdade exigem `apiKey`/`appId` no `.env.local` (já preenchidos) e o provedor Google ativado no Firebase. Os testes não dependem disso (mockam Firebase/fetch).

## Verificação manual (após a Task 9)
Rodar `npm run dev`, abrir `http://localhost:3000`, logar com Google, cadastrar Pix, e (como admin) cadastrar um jogo e palpitar. É a validação de ponta a ponta que os testes unitários não cobrem — fica como passo de QA antes do Plano 3 (deploy).
