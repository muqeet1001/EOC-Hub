# EOC Hub

Role-based web app for circulars, meetings, notifications, and AI-generated meeting summaries.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB
- File storage: Cloudinary
- Auth: JWT

## Roles

- Admin (Chairman)
- Cell Head
- Cell Member

## Demo Login

- Admin: `admin@eochub.test` / `admin123`
- Cell Head: `head.obc@eochub.test` / `head123`
- Cell Member: `member.obc@eochub.test` / `member123`

## Environment

Create `server/.env` from `server/.env.example` and set:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER` (optional)

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

## Included Flows

- JWT login with role detection
- Role-based dashboard
- Admin circular creation with optional PDF upload
- Cell-filtered notifications
- Cell Head meeting scheduling
- Member circular viewing and meeting joining
- AI-style meeting summary generation
- Minutes/report visibility for Admin and Cell Head

## Notes

- Users, cells, circulars, meetings, reports, and notifications are now intended to persist in MongoDB.
- PDF circular uploads use Cloudinary when Cloudinary credentials are configured.
- The AI summary service is mocked so the full product flow can be demonstrated without external APIs.
- Email notifications are not enabled yet.
