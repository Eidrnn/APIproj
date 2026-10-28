const request = require('supertest');
const app = require('../server');

const KEY = (process.env.API_KEYS || '').split(',')[0].trim().split(':').pop();
const base = () => request(process.env.API_URL || app);

afterAll(() => app.locals.pool.end());

describe('API key authentication', () => {
  it('rejects a request with no key: 401 and a JSON error', async () => {
    const res = await base().get('/categories');
    expect(res.status).toBe(401);
    expect(typeof res.body.error).toBe('string');
  });

  it('rejects a wrong key: 401', async () => {
    const res = await base().get('/categories').set('X-API-Key', 'wrong');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a missing key on write endpoints too', async () => {
    const res = await base().post('/expenses').send({});
    expect(res.status).toBe(401);
  });

  it('accepts a valid key: 200 and real data', async () => {
    const res = await base().get('/categories').set('X-API-Key', KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('does not advertise the framework in response headers', async () => {
    const res = await base().get('/categories').set('X-API-Key', KEY);
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  it('returns a JSON 404 (no stack trace or HTML) for an unknown route', async () => {
    const res = await base().get('/no-such-route').set('X-API-Key', KEY);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('ignores extra fields on write endpoints (no mass assignment)', async () => {
    const res = await base()
      .post('/expenses')
      .set('X-API-Key', KEY)
      .send({
        userId: 'usr_1', categoryId: 'cat_1', amount: 1, date: '2026-10-12T10:00:00Z',
        expenseId: 'exp_999999', isAdmin: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.expenseId).not.toBe('exp_999999');
    expect(res.body).not.toHaveProperty('isAdmin');
    await base().delete(`/expenses/${res.body.expenseId}`).set('X-API-Key', KEY);
  });
});