import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { parseRouter } from './routes/parse.js';
import { insightsRouter } from './routes/insights.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
}));
app.use(express.json({ limit: '50kb' }));

// API routes
app.use('/api', parseRouter);
app.use('/api', insightsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

// In production, serve the built client
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MindPlan server running on http://localhost:${PORT}`);
});
