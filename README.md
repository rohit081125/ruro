# RURO Video Call

RURO is a secure two-person video calling application built with Spring Boot, MongoDB, WebSocket signaling, and React/Vite.

## Project Structure

```text
backend/
  src/main/java/com/videocall/
    auth/            authentication models, DTOs, repositories, services, controller
    config/          CORS and security headers
    controller/      room and health REST APIs
    service/         room lifecycle service
    websocket/       WebRTC signaling
frontend/
  src/pages/         auth, dashboard, meeting lobby, call room
  src/components/    shared UI components
docker-compose.yml   local Docker stack
```

Live transcription, meeting summaries, AI summaries, translation endpoints, and related UI/storage have been removed.

## Local Development

Backend:

```bash
cd backend
mvn spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Health: `http://localhost:8080/api/health`

## Environment

Copy `.env.example` to `.env` for Docker, or configure the same variables in your hosting provider.

Required production variables:

- `MONGODB_URI`
- `MONGODB_DATABASE`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`

Email providers are pluggable. Configure one of:

- SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- SMTP: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`

## Authentication API

Base path: `/api/auth`

- `POST /login`
- `POST /signup/complete` (Direct Signup)
- `POST /forgot/reset-password` (Direct Password Reset)
- `POST /change-password` with `Authorization: Bearer <token>`
- `POST /change-name` with `Authorization: Bearer <token>`

## Rooms API

Base path: `/api/rooms`

- `POST /create` with `Authorization: Bearer <token>`
- `GET /check/{code}` with `Authorization: Bearer <token>`

WebRTC signaling runs on `/signal`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:5173`.

## Railway Deployment

1. Create a MongoDB database and copy its connection URI.
2. Deploy `backend` as a Spring Boot service.
3. Set backend variables: `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `ALLOWED_ORIGINS`, and email provider variables.
4. Deploy `frontend` as a static/Vite service.
5. Set frontend variables: `VITE_API_BASE_URL=https://<backend-domain>` and `VITE_WS_BASE_URL=wss://<backend-domain>`.
6. Set `ALLOWED_ORIGINS=https://<frontend-domain>` on the backend.
7. Verify `/api/health`, signup OTP delivery, login, room creation, and a two-browser call.

## Security Summary

- Passwords and OTPs are bcrypt-hashed.
- JWT bearer auth protects account and room APIs.
- CORS is environment-controlled.
- Security headers are applied on backend responses.
- Input validation uses Jakarta Bean Validation.
- Mongo repositories avoid ad hoc query string construction.
- Forgot-password requests use a generic response for unknown emails.
- Secrets were removed from source config and documented in env examples.
