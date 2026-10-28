require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.disable('x-powered-by'); // don't advertise the framework
app.use(cors()); // CORS must come BEFORE the key check so browser preflights work
app.use(express.json());

// ---------- API key check (protects everything below) ----------
// API_KEYS in .env: one key per consumer, separated by commas. Optionally name each
// key as name:key (keys are hex, so ":" is safe), e.g. partner:abc123,team:def456.
// Unnamed keys are called consumer1, consumer2, ...
const consumers = (process.env.API_KEYS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry, i) => {
    const idx = entry.indexOf(':');
    return idx === -1
      ? { name: `consumer${i + 1}`, key: entry }
      : { name: entry.slice(0, idx), key: entry.slice(idx + 1) };
  });

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function requireApiKey(req, res, next) {
  // /partner-data is public on purpose (see SECURITY_AUDIT.md): it returns only public
  // campus-event data, and the demo page can't hold a key without leaking it.
  if (req.path === '/partner-data') return next();

  const sent = req.get('X-API-Key');
  const match = sent && consumers.find((c) => safeEqual(c.key, sent));
  if (!match) return res.status(401).json({ error: 'Missing or invalid API key' });

  req.consumer = match.name; // who is calling (never the key itself)
  next();
}

// In-memory limiter: counts requests per consumer (per IP for public routes) per window
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // id -> { count, resetAt }
  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of hits) if (now >= entry.resetAt) hits.delete(id);
  }, windowMs).unref();

  return (req, res, next) => {
    const id = req.consumer || req.ip;
    const now = Date.now();
    let entry = hits.get(id);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests', retryAfter });
    }
    next();
  };
}

// 100 requests per minute per consumer. Set RATE_LIMIT_MAX in .env to change it
// (for example 3, to demonstrate a 429), then restart the server.
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 100;

app.use(express.static('web')); // demo page, served without a key
app.use(requireApiKey);
app.use(rateLimit({ windowMs: 60000, max: RATE_LIMIT_MAX }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
});

// GET /categories
app.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories');
    // Mapping step: DB shape -> contract shape
    const result = rows.map((r) => ({
      categoryId: 'cat_' + r.category_id,
      name: r.name,
      description: r.description,
    }));
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Contract IDs look like "usr_1"; the database stores plain integers
function parseUserId(raw) {
  const match = /^usr_(\d+)$/.exec(raw);
  return match ? Number(match[1]) : null;
}

// GET /users
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    const result = rows.map((r) => ({
      userId: 'usr_' + r.user_id,
      name: r.full_name,
      email: r.email,
      monthlyAllowance: Number(r.monthly_allowance), // DECIMAL arrives as a string
    }));
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/{userId}
app.get('/users/:userId', async (req, res) => {
  try {
    const id = parseUserId(req.params.userId);
    const [rows] =
      id === null
        ? [[]]
        : await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: `No user found with id ${req.params.userId}` });
    }

    const r = rows[0];
    res.status(200).json({
      userId: 'usr_' + r.user_id,
      name: r.full_name,
      email: r.email,
      monthlyAllowance: Number(r.monthly_allowance),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/{userId}/expenses/summary
app.get('/users/:userId/expenses/summary', async (req, res) => {
  try {
    const dbId = parseUserId(req.params.userId);
    const [users] =
      dbId === null
        ? [[]]
        : await pool.query('SELECT * FROM users WHERE user_id = ?', [dbId]);

    if (users.length === 0) {
      return res
        .status(404)
        .json({ error: `No user found with id ${req.params.userId}` });
    }

    // month defaults to the current month
    let month = req.query.month;
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ error: 'month must be formatted as YYYY-MM' });
    }

    const start = `${month}-01`;
    const [sums] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id = ?
         AND expense_date >= ?
         AND expense_date < DATE_ADD(?, INTERVAL 1 MONTH)`,
      [dbId, start, start]
    );

    const totalSpent = Number(sums[0].total);
    const monthlyAllowance = Number(users[0].monthly_allowance);

    res.status(200).json({
      userId: req.params.userId,
      month,
      totalSpent,
      monthlyAllowance,
      remaining: monthlyAllowance - totalSpent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Helpers ----------
function parseId(raw, prefix) {
  if (typeof raw !== 'string') return null;
  const m = new RegExp(`^${prefix}_(\\d+)$`).exec(raw);
  return m ? Number(m[1]) : null;
}

function mapExpense(r) {
  return {
    expenseId: 'exp_' + r.expense_id,
    userId: 'usr_' + r.user_id,
    categoryId: 'cat_' + r.category_id,
    amount: Number(r.amount),
    date: new Date(r.expense_date).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    ...(r.description !== null && { description: r.description }),
  };
}

// Returns an error message, or null if the body is valid
function validateExpense(body, partial) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'request body must be a JSON object';
  }
  if (!partial) {
    for (const f of ['userId', 'categoryId', 'amount', 'date']) {
      if (body[f] === undefined) return `${f} is required`;
    }
    if (parseId(body.userId, 'usr') === null) return 'userId must be a string like "usr_1"';
  } else if (!['categoryId', 'amount', 'date', 'description'].some((f) => body[f] !== undefined)) {
    return 'provide at least one field to update';
  }
  if (body.categoryId !== undefined && parseId(body.categoryId, 'cat') === null) {
    return 'categoryId must be a string like "cat_1"';
  }
  if (body.amount !== undefined &&
      (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0)) {
    return 'amount is required and must be a positive number';
  }
  if (body.date !== undefined &&
      (typeof body.date !== 'string' || Number.isNaN(Date.parse(body.date)))) {
    return 'date must be a valid date-time string';
  }
  if (body.description !== undefined &&
      (typeof body.description !== 'string' || body.description.length > 255)) {
    return 'description must be a string of at most 255 characters';
  }
  return null;
}

async function categoryExists(id) {
  const [rows] = await pool.query('SELECT 1 FROM categories WHERE category_id = ?', [id]);
  return rows.length > 0;
}

// ---------- POST /expenses ----------
app.post('/expenses', async (req, res) => {
  try {
    const err = validateExpense(req.body, false);
    if (err) return res.status(400).json({ error: err });

    const { userId, categoryId, amount, date, description } = req.body;
    const uid = parseId(userId, 'usr');
    const cid = parseId(categoryId, 'cat');

    const [users] = await pool.query('SELECT 1 FROM users WHERE user_id = ?', [uid]);
    if (users.length === 0) return res.status(400).json({ error: `userId ${userId} does not exist` });
    if (!(await categoryExists(cid))) return res.status(400).json({ error: `categoryId ${categoryId} does not exist` });

    const [result] = await pool.query(
      'INSERT INTO expenses (user_id, category_id, amount, expense_date, description) VALUES (?, ?, ?, ?, ?)',
      [uid, cid, amount, new Date(date), description ?? null]
    );
    const [rows] = await pool.query('SELECT * FROM expenses WHERE expense_id = ?', [result.insertId]);
    res.status(201).json(mapExpense(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- PUT /expenses/:expenseId (partial update, as your contract describes) ----------
app.put('/expenses/:expenseId', async (req, res) => {
  try {
    const err = validateExpense(req.body, true);
    if (err) return res.status(400).json({ error: err });

    const id = parseId(req.params.expenseId, 'exp');
    const [existing] = id === null ? [[]] : await pool.query('SELECT * FROM expenses WHERE expense_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: `No expense found with id ${req.params.expenseId}` });
    }

    const { categoryId, amount, date, description } = req.body;
    const fields = [];
    const values = [];
    if (categoryId !== undefined) {
      const cid = parseId(categoryId, 'cat');
      if (!(await categoryExists(cid))) return res.status(400).json({ error: `categoryId ${categoryId} does not exist` });
      fields.push('category_id = ?'); values.push(cid);
    }
    if (amount !== undefined) { fields.push('amount = ?'); values.push(amount); }
    if (date !== undefined) { fields.push('expense_date = ?'); values.push(new Date(date)); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }

    await pool.query(`UPDATE expenses SET ${fields.join(', ')} WHERE expense_id = ?`, [...values, id]);
    const [rows] = await pool.query('SELECT * FROM expenses WHERE expense_id = ?', [id]);
    res.status(200).json(mapExpense(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- DELETE /expenses/:expenseId ----------
app.delete('/expenses/:expenseId', async (req, res) => {
  try {
    const id = parseId(req.params.expenseId, 'exp');
    const [result] = id === null
      ? [{ affectedRows: 0 }]
      : await pool.query('DELETE FROM expenses WHERE expense_id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `No expense found with id ${req.params.expenseId}` });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Week 10: call the upstream partner's API (server-side only) ----------
// CampusCore (our upstream partner) is documented in their README and contract.
// PARTNER_URL lives in .env. Their contract defines no auth, so a key is optional.
const PARTNER_URL = process.env.PARTNER_URL;
const PARTNER_KEY = process.env.PARTNER_API_KEY;
const PARTNER_PATH = '/events';

app.get('/partner-data', async (req, res) => {
  try {
    const headers = {};
    if (PARTNER_KEY) headers['X-API-Key'] = PARTNER_KEY;

    const r = await fetch(`${PARTNER_URL}${PARTNER_PATH}`, { headers });
    if (!r.ok) {
      console.error('partner returned', r.status); // log the status, never a key
      return res.status(502).json({ message: 'Partner data unavailable' });
    }

    const data = await r.json();

    // Shape check: their contract says { events: [...] }
    if (!data || !Array.isArray(data.events)) {
      console.error('partner response has no events array');
      return res.status(502).json({ message: 'Partner data unavailable' });
    }

    // Use THEIR field names (snake_case); return only what our page needs
    res.json(
      data.events.map((e) => ({
        title: typeof e.title === 'string' ? e.title.trim() : '',
        location: e.location,
        startTime: e.start_time,
      }))
    );
  } catch (err) {
    console.error('partner call failed:', err.cause?.code || err.message);
    res.status(502).json({ message: 'Partner data unavailable' });
  }
});

// Unknown routes get a JSON 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Malformed JSON bodies get a JSON 400 instead of an HTML error page
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'request body is not valid JSON' });
  }
  next(err);
});

// Last resort: never send a stack trace, file path, or query to the caller
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : 'Request could not be processed',
  });
});

app.locals.pool = pool;

const port = process.env.PORT || 8080;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`${consumers.length} API key(s) loaded, rate limit ${RATE_LIMIT_MAX}/min`); // count only, never the keys
  });
}

module.exports = app;