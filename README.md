# 🐟 DukeFarm Backend API

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.19-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791.svg)](https://www.postgresql.org/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

DukeFarm Backend provides a comprehensive RESTful API for managing catfish farming operations across three production phases: **Fingerling**, **Fattening**, and **Market** (formerly Nursery Small, Nursery Large, and Growout). The platform integrates real-time weather data, intelligent feeding recommendations, farmer management, and research survey capabilities.

### Key Capabilities

- **🔐 Authentication**: LINE Login OAuth 2.0 integration with role-based access control (RBAC)
- **📊 Dashboard**: Real-time farm group overview with weather-based feeding recommendations
- **🌤️ Weather Intelligence**: Air temperature monitoring via Google Maps Weather API
- **👨‍🌾 Farmer Management**: Registration, profile management, and farm tracking
- **🔬 Researcher Portal**: Survey management and data collection for agricultural research
- **🍽️ Feed Formula Management**: CRUD operations for feeding formulas with stage-based recommendations
- **📈 Smart Analytics**: Temperature-based feeding adjustments with percentage-based recommendations
- **🏥 Disease Intelligence**: AI-powered disease diagnosis with 9 pre-configured diseases and symptom-based search
- **📅 Dynamic Age Tracking**: Automatic fish age calculation based on stocking date and elapsed time

## ✨ Features

### Authentication & Authorization
- LINE Login OAuth 2.0 social authentication
- JWT-based session management (no expiration)
- Role-based access control: `ADMIN`, `FARMER`, `RESEARCHER`
- Dynamic role assignment with pre-selection support

### Farm Management
- Multi-farm type support: `SMALL` (Fingerling/Pla Tum), `LARGE` (Pla Nio), `MARKET`
- GPS-based farm location tracking
- Pond inventory management
- Production cycle tracking

### Weather & Feeding Intelligence
- Real-time weather data from Google Maps Weather API (requires API key with billing enabled)
- Air temperature monitoring (optimal range: 28-35°C)
- 7-day weather forecast with feeding plan generation
- Percentage-based feeding adjustments (-90% to 0%)
- Temperature-to-feeding logic based on agricultural research
- WMO weather codes (0-99) for weather icon display in frontend

### Research & Data Collection
- Research survey creation and management
- Farmer survey data collection (farm data, feeding data, water quality)
- Researcher profile management
- Survey listing with pagination
- Detailed survey reports

### Disease Intelligence & Diagnosis
- **AI-Powered Disease Analyzer**: Intelligent symptom-based disease diagnosis system
- Comprehensive disease database with 9 common catfish diseases
- Multi-symptom search with fuzzy matching (supports Thai language)
- Category filtering: bacteria, parasites, fungi, nutrition, environment
- Detailed disease information: symptoms, causes, treatment, prevention
- Treatment summaries and actionable recommendations
- Tag-based symptom search for quick diagnosis
- Database seeding with pre-configured disease data

### Admin Panel
- Farmer list with registration status
- Researcher management
- Feed formula CRUD operations
- Disease database management
- System health monitoring

## 🏗️ Architecture

```
┌─────────────────┐
│   LINE Login    │  OAuth 2.0 Provider
└────────┬────────┘
         │
    ┌────▼─────────────────────────────┐
    │     Express 5 REST API           │
    │  ┌───────────────────────────┐   │
    │  │   Routes (Entry Points)   │   │
    │  └─────────┬─────────────────┘   │
    │  ┌─────────▼─────────────────┐   │
    │  │  Controllers (Handlers)   │   │
    │  └─────────┬─────────────────┘   │
    │  ┌─────────▼─────────────────┐   │
    │  │  Services (Business Logic)│   │
    │  └─────────┬─────────────────┘   │
    │  ┌─────────▼─────────────────┐   │
    │  │ Repositories (Data Access)│   │
    │  └─────────┬─────────────────┘   │
    └────────────┼───────────────────────┘
                 │
         ┌───────▼────────┐
         │ Prisma ORM     │
         └───────┬────────┘
                 │
         ┌───────▼────────┐
         │  PostgreSQL    │
         │   Database     │
         └────────────────┘ 
```

### Layered Architecture

**Routes → Controllers → Services → Repositories → Database**

- **Routes**: Express router definitions, parameter validation
- **Controllers**: Request/response handling, input validation
- **Services**: Business logic, data orchestration, external API integration
- **Repositories**: Direct database queries via Prisma ORM
- **Middlewares**: Authentication, authorization, error handling

## 🛠️ Tech Stack

### Backend Framework
- **Node.js** 22+ - JavaScript runtime
- **TypeScript** 5.9 - Type-safe development
- **Express** 5.1 - Web application framework

### Database & ORM
- **PostgreSQL** 14+ - Relational database (production: Render managed instance)
- **Prisma** 5.19 - Next-generation TypeScript ORM

### Authentication
- **LINE Login OAuth** - Social authentication provider
- **JWT** (jsonwebtoken) - Stateless session management

### External APIs
- **Google Maps Weather API** - High-fidelity weather forecasts (API key required)

### DevOps & Utilities
- **ts-node-dev** - Development server with hot reload
- **dotenv** - Environment variable management
- **axios** - HTTP client for external APIs
- **bcrypt** - Password hashing (future use)
- **cors** - Cross-origin resource sharing

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 22 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 14 or higher ([Download](https://www.postgresql.org/download/) or use Docker)
- **LINE Developers Account** ([Create channel](https://developers.line.biz/console/))
- **Git** (optional, for version control)

## 🚀 Installation

### 1. Clone the Repository

```powershell
git clone https://github.com/koard/DukeFarm-Backend.git
cd DukeFarm-Backend
```

### 2. Install Dependencies

```powershell
npm install
```

### 3. Database Setup

#### Option A: Using Existing PostgreSQL Instance

If you already have PostgreSQL installed and running locally:

```powershell
# Connect to PostgreSQL and create database
psql -U postgres
CREATE DATABASE dukefarm;
\q
```

#### Option B: Using Docker (Recommended for Development)

```powershell
# Pull PostgreSQL 14 image and run container
docker run --name dukefarm-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=dukefarm `
  -p 5432:5432 `
  -v ${PWD}/postgres-data:/var/lib/postgresql/data `
  -d postgres:14

# Verify container is running
docker ps | Select-String "dukefarm-postgres"
```

**Docker container management:**
```powershell
# Stop container
docker stop dukefarm-postgres

# Start existing container
docker start dukefarm-postgres

# Remove container (data persists in postgres-data folder)
docker rm -f dukefarm-postgres
```

### 4. Environment Configuration

Create `.env` file in project root:

```powershell
# Copy example environment file
copy .env.example .env

# Edit .env with your configuration
notepad .env
```

**Required environment variables:**

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dukefarm?schema=public"

# JWT Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET="your-secure-random-secret-key-here"

# LINE Login Credentials (from LINE Developers Console)
LINE_CHANNEL_ID="your-line-channel-id"
LINE_CHANNEL_SECRET="your-line-channel-secret"
LINE_REDIRECT_URI="http://localhost:4000/api/auth/line/callback"

# Google Maps Weather API (https://developers.google.com/maps/documentation/weather)
# Enable the Weather API in Google Cloud Console and create an API key with HTTP referrer/IP restrictions.
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"

# Frontend Callback (where to redirect after login)
FRONTEND_CALLBACK_URL="http://localhost:3000/auth/callback"

# Server Configuration (optional)
PORT=4000
NODE_ENV=development
```

### 5. Database Migration

```powershell
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with disease data (required for Disease Analyzer)
npm run prisma:seed

# Verify database schema
npx prisma studio  # Opens GUI at http://localhost:5555
```

## ⚙️ Configuration

### LINE Login Setup

1. **Create LINE Login Channel**
   - Visit [LINE Developers Console](https://developers.line.biz/console/)
   - Create new channel → LINE Login
   - Note down **Channel ID** and **Channel Secret**

2. **Configure Callback URL**
   - In LINE Console → LINE Login tab
   - Set **Callback URL**: `http://localhost:4000/api/auth/line/callback`
   - For production: `https://your-domain.com/api/auth/line/callback`

3. **Update Environment Variables**
   ```env
   LINE_CHANNEL_ID="1234567890"
   LINE_CHANNEL_SECRET="abc123def456"
   LINE_REDIRECT_URI="http://localhost:4000/api/auth/line/callback"
   ```

### ngrok Setup (Development with LINE Login)

For testing LINE Login on localhost, expose your server via ngrok:

1. **Install ngrok** ([Download](https://ngrok.com/download))
   ```powershell
   # Windows: Download and extract ngrok.exe to PATH
   ```

2. **Start backend server**
   ```powershell
   npm run dev
   ```

3. **Expose server via ngrok**
   ```powershell
   ngrok http 4000
   ```

4. **Update LINE Console & .env**
   - Copy ngrok HTTPS URL (e.g., `https://abc123.ngrok-free.app`)
   - Update LINE Console callback URL: `https://abc123.ngrok-free.app/api/auth/line/callback`
   - Update `.env`:
     ```env
     LINE_REDIRECT_URI="https://abc123.ngrok-free.app/api/auth/line/callback"
     ```
   - Restart server: `npm run dev`

5. **Test Authentication**
   ```powershell
   # Get LINE login URL
   curl http://localhost:4000/api/auth/line/login

   # Open URL in browser → Complete LINE login → Redirected to frontend with token
   ```

### Generating JWT Secret

```powershell
# Generate secure 256-bit random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🧪 Development

### Start Development Server

```powershell
# Start with hot reload
npm run dev

# Server runs on http://localhost:4000
```

The development server uses `ts-node-dev` for automatic TypeScript compilation and hot reload on file changes.

### Build for Production

```powershell
# Type-check and compile TypeScript to JavaScript
npm run build

# Output directory: dist/
```

### Run Production Build

```powershell
# Start compiled server
npm start

# Runs: node dist/server.js
```

## 📚 API Documentation

Full API documentation is available in [`api-specs.md`](./api-specs.md).

### Quick Reference

**Base URL:** `http://localhost:4000/api`

#### Health & Status
- `GET /healthz` - Simple health check
- `GET /v1/health` - Detailed health with DB status

#### Authentication
- `GET /auth/line/login?role=farmer` - Get LINE OAuth URL
- `GET /auth/line/callback` - LINE OAuth callback
- `GET /auth/me` - Get current user profile
- `POST /auth/admin/create` - Create admin account
- `POST /auth/admin/login` - Admin login

#### Registration
- `POST /register/role` - Select user role
- `POST /register/farmer` - Complete farmer registration
- `POST /register/researcher` - Complete researcher registration

#### Dashboard
- `GET /dashboard/groups/:groupType` - Farm group overview with weather & feeding plan

#### Weather
- `GET /v1/weather?lat=13.7563&lng=100.5018` - Get current weather by coordinates

#### Farmers (Admin/Researcher)
- `GET /farmers?page=1&limit=10` - List all farmers

#### Feed Formulas
- `GET /feed-formulas` - List feed formulas
- `POST /feed-formulas` - Create feed formula (Admin)
- `PUT /feed-formulas/:id` - Update feed formula (Admin)
- `DELETE /feed-formulas/:id` - Delete feed formula (Admin)

#### Researchers & Surveys (Admin/Researcher)
- `GET /researchers` - List all researchers
- `GET /researchers/:id/surveys` - List surveys by researcher
- `GET /researchers/surveys/:surveyId` - Get survey details

### Testing API Endpoints

#### Using cURL (PowerShell)

```powershell
# Health check (no authentication)
curl http://localhost:4000/api/v1/health

# Get LINE login URL
curl http://localhost:4000/api/auth/line/login

# Get current user (requires token)
curl http://localhost:4000/api/auth/me `
  -H "Authorization: Bearer eyJhbGc..."

# Get dashboard for small-stage farms
curl http://localhost:4000/api/dashboard/groups/SMALL `
  -H "Authorization: Bearer eyJhbGc..."

# Register as farmer
curl http://localhost:4000/api/register/farmer `
  -X POST `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer eyJhbGc..." `
   -d '{
      \"firstName\": \"Somchai\",
      \"lastName\": \"Prasert\",
      \"phone\": \"0812345678\",
    \"primaryFarmType\": \"SMALL\",
      \"declaredPondCount\": 4,
      \"farmLatitude\": 13.7563,
      \"farmLongitude\": 100.5018
   }'
```

#### Using VS Code REST Client

Install [REST Client extension](https://marketplace.visualstudio.com/items?itemName=humao.rest-client), then create `test.http`:

```http
### Health Check
GET http://localhost:4000/api/v1/health

### Get LINE Login URL
GET http://localhost:4000/api/auth/line/login?role=farmer

### Get Current User
GET http://localhost:4000/api/auth/me
Authorization: Bearer {{token}}

### Get Dashboard
GET http://localhost:4000/api/dashboard/groups/SMALL
Authorization: Bearer {{token}}
```

## 🚢 Deployment

### Deploy to Render

1. **Create PostgreSQL Database**
   - Visit [Render Dashboard](https://dashboard.render.com/)
   - New → PostgreSQL
   - Select region: Singapore
   - Note down **Internal Database URL**

2. **Create Web Service**
   - New → Web Service
   - Connect GitHub repository
   - Configure build settings:
     - **Build Command**: `npm install && npm run prisma:generate && npm run build`
     - **Start Command**: `npm start`
     - **Environment**: Node

3. **Set Environment Variables**
   ```
   DATABASE_URL=<internal-database-url-from-render>
   JWT_SECRET=<your-generated-secret>
   LINE_CHANNEL_ID=<your-line-channel-id>
   LINE_CHANNEL_SECRET=<your-line-channel-secret>
   LINE_REDIRECT_URI=https://your-app.onrender.com/api/auth/line/callback
   GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>
   FRONTEND_CALLBACK_URL=https://your-frontend.com/auth/callback
   NODE_ENV=production
   ```

   **Important:** For Render free tier (no shell access), update Start Command to:
   ```
   npx prisma db push && node dist/server.js
   ```
   This ensures database schema is synced on every deployment without manual migration.

4. **Run Database Migrations**
   ```powershell
   # From Render Shell or locally with production DATABASE_URL
   npx prisma migrate deploy
   ```

5. **Update LINE Console**
   - Add production callback URL: `https://your-app.onrender.com/api/auth/line/callback`

### Deploy to Other Platforms

The application is compatible with any Node.js hosting provider:

- **Heroku**: Use `Procfile` with `web: npm start`
- **Railway**: Auto-detects Node.js and runs `npm start`
- **DigitalOcean App Platform**: Configure build/start commands in dashboard
- **AWS Elastic Beanstalk**: Package and deploy as Node.js application
- **Google Cloud Run**: Containerize with Dockerfile and deploy

### Docker Deployment

```dockerfile
# Dockerfile (example)
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
```

```powershell
# Build and run
docker build -t dukefarm-backend .
docker run -p 4000:4000 --env-file .env dukefarm-backend
```

## 📁 Project Structure

```
DukeFarm-Backend/
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Database migrations
├── src/
│   ├── app.ts                     # Express app configuration
│   ├── server.ts                  # Server entry point
│   ├── clients/
│   │   └── prisma.ts              # Prisma client singleton
│   ├── config/
│   │   └── env.ts                 # Environment validation
│   ├── controllers/               # Request handlers
│   │   ├── farmer.controller.ts
│   │   ├── feed-formula.controller.ts
│   │   ├── health.controller.ts
│   │   ├── home.controller.ts
│   │   ├── lineAuth.controller.ts
│   │   ├── onboarding.controller.ts
│   │   ├── researcher.controller.ts
│   │   └── weather.controller.ts
│   ├── middlewares/               # Express middlewares
│   │   ├── auth.middleware.ts     # JWT verification
│   │   ├── role.middleware.ts     # Role-based access
│   │   └── errorHandler.ts        # Global error handler
│   ├── routes/                    # API routes
│   │   ├── index.ts               # Router aggregation
│   │   ├── auth.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── farmer.routes.ts
│   │   ├── feed-formula.routes.ts
│   │   ├── home.routes.ts
│   │   ├── register.routes.ts
│   │   ├── researcher.routes.ts
│   │   └── v1/
│   │       ├── index.ts
│   │       ├── farm.routes.ts
│   │       ├── health.routes.ts
│   │       └── weather.routes.ts
│   ├── services/                  # Business logic
│   │   ├── access.service.ts
│   │   ├── farmer.service.ts
│   │   ├── feed-formula.service.ts
│   │   ├── feeding-calculator.service.ts
│   │   ├── health.service.ts
│   │   ├── home.service.ts
│   │   ├── lineAuth.service.ts
│   │   ├── nursery-small-dashboard.service.ts
│   │   ├── onboarding.service.ts
│   │   ├── researcher.service.ts
│   │   └── weather.service.ts
│   ├── types/                     # TypeScript types
│   │   ├── farm.ts
│   │   └── pond.ts
│   └── utils/                     # Utility functions
│       ├── httpError.ts
│       ├── jwt.ts
│       ├── lineApi.ts
│       ├── logger.ts
│       └── number.ts
├── dist/                          # Compiled JavaScript (gitignored)
├── node_modules/                  # Dependencies (gitignored)
├── .env                           # Environment variables (gitignored)
├── .env.example                   # Environment template
├── package.json                   # NPM dependencies & scripts
├── tsconfig.json                  # TypeScript configuration
├── api-specs.md                   # API documentation
└── README.md                      # This file
```

## 📜 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript (`dist/`) |
| `npm start` | Run production server from compiled code |
| `npm run lint` | Type-check without emitting files |
| `npm run prisma:generate` | Regenerate Prisma Client from schema |
| `npm run prisma:migrate` | Create and apply new migration |
| `npm run prisma:seed` | Seed database with disease data |
| `npm test` | Run test suite (placeholder) |

## 🔐 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for Prisma ORM | `postgresql://user:pass@localhost:5432/dukefarm?schema=public` |
| `JWT_SECRET` | Secret key for JWT token signing/verification | `a1b2c3d4e5f6...` (64-char hex) |
| `LINE_CHANNEL_ID` | LINE Login channel ID from Developers Console | `1234567890` |
| `LINE_CHANNEL_SECRET` | LINE Login channel secret | `abc123def456...` |
| `LINE_REDIRECT_URI` | OAuth callback URL (must match LINE Console) | `https://api.example.com/api/auth/line/callback` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key for Weather API requests | `AIzaSy...` |
| `FRONTEND_CALLBACK_URL` | Frontend redirect URL after authentication | `https://app.example.com/auth/callback` |

### Optional Variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP server port | `4000` |
| `NODE_ENV` | Environment mode | `development` |

### External Services

**Google Maps Weather API**: Enterprise-grade weather service from Google Maps Platform.
- Documentation: https://developers.google.com/maps/documentation/weather
- Timezone: `Asia/Bangkok`
- Data: Current conditions, 24-hour hourly forecast, 7-day daily forecast, WMO-compatible condition codes
- Requirements: Enable Weather API in Google Cloud Console, create an API key, and enable billing
- Weather codes are mapped from Google condition codes to WMO (0-99) for frontend icon reuse

## ✅ First Run Checklist

Before running the application for the first time:

- [ ] **PostgreSQL database** is running (local or Docker)
- [ ] **LINE Login channel** created in [LINE Developers Console](https://developers.line.biz/console/)
- [ ] **Environment variables** configured in `.env` file
- [ ] **Dependencies** installed via `npm install`
- [ ] **Prisma Client** generated via `npm run prisma:generate`
- [ ] **Database migrations** applied via `npm run prisma:migrate`
- [ ] **Disease database** seeded via `npm run prisma:seed`
- [ ] **JWT secret** generated (32+ random bytes)
- [ ] **LINE callback URL** matches between `.env` and LINE Console
- [ ] **Health check** passes: `GET http://localhost:4000/api/v1/health`

### Quick Start Commands

```powershell
# Complete setup in one go
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev

# Verify server is running
curl http://localhost:4000/api/v1/health
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow TypeScript best practices** and maintain type safety
3. **Write descriptive commit messages** (Conventional Commits format)
4. **Update documentation** for API changes (README.md & api-specs.md)
5. **Test thoroughly** before submitting pull request
6. **Run lint check**: `npm run lint` (must pass)

### Code Style

- Use TypeScript strict mode
- Follow existing project structure and naming conventions
- Prefer async/await over promises
- Use Prisma ORM for all database operations
- Handle errors with try-catch and throw HttpError
- Add JSDoc comments for complex functions

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
- `feat(auth): add role pre-selection in LINE login`
- `fix(weather): fallback when Google Weather API throttles`
- `docs(api): update dashboard endpoint specifications`

## 📄 License

This project is proprietary software developed for **Betagro & Kasetsart University**.

**© 2025 DukeFarm. All rights reserved.**

## 📞 Support

For questions, issues, or feature requests:

- **GitHub Issues**: [koard/DukeFarm-Backend/issues](https://github.com/koard/DukeFarm-Backend/issues)
- **Documentation**: [`api-specs.md`](./api-specs.md)
- **Project Team**: Betagro & Kasetsart University Research Collaboration

---

**Built with ❤️ for sustainable aquaculture in Thailand**
