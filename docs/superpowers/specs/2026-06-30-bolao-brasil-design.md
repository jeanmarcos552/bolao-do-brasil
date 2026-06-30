# Bolão da Seleção — Documento de Design

**Data:** 2026-06-30
**Projeto:** `jean/bolao-brasil`
**Status:** Design aprovado (pendente revisão final do spec)

## 1. Objetivo

App web de bolão para um grupo fechado de amigos/família palpitar nos próximos
jogos da Seleção Brasileira. Cada jogo tem uma "cota" (valor em R$); quem fizer
mais pontos no jogo vence aquela rodada e recebe dos demais via Pix. O app
controla palpites, pontuação, ranking e exibe a chave Pix do vencedor — as
transferências de dinheiro acontecem **por fora** (o app nunca movimenta dinheiro).

## 2. Decisões (resumo do brainstorming)

| Tema | Decisão |
|---|---|
| Público | Grupo fechado de amigos/família |
| Cadastro | Login com Google; no 1º acesso confirma nome e cadastra **chave Pix** (obrigatória pra palpitar) |
| Palpite | **Placar exato** (ex: Brasil 2 x 1 Colômbia) |
| Pontuação | **3 pts** placar exato · **1 pt** acertou só o resultado (vitória/empate/derrota) · **0** errou |
| Jogos | **Admin cadastra manualmente** (times, data/hora, cota) e lança o placar final |
| Estrutura | **Bolão único**, ranking único |
| Trava do palpite | Fecha automaticamente **no horário de início do jogo** (`kickoffAt`) |
| Premiação | **Por jogo/rodada**: quem fez mais pontos no jogo vence; os demais mandam a cota via Pix |
| Cota | **Definida pelo admin por jogo** |
| Admin | Definido por lista de e-mails em variável de ambiente (`ADMIN_EMAILS`) |
| Stack | Next.js (App Router) + TypeScript + Route Handlers (API Node) + Firestore + Firebase Auth + Tailwind |
| Visual | Estilo Globo Esporte com **paleta verde da bandeira** (título verde escuro, abas verde claro, amarelo de destaque) |
| Deploy | Docker no servidor AWS (EC2) atrás do Nginx + Certbot, no subdomínio `bolao.jeansilva.app.br` (porta local 3002) |

## 3. Arquitetura

Projeto único Next.js (App Router), full-stack:

- **Frontend:** React + TypeScript + Tailwind CSS. Páginas/served como Server e Client Components.
- **API:** Route Handlers em `/app/api/**` (rodam em Node.js). Concentram TODA a
  lógica sensível: validação e trava de palpite, cálculo de pontos, decisão do
  vencedor, checagem de permissão de admin.
- **Auth:** Firebase Auth (provider Google) no cliente. O cliente obtém o **ID
  token** e o envia no header `Authorization: Bearer <token>` para as rotas de
  API. O servidor verifica o token com o **Firebase Admin SDK** a cada requisição.
- **Banco:** Cloud Firestore. Escritas sensíveis acontecem **somente** via Admin
  SDK no servidor. Regras do Firestore negam escrita direta do cliente nas
  coleções de jogos/palpites (defesa em profundidade).
- **Deploy:** container Docker (build standalone do Next) escutando na porta
  interna 3000, publicado em `127.0.0.1:3002` no host; Nginx faz proxy reverso de
  `bolao.jeansilva.app.br` → `127.0.0.1:3002`.

### Unidades e responsabilidades

- `lib/scoring.ts` — função **pura** `scoreBet(guess, final) -> 0 | 1 | 3`. Sem
  dependências de I/O, 100% testável isolada.
- `lib/round.ts` — função **pura** que recebe a lista de palpites pontuados de um
  jogo e devolve o(s) vencedor(es) e o rateio da cota.
- `lib/firebaseAdmin.ts` — inicialização singleton do Admin SDK.
- `lib/auth.ts` — `requireUser(req)` e `requireAdmin(req)`: verificam o token e a
  permissão; lançam erro 401/403.
- `app/api/**` — handlers finos que orquestram as funções acima.
- Componentes de UI (`components/**`) sem lógica de regra de negócio.

## 4. Modelo de dados (Firestore)

```
users/{uid}
  name: string
  email: string
  photoURL: string
  pixKey: string          // obrigatória pra palpitar
  isAdmin: boolean         // derivado de ADMIN_EMAILS na escrita do perfil
  createdAt: Timestamp

matches/{matchId}
  homeTeam: string         // ex: "Brasil"
  awayTeam: string         // ex: "Colômbia"
  homeFlag: string         // v1: emoji do país (ex: "🇧🇷")
  awayFlag: string
  competition: string      // ex: "Eliminatórias", "Amistoso"
  kickoffAt: Timestamp     // início do jogo = trava do palpite
  cota: number             // valor em R$ (ex: 10)
  status: "scheduled" | "finished"
  homeScore: number | null // preenchido ao finalizar
  awayScore: number | null
  createdBy: string        // uid do admin
  finishedAt: Timestamp | null

matches/{matchId}/bets/{uid}
  uid: string
  userName: string         // desnormalizado p/ exibir sem join
  homeGuess: number
  awayGuess: number
  points: number | null    // calculado ao finalizar o jogo
  createdAt: Timestamp
  updatedAt: Timestamp
```

O ranking geral é calculado somando `points` de todos os palpites de cada
usuário (agregação no servidor). Não há coleção de ranking separada na v1.

## 5. API (Route Handlers)

Todas as rotas exigem `Authorization: Bearer <idToken>`, salvo indicação.

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/me` | Perfil do usuário logado (cria o doc no 1º acesso) |
| `PUT` | `/api/me` | Atualiza `name` e `pixKey` |
| `GET` | `/api/matches` | Lista jogos (próximos e encerrados) + palpite do usuário em cada um |
| `POST` | `/api/matches/:id/bet` | Cria/edita palpite. Servidor recusa se `now >= kickoffAt` ou se o usuário não tem `pixKey` |
| `GET` | `/api/matches/:id` | Detalhe do jogo: todos os palpites e pontos (palpites alheios só visíveis após `kickoffAt`); vencedor + Pix se `finished` |
| `GET` | `/api/ranking` | Ranking geral (total de pontos + nº de rodadas vencidas) |
| `POST` | `/api/admin/matches` | **Admin** — cadastra jogo |
| `PUT` | `/api/admin/matches/:id` | **Admin** — edita jogo (enquanto `scheduled`) |
| `POST` | `/api/admin/matches/:id/result` | **Admin** — lança placar final → calcula pontos de todos, define vencedor(es), marca `finished` |
| `DELETE` | `/api/admin/matches/:id` | **Admin** — remove jogo `scheduled` (opcional) |

## 6. Regras de pontuação e premiação

### Pontuação (função pura)

```
scoreBet(homeGuess, awayGuess, homeFinal, awayFinal):
  se homeGuess == homeFinal e awayGuess == awayFinal      -> 3   // placar exato
  senão se sinal(homeGuess - awayGuess) == sinal(homeFinal - awayFinal) -> 1  // mesmo resultado
  senão -> 0
```
`sinal()` mapeia vitória do mandante (+), empate (0) ou visitante (−).

### Vencedor da rodada e rateio

- Ao lançar o placar, o servidor pontua **todos** os palpites do jogo.
- **Vencedor(es):** quem tiver a **maior pontuação** no jogo (entre quem palpitou).
- **Pote:** cada participante que palpitou "deve" 1 cota.
  - **1 vencedor:** cada um dos demais (`N − 1`) manda 1 cota via Pix pro vencedor.
  - **Empate de `K` vencedores:** o **valor arrecadado** (`cota × (N − K)` — as
    cotas dos não-vencedores) é **dividido igualmente entre os `K` vencedores**,
    ou seja, `cota × (N − K) / K` para cada um. O app exibe a chave Pix de **todos**
    os vencedores e quanto cada um recebe.
- Se ninguém pontuou acima de 0, ainda há vencedor (o de maior pontuação; pode
  haver empate em 0 → todos empatados, sem rateio prático). O app exibe o caso.

## 7. Telas e UX

Visual estilo Globo Esporte com paleta da bandeira:
`--verde-escuro #00501f` (título), `--verde #009c3b` (abas/botões/detalhes),
`--amarelo #ffdf00` (destaques), fundo claro `#f0f0f0`, cards brancos.

1. **Login** — botão "Entrar com Google", com fundo bem-humorado: animação do
   Paquetá "levando bolada" (piada interna da família). Arquivo `bg_login.webp` na raiz.
2. **Primeiro acesso** — confirma nome (vem do Google) e cadastra a **chave Pix**.
3. **Home / Jogos** — abas (Jogos · Ranking · Minha conta). Seção "Próximos jogos"
   com cards de palpite (2 campos de placar + "Salvar palpite" + aviso de trava) e
   seção "Encerrados" com placar final, seus pontos e vencedor da rodada + Pix.
4. **Detalhe do jogo** — placar, todos os palpites e pontos, vencedor(es)
   destacado(s) com Pix e valor da cota.
5. **Ranking** — total de pontos por participante + nº de rodadas vencidas.
6. **Minha conta** — editar nome e chave Pix.
7. **Admin** — cadastrar jogo (times, bandeiras, competição, data/hora, cota) e
   lançar placar final. Visível só para e-mails em `ADMIN_EMAILS`.

## 8. Erros e casos de borda

- Palpite após `kickoffAt` → API responde 409 com mensagem clara; UI esconde o form.
- Usuário sem `pixKey` → bloqueado de palpitar, redirecionado pra "Minha conta".
- Placar inválido (negativo, vazio, não inteiro) → 400 no servidor.
- Ação de admin por não-admin → 403 (checado no servidor, não só na UI).
- Lançar placar de jogo já `finished` → 409 (evita recálculo acidental); editar
  exige rota explícita.
- Palpites de terceiros só ficam visíveis após a trava (evita cópia).

## 9. Testes

- **Unitários (`lib/scoring.ts`):** placar exato, só resultado (vitória/empate/
  derrota), erro total, placares com gols altos.
- **Unitários (`lib/round.ts`):** 1 vencedor, empate de 2+, todos zerados,
  cálculo do rateio da cota.
- **Integração das rotas:** trava por horário (antes/depois), bloqueio sem Pix,
  permissão de admin, fluxo de lançar placar e pontuar.
- TDD: escrever os testes das funções puras antes da implementação.

## 10. Deploy (Docker + AWS + Nginx + Certbot)

### Contexto do servidor (já existente)
- Web server: **Nginx** (Apache instalado mas desabilitado — não usar).
- Padrão: cada projeto roda numa porta local; Nginx faz `proxy_pass`.
  - `jeansilva.app.br` → `localhost:3000`
  - `ws.jeansilva.app.br` → `localhost:3001`
  - **bolão (novo)** → `127.0.0.1:3002`
- SSL: **Certbot** (Let's Encrypt), certificado **individual por subdomínio**.
- Configs em `/etc/nginx/sites-available/` com symlink em `/etc/nginx/sites-enabled/`.
- ⚠️ A config atual de `ws` tem blocos `server` duplicados (um SSL, outro HTTP) —
  **não replicar**; usar um único server block limpo (o certbot gera o redirect).

### Artefatos que o projeto vai conter
- `Dockerfile` — build multi-stage com saída `standalone` do Next (imagem enxuta),
  escutando na porta interna **3000**.
- `docker-compose.yml` — sobe o container com `restart: unless-stopped`,
  `env_file`, mapeando **`127.0.0.1:3002:3000`** (só loopback; quem expõe é o Nginx).
- `.env.production` (não versionado) — variáveis do Firebase e `ADMIN_EMAILS`.
- `deploy/nginx-bolao.conf` — modelo do server block (referência).

### Passo a passo (resumo; detalhado no plano de implementação)
1. **DNS:** criar registro **A** de `bolao.jeansilva.app.br` apontando para o IP do servidor.
2. **Código no servidor:** clonar o repositório (ou copiar via `scp`/CI).
3. **Variáveis:** criar `.env.production` com as credenciais do Firebase e `ADMIN_EMAILS`.
4. **Subir o container:** `docker compose up -d --build` (container em `127.0.0.1:3002`).
5. **Nginx:** criar `/etc/nginx/sites-available/bolao.jeansilva.app.br` (server block
   único, `proxy_pass http://127.0.0.1:3002;` com headers `Host`, `X-Real-IP`,
   `X-Forwarded-For`, `X-Forwarded-Proto`, `Upgrade`/`Connection`), symlink em
   `sites-enabled/`, `nginx -t` e `systemctl reload nginx`.
6. **SSL:** `sudo certbot --nginx -d bolao.jeansilva.app.br` (gera cert e o redirect HTTP→HTTPS).
7. **Validar:** abrir `https://bolao.jeansilva.app.br` e testar login + palpite.

## 11. Variáveis de ambiente

```
# Firebase (cliente) — públicas
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (servidor) — secretas
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# App
ADMIN_EMAILS=jean.silva@b2agencia.com.br
PORT=3000
```

## 12. Fora de escopo (YAGNI — v1)

- Pagamento integrado / gateway (Pix é manual e externo).
- Múltiplas salas/grupos.
- Integração com API de futebol (admin cadastra manual).
- Temporadas com reset de ranking (premiação é por jogo).
- Notificações push / e-mail.
- App mobile nativo (é web responsivo).

## 13. Questões em aberto

Nenhuma — todos os pontos foram confirmados pelo usuário:
- Empate na premiação: valor arrecadado dividido igualmente entre os vencedores, exibindo o Pix de todos (item 6).
- Bandeiras na v1 são **emoji**; escudos/imagens ficam para versão futura.
- Palpites alheios só ficam visíveis após a trava do jogo.
- Fundo do login: animação do Paquetá "levando bolada" (`bg_login.webp`).
