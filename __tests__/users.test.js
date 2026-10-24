process.env.DB_NAME = 'fitcoach_test';
const request = require('supertest');
const app = require('../server');
const { resetDb, seed } = require('../test-utils/seed');

const pool = app.locals.pool;
afterAll(() => pool.end());

describe('GET /users', () => {
  it('returns every user in contract shape', async () => {
    await resetDb(pool);
    await seed(pool);
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const u = res.body.find((x) => x.userId === 'usr_1');
    expect(u).toEqual({
      userId: 'usr_1',
      name: 'Wanjiru Kamau',
      email: 'wanjiru.kamau@example.com',
      monthlyAllowance: 8000,
    });
    expect(typeof u.monthlyAllowance).toBe('number');
  });

  it('returns an empty array when there are no users', async () => {
    await resetDb(pool);
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /users/:userId/expenses/summary', () => {
  beforeEach(async () => {
    await resetDb(pool);
    await seed(pool);
  });

  it('sums only the requested month, including its boundaries', async () => {
    const res = await request(app).get('/users/usr_1/expenses/summary?month=2026-09');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId: 'usr_1',
      month: '2026-09',
      totalSpent: 4000,
      monthlyAllowance: 8000,
      remaining: 4000,
    });
  });

  it('returns zero spending for a user with no expenses', async () => {
    const res = await request(app).get('/users/usr_2/expenses/summary?month=2026-09');
    expect(res.status).toBe(200);
    expect(res.body.totalSpent).toBe(0);
    expect(res.body.remaining).toBe(5000);
  });

  it('returns zero spending for a month with no expenses', async () => {
    const res = await request(app).get('/users/usr_1/expenses/summary?month=2026-01');
    expect(res.status).toBe(200);
    expect(res.body.totalSpent).toBe(0);
    expect(res.body.remaining).toBe(8000);
  });

  it('defaults to the current month when month is omitted', async () => {
    const res = await request(app).get('/users/usr_1/expenses/summary');
    expect(res.status).toBe(200);
    expect(res.body.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it.each(['2026-13', 'September', '2026-9'])('rejects month=%s with 400', async (m) => {
    const res = await request(app).get(`/users/usr_1/expenses/summary?month=${m}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('YYYY-MM');
  });

  it('returns 404 for a user that does not exist', async () => {
    const res = await request(app).get('/users/usr_99999/expenses/summary');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('usr_99999');
  });
});