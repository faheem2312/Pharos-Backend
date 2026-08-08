# Pharos Backend — Enterprise Cloud Ops & Observability Microservice API

[![Live API Status](https://img.shields.io/badge/Live_API-Online-22c55e?style=for-the-badge&logo=render)](https://pharos-backend-blcm.onrender.com/health)
[![Frontend Repository](https://img.shields.io/badge/Frontend_Repo-Pharos--Frontend-10b981?style=for-the-badge&logo=github)](https://github.com/faheem2312/Pharos-Frontend)
[![Live Frontend App](https://img.shields.io/badge/Live_App-pharos--frontend.vercel.app-000000?style=for-the-badge&logo=vercel)](https://pharos-frontend-nine.vercel.app)

**Pharos Backend** is a production-ready, high-performance NestJS microservice API powering real-time cloud observability, log management, secure authentication, direct-to-cloud asset uploads, and rate-limited event streaming.

---

## 🔗 Repository & Live Deployment Links

- **Frontend GitHub Repository**: [https://github.com/faheem2312/Pharos-Frontend](https://github.com/faheem2312/Pharos-Frontend)
- **Backend GitHub Repository**: [https://github.com/faheem2312/Pharos-Backend](https://github.com/faheem2312/Pharos-Backend)
- **Live Frontend App**: [https://pharos-frontend-nine.vercel.app](https://pharos-frontend-nine.vercel.app)
- **Live Backend API**: [https://pharos-backend-blcm.onrender.com](https://pharos-backend-blcm.onrender.com)
- **Backend Health Check**: [https://pharos-backend-blcm.onrender.com/health](https://pharos-backend-blcm.onrender.com/health)

---

## 🚀 Key Features & Architecture

### 1. Advanced Session Security & Token Theft Defense
- **Rotating Refresh Tokens**: Issues 15-minute access tokens and 7-day rotating refresh tokens via `httpOnly` cookies.
- **SHA-256 Hashing**: Refresh tokens are stored strictly as SHA-256 hashes—never in plain text.
- **Token Reuse Detection**: Attempting to reuse a revoked refresh token triggers automatic revocation of **all active sessions** for that user.
- **Password Security**: Bcrypt with 12 rounds.

### 2. High-Speed Full-Text Log Search
- Leverages **Postgres GIN Indexing (`to_tsvector('english', message)`)** on Neon PostgreSQL.
- Provides sub-millisecond regex and token search over system audit logs without needing external Elasticsearch clusters.

### 3. Direct-to-Cloud Storage (Zero-Server-Load Presigned Uploads)
- Integrates with **Cloudflare R2 / AWS S3 SDK** (`@aws-sdk/s3-request-presigner`).
- Issues cryptographically signed short-lived S3 upload URLs, streaming binary files **directly from browser to Cloudflare R2 object storage**.

### 4. Distributed Rate Limiting & Protection
- Powered by **Upstash Redis + `@upstash/ratelimit`**.
- Enforces a global 20 req/min limit, with a strict 5 req/min throttle on `/auth/login` to defeat brute-force credential attacks.

### 5. Asynchronous Background Queues & Real-Time Streaming
- **BullMQ + Redis**: Asynchronous job queue processing (welcome emails, audit indexing).
- **Socket.IO WebSockets**: Real-time event streaming and live system health notifications.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | NestJS (TypeScript), Express | Modular microservice API architecture |
| **Database** | Neon PostgreSQL | Serverless PostgreSQL database |
| **ORM** | Drizzle ORM (`drizzle-orm`, `drizzle-kit`) | Type-safe SQL schema definitions & migrations |
| **Caching & Queue** | Upstash Redis + BullMQ | Distributed rate limiting & background job processing |
| **Object Storage** | Cloudflare R2 / AWS S3 SDK | S3-compatible presigned direct file uploads |
| **Security** | Passport JWT, Bcrypt, Role Guards | RBAC (`owner`, `admin`, `member`) & cookie auth |
| **Observability** | Sentry, Prometheus Metrics | Exception tracking & `/metrics` export |

---

## 📋 API Endpoints Matrix

| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | No | System health check (`{"status": "ok"}`) |
| `POST` | `/auth/register` | No | Register new user account & set httpOnly cookies |
| `POST` | `/auth/login` | No | Authenticate user & set httpOnly cookies |
| `POST` | `/auth/refresh` | No (Cookie) | Rotate refresh token & issue new access token |
| `POST` | `/auth/logout` | Yes | Revoke refresh token & clear cookies |
| `GET` | `/users/me` | Yes | Fetch current user profile & role |
| `GET` | `/logs` | Yes | Query & full-text search system logs |
| `GET` | `/logs/stats` | Yes | Aggregate log metrics & event counts |
| `POST` | `/files/upload-url` | Yes | Generate Cloudflare R2 presigned S3 upload URL |
| `GET` | `/files` | Yes | List user uploaded file records |
| `POST` | `/api-keys` | Yes | Generate new developer API key |
| `GET` | `/api-keys` | Yes | List active developer API keys |
| `DELETE`| `/api-keys/:id` | Yes | Revoke developer API key |
| `GET` | `/realtime/ticket` | Yes | Issue single-use WebSocket connection ticket |
| `GET` | `/metrics` | No | Prometheus telemetry metrics export |

---

## ⚙️ Environment Variables

Create a `.env` file in `backend/` based on `.env.example`:

```env
# Database
DATABASE_URL=postgresql://neondb_owner:password@ep-curly-scene.us-east-1.aws.neon.tech/neondb?sslmode=require

# JWT Secrets
JWT_ACCESS_SECRET=your-access-secret-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-upstash-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
UPSTASH_REDIS_URL=rediss://default:token@your-upstash-redis.upstash.io:6379

# Server Config
PORT=8080
NODE_ENV=development

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=pharos
R2_PUBLIC_URL=https://pub-your-id.r2.dev
```

---

## 💻 Local Setup & Execution

```bash
# 1. Install dependencies
npm install

# 2. Generate and apply SQL schema migrations
npm run db:generate
npm run db:migrate

# 3. Build TypeScript output
npm run build

# 4. Start NestJS Development Server
npm run start:dev
# or production run:
node dist/main.js
```

Backend will run on `http://localhost:8080`.

---

## ☁️ Deployment (Render & Cloud Run)

### Render Web Service Deployment:
1. Create a **Web Service** on [Render](https://dashboard.render.com/) connected to `faheem2312/Pharos-Backend`.
2. Set **Build Command**: `npm install && npm run build`
3. Set **Start Command**: `node dist/main.js`
4. Add Environment Variables in Render dashboard.

### Google Cloud Run Deployment:
```bash
gcloud run deploy pharos-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```
