function errorHandler(err, req, res, _next) {
  console.error('[Error]', err.stack || err.message || err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error.',
  });
}

module.exports = errorHandler;
