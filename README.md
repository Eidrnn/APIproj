# FitCoach Expenditure Tracker API

A REST API for people who want to track their fitness spending (gym
memberships, equipment, classes) against a monthly allowance. It lets a client
list users and expense categories, create, update, and delete fitness expense
records, and see how much of a user's monthly allowance has been spent.

Built by Team 8 with Node.js, Express, and MySQL. The full contract is in
[`openapi.yaml`](openapi.yaml).

## Authentication

Every request needs an API key in the `X-API-Key` header. Your key is issued to
you privately by the API owner. Requests with a missing or wrong key get:

```
401 { "error": "Missing or invalid API key" }
```

Keep your key out of browser code and out of git.

## Quickstart

Replace `<your-key>` with the key you were given and `<base-url>` with the
address of the running API (for local use, `http://localhost:8080`).

```bash
curl -H "X-API-Key: <your-key>" <base-url>/categories
```

On Windows PowerShell, use `curl.exe` instead of `curl`:

```powershell
curl.exe -H "X-API-Key: <your-key>" <base-url>/categories
```

You should get `200` and a list of three categories:

```json
[
  {"categoryId":"cat_1","name":"Gym Membership","description":"Recurring monthly gym or fitness club membership fees"},
  {"categoryId":"cat_2","name":"Equipment","description":"Fitness equipment purchases"},
  {"categoryId":"cat_3","name":"Classes","description":"Fitness classes and training sessions"}
]
```

## Endpoints

IDs are strings with a prefix: users `usr_<number>`, categories `cat_<number>`,
expenses `exp_<number>`. All examples assume the sample data from `schema.sql`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | List all user profiles |
| GET | `/users/{userId}` | Get one user profile |
| GET | `/categories` | List fitness expense categories |
| POST | `/expenses` | Create an expense |
| PUT | `/expenses/{expenseId}` | Update an expense (send only the fields to change) |
| DELETE | `/expenses/{expenseId}` | Delete an expense |
| GET | `/users/{userId}/expenses/summary?month=YYYY-MM` | Spending vs. monthly allowance |

### GET /users

```bash
curl -H "X-API-Key: <your-key>" <base-url>/users
```

`200`:

```json
[
  {"userId":"usr_1","name":"Wanjiru Kamau","email":"wanjiru.kamau@example.com","monthlyAllowance":8000},
  {"userId":"usr_2","name":"Brian Otieno","email":"brian.otieno@example.com","monthlyAllowance":5000}
]
```

### GET /users/{userId}

```bash
curl -H "X-API-Key: <your-key>" <base-url>/users/usr_1
```

`200`:

```json
{"userId":"usr_1","name":"Wanjiru Kamau","email":"wanjiru.kamau@example.com","monthlyAllowance":8000}
```

Unknown user (`/users/usr_99`) returns `404`:

```json
{"error":"No user found with id usr_99"}
```

### GET /categories

See the Quickstart above.

### POST /expenses

Required fields: `userId`, `categoryId`, `amount` (a number greater than 0),
`date` (ISO date-time). Optional: `description` (up to 255 characters).

```bash
curl -X POST <base-url>/expenses \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"usr_1","categoryId":"cat_1","amount":1500,"date":"2026-10-12T10:00:00Z","description":"October gym membership renewal"}'
```

PowerShell version (quotes inside the JSON must be escaped):

```powershell
curl.exe -X POST <base-url>/expenses -H "X-API-Key: <your-key>" -H "Content-Type: application/json" -d "{\"userId\":\"usr_1\",\"categoryId\":\"cat_1\",\"amount\":1500,\"date\":\"2026-10-12T10:00:00Z\",\"description\":\"October gym membership renewal\"}"
```

`201`:

```json
{"expenseId":"exp_4","userId":"usr_1","categoryId":"cat_1","amount":1500,"date":"2026-10-12T10:00:00Z","description":"October gym membership renewal"}
```

Invalid input returns `400`, for example a missing field (`{}`):

```json
{"error":"userId is required"}
```

### PUT /expenses/{expenseId}

Send one or more of `categoryId`, `amount`, `date`, `description`. The
`userId` of an expense cannot be changed.

```bash
curl -X PUT <base-url>/expenses/exp_4 \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{"amount":2200}'
```

`200` returns the full updated record:

```json
{"expenseId":"exp_4","userId":"usr_1","categoryId":"cat_1","amount":2200,"date":"2026-10-12T10:00:00Z","description":"October gym membership renewal"}
```

An empty body returns `400` (`{"error":"provide at least one field to update"}`).
An unknown expense returns `404` (`{"error":"No expense found with id exp_99999"}`).

### DELETE /expenses/{expenseId}

```bash
curl -X DELETE -H "X-API-Key: <your-key>" <base-url>/expenses/exp_4
```

`204` with no body. Deleting the same expense again returns `404`.

### GET /users/{userId}/expenses/summary

`month` is optional (format `YYYY-MM`) and defaults to the current month.

```bash
curl -H "X-API-Key: <your-key>" "<base-url>/users/usr_1/expenses/summary?month=2026-10"
```

`200` (with the sample data from `schema.sql`):

```json
{"userId":"usr_1","month":"2026-10","totalSpent":3700,"monthlyAllowance":8000,"remaining":4300}
```

A badly formatted month returns `400` (`{"error":"month must be formatted as YYYY-MM"}`).
An unknown user returns `404`. A month with no expenses returns `totalSpent: 0`.

## Error format

Every error response is JSON with a single `error` string:

```json
{ "error": "human-readable message" }
```

| Status | Meaning |
|---|---|
| `400` | Invalid or missing fields, bad `month`, or a `userId`/`categoryId` that does not exist |
| `401` | Missing or invalid `X-API-Key` |
| `404` | The user or expense in the path does not exist |
| `500` | Unexpected server error |

## Run it locally

You need Node.js 18 or newer and MySQL 8, with the MySQL server running.

1. Clone the repo and install dependencies:

   ```bash
   git clone <repo-url>
   cd <repo-folder>
   npm install
   ```

2. Create the database and sample data. This **drops and recreates** a database
   named `fitcoach`:

   ```bash
   mysql -u root -p -e "source schema.sql"
   ```

   (Or open `schema.sql` in MySQL Workbench and run the whole script.)

3. Create your `.env` file from the template:

   ```bash
   cp .env.example .env          # Windows: copy .env.example .env
   ```

   Set `DB_PASSWORD` to your MySQL password. Generate an API key and put it on
   the `API_KEYS=` line:

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```

4. Start the server:

   ```bash
   node server.js
   ```

   You should see `Server running on http://localhost:8080`.

5. Test it with the Quickstart command, using your key and
   `http://localhost:8080` as the base URL.

`.env` holds your secrets and is not committed to git.
