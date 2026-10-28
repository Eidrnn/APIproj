const request = require('supertest');
const app = require('../server');

// Every request carries a valid key (the first one in API_KEYS, which server.js loads from .env)
const KEY = (process.env.API_KEYS || '').split(',')[0].trim().split(':').pop();
const base = () => request(process.env.API_URL || app);
const api = () => ({
  get: (p) => base().get(p).set('X-API-Key', KEY),
  post: (p) => base().post(p).set('X-API-Key', KEY),
  put: (p) => base().put(p).set('X-API-Key', KEY),
  delete: (p) => base().delete(p).set('X-API-Key', KEY),
});

const validExpense = {
  userId: 'usr_1',
  categoryId: 'cat_1',
  amount: 1500,
  date: '2026-10-12T10:00:00Z',
  description: 'Jest test expense',
};

// Every expense a test creates is tracked here and deleted afterwards,
// so the seed data (and the summary totals) stay unchanged.
const created = [];

async function createExpense(overrides = {}) {
  const res = await api().post('/expenses').send({ ...validExpense, ...overrides });
  if (res.status === 201) created.push(res.body.expenseId);
  return res;
}

afterEach(async () => {
  while (created.length) {
    await api().delete(`/expenses/${created.pop()}`);
  }
});

afterAll(() => app.locals.pool.end());

describe('POST /expenses', () => {
  it('creates an expense and returns 201 with the contract shape', async () => {
    const res = await createExpense();
    expect(res.status).toBe(201);
    expect(res.body.expenseId).toMatch(/^exp_\d+$/);
    expect(res.body.userId).toBe('usr_1');
    expect(res.body.categoryId).toBe('cat_1');
    expect(res.body.amount).toBe(1500);
    expect(typeof res.body.date).toBe('string');
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(res.body.description).toBe('Jest test expense');
  });

  it('rejects an empty body with 400 and an error message', async () => {
    const res = await api().post('/expenses').send({});
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('rejects amount sent as a string', async () => {
    const res = await createExpense({ amount: '1500' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a negative amount', async () => {
    const res = await createExpense({ amount: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects an amount of zero (boundary)', async () => {
    const res = await createExpense({ amount: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid date', async () => {
    const res = await createExpense({ date: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('rejects a user that does not exist', async () => {
    const res = await createExpense({ userId: 'usr_99999' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PUT /expenses/:expenseId', () => {
  it('updates only the supplied field and returns 200 with the full record', async () => {
    const original = (await createExpense()).body;
    const res = await api().put(`/expenses/${original.expenseId}`).send({ amount: 2200 });
    expect(res.status).toBe(200);
    expect(res.body.expenseId).toBe(original.expenseId);
    expect(res.body.amount).toBe(2200);
    expect(res.body.categoryId).toBe(original.categoryId);
    expect(res.body.description).toBe(original.description);
  });

  it('returns 404 for an expense that does not exist (and does not create one)', async () => {
    const res = await api().put('/expenses/exp_99999').send({ amount: 100 });
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
    const again = await api().delete('/expenses/exp_99999');
    expect(again.status).toBe(404);
  });

  it('rejects an empty body with 400', async () => {
    const original = (await createExpense()).body;
    const res = await api().put(`/expenses/${original.expenseId}`).send({});
    expect(res.status).toBe(400);
  });

  it('rejects a wrong-typed amount with 400', async () => {
    const original = (await createExpense()).body;
    const res = await api().put(`/expenses/${original.expenseId}`).send({ amount: 'lots' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /expenses/:expenseId', () => {
  it('deletes the record: 204 with no body, then it is really gone', async () => {
    const { expenseId } = (await createExpense()).body;

    const res = await api().delete(`/expenses/${expenseId}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const again = await api().delete(`/expenses/${expenseId}`);
    expect(again.status).toBe(404);
    const update = await api().put(`/expenses/${expenseId}`).send({ amount: 1 });
    expect(update.status).toBe(404);
  });

  it('returns 404 for an expense that does not exist', async () => {
    const res = await api().delete('/expenses/exp_99999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /users/:userId/expenses/summary', () => {
  it('returns 200 with the contract shape and consistent numbers', async () => {
    const res = await api().get('/users/usr_1/expenses/summary?month=2026-10');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('usr_1');
    expect(res.body.month).toBe('2026-10');
    expect(typeof res.body.totalSpent).toBe('number');
    expect(typeof res.body.monthlyAllowance).toBe('number');
    expect(typeof res.body.remaining).toBe('number');
    expect(res.body.remaining).toBe(res.body.monthlyAllowance - res.body.totalSpent);
  });

  it('reflects a newly created expense in totalSpent', async () => {
    const before = (await api().get('/users/usr_1/expenses/summary?month=2026-10')).body;
    await createExpense({ amount: 1000, date: '2026-10-15T09:00:00Z' });
    const after = (await api().get('/users/usr_1/expenses/summary?month=2026-10')).body;
    expect(after.totalSpent).toBe(before.totalSpent + 1000);
    expect(after.remaining).toBe(before.remaining - 1000);
  });

  it('returns totalSpent 0 for a month with no expenses (empty result edge case)', async () => {
    const res = await api().get('/users/usr_1/expenses/summary?month=2020-01');
    expect(res.status).toBe(200);
    expect(res.body.totalSpent).toBe(0);
    expect(res.body.remaining).toBe(res.body.monthlyAllowance);
  });

  it('returns 404 for a user that does not exist', async () => {
    const res = await api().get('/users/usr_99999/expenses/summary');
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });

  it('returns 400 for a badly formatted month', async () => {
    const res = await api().get('/users/usr_1/expenses/summary?month=october');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});