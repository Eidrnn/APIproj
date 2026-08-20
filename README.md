# FitCoach

A small Node/Express backend for the FitCoach marketing site, with real
account registration, login, and subscription plan management backed by a
SQLite database.

## What's here

- **`server.js`** — the whole backend: Express routes + a SQLite database
  (via `better-sqlite3`), password hashing (`bcryptjs`), and cookie sessions
  (`express-session`).
- **`public/`** — the static site (the pages you already had), served
  directly by Express. `script.js` in here talks to the API below instead
  of using `localStorage`.
- **`fitcoach.db`** — created automatically the first time you run the
  server. Not committed to git (see `.gitignore`).

## Running it locally

```bash
npm install
npm start
```

Then open **http://localhost:3000**. The site and the API are served from
the same place — no separate front-end server needed.

## API

| Method | Route             | Body                              | Notes                          |
|--------|-------------------|------------------------------------|---------------------------------|
| POST   | `/api/register`   | `{ name, email, password, plan }`  | `plan` optional, defaults to `free` |
| POST   | `/api/login`      | `{ email, password }`              |                                  |
| POST   | `/api/logout`     | —                                   |                                  |
| GET    | `/api/me`         | —                                   | Returns `{ user: null }` if logged out |
| POST   | `/api/subscribe`  | `{ plan }`                          | Requires an active session      |

`plan` is one of `free`, `monthly`, `annual`.

## What's real here, and what isn't

- **Real:** password hashing (bcrypt), a real SQLite database file,
  session-based auth via HTTP-only cookies.
- **Not real yet:** payment processing. "Subscribing" to Monthly or Annual
  just updates the `plan` column — no money moves. To take real payments
  you'd add something like Stripe Checkout and update `/api/subscribe`
  to run after a successful payment webhook, rather than on button click.

## Deploying

This is a normal small Node app, so it runs on most Node hosts — Render,
Railway, Fly.io, or a small VPS all work. A couple of things to change
before deploying anywhere public:

1. Set a real `SESSION_SECRET` environment variable (don't use the default
   in `server.js`).
2. `better-sqlite3` stores its data in a single file (`fitcoach.db`) next
   to the server. That's fine for one server instance, but if your host
   restarts the filesystem between deploys (many free tiers do), your data
   will disappear — you'll want either a persistent disk/volume, or to move
   to a hosted database (e.g. Postgres) at that point.
