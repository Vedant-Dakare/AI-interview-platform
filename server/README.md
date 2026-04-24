# IntervueAI Backend

Production-oriented Node.js backend for interview workflows.

## Stack

- Node.js + Express
- PostgreSQL + Prisma ORM
- JWT auth
- Multer for PDF upload
- pdf-parse for resume text extraction
- Cloudinary for resume storage
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
- `ALLOW_INTERVIEW_RETAKE` allow users to start a new interview even after a completed one (`true`/`false`, defaults to `true` in non-production and `false` in production)
- `INTERVIEW_ADMIN_API_KEY` internal secret for creating and emailing interview links
- `PUBLIC_APP_URL` base URL used to build interview links in emails
- `MAIL_FROM` sender email for interview invites
- `SMTP_HOST` SMTP host for outbound mail
- `SMTP_PORT` SMTP port (587 or 465)
- `SMTP_USER` SMTP account username (optional for no-auth local SMTP)
- `SMTP_PASS` SMTP account password (optional for no-auth local SMTP)
- `SMTP_SECURE` force SMTPS mode (`true`/`false`, default auto: `true` for 465)
- `SMTP_IGNORE_TLS` disable STARTTLS negotiation for providers that require plain SMTP (`true`/`false`, default `false`)
- `SMTP_CONNECTION_TIMEOUT_MS` SMTP connect timeout in milliseconds (optional, default `10000`)
- `SMTP_GREETING_TIMEOUT_MS` SMTP greeting timeout in milliseconds (optional, default `10000`)
- `SMTP_SOCKET_TIMEOUT_MS` SMTP socket timeout in milliseconds (optional, default `15000`)
- `SMTP_SEND_TIMEOUT_MS` max sendMail wait time in milliseconds (optional, default `15000`)
- `INVITE_EMAIL_RETRY_INTERVAL_MS` interval for retrying unsent invite emails in milliseconds (optional, default `300000`)
- `INVITE_EMAIL_RETRY_BATCH_SIZE` max pending invites processed per retry run (optional, default `25`)
- `CLOUDINARY_CLOUD_NAME` Cloudinary cloud name (required)
- `CLOUDINARY_API_KEY` Cloudinary API key (required)
- `CLOUDINARY_API_SECRET` Cloudinary API secret (required)
- `CLOUDINARY_RESUME_FOLDER` folder for uploaded resumes (optional, default `intervueai/resumes`)

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

### Candidate Application

- `POST /api/apply`
  - form-data:
    - `fullName` (required)
    - `email` (required)
    - `role` (`backend | ml | dsa`)
    - `resume` (required PDF)
  - creates candidate application, generates secure 24h interview token, stores invite, and sends interview link email

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
- Resume PDFs are stored in Cloudinary (raw uploads).
- APIs are organized with MVC plus Prisma data layer.
- Interview data is normalized into `Interview`, `Question`, and `Answer` tables.
