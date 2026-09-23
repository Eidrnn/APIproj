// db/init.js
// Creates the SQLite file and seeds it with sample data.
// Run once with: node db/init.js
//
// NOTE: table columns are named the way a real schema tends to evolve
// (snake_case, internal-only fields, raw timestamps) — NOT the way the
// contract names them. That mismatch is intentional: it's what Part B
// of the lab is asking you to map away from in your route handlers.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'fitcoach.db'));

db.exec(`
  DROP TABLE IF EXISTS expenses;
  DROP TABLE IF EXISTS categories;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email_address TEXT NOT NULL,
    monthly_allowance_kes REAL,
    internal_notes TEXT            -- DB-only column, must never leave the API
  );

  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    category_name TEXT NOT NULL,
    category_desc TEXT
  );

  CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount_kes REAL NOT NULL,
    expense_date TEXT NOT NULL,    -- stored as ISO string with ms + Z
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`);

const insertUser = db.prepare(`
  INSERT INTO users (id, full_name, email_address, monthly_allowance_kes, internal_notes)
  VALUES (?, ?, ?, ?, ?)
`);
insertUser.run('usr_1042', 'Wanjiru Kamau', 'wanjiru.kamau@example.com', 8000, 'flagged for review 2026-08');
insertUser.run('usr_1077', 'Brian Otieno', 'brian.otieno@example.com', 5000, null);
insertUser.run('usr_1103', 'Amina Hassan', 'amina.hassan@example.com', 12000, null);

const insertCategory = db.prepare(`
  INSERT INTO categories (id, category_name, category_desc)
  VALUES (?, ?, ?)
`);
insertCategory.run('cat_gym', 'Gym Membership', 'Recurring monthly gym or fitness club membership fees');
insertCategory.run('cat_equipment', 'Equipment', 'One-off purchases of fitness gear or equipment');
insertCategory.run('cat_nutrition', 'Nutrition', 'Supplements, meal plans, and fitness-related nutrition costs');

const insertExpense = db.prepare(`
  INSERT INTO expenses (id, user_id, category_id, amount_kes, expense_date, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertExpense.run('exp_5231', 'usr_1042', 'cat_gym', 1500, '2026-09-07T10:00:00.000Z', 'September gym membership renewal');
insertExpense.run('exp_5232', 'usr_1042', 'cat_equipment', 2200, '2026-09-12T14:30:00.000Z', 'Resistance bands purchase');
insertExpense.run('exp_5233', 'usr_1077', 'cat_gym', 1000, '2026-09-03T08:00:00.000Z', null);

console.log('fitcoach.db created and seeded.');
db.close();
