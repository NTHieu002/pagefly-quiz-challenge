require('dotenv').config();

const path = require('path');
const express = require('express');

const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/', indexRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

app.use((err, req, res, _next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).render('error', { message: 'Something went wrong on our end.' });
});

const port = parseInt(process.env.PORT, 10) || 3001;
app.listen(port, '127.0.0.1', () => {
  console.log(`[server] quiz-challenge listening on http://127.0.0.1:${port}`);
});
