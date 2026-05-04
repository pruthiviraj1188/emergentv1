# HerNet — Personal Safety Network · PRD

## Original Problem Statement
> https://safe-ai-network.preview.emergentagent.com/login.. connect it to backend

The existing preview URL presented a "HerNet" personal safety app frontend (hero + login card, 3 role options: User/Admin/Authority, features, trust section, newsletter, contact). This project rebuilds that experience in our workspace with a full backend.

## Architecture
- **Backend**: FastAPI + MongoDB (motor), JWT (Bearer token) auth with bcrypt. Admin is seeded on startup via `lifespan`. All routes under `/api`. UUID ids, `_id` excluded on reads.
- **Frontend**: React 19, React Router, Framer Motion, Tailwind + shadcn components, `lucide-react` icons. Auth via `AuthContext` (token in `localStorage["hn_token"]`, axios interceptor).
- **Design**: Swiss & High-Contrast system (from design_guidelines.json). Outfit + IBM Plex Sans. Rose 600 primary, zinc 950 secondary. Authority dashboard uses dark command-center mode.

## User Personas
1. **User** — personal safety subscriber (SOS, location sharing, emergency contacts, history).
2. **Authority** — verified responder viewing active incidents, resolving alerts.
3. **Admin** — platform oversight (stats, users list, all incidents).

## Core Requirements
- Multi-role auth (register user/authority; admin seeded)
- Hold-to-trigger SOS with threat level (low/medium/high)
- Live location tracking (browser geolocation) + ping endpoint
- Emergency contacts CRUD
- Authority feed (auto-refreshing active alerts) + resolve
- Admin stats & users directory
- Public newsletter subscribe + contact form
- Protected routes with role-based redirects

## What's Been Implemented (Feb 2026)
### Backend (`/app/backend/server.py`, `/app/backend/notifications.py`)
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `POST/GET/DELETE /api/contacts[/:id]`
- `POST /api/sos/trigger` → returns `{alert, notify_summary}` and dispatches notifications
- `GET /api/sos/my`, `GET /api/sos/active`, `GET /api/sos/all`, `POST /api/sos/:id/resolve`
- `POST /api/location/ping`
- `GET /api/admin/stats`, `GET /api/admin/users`
- `POST /api/newsletter/subscribe`, `POST /api/contact`
- `GET /api/notifications/status` — channel configuration state
- **Notifications**: Twilio SMS → emergency contacts + authority phones; Resend email → authority emails. Graceful degradation when keys empty. Async, non-blocking (`asyncio.to_thread`).
- Admin seed: `admin@hernet.com / HerNet@Admin2025`

### Frontend
- `/` Landing, `/login`, `/register`, `/app`, `/admin`, `/authority`
- UserDashboard shows **SMS / Email channel chips** from `/api/notifications/status` + informative toast showing how many recipients were notified on each SOS trigger.

### Testing
- Backend 25/25 pytest pass. Frontend flows 100% pass.

### Env vars (backend/.env)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (empty — plug in real keys to enable SMS)
- `RESEND_API_KEY`, `SENDER_EMAIL` (empty API key — plug in to enable email)

## Prioritized Backlog
- **P0**: Email/SMS notification to emergency contacts on SOS (Twilio/Resend integration)
- **P1**: Real map with markers (Mapbox/Leaflet) on Authority dashboard
- **P1**: Media evidence upload (audio/video) during SOS → object storage
- **P2**: AI threat classification from text note (LLM)
- **P2**: Offline last-known-location sync worker
- **P2**: Unit-test coverage for SOSButton hold timing + refresh-token flow

## Deferred / Next Tasks
1. Wire real dispatch channel (SMS/email) on SOS trigger.
2. Integrate a map tile provider in AuthorityDashboard.
3. Add recording upload via object storage playbook.
4. Add forgot-password + reset flow.
