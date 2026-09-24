// routes/expenses.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');

function toContractExpense(row) {
  return {
    expenseId: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    amount: row.amount_kes,
    date: row.expense_date,
    description: row.notes,
  };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isValidDateTime(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && value.includes('T');
}

function getNextExpenseId() {
  const row = db.prepare(`
    SELECT id FROM expenses
    WHERE id LIKE 'exp_%'
    ORDER BY CAST(substr(id, 5) AS INTEGER) DESC
    LIMIT 1
  `).get();

  const nextNumber = row ? Number(row.id.slice(4)) + 1 : 1;
  return `exp_${nextNumber}`;
}

// POST /expenses
router.post('/expenses', (req, res) => {
  const { userId, categoryId, amount, date, description } = req.body || {};

  if (!isNonEmptyString(userId) || !isNonEmptyString(categoryId) ||
      !isPositiveNumber(amount) || !isValidDateTime(date)) {
    return res.status(400).json({
      error: 'userId and categoryId are required strings, amount must be a positive number, and date must be a valid date-time',
    });
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be a string' });
  }

  const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  const categoryExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);

  if (!userExists) {
    return res.status(400).json({ error: `No user found with id ${userId}` });
  }

  if (!categoryExists) {
    return res.status(400).json({ error: `No category found with id ${categoryId}` });
  }

  const expenseId = getNextExpenseId();
  db.prepare(`
    INSERT INTO expenses (id, user_id, category_id, amount_kes, expense_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(expenseId, userId, categoryId, amount, new Date(date).toISOString(), description ?? null);

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
  return res.status(201).json(toContractExpense(created));
});

// PUT /expenses/:expenseId
router.put('/expenses/:expenseId', (req, res) => {
  const { expenseId } = req.params;
  const { categoryId, amount, date, description } = req.body || {};

  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);

  if (!existing) {
    return res.status(404).json({ error: `No expense found with id ${expenseId}` });
  }

  if (categoryId === undefined && amount === undefined && date === undefined && description === undefined) {
    return res.status(400).json({ error: 'At least one field must be supplied for update' });
  }

  if (categoryId !== undefined && !isNonEmptyString(categoryId)) {
    return res.status(400).json({ error: 'categoryId must be a non-empty string' });
  }

  if (amount !== undefined && !isPositiveNumber(amount)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  if (date !== undefined && !isValidDateTime(date)) {
    return res.status(400).json({ error: 'date must be a valid date-time' });
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be a string' });
  }

  if (categoryId !== undefined) {
    const categoryExists = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!categoryExists) {
      return res.status(400).json({ error: `No category found with id ${categoryId}` });
    }
  }

  const updatedCategoryId = categoryId !== undefined ? categoryId : existing.category_id;
  const updatedAmount = amount !== undefined ? amount : existing.amount_kes;
  const updatedDate = date !== undefined ? new Date(date).toISOString() : existing.expense_date;
  const updatedDescription = description !== undefined ? description : existing.notes;

  db.prepare(`
    UPDATE expenses
    SET category_id = ?, amount_kes = ?, expense_date = ?, notes = ?
    WHERE id = ?
  `).run(updatedCategoryId, updatedAmount, updatedDate, updatedDescription, expenseId);

  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
  return res.status(200).json(toContractExpense(updated));
});

// DELETE /expenses/:expenseId
router.delete('/expenses/:expenseId', (req, res) => {
  const { expenseId } = req.params;

  const existing = db.prepare('SELECT id FROM expenses WHERE id = ?').get(expenseId);

  if (!existing) {
    return res.status(404).json({ error: `No expense found with id ${expenseId}` });
  }

  const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);

  if (result.changes !== 1) {
    return res.status(404).json({ error: `No expense found with id ${expenseId}` });
  }

  return res.status(204).send();
});

module.exports = router;
