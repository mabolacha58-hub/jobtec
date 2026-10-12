# JOBTEC

Marketplace that connects clients with local professionals (Mozambique). React SPA
on Vite + Tailwind v4, backed by a single Vercel serverless function on Neon Postgres.

## Commands

```bash
npm run dev        # Vite dev server on $PORT (default 5173), proxies /api -> API_PORT
npm run api        # Wraps the serverless handler in a local HTTP server (API_PORT, default 3000)
npm run build      # Production build to dist/
npm run typecheck  # tsc for src/ AND api/ — run before committing
npm run test:api   # Integration script against the real DB (notif-teste.mts)
npm run format     # oxfmt
```

`npm run dev` and `npm run api` are **two separate processes**; run both or the
frontend gets "O servidor de autenticação não está disponível".

## Layout

### Backend — `api/[...route].ts`

One catch-all serverless function (~1600 lines) routing on `req.url`. It creates the
schema on boot via `ensureDb()`, so there is no migration step.

| Route | Handler | Notes |
| --- | --- | --- |
| `/api/register`, `/api/login`, `/api/me` | `hRegister` / `hLogin` / `hMe` | JWT in `Authorization: Bearer`. `PATCH /api/me` is self-service profile (nome, telefone, provincia, cidade, foto_perfil) |
| `/api/profissionais`, `/api/servicos` | `hProfissionais` / `hServicos` | `?id=` for a single row |
| `/api/propostas` | `hPropostas` | Accepting one creates a contract |
| `/api/contratos` | `hContratos` | Phases: `proposed` → `hired` → `completed`/`cancelled` |
| `/api/avaliacoes` | `hAvaliacoes` | Also recomputes the professional's average |
| `/api/notificacoes` | `hNotificacoes` | `?action=count` for the unread badge |
| `/api/admin?action=...` | `hAdmin` | metrics, profissionais, usuarios, servicos |
| `/api/password-reset?action=pedir\|confirmar` | `hPasswordReset` | Resend email |
| `/api/seed` | `hSeed` | Locked in production, needs `SEED_TOKEN` |

Auth details worth knowing:
- `ADMIN_EMAILS` is split on commas into an **array**; `.includes()` is exact-match.
- Rate limiting via `rl()` keys on IP and on email separately.
- `IS_PROD = process.env.VERCEL_ENV === 'production'`. **Use `IS_PROD`, never
  `process.env.NODE_ENV`** — `NODE_ENV` is unset on self-hosted deploys, which would
  make the password-reset route return a live `debugLink` token.

`api/tsconfig.json` is separate from the root one and is **not** covered by
`npm run build`. Only `npm run typecheck` checks it.

### Frontend — `src/`

- `main.tsx` — mounts `App` inside `StoreProvider`
- `App.tsx` — router; code-splits the pages below
- `context/store.tsx` — central store. **Dual data layer**: talks to the API and
  falls back to `localStorage` via `src/db/*` when the backend is unreachable.
- `api/client.ts` — typed `fetch` wrapper. Token and user live in `localStorage`
  (`jdb.token`, `jdb.user`). Base URL is `VITE_API_BASE || '/api'`.
- `db/` — `db.ts` (localStorage tables), `adapters.ts`, `schema.ts`, `seed.ts`
- `data.ts` — static seed content (categories, professionals, recentJobs) used by
  the landing page and the fallback layer
- `pages/` — `Landing`, `Explore`, `Dashboard`, `Profile`, `PostService`,
  `ProfessionalSignup`, `Settings`, `AdminPanel`, `HowItWorks`
- `pages/Profile.tsx` is the **public** profile of a professional (reached with
  `navigate('profile', pro.id)`), not the signed-in user's own account. Their
  own data lives in `pages/Settings.tsx`.
- `imports/` — two JPEG logos imported as modules so Vite hashes and optimizes
  them. Keep them here rather than in `public/`; moving them drops content hashing.

### Profile photo

There is no file storage. `Settings.tsx` crops the image to 400x400 and
recompresses it to JPEG in the browser, then `PATCH /api/me` stores the result as
a **data URI** in a `TEXT` column. Consequences worth knowing before changing it:

- `foto_perfil` exists on **both** `users` and `profissionais`, and they are read
  from different places — `hProfissionais` selects `p.*`, while notifications and
  reviews select `u.foto_perfil`. The route writes both so the same person does
  not show two different photos depending on the page.
- The server validates the data URI prefix and rejects anything over 2 MB. Do not
  drop that check: the column is `TEXT` and the value reaches an `<img src>`.
- The localStorage layer (`db/schema.ts`) only has `foto_perfil` on `User`, so
  `updateProfile` writes a single row there but two on the server.

## Environment

`.env.local` (gitignored). Only two are set locally today:

| Variable | Required | Effect if missing |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pool fails to connect |
| `JWT_SECRET` | yes | Tokens cannot be signed |
| `ADMIN_EMAILS` | prod | Falls back to a hardcoded address in the source |
| `RESEND_API_KEY` / `RESEND_FROM` | for email | Reset link only goes to stderr |
| `SEED_TOKEN` | prod seed | `/api/seed` returns 500 |
| `PUBLIC_URL` | recommended | Reset links derived from request host |
| `API_PORT` | dev | Defaults to 3000; must match the Vite proxy |
| `VITE_API_BASE` | no | Defaults to `/api` |
| `VITE_ENABLE_API` | dev | **Must be `'true'` to hit the API outside a production build** — see below |
| `VITE_SEED_TOKEN` | no | Needed to call `/api/seed` from the UI |

`store.tsx` decides between the two data layers with
`shouldUseServerApi = import.meta.env.VITE_ENABLE_API === 'true' || import.meta.env.PROD`.
So `npm run dev` talks to **localStorage only** unless `VITE_ENABLE_API=true` is
set — edits appear to save and then vanish on reload, which looks like a backend
bug but is the fallback layer working as designed.

Do not reuse `PORT` for the API server — Vite reads it too and runs with
`strictPort`, so the two processes collide.

## Conventions

- Tailwind v4 via `@tailwindcss/vite`; global CSS and theme overrides go in
  `src/index.css`. No Tailwind or PostCSS config file.
- Format with `oxfmt`, not Prettier. Run `npm run format` before committing.
- Comments and user-facing strings are in European Portuguese.
- `api/[...route].ts` is camelCase on the API boundary (`servicoTitulo`,
  `criadaEm`) and snake_case on the DB columns. `src/api/client.ts` holds the
  interfaces that bridge the two — update it whenever a response shape changes.