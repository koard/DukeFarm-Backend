# 📖 DukeFarm API Specification v1.0

> **Comprehensive REST API documentation** for DukeFarm catfish production management platform

[![API Version](https://img.shields.io/badge/API%20Version-1.0-blue.svg)]()
[![Status](https://img.shields.io/badge/Status-Production-green.svg)]()
[![Last Updated](https://img.shields.io/badge/Updated-2025--11--27-lightgrey.svg)]()

---

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL & Conventions](#base-url--conventions)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoint Matrix](#endpoint-matrix)
- [User Flow Diagrams](#user-flow-options)
- [Detailed Endpoints](#detailed-endpoints)
  - [Health & Diagnostics](#1-health--diagnostics)
  - [Authentication & User Session](#2-authentication--user-session)
  - [Registration & Role Selection](#3-registration--role-selection)
  - [Dashboard](#4-dashboard)
  - [Weather Proxy](#5-weather-proxy)
  - [Farmers Management](#6-farmers-management)
  - [Feed Formulas Management](#7-feed-formulas-management)
  - [Researchers & Surveys](#8-researchers--surveys-management)
- [Best Practices](#best-practices)
- [Changelog](#changelog)

---

## 🎯 Overview

The DukeFarm API provides a comprehensive backend service for managing catfish farming operations across three production phases: **Nursery Small**, **Nursery Large**, and **Growout**. The API follows RESTful principles and uses JSON for data exchange.

### Key Features

- **🔐 OAuth 2.0 Authentication**: LINE Login integration with JWT session management
- **👥 Role-Based Access Control**: Three user roles (Admin, Farmer, Researcher)
- **🌤️ Weather Intelligence**: Real-time weather data via Open-Meteo API
- **📊 Smart Dashboards**: Farm group overviews with feeding recommendations
- **🔬 Research Tools**: Survey management and data collection
- **📈 Analytics**: Temperature-based feeding adjustments

### Technology Stack

- **Framework**: Express 5 + TypeScript
- **Database**: PostgreSQL 14+ via Prisma ORM
- **Authentication**: JWT (7-day TTL)
- **External APIs**: LINE Login OAuth, Open-Meteo Weather

---

## 🔐 Authentication

All protected endpoints require a valid JWT token obtained through LINE Login OAuth flow.

### Authorization Header

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifecycle

1. **Obtain Token**: Complete LINE OAuth flow (`GET /auth/line/login` → `/auth/line/callback`)
2. **Use Token**: Include in `Authorization` header for all protected endpoints
3. **Token Expiry**: 7 days from issuance
4. **Renewal**: Re-authenticate via LINE Login when token expires

### User Roles

| Role | Access Level | Permissions |
| --- | --- | --- |
| `ADMIN` | Full system access | All CRUD operations, user management |
| `FARMER` | Farm operations | View/edit own farms, view dashboard |
| `RESEARCHER` | Research operations | View farmers, manage surveys |
| `UNASSIGNED` | Pending role selection | Can only select role |

---

## 🌐 Base URL & Conventions

### Base URL

```
Production:  https://api.dukefarm.com/api
Development: http://localhost:4000/api
```

### API Versioning

- **Current Version**: v1
- **Versioning Strategy**: URL path versioning (`/v1/resource`)
- **Breaking Changes**: New major version will be introduced

### HTTP Methods

| Method | Usage | Idempotent |
| --- | --- | --- |
| `GET` | Retrieve resources | ✅ Yes |
| `POST` | Create resources | ❌ No |
| `PUT` | Update resources (full) | ✅ Yes |
| `PATCH` | Update resources (partial) | ❌ No |
| `DELETE` | Remove resources | ✅ Yes |

### Content Type

All requests and responses use JSON:

```http
Content-Type: application/json
Accept: application/json
```

---

## 📦 Response Format

### Success Response

All successful responses follow this envelope structure:

```json
{
  "data": {
    // Response payload
  }
}
```

**Exception**: Some endpoints return direct values (e.g., redirects, health checks)

### Pagination Response

Endpoints that return lists include pagination metadata:

```json
{
  "data": {
    "data": [
      // Array of items
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

### Common Query Parameters

| Parameter | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | 1 | - | Page number (1-indexed) |
| `limit` | integer | 10 | 100 | Items per page |

---

## ⚠️ Error Handling

### Error Response Structure

```json
{
  "message": "Error description",
  "errors": [
    // Optional validation errors array
  ]
}
```

### HTTP Status Codes

| Code | Meaning | When to Expect |
| --- | --- | --- |
| `200` | OK | Successful GET, PUT, PATCH requests |
| `201` | Created | Successful POST request |
| `204` | No Content | Successful DELETE request |
| `400` | Bad Request | Invalid input, validation errors |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Insufficient permissions for resource |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate resource (e.g., email exists) |
| `422` | Unprocessable Entity | Semantic validation errors |
| `500` | Internal Server Error | Server-side error |
| `501` | Not Implemented | Feature not yet available |
| `503` | Service Unavailable | Temporary service disruption |

### Example Error Responses

**Validation Error (400)**
```json
{
  "message": "Validation failed",
  "errors": [
    "firstName is required",
    "phone must be a valid Thai phone number"
  ]
}
```

**Unauthorized (401)**
```json
{
  "message": "Invalid or expired token"
}
```

**Forbidden (403)**
```json
{
  "message": "Admin access required"
}
```

**Not Found (404)**
```json
{
  "message": "Feed formula not found"
}
```

---

## 📊 Endpoint Matrix

Complete overview of all available API endpoints organized by feature domain.

### 🏥 Health & Diagnostics

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/healthz` | None | Unlimited | Lightweight health check for load balancers |
| `GET` | `/v1/health` | None | 100/min | Detailed health status with database connectivity |

### 🔐 Authentication & User Session

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/auth/line/login` | None | 10/min | Generate LINE Login OAuth URL |
| `GET` | `/auth/line/callback` | None | 10/min | LINE OAuth callback handler (redirects to frontend) |
| `GET` | `/auth/me` | Required | 60/min | Get current authenticated user profile |

### 📝 Registration & Onboarding

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/register/role` | Required | 5/min | Select user role (FARMER or RESEARCHER) |
| `POST` | `/register/farmer` | Required | 5/min | Complete farmer registration with farm details |
| `POST` | `/register/researcher` | Required | 5/min | Complete researcher registration |

### 📊 Dashboard & Analytics

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/` | None | 100/min | API information and available endpoints |
| `GET` | `/dashboard/groups/:groupType` | Required | 30/min | Farm group dashboard with weather & feeding plan |

### 🌤️ Weather Services

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/weather` | Required | 60/min | Get current weather by coordinates (lat, lng) |

### 👨‍🌾 Farmers Management

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/farmers` | Admin/Researcher | 60/min | List all registered farmers with pagination |

### 🍽️ Feed Formulas Management

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/feed-formulas` | Admin | 20/min | Create new feed formula |
| `GET` | `/feed-formulas` | Required | 60/min | List all feed formulas with pagination |
| `GET` | `/feed-formulas/:id` | Required | 60/min | Get feed formula details by ID |
| `PUT` | `/feed-formulas/:id` | Admin | 20/min | Update existing feed formula |
| `DELETE` | `/feed-formulas/:id` | Admin | 10/min | Delete feed formula by ID |

### 🔬 Researchers & Surveys

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/researchers` | Admin | 60/min | List all registered researchers |
| `GET` | `/researchers/:id/surveys` | Admin/Researcher | 60/min | List surveys by researcher ID |
| `GET` | `/researchers/surveys/:id` | Admin/Researcher | 60/min | Get detailed survey information |

**Notes:**
- Rate limits are per user/IP address
- Rate limiting is currently not implemented but reserved for future use
- All timestamps are in ISO 8601 format (UTC)
- Geographic coordinates use WGS84 datum (latitude: -90 to 90, longitude: -180 to 180)

---

## 🔄 User Flow Options

The API supports two onboarding flows: **Standard Flow** (user selects role after login) and **Express Flow** (role pre-selected during login).

### Flow A: Standard Flow (User Selects Role After Login)

```mermaid
graph LR
    A[Health Check] --> B[LINE Login]
    B --> C[OAuth Callback]
    C --> D[Check Profile]
    D --> E[Select Role]
    E --> F[Complete Profile]
    F --> G[Dashboard]
```

**Step-by-Step Process:**

| Step | Endpoint | Description | Response |
| --- | --- | --- | --- |
| 1 | `GET /v1/health` | Verify service availability | Status: `ok` |
| 2 | `GET /auth/line/login` | Get LINE OAuth URL (no role param) | LINE authorization URL |
| 3 | `GET /auth/line/callback` | Exchange code for JWT | Redirect with token (role: `UNASSIGNED`) |
| 4 | `GET /auth/me` | Check user profile | User data with `registrationStatus: PENDING` |
| 5 | `POST /register/role` | Select FARMER or RESEARCHER | Updated user with chosen role |
| 6 | `POST /register/farmer` or `/register/researcher` | Submit profile form | Complete profile data |
| 7 | `GET /dashboard/groups/:groupType` | Access dashboard | Dashboard with weather & feeding plan |

**Use Case**: Best for situations where users might need guidance on which role to select, or when role selection is part of a multi-step onboarding wizard.

---

### Flow B: Express Flow (Pre-Select Role at Login)

```mermaid
graph LR
    A[Health Check] --> B[LINE Login + Role]
    B --> C[OAuth Callback]
    C --> D[Check Profile]
    D --> E[Complete Profile]
    E --> F[Dashboard]
```

**Step-by-Step Process:**

| Step | Endpoint | Description | Response |
| --- | --- | --- | --- |
| 1 | `GET /v1/health` | Verify service availability | Status: `ok` |
| 2 | `GET /auth/line/login?role=farmer` | Get LINE OAuth URL with role | LINE authorization URL |
| 3 | `GET /auth/line/callback` | Exchange code for JWT | Redirect with token (role: `FARMER`) |
| 4 | `GET /auth/me` | Check profile (role already set) | User data with `role: FARMER`, `registrationStatus: PENDING` |
| 5 | `POST /register/farmer` | Submit profile form (skip role selection) | Complete profile data |
| 6 | `GET /dashboard/groups/:groupType` | Access dashboard | Dashboard with weather & feeding plan |

**Use Case**: Ideal for streamlined onboarding when you already know the user's intended role (e.g., from marketing campaign, referral link, or app context).

**Benefits**: Reduces friction by eliminating one step from the registration process.

---

### Frontend Callback Handling

After LINE OAuth completion, users are redirected to `FRONTEND_CALLBACK_URL` with query parameters:

```
https://app.example.com/auth/callback?token=xxx&user=xxx&role=xxx&registrationStatus=xxx
```

**Query Parameters:**

| Parameter | Type | Description | Example |
| --- | --- | --- | --- |
| `token` | string | JWT token (7-day TTL) | `eyJhbGciOiJIUzI1NiIs...` |
| `user` | string | URL-encoded JSON user object | `%7B%22id%22%3A%22...` |
| `role` | string | User role (lowercase) | `farmer`, `researcher`, `unassigned` |
| `registrationStatus` | string | Registration state | `PENDING`, `COMPLETED` |

**Frontend Logic:**

```javascript
// Parse query parameters
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const user = JSON.parse(decodeURIComponent(params.get('user')));
const role = params.get('role');
const registrationStatus = params.get('registrationStatus');

// Store token
localStorage.setItem('authToken', token);

// Determine redirect destination
if (registrationStatus === 'PENDING') {
  if (role === 'unassigned') {
    navigate('/onboarding/select-role');
  } else {
    navigate(`/onboarding/${role}-form`);
  }
} else if (registrationStatus === 'COMPLETED') {
  navigate('/dashboard');
}
```

---

## 📖 Detailed Endpoints

### 1. Health & Diagnostics

---

#### `GET /v1/health`

**Description**: Comprehensive health check endpoint that verifies database connectivity and returns service status information.

**Authentication**: None (Public)

**Use Case**: 
- Kubernetes/Docker health probes
- Monitoring systems (Datadog, New Relic)
- CI/CD pipeline verification

**Request:**
```http
GET /api/v1/health HTTP/1.1
Host: api.dukefarm.com
```

**Success Response (200 OK):**
```json
{
  "status": "ok",
  "database": "connected",
  "uptimeSeconds": 123.45,
  "host": "api-hostname"
}
```

**Response Fields:**

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | Overall system status: `ok` or `error` |
| `database` | string | Database connection status: `connected` or `disconnected` |
| `uptimeSeconds` | number | Server uptime in seconds |
| `host` | string | Server hostname/container ID |

**Error Response (500 Internal Server Error):**
```json
{
  "status": "error",
  "database": "disconnected",
  "message": "Database connection failed"
}
```

---

#### `GET /healthz`

**Description**: Lightweight health check endpoint for container orchestration and load balancers. Returns minimal response to reduce overhead.

**Authentication**: None (Public)

**Use Case**:
- Kubernetes liveness/readiness probes
- AWS ALB health checks
- High-frequency monitoring (sub-second intervals)

**Request:**
```http
GET /api/healthz HTTP/1.1
Host: api.dukefarm.com
```

**Success Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Notes:**
- Does NOT check database connectivity (faster response)
- Ideal for high-frequency health checks
- Returns 500 if server is unable to respond

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
- **Redirects to frontend** with query parameters instead of returning JSON.

**Redirect URL:**
```
http://localhost:3000/auth/callback?token=xxx&user=xxx&registrationStatus=xxx&role=xxx
```

**Query Parameters:**
- `token` - JWT token (TTL = 7 days)
- `user` - User object as URL-encoded JSON string: `{"id":"uuid","displayName":"LINE User","pictureUrl":"https://..."}`
- `registrationStatus` - Either `PENDING` or `COMPLETED`
- `role` - Either `unassigned`, `farmer`, or `researcher` (lowercase)

**Example:**
```
http://localhost:3000/auth/callback?token=eyJhbGc...&user=%7B%22id%22%3A%22abc123%22%2C%22displayName%22%3A%22John%22%7D&registrationStatus=PENDING&role=farmer
```

**Frontend should:**
1. Parse query parameters
2. Decode `user` JSON string
3. Store `token` in localStorage/cookie
4. Redirect based on `registrationStatus` and `role`:
   - `PENDING` + `unassigned` → Role selection page
   - `PENDING` + `farmer/researcher` → Profile form
   - `COMPLETED` → Dashboard

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

## 3. Registration & Role Selection
### POST `/register/role`
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

### POST `/register/farmer`
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

### POST `/register/researcher`
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

## 4. Dashboard
### GET `/dashboard/groups/:groupType`
- **Auth:** any logged-in user.
- **Path params:** `groupType` must be one of `NURSERY_SMALL`, `NURSERY_LARGE`, `GROWOUT` (case-insensitive).
- **Behavior:** 
  - Fetches current **air temperature** from Open-Meteo API (free, no API key required)
  - Uses farmer profile location (farmLatitude, farmLongitude) to get weather data
  - Air temperature typically 3-8°C higher than water temperature
  - Generates 7-day feeding plan with **percentage adjustments** instead of absolute kg amounts
  - Returns 501 for `NURSERY_LARGE` and `GROWOUT` until those services are implemented
  - **Data-driven approach:** Backend sends only numeric data; frontend handles all UI text and localization
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
        "date": "2025-11-27T00:00:00.000Z",
        "highTemperatureC": 37.5,
        "lowTemperatureC": 33.5,
        "feedAdjustmentPct": -8,
        "feedingRecommendation": "decrease"
      },
      {
        "date": "2025-11-28T00:00:00.000Z",
        "highTemperatureC": 30.0,
        "lowTemperatureC": 26.0,
        "feedAdjustmentPct": 0,
        "feedingRecommendation": "normal"
      },
      {
        "date": "2025-11-29T00:00:00.000Z",
        "highTemperatureC": 26.0,
        "lowTemperatureC": 22.0,
        "feedAdjustmentPct": -5,
        "feedingRecommendation": "decrease"
      },
      {
        "date": "2025-11-30T00:00:00.000Z",
        "highTemperatureC": 40.5,
        "lowTemperatureC": 36.5,
        "feedAdjustmentPct": -17,
        "feedingRecommendation": "decrease"
      }
    ]
  }
}
```
**Field Descriptions:**

**Summary fields:**
- `hasData`: `true` if farmer has GPS coordinates and weather data available
- `airTemperatureC`: Current air temperature from weather API (null if no data)
- `temperatureDeltaC`: Degrees away from optimal range (negative = below 28°C, positive = above 32°C, 0 = optimal, null = no data)
- `comfortRangeC`: Optimal air temperature range { min: 28, max: 32 }
- `recommendedFeedAdjustmentPct`: Overall feed adjustment % based on current temperature

**Feeding plan fields:**
- `date`: ISO date string for each day
- `highTemperatureC`: Forecasted high air temperature
- `lowTemperatureC`: Forecasted low air temperature
- `feedAdjustmentPct`: **Percentage to adjust feed** (e.g., -15 = reduce 15%, +10 = increase 10%, 0 = normal)
- `feedingRecommendation`: **Action keyword** - `"increase"`, `"decrease"`, or `"normal"`

**Air Temperature Logic (adjusted for tropical conditions):**
- **28-35°C air**: Optimal (0% adjustment) - water likely 25-30°C
- **< 20°C air**: Cold weather, reduce 30% - water likely below 18°C
- **20-24°C air**: Cool weather, reduce 20% - water likely 20-22°C
- **24-28°C air**: Slightly cool, reduce 2.5% per degree
- **35-38°C air**: Hot weather, reduce 3% per degree - water likely 30-32°C
- **38-40°C air**: Very hot, reduce 20% - water likely 32-34°C (stress)
- **40-42°C air**: Extreme heat, reduce 30% - water likely 34-36°C (critical)
- **> 42°C air**: Severe heat, reduce 50% - water likely 36-38°C (dangerous)

**Frontend responsibility:** 
- Render UI text based on `feedingRecommendation`: 
  - `"increase"` → "อากาศเย็น ควรเพิ่มอาหาร +X%"
  - `"decrease"` → "อากาศร้อน/เย็น ควรลดอาหาร X%"
  - `"normal"` → "อุณหภูมิเหมาะสม ให้ตามปกติ"
- Display color-coded indicators (blue=increase, green=normal, red=decrease)
- Show specific advice for extreme temperatures (> 40°C: add aerators, feed morning/evening only)

---
## 5. Weather Proxy
### GET `/v1/weather?lat=<number>&lng=<number>`
- **Auth:** any authenticated user.
- **Query params:** both required, numeric.
- **Weather Provider:** Open-Meteo API (https://open-meteo.com)
  - Free, unlimited usage, no API key required
  - Returns `temperature_2m` (air temperature at 2m height - standard meteorological measurement)
  - WMO weather codes mapped to readable condition text (e.g., "Sunny", "Rain", "Thunderstorm")
  - Timezone: Asia/Bangkok
- **Response:** `{ "data": CurrentWeather }` from `WeatherService.getCurrentWeather` (same shape as in Home dashboard weather block).

---

## 6. Farmers Management
### GET `/farmers?page=<number>&limit=<number>`
- **Auth:** Admin or Researcher only.
- **Query params:**
  - `page` (optional): Page number, default 1
  - `limit` (optional): Items per page, default 10, max 100
- **Response:**
```json
{
  "data": {
    "data": [
      {
        "no": 1,
        "fullName": "Somchai Prasert",
        "phone": "0812345678",
        "farmType": "NURSERY_SMALL",
        "registrationStatus": "COMPLETED",
        "pondCount": 6,
        "latitude": 14.077,
        "longitude": 100.608,
        "registeredAt": "2025-11-27T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

---

## 7. Feed Formulas Management
### POST `/feed-formulas`
- **Auth:** Admin only.
- **Body:**
```json
{
  "name": "สูตรลูกปลา 16-30 วัน",
  "targetStage": "16-30 วัน",
  "description": "อาหารเม็ดเล็ก ขนาด 0.5-1.0 มม. โปรตีน 35-40%",
  "recommendations": "ให้ 2 ครั้งต่อวัน เช้า-เย็น\nเพิ่มส่วนผสมพรีไบโอติก\nติดตาม FCR"
}
```
- **Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "สูตรลูกปลา 16-30 วัน",
    "targetStage": "16-30 วัน",
    "description": "อาหารเม็ดเล็ก ขนาด 0.5-1.0 มม. โปรตีน 35-40%",
    "recommendations": "ให้ 2 ครั้งต่อวัน เช้า-เย็น\nเพิ่มส่วนผสมพรีไบโอติก\nติดตาม FCR",
    "createdBy": "admin-id",
    "createdAt": "2025-11-27T12:00:00.000Z",
    "updatedAt": "2025-11-27T12:00:00.000Z"
  }
}
```

### GET `/feed-formulas?page=<number>&limit=<number>`
- **Auth:** Any authenticated user.
- **Query params:** Same as farmers list
- **Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "สูตรลูกปลา 16-30 วัน",
        "targetStage": "16-30 วัน",
        "description": "อาหารเม็ดเล็ก",
        "recommendations": "ให้ 2 ครั้งต่อวัน",
        "createdBy": "admin-id",
        "createdAt": "2025-11-27T12:00:00.000Z",
        "updatedAt": "2025-11-27T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

### GET `/feed-formulas/:id`
- **Auth:** Any authenticated user.
- **Response:** Same as create response

### PUT `/feed-formulas/:id`
- **Auth:** Admin only.
- **Body:** Same as POST (all fields optional)
- **Response:** Same as create response

### DELETE `/feed-formulas/:id`
- **Auth:** Admin only.
- **Response:**
```json
{
  "message": "Feed formula deleted successfully"
}
```

---

## 8. Researchers & Surveys Management
### GET `/researchers?page=<number>&limit=<number>`
- **Auth:** Admin only.
- **Query params:** Same as farmers list
- **Response:**
```json
{
  "data": {
    "data": [
      {
        "no": 1,
        "userId": "uuid",
        "fullName": "Dr. Ora Sirikul",
        "phone": "0812345678",
        "organization": "Kasetsart University",
        "department": "Aquaculture",
        "registeredAt": "2025-11-27T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 20,
      "itemsPerPage": 10
    }
  }
}
```

### GET `/researchers/:researcherId/surveys?page=<number>&limit=<number>`
- **Auth:** Admin or Researcher (can view own surveys).
- **Query params:** Same as farmers list
- **Response:**
```json
{
  "data": {
    "data": [
      {
        "no": 1,
        "surveyId": "uuid",
        "surveyDate": "2025-12-20T06:00:00.000Z",
        "surveyType": "กลุ่มอนุบาลนกใหญ่",
        "farmerName": "Somchai Prasert",
        "farmType": "NURSERY_SMALL",
        "pondCount": 6,
        "createdAt": "2025-11-27T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

### GET `/researchers/surveys/:surveyId`
- **Auth:** Admin or Researcher.
- **Response:**
```json
{
  "data": {
    "surveyId": "uuid",
    "surveyDate": "2025-12-20T06:00:00.000Z",
    "surveyType": "กลุ่มอนุบาลนกใหญ่",
    "conductedBy": "researcher-id",
    "partnerOrganization": null,
    "notes": "หมายเหตุ",
    "createdAt": "2025-11-27T12:00:00.000Z",
    "updatedAt": "2025-11-27T12:00:00.000Z",
    "farmer": {
      "userId": "uuid",
      "fullName": "Somchai Prasert",
      "phone": "0812345678",
      "farmCoordinates": "14.077,100.608",
      "totalFarmAreaM2": "600",
      "pondCount": 6
    },
    "farmData": {
      "ageRange": "31-60 วัน",
      "pondType": "EARTHEN",
      "pondCount": 6,
      "fishCount": 250
    },
    "feedingData": {
      "feedType": "กรุงไทยอาหารเกรด",
      "feedAmountKg": "10"
    },
    "waterQuality": {
      "dissolvedOxygenMgL": 5.5,
      "temperatureC": 28.5,
      "ph": 7.2,
      "alkalinityMgL": 120,
      "ammoniaMgL": 0.02
    }
  }
}
```

---

## Error Handling
- `401` if JWT missing/invalid.
- `403` if role not permitted.
- `404` if resource not found or user lacks ownership.
- `400` for validation issues; message text comes from controller-level validation helpers.
- `5xx` bubbled by global `errorHandler` with `{ "message": string }`.

---

## 💡 Best Practices

### For API Consumers

#### Authentication
- **Store tokens securely**: Use httpOnly cookies or secure localStorage
- **Refresh before expiry**: JWT tokens expire after 7 days - implement refresh logic
- **Handle 401 gracefully**: Redirect to login on token expiration

#### Error Handling
- **Always check status codes**: Don't assume 200 OK
- **Parse error messages**: Display user-friendly error messages from API responses
- **Implement retry logic**: For 5xx errors with exponential backoff

#### Performance
- **Use pagination**: Don't fetch all items at once
- **Cache responses**: Cache static data (feed formulas) with appropriate TTL
- **Minimize requests**: Batch operations when possible

#### Rate Limiting (Future)
- **Respect rate limits**: Monitor `X-RateLimit-*` headers
- **Implement backoff**: Wait before retrying after 429 responses
- **Optimize queries**: Use filters and pagination to reduce load

### For API Maintainers

#### Documentation
- **Update specs immediately**: Document changes in same PR as code
- **Include examples**: Provide request/response examples for all endpoints
- **Version breaking changes**: Use API versioning (`/v2/`) for incompatible changes

#### Testing
- **Test all endpoints**: Ensure comprehensive integration test coverage
- **Validate responses**: Verify response structure matches documentation
- **Check edge cases**: Test with invalid inputs, missing fields, etc.

#### Security
- **Validate all inputs**: Never trust client data
- **Use parameterized queries**: Prevent SQL injection (Prisma handles this)
- **Log security events**: Track failed auth attempts, permission denials

---

## 📅 Changelog

### Version 1.0.0 (2025-11-27)

**🎉 Initial Release**

**Added:**
- Complete authentication system via LINE Login OAuth
- Role-based access control (ADMIN, FARMER, RESEARCHER)
- Dashboard endpoints with weather integration
- Farmers management API (list with pagination)
- Feed formulas CRUD operations
- Researchers and surveys management
- Weather proxy via Open-Meteo API
- Health check endpoints for monitoring
- Comprehensive API documentation

**Renamed:**
- `/api/onboarding/*` → `/api/register/*` (clearer semantics)
- `/api/home/groups/:groupType` → `/api/dashboard/groups/:groupType` (consistent naming)

**Technical:**
- Migrated from Google Weather API to Open-Meteo (free, unlimited)
- Unified feeding calculation logic across summary and 7-day plan
- Air temperature-based feeding recommendations (28-35°C optimal range)
- Percentage-based feeding adjustments (-50% to +10%)

**Database:**
- Added `recommendations` field to `FeedFormula` model
- Removed deprecated `FarmingGroup` table
- Added `primaryFarmType` to farmer profiles

---

## 🔄 Migration Guide

### From Alpha/Beta to v1.0

**Endpoint Changes:**

| Old Endpoint | New Endpoint | Status |
| --- | --- | --- |
| `POST /api/onboarding/role` | `POST /api/register/role` | ✅ Updated |
| `POST /api/onboarding/farmer` | `POST /api/register/farmer` | ✅ Updated |
| `POST /api/onboarding/researcher` | `POST /api/register/researcher` | ✅ Updated |
| `GET /api/home/groups/:groupType` | `GET /api/dashboard/groups/:groupType` | ✅ Updated |

**Response Changes:**

- Dashboard feeding plan now uses **percentage adjustments** instead of absolute kg amounts
- Added `feedingRecommendation` field with values: `increase`, `decrease`, `normal`
- Weather data now from Open-Meteo API (field names unchanged)

**Action Required:**
1. Update frontend to use new endpoint paths
2. Update feeding plan UI to display percentage adjustments
3. Remove Google Weather API key from environment variables

---

## 🤝 Contributing to Documentation

### How to Update API Specs

When making changes to the API:

1. **Same PR Rule**: Update documentation in the same PR as code changes
2. **Test Examples**: Verify all request/response examples work
3. **Version Breaking Changes**: Document in Changelog section
4. **Review Checklist**:
   - [ ] Endpoint matrix updated
   - [ ] New endpoints documented with examples
   - [ ] Response fields described
   - [ ] Error cases documented
   - [ ] Changelog updated

### Documentation Style Guide

- **Use emoji headers**: 📖 for sections, 🔐 for auth, 📊 for data
- **Code blocks**: Always specify language (```json, ```http, ```bash)
- **Tables**: Use for structured data (parameters, fields, status codes)
- **Examples**: Provide realistic data, not placeholders
- **Links**: Reference related sections with internal links

---

## 📞 Support & Resources

### Documentation
- **API Specifications**: This document (api-specs.md)
- **Backend README**: [README.md](./README.md)
- **Database Schema**: [prisma/schema.prisma](./prisma/schema.prisma)

### External Resources
- **LINE Login Docs**: https://developers.line.biz/en/docs/line-login/
- **Open-Meteo API**: https://open-meteo.com/en/docs
- **Prisma ORM**: https://www.prisma.io/docs

### Getting Help
- **GitHub Issues**: [koard/DukeFarm-Backend/issues](https://github.com/koard/DukeFarm-Backend/issues)
- **Team Contact**: Betagro & Kasetsart University Research Team

---

**© 2025 DukeFarm. All rights reserved.**

Built with ❤️ for sustainable aquaculture in Thailand 🇹🇭
