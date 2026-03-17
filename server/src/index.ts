import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { verifyAuth } from './middleware/auth.js';
import { parseRouter } from './routes/parse.js';
import { insightsRouter } from './routes/insights.js';
import { projectionRouter } from './routes/projection.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
}));
app.use(express.json({ limit: '1mb' }));

// API routes (auth-protected)
app.use('/api/parse', verifyAuth);
app.use('/api/insights', verifyAuth);
app.use('/api/projection-settings', verifyAuth);
app.use('/api', parseRouter);
app.use('/api', insightsRouter);
app.use('/api', projectionRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

// Usage dashboard (standalone page)
const dashboardHtml = path.join(__dirname, '../src/dashboard/index.html');
app.get('/dashboard', (_req, res) => {
  res.sendFile(dashboardHtml);
});

// In production, serve the built client
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Global error handler — prevents stack traces leaking to clients
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`MindPlan server running on http://localhost:${PORT}`);
});
