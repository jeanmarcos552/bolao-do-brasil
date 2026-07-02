# CI/CD — build no GitHub Actions, deploy no VPS via GHCR + SSH

Data: 2026-07-02

## Objetivo

Automatizar o caminho do código até produção. Hoje o app é copiado para o VPS,
buildado lá (`docker build` → `bolao:latest`) e subido com `docker run`. A meta:
todo push no `master` roda testes, builda a imagem no CI, publica no GitHub
Container Registry (GHCR) e atualiza o container no VPS via `docker compose` —
sem passos manuais e sem buildar no servidor.

## Ambiente real (VPS Bitnami)

- Usuário `bitnami`, apps em `/home/bitnami/apps/`.
- App do bolão: código em `/home/bitnami/apps/bolao/` (sem `.git`; hoje é
  copiado e buildado lá).
- Env de servidor: `/home/bitnami/apps/bolao.env` (arquivo já existente).
- Container atual `bolao`: imagem local `bolao:latest`, `127.0.0.1:3002->3002`,
  `restart: unless-stopped`, rede bridge padrão, **sem volumes**.
- Já existe GHCR+pull funcionando na mesma máquina (container `portfolio` roda
  `ghcr.io/jeanmarcos552/jeansilva.app.br:latest`) — o padrão está validado.
- `docker compose` v2 (v2.40.3) disponível.

## Decisões (confirmadas com o dono)

- **Host:** VPS próprio Bitnami (SSH + Docker).
- **Entrega:** GitHub Actions builda → publica no **GHCR** → conecta por **SSH**
  no VPS só para `docker compose pull` + recriar o container. O VPS não builda.
- **Ciclo do container:** `docker compose` em `~/apps/bolao` (declarativo).
- **Gatilho:** `push` no `master`.
- **Quality gate:** `vitest run` (150 testes) + `tsc --noEmit` antes de buildar.
  Não usamos `next lint` (não configurado; trava em prompt interativo).
- **Visibilidade da imagem:** pacote **privado** no GHCR. O VPS faz um
  `docker login ghcr.io` **efêmero** a cada deploy usando o `GITHUB_TOKEN`
  passado pelo SSH — sem token de longa duração no servidor.
- **Bind da porta:** `127.0.0.1:3002` (igual ao atual; Apache do Bitnami termina
  o TLS de `bolao.jeansilva.app.br`). Proxy não muda.

## Arquitetura

```
push master ─▶ [test] ─▶ [build-and-push → GHCR] ─▶ [deploy → SSH no VPS]
```

Três jobs encadeados (`needs`); cada um só roda se o anterior passar.

### Job `test`
Node 22 (igual ao Dockerfile) → `npm ci` → `npx tsc --noEmit` → `npm test`.

### Job `build-and-push`
- `docker/build-push-action` com buildx + cache do Actions (`type=gha`).
- `NEXT_PUBLIC_*` passadas como `--build-arg` (secrets do repo) porque são
  inlinadas no bundle do cliente em build-time.
- Publica em `ghcr.io/jeanmarcos552/bolao-do-brasil` com duas tags:
  `latest` e `sha-<commit-curto>` (a tag de sha permite rollback imutável).
- Login no GHCR pelo `GITHUB_TOKEN` nativo (`packages: write`).
- Expõe `image_tag` como output do job para o deploy consumir.

### Job `deploy`
- `scp` do `docker-compose.yml` (versionado no repo) para `~/apps/bolao/` —
  assim mudanças no compose propagam sozinhas.
- SSH no VPS executa:
  ```sh
  cd ~/apps/bolao
  echo "IMAGE_TAG=<sha>" > .env                 # interpolação do compose
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
  docker compose pull
  docker compose up -d
  docker image prune -f
  ```

## Arquivos versionados

- `.github/workflows/deploy.yml` — o pipeline.
- `docker-compose.yml` — serviço `web`: imagem do GHCR (tag via `${IMAGE_TAG}`),
  `container_name: bolao`, `restart: unless-stopped`, `env_file: [../bolao.env]`,
  `ports: 127.0.0.1:3002:3002`.

## Separação de segredos

| Onde | Quais | Como chega |
|------|-------|------------|
| GitHub Secrets (build) | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_WS_URL` | `--build-arg` no build (viram públicas no bundle) |
| GitHub Secrets (SSH) | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT` (opcional) | ações de SSH/SCP |
| VPS `~/apps/bolao.env` (já existe) | `FIREBASE_ADMIN_*`, `WS_PUBLISH_URL`, `WS_API_KEY`, `ADMIN_EMAILS` | `env_file` do compose (runtime); **nunca no git** |
| VPS `~/apps/bolao/.env` | `IMAGE_TAG` | escrito pelo CI a cada deploy |

## Setup manual único (fora do CI)

1. **Secrets do repo** (Settings → Secrets and variables → Actions): os 5
   `NEXT_PUBLIC_*` e `VPS_HOST` / `VPS_USER` (`bitnami`) / `VPS_SSH_KEY` /
   `VPS_PORT`.
2. **Chave SSH dedicada ao deploy:** par novo (`ssh-keygen -t ed25519`), pública
   no `~/.ssh/authorized_keys` do VPS, privada no secret `VPS_SSH_KEY`.
3. **Reaproveitar a env:** nada a criar — o compose usa `../bolao.env`, que já
   existe em `/home/bitnami/apps/bolao.env`.

## Cutover `docker run` → `docker compose` (uma única vez)

O container atual `bolao` foi criado por `docker run` (sem labels de compose).
O compose usa `container_name: bolao` e a mesma porta 3002, então o primeiro
`docker compose up -d` conflita com o container antigo. Passo único:

1. Setar os secrets e dar `git push` (CI builda e publica a imagem no GHCR; o
   deploy vai falhar no `up` por conflito de nome/porta — **produção segue no ar**
   pelo container antigo).
2. No VPS: `docker rm -f bolao` (remove o container antigo).
3. Re-executar o job `deploy` no Actions (Re-run failed jobs). O `up` cria o
   novo `bolao` a partir do GHCR. Downtime ~segundos.

Depois disso, todo push no master atualiza sozinho. O código-fonte em
`~/apps/bolao/` e a imagem `bolao:latest` local ficam vestigiais (podem ser
removidos depois; opcional).

## Rollback

Editar `~/apps/bolao/.env` trocando `IMAGE_TAG` por um sha antigo e rodar
`docker compose up -d`. As imagens antigas ficam no GHCR até serem removidas.

## Verificação

Pipeline não tem teste unitário próprio. Validação = primeira execução real:
os 3 jobs verdes no Actions e a versão nova no ar em `bolao.jeansilva.app.br`.
Localmente dá para conferir a sintaxe do YAML e buildar a imagem antes do push.
