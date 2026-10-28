const request = require('supertest');
const app = require('../server');

// Set API_URL to run these tests against a deployed/tunnelled server instead
// Every request carries a valid key (the first one in API_KEYS, which server.js loads from .env)
const KEY = (process.env.API_KEYS || '').split(',')[0].trim().split(':').pop();
const base = () => request(process.env.API_URL || app);
const api = () => ({
  get: (p) => base().get(p).set('X-API-Key', KEY),
  post: (p) => base().post(p).set('X-API-Key', KEY),
  put: (p) => base().put(p).set('X-API-Key', KEY),
  delete: (p) => base().delete(p).set('X-API-Key', KEY),
});

afterAll(() => app.locals.pool.end());

describe('GET /users', () => {
  it('returns 200 and an array of users matching the contract', async () => {
    const res = await api().get('/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const u = res.body[0];
    expect(typeof u.userId).toBe('string');
    expect(u.userId).toMatch(/^usr_\d+$/);
    expect(typeof u.name).toBe('string');
    expect(typeof u.email).toBe('string');
    expect(typeof u.monthlyAllowance).toBe('number'); // not "8000.00"
  });

  it('does not leak database column names', async () => {
    const res = await api().get('/users');
    const u = res.body[0];
    expect(u).not.toHaveProperty('user_id');
    expect(u).not.toHaveProperty('full_name');
    expect(u).not.toHaveProperty('monthly_allowance');
  });
});

describe('GET /users/:userId', () => {
  it('returns 200 and a single user object for an existing user', async () => {
    const res = await api().get('/users/usr_1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(false);
    expect(res.body.userId).toBe('usr_1');
    expect(typeof res.body.name).toBe('string');
    expect(typeof res.body.email).toBe('string');
    expect(typeof res.body.monthlyAllowance).toBe('number');
  });

  it('returns 404 with an error message for a user that does not exist', async () => {
    const res = await api().get('/users/usr_99999');
    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });

  it('returns 404 for a malformed user id (edge case)', async () => {
    const res = await api().get('/users/abc');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});