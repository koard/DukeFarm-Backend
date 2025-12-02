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
- **🌤️ Weather Intelligence**: Real-time weather data via Open-Meteo API (free, unlimited)
- **📊 Smart Dashboards**: Farm group overviews with feeding recommendations
- **🔬 Research Tools**: Survey management and data collection
- **📈 Analytics**: Temperature-based feeding adjustments

### Technology Stack

- **Framework**: Express 5 + TypeScript
- **Database**: PostgreSQL 14+ via Prisma ORM
- **Authentication**: JWT (no expiration)
- **External APIs**: LINE Login OAuth, Open-Meteo Weather API (free, no API key required)

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
  - All three farm types (NURSERY_SMALL, NURSERY_LARGE, GROWOUT) are fully implemented
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
        "weatherCode": 0,
        "conditionText": "Clear sky"
      }
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
- **Response (NURSERY_LARGE / GROWOUT):**
```json
{
  "data": {
    "group": "NURSERY_LARGE",
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

**Note:** GROWOUT dashboard returns identical structure with `"group": "GROWOUT"`

**Field Descriptions:**

**Summary fields:**
- `hasData`: `true` if farmer has GPS coordinates and weather data available
- `airTemperatureC`: Current air temperature from weather API (null if no data)
- `temperatureDeltaC`: Degrees away from optimal range (negative = below 28°C, positive = above 32°C, 0 = optimal, null = no data)
- `comfortRangeC`: Optimal air temperature range { min: 28, max: 32 }
- `recommendedFeedAdjustmentPct`: Overall feed adjustment % based on current temperature
- `averageFishWeight`: Average weight per fish in kg (NURSERY_LARGE and GROWOUT only)
- `weightChange`: Weight change percentage vs previous period (NURSERY_LARGE and GROWOUT only)
- `pelletFoodCost`: Total pellet food cost in baht (NURSERY_LARGE and GROWOUT only)
- `freshFoodCost`: Total fresh food cost in baht (NURSERY_LARGE and GROWOUT only)
- `monthlyFeedingData`: Array of 12 months of feeding data in kg (NURSERY_LARGE and GROWOUT only)
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

The feeding adjustment algorithm uses **daily mean air temperature** from Open-Meteo API. Air temperature in tropical ponds is typically 5-7°C higher than water temperature.

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
## 5. Weather Proxy
### GET `/v1/weather?lat=<number>&lng=<number>`
- **Auth:** any authenticated user.
- **Query params:** both required, numeric.
- **Weather Provider:** Open-Meteo API (https://open-meteo.com)
  - Free, unlimited usage, no API key required
  - Returns `temperature_2m` (air temperature at 2m height)
  - Returns `weather_code` (WMO standard codes 0-99)
  - Includes humidity, wind speed, precipitation data
  - Timezone: Asia/Bangkok
- **Response:** `{ "data": CurrentWeather }` from `WeatherService.getCurrentWeather`
- **Response fields:**
  - `time`: ISO timestamp of weather observation
  - `temperatureC`: Air temperature in Celsius
  - `humidityPct`: Relative humidity percentage
  - `windSpeedKph`: Wind speed in km/h
  - `rainMm`: Precipitation in millimeters
  - `weatherCode`: WMO weather code (0-99) for icon display (optional)
  - `conditionText`: Human-readable condition (e.g., "Sunny", "Rain") (optional)

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
  "recommendations": "ให้ 2 ครั้งต่อวัน เช้า-เย็น\nเพิ่มส่วนผสมพรีไบโอติก\nติดตาม FCR",
  "farmType": "NURSERY_SMALL"
}
```
- **Validation:** `farmType` is optional. Values: `NURSERY_SMALL`, `NURSERY_LARGE`, `GROWOUT` (case-insensitive).
- **Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "สูตรลูกปลา 16-30 วัน",
    "targetStage": "16-30 วัน",
    "description": "อาหารเม็ดเล็ก ขนาด 0.5-1.0 มม. โปรตีน 35-40%",
    "recommendations": "ให้ 2 ครั้งต่อวัน เช้า-เย็น\nเพิ่มส่วนผสมพรีไบโอติก\nติดตาม FCR",
    "farmType": "NURSERY_SMALL",
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

### Version 1.0.3 (2025-12-02)

**🔐 Admin Authentication & Database Updates**

**Added:**
- **Admin Authentication System**:
  - `POST /auth/admin/create` - Create admin accounts with email/password
  - `POST /auth/admin/login` - Admin login endpoint (separate from LINE OAuth)
  - Admin profiles stored in `researcher_profiles` table with email field
- **Feed Formula Enhancement**:
  - `farmType` field added to feed formulas (optional)
  - Values: `NURSERY_SMALL`, `NURSERY_LARGE`, `GROWOUT`
  - Allows farm-type-specific feed recommendations

**Database:**
- Added `farm_type` column to `feed_formulas` table
- Added migration: `20251202095500_add_farm_type_to_feed_formula`

**Deployment:**
- Updated Render Start Command: `npx prisma db push && node dist/server.js`
- Ensures schema sync on deployment without shell access

**Technical:**
- Weather service continues using Open-Meteo API (free, no API key required)
- WMO weather codes (0-99) for frontend weather icon display

---

### Version 1.0.2 (2025-11-30)

**🔬 NURSERY_LARGE & GROWOUT Dashboard Update**

**Added:**
- **NURSERY_LARGE Dashboard API** - Complete implementation with extended metrics
  - `averageFishWeight`: Average weight per fish in kg (calculated from pond records)
  - `weightChange`: Weight change percentage vs previous period
  - `pelletFoodCost`: Total pellet food cost in baht
  - `freshFoodCost`: Total fresh food cost in baht
  - `monthlyFeedingData`: Array of 12 months of feeding data (Jan-Dec, rotated from current month)
- **GROWOUT Dashboard API** - Complete implementation with same extended metrics as NURSERY_LARGE
  - Identical structure and features to NURSERY_LARGE dashboard
  - Optimized for market-size fish production stage
- 7-day feeding plan with same weather integration as NURSERY_SMALL for both new farm types
- Mock data generators for fish weight and costs (with TODO comments for database integration)

**Technical:**
- Created `NurseryLargeDashboardService` with three helper functions:
  - `generateMonthlyFeedingData()`: Creates 12-month array rotated from current month
  - `calculateAverageFishWeight()`: Returns fish weight with % change
  - `calculateFoodCosts()`: Returns pellet and fresh food costs
- Created `GrowoutDashboardService` with identical structure to NURSERY_LARGE
- Integrated with existing WeatherService and FeedingCalculator
- Updated routing in `HomeService` to direct NURSERY_LARGE and GROWOUT requests to respective services

**Improved:**
- Dashboard endpoint matrix documentation updated
- Response examples added for NURSERY_LARGE and GROWOUT
- Field descriptions enhanced with farm type-specific fields

**Status:**
- NURSERY_SMALL: ✅ Complete
- NURSERY_LARGE: ✅ Complete
- GROWOUT: ✅ Complete

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
- **Open-Meteo API**: https://open-meteo.com/en/docs
- **Prisma ORM**: https://www.prisma.io/docs

### Getting Help
- **GitHub Issues**: [koard/DukeFarm-Backend/issues](https://github.com/koard/DukeFarm-Backend/issues)
- **Team Contact**: Betagro & Kasetsart University Research Team

---

**© 2025 DukeFarm. All rights reserved.**

Built with ❤️ for sustainable aquaculture in Thailand 🇹🇭
