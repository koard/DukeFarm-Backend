# 📖 DukeFarm API Specification v1.1

> **Comprehensive REST API documentation** for DukeFarm catfish production management platform

[![API Version](https://img.shields.io/badge/API%20Version-1.1-blue.svg)]()
[![Status](https://img.shields.io/badge/Status-Production-green.svg)]()
[![Last Updated](https://img.shields.io/badge/Updated-2025--12--16-lightgrey.svg)]()

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
  - [Farm Data Records](#5-farm-data-records)
  - [Weather Proxy](#6-weather-proxy)
  - [Farmers Management](#7-farmers-management)
  - [Feed Formulas Management](#8-feed-formulas-management)
  - [Researchers & Surveys](#9-researchers--surveys-management)
  - [Disease Analyzer](#10-disease-analyzer)
- [Best Practices](#best-practices)
- [Changelog](#changelog)

---

## 🎯 Overview

The DukeFarm API provides a comprehensive backend service for managing catfish farming operations across three production phases: **Fingerling**, **Fattening**, and **Market** (legacy names: Nursery Small, Nursery Large, Growout). The API follows RESTful principles and uses JSON for data exchange.

### Key Features

- **🔐 OAuth 2.0 Authentication**: LINE Login integration with JWT session management
- **👥 Role-Based Access Control**: Three user roles (Admin, Farmer, Researcher)
- **🌤️ Weather Intelligence**: Real-time weather data via Google Maps Weather API
- **📊 Smart Dashboards**: Farm group overviews with feeding recommendations
- **🐟 Fish Age Intelligence**: Automatic fish-age day estimation based on last record date + elapsed time, stage lookup, and harvest readiness signals
- **📝 Farm Data Logging**: Structured farm record submission with weather snapshots and cultivation tracking
- **🔬 Research Tools**: Survey management and data collection
- **📈 Analytics**: Temperature-based feeding adjustments
- **🏥 Disease Intelligence**: AI-powered disease diagnosis with symptom-based search and comprehensive treatment guides

### Technology Stack

- **Framework**: Express 5 + TypeScript
- **Database**: PostgreSQL 14+ via Prisma ORM
- **Authentication**: JWT (no expiration)
- **External APIs**: LINE Login OAuth, Google Maps Weather API (API key required)

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
3. **Token Expiry**: Never expires (permanent token)
4. **Revocation**: Token can only be invalidated by changing JWT_SECRET or implementing token blacklist

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
| `POST` | `/auth/admin/create` | None | 5/min | Create admin account (requires secret) |
| `POST` | `/auth/admin/login` | None | 10/min | Admin login with email/password |

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

### 📝 Farm Data Records

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/records/form-state?farmType=<type>` | Required | 30/min | Prefill record form with current time, farm type, and weather snapshot |
| `POST` | `/records` | Farmer | 30/min | Submit a farm data entry with fish-age label, pond data, and weather |
| `PUT` | `/records/:id` | Farmer/Admin | 30/min | Update an existing farm record |
| `DELETE` | `/records/:id` | Farmer/Admin | 30/min | Delete a farm record |

### 🌤️ Weather Services

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/weather` | Required | 60/min | Get current weather by coordinates (lat, lng) |

### 👨‍🌾 Farmers Management

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/farmers` | Admin/Researcher | 60/min | List all registered farmers with pagination |
| `GET` | `/farmers/:farmerId` | Admin/Researcher | 60/min | Fetch single farmer detail with stats and history (supports `?farmType=SMALL`) |
| `DELETE` | `/farmers/:farmerId` | Admin | 30/min | Permanently delete a farmer account and related data |

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

### 🏥 Disease Analyzer

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/diseases` | Required | 60/min | Search diseases by symptoms with fuzzy matching |
| `GET` | `/diseases/:id` | Required | 60/min | Get detailed disease information by ID |

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
| `token` | string | JWT token (no expiration) | `eyJhbGciOiJIUzI1NiIs...` |
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
- `token` - JWT token (no expiration)
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
      "primaryFarmType": "SMALL",
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

### POST `/auth/admin/create`
- **Auth:** None (public endpoint, but requires knowledge of system).
- **Body:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123",
  "firstName": "Admin",
  "lastName": "User",
  "phone": "0812345678",
  "organization": "DukeFarm"
}
```
- **Validation:** All fields required. Email must be unique. Password minimum 8 characters.
- **Behavior:** Creates a user with `role: ADMIN` and `registrationStatus: COMPLETED`. Admin profile stored in `researcher_profiles` table with the email.
- **Response:**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "role": "ADMIN",
      "displayName": "Admin User"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
- **Note:** This endpoint is typically used once during initial system setup. Consider adding authentication or restricting in production.

### POST `/auth/admin/login`
- **Auth:** None (public endpoint).
- **Body:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123"
}
```
- **Behavior:** Validates email/password against `researcher_profiles` table, verifies user has `ADMIN` role.
- **Response:**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "role": "ADMIN",
      "displayName": "Admin User",
      "email": "admin@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
- **Error (401):** Invalid email or password
- **Error (403):** User exists but is not an admin

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
  "primaryFarmType": "SMALL",
  "farmLatitude": 14.077,
  "farmLongitude": 100.608,
  "ponds": [
    {
      "pondType": "EARTHEN",
      "widthM": 3,
      "lengthM": 5,
      "depthM": 1
    },
    {
      "pondType": "CONCRETE",
      "widthM": 3,
      "lengthM": 5,
      "depthM": 1
    }
  ]
}
```
  - **Validation:**
    - `firstName`, `lastName`, `phone`, `primaryFarmType`, `farmLatitude`, `farmLongitude`, and `ponds` are required.
    - `primaryFarmType` must be one of `SMALL`, `LARGE`, `MARKET` (case-insensitive).
    - `farmLatitude` must be between -90 and 90, `farmLongitude` between -180 and 180.
    - `ponds` must be a non-empty array (at least 1 pond required). Each pond must have:
      - `pondType`: `EARTHEN` or `CONCRETE` (case-insensitive)
      - `widthM`: positive number (meters)
      - `lengthM`: positive number (meters)
      - `depthM`: positive number (meters)
    - `declaredPondCount` is auto-calculated from the number of ponds submitted.
    - `volumeM3` is auto-calculated server-side as `widthM × lengthM × depthM`.
- **Behavior:** Upserts the `farmer_profiles` record, creates pond records (deletes any existing ponds first), removes any researcher profile, and updates the user to `{ role: FARMER, registrationStatus: COMPLETED }`.
- **Response:**
```json
{
  "data": {
    "profile": {
      "userId": "uuid",
      "firstName": "Somchai",
      "lastName": "Prasert",
      "phone": "0812345678",
      "primaryFarmType": "SMALL",
      "declaredPondCount": 2,
      "farmLatitude": 14.077,
      "farmLongitude": 100.608,
      "createdAt": "2025-11-21T06:30:00.000Z",
      "updatedAt": "2025-11-21T06:30:00.000Z",
      "ponds": [
        {
          "id": "uuid",
          "pondType": "EARTHEN",
          "widthM": 3,
          "lengthM": 5,
          "depthM": 1,
          "volumeM3": 15,
          "createdAt": "2025-11-21T06:30:00.000Z"
        },
        {
          "id": "uuid",
          "pondType": "CONCRETE",
          "widthM": 3,
          "lengthM": 5,
          "depthM": 1,
          "volumeM3": 15,
          "createdAt": "2025-11-21T06:30:00.000Z"
        }
      ]
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
- **Path params:** `groupType` must be one of `SMALL`, `LARGE`, `MARKET` (case-insensitive). `SMALL` corresponds to the Fingerling/Pla Tum window (7-10 days) and `LARGE` corresponds to the Pla Nio juvenile window (11-30 days).
- **Behavior:** 
  - Fetches current **air temperature** from Google Maps Weather API (API key + billing required)
  - Uses farmer profile location (farmLatitude, farmLongitude) to get weather data
  - Air temperature typically 3-8°C higher than water temperature
  - Generates 7-day feeding plan with **percentage adjustments** instead of absolute kg amounts
  - All three farm types (SMALL, LARGE, MARKET) are fully implemented
  - **Data-driven approach:** Backend sends only numeric data; frontend handles all UI text and localization
- **Response (SMALL / Fingerling):**
```json
{
  "data": {
    "group": "SMALL",
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
        "weatherCode": 0,
        "conditionText": "Clear sky"
      },
      "hourlyForecast": [
        {
          "time": "2025-11-20T11:00:00Z",
          "temperatureC": 38.2,
          "humidityPct": 58,
          "weatherCode": 1
        },
        {
          "time": "2025-11-20T12:00:00Z",
          "temperatureC": 39.0,
          "humidityPct": 55,
          "weatherCode": 1
        }
      ]
    },
    "feedingPlan": [
      {
        "date": "2025-11-27T00:00:00.000Z",
        "meanTemperatureC": 35.5,
        "highTemperatureC": 37.5,
        "lowTemperatureC": 33.5,
        "weatherCode": 0,
        "conditionText": "Clear sky",
        "feedAdjustmentPct": -8,
        "feedingRecommendation": "decrease"
      },
      {
        "date": "2025-11-28T00:00:00.000Z",
        "meanTemperatureC": 28.0,
        "highTemperatureC": 30.0,
        "lowTemperatureC": 26.0,
        "weatherCode": 3,
        "conditionText": "Overcast",
        "feedAdjustmentPct": 0,
        "feedingRecommendation": "normal"
      },
      {
        "date": "2025-11-29T00:00:00.000Z",
        "meanTemperatureC": 24.0,
        "highTemperatureC": 26.0,
        "lowTemperatureC": 22.0,
        "weatherCode": 61,
        "conditionText": "Light rain",
        "feedAdjustmentPct": -40,
        "feedingRecommendation": "decrease"
      },
      {
        "date": "2025-11-30T00:00:00.000Z",
        "meanTemperatureC": 38.5,
        "highTemperatureC": 40.5,
        "lowTemperatureC": 36.5,
        "weatherCode": 1,
        "conditionText": "Mainly clear",
        "feedAdjustmentPct": -30,
        "feedingRecommendation": "decrease"
      }
    ]
  }
}
```
- **Response (LARGE / MARKET):**
```json
{
  "data": {
    "group": "LARGE",
    "hasData": true,
    "summary": {
      "asOf": "2025-11-30T10:15:00.000Z",
      "airTemperatureC": 31.5,
      "temperatureDeltaC": 0,
      "comfortRangeC": { "min": 28, "max": 32 },
      "recommendedFeedAdjustmentPct": 0,
      "weather": {
        "time": "2025-11-30T10:10:00Z",
        "temperatureC": 31.5,
        "humidityPct": 68,
        "windSpeedKph": 8.2,
        "rainMm": 0.0,
        "weatherCode": 1,
        "conditionText": "Mainly clear"
      },
      "averageFishWeight": 0.3,
      "weightChange": -2.0,
      "latestFishAgeLabel": "61-90 วัน",
      "latestFishAgeDays": 88,
      "latestFishStageName": "กลางขุน",
      "latestHarvestStatus": "TOO_EARLY",
      "latestHarvestStatusReason": "Fish age 88d is below the recommended harvest window (90-120d).",
      "pelletFoodCost": 15000,
      "freshFoodCost": 8000,
      "monthlyFeedingData": [
        { "month": "Dec", "value": 0.25 },
        { "month": "Jan", "value": 0.5 },
        { "month": "Feb", "value": 0.65 },
        { "month": "Mar", "value": 0.95 },
        { "month": "Apr", "value": 0.8 },
        { "month": "May", "value": 2.0 },
        { "month": "Jun", "value": 1.2 },
        { "month": "Jul", "value": 1.4 },
        { "month": "Aug", "value": 1.6 },
        { "month": "Sep", "value": 1.8 },
        { "month": "Oct", "value": 1.5 },
        { "month": "Nov", "value": 1.3 }
      ],
      "hourlyForecast": [
        {
          "time": "2025-11-30T11:00:00Z",
          "temperatureC": 32.1,
          "humidityPct": 64,
          "weatherCode": 1
        }
      ]
    },
    "feedingPlan": [
      {
        "date": "2025-11-30T00:00:00.000Z",
        "meanTemperatureC": 30.0,
        "highTemperatureC": 32.5,
        "lowTemperatureC": 27.5,
        "weatherCode": 1,
        "conditionText": "Mainly clear",
        "feedAdjustmentPct": 0,
        "feedingRecommendation": "normal"
      },
      {
        "date": "2025-12-01T00:00:00.000Z",
        "meanTemperatureC": 29.5,
        "highTemperatureC": 32.0,
        "lowTemperatureC": 27.0,
        "weatherCode": 2,
        "conditionText": "Partly cloudy",
        "feedAdjustmentPct": 0,
        "feedingRecommendation": "normal"
      }
    ]
  }
}
```

**Note:** MARKET dashboard returns identical structure with `"group": "MARKET"`

**Field Descriptions:**

**Summary fields:**
- `hasData`: `true` if farmer has GPS coordinates and weather data available
- `airTemperatureC`: Current air temperature from weather API (null if no data)
- `temperatureDeltaC`: Degrees away from optimal range (negative = below 28°C, positive = above 32°C, 0 = optimal, null = no data)
- `comfortRangeC`: Optimal air temperature range { min: 28, max: 32 }
- `recommendedFeedAdjustmentPct`: Overall feed adjustment % based on current temperature
- `weather`: Current weather snapshot (time, temperatureC, humidityPct, windSpeedKph, rainMm, weatherCode, conditionText)
- `hourlyForecast`: Up to 24 hours of forecasted weather points (time, temperatureC, humidityPct, weatherCode)
- `averageFishWeight`: Average weight per fish in kg (LARGE and MARKET only)
- `weightChange`: Weight change percentage vs previous period (LARGE and MARKET only)
- `latestFishAgeLabel`: Last recorded textual fish-age label (LARGE and MARKET only)
- `latestFishAgeDays`: Numeric days derived from the label or production-cycle aging (LARGE and MARKET only)
- `latestFishStageName`: Display name for the matched `FishAgeStage` row (LARGE and MARKET only)
- `latestHarvestStatus`: Enum `UNKNOWN | TOO_EARLY | OPTIMAL | LATE` summarizing harvest readiness (LARGE and MARKET only)
- `latestHarvestStatusReason`: Human-readable justification for the harvest status (LARGE and MARKET only)
- `pelletFoodCost`: Total pellet food cost in baht (LARGE and MARKET only)
- `freshFoodCost`: Total fresh food cost in baht (LARGE and MARKET only)
- `monthlyFeedingData`: Array of 12 months of feeding data in kg (LARGE and MARKET only)
  - `month`: Month abbreviation (Jan-Dec)
  - `value`: Total feed amount in kg

**Feeding plan fields:**
- `date`: ISO date string for each day
- `meanTemperatureC`: Daily mean air temperature (used for feed calculations)
- `highTemperatureC`: Forecasted high air temperature (for farmer reference)
- `lowTemperatureC`: Forecasted low air temperature (for farmer reference)
- `weatherCode`: WMO weather code (0-99) for icon display (optional)
- `conditionText`: Human-readable weather condition (e.g., "Sunny", "Rain") (optional)
- `feedAdjustmentPct`: **Percentage to adjust feed** (e.g., -15 = reduce 15%, 0 = normal)
- `feedingRecommendation`: **Action keyword** - `"increase"`, `"decrease"`, or `"normal"`

**Air Temperature Logic (tuned for Pathum Thani, Thailand):**

The feeding adjustment algorithm uses **daily mean air temperature** from Google Maps Weather API (converted to Celsius). Air temperature in tropical ponds is typically 5-7°C higher than water temperature.

**Temperature Zones:**
- **< 18°C air**: Extreme cold, reduce 80% (water ~13°C, rare 1-2 days/year)
- **18-21°C air**: Very cold, reduce 60% (water ~15°C, Dec-Jan coldest mornings)
- **21-24°C air**: Cold, reduce 40% (water ~18°C, occasional Nov-Feb)
- **24-26°C air**: Cool, reduce 40-50% (water ~20°C, common Nov-Feb)
- **26-28°C air**: Mild, reduce 3% per degree (water ~22°C, very common mornings)
- **28-35°C air**: 🟢 OPTIMAL ZONE, 0% adjustment (water 23-30°C)
- **35-37°C air**: Entering stress, reduce 6% per degree (water ~30°C)
- **37-39°C air**: Moderate stress, reduce 30% (water ~32°C, reduced dissolved oxygen)
- **39-41°C air**: Severe stress, reduce 60% (water ~34°C, low dissolved oxygen)
- **> 41°C air**: Critical, reduce 85% (water >36°C, survival mode)

**Research Basis:**
- Tucker & Hargreaves (2004): Channel catfish feeding behavior and temperature
- Boyd & Tucker (1998): Pond Aquaculture Water Quality Management
- Thailand DOF (2018): Catfish farming best practices for Central region

**Air-Water Temperature Correlation:**
- Based on shallow pond studies in tropical climates
- Air temp = Water temp + 5-7°C (typical)
- Pathum Thani climate: 28-35°C air for ~80% of year (optimal range)

**Frontend responsibility:** 
- Render UI text based on `feedingRecommendation`: 
  - `"increase"` → "อากาศเย็น ควรเพิ่มอาหาร +X%"
  - `"decrease"` → "อากาศร้อน/เย็น ควรลดอาหาร X%"
  - `"normal"` → "อุณหภูมิเหมาะสม ให้ตามปกติ"
- Display color-coded indicators (blue=increase, green=normal, red=decrease)
- Show specific advice for extreme temperatures (> 40°C: add aerators, feed morning/evening only)

---
## 5. Farm Data Records
### GET `/records/form-state?farmType=<FarmType>`
- **Auth:** any logged-in user (Farmer role recommended).
- **Query params:**
  - `farmType` (required): `SMALL`, `LARGE`, or `MARKET` (case-insensitive). `SMALL` = Fingerling/Pla Tum (7-10 days), `LARGE` = Pla Nio juvenile stage (11-30 days).
- **Behavior:**
  - Uses the requesting farmer's GPS coordinates (if available) to pull a live weather snapshot.
  - Returns current server time for pre-filling the record timestamp.
  - Flags whether the backend has enough location data to suggest weather values.
- **Response:**
```json
{
  "data": {
    "currentDateTime": "2025-12-08T03:42:11.582Z",
    "farmType": "LARGE",
    "locationAvailable": true,
    "weather": {
      "observedAt": "2025-12-08T03:40:00.000Z",
      "temperatureC": 31.2,
      "rainMm": 0.0,
      "humidityPct": 68,
      "conditionText": "Mainly clear",
      "weatherCode": 1
    }
  }
}
```
- **Field notes:**
  - `weather` can be `null` if no coordinates are stored or if the weather API call failed.
  - `locationAvailable` stays `true` even when the provider is temporarily unreachable (lat/lng exist).

#### 🐟 Fish Age Windows (Dec 2025 update)
| Stage | FarmType | Day Range | Harvest Window | Notes |
| --- | --- | --- | --- | --- |
| ปลาตุ้ม | `SMALL` | 7-10 วัน | – | Newly hatched fry adjusting from yolk to feed |
| ปลานิ้ว | `LARGE` | 11-30 วัน | – | Juvenile fingerlings, preparing for nursery transfer |
| ปลาตลาด | `MARKET` | 31-180 วัน (≈2-6 เดือน) | 60-180 วัน | Grow-out fish ready for harvest after 2 months |

`FishStageService` and every dashboard metric now rely on these boundaries. Any custom `fishAgeLabel` should include the day range (e.g., `"ปลาตลาด (31-180 วัน / 2-6 เดือน)"`) so the backend can infer the correct stage.

### POST `/records`
- **Auth:** FARMER role only.
- **Body:**
```json
{
  "farmType": "MARKET",
  "recordedAt": "2025-12-07T10:00:00.000Z",
  "fishAgeLabel": "ปลาตลาด (31-180 วัน / 2-6 เดือน)",
  "pondType": "EARTHEN",
  "pondCount": 2,
  "fishCountText": "35,000 ตัว",
  "weather": {
    "temperatureC": 31.5,
    "rainMm": 0,
    "humidityPct": 70
  },
  "notes": "น้ำค่อนข้างขุ่น เพิ่มการถ่ายน้ำ 20%"
}
```
- **Behavior:**
  - Automatically upserts the farmer's `FarmerCultivationType` row for the submitted `farmType`.
  - Parses `fishCountText` into an integer (`fishCount`) while keeping the original string.
  - Estimates `fishAgeDays` from the provided label (or future production-cycle data) and looks up the matching `FishAgeStage` row.
  - Computes `harvestStatus` (`UNKNOWN`, `TOO_EARLY`, `OPTIMAL`, `LATE`) plus a natural-language reason.
  - Stores weather metrics per record so later dashboards can reference historical conditions.
- **Response:**
```json
{
  "data": {
    "id": "44d3946f-6b19-4d16-b0a3-f44b4da7c598",
    "userId": "0a998ac9-58ea-4dce-ba23-59fd9f5dd7c1",
    "farmType": "MARKET",
    "cultivationTypeId": "4f58b9f6-5f7f-4fd2-9de0-89b6cded2b8a",
    "recordedAt": "2025-12-07T10:00:00.000Z",
    "fishAgeLabel": "ปลาตลาด (31-180 วัน / 2-6 เดือน)",
    "fishAgeDays": 75,
    "fishAgeStageId": "67c6c451-119e-404b-a398-74f0f43ad39d",
    "harvestStatus": "OPTIMAL",
    "harvestStatusReason": "Fish age 75d sits in the optimal harvest window (60-180d)",
    "pondType": "EARTHEN",
    "pondCount": 2,
    "fishCount": 35000,
    "fishCountText": "35,000 ตัว",
    "averageFishWeightGr": 320.0,
    "weatherTemperatureC": 31.5,
    "weatherRainMm": 0,
    "weatherHumidityPct": 70,
    "notes": "น้ำค่อนข้างขุ่น เพิ่มการถ่ายน้ำ 20%",
    "createdAt": "2025-12-08T03:45:22.111Z",
    "updatedAt": "2025-12-08T03:45:22.111Z"
  }
}
```
- **Validation:**
  - `farmType`, `recordedAt`, and `fishAgeLabel` are required.
  - `pondType` must be `EARTHEN` or `CONCRETE` if supplied.
  - `pondCount` and weather metrics must be numeric when present.
  - Weather block is optional and any field may be omitted.
- **Derived fields:**
  - `fishAgeDays` comes from `FishStageService` and is stored even if no `FishAgeStage` matches (null stage, status `UNKNOWN`).
  - `fishAgeStageId` references the catalog seeded via Prisma migrations (upserted for each farm type).
  - `harvestStatus` + `harvestStatusReason` explain whether the fish cohort is ready for harvest.
  - `cultivationTypeId` links back to the appropriate `FarmerCultivationType` row for longitudinal analytics.

### PUT `/records/:id`
- **Auth:** FARMER or ADMIN role.
- **Path params:** `id` (required, UUID).
- **Body:** `Partial<CreateEntryInput>` - identical to POST body, but all fields are optional.
- **Behavior:** 
  - Updates only the provided fields.
  - Recalculates `fishAgeDays`, `fishAgeStage`, and `harvestStatus` if `fishAgeLabel` is changed.
  - Updates weather data if a new weather block is provided.
- **Response:** Updated record (same format as POST response).
- **Error cases:**
  - `404`: Record not found.
  - `400`: Validation error (e.g., negative numbers).

### DELETE `/records/:id`
- **Auth:** FARMER or ADMIN role.
- **Path params:** `id` (required, UUID).
- **Response:**
```json
{
  "message": "Record deleted successfully"
}
```

---

## 6. Weather Proxy
### GET `/v1/weather?lat=<number>&lng=<number>`
- **Auth:** any authenticated user.
- **Query params:** both required, numeric.
- **Weather Provider:** Google Maps Weather API (`weather.googleapis.com/v1/weather:forecast`)
  - Requires enabling the Weather API in Google Cloud Console and setting `GOOGLE_MAPS_API_KEY`
  - Returns `currentConditions`, 24-hour `hourlyForecasts`, and 7-day `dailyForecasts`
  - Condition codes (e.g., `PARTLY_CLOUDY_DAY`) are mapped to WMO codes (0-99) for frontend compatibility
  - Units: Metric (Celsius, km/h, mm) with responses localized to `languageCode=th`
  - Timezone: Asia/Bangkok
- **Caching:** In-memory cache (keyed by `lat,lng`) with a 10-minute TTL reduces API usage and mitigates quota exhaustion
- **Response:** `{ "data": CurrentWeather }` from `WeatherService.getCurrentWeather`
- **Response fields:**
  - `time`: ISO timestamp provided by Google (`currentConditions.observationTime`)
  - `temperatureC`: Air temperature in Celsius (`currentConditions.temperature.value`)
  - `humidityPct`: Relative humidity percentage (automatically converted to 0-100 range)
  - `windSpeedKph`: Wind speed in km/h
  - `rainMm`: Precipitation intensity in mm/h (when provided)
  - `weatherCode`: WMO weather code (0-99)
  - `conditionText`: Human-readable text derived from Google condition codes (e.g., "Partly Cloudy Day")

### WMO Weather Code Reference

Weather codes follow the World Meteorological Organization (WMO) standard. Use these codes to display appropriate weather icons in your frontend.

| Code | Condition | Icon Suggestion | Description |
|------|-----------|----------------|-------------|
| **Clear** |
| 0 | Clear sky | ☀️ | Sunny, no clouds |
| **Cloudy** |
| 1 | Mainly clear | 🌤️ | Mostly sunny, few clouds |
| 2 | Partly cloudy | ⛅ | Partly cloudy |
| 3 | Overcast | ☁️ | Completely cloudy |
| **Fog** |
| 45 | Fog | 🌫️ | Foggy |
| 48 | Depositing rime fog | 🌫️ | Foggy with frost |
| **Drizzle** |
| 51 | Light drizzle | 🌦️ | Light drizzle |
| 53 | Moderate drizzle | 🌦️ | Moderate drizzle |
| 55 | Dense drizzle | 🌦️ | Heavy drizzle |
| 56 | Light freezing drizzle | 🌧️ | Freezing drizzle |
| 57 | Dense freezing drizzle | 🌧️ | Heavy freezing drizzle |
| **Rain** |
| 61 | Slight rain | 🌧️ | Light rain |
| 63 | Moderate rain | 🌧️ | Moderate rain |
| 65 | Heavy rain | 🌧️ | Heavy rain |
| 66 | Light freezing rain | 🌧️ | Freezing rain |
| 67 | Heavy freezing rain | 🌧️ | Heavy freezing rain |
| **Snow** |
| 71 | Slight snow | ❄️ | Light snow |
| 73 | Moderate snow | ❄️ | Moderate snow |
| 75 | Heavy snow | ❄️ | Heavy snow |
| 77 | Snow grains | ❄️ | Snow grains |
| **Showers** |
| 80 | Slight rain showers | 🌦️ | Light rain showers |
| 81 | Moderate rain showers | 🌦️ | Moderate rain showers |
| 82 | Violent rain showers | 🌧️ | Heavy rain showers |
| 85 | Slight snow showers | 🌨️ | Light snow showers |
| 86 | Heavy snow showers | 🌨️ | Heavy snow showers |
| **Thunderstorm** |
| 95 | Thunderstorm | ⛈️ | Thunderstorm |
| 96 | Thunderstorm with slight hail | ⛈️ | Thunderstorm with hail |
| 99 | Thunderstorm with heavy hail | ⛈️ | Thunderstorm with heavy hail |

**Frontend Icon Mapping Example:**

```javascript
const weatherIcons = {
  0: '☀️',        // Clear sky
  1: '🌤️',       // Mainly clear
  2: '⛅',       // Partly cloudy
  3: '☁️',       // Overcast
  45: '🌫️',      // Fog
  48: '🌫️',      // Rime fog
  51: '🌦️',      // Light drizzle
  53: '🌦️',      // Moderate drizzle
  55: '🌦️',      // Dense drizzle
  61: '🌧️',      // Slight rain
  63: '🌧️',      // Moderate rain
  65: '🌧️',      // Heavy rain
  71: '❄️',      // Slight snow
  73: '❄️',      // Moderate snow
  75: '❄️',      // Heavy snow
  80: '🌦️',      // Light rain showers
  81: '🌦️',      // Moderate rain showers
  82: '🌧️',      // Heavy rain showers
  85: '🌨️',      // Light snow showers
  86: '🌨️',      // Heavy snow showers
  95: '⛈️',      // Thunderstorm
  96: '⛈️',      // Thunderstorm with slight hail
  99: '⛈️',      // Thunderstorm with heavy hail
};

// Usage
const icon = weatherIcons[weatherCode] || '🌡️';
```

**Recommended Icon Libraries:**
- [Lucide React](https://lucide.dev/) - Modern icon set with `<Cloud>`, `<CloudRain>`, `<Sun>`, etc.
- [Weather Icons](https://erikflowers.github.io/weather-icons/) - Dedicated weather icon font
- [Font Awesome](https://fontawesome.com/) - Weather category icons
- [React Icons](https://react-icons.github.io/react-icons/) - Includes weather icons from multiple sets

---

## 7. Farmers Management
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
        "farmType": "SMALL",
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

### GET `/farmers/:farmerId`
- **Auth:** Admin or Researcher.
- **Path params:** `farmerId` is required (UUID).
- **Query params:**
  - `farmType` (optional): Filter stats and history by farm type (`SMALL`, `LARGE`, `MARKET`, or `ALL`). Defaults to user's primary farm type. `ALL` returns records from all types.
- **Response:**
```json
{
  "data": {
    "userId": "uuid",
    "fullName": "Somchai Prasert",
    "phone": "0812345678",
    "farmType": "SMALL",
    "availableFarmTypes": ["SMALL", "LARGE"],
    "registrationStatus": "COMPLETED",
    "pondCount": 4,
    "latitude": 14.077,
    "longitude": 100.608,
    "registeredAt": "2025-11-27T12:00:00.000Z",
    "stats": {
      "averageFishWeight": null,
      "survivalRate": 95,
      "survivalRatePct": 95,
      "latestFishAgeDays": 45,
      "latestFishAgeLabel": "45 วัน",
      "latestFishCount": 2500,
      "totalPonds": 4
    },
    "entries": [
      {
        "id": "entry-uuid",
        "recordedAt": "2025-12-20T10:00:00.000Z",
        "farmType": "SMALL",
        "fishAgeDays": 45,
        "fishAgeLabel": "45 วัน",
        "pondType": "EARTHEN",
        "pondCount": 4,
        "fishCount": 2500,
        "fishCountText": "2500",
        "foodAmountKg": null,
        "weatherTemperatureC": 32.5,
        "weatherRainMm": 0,
        "weatherHumidityPct": 60,
        "fishAverageWeight": null
      }
    ]
  }
}
```
- **Error cases:**
  - `400` if `farmerId` is missing
  - `404` if farmer does not exist

---

### DELETE `/farmers/:farmerId`
- **Auth:** Admin only.
- **Response:**
```json
{
  "message": "Farmer deleted successfully"
}
```
- **Notes:**
  - Removes the farmer user, profile, farm data entries, registered farms, ponds, production cycles, associated feed formulas, and research records.
  - Operation is irreversible. Use with caution.

---

## 8. Feed Formulas Management

### Data Model

Feed formulas now include a `foodType` categorization:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | Formula name (Thai) |
| `foodType` | enum | Yes | `FRESH`, `PELLET`, or `SUPPLEMENT` |
| `targetStage` | string | No | Target fish size (e.g., "2-5 ซม.", ">10 ซม.") |
| `nutrients` | string | No | Nutritional benefits (multi-line text) |
| `usage` | string | No | Feeding instructions (multi-line text) |
| `recommendations` | string | No | Warnings and tips (multi-line text) |
| `farmType` | enum | No | `SMALL`, `LARGE`, or `MARKET` |

### POST `/feed-formulas`
- **Auth:** Admin only.
- **Body:**
```json
{
  "name": "เครื่องในไก่/หมู",
  "foodType": "FRESH",
  "targetStage": ">10 ซม.",
  "nutrients": "• โปรตีน 15-25%\n• ธาตุเหล็กสูง\n• วิตามินบีรวม",
  "usage": "• สับให้ละเอียดก่อนให้\n• แช่เย็นเก็บได้ 2-3 วัน\n• ให้วันละ 1-2 ครั้ง",
  "recommendations": "ถ้ามีกลิ่น เสี่ยงติดเชื้อในเลือด\nไขมันสูง น้ำเสียง่าย",
  "farmType": "MARKET"
}
```
- **Validation:** 
  - `name` is required
  - `foodType` is required. Values: `FRESH`, `PELLET`, `SUPPLEMENT` (case-insensitive)
  - `farmType` is optional. Values: `SMALL`, `LARGE`, `MARKET` (case-insensitive)
- **Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "เครื่องในไก่/หมู",
    "foodType": "FRESH",
    "targetStage": ">10 ซม.",
    "nutrients": "• โปรตีน 15-25%...",
    "usage": "• สับให้ละเอียดก่อนให้...",
    "recommendations": "ถ้ามีกลิ่น เสี่ยงติดเชื้อในเลือด...",
    "farmType": "MARKET",
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
        "name": "เครื่องในไก่/หมู",
        "foodType": "FRESH",
        "targetStage": ">10 ซม.",
        "nutrients": "• โปรตีน 15-25%...",
        "usage": "• สับให้ละเอียดก่อนให้...",
        "recommendations": "ถ้ามีกลิ่น เสี่ยงติดเชื้อในเลือด...",
        "farmType": "MARKET",
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
- **Response:** Same as create response.

### PUT `/feed-formulas/:id`
- **Auth:** Admin only.
- **Body:** Same as POST (all fields optional except during update)
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

## 9. Researchers & Surveys Management
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
        "farmType": "SMALL",
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

## 10. Disease Analyzer

### GET `/diseases`

Intelligent disease diagnosis through symptom-based search with fuzzy matching. Supports Thai language and multiple search modes.

- **Auth:** Required (any authenticated user)
- **Query Parameters:**

| Parameter | Type | Required | Description | Example |
| --- | --- | --- | --- | --- |
| `symptoms` | string | Optional | Comma-separated symptoms (Thai) | `จุดแดง,ครีบเน่า,ซึม` |
| `category` | string | Optional | Filter by disease category | `แบคทีเรีย`, `ปรสิต`, `เชื้อรา`, `โภชนาการ`, `สิ่งแวดล้อม` |
| `page` | integer | Optional | Page number (1-indexed) | `1` |
| `limit` | integer | Optional | Items per page (max 100) | `10` |

- **Search Behavior:**
  - **Empty query**: Returns all diseases (paginated)
  - **Symptom search**: Fuzzy matching across name, symptoms, tags (Thai)
  - **Category filter**: Exact match on disease category
  - **Combined search**: Both symptoms AND category must match

- **Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid-1",
        "name": "โรคเอโรโมนัส (Motile Aeromonas Septicemia)",
        "category": "แบคทีเรีย",
        "icon": "🦠",
        "symptoms": "• ปลามีแผลเลือดออกบริเวณตัว ครีบ และหาง\n• ผิวหนังมีจุดแดง จุดเลือดออก...",
        "causes": "สาเหตุ: เชื้อแบคทีเรีย Aeromonas hydrophila...",
        "treatment": "การรักษาเบื้องต้น:\n1. ปรับปรุงคุณภาพน้ำทันที...",
        "prevention": "มาตรการป้องกัน:\n• รักษาคุณภาพน้ำให้ดีอยู่เสมอ...",
        "treatmentSummary": "ปรับคุณภาพน้ำ เพิ่มออกซิเจน ใช้ยาปฏิชีวนะและแช่น้ำยาฆ่าเชื้อตามสัตวแพทย์",
        "tags": [
          { "id": "tag-1", "label": "แผลเลือดออก" },
          { "id": "tag-2", "label": "จุดแดง" },
          { "id": "tag-3", "label": "ท้องบวม" }
        ],
        "createdAt": "2025-12-16T00:00:00.000Z",
        "updatedAt": "2025-12-16T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 9,
      "itemsPerPage": 10
    }
  }
}
```

**Example Requests:**

```http
# Get all diseases
GET /diseases

# Search by symptoms
GET /diseases?symptoms=จุดแดง,ครีบเน่า

# Filter by category
GET /diseases?category=แบคทีเรีย

# Combined search
GET /diseases?symptoms=ซึม&category=ปรสิต&page=1&limit=5
```

---

### GET `/diseases/:id`

Get detailed information for a specific disease by ID.

- **Auth:** Required (any authenticated user)
- **Path Parameters:**
  - `id` (string, required): Disease UUID

- **Response:**
```json
{
  "data": {
    "id": "uuid-1",
    "name": "โรคจุดขาว (White Spot Disease)",
    "category": "ปรสิต",
    "icon": "🔬",
    "symptoms": "• มีจุดขาวขนาดเล็กเหมือนเกลือ บนตัว ครีบ เหงือก\n• ปลาเสียดสีตัวกับพื้นบ่อหรือผนังบ่อ\n• ครีบชีบๆ แบมๆ กระตุก\n• ผลิตเมือกมากผิดปกติ ผิวหนังมัว...",
    "causes": "สาเหตุ: ปรสิตโปรโตซัว Ichthyophthirius multifiliis\nปัจจัยเสี่ยง:\n• อุณหภูมิน้ำต่ำ (15-25°C)\n• คุณภาพน้ำเลว...",
    "treatment": "การรักษา:\n1. เพิ่มอุณหภูมิน้ำเป็น 30-32°C (ช้าๆ 1-2°C/วัน)\n2. ใช้น้ำเกลือบริสุทธิ์ (NaCl):\n   - แช่น้ำเกลือ 10-15 ppt...",
    "prevention": "มาตรการป้องกัน:\n• กักกันปลาใหม่ 14-21 วัน ก่อนนำลงบ่อ\n• ตรวจดูจุดขาวอย่างละเอียดก่อนซื้อปลา...",
    "treatmentSummary": "เพิ่มอุณหภูมิ แช่น้ำเกลือ/ฟอร์มาลิน/มาลาไคต์กรีน เปลี่ยนน้ำบ่อย และกักกัน",
    "tags": [
      { "id": "tag-10", "label": "จุดขาว" },
      { "id": "tag-11", "label": "คันเสียดสี" },
      { "id": "tag-12", "label": "เหงือกบวม" }
    ],
    "createdAt": "2025-12-16T00:00:00.000Z",
    "updatedAt": "2025-12-16T00:00:00.000Z"
  }
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "message": "Disease not found"
}
```


---

### GET `/symptoms`

Get curated list of symptom chips categorized for quick selection.

- **Auth:** Required (any authenticated user)
- **Response:**
```json
{
  "data": [
    {
      "category": "อาการทั่วไป",
      "chips": ["เบื่ออาหาร", "ว่ายหมุน", "ลอยหัว", "ซึม", "ถูตัว"]
    },
    {
      "category": "ลักษณะภายนอก",
      "chips": ["จุดขาว", "แผลเลือดออก", "ท้องบวม", "ตาโปน", "ตัวผอม", "เกล็ดหลุด"]
    },
    {
      "category": "อวัยวะ",
      "chips": ["ครีบเปื่อย", "หางเปื่อย", "ปากขาว", "เหงือกซีด"]
    }
  ]
}
```

---

### POST `/disease-analyzer`

Analyze fish disease from symptoms and/or photo. Uses AI fuzzy logic scoring.

- **Auth:** Required
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `symptomText` | string | Optional | Description of symptoms (e.g., "ปามีแผลเลืดออก") |
| `symptomTags` | string[] | Optional | Array of selected symptom chips |
| `photo` | file | Optional | Image file for analysis (Future implementation) |

- **Response:**
```json
{
  "data": {
    "requestId": "uuid",
    "photoPath": "/uploads/file.jpg",
    "results": [
      {
        "diseaseId": "uuid",
        "name": "โรคจุดขาว (White Spot Disease)",
        "score": 0.95,
        "rank": 1,
        "reasons": ["Text Match: เลือดออก", "Tags Match: 2/2"]
      }
    ]
  }
}
```

---

### GET `/disease-analyzer/:id`

Get analysis result history.

- **Auth:** Required
- **Path Parameters:**
  - `id` (string, required): Analysis Result UUID

---

### Disease Categories

The system includes 5 disease categories:

| Category (Thai) | Category (English) | Description |
| --- | --- | --- |
| `แบคทีเรีย` | Bacteria | Bacterial infections (e.g., Aeromonas, Streptococcus) |
| `ปรสิต` | Parasites | Parasitic infections (e.g., White Spot, Anchor Worm) |
| `เชื้อรา` | Fungi | Fungal infections (e.g., Saprolegnia) |
| `โภชนาการ` | Nutrition | Nutritional deficiencies (e.g., vitamin deficiency) |
| `สิ่งแวดล้อม` | Environment | Environmental stress (e.g., poor water quality) |

---

### Pre-configured Diseases

The system comes with 9 common catfish diseases:

1. **โรคเอโรโมนัส** (Motile Aeromonas Septicemia) - แบคทีเรีย
2. **โรคเอ็ดเวิดส์ซิเอลลา** (Edwardsiellosis) - แบคทีเรีย
3. **โรคสเตรปโตคอคคัส** (Streptococcosis) - แบคทีเรีย
4. **โรคจุดขาว** (White Spot Disease) - ปรสิต
5. **โรคหนอนสมอ** (Anchor Worm) - ปรสิต
6. **โรคเหงือกเน่า** (Columnaris Disease) - แบคทีเรีย
7. **โรคขาดสารอาหาร** (Nutritional Deficiency) - โภชนาการ
8. **โรคเชื้อรา** (Saprolegniasis) - เชื้อรา
9. **อาการเครียด** (Stress Syndrome) - สิ่งแวดล้อม

Each disease includes comprehensive information on symptoms, causes, treatment protocols, and prevention measures tailored for Thai catfish farmers.

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
- **Token never expires**: Tokens remain valid indefinitely unless JWT_SECRET is changed
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

### Version 1.0.5 (2025-12-13)

**🆕 FarmType rename (Fingerling → SMALL, Fattening → LARGE)**

**Changed:**
- Prisma `FarmType` enum now exposes `SMALL`, `LARGE`, `MARKET`. Existing records are migrated via `20251213100000_rename_farm_type_small_large`.
- All backend services, migrations, and docs now expect `SMALL` for the fingerling/Pla Tum window (7-10 days) and `LARGE` for the Pla Nio juvenile window (11-30 days).
- API request/response examples plus validation notes have been updated so clients know to send the new labels. Include the legacy names in UI copy if farmers still refer to them.

---

### Version 1.0.4 (2025-12-08)

**🐟 Fish-Age Intelligence & Farm Records**

**Added:**
- **Farm Data Record APIs**:
  - `GET /records/form-state` to prefill record forms with the current timestamp, requested farm type, and live weather snapshot.
  - `POST /records` for FARMER accounts to submit pond counts, fish-age labels, optional weather metrics, and notes.
- **Automatic Fish Age Classification**:
  - Every record now estimates `fishAgeDays`, links to a `FishAgeStage`, and calculates `harvestStatus` + reasoning text.
  - Dashboards display the latest fish-age label, derived days, matched stage name, and harvest readiness badge.
- **Dashboard Enhancements**:
  - Hourly weather forecasts are surfaced alongside summaries for all farm groups.
  - LARGE & MARKET summaries expose new stage fields so the frontend can show readiness banners.

**Changed:**
- Reset fish age windows to Tum (7-10 วัน), Nio (11-30 วัน), and Pla Talad (31-180 วัน ≈ 2-6 เดือน) with the new harvest window at 60-180 days.
- Added migration `20251211134813_update_fish_age_windows` to reseed the `fish_age_stages` table with the updated ranges.

**Documentation:**
- Endpoint matrix, dashboard samples, and field descriptions updated to reflect the new payloads.
- Added a dedicated "Farm Data Records" section covering form-state and submission flows.

---

### Version 1.0.3 (2025-12-02)

**🔐 Admin Authentication & Database Updates**

**Added:**
- **Admin Authentication System**:
  - `POST /auth/admin/create` - Create admin accounts with email/password
  - `POST /auth/admin/login` - Admin login endpoint (separate from LINE OAuth)
  - Admin profiles stored in `researcher_profiles` table with email field
- **Feed Formula Enhancement**:
  - `farmType` field added to feed formulas (optional)
  - Values: `SMALL`, `LARGE`, `MARKET`
  - Allows farm-type-specific feed recommendations
- **Farmer Detail Endpoint**:
  - `GET /farmers/:farmerId` now available for Admins and Researchers
  - Returns a single farmer's profile with coordinates, pond count, and registration metadata

**Database:**
- Added `farm_type` column to `feed_formulas` table
- Added migration: `20251202095500_add_farm_type_to_feed_formula`

**Deployment:**
- Updated Render Start Command: `npx prisma db push && node dist/server.js`
- Ensures schema sync on deployment without shell access

**Technical:**
- Weather service migrated to Google Maps Weather API with 10-minute in-memory caching
- Google condition codes converted to WMO codes (0-99) for frontend weather icon display

---

### Version 1.0.2 (2025-11-30)

**🔬 LARGE (formerly FATTENING) & MARKET Dashboard Update** *(formerly NURSERY_LARGE & GROWOUT)*

**Added:**
- **LARGE Dashboard API (formerly FATTENING)** - Complete implementation with extended metrics
  - `averageFishWeight`: Average weight per fish in kg (calculated from pond records)
  - `weightChange`: Weight change percentage vs previous period
  - `pelletFoodCost`: Total pellet food cost in baht
  - `freshFoodCost`: Total fresh food cost in baht
  - `monthlyFeedingData`: Array of 12 months of feeding data (Jan-Dec, rotated from current month)
- **MARKET Dashboard API** - Complete implementation with same extended metrics as LARGE
  - Identical structure and features to the LARGE dashboard
  - Optimized for market-size fish production stage
- 7-day feeding plan with same weather integration as SMALL (Fingerling) for both new farm types
- Mock data generators for fish weight and costs (with TODO comments for database integration)

**Technical:**
- Created `NurseryLargeDashboardService` with three helper functions:
  - `generateMonthlyFeedingData()`: Creates 12-month array rotated from current month
  - `calculateAverageFishWeight()`: Returns fish weight with % change
  - `calculateFoodCosts()`: Returns pellet and fresh food costs
- Created `GrowoutDashboardService` with identical structure to the LARGE dashboard
- Integrated with existing WeatherService and FeedingCalculator
- Updated routing in `HomeService` to direct LARGE and MARKET requests to respective services

**Improved:**
- Dashboard endpoint matrix documentation updated
- Response examples added for LARGE and MARKET
- Field descriptions enhanced with farm type-specific fields

**Status:**
- SMALL (Fingerling): ✅ Complete
- LARGE (formerly FATTENING): ✅ Complete
- MARKET: ✅ Complete

**All three farm type dashboards are now fully operational!**

---

### Version 1.0.1 (2025-11-28)

**🌤️ Weather Enhancement Update**

**Added:**
- WMO weather codes (0-99) to all weather responses for icon display
- `weatherCode` field in `CurrentWeather` type
- `weatherCode` field in `DailyForecast` type
- `weatherCode` and `conditionText` fields in feeding plan items
- `meanTemperatureC` field in feeding plan (primary calculation temperature)
- Comprehensive WMO weather code reference table with icon suggestions
- Frontend integration examples for weather icon mapping

**Improved:**
- Feeding algorithm now uses daily mean temperature (more accurate than max)
- Formula specifically tuned for Pathum Thani climate conditions
- Progressive reduction curves for temperature zones
- Adjustment range expanded: -90% to 0% (was -50% to +10%)
- Better handling of extreme temperatures (< 18°C and > 41°C)

**Technical:**
- Air-water temperature correlation documented (air = water + 5-7°C)
- Research references added (Tucker & Hargreaves 2004, Boyd & Tucker 1998, Thailand DOF 2018)
- Temperature zones aligned with Pathum Thani seasonal patterns

---

### Version 1.1.0 (2025-12-16)

**🏥 Disease Intelligence System**

**Added:**
- **Disease Analyzer API**: New `/diseases` endpoints for intelligent disease diagnosis
- Comprehensive disease database with 9 common catfish diseases:
  - Motile Aeromonas Septicemia (โรคเอโรโมนัส)
  - Edwardsiellosis (โรคเอ็ดเวิดส์ซิเอลลา)
  - Streptococcosis (โรคสเตรปโตคอคคัส)
  - White Spot Disease (โรคจุดขาว)
  - Anchor Worm (โรคหนอนสมอ)
  - Columnaris Disease (โรคเหงือกเน่า)
  - Nutritional Deficiency (โรคขาดสารอาหาร)
  - Saprolegniasis (โรคเชื้อรา)
  - Stress Syndrome (อาการเครียด)
- Multi-symptom search with fuzzy matching (Thai language support)
- Category-based filtering: แบคทีเรีย, ปรสิต, เชื้อรา, โภชนาการ, สิ่งแวดล้อม
- Tag-based symptom search for quick diagnosis
- Detailed disease information: symptoms, causes, treatment, prevention
- Treatment summaries and recommendations
- Database seeding script (`prisma/seed.ts`) for automated disease data population

**Database:**
- Added `Disease` model with fields: name, category, icon, symptoms, causes, treatment, prevention, treatmentSummary
- Added `DiseaseTag` model for symptom-based search optimization
- Migration: `20251216155036_disease_analyzer`
- Added unique constraint on disease names

**Technical:**
- Fuzzy search implementation for Thai symptom text
- Case-insensitive search across multiple fields
- Efficient tag-based querying with Prisma relations

---

### Version 1.0.0 (2025-11-27)

**🎉 Initial Release**

**Added:**
- Complete authentication system via LINE Login OAuth
- Role-based access control (ADMIN, FARMER, RESEARCHER)
- Dashboard endpoints with weather integration
- Farmers management API (list with pagination)
- Feed formulas CRUD operations
- Researchers and surveys management
- Weather service integration
- Health check endpoints for monitoring
- Comprehensive API documentation

**Renamed:**
- `/api/onboarding/*` → `/api/register/*` (clearer semantics)
- `/api/home/groups/:groupType` → `/api/dashboard/groups/:groupType` (consistent naming)

**Technical:**
- Weather service integration for real-time air temperature monitoring
- Unified feeding calculation logic across summary and 7-day plan
- Air temperature-based feeding recommendations (28-35°C optimal range)
- JWT tokens with no expiration (permanent tokens)

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
- Weather data structure maintained for backward compatibility

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
- **Google Maps Weather API**: https://developers.google.com/maps/documentation/weather
- **Prisma ORM**: https://www.prisma.io/docs

### Getting Help
- **GitHub Issues**: [koard/DukeFarm-Backend/issues](https://github.com/koard/DukeFarm-Backend/issues)
- **Team Contact**: Betagro & Kasetsart University Research Team

---

**© 2025 DukeFarm. All rights reserved.**

Built with ❤️ for sustainable aquaculture in Thailand 🇹🇭
