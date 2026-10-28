// The limit must be set BEFORE the server module is loaded, so this lives in its own file.
process.env.RATE_LIMIT_MAX = '3';

const request = require('supertest');
const app = require('../server');

const KEY = (process.env.API_KEYS || '').split(',')[0].trim().split(':').pop();

afterAll(() => app.locals.pool.end());

describe('rate limiting', () => {
  it('allows 3 requests, then answers 429 with Retry-After and a JSON body', async () => {
    const codes = [];
    let last;
    for (let i = 0; i < 5; i++) {
      last = await request(app).get('/categories').set('X-API-Key', KEY);
      codes.push(last.status);
    }
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    expect(last.headers['retry-after']).toBeDefined();
    expect(Number(last.headers['retry-after'])).toBeGreaterThan(0);
    expect(last.body.error).toBe('Too many requests');
    expect(typeof last.body.retryAfter).toBe('number');
  });
});