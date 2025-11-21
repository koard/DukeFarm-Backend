# DukeFarm API Specification

_Last updated: 2025-11-21_

## Overview
- **Base URL:** `/api`
- **Auth:** Bearer JWT issued after LINE login (see auth endpoints). Attach via `Authorization: Bearer <token>`.
- **Content type:** JSON for both request bodies and responses.
- **Response envelope:** Successful business responses use `{ "data": <payload> }` unless noted (e.g., `GET /auth/line/login`). Errors use `{ "message": string }` plus optional validation details.
- **Roles:** `ADMIN`, `FARMER`, `RESEARCHER`. Role middleware re-fetches the latest role from the database before authorizing each request.

## Endpoint Matrix
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/auth/line/login` | Public | Generate LINE Login URL + state nonce. |
| GET | `/auth/line/callback` | Public | Exchange LINE authorization code for JWT + user payload. |
| GET | `/v1/health` | Public | Service + DB readiness probe. |
| GET | `/home/groups/:groupType` | Auth (any) | Farm-group overview dashboard for the authenticated owner. |
| GET | `/farms` | Auth + `ADMIN`/`FARMER`/`RESEARCHER` | List farms (limited to owner unless admin). |
| POST | `/farms` | Auth + `ADMIN`/`FARMER` | Create a farm owned by requester. |
| GET | `/farms/:id` | Auth + `ADMIN`/`FARMER`/`RESEARCHER` | Fetch a farm. Non-admins restricted to their own farms. |
| PATCH | `/farms/:id` | Auth + `ADMIN`/`FARMER` | Update mutable farm fields. |
| GET | `/farms/:farmId/ponds` | Auth + `ADMIN`/`FARMER` | List ponds for a farm (ownership enforced). |
| POST | `/farms/:farmId/ponds` | Auth + `ADMIN`/`FARMER` | Create pond under a farm. |
| GET | `/ponds/:id` | Auth + `ADMIN`/`FARMER` | Fetch pond (ownership enforced). |
| PATCH | `/ponds/:id` | Auth + `ADMIN`/`FARMER` | Update pond metadata. |
| GET | `/ponds/:id/weather` | Auth + `ADMIN`/`FARMER` | Live weather snapshot (requires farm coordinates). |
| GET | `/cycles/:id/stats` | Auth + `ADMIN`/`FARMER`/`RESEARCHER` | Aggregated production-cycle KPIs (FCR, survival, etc.). |
| GET | `/v1/weather?lat&lng` | Auth (any) | Weather lookup by coordinates (Google Weather proxy). |

> **Note:** Express also exposes `GET /healthz` outside `/api` for container orchestration probes.

## Authentication & User Session
### GET `/auth/line/login`
Returns the LINE authorization URL plus the server-generated `state`. The client must persist `state` and send it back to `/auth/line/callback`.
```json
{
  "url": "https://access.line.me/oauth2/v2.1/authorize?response_type=code&..."
}
```

### GET `/auth/line/callback?code=...&state=...`
- Validates `state`, exchanges the code for LINE profile, then upserts `users` row.
- Response:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "displayName": "LINE User",
    "pictureUrl": "https://profile.line.me/...",
    "role": "UNASSIGNED",
    "registrationStatus": "PENDING"
  }
}
```
- JWT payload fields: `sub`, `provider`, `displayName`, optional `pictureUrl`, `role`, `registrationStatus`. Token TTL = 7 days.

## Health & Diagnostics
### GET `/v1/health`
Checks DB connectivity.
```json
{
  "status": "ok",
  "database": "connected",
  "uptimeSeconds": 123.45,
  "host": "api-hostname"
}
```

### GET `/healthz`
Lightweight unauthenticated probe returning `{ "status": "ok" }` when the server is responsive.

## Home Dashboard
### GET `/home/groups/:groupType`
- **Auth:** any logged-in user.
- **Path params:** `groupType` must be one of `NURSERY_SMALL`, `NURSERY_LARGE`, `GROWOUT` (case-insensitive).
- **Behavior:** Aggregates recent `daily_records`, computes average water temperature, attaches preset feeding tips, and fetches weather using the first farm in the group that has coordinates.
- **Response:**
```json
{
  "data": {
    "group": "NURSERY_SMALL",
    "hasData": true,
    "summary": {
      "asOf": "2025-11-20T10:15:00.000Z",
      "averageWaterTemperatureC": 29.5,
      "alertLevel": "warning",
      "alertMessage": "อุณหภูมิสูงกว่าช่วงแนะนำ 1.5°C เพิ่มการถ่ายน้ำและให้ออกซิเจน",
      "tips": ["รักษา DO ให้อยู่เหนือ 5 mg/L"],
      "weather": {
        "time": "2025-11-20T10:10:00Z",
        "temperatureC": 30.2,
        "humidityPct": 78,
        "windSpeedKph": 12.1,
        "rainMm": 0.0,
        "conditionText": "Partly Cloudy"
      }
    },
    "feedingRecommendation": {
      "stageLabel": "16-30 วัน",
      "biomassRangeKg": "0.01 - 0.02",
      "notes": ["ให้อาหารวันละ 4-5 มื้อ ปรับตามพฤติกรรมกิน"]
    },
    "recentDailyRecords": [
      {
        "recordDate": "2025-11-20T10:15:00.000Z",
        "waterTemperatureC": 30.1,
        "dissolvedOxygenMgL": 5.8,
        "ph": 7.6,
        "ammoniaMgL": 0.02,
        "nitriteMgL": 0.01
      }
    ]
  }
}
```
- When the user has no farms in that group, `hasData` is `false`, `recentDailyRecords` is empty, and `summary.alertMessage` explains the missing data.

## Farms API
### GET `/farms`
- **Auth:** `ADMIN`, `FARMER`, `RESEARCHER`.
- **Behavior:** Admin sees all farms; others only see farms where `ownerId == user.id`.
- **Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "ownerId": "uuid",
      "name": "Khlong Luang Demo",
      "farmType": "GROWOUT",
      "address": "...",
      "province": "Pathum Thani",
      "latitude": 14.077,
      "longitude": 100.608,
      "areaM2": "3200.00",
      "createdAt": "2025-11-15T07:00:00.000Z",
      "updatedAt": "2025-11-15T07:00:00.000Z"
    }
  ]
}
```

### POST `/farms`
- **Auth:** `ADMIN`, `FARMER`.
- **Body:**
```json
{
  "name": "Farm A",
  "farmType": "NURSERY_SMALL",
  "address": "optional",
  "province": "optional",
  "latitude": 14.077,
  "longitude": 100.608,
  "areaM2": 3200
}
```
- **Validation:** `name` and `farmType` required; `farmType` must match listed values; numeric fields must parse to numbers.
- **Response:** `201 Created` with `{ "data": <farm> }` (same shape as GET).

### GET `/farms/:id`
- **Auth:** `ADMIN`, `FARMER`, `RESEARCHER` (non-admin must own the farm).
- **Response:** `{ "data": <farm> }` or `404` if inaccessible/not found.

### PATCH `/farms/:id`
- **Auth:** `ADMIN`, `FARMER` (owner).
- **Body:** Any subset of fields from POST payload; at least one valid field is required.
- **Response:** `{ "data": <updated farm> }`.

## Ponds API
### GET `/farms/:farmId/ponds`
- **Auth:** `ADMIN`, `FARMER` (must own farm).
- **Response:** `{ "data": [<pond>] }` where pond shape matches Prisma `Pond` plus timestamps.

### POST `/farms/:farmId/ponds`
- **Auth:** `ADMIN`, `FARMER` (must own farm).
- **Body:**
```json
{
  "name": "Pond 1",
  "pondType": "EARTHEN",
  "areaM2": 1200,
  "maxDepthM": 1.5,
  "notes": "optional"
}
```
- **Response:** `201 Created` with `{ "data": <pond> }`.

### GET `/ponds/:id`
- **Auth:** `ADMIN`, `FARMER` (must have access via owning farm).
- **Response:** `{ "data": <pond> }`.

### PATCH `/ponds/:id`
- **Auth:** `ADMIN`, `FARMER`.
- **Body:** Any combination of `name`, `pondType`, `notes`, `areaM2`, `maxDepthM`. Must include at least one valid field.
- **Response:** `{ "data": <updated pond> }`.

### GET `/ponds/:id/weather`
- **Auth:** `ADMIN`, `FARMER` (must own pond/farm).
- **Response:**
```json
{
  "pondId": "uuid",
  "location": { "latitude": 14.077, "longitude": 100.608 },
  "weather": {
    "time": "2025-11-20T10:00:00Z",
    "temperatureC": 30.2,
    "humidityPct": 78,
    "windSpeedKph": 12,
    "rainMm": 0,
    "conditionText": "Partly Cloudy"
  }
}
```
- Returns `400` if the farm lacks coordinates.

## Production Cycle Stats
### GET `/cycles/:id/stats`
- **Auth:** `ADMIN`, `FARMER`, `RESEARCHER` (researchers may access via `AccessService.ensureCycleAccess`).
- **Response:**
```json
{
  "data": {
    "cycleId": "uuid",
    "pondId": "uuid",
    "totalFeedKg": 1520.5,
    "firstWeightKg": 0.09,
    "lastWeightKg": 0.32,
    "fcr": 1.95,
    "survivalRatePct": 89.4
  }
}
```
- `fcr`/`survivalRatePct` become `null` if insufficient inputs (e.g., missing growth measurements or `initialStockCount`).

## Weather Proxy
### GET `/v1/weather?lat=<number>&lng=<number>`
- **Auth:** any authenticated user.
- **Query params:** both required, numeric.
- **Response:** `{ "data": CurrentWeather }` from `WeatherService.getCurrentWeather` (same shape as in Home dashboard weather block).

## Error Handling
- `401` if JWT missing/invalid.
- `403` if role not permitted.
- `404` if resource not found or user lacks ownership.
- `400` for validation issues; message text comes from controller-level validation helpers.
- `5xx` bubbled by global `errorHandler` with `{ "message": string }`.

## How to Keep Specs In Sync
1. Whenever a route/controller changes (new path, params, response shape), update this document in the same PR.
2. Add new sections for additional modules (e.g., onboarding, profile flows) following the same structure.
3. For breaking changes, include migration notes (versioned bullets) near the affected section.
