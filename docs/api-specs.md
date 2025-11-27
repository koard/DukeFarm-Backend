# DukeFarm API Specification

_Last updated: 2025-11-27_

## Overview
- **Base URL:** `/api`
- **Auth:** Bearer JWT issued after LINE login (see auth endpoints). Attach via `Authorization: Bearer <token>`.
- **Content type:** JSON for both request bodies and responses.
- **Response envelope:** Successful business responses use `{ "data": <payload> }` unless noted (e.g., `GET /auth/line/login`). Errors use `{ "message": string }` plus optional validation details.
- **Roles:** `ADMIN`, `FARMER`, `RESEARCHER`. Role middleware re-fetches the latest role from the database before authorizing each request.

## Endpoint Matrix (User Flow Order)
| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/v1/health` | Public | Service + DB readiness probe. |
| GET | `/auth/line/login?role=<optional>` | Public | Generate LINE Login URL with optional role pre-selection. |
| GET | `/auth/line/callback` | Public | Exchange LINE authorization code for JWT + user payload. |
| GET | `/auth/me` | Auth (any) | Get current authenticated user with profile data. |
| POST | `/onboarding/role` | Auth (any) | Select either FARMER or RESEARCHER role from onboarding UI. |
| POST | `/onboarding/farmer` | Auth (any) | Submit farmer-specific onboarding form. |
| POST | `/onboarding/researcher` | Auth (any) | Submit researcher-specific onboarding form. |
| GET | `/home/groups/:groupType` | Auth (any) | Farm-group overview dashboard for the authenticated owner. |
| GET | `/v1/weather?lat&lng` | Auth (any) | Weather lookup by coordinates (Google Weather proxy). |

> **Note:** Express also exposes `GET /healthz` outside `/api` for container orchestration probes.

## User Flow Options

### Flow A: Standard (User selects role after login)
1. **Health Check** → `GET /v1/health` - Verify service availability
2. **Login** → `GET /auth/line/login` - Get LINE OAuth URL (no role parameter)
3. **Callback** → `GET /auth/line/callback` - Exchange code for JWT token (role = UNASSIGNED)
4. **Check Profile** → `GET /auth/me` - Verify user role and registration status
5. **Select Role** → `POST /onboarding/role` - Choose FARMER or RESEARCHER
6. **Complete Profile** → `POST /onboarding/farmer` or `POST /onboarding/researcher`
7. **View Dashboard** → `GET /home/groups/:groupType` - Access main dashboard

### Flow B: Express (Pre-select role at login)
1. **Health Check** → `GET /v1/health` - Verify service availability
2. **Login with Role** → `GET /auth/line/login?role=farmer` - Get LINE OAuth URL with role
3. **Callback** → `GET /auth/line/callback` - Exchange code for JWT token (role = FARMER)
4. **Check Profile** → `GET /auth/me` - Verify registration status (role already set)
5. **Complete Profile** → `POST /onboarding/farmer` - Skip role selection, go straight to profile form
6. **View Dashboard** → `GET /home/groups/:groupType` - Access main dashboard

---

## 1. Health & Diagnostics
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

---

## 2. Authentication & User Session
### GET `/auth/line/login?role=<optional>`
Returns the LINE authorization URL plus the server-generated `state`. The client must persist `state` and send it back to `/auth/line/callback`.

**Query Parameters:**
- `role` (optional): Pre-select user role. Values: `farmer` or `researcher` (case-insensitive)
  - If provided, user will be assigned this role immediately after login
  - If omitted, user role will be `UNASSIGNED` and must select role via `/onboarding/role`

**Examples:**
```bash
# Without role (standard flow - user selects role later)
GET /api/auth/line/login

# With role (skip role selection step)
GET /api/auth/line/login?role=farmer
GET /api/auth/line/login?role=researcher
```

**Response:**
```json
{
  "url": "https://access.line.me/oauth2/v2.1/authorize?response_type=code&..."
}
```

### GET `/auth/line/callback?code=...&state=...`
- Validates `state`, exchanges the code for LINE profile, then upserts `users` row.
- If role was specified in login URL, user will be created/updated with that role.
- Response:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "displayName": "LINE User",
    "pictureUrl": "https://profile.line.me/...",
    "role": "FARMER",
    "registrationStatus": "PENDING"
  }
}
```
- JWT payload fields: `sub`, `provider`, `displayName`, optional `pictureUrl`, `role`, `registrationStatus`. Token TTL = 7 days.
- `role` will be `UNASSIGNED` if no role was specified, or `FARMER`/`RESEARCHER` if pre-selected.

### GET `/auth/me`
- **Auth:** any logged-in user.
- **Response:**
```json
{
  "data": {
    "id": "uuid",
    "lineUserId": "U123...",
    "displayName": "John Doe",
    "pictureUrl": "https://profile.line.me/...",
    "role": "FARMER",
    "registrationStatus": "COMPLETED",
    "createdAt": "2025-11-24T00:00:00.000Z",
    "farmerProfile": {
      "firstName": "John",
      "lastName": "Doe",
      "phone": "0812345678",
      "primaryFarmType": "NURSERY_SMALL",
      "declaredPondCount": 3,
      "farmLatitude": 13.7563,
      "farmLongitude": 100.5018
    },
    "researcherProfile": null
  }
}
```
- Returns complete user data including farmer or researcher profile depending on role.
- `farmerProfile` is `null` if user is not a farmer; `researcherProfile` is `null` if user is not a researcher.

---

## 3. Onboarding & Role Selection
### POST `/onboarding/role`
- **Auth:** any logged-in user (typically `UNASSIGNED`).
- **Body:** `{ "role": "FARMER" | "RESEARCHER" }` (case-insensitive).
- **Behavior:** Updates the user record, clears the opposite profile (e.g., dropping an old researcher profile when selecting farmer), and resets `registrationStatus` to `PENDING`.
- **Response:**
```json
{
  "data": {
    "id": "uuid",
    "role": "FARMER",
    "registrationStatus": "PENDING"
  }
}
```

### POST `/onboarding/farmer`
- **Auth:** any logged-in user (role is forced to `FARMER` upon success).
- **Body:**
```json
{
  "firstName": "Somchai",
  "lastName": "Prasert",
  "phone": "0812345678",
  "primaryFarmType": "NURSERY_SMALL",
  "declaredPondCount": 4,
  "farmLatitude": 14.077,
  "farmLongitude": 100.608
}
```
- **Validation:** `firstName`, `lastName`, `phone`, `primaryFarmType`, `farmLatitude`, and `farmLongitude` required. `primaryFarmType` must be one of `NURSERY_SMALL`, `NURSERY_LARGE`, `GROWOUT` (case-insensitive). `declaredPondCount` must be a non-negative integer when provided. `farmLatitude` must be between -90 and 90, `farmLongitude` between -180 and 180.
- **Behavior:** Upserts the `farmer_profiles` record, removes any researcher profile, and updates the user to `{ role: FARMER, registrationStatus: COMPLETED }`.
- **Response:**
```json
{
  "data": {
    "profile": {
      "userId": "uuid",
      "firstName": "Somchai",
      "lastName": "Prasert",
      "phone": "0812345678",
      "primaryFarmType": "NURSERY_SMALL",
      "declaredPondCount": 4,
      "farmLatitude": 14.077,
      "farmLongitude": 100.608,
      "createdAt": "2025-11-21T06:30:00.000Z",
      "updatedAt": "2025-11-21T06:30:00.000Z"
    },
    "user": {
      "id": "uuid",
      "role": "FARMER",
      "registrationStatus": "COMPLETED"
    }
  }
}
```

### POST `/onboarding/researcher`
- **Auth:** any logged-in user (role forced to `RESEARCHER`).
- **Body:**
```json
{
  "firstName": "Dr. Ora",
  "lastName": "Sirikul",
  "email": "ora@example.com",
  "phone": "020001234",
  "organization": "Kasetsart University",
  "department": "Aquaculture",
  "jobTitle": "Senior Researcher"
}
```
- **Validation:** `firstName`, `lastName`, `email`, `phone`, `organization` required; `department` and `jobTitle` optional strings.
- **Behavior:** Upserts the `researcher_profiles` row, removes any farmer profile, and updates the user to `{ role: RESEARCHER, registrationStatus: COMPLETED }`.
- **Response:** Mirrors the farmer endpoint but with researcher profile fields.

---

## 4. Home Dashboard
### GET `/home/groups/:groupType`
- **Auth:** any logged-in user.
- **Path params:** `groupType` must be one of `NURSERY_SMALL`, `NURSERY_LARGE`, `GROWOUT` (case-insensitive).
- **Behavior:** 
  - Uses hardcoded optimal temperature ranges (28-32°C comfort, 26-34°C critical) consistent across all catfish production stages.
  - Fetches current weather via Google Weather API using the first farm in the group that has coordinates.
  - Computes temperature delta from comfort range and recommended feed adjustment percentage (5% per degree).
  - Generates a 7-day feeding plan with temperature-adjusted rations (base 5kg for nursery small).
  - Returns 501 for `NURSERY_LARGE` and `GROWOUT` until those services are implemented.
  - **Frontend responsibility:** All UI text (alert messages, feeding guidance, tips) is rendered client-side using the numeric data provided.
- **Response (NURSERY_SMALL):**
```json
{
  "data": {
    "group": "NURSERY_SMALL",
    "hasData": true,
    "summary": {
      "asOf": "2025-11-20T10:15:00.000Z",
      "airTemperatureC": 37.5,
      "temperatureDeltaC": 5.5,
      "comfortRangeC": { "min": 28, "max": 32 },
      "recommendedFeedAdjustmentPct": 28,
      "weather": {
        "time": "2025-11-20T10:10:00Z",
        "temperatureC": 37.5,
        "humidityPct": 65,
        "windSpeedKph": 10.5,
        "rainMm": 0.0,
        "conditionText": "Sunny"
      }
    },
    "feedingPlan": [
      {
        "date": "2025-11-20T00:00:00.000Z",
        "highTemperatureC": 37.5,
        "lowTemperatureC": 33.5,
        "recommendedFeedKg": 4.0
      },
      {
        "date": "2025-11-21T00:00:00.000Z",
        "highTemperatureC": 38.2,
        "lowTemperatureC": 34.2,
        "recommendedFeedKg": 3.9
      }
    ]
  }
}
```
- **No-data state:** When the user has no farms in that group, `hasData` is `false`, `temperatureDeltaC` is `null`, and `feedingPlan` uses base feed amounts without temperature adjustment.
- **Temperature calculations:** 
  - `temperatureDeltaC`: Difference from comfort boundary (negative = too cold, positive = too hot, 0 = within range, null = no data).
  - `recommendedFeedAdjustmentPct`: Percentage to adjust feed amount (5% per degree deviation). Positive = increase feed (cold weather), negative = decrease feed (hot weather).
- **Frontend responsibility:** 
  - Determine alert severity by checking `temperatureDeltaC` against critical thresholds (e.g., ±2°C from comfort range).
  - Render localized alert messages, feeding guidance, and tips based on temperature data.
  - Display feeding stage information (age ranges, pellet size, protein %, feeding frequency) as static content maintained client-side.

---

## 5. Weather Proxy
### GET `/v1/weather?lat=<number>&lng=<number>`
- **Auth:** any authenticated user.
- **Query params:** both required, numeric.
- **Response:** `{ "data": CurrentWeather }` from `WeatherService.getCurrentWeather` (same shape as in Home dashboard weather block).

---

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
