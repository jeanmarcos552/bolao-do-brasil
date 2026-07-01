# Catálogo de Bandeiras + Seletor no Cadastro de Jogo — Design

**Data:** 2026-07-01
**Status:** Aprovado (pendente revisão da spec escrita)

## Objetivo

Substituir a digitação manual de URLs de bandeiras no cadastro de jogo por um
catálogo fixo de seleções. O admin escolhe o time num seletor e o nome + a
bandeira são preenchidos automaticamente.

## Contexto atual

- O form de admin (`src/app/(protected)/admin/page.tsx`) tem 4 campos livres:
  `homeTeam`, `awayTeam` (texto) e `homeFlag`, `awayFlag` (URL `.svg` colada à mão).
- A partida guarda `homeFlag`/`awayFlag` como **string** (`MatchDTO`, Firestore).
- `Flag` (`src/components/Flag.tsx`) renderiza `<img src={src}>` ou um ⚽ de
  fallback quando `src` é vazio. Não usa `next/image`.
- Não existe catálogo de times nem assets de bandeira em `public/`.

## Princípio da mudança

**O catálogo só alimenta o formulário.** Nada muda no banco, na API
(`/api/admin/matches`), no `MatchDTO` nem no `Flag`. A partida continua
guardando `homeFlag`/`awayFlag` como caminho de string (agora `/flags/xx.svg`).
Jogos já cadastrados seguem funcionando sem migração.

## Escopo do catálogo

As **32 seleções** classificadas ao mata-mata (Round of 32) da Copa do Mundo
2026. Nomes em português (pt-BR). Cada uma mapeia para um código de arquivo de
bandeira (ISO 3166-1 alpha-2 minúsculo; Inglaterra usa `gb-eng`).

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

(32 no total: África do Sul, Alemanha, Argélia, Argentina, Austrália, Áustria,
Bélgica, Bósnia e Herzegovina, Brasil, Cabo Verde, Canadá, Colômbia, Costa do
Marfim, Croácia, Egito, Equador, Espanha, Estados Unidos, França, Gana, Holanda,
Inglaterra, Japão, Marrocos, México, Noruega, Paraguai, Portugal, RD Congo,
Senegal, Suécia, Suíça.)

## Componentes

### 1. Assets — `public/flags/*.svg`
32 SVGs nomeados por `code` (`br.svg`, `ar.svg`, …, `gb-eng.svg`). Fonte:
`flag-icons` (SVGs de domínio público, proporção 4x3). Servidos em
`/flags/<code>.svg`.

### 2. Catálogo — `src/lib/teams.ts`
```ts
export interface Team { name: string; flag: string } // flag = '/flags/<code>.svg'
export const TEAMS: Team[] = [ /* 32 seleções, ordenadas por name (pt-BR) */ ];
```
Ordenação alfabética por `name`. Fonte única de verdade dos times selecionáveis.

### 3. Formulário — `src/app/(protected)/admin/page.tsx`
- Remove os 4 campos livres (2 nome + 2 URL).
- Adiciona 2 `<select>` nativos (mandante/visitante), opções = `TEAMS` por `name`.
- Escolher um time seta **nome e bandeira** juntos no estado do form.
- Prévia: um `<Flag src={flagSelecionado} />` ao lado de cada seletor.
- Mandante começa em **Brasil** (default atual preservado); visitante começa vazio
  ("Selecione…").
- O POST para `/api/admin/matches` continua com `{ homeTeam, awayTeam, homeFlag,
  awayFlag, competition, kickoffAt, cota }` — mesmos campos de hoje.

## Fluxo de dados

1. Admin abre o seletor → vê os 32 nomes.
2. Seleciona "Argentina" no visitante → estado do form recebe
   `awayTeam:"Argentina"`, `awayFlag:"/flags/ar.svg"`.
3. Prévia mostra a bandeira. Submete → POST inalterado → Firestore guarda a string.
4. Home/detalhe/admin renderizam via `Flag` (`<img src="/flags/ar.svg">`).

## Tratamento de erros / bordas

- **Time fora do catálogo:** sem fallback de texto livre (YAGNI — os 32 são fixos
  até o fim da Copa). Se necessário no futuro, adiciona-se uma opção "Outro".
- **Arquivo de bandeira ausente:** coberto por teste (ver abaixo); em runtime o
  `Flag` já degrada para o ⚽ se `src` não carregar/for vazio.
- **Mandante == visitante:** não bloqueado (fora de escopo).

## Testes

- `tests/lib/teams.test.ts`: `TEAMS` tem 32 entradas; nomes únicos; todo `flag`
  casa com o padrão `/flags/<code>.svg`; **cada arquivo referenciado existe** em
  `public/flags/` (lê o diretório via `fs`). Pega bandeira faltando.
- `tests/app/admin.test.tsx` (estender): renderiza o form; seleciona um time no
  `<select>` visitante; verifica que o POST para `/api/admin/matches` inclui
  `awayTeam` + `awayFlag` corretos (`/flags/<code>.svg`).

## Fora de escopo

- Nenhuma mudança na API, no `MatchDTO`, no Firestore ou no `Flag`.
- Sem tela de gestão de times (catálogo é fixo no código).
- Sem migração de jogos antigos.
