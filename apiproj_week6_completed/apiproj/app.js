// app.js
const express = require('express');
const app = express();
app.use(express.json());

// Week 6: write endpoints with validation and real state changes.
app.use(require('./routes/users'));
app.use(require('./routes/categories'));
app.use(require('./routes/expenseSummary'));
app.use(require('./routes/expenses'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FitCoach API listening on http://localhost:${PORT}`);
});

module.exports = app;
