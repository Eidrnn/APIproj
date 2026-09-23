
Server · JS
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
 
const app = express();
const PORT = process.env.PORT || 3000;
const PLANS = ['free', 'monthly', 'annual'];
 
// ── DATABASE ──────────────────────────────────────────────────────────────
// A single SQLite file on disk — no separate database server to run.
// Good for a small app / prototype; swap for Postgres/MySQL if this ever
// needs to run across multiple server instances.
const db = new Database(path.join(__dirname, 'fitcoach.db'));
 
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan          TEXT NOT NULL DEFAULT 'free',
    subscribed_at TEXT,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
 
// Week 5 addition — non-destructive migration. ALTER TABLE ADD COLUMN only
// ever adds a column; it never touches existing rows or drops anything.
// Needed because the contract's expense-summary response requires
// monthlyAllowance and remaining, and the real users table didn't track
// an allowance until now.
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('monthly_allowance_kes')) {
  db.exec('ALTER TABLE users ADD COLUMN monthly_allowance_kes REAL');
}
 
// Week 5 additions — new tables for the fitness-expense contract.
// IF NOT EXISTS only: this never touches the existing users table.
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT
  );
 
  CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    category_id  INTEGER NOT NULL,
    amount       REAL NOT NULL,
    expense_date TEXT NOT NULL,
    description  TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`);
 
const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const getUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare(
  'INSERT INTO users (name, email, password_hash, plan, subscribed_at) VALUES (?, ?, ?, ?, ?)'
);
const updatePlan = db.prepare('UPDATE users SET plan = ?, subscribed_at = ? WHERE id = ?');
 
// Week 5 additions — prepared statements for the new tables.
const getAllUsers = db.prepare('SELECT id, name, email, monthly_allowance_kes FROM users');
const getAllCategories = db.prepare('SELECT * FROM categories');
const insertCategory = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
 
// Week 5 addition — one-time seed for static reference data. Only runs
// when the table is empty, so it never duplicates rows on restart and
// never touches user-submitted data.
if (getAllCategories.all().length === 0) {
  insertCategory.run('Gym Membership', 'Recurring monthly gym or fitness club membership fees');
  insertCategory.run('Equipment', 'One-off purchases of fitness gear or equipment');
  insertCategory.run('Nutrition', 'Supplements, meal plans, and fitness-related nutrition costs');
}
const getExpensesForUserMonth = db.prepare(
  `SELECT amount FROM expenses WHERE user_id = ? AND substr(expense_date, 1, 7) = ?`
);
 
function publicUser(row) {
  return { name: row.name, email: row.email, plan: row.plan, subscribedAt: row.subscribed_at };
}
 
// Week 5 addition — maps the real users table onto the openapi.yaml contract.
// Contract requires userId as a string; the DB's primary key is an integer,
// so String(row.id) is the mapping step, not decoration.
// monthlyAllowance is optional here on /users, so a NULL column value is
// simply omitted rather than sent as null.
function toContractUser(row) {
  const user = { userId: String(row.id), name: row.name, email: row.email };
  if (row.monthly_allowance_kes !== null && row.monthly_allowance_kes !== undefined) {
    user.monthlyAllowance = row.monthly_allowance_kes;
  }
  return user;
}
 
function toContractCategory(row) {
  return {
    categoryId: String(row.id),
    name: row.name,
    description: row.description,
  };
}
 
function currentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
 
// ── MIDDLEWARE ───────────────────────────────────────────────────────────
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-before-deploying',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);
app.use(express.static(path.join(__dirname, 'public')));
 
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  next();
}
 
// ── AUTH / ACCOUNT ROUTES ────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password, plan } = req.body || {};
 
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
 
  const normalizedEmail = String(email).trim().toLowerCase();
  if (getUserByEmail.get(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }
 
  const selectedPlan = PLANS.includes(plan) ? plan : 'free';
  const passwordHash = await bcrypt.hash(password, 10);
  const info = insertUser.run(
    String(name).trim(),
    normalizedEmail,
    passwordHash,
    selectedPlan,
    new Date().toISOString()
  );
 
  const user = getUserById.get(info.lastInsertRowid);
  req.session.userId = user.id;
  res.status(201).json({ user: publicUser(user) });
});
 
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
 
  const user = getUserByEmail.get(String(email).trim().toLowerCase());
  const match = user ? await bcrypt.compare(password, user.password_hash) : false;
 
  if (!user || !match) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
 
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});
 
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
 
app.get('/api/me', (req, res) => {
  const user = req.session.userId ? getUserById.get(req.session.userId) : null;
  res.json({ user: user ? publicUser(user) : null });
});
 
app.post('/api/subscribe', requireAuth, (req, res) => {
  const { plan } = req.body || {};
  if (!PLANS.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan.' });
  }
  updatePlan.run(plan, new Date().toISOString(), req.session.userId);
  const user = getUserById.get(req.session.userId);
  res.json({ user: publicUser(user) });
});
 
// ── WEEK 5: GET ENDPOINTS FROM openapi.yaml ─────────────────────────────
// Paths match the contract exactly (no /api prefix) — the partner team
// integrates against these paths as written in openapi.yaml.
 
// GET /users
app.get('/users', (req, res) => {
  const rows = getAllUsers.all();
  res.status(200).json(rows.map(toContractUser));
});
 
// GET /categories
app.get('/categories', (req, res) => {
  const rows = getAllCategories.all();
  res.status(200).json(rows.map(toContractCategory));
});
 
// GET /users/:userId/expenses/summary
app.get('/users/:userId/expenses/summary', (req, res) => {
  const { userId } = req.params;
  const month = req.query.month || currentMonthString();
 
  const userRow = getUserById.get(userId);
  if (!userRow) {
    return res.status(404).json({ error: `No user found with id ${userId}` });
  }
 
  const expenseRows = getExpensesForUserMonth.all(userId, month);
  const totalSpent = expenseRows.reduce((sum, row) => sum + row.amount, 0);
 
  // Contract marks monthlyAllowance and remaining as required here (unlike
  // on /users, where monthlyAllowance is optional), so a not-yet-set
  // allowance defaults to 0 rather than being left out or sent as null.
  const monthlyAllowance = userRow.monthly_allowance_kes ?? 0;
  const remaining = monthlyAllowance - totalSpent;
 
  res.status(200).json({
    userId: String(userRow.id),
    month,
    totalSpent,
    monthlyAllowance,
    remaining,
  });
});
 
app.listen(PORT, () => {
  console.log(`FitCoach server running at http://localhost:${PORT}`);
});
 
