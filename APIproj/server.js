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

const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const getUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare(
  'INSERT INTO users (name, email, password_hash, plan, subscribed_at) VALUES (?, ?, ?, ?, ?)'
);
const updatePlan = db.prepare('UPDATE users SET plan = ?, subscribed_at = ? WHERE id = ?');

function publicUser(row) {
  return { name: row.name, email: row.email, plan: row.plan, subscribedAt: row.subscribed_at };
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

app.listen(PORT, () => {
  console.log(`FitCoach server running at http://localhost:${PORT}`);
});
