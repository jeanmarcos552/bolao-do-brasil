# Bolão da Seleção — Acompanhamento ao Vivo (design)

**Data:** 2026-06-30
**Status:** aprovado, pronto para o plano de implementação

## Objetivo

Permitir que o admin conduza um jogo ao vivo (editar placar, marcar prorrogação,
lançar o andamento dos pênaltis) e que os palpiteiros acompanhem em tempo quase
real quem é o "campeão do momento" — com uma faixa horizontal de avatares
ranqueados — e, ao encerrar, uma tela de vencedor com confetes, avatar grande e
botão de copiar o Pix.

## Contexto / arquitetura atual (não muda)

- Next.js App Router + Route Handlers (Node) + Firestore via **Admin SDK apenas**
  (cliente nunca acessa o Firestore direto; regras bloqueadas).
- Auth: Firebase Google; cliente chama a API com Bearer token (`useAuth().call`).
- Pontuação atual: `scoreBet` = 3 (placar exato) / 1 (só resultado) / 0.
- Premiação por jogo: `resolveRound` — maior pontuação vence; perdedores pagam a
  cota; `perWinner = totalCollected / nWinners`.
- Ranking: soma de pontos + rodadas vencidas sobre jogos `finished`.

## Decisões tomadas (brainstorming)

1. **Tempo real = WebSocket como "aviso" + API como fonte da verdade + polling de
   fallback.** Reaproveita o serviço `ws.jeansilva.app.br` (Socket.IO, salas via
   `join_event`, publish HTTP protegido por `X-API-KEY`).
2. **Pênaltis = 1 ponto** para quem apostou no time que venceu nos pênaltis. Quem
   apostou empate ou no outro time = 0.
3. **Controles do admin inline** na página do jogo (`/jogo/[id]`), visíveis só
   para admin.

## 1. Modelo de dados (documento `matches`)

Campos novos/alterados:

| Campo | Tipo | Uso |
|---|---|---|
| `status` | `'scheduled' \| 'live' \| 'finished' \| 'deleted'` | novo estado `live` |
| `homeScore` / `awayScore` | `number \| null` | usados **durante** o jogo (0 ao iniciar) |
| `extraTime` | `boolean` | marca prorrogação |
| `penalties` | `boolean` | marca que foi para os pênaltis |
| `homePen` / `awayPen` | `number` | placar dos pênaltis (progressivo) |
| `startedAt` | timestamp | quando entrou ao vivo |
| `finishedAt` | timestamp | quando encerrou (já existe) |

Compatibilidade: jogos antigos sem esses campos são tratados como
`penalties: false`, `extraTime: false`, `homePen/awayPen: 0`. A pontuação e o
ranking de jogos já encerrados não mudam.

### `MatchDTO` (src/lib/types.ts)

Adicionar: `extraTime: boolean`, `penalties: boolean`, `homePen: number`,
`awayPen: number`. Estender o tipo `MatchStatus` com `'live'`.

## 2. Pontuação e leaderboard (funções puras)

### `outcome(home, away): -1 | 0 | 1` (já existe)

### `scoreBet(...)` (já existe) — 3/1/0 sobre o placar corrente

Usada para jogo normal e prorrogação.

### `scoreBetPenalties(homeGuess, awayGuess, homePen, awayPen): 0 | 1` (nova)

```ts
export function scoreBetPenalties(
  homeGuess: number, awayGuess: number, homePen: number, awayPen: number,
): 0 | 1 {
  const guessed = outcome(homeGuess, awayGuess); // quem o palpiteiro escolheu p/ vencer
  const winner = outcome(homePen, awayPen);      // quem venceu nos pênaltis
  if (winner === 0) return 0;                     // pênaltis empatados no momento → ninguém pontua
  return guessed === winner ? 1 : 0;
}
```

### `scoreBetForMatch(bet, match): number` (nova)

Escolhe a regra conforme o estado do jogo:

```ts
interface MatchScoreState { homeScore: number; awayScore: number; penalties: boolean; homePen: number; awayPen: number }
export function scoreBetForMatch(
  bet: { homeGuess: number; awayGuess: number }, m: MatchScoreState,
): number {
  if (m.penalties) return scoreBetPenalties(bet.homeGuess, bet.awayGuess, m.homePen, m.awayPen);
  return scoreBet(bet.homeGuess, bet.awayGuess, m.homeScore, m.awayScore);
}
```

Usada **tanto** no leaderboard ao vivo quanto no encerramento (finalize).

### `buildLeaderboard(bets, match): LeaderRow[]` (nova, src/lib/leaderboard.ts)

```ts
export interface LiveBet { uid: string; userName: string; photoURL: string; homeGuess: number; awayGuess: number }
export interface LeaderRow { uid: string; userName: string; photoURL: string; points: number; position: number }
```

Regras de ordenação:
1. pontos desc (via `scoreBetForMatch`);
2. desempate por proximidade do placar exato: `|homeGuess - homeScore| + |awayGuess - awayScore|` asc (no modo pênaltis, usa o placar do tempo normal armazenado em `homeScore/awayScore`);
3. desempate final por `userName` asc.

Atribui `position` sequencial (1,2,3,…) — usada para o tamanho do avatar. Os
empates reais de **prêmio** são resolvidos no encerramento por `resolveRound`
(que divide a cota entre os empatados no topo).

## 3. API

### `POST /api/admin/matches/[id]/live` (nova)

- `requireAdmin`.
- Body (todos opcionais, mas ao menos um): `homeScore`, `awayScore`, `extraTime`,
  `penalties`, `homePen`, `awayPen`.
- Valida números com `isValidScore` (inteiro 0–99) para os placares.
- Transição de estado: se `status === 'scheduled'`, muda para `'live'` e grava
  `startedAt`; se já `finished`/`deleted` → 409.
- **Não** pontua palpites (estado provisório).
- Ao final, chama `notifyMatchUpdate(id)` (best-effort).
- Resposta: `{ ok: true }`.

### `POST /api/admin/matches/[id]/result` (ajustada — encerrar)

- Mantém contrato atual: `homeScore`, `awayScore` obrigatórios e válidos.
- Aceita também `penalties?`, `homePen?`, `awayPen?`.
- Se `penalties === true`, exige `homePen`/`awayPen` válidos e `homePen !== awayPen`
  (não encerra com pênaltis empatados) → senão 400.
- Grava o estado final no match, pontua cada palpite com `scoreBetForMatch`,
  status `finished`, `finishedAt`.
- Chama `notifyMatchUpdate(id)` (best-effort).
- Resposta: `{ ok: true, scored: N }`.

### `GET /api/matches/[id]` (ajustada)

- Continua devolvendo `{ match, bets, round }`.
- `match` DTO ganha `extraTime/penalties/homePen/awayPen`.
- Quando `status` é `'live'` ou `'finished'`, inclui `leaderboard: LeaderRow[]`
  (junta `photoURL` do doc `users`).
- `round.winners` ganha `photoURL` (para o avatar grande na tela de vencedor).
- Visibilidade dos palpites: revela todos quando `Date.now() >= kickoffAt` OU
  `status !== 'scheduled'` (jogo ao vivo já mostra todos).

### `GET /api/matches` (ajustada)

- DTO estendido já carrega `status: 'live'` + placar corrente. Card mostra badge
  "AO VIVO 🔴" e o placar, com link para `/jogo/[id]`.

### Cadastro de jogo

Sem mudança de campos. O jogo criado flui pelo ciclo agendado → ao vivo →
encerrado.

## 4. WebSocket (nudge + fallback)

### Back (Next) — `src/lib/wsNotify.ts`

```ts
export async function notifyMatchUpdate(matchId: string): Promise<void> {
  const url = process.env.WS_PUBLISH_URL, key = process.env.WS_API_KEY;
  if (!url || !key) return; // sem config → no-op (ex.: testes/local)
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

Best-effort: falha **não** interrompe o lançamento do placar. Envs: `WS_PUBLISH_URL`,
`WS_API_KEY`.

### Front — `src/hooks/useMatchLive.ts`

- `socket.io-client` conecta em `NEXT_PUBLIC_WS_URL`.
- `emit('join_event', { event_id: 'match:'+matchId })`.
- `on('match_update', () => onUpdate())` → dispara refetch do GET.
- Conecta somente quando o jogo está `live`; desconecta ao encerrar/desmontar.
- **Polling de fallback**: `setInterval(onUpdate, 25000)` enquanto `live`.

### Serviço WS (fora deste repo)

Handler HTTP que valida `X-API-KEY` e faz broadcast do evento `match_update` na
sala `match:{id}`. Snippet será fornecido ao usuário para colar no
`node-ws-boilerplate`.

## 5. Tela ao vivo — `/jogo/[id]`

### `Avatar` (novo, reutilizável — src/components/Avatar.tsx)

- Círculo com a foto (`photoURL`) do Google; `size` em px configurável.
- Fallback: iniciais do nome sobre fundo verde (reaproveita lógica de `initials`).
- `<img>` simples (evita configurar domínio `lh3.googleusercontent.com` no next/image).

### `LiveScoreboard` (dentro da page ou componente)

- Escudos (`Flag`) + placar corrente + label do momento:
  - `🔴 Ao vivo` (normal), `Prorrogação` (extraTime), `Pênaltis X x Y` (penalties).

### `LiveLeaderboard` (novo — src/components/LiveLeaderboard.tsx)

- Faixa horizontal com scroll (`overflow-x-auto`) de avatares.
- Por item: medalha acima (🥇 no 1º, 🥈 no 2º, 🥉 no 3º; demais sem medalha),
  avatar dimensionado por `position` — **1º 240px, 2º 200px, 3º 180px, demais
  120px** — e abaixo a colocação ("1º", "2º"…) e o nome.
- Recebe `LeaderRow[]`; re-renderiza a cada refetch.

## 6. Tela do vencedor (status `finished`)

### `Confetti` (novo — src/components/Confetti.tsx)

- CSS puro: N divs posicionados absolutamente caindo de cima para baixo com
  `@keyframes` (cores da bandeira). Sem dependência externa. Roda alguns segundos.

### Bloco do vencedor

- Avatar do campeão em **480px** (reaproveita `Avatar`). Vários vencedores
  empatados: mostra todos (480px se 1; ~240px cada se vários, em linha).
- **Botão "Copiar Pix"** por vencedor: `navigator.clipboard.writeText(pixKey)`,
  feedback "Copiado!" por ~2s. Mostra também o valor a receber (`perWinner`).
- Abaixo, a tabela de palpites com pontos finais (como hoje).

## 7. Controles do admin (inline em `/jogo/[id]`, só `profile.isAdmin`)

- **Agendado:** botão "Iniciar jogo ao vivo" → `POST .../live` (status live, 0x0).
- **Ao vivo:**
  - steppers/inputs de `homeScore` e `awayScore` + "Atualizar placar";
  - toggle "Prorrogação" (`extraTime`);
  - toggle "Foi para pênaltis" (`penalties`) → revela steppers `homePen`/`awayPen`;
  - botão "Encerrar jogo" → `POST .../result` com o estado final.
- **Encerrado:** somente leitura (mantém a regra atual de não editar finalizado).
- Cada ação chama a API e refaz o GET local; o aviso WS propaga aos demais.

## 8. Testes

- **Puros:** `scoreBetPenalties`, `scoreBetForMatch`, `buildLeaderboard`
  (ordenação e posições, incluindo empates e modo pênaltis).
- **API (fake do Firestore):** `POST .../live` (validação, transição de status,
  409 em finished), `POST .../result` com pênaltis (pontua por vencedor; 400 se
  pênaltis empatado), `GET /api/matches/[id]` devolve `leaderboard` e `photoURL`.
- **`wsNotify`:** no-op sem env; não lança quando `fetch` rejeita (mock).
- **Componentes (RTL/jsdom):** `Avatar` (foto e fallback de iniciais),
  `LiveLeaderboard` (tamanho por posição, medalhas top-3), `Confetti` (renderiza),
  botão copiar-Pix (chama `navigator.clipboard`), tela do vencedor.

## Dependências e configuração

- **Dependência nova:** `socket.io-client`.
- **Envs novas:** `WS_PUBLISH_URL`, `WS_API_KEY` (servidor), `NEXT_PUBLIC_WS_URL`
  (cliente). Ausência → WS vira no-op e o app funciona só com polling.

## Fora de escopo

- Mudança nas regras de segurança do Firestore (segue Admin-SDK-only).
- Alteração no serviço WS além do handler de broadcast (fornecido à parte).
- Cronômetro/relógio de partida automático (o admin controla o placar manualmente).
