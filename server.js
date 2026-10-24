require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors()); // CORS must come BEFORE the key check so browser preflights work
app.use(express.json());

// ---------- API key check (protects everything below) ----------
// API_KEYS in .env: one key, or several separated by commas (one per partner)
const validKeys = (process.env.API_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

function requireApiKey(req, res, next) {
  const key = req.get('X-API-Key');
  const ok =
    key &&
    validKeys.some(
      (k) => k.length === key.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(key))
    );
  if (!ok) return res.status(401).json({ error: 'Missing or invalid API key' });
  next();
}
app.use(requireApiKey);

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
// PARTNER_URL and PARTNER_API_KEY live in .env. Change PARTNER_PATH and the header
// name to match THEIR README/contract.
const PARTNER_URL = process.env.PARTNER_URL;
const PARTNER_KEY = process.env.PARTNER_API_KEY;
const PARTNER_PATH = '/REPLACE_WITH_PARTNER_PATH';
const PARTNER_HEADER = 'X-API-Key';

app.get('/partner-data', async (req, res) => {
  try {
    const r = await fetch(`${PARTNER_URL}${PARTNER_PATH}`, {
      headers: { [PARTNER_HEADER]: PARTNER_KEY },
    });
    if (!r.ok) {
      console.error('partner returned', r.status); // log the status, never the key
      return res.status(502).json({ message: 'Partner data unavailable' });
    }
    const data = await r.json();
    console.log(data); // TEMPORARY: look at the real shape, then delete this line
    // Later: map to only the fields your page needs, using THEIR contract's names
    res.json(data);
  } catch (err) {
    console.error('partner call failed:', err.cause?.code || err.message);
    res.status(502).json({ message: 'Partner data unavailable' });
  }
});

// Malformed JSON bodies get a JSON 400 instead of an HTML error page
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'request body is not valid JSON' });
  }
  next(err);
});

app.locals.pool = pool;

const port = process.env.PORT || 8080;
if (require.main === module) {
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}

module.exports = app;