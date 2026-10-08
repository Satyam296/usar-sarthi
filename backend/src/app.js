import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import internalRoutes from './routes/internal.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/internal', internalRoutes);
app.use(errorHandler);

export default app;