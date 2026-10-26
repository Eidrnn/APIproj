# Integration Log: Week 10

One row per bug or surprise, whoever's code it was. Rows 1 to 7 are things that
happened while setting up and exposing our own API (we are the provider for our
downstream partner). The upstream-partner sections below are still to be filled
in as the work happens.

## Our side (provider)

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Opening `http://localhost:8080/categories` in a browser returned `{"error":"Missing or invalid API key"}` | Tested on purpose: the key check works as designed. A browser address bar cannot send the `X-API-Key` header | None needed. Test with curl, Swagger Authorize, or Postman instead | Ours, no bug |
| 2 | `curl.exe -H "<key>" ...` returned `401`, and curl warned the header "does not look like a header" | The `-H` value was missing the `X-API-Key: ` name, so no key was sent | Corrected the command to `-H "X-API-Key: <key>"` | Ours, fixed by us |
| 3 | `401` on every request even with the right key, then `EADDRINUSE` when starting the server from `APIproj` | No `.env` file in `APIproj`, so no `API_KEYS` was loaded. Also, an old `node server.js` from another folder was still holding port 8080 and answering requests | Created `.env` in `APIproj`, stopped the old node process, restarted from `APIproj`. Request with the key returned `200` | Ours, fixed by us |
| 4 | Public tunnel URL stopped working: Cloudflare error 1033, later "Could not resolve host" | Quick tunnels only live while the cloudflared window stays open. The window had been closed or interrupted | Started a new tunnel, which gives a new random URL, and sent it to the partner | Ours, fixed by us |
| 5 | Public URL unreachable ("site can't be reached") after closing the laptop lid | The laptop slept, which dropped the tunnel and paused the server | Restarted the server and tunnel, shared the new URL, and set sleep to never while the partner tests | Ours, fixed by us |
| 6 | `GET /users/usr_1/expenses/summary?month=2026-10` returned `totalSpent` 6700, but the README documents 3700 | Two leftover test expenses (IDs 4 and 5, 1500 each) from earlier Swagger `POST` tests were never deleted | Deleted rows 4 and 5, reset the auto-increment to 4. Summary returned 3700 as documented (2026-10-26) | Ours, fixed by us |
| 7 | Checking the docs against the code found mismatches: README still described an old SQLite project, the contract had no `GET /users/{userId}`, no `X-API-Key` / `401`, no `400` on `PUT` or summary, and examples our code would reject (`cat_gym`) | Docs and contract were not updated as the code grew | Rewrote the README, corrected `openapi.yaml` (v1.1.0), added `schema.sql` and `.env.example`. Told the downstream partner the contract changed | Ours, fixed by us |

## Tests we ran on purpose against our own API

| Test | Result |
|---|---|
| No key | `401` with `{"error":"Missing or invalid API key"}` |
| Correct key | `200` with the three categories |
| Public tunnel URL, no key | `401` returned through Cloudflare, so tunnel and server both work |

## Upstream partner (we call them): to fill in

| Item | Notes |
|---|---|
| Partner base URL and header name from their README | |
| First call from the terminal (Part B): command, status, whether the fields match their contract | |
| Our feature (`/partner-data` and page): what it shows | |
| Failure test (Part D): partner server stopped, what our app showed, whether it recovered | |

Bugs found in their API or at the seam between our codes go in the first table, with the
bug-report format from the handout (what I did, expected, got, evidence, when).

## Downstream partner (they call us): to fill in

| Item | Notes |
|---|---|
| When we sent them the URL, key, header name, and contract | |
| Anything they reported (`401`, `404`, wrong fields) and what we changed | |
| Contract clarifications we made as a result | |
