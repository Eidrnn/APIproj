# Integration Log: Week 10

One row per bug or surprise, whoever's code it was. Section 1 covers our own API (we are
the provider for our downstream partner). Section 2 covers calling our upstream partner,
CampusCore. Rows marked **TO CONFIRM** or left blank still need a real result before
submitting: only fill them in with what actually happened.

## 1. Our side (provider)

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Opening `http://localhost:8080/categories` in a browser returned `{"error":"Missing or invalid API key"}` | Tested on purpose: the key check works as designed. A browser address bar cannot send the `X-API-Key` header | None needed. Test with curl, Swagger Authorize, or Postman instead | Ours, no bug |
| 2 | `curl.exe -H "<key>" ...` returned `401`, and curl warned the header "does not look like a header" | The `-H` value was missing the `X-API-Key: ` name, so no key was sent | Corrected the command to `-H "X-API-Key: <key>"` | Ours, fixed by us |
| 3 | `401` on every request even with the right key, then `EADDRINUSE` when starting the server from `APIproj` | No `.env` file in `APIproj`, so no `API_KEYS` was loaded. An old `node server.js` from another folder was also holding port 8080 and answering requests | Created `.env` in `APIproj`, stopped the old node process, restarted from `APIproj`. A request with the key then returned `200` | Ours, fixed by us |
| 4 | Public tunnel URL stopped working: Cloudflare error 1033, later "Could not resolve host" | Quick tunnels only live while the cloudflared window stays open. The window had been closed or interrupted | Started a new tunnel, which gives a new random URL, and sent it to the partner | Ours, fixed by us |
| 5 | Public URL unreachable ("site can't be reached") after closing the laptop lid | The laptop slept, which dropped the tunnel and paused the server | Restarted the server and tunnel, shared the new URL, and set sleep to never while the partner tests | Ours, fixed by us |
| 6 | `GET /users/usr_1/expenses/summary?month=2026-10` returned `totalSpent` 6700, but the README documents 3700 | Two leftover test expenses (IDs 4 and 5, 1500 each) from earlier Swagger `POST` tests were never deleted | Deleted rows 4 and 5, reset the auto-increment to 4. The summary then returned 3700 as documented | Ours, fixed by us |
| 7 | Checking the docs against the code found mismatches: README still described an old SQLite project; the contract had no `GET /users/{userId}`, no `X-API-Key` or `401`, no `400` on `PUT` or summary; examples our code would reject (`cat_gym`) | Docs and contract were not updated as the code grew | Rewrote the README, corrected `openapi.yaml` (v1.1.0), added `schema.sql` and `.env.example`. Told the downstream partner the contract changed | Ours, fixed by us |
| 8 | Our `/partner-data` route returned `502` "Partner data unavailable"; the server log said `partner returned 404` | `PARTNER_PATH` still held the placeholder `/REPLACE_WITH_PARTNER_PATH`, so we requested a path that does not exist on the partner | Set `PARTNER_PATH` to `/events`. The partner's `/events` then returned `200` through our route | Ours, fixed by us |
| 9 | Opening `http://localhost:8080/` showed `{"error":"Missing or invalid API key"}` instead of the events page | The running `server.js` was still the old version, without `express.static('web')`, so the page request hit the key check | Replaced `server.js` with the new version and restarted. Checked with `Select-String "express.static" server.js` | Ours, fixed by us |

## 2. Upstream partner: CampusCore (we call them)

### First call, from the terminal (before any code of ours was involved)

| Call | Result |
|---|---|
| `GET /` on their base URL | `200`, `{"message":"CampusCore API is running"}`, matches their README |
| `GET /events` | `200`, a JSON object `{"events":[...]}` with `event_id`, `title`, `description`, `location`, `start_time`, `end_time`. Structure matches their contract (snake_case names). No key was needed at that time |
| `GET /api/events` | `200`, a different shape (plain array with `id`, `date` as text such as "20 August 2026", `category`, and so on). This is their own app's route, not the contract |

### Bugs and surprises at the seam

| # | What we saw | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 10 | In `/events`, `description` and `end_time` are `null` for 2 of 3 events, but their contract defines both as strings | Contract and data disagree: either the contract should mark these nullable, or the data should be filled | Our code only reads `title`, `location`, `start_time`, so nothing broke on our side. Reported to partner: **TO CONFIRM (date sent, their answer)** | Theirs, to be fixed by them |
| 11 | `/events` `start_time` is a day earlier than their own `/api/events` date for all three events (for example Football: `2026-08-19T00:00:00Z` vs "20 August 2026") | **TO CONFIRM** with partner. Looks like a time-zone shift when dates are converted | We display `start_time` as given and flagged it. **TO CONFIRM** | Theirs, to be confirmed |
| 12 | The `title` of one event has a trailing space (`"Football "`), and all three events are dated before today while the contract describes upcoming events | Data quality in their database | We trim titles in our `/partner-data` route. Told partner: **TO CONFIRM** | Theirs for the data, ours for the trim |
| 13 | Their README and their contract list different paths: `/fitcoachusers/{id}/profile` vs `/fitcoach-users/{id}/profile`; `/fitcoachusers/{id}/fitcoachbindings` vs `/fitcoach-users/{id}/fitcoach-bindings`; `/marketplace` vs `/marketplace/listings?status=active` | README and contract were written separately | **TO CONFIRM**: test each path with curl, record which one works, and report the other | Theirs, to be fixed by them |
| 14 | Their contract and README define no authentication and say to follow the contract, but they issued us an API key | Documentation is out of date, or the key is optional | **TO CONFIRM**: run `curl.exe -i https://<their-url>/events` with no key and record `200` or `401`, then ask them to document the header name | Theirs, to be fixed by them |

### Our feature

| Item | Notes |
|---|---|
| What we built | `GET /partner-data` on our server fetches `/events`, checks the response has an `events` array, and returns `title`, `location`, `startTime`. A page at `/` (`web/index.html`) shows the list |
| Where the partner URL and any key live | `PARTNER_URL` and `PARTNER_API_KEY` in `.env` (not committed). `.env.example` has placeholders |
| Design decision | `/partner-data` and the page are public on purpose: a browser cannot send our key, and a key in page JavaScript would leak. The route returns only public campus-event data and exposes no key. Everything else on our API still needs `X-API-Key` |
| Field names | Taken exactly from their contract (`title`, `location`, `start_time`) |

### Failure test (Part D)

| Step | What we did | What happened |
|---|---|---|
| Partner unavailable | **TO FILL IN**: partner stopped, or `PARTNER_URL` pointed at a bad address | **TO FILL IN**: the page message, the server log line (`ENOTFOUND` / `ECONNREFUSED`), whether `/categories` still worked |
| Recovery | **TO FILL IN**: restored the URL or the partner restarted | **TO FILL IN**: whether events came back with no code change |

## 3. Downstream partner (they call us): TO FILL IN

| Item | Notes |
|---|---|
| When we sent them the URL, key, header name, and contract | |
| What they reported (`401`, `404`, wrong fields) and what we changed | |
| Contract clarifications we made as a result | |

## Tests we ran on purpose

| Test | Result |
|---|---|
| Our API, no key | `401` with `{"error":"Missing or invalid API key"}` |
| Our API, correct key | `200` with the three categories |
| Our public tunnel URL, no key | `401` returned through Cloudflare, so tunnel and server both work |
| CampusCore `GET /` | `200` health message |
| CampusCore `GET /events` | `200`, structure matches their contract |
