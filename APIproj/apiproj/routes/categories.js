// routes/categories.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');

// Contract requires: categoryId, name (description is optional).
// DB gives us: id, category_name, category_desc.
function toContractCategory(row) {
  return {
    categoryId: row.id,
    name: row.category_name,
    description: row.category_desc,
  };
}

// GET /categories
router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories').all();
  const categories = rows.map(toContractCategory);
  res.status(200).json(categories);
});

module.exports = router;
