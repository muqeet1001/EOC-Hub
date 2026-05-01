# EOC Hub

Admin-only circular distribution app for Equal Opportunity Cell communication.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB
- Email: SMTP through Nodemailer with direct PDF attachments

## Current Flow

- No authentication required - app works directly
- Admin opens the dashboard directly (no login)
- Admin selects a cell
- Admin uploads a circular PDF and writes the email message
- The backend sends the circular PDF as a direct email attachment to every member in the selected cell
- Sent circulars show member-by-member delivery status

## Environment

Create `server/.env` from `server/.env.example` and set:

- `MONGODB_URI`
- `ENABLE_MEMORY_FALLBACK`
- `ENABLE_DEMO_SEED_DATA`
- `PORT`
- `PUBLIC_APP_URL`
- `MAX_ATTACHMENT_SIZE_MB`
- SMTP values for real email delivery:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`
- Optional local testing controls:
  - `EMAIL_TEST_MODE`
  - `EMAIL_TEST_RECIPIENT`

Create `client/.env` from `client/.env.example` if you want to override the frontend dev port or proxy target:

- `VITE_PORT`
- `VITE_API_BASE`
- `VITE_PROXY_TARGET`

If SMTP is not configured, circulars are still saved and delivery rows are marked as `not_configured`.
Uploaded PDFs are not stored on disk or in Cloudinary. They are attached directly to outgoing emails and only attachment metadata is retained in the circular history.

Production recommendation:

- `ENABLE_MEMORY_FALLBACK=false`
- `ENABLE_DEMO_SEED_DATA=false`

That makes the app use only real MongoDB users for each selected cell. Demo users are used only when you explicitly enable local demo mode.

## Run

```bash
npm install
npm run install:all
npm run dev
```

Frontend:

- `http://localhost:5173` by default, or `VITE_PORT` from `client/.env`

Backend:

- `PUBLIC_APP_URL` from `server/.env`
