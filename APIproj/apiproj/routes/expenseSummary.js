// routes/expenseSummary.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');

function currentMonthString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// GET /users/:userId/expenses/summary?month=YYYY-MM
router.get('/users/:userId/expenses/summary', (req, res) => {
  const { userId } = req.params;
  const month = req.query.month || currentMonthString();

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  // 404 case — contract requires an { error } body, not an empty response.
  if (!userRow) {
    return res.status(404).json({ error: `No user found with id ${userId}` });
  }

  // expense_date is stored as a full ISO string (e.g. 2026-09-07T10:00:00.000Z).
  // The contract's "month" is just the YYYY-MM prefix, so we match on that
  // rather than trying to parse full dates against each other.
  const expenseRows = db
    .prepare('SELECT amount_kes FROM expenses WHERE user_id = ? AND substr(expense_date, 1, 7) = ?')
    .all(userId, month);

  const totalSpent = expenseRows.reduce((sum, row) => sum + row.amount_kes, 0);
  const monthlyAllowance = userRow.monthly_allowance_kes;
  const remaining = monthlyAllowance - totalSpent;

  res.status(200).json({
    userId: userRow.id,
    month,
    totalSpent,
    monthlyAllowance,
    remaining,
  });
});

module.exports = router;
