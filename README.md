# KindCircle API

Express + MongoDB REST API for [KindCircle](../events-client). Login tokens are issued by BetterAuth on the Next.js client; this server only verifies them (JWT, checked with the client's public keys at `/api/auth/jwks`).

## Endpoints

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/events` | public | Upcoming events, soonest first. Query: `type`, `search`, `limit` |
| GET | `/events/:id` | public | One event with its participant count |
| POST | `/events` | JWT | Create an event (creator email comes from the token) |
| GET | `/events/mine` | JWT | Events created by the logged-in user |
| PUT | `/events/:id` | JWT, owner only | Update an event |
| DELETE | `/events/:id` | JWT, owner only | Delete an event and its joins |
| POST | `/events/:id/join` | JWT | Join an event (once per person) |
| GET | `/events/:id/membership` | JWT | Has this user joined? |
| GET | `/joined` | JWT | Events the user joined, sorted by event date |

## Run it

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI and CLIENT_URL
npm run dev            # http://localhost:5000
```
