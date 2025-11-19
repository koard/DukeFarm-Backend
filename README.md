# DukeFarm Backend

Node.js + TypeScript + Express backend that powers the DukeFarm catfish production platform for Betagro and Kasetsart University. The service exposes a layered architecture (routes → controllers → services → repositories) and uses Prisma ORM with PostgreSQL plus Google Weather API integration for pond-level weather insights.

## Tech Stack

- Node.js (TypeScript)
- Express 5
- Prisma ORM + PostgreSQL
- JWT + bcrypt authentication
- Google Maps Platform Weather API (HTTP client via native `fetch`)

## Project Structure

```
src/
  app.ts                # Express application wiring
  server.ts             # HTTP bootstrap + graceful shutdown
  config/
    env.ts              # Environment loading & validation
  clients/
    prisma.ts           # Prisma client singleton
  controllers/
    health.controller.ts
    lineAuth.controller.ts
    weather.controller.ts
  middlewares/
    auth.middleware.ts
    errorHandler.ts
  repositories/
    pond.repository.ts
  routes/
    index.ts
    auth.routes.ts
    v1/
      index.ts
      health.routes.ts
      weather.routes.ts
  services/
    health.service.ts
    lineAuth.service.ts
    weather.service.ts
  utils/
    jwt.ts
    lineApi.ts
    logger.ts
prisma/
  schema.prisma         # Database schema
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Google Maps Platform Weather API key (enable via Google Cloud Console)

## Setup

```powershell
# 1. Install dependencies
npm install

# 2. Copy environment template
copy .env.example .env
#    (update DATABASE_URL, GOOGLE_WEATHER_API_KEY, JWT_SECRET)

# 3. Generate Prisma client & create DB schema
npm run prisma:generate
npm run prisma:migrate
```

## Useful Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server with hot reload (ts-node-dev). |
| `npm run build` | Type-check and emit JS to `dist/`. |
| `npm start` | Run compiled server from `dist/`. |
| `npm run lint` | Type-check only (no emit). |
| `npm run prisma:generate` | Regenerate Prisma client from schema. |
| `npm run prisma:migrate` | Create/apply database migrations (interactive). |

## Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `GOOGLE_WEATHER_API_KEY` | API key for Google Maps Platform Weather API. |
| `JWT_SECRET` | Symmetric secret for signing + verifying JWT tokens. |
| `LINE_CHANNEL_ID` | LINE Login channel ID. |
| `LINE_CHANNEL_SECRET` | LINE Login channel secret. |
| `LINE_REDIRECT_URI` | Callback URL registered with LINE Login (e.g. `https://your-domain.com/api/auth/line/callback`). |
| `PORT` | (Optional) HTTP port, defaults to 4000. |
| `NODE_ENV` | `development`, `test`, or `production`. |

## First Run Checklist

1. Provision a PostgreSQL database and set `DATABASE_URL` in `.env`.
2. Enable Google Maps Platform Weather API and place the key in `.env`.
3. Run `npm run prisma:migrate` to create tables defined in `prisma/schema.prisma`.
4. Seed initial data (users, farms, ponds) using Prisma Studio or a custom seed script.
5. Start the API locally with `npm run dev` and hit `GET http://localhost:4000/api/v1/health` to verify.

## Next Steps

- Flesh out domain modules (users, farms, ponds, production cycles, etc.).
- Add authentication routes (sign-up, login, token refresh).
- Implement background jobs for scheduled pond health alerts.
- Add automated tests (unit + integration) via Vitest or Jest.

Happy building! 🐟
