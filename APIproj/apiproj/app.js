// app.js
const express = require('express');
const app = express();
app.use(express.json());

// Today's scope: GET endpoints only, per Week 5 lab.
// POST /expenses, PUT /expenses/{expenseId}, DELETE /expenses/{expenseId}
// are next week — not wired up here.
app.use(require('./routes/users'));
app.use(require('./routes/categories'));
app.use(require('./routes/expenseSummary'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FitCoach API listening on http://localhost:${PORT}`);
});

module.exports = app;
