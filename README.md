# IntervueAI - AI Interview Platform

IntervueAI is a full-stack interview platform for conducting role-based technical interviews with secure invite links, resume upload and analysis, speech features (TTS/STT), proctoring events, and post-interview reporting.

This repository contains:
- `client/`: React + Vite frontend
- `server/`: Node.js + Express + Prisma backend

## Table of Contents

1. [Core Features](#core-features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Local Setup](#local-setup)
6. [Environment Variables](#environment-variables)
7. [How the Flow Works](#how-the-flow-works)
8. [API Reference](#api-reference)
9. [Database Model Overview](#database-model-overview)
10. [Scripts](#scripts)
11. [Troubleshooting](#troubleshooting)
12. [Security Notes](#security-notes)
13. [Roadmap Ideas](#roadmap-ideas)

## Core Features

- Candidate auth (register/login)
- Candidate application page with resume PDF upload
- Resume storage and text extraction
- Role-based interview generation (`backend`, `ml`, `dsa`)
- Secure, expiring interview links for invite-based interviews
- Email invite delivery with retry for delayed sends
- Interview workspace with:
  - question progression
  - answer submission and scoring
  - speech synthesis (TTS)
  - audio transcription (STT)
- Proctoring event tracking and interview termination controls
- Interview report endpoint for final performance summary
- Local-development toggle to allow interview retakes

## Tech Stack

### Frontend (`client/`)

- React 19
- Vite 8
- ESLint

### Backend (`server/`)

- Node.js + Express
- Prisma ORM + PostgreSQL
- JWT authentication
- Multer for file uploads
- pdf-parse for resume text extraction
- Nodemailer for email invites
- Cloudinary for resume file storage
- Helmet, CORS, compression, rate limiting

### External Integrations

- PostgreSQL (local or hosted)
- SMTP provider (Gmail/SendGrid/etc.)
- Cloudinary (resume storage)
- OpenAI (evaluation fallback paths exist)
- ElevenLabs (TTS)

## Architecture

- Frontend is a hash-routed single-page app.
- Backend is a REST API under `/api/*`.
- Prisma maps app models to PostgreSQL.
- Interview links are token-based:
  - raw token is only sent to the candidate
  - hashed token is stored in DB
  - token has expiry and completion status checks

## Project Structure

```text
AI-interview-platform/
  client/
    src/
      components/
        apply/
        auth/
        interview/
        landing/
      services/
    package.json
  server/
    controllers/
    middleware/
    prisma/
      schema.prisma
    routes/
    services/
    utils/
    app.js
    package.json
  README.md
```

## Local Setup

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm
- PostgreSQL database

### 1. Clone and install

```bash
git clone https://github.com/Vedant-Dakare/AI-interview-platform.git
cd AI-interview-platform

cd client && npm install
cd ../server && npm install
```

### 2. Configure environment files

Create these files:
- `client/.env`
- `server/.env`

Use values from:
- `server/.env.example`

Set client API base for local backend:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
```

### 3. Prepare database

From `server/`:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

### 4. Run both apps

Terminal 1:

```bash
cd server
npm run dev
```

Terminal 2:

```bash
cd client
npm run dev
```

Open the frontend URL printed by Vite (usually `http://localhost:5173`).

## Environment Variables

### Client

`client/.env`

- `VITE_API_BASE_URL`: backend base URL (local: `http://localhost:5000`)

### Server

`server/.env`

#### Core

- `PORT` (default `5000`)
- `NODE_ENV` (`development` or `production`)
- `DATABASE_URL` (Prisma connection)
- `DIRECT_URL` (optional direct DB URL for migrations)
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (for example `7d`)
- `CORS_ORIGIN` (for example `http://localhost:5173`)
- `AUTH_RATE_LIMIT_MAX`
- `ALLOW_INTERVIEW_RETAKE` (`true/false`)

#### Interview Links and Email

- `INTERVIEW_ADMIN_API_KEY`
- `PUBLIC_APP_URL` (used to build interview URLs)
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER` (optional for no-auth local SMTP)
- `SMTP_PASS` (optional for no-auth local SMTP)
- `SMTP_SECURE` (`true/false`)
- `SMTP_IGNORE_TLS` (`true/false`)
- `SMTP_CONNECTION_TIMEOUT_MS`
- `SMTP_GREETING_TIMEOUT_MS`
- `SMTP_SOCKET_TIMEOUT_MS`
- `SMTP_SEND_TIMEOUT_MS`
- `INVITE_EMAIL_RETRY_INTERVAL_MS`
- `INVITE_EMAIL_RETRY_BATCH_SIZE`

#### Resume Storage

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_RESUME_FOLDER`

#### Voice / AI

- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_STABILITY`
- `ELEVENLABS_SIMILARITY_BOOST`
- `ELEVENLABS_STYLE`
- `ELEVENLABS_SPEAKER_BOOST`
- `ELEVENLABS_OUTPUT_FORMAT`

## How the Flow Works

### Standard Candidate Flow

1. Candidate applies from `/apply` with name, email, role, and PDF resume.
2. Backend stores candidate + resume and creates an interview invite.
3. If SMTP succeeds, invite email is sent.
4. If SMTP fails, frontend shows a secure fallback interview link immediately.
5. Candidate logs in, opens interview link, token is validated, and interview starts.
6. Candidate answers questions, submits, and ends interview.
7. Report endpoint returns summary and scoring details.

### Admin/Invite Flow

1. Internal admin creates secure invite via API key endpoint.
2. Invite token is hashed in DB.
3. Candidate gets link by email.
4. Retry worker periodically attempts unsent pending emails.

## API Reference

Base URL (local): `http://localhost:5000`

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Candidate Application

- `POST /api/apply`
  - multipart/form-data: `fullName`, `email`, `role`, `resume`

### Resume

- `POST /api/resume/upload` (auth required)

### Interview

- `GET /api/interview/questions` (auth required)
- `POST /api/interview/start` (auth required)
- `GET /api/interview/:id` (auth required)
- `POST /api/interview/:id/answer` (auth required)
- `POST /api/interview/:id/next` (auth required)
- `POST /api/interview/:id/end` (auth required)
- `POST /api/interview/answer` (auth required, payload-style)
- `POST /api/interview/end` (auth required, payload-style)
- `GET /api/interview/report` (auth required)
- `POST /api/interview/tts` (auth required)
- `POST /api/interview/transcribe` (auth required)

### Interview Links

- `POST /api/interview-links` (admin API key required)
- `POST /api/interview-links/:candidateId/send-email` (admin API key required)
- `GET /api/interview-links/validate/:token` (auth required)
- `POST /api/interview-links/start/:token` (auth required)
- `POST /api/interview-links/complete/:token` (auth required)

### Proctoring

- `POST /api/proctor/proctor-event` (auth required)
- `POST /api/proctor/terminate` (auth required)
- `GET /api/proctor/events/:interviewId` (auth required)

## Database Model Overview

Main models in Prisma schema:
- `User`
- `Resume`
- `Interview`
- `Question`
- `Answer`
- `RoleQuestion`
- `Candidate`
- `InterviewInvite`
- `ProctoredEvent`

Key relations:
- A user has many interviews and resumes.
- An interview has many questions and answers.
- A candidate can have interview invites.
- Interview invites store secure token hash + expiry + status.

## Scripts

### Client (`client/package.json`)

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

### Server (`server/package.json`)

- `npm run dev`
- `npm start`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:studio`

## Troubleshooting

### Port already in use (`EADDRINUSE`)

If `5000` or `5173` is occupied, stop stale Node processes and restart.

Linux quick check:

```bash
ss -ltnp | grep -E ':5000|:5173'
```

### Cannot start interview (already completed)

For local testing, set:

```dotenv
ALLOW_INTERVIEW_RETAKE=true
```

### Email not delivered

- Verify SMTP host/port/credentials
- Check `SMTP_SECURE` and `SMTP_IGNORE_TLS`
- Confirm invite fallback link appears on apply success when SMTP is delayed

### Resume upload fails

- Ensure file is PDF
- Check Cloudinary credentials
- Verify `MAX_FILE_SIZE_MB`

### CORS errors

- Make sure `CORS_ORIGIN` includes your frontend origin
- Example: `http://localhost:5173`

## Security Notes

- Never commit real secrets to git.
- Rotate any credentials that were ever exposed.
- Use separate credentials for dev/staging/prod.
- Restrict `INTERVIEW_ADMIN_API_KEY` to trusted internal callers only.
- In production, set:
  - `NODE_ENV=production`
  - `ALLOW_INTERVIEW_RETAKE=false`

## Roadmap Ideas

- Add Docker Compose for one-command local startup
- Add end-to-end tests for interview flows
- Add role/question authoring dashboard
- Improve analytics and interviewer review UI
- Add CI pipeline with lint + test + Prisma checks

---

If you are opening this repository for the first time, start with:
1. [Local Setup](#local-setup)
2. [Environment Variables](#environment-variables)
3. [How the Flow Works](#how-the-flow-works)
