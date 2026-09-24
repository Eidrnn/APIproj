// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');

// --- mapping layer -----------------------------------------------------
// Contract requires: userId, name, email (monthlyAllowance is optional).
// DB gives us: id, full_name, email_address, monthly_allowance_kes,
// plus internal_notes, which the contract never mentions and must be
// dropped before it leaves the API.
function toContractUser(row) {
  return {
    userId: row.id,
    name: row.full_name,
    email: row.email_address,
    monthlyAllowance: row.monthly_allowance_kes,
    // internal_notes intentionally omitted — DB-only field
  };
}

// GET /users
router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT * FROM users').all();
  const users = rows.map(toContractUser);
  res.status(200).json(users);
});

module.exports = router;
