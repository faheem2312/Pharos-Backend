# Backend

NestJS + Drizzle ORM + Neon Postgres. Built to run on Google Cloud Run.

## What's implemented so far

- **Auth**: register/login/refresh/logout with JWT access tokens (15min) + rotating
  refresh tokens (7 days). Refresh tokens are stored as SHA-256 hashes, never in
  plaintext. Reusing a revoked refresh token triggers revocation of *all* sessions
  for that user (a strong signal of token theft).
- **Password security**: bcrypt, 12 rounds.
- **RBAC**: `@Roles('owner', 'admin')` decorator + `RolesGuard`, stacked on top of
  `JwtAuthGuard`. See `users.controller.ts` for an example.
- **Rate limiting**: global default (20 req/min) via `@nestjs/throttler`, with a
  tighter override on `/auth/login` (5 req/min) since it's a brute-force target.
- **Validation**: `class-validator` DTOs + a global `ValidationPipe` that strips
  unknown fields (`whitelist: true`) and rejects requests containing them
  (`forbidNonWhitelisted: true`).
- **Structured errors**: a global exception filter normalizes every thrown error
  into one JSON shape and logs 5xx errors server-side without leaking stack
  traces to the client.
- **Soft deletes**: `users.deletedAt` — nothing in this schema is ever hard-deleted.

## Local setup

```bash
npm install
cp .env.example .env
# then fill in DATABASE_URL from your Neon dashboard, and generate secrets:
openssl rand -base64 32   # run twice, once for each JWT secret

npm run db:generate   # generate SQL migration from schema.ts
npm run db:migrate    # apply it to your Neon database

npm run start:dev
```

Test it:

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123","name":"You"}'

curl http://localhost:8080/users/me \
  -H "Authorization: Bearer <accessToken from above>"
```

## Deploying to Cloud Run

```bash
# one-time setup
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com

# build + deploy (from the backend/ directory)
gcloud run deploy backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=...,JWT_ACCESS_SECRET=...,JWT_REFRESH_SECRET=..." \
  --port 8080
```

Use `us-central1`, `us-east1`, or `us-west1` — the Cloud Run free tier only
applies in those regions. Never hardcode the port; Cloud Run injects `PORT`
at runtime and `main.ts` already reads `process.env.PORT`.

For secrets beyond local dev, prefer Google Secret Manager over
`--set-env-vars` (`gcloud run deploy --set-secrets=...`) — plaintext env vars
show up in `gcloud run services describe` output.

## What's next

- `modules/` — this is where the rest of the showcase concepts land: a
  `logs`/`events` module for full-text search over Postgres `tsvector`, a
  `jobs` module wired to Upstash Redis/BullMQ, WebSocket gateway for
  real-time dashboard updates, Stripe webhook handler, file uploads to R2.
- Swap `ThrottlerModule`'s in-memory store for a Redis store once Upstash is
  wired in, so rate limits are consistent across multiple Cloud Run instances
  (right now each instance tracks its own counters independently).
