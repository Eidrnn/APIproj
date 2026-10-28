# Security Audit: Week 9

Scope: the FitCoach Expenditure Tracker API (`server.js`), its responses, and the repo.
Items marked **TO CONFIRM** need a real result from you before submitting: run the command
shown, write down what actually happened, and delete the tag.

## What we implemented

- **Authentication:** every API route requires a key in the `X-API-Key` header. Missing or wrong key gives `401` and the handler never runs. The check is registered before all routes.
- **One key per consumer:** `API_KEYS` in `.env` holds one key for the downstream partner and one for our own team's testing, optionally named (`partner:<key>,team:<key>`). Keys are compared in constant time.
- **Rate limiting:** 100 requests per minute per key (per IP for the one public route). Over the limit gives `429` with a `Retry-After` header and a JSON body.
- **Keys live outside source code:** in `.env`, which is in `.gitignore`. `.env.example` has placeholders only.

## Rate limit threshold and why

**100 requests per minute per key.** A person using the app, or a partner's page that loads a few
records at a time, makes a handful of calls per minute, so 100 leaves plenty of room for normal
use and for a test suite (about 35 requests). It is low enough that a runaway loop on a partner's
side is cut off within a minute and cannot hammer our laptop's MySQL. The limit is an environment
variable (`RATE_LIMIT_MAX`), so it can be changed without editing code.

## What we checked (Part D checklist)

| Check | What we looked at | What we found | Fixed? |
|---|---|---|---|
| Sensitive fields | Every response is built from an explicit list of fields (`mapExpense`, and the object literals in the user and category routes), not raw database rows | Nothing leaks: no internal columns or `user_id` / `full_name` names. `email` is returned on `/users`, but the contract promises it and the partner's feature needs identity | Nothing to fix |
| Other people's data | Changing the ID in `GET /users/{userId}` or the summary URL returns another user's profile and spending | A valid key can read **any** user. Keys identify the calling app, not an end user, and there is only one level of access | Accepted for this course. A real app would add per-user permissions (a `403` for records the caller does not own) |
| Error messages | Triggered bad JSON, wrong types, missing fields, unknown IDs, an unknown route, a database error | Validation errors are short and safe. Two messages echo the ID the caller sent (`No user found with id usr_99`), which is harmless in a JSON response. Before this week, an unhandled error such as an oversized body would have used Express's default HTML page, which includes a stack trace outside production mode | **Fixed:** a JSON `404` for unknown routes and a final error handler that returns a generic message and logs details server-side only |
| Write endpoints / extra fields | Sent `expenseId` and `isAdmin` on `POST /expenses` | Extra fields are ignored: inserts use an explicit column list and `PUT` only updates a whitelist. The response has a generated `expenseId` and no `isAdmin`. Covered by an automated test | Nothing to fix |
| SQL injection | Read every query | All queries use `?` placeholders. IDs are parsed with a strict pattern first | Nothing to fix |
| Framework fingerprint | Looked at response headers | `X-Powered-By: Express` was sent on every response | **Fixed:** `app.disable('x-powered-by')`, checked by an automated test |
| Key comparison | Read the auth middleware | The first version compared string lengths, which can differ from byte lengths for non-ASCII input and could make the comparison throw | **Fixed:** compare byte buffers, then constant-time compare |
| Keys in the wrong place | Server logs and docs: the server logs the **count** of keys, never the keys. README and `openapi.yaml` use `<your-api-key>` | No key printed or documented. **TO CONFIRM:** run `git log --all --oneline -- .env` (should print nothing) and `git grep -nE "[0-9a-f]{48}" (git rev-list --all)` (should find no real key) and record the output | Nothing to fix, pending your check |
| CORS | `cors()` allows any origin (`Access-Control-Allow-Origin: *`) | Acceptable because callers use keys server-to-server, and no key is ever placed in browser code. A tighter option is to allow only a known origin | Accepted, low risk |
| Public routes | Which routes work without a key | See the section below | Justified |

## Deliberate exception: `GET /partner-data` and the page at `/`

The handout says every endpoint needs a key and a public route must be justified here.
`/partner-data` and `web/index.html` are open because they are our Week 10 consumer feature:
the page runs in a browser, and a browser cannot send our `X-API-Key` without putting the key in
page JavaScript, where anyone can read it. The route returns only public campus-event data fetched
from CampusCore (title, location, start time), exposes no key and no data from our database, and is
rate limited per IP. It is not part of the API contract. If this exception is not acceptable, the
alternative is to remove the route and the page before submitting.

## Evidence for the rate limit demonstration

**TO CONFIRM:** with `RATE_LIMIT_MAX=3` in `.env` and the server restarted, run:

```
$k = node -e "require('dotenv').config({quiet:true}); process.stdout.write(process.env.API_KEYS.split(',')[0].split(':').pop())"
1..5 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code} " -H "X-API-Key: $k" http://localhost:8080/categories }
```

Expected output: `200 200 200 429 429`. Paste the real output here (no key), then set
`RATE_LIMIT_MAX` back to 100 and restart:

```
PS C:\Users\odwor\Downloads\APIproj> 1..5 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code} " -H "X-API-Key: $k" http://localhost:8080/categories }
200 200 429 429 429 

PS C:\Users\odwor\Downloads\APIproj> 1..5 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code} " -H "X-API-Key: $k" http://localhost:8080/categories }
429 429 429 429 429 
PS C:\Users\odwor\Downloads\APIproj> curl.exe -i -H "X-API-Key: $k" http://localhost:8080/categories                      
HTTP/1.1 429 Too Many Requests
Access-Control-Allow-Origin: *
Retry-After: 41
Content-Type: application/json; charset=utf-8
Content-Length: 45
ETag: W/"2d-d4BdeO6RNvixmqMTfcyvpgfgckk"
Date: Wed, 28 Oct 2026 16:27:03 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":"Too many requests","retryAfter":41}
```

Also run `curl.exe -i -H "X-API-Key: $k" http://localhost:8080/categories` once while limited and
record the `Retry-After` header and JSON body.

## Tests added

`__tests__/auth.test.js`: no key gives `401`, a wrong key gives `401`, a missing key on `POST` gives
`401`, a valid key gives `200`, no `X-Powered-By` header, a JSON `404` for unknown routes, extra
fields ignored. `__tests__/ratelimit.test.js`: with the limit set to 3, the responses are
`200 200 200 429 429`, with `Retry-After` and a JSON body. All earlier tests now send a key.