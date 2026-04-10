# IntervueAI Backend

Production-oriented Node.js backend for interview workflows.

## Stack

- Node.js + Express
- PostgreSQL + Prisma ORM
- JWT auth
- Multer for PDF upload
- pdf-parse for resume text extraction
- dotenv
- ESM modules (`import`/`export`)
- Helmet + CORS + Compression + Rate limiting

## Project Structure

backend/
├── controllers/
│   ├── authController.js
│   ├── resumeController.js
│   ├── interviewController.js
├── prisma/
│   ├── schema.prisma
│   ├── client.js
├── routes/
│   ├── authRoutes.js
│   ├── resumeRoutes.js
│   ├── interviewRoutes.js
├── middleware/
│   ├── authMiddleware.js
│   ├── asyncHandler.js
│   ├── errorMiddleware.js
├── utils/
│   ├── fileUpload.js
├── uploads/
│   └── resumes/
├── .env.example
├── app.js
└── package.json

## Setup

1. Open terminal in `server` directory.
2. Install dependencies:
  npm install
3. Initialize Prisma (if not already initialized in this repo):
  npx prisma init
4. Create `.env` from `.env.example` and set `DATABASE_URL`.
5. Generate Prisma client:
  npx prisma generate
6. Run database migration:
  npx prisma migrate dev --name init
7. Start in development:
  npm run dev
8. Start in production mode:
  npm start

## Environment Variables

- `PORT` server port (default 5000)
- `NODE_ENV` development or production
- `DATABASE_URL` PostgreSQL connection string
- `JWT_SECRET` secret key for signing JWT
- `JWT_EXPIRES_IN` token expiry, e.g. 7d
- `MAX_FILE_SIZE_MB` max resume PDF size
- `CORS_ORIGIN` comma-separated allowed origins (example: `http://localhost:5173`)
- `AUTH_RATE_LIMIT_MAX` max auth requests per 15 minutes per IP
- `INTERVIEW_ADMIN_API_KEY` internal secret for creating and emailing interview links
- `PUBLIC_APP_URL` base URL used to build interview links in emails
- `MAIL_FROM` sender email for interview invites
- `SMTP_HOST` SMTP host for outbound mail
- `SMTP_PORT` SMTP port (587 or 465)
- `SMTP_USER` SMTP account username
- `SMTP_PASS` SMTP account password

## API Endpoints

### Health

- `GET /api/health`

### Authentication

- `POST /api/auth/register`
  - body: `{ "name": "...", "email": "...", "password": "..." }`
- `POST /api/auth/login`
  - body: `{ "email": "...", "password": "..." }`

### Resume

- `POST /api/resume/upload`
  - auth: Bearer token required
  - form-data: `resume` (PDF)
  - extracts text and stores metadata

### Interview

- `POST /api/interview/start`
  - auth: Bearer token required
  - body: `{ "role": "Backend Engineer" }`
- `GET /api/interview/:id`
  - auth: Bearer token required
- `POST /api/interview/:id/answer`
  - auth: Bearer token required
  - body: `{ "answer": "..." }`
- `POST /api/interview/:id/next`
  - auth: Bearer token required
- `POST /api/interview/:id/end`
  - auth: Bearer token required

### Secure Interview Links

- `POST /api/interview-links`
  - headers: `x-admin-api-key: <INTERVIEW_ADMIN_API_KEY>`
  - body: `{ "email": "candidate@company.com", "role": "backend|ml|dsa", "resumeInsights": "...", "sendEmail": true }`
  - generates secure token, stores hash, and sets 24h expiry

- `POST /api/interview-links/:candidateId/send-email`
  - headers: `x-admin-api-key: <INTERVIEW_ADMIN_API_KEY>`
  - rotates token and emails a new link

- `GET /api/interview-links/validate/:token`
  - auth: Bearer token required
  - verifies token exists, is not expired, and interview is not completed

- `POST /api/interview-links/start/:token`
  - auth: Bearer token required
  - returns candidate-specific context such as role, resume insights, and question plan

- `POST /api/interview-links/complete/:token`
  - auth: Bearer token required
  - marks interview as completed and blocks token reuse

## Notes

- Interview questions are currently fixed dummy questions in `interviewController.js`.
- Answers are stored as-is with no AI or automatic scoring.
- Uploaded files are exposed via `/uploads` static route.
- APIs are organized with MVC plus Prisma data layer.
- Interview data is normalized into `Interview`, `Question`, and `Answer` tables.
