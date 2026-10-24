process.env.DB_NAME = 'fitcoach_test';
const request = require('supertest');
const app = require('../server');
const { resetDb, seed } = require('../test-utils/seed');

const pool = app.locals.pool;
afterAll(() => pool.end());

describe('GET /categories', () => {
  it('returns every category in contract shape', async () => {
    await resetDb(pool);
    await seed(pool);
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const gym = res.body.find((c) => c.categoryId === 'cat_1');
    expect(gym).toEqual({
      categoryId: 'cat_1',
      name: 'Gym Membership',
      description: 'Recurring monthly gym or fitness club membership fees',
    });
  });

  it('returns an empty array when there are no categories', async () => {
    await resetDb(pool);
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});