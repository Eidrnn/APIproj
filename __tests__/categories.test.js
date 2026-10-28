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

afterAll(() => app.locals.pool.end());

describe('GET /categories', () => {
  it('returns 200 and a non-empty array of categories', async () => {
    const res = await api().get('/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('every category has the contract fields with the right types', async () => {
    const res = await api().get('/categories');
    for (const c of res.body) {
      expect(typeof c.categoryId).toBe('string');
      expect(c.categoryId).toMatch(/^cat_\d+$/);
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
      if (c.description !== undefined) expect(typeof c.description).toBe('string');
    }
  });

  it('does not leak database column names', async () => {
    const res = await api().get('/categories');
    expect(res.body[0]).not.toHaveProperty('category_id');
  });
});