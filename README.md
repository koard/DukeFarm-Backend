# DukeFarm Backend

Node.js + TypeScript + Express backend that powers the DukeFarm catfish production platform. The service exposes a layered architecture (routes → controllers → services → repositories) and uses Prisma ORM with PostgreSQL plus Open-Meteo API integration for weather data.

## Tech Stack

- Node.js (TypeScript)
- Express 5
- Prisma ORM + PostgreSQL
- JWT authentication via LINE Login OAuth
- Open-Meteo Weather API (free, no API key required)

## Prerequisites

- Node.js 22+
- PostgreSQL 14+
- LINE Login channel (LINE Developers Console)

## Setup

```powershell
# 1. Install dependencies
npm install

# 2. Copy environment template
copy .env.example .env
#    (update DATABASE_URL, JWT_SECRET, LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, LINE_REDIRECT_URI, FRONTEND_CALLBACK_URL)

# 3. Generate Prisma client & create DB schema
npm run prisma:generate
npm run prisma:migrate
```

### Running PostgreSQL with Docker

If you don't have a local PostgreSQL instance, you can spin up one quickly with Docker:

```powershell
docker run --name dukefarm-postgres ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=dukefarm ^
  -p 5432:5432 ^
  -v ${PWD}/postgres-data:/var/lib/postgresql/data ^
  -d postgres:14
```

- Adjust the credentials/DB name if your `.env` uses different values.
- The mounted `${PWD}/postgres-data` folder persists data across container restarts. On PowerShell 5.1, `${PWD}` expands to the current directory path.
- Once the container is running, set `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dukefarm?schema=public"` and run the Prisma commands above.

### LINE Login + ngrok quickstart

1. Start the backend locally:

  ```powershell
  npm run dev
  ```

2. Expose the local server to LINE using ngrok (install ngrok first):

  ```powershell
  ngrok http 4000
  ```

3. Take the HTTPS forwarding URL (`https://<random>.ngrok-free.app`) and set:
  - `LINE_REDIRECT_URI=https://<random>.ngrok-free.app/api/auth/line/callback` in `.env`.
  - The exact same callback URL inside the LINE Developers Console (LINE Login tab → Callback URL → Update).

4. Restart `npm run dev` so the new env vars load, then hit `GET http://localhost:4000/api/auth/line/login` to receive a login URL. Open it in a browser, complete LINE login, and the backend will return `{ token, user }` at `/api/auth/line/callback`.

5. Save the JWT token from the response; use it as a Bearer token for all protected endpoints.

## Useful Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server with hot reload (ts-node-dev). |
| `npm run build` | Type-check and emit JS to `dist/`. |
| `npm start` | Run compiled server from `dist/`. |
| `npm run lint` | Type-check only (no emit). |
| `npm run prisma:generate` | Regenerate Prisma client from schema. |
| `npm run prisma:migrate` | Create/apply database migrations (interactive). |

## Testing the API

Once you have a JWT token (via LINE Login), you can exercise endpoints directly on `http://localhost:4000` or via your ngrok URL. Examples below use PowerShell's `curl` alias; swap in Postman or any HTTP client you prefer.

```powershell
# Health check (no auth)
curl http://localhost:4000/healthz

# Fetch home overview for nursery-small farms
curl http://localhost:4000/api/home/groups/NURSERY_SMALL `
  -H "Authorization: Bearer <your-token>"
```

Tips:

- All routers are mounted under `/api`, so `/auth`, `/home`, `/onboarding`, and `/cycles` live at `/api/...` paths.
- Unauthorized requests return `401`; lacking permissions returns `403`, confirming the access guards are working.
- You can keep using `localhost` for everyday development; ngrok is required only for LINE's callback.
- Farmer onboarding now captures farm metadata (including coordinates) directly on the user record; standalone farm/pond CRUD endpoints have been retired.
- Home overview supports group values `NURSERY_SMALL`, `NURSERY_LARGE`, and `GROWOUT`; pick the one that matches the farm type you want to display on the dashboard.

## Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `JWT_SECRET` | Symmetric secret for signing + verifying JWT tokens. |
| `LINE_CHANNEL_ID` | LINE Login channel ID. |
| `LINE_CHANNEL_SECRET` | LINE Login channel secret. |
| `LINE_REDIRECT_URI` | Callback URL registered with LINE Login (e.g. `https://your-domain.com/api/auth/line/callback`). |
| `FRONTEND_CALLBACK_URL` | Frontend URL where users are redirected after LINE login (e.g. `http://localhost:3000/auth/callback`). |
| `PORT` | (Optional) HTTP port, defaults to 4000. |
| `NODE_ENV` | `development`, `test`, or `production`. |

**Note:** Weather data is provided by Open-Meteo API (https://open-meteo.com), which is free and doesn't require an API key.

## First Run Checklist

1. Provision a PostgreSQL database and set `DATABASE_URL` in `.env`.
2. Register a LINE Login channel and configure callback URL in LINE Developers Console.
3. Set LINE credentials (`LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_REDIRECT_URI`) in `.env`.
4. Run `npm run prisma:migrate` to create tables defined in `prisma/schema.prisma`.
5. Start the API locally with `npm run dev` and hit `GET http://localhost:4000/api/v1/health` to verify.

**Weather Data:** The app uses Open-Meteo API for weather forecasts. No API key setup required - it's free and unlimited.
