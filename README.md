# DukeFarm Backend

Node.js + TypeScript + Express backend that powers the DukeFarm catfish production platform. The service exposes a layered architecture (routes → controllers → services → repositories) and uses Prisma ORM with PostgreSQL plus Google Weather API integration for pond-level weather insights.

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
    farms.controller.ts
    health.controller.ts
    lineAuth.controller.ts
    ponds.controller.ts
    stats.controller.ts
    weather.controller.ts
  middlewares/
    auth.middleware.ts
    errorHandler.ts
  repositories/
    pond.repository.ts
  routes/
    index.ts
    auth.routes.ts
    farms.routes.ts
    ponds.routes.ts
    stats.routes.ts
    v1/
      index.ts
      health.routes.ts
      weather.routes.ts
  services/
    access.service.ts
    farms.service.ts
    health.service.ts
    lineAuth.service.ts
    ponds.service.ts
    stats.service.ts
    weather.service.ts
  types/
    farm.ts
    pond.ts
  utils/
    jwt.ts
    lineApi.ts
    logger.ts
    number.ts
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

# List farms for the authenticated user
curl http://localhost:4000/api/farms `
  -H "Authorization: Bearer <your-token>"

# Create a farm
curl -X POST http://localhost:4000/api/farms `
  -H "Authorization: Bearer <your-token>" `
  -H "Content-Type: application/json" `
  -d '{
        "name": "Demo Farm",
        "farmType": "GROWOUT",
        "province": "Chiang Mai",
        "latitude": 18.795278,
        "longitude": 99.732778
      }'

# List ponds within a farm (replace <farmId>)
curl http://localhost:4000/api/farms/<farmId>/ponds `
  -H "Authorization: Bearer <your-token>"
```

Tips:


# Fetch home overview for nursery-small farms
curl http://localhost:4000/api/home/groups/NURSERY_SMALL `
  -H "Authorization: Bearer <your-token>"
- All routers are mounted under `/api`, so `/auth`, `/farms`, `/ponds`, and `/cycles` live at `/api/...` paths.
- Unauthorized requests return `401`; lacking permissions (e.g., accessing another user's farm) returns `403`, confirming the access guards are working.
- You can keep using `localhost` for everyday development; ngrok is required only for LINE's callback.
- Pond weather now reuses the parent farm's coordinates. Remember to set `latitude`/`longitude` on each farm; pond payloads no longer accept their own location fields.
- Home overview supports group values `NURSERY_SMALL`, `NURSERY_LARGE`, and `GROWOUT`; pick the one that matches the farm type you want to display on the dashboard.

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
