export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error(error);
  const status = error.name === 'MulterError' ? 400 : (error.status || 500);
  const message = status === 500 ? 'An unexpected server error occurred.' : error.message;
  return res.status(status).json({ message });
}