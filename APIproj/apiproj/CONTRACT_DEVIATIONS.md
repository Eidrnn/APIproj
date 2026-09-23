# Contract Deviations — Week 5

`openapi.yaml` itself was not changed. Two implementation notes worth
recording, since both touch how the contract is satisfied against the
existing `users` table (originally built for registration/login, not
for expense tracking):

1. **`userId` / `categoryId` as strings.** The real primary keys are
   auto-increment integers (`1`, `2`, `3`...), but the contract requires
   these fields as type `string`. Route handlers convert with `String()`
   before the response goes out — verified in Swagger UI that the JSON
   type is `"1"`, not `1`.

2. **`monthly_allowance_kes` column added.** The existing `users` table
   had no concept of a monthly allowance (it was built for auth/
   subscriptions). Added via `ALTER TABLE users ADD COLUMN
   monthly_allowance_kes REAL` — non-destructive, ran once, existing
   rows unaffected (value defaults to `NULL`/unset). On `/users` this is
   omitted entirely when unset, since the contract marks it optional
   there. On `/users/{userId}/expenses/summary`, where the contract
   marks `monthlyAllowance` and `remaining` as required, an unset
   allowance defaults to `0` so the response still matches the schema
   exactly.

All three GET endpoints were verified against `openapi.yaml` in Swagger
UI: field names, types, and status codes (200 success, 404 with an
`{ error }` body for an unknown user) all match.