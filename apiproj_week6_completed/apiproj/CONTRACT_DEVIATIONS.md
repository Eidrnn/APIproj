# Contract Deviations — Week 6

No deviations.

The Week 6 write endpoints were implemented according to `openapi.yaml`:
- `POST /expenses` returns `201 Created` with the newly created expense.
- `PUT /expenses/{expenseId}` returns `200 OK` with the updated expense.
- `DELETE /expenses/{expenseId}` returns `204 No Content`.
- Invalid request data returns `400 Bad Request`.
- Updating or deleting a nonexistent expense returns `404 Not Found` with an `{ error }` body.

`openapi.yaml` was not changed.
