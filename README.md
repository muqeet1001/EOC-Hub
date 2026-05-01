# EOC Hub

Admin-only circular distribution app for Equal Opportunity Cell communication.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB
- File storage: local uploads by default, Cloudinary when configured
- Email: SMTP through Nodemailer

## Current Flow

- No login or user authentication screen
- Admin opens the dashboard directly
- Admin selects a cell
- Admin uploads a circular PDF and writes the email message
- The backend saves the circular and sends it to every email address for that cell
- Sent circulars show member-by-member delivery status

## Environment

Create `server/.env` from `server/.env.example` and set:

- `MONGODB_URI`
- `PUBLIC_APP_URL` (defaults to `http://localhost:4000`)
- Optional Cloudinary values for hosted PDF storage
- SMTP values for real email delivery:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM`

If SMTP is not configured, circulars are still saved and delivery rows are marked as `not_configured`.

## Run

```bash
npm install
npm run install:all
npm run dev
```

Frontend:

- `http://localhost:5173`

Backend:

- `http://localhost:4000`
