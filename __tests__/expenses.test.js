process.env.DB_NAME = 'fitcoach_test';
const request = require('supertest');
const app = require('../server');
const { resetDb, seed } = require('../test-utils/seed');

const pool = app.locals.pool;
afterAll(() => pool.end());

const valid = {
  userId: 'usr_1',
  categoryId: 'cat_1',
  amount: 25.5,
  date: '2026-10-01T10:00:00Z',
};

// ---------------------------------------------------------------
// POST /expenses
// ---------------------------------------------------------------
describe('POST /expenses - validation', () => {
  it.each(['userId', 'categoryId', 'amount', 'date'])(
    'rejects a body missing %s',
    async (field) => {
      const body = { ...valid };
      delete body[field];
      const res = await request(app).post('/expenses').send(body);
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toContain(field);
    }
  );

  it.each([
    ['amount is a string', { amount: '25' }],
    ['amount is zero', { amount: 0 }],
    ['amount is negative', { amount: -5 }],
    ['userId has the wrong format', { userId: '1' }],
    ['categoryId has the wrong format', { categoryId: 'food' }],
    ['date is not a date', { date: 'not-a-date' }],
    ['description is over 255 characters', { description: 'x'.repeat(256) }],
  ])('rejects when %s', async (_label, override) => {
    const res = await request(app).post('/expenses').send({ ...valid, ...override });
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('rejects malformed JSON with a JSON error body', async () => {
    const res = await request(app)
      .post('/expenses')
      .set('Content-Type', 'application/json')
      .send('{"amount": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('request body is not valid JSON');
  });
});

describe('POST /expenses - behaviour with real data', () => {
  beforeEach(async () => {
    await resetDb(pool);
    await seed(pool);
  });

  it('creates an expense and returns it in contract shape', async () => {
    const res = await request(app)
      .post('/expenses')
      .send({ ...valid, description: 'Protein shaker' });
    expect(res.status).toBe(201);
    expect(res.body.expenseId).toMatch(/^exp_\d+$/);
    expect(res.body).toEqual({
      expenseId: res.body.expenseId,
      userId: 'usr_1',
      categoryId: 'cat_1',
      amount: 25.5,
      date: '2026-10-01T10:00:00Z',
      description: 'Protein shaker',
    });
  });

  it('actually saves the expense (it shows up in the summary)', async () => {
    await request(app).post('/expenses').send(valid);
    const res = await request(app).get('/users/usr_1/expenses/summary?month=2026-10');
    // seed already has 700 in October; 700 + 25.5 = 725.5
    expect(res.body.totalSpent).toBe(725.5);
  });

  it('omits description when none was given', async () => {
    const res = await request(app).post('/expenses').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('description');
  });

  it('rejects a userId that is well-formed but does not exist', async () => {
    const res = await request(app).post('/expenses').send({ ...valid, userId: 'usr_99999' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('usr_99999');
  });

  it('rejects a categoryId that is well-formed but does not exist', async () => {
    const res = await request(app).post('/expenses').send({ ...valid, categoryId: 'cat_99999' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cat_99999');
  });
});

// ---------------------------------------------------------------
// PUT /expenses/:expenseId
// ---------------------------------------------------------------
describe('PUT /expenses/:expenseId - validation', () => {
  it('rejects an empty update body', async () => {
    const res = await request(app).put('/expenses/exp_1').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least one field');
  });

  it.each([
    ['amount is negative', { amount: -1 }],
    ['amount is a string', { amount: '10' }],
    ['date is not a date', { date: 'nope' }],
    ['categoryId has the wrong format', { categoryId: 'food' }],
  ])('rejects when %s', async (_label, body) => {
    const res = await request(app).put('/expenses/exp_1').send(body);
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('PUT /expenses/:expenseId - behaviour with real data', () => {
  beforeEach(async () => {
    await resetDb(pool);
    await seed(pool);
  });

  it('updates one field and leaves the others unchanged', async () => {
    const res = await request(app).put('/expenses/exp_1').send({ amount: 1800 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      expenseId: 'exp_1',
      userId: 'usr_1',
      categoryId: 'cat_1',
      amount: 1800,
      date: '2026-09-07T10:00:00Z',
      description: 'September gym membership renewal',
    });
  });

  it('can change the category and description together', async () => {
    const res = await request(app)
      .put('/expenses/exp_1')
      .send({ categoryId: 'cat_2', description: 'Reclassified' });
    expect(res.status).toBe(200);
    expect(res.body.categoryId).toBe('cat_2');
    expect(res.body.description).toBe('Reclassified');
    expect(res.body.amount).toBe(1500);
  });

  it('actually saves the change (the summary total moves)', async () => {
    await request(app).put('/expenses/exp_1').send({ amount: 1800 });
    const res = await request(app).get('/users/usr_1/expenses/summary?month=2026-09');
    // was 4000; exp_1 went from 1500 to 1800
    expect(res.body.totalSpent).toBe(4300);
  });

  it('returns 404 for an id that is well-formed but does not exist', async () => {
    const res = await request(app).put('/expenses/exp_99999').send({ amount: 10 });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('exp_99999');
  });

  it('returns 404 for a malformed id', async () => {
    const res = await request(app).put('/expenses/abc').send({ amount: 10 });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('abc');
  });

  it('rejects a categoryId that is well-formed but does not exist', async () => {
    const res = await request(app).put('/expenses/exp_1').send({ categoryId: 'cat_99999' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cat_99999');
  });
});

// ---------------------------------------------------------------
// DELETE /expenses/:expenseId
// ---------------------------------------------------------------
describe('DELETE /expenses/:expenseId', () => {
  beforeEach(async () => {
    await resetDb(pool);
    await seed(pool);
  });

  it('deletes an expense and returns 204 with no body', async () => {
    const res = await request(app).delete('/expenses/exp_1');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('actually removes it (the summary total drops)', async () => {
    await request(app).delete('/expenses/exp_1');
    const res = await request(app).get('/users/usr_1/expenses/summary?month=2026-09');
    // was 4000; exp_1 (1500) is gone
    expect(res.body.totalSpent).toBe(2500);
  });

  it('returns 404 when deleting the same expense twice', async () => {
    await request(app).delete('/expenses/exp_1');
    const res = await request(app).delete('/expenses/exp_1');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('exp_1');
  });

  it('returns 404 for an id that is well-formed but does not exist', async () => {
    const res = await request(app).delete('/expenses/exp_99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('exp_99999');
  });

  it('returns 404 for a malformed id', async () => {
    const res = await request(app).delete('/expenses/abc');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('abc');
  });
});