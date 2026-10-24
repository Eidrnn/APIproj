// test-utils/seed.js
async function resetDb(pool) {
  // Safety check: never wipe anything except the test database
  const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
  if (db !== 'fitcoach_test') {
    throw new Error(`Refusing to wipe "${db}" - tests must run against fitcoach_test`);
  }
  await pool.query('DELETE FROM expenses');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM categories');
}

async function seed(pool) {
  await pool.query(
    'INSERT INTO categories (category_id, name, description) VALUES ?',
    [[
      [1, 'Gym Membership', 'Recurring monthly gym or fitness club membership fees'],
      [2, 'Equipment', 'Fitness gear such as resistance bands and weights'],
    ]]
  );
  await pool.query(
    'INSERT INTO users (user_id, full_name, email, monthly_allowance) VALUES ?',
    [[
      [1, 'Wanjiru Kamau', 'wanjiru.kamau@example.com', 8000],
      [2, 'Brian Otieno', 'brian.otieno@example.com', 5000],
    ]]
  );
  await pool.query(
    'INSERT INTO expenses (expense_id, user_id, category_id, amount, expense_date, description) VALUES ?',
    [[
      [1, 1, 1, 1500, '2026-09-07 10:00:00', 'September gym membership renewal'],
      [2, 1, 2, 2200, '2026-09-15 09:30:00', 'Resistance bands'],
      [3, 1, 1, 999,  '2026-08-20 08:00:00', 'August membership'],
      [4, 1, 2, 300,  '2026-09-30 23:59:59', 'Last second of September'],
      [5, 1, 1, 700,  '2026-10-01 00:00:00', 'First moment of October'],
    ]]
  );
}

module.exports = { resetDb, seed };