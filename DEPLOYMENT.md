# RURO Deployment Guide

## Backend

Required environment variables:

- `MONGODB_URI`
- `MONGODB_DATABASE`
- `JWT_SECRET`
- `ALLOWED_ORIGINS=https://your-frontend-domain`
- `OTP_EXPIRATION_MINUTES=5`
- `OTP_RESEND_COOLDOWN_SECONDS=60`
- `OTP_HOURLY_LIMIT=5`

Recommended OTP delivery method when you do not own a domain:

- SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`

In SendGrid, verify one sender email using Single Sender Verification first. This does not require DNS or a custom domain.

Optional fallback OTP delivery methods:

- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- SMTP: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`

Run locally:

```bash
cd backend
mvn spring-boot:run
```

Build:

```bash
cd backend
mvn clean package
```

## Frontend

Required production variables:

- `VITE_API_BASE_URL=https://your-backend-domain`
- `VITE_WS_BASE_URL=wss://your-backend-domain`

Recommended for reliable calls on mobile data and strict Wi-Fi networks:

- `VITE_TURN_URLS=turn:your-turn-domain:3478,turns:your-turn-domain:5349`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

Run locally:

```bash
cd frontend
npm install
npm run dev
```

Build:

```bash
cd frontend
npm run build
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Railway

1. Create a MongoDB service or use MongoDB Atlas.
2. Deploy `backend` and set its root directory to `backend`.
3. Add the backend environment variables above.
4. Deploy `frontend` and set its root directory to `frontend`.
5. Set `VITE_API_BASE_URL` to the backend HTTPS URL.
6. Set `VITE_WS_BASE_URL` to the backend WSS URL.
7. Update backend `ALLOWED_ORIGINS` to the frontend HTTPS URL.
8. Test `GET /api/health`, signup OTP, login, room create, room join, and WebRTC signaling.
