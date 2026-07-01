# Catálogo de Bandeiras + Seletor no Cadastro de Jogo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os 4 campos livres de time/URL no cadastro de jogo por 2 seletores nativos que preenchem nome + bandeira a partir de um catálogo fixo das 32 seleções do mata-mata da Copa 2026.

**Architecture:** Catálogo fixo em `src/lib/teams.ts` (fonte única de verdade) + assets SVG locais em `public/flags/`. O catálogo **só alimenta o formulário** — API, `MatchDTO`, Firestore e `Flag` ficam intactos. A partida continua guardando `homeFlag`/`awayFlag` como string (agora `/flags/<code>.svg`). Jogos antigos seguem funcionando sem migração.

**Tech Stack:** Next.js 15 (App Router, `'use client'`), React, TypeScript, Tailwind, Vitest + React Testing Library (jsdom por arquivo), assets de `flag-icons` (SVG domínio público, 4x3) via jsDelivr.

## Global Constraints

- **Nada muda fora do formulário.** Sem alteração em `/api/admin/matches`, `MatchDTO`, regras do Firestore, ou `src/components/Flag.tsx`. O POST continua enviando `{ homeTeam, awayTeam, homeFlag, awayFlag, competition, kickoffAt, cota }`.
- **32 seleções exatas**, nomes em pt-BR, ordenadas alfabeticamente por `name`. `flag` = `/flags/<code>.svg` (ISO 3166-1 alpha-2 minúsculo; Inglaterra = `gb-eng`).
- **Sem fallback de texto livre** (YAGNI) — os 32 são fixos até o fim da Copa.
- **Mandante começa em Brasil** (default atual preservado); **visitante começa vazio** ("Selecione…").
- **Firestore permanece Admin-SDK-only** — não abrir regras de leitura no cliente.
- **Type gate real:** `npx tsc --noEmit` deve sair com código 0 (Vitest usa esbuild e NÃO faz type-check). Rodar teste único: `npx vitest run tests/<arquivo>`.
- Alias `@/` → `src/`. Working dir do projeto: `C:\Users\jeans\Documents\jean\bolao-brasil` (git branch `master`).

Os 32 times e seus códigos:

| Seleção | code | Seleção | code |
|---|---|---|---|
| África do Sul | za | Espanha | es |
| Alemanha | de | Estados Unidos | us |
| Argélia | dz | França | fr |
| Argentina | ar | Gana | gh |
| Austrália | au | Holanda | nl |
| Áustria | at | Inglaterra | gb-eng |
| Bélgica | be | Japão | jp |
| Bósnia e Herzegovina | ba | Marrocos | ma |
| Brasil | br | México | mx |
| Cabo Verde | cv | Noruega | no |
| Canadá | ca | Paraguai | py |
| Colômbia | co | Portugal | pt |
| Costa do Marfim | ci | RD Congo | cd |
| Croácia | hr | Senegal | sn |
| Egito | eg | Suécia | se |
| Equador | ec | Suíça | ch |

---

### Task 1: Catálogo de times + assets de bandeira

**Files:**
- Create: `src/lib/teams.ts`
- Create: `public/flags/*.svg` (32 arquivos)
- Test: `tests/lib/teams.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `interface Team { name: string; flag: string }` e `export const TEAMS: Team[]` (32 entradas, ordenadas por `name`; `flag` = `/flags/<code>.svg`). Task 2 importa `TEAMS` de `@/lib/teams`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/teams.test.ts` (roda no ambiente node padrão — usa `fs`; NÃO adicione a diretiva jsdom):

```ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TEAMS } from '@/lib/teams';

describe('TEAMS (catálogo de seleções)', () => {
  it('tem as 32 seleções do mata-mata', () => {
    expect(TEAMS).toHaveLength(32);
  });

  it('nomes são únicos', () => {
    const names = TEAMS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('está ordenado alfabeticamente por name (pt-BR)', () => {
    const sorted = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    expect(TEAMS.map((t) => t.name)).toEqual(sorted.map((t) => t.name));
  });

  it('todo flag segue o padrão /flags/<code>.svg', () => {
    for (const t of TEAMS) {
      expect(t.flag).toMatch(/^\/flags\/[a-z-]+\.svg$/);
    }
  });

  it('todo arquivo de bandeira existe em public/flags/', () => {
    for (const t of TEAMS) {
      const file = join(process.cwd(), 'public', t.flag.replace(/^\//, ''));
      expect(existsSync(file), `Faltando arquivo para ${t.name}: ${t.flag}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/teams.test.ts`
Expected: FAIL — não resolve o import `@/lib/teams` (módulo inexistente).

- [ ] **Step 3: Create the catalog**

Create `src/lib/teams.ts`:

```ts
export interface Team {
  name: string;
  /** Caminho do SVG servido de public/, ex.: '/flags/br.svg'. */
  flag: string;
}

/** As 32 seleções classificadas ao mata-mata (Round of 32) da Copa 2026. Ordenadas por name (pt-BR). */
export const TEAMS: Team[] = [
  { name: 'África do Sul', flag: '/flags/za.svg' },
  { name: 'Alemanha', flag: '/flags/de.svg' },
  { name: 'Argélia', flag: '/flags/dz.svg' },
  { name: 'Argentina', flag: '/flags/ar.svg' },
  { name: 'Austrália', flag: '/flags/au.svg' },
  { name: 'Áustria', flag: '/flags/at.svg' },
  { name: 'Bélgica', flag: '/flags/be.svg' },
  { name: 'Bósnia e Herzegovina', flag: '/flags/ba.svg' },
  { name: 'Brasil', flag: '/flags/br.svg' },
  { name: 'Cabo Verde', flag: '/flags/cv.svg' },
  { name: 'Canadá', flag: '/flags/ca.svg' },
  { name: 'Colômbia', flag: '/flags/co.svg' },
  { name: 'Costa do Marfim', flag: '/flags/ci.svg' },
  { name: 'Croácia', flag: '/flags/hr.svg' },
  { name: 'Egito', flag: '/flags/eg.svg' },
  { name: 'Equador', flag: '/flags/ec.svg' },
  { name: 'Espanha', flag: '/flags/es.svg' },
  { name: 'Estados Unidos', flag: '/flags/us.svg' },
  { name: 'França', flag: '/flags/fr.svg' },
  { name: 'Gana', flag: '/flags/gh.svg' },
  { name: 'Holanda', flag: '/flags/nl.svg' },
  { name: 'Inglaterra', flag: '/flags/gb-eng.svg' },
  { name: 'Japão', flag: '/flags/jp.svg' },
  { name: 'Marrocos', flag: '/flags/ma.svg' },
  { name: 'México', flag: '/flags/mx.svg' },
  { name: 'Noruega', flag: '/flags/no.svg' },
  { name: 'Paraguai', flag: '/flags/py.svg' },
  { name: 'Portugal', flag: '/flags/pt.svg' },
  { name: 'RD Congo', flag: '/flags/cd.svg' },
  { name: 'Senegal', flag: '/flags/sn.svg' },
  { name: 'Suécia', flag: '/flags/se.svg' },
  { name: 'Suíça', flag: '/flags/ch.svg' },
];
```

- [ ] **Step 4: Download the 32 flag SVGs into `public/flags/`**

Rode no PowerShell, a partir da raiz do projeto. Baixa os SVGs 4x3 do `flag-icons` via jsDelivr (domínio público). `Invoke-WebRequest` lança erro em 404, então um code inválido interrompe o loop (sinal explícito de problema):

```powershell
$codes = 'za','de','dz','ar','au','at','be','ba','br','cv','ca','co','ci','hr','eg','ec','es','us','fr','gh','nl','gb-eng','jp','ma','mx','no','py','pt','cd','sn','se','ch'
New-Item -ItemType Directory -Force public/flags | Out-Null
foreach ($c in $codes) {
  Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/flag-icons/flags/4x3/$c.svg" -OutFile "public/flags/$c.svg"
}
(Get-ChildItem public/flags/*.svg | Measure-Object).Count
```

Expected: última linha imprime `32`. Se imprimir menos ou o loop lançar erro, verifique o code que falhou antes de prosseguir.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/teams.test.ts`
Expected: PASS (5 testes verdes — 32 entradas, nomes únicos, ordenado, padrão do flag, todos os arquivos existem).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/teams.ts tests/lib/teams.test.ts public/flags
git commit -m "feat: catálogo das 32 seleções da Copa 2026 + assets de bandeira"
```

---

### Task 2: Seletores de time no formulário de admin

**Files:**
- Modify: `src/app/(protected)/admin/page.tsx` (import + helper `flagOf`; estado inicial do `form`; substituição dos 4 campos livres por 2 `<select>`)
- Test: `tests/app/admin.test.tsx` (estender)

**Interfaces:**
- Consumes: `TEAMS` de `@/lib/teams` (Task 1) e `Flag` de `@/components/Flag` (já importado no arquivo). `Flag` recebe `{ src: string; alt: string; className?: string }`.
- Produces: nada para tarefas futuras (é a última tarefa).

- [ ] **Step 1: Write the failing test**

Em `tests/app/admin.test.tsx`, adicione `fireEvent` ao import do topo:

```ts
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
```

E adicione este teste dentro do `describe('AdminPage', ...)` (depois dos existentes):

```tsx
it('selecionar time no seletor visitante envia nome e bandeira corretos no POST', async () => {
  profileRef.profile = { isAdmin: true };
  call.mockResolvedValue({ matches: [] });
  render(<AdminPage />);

  await waitFor(() => expect(screen.getByRole('button', { name: /cadastrar jogo/i })).toBeInTheDocument());

  // 2 selects: [0] = mandante, [1] = visitante
  const selects = screen.getAllByRole('combobox');
  expect(selects).toHaveLength(2);
  fireEvent.change(selects[1], { target: { value: 'Argentina' } });

  // kickoff é obrigatório para habilitar o botão
  fireEvent.change(screen.getByLabelText(/data e hora/i), { target: { value: '2026-06-20T16:00' } });

  call.mockClear();
  fireEvent.click(screen.getByRole('button', { name: /cadastrar jogo/i }));

  await waitFor(() => {
    const post = call.mock.calls.find((c) => c[0] === '/api/admin/matches');
    expect(post).toBeTruthy();
    expect(post![1].body).toMatchObject({
      homeTeam: 'Brasil',
      homeFlag: '/flags/br.svg',
      awayTeam: 'Argentina',
      awayFlag: '/flags/ar.svg',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/admin.test.tsx`
Expected: FAIL — o form ainda usa `<input>` de texto, então `getAllByRole('combobox')` retorna `[]` e a asserção `toHaveLength(2)` falha (e `selects[1]` seria `undefined`).

- [ ] **Step 3: Implement the form changes**

Em `src/app/(protected)/admin/page.tsx`:

**3a.** Adicione o import do catálogo logo abaixo do import do `Flag` (linha 7):

```ts
import { TEAMS } from '@/lib/teams';
```

**3b.** Adicione o helper de módulo entre o bloco de imports/types e o componente (antes de `export default function AdminPage()`, por volta da linha 13). Function declaration para poder ser usado no inicializador de estado:

```ts
function flagOf(name: string): string {
  return TEAMS.find((t) => t.name === name)?.flag ?? '';
}
```

**3c.** Troque o estado inicial do form (linha 19) para inicializar `homeFlag` com a bandeira do Brasil:

De:
```ts
  const [form, setForm] = useState({ homeTeam: 'Brasil', awayTeam: '', homeFlag: '', awayFlag: '', competition: 'Eliminatórias', kickoff: '', cota: '10' });
```
Para:
```ts
  const [form, setForm] = useState({ homeTeam: 'Brasil', homeFlag: flagOf('Brasil'), awayTeam: '', awayFlag: '', competition: 'Eliminatórias', kickoff: '', cota: '10' });
```

**3d.** Substitua os 4 `<label>` de campos livres (linhas 58–61: Mandante input, Visitante input, URL bandeira mandante, URL bandeira visitante) por 2 seletores com prévia. Ou seja, remova estas 4 linhas:

```tsx
          <label className="flex flex-col">Mandante<input value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} className="border rounded p-1.5" /></label>
          <label className="flex flex-col">Visitante<input value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} className="border rounded p-1.5" /></label>
          <label className="flex flex-col col-span-2">URL bandeira mandante (.svg)<input value={form.homeFlag} onChange={(e) => setForm({ ...form, homeFlag: e.target.value })} placeholder="https://s.sde.globo.com/.../Brasil.svg" className="border rounded p-1.5" /></label>
          <label className="flex flex-col col-span-2">URL bandeira visitante (.svg)<input value={form.awayFlag} onChange={(e) => setForm({ ...form, awayFlag: e.target.value })} placeholder="https://s.sde.globo.com/.../Noruega.svg" className="border rounded p-1.5" /></label>
```

E coloque no lugar:

```tsx
          <label className="flex flex-col">Mandante
            <div className="flex items-center gap-2 mt-1">
              <select value={form.homeTeam}
                onChange={(e) => setForm({ ...form, homeTeam: e.target.value, homeFlag: flagOf(e.target.value) })}
                className="border rounded p-1.5 flex-1">
                {TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
              <Flag src={form.homeFlag} alt={form.homeTeam} className="w-6 h-5" />
            </div>
          </label>
          <label className="flex flex-col">Visitante
            <div className="flex items-center gap-2 mt-1">
              <select value={form.awayTeam}
                onChange={(e) => setForm({ ...form, awayTeam: e.target.value, awayFlag: flagOf(e.target.value) })}
                className="border rounded p-1.5 flex-1">
                <option value="">Selecione…</option>
                {TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
              <Flag src={form.awayFlag} alt={form.awayTeam} className="w-6 h-5" />
            </div>
          </label>
```

(Não toque nos labels de Competição, Cota e Data/hora, nem em `criar()`, no botão, ou no `ResultRow`. O `criar()` já envia `form.homeFlag`/`form.awayFlag`, e o reset `setForm({ ...form, awayTeam: '', awayFlag: '', kickoff: '' })` já zera o visitante de volta para "Selecione…".)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/admin.test.tsx`
Expected: PASS (os testes existentes + o novo, todos verdes).

- [ ] **Step 5: Type-check + suíte completa**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: toda a suíte passa (as 144 anteriores + 5 do Task 1 + 1 do Task 2 = 150).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/admin/page.tsx" tests/app/admin.test.tsx
git commit -m "feat: seletor de seleções (nome + bandeira) no cadastro de jogo"
```

---

## Self-Review

**1. Spec coverage** (checando contra `docs/superpowers/specs/2026-07-01-bandeiras-catalogo-design.md`):
- Assets `public/flags/*.svg` (32, por code) → Task 1 Step 4. ✅
- Catálogo `src/lib/teams.ts` com `Team`/`TEAMS`, ordenado por `name` → Task 1 Step 3. ✅
- Form: remove 4 campos livres, adiciona 2 `<select>`, seleção seta nome+bandeira, prévia `<Flag>`, mandante=Brasil / visitante vazio, POST inalterado → Task 2 Step 3. ✅
- Teste `tests/lib/teams.test.ts` (32, únicos, padrão, arquivos existem via fs) → Task 1 Step 1. ✅
- Teste `tests/app/admin.test.tsx` estendido (seleciona visitante → POST com awayTeam+awayFlag) → Task 2 Step 1. ✅
- Fora de escopo respeitado: sem mudança em API/`MatchDTO`/Firestore/`Flag`; sem tela de gestão; sem migração → Global Constraints. ✅

**2. Placeholder scan:** Sem TBD/TODO/"handle edge cases". Todo passo tem código ou comando concreto. ✅

**3. Type consistency:** `Team { name, flag }` definido no Task 1 e consumido via `TEAMS` no Task 2. `flagOf(name): string` usado tanto no init do estado quanto nos `onChange`. Props de `Flag` (`src`, `alt`, `className`) batem com o uso existente no `ResultRow`. Campos do POST (`homeTeam/awayTeam/homeFlag/awayFlag`) inalterados. ✅
