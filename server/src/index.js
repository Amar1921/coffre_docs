import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { pool } from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import memberRoutes from './routes/members.routes.js';
import documentRoutes from './routes/documents.routes.js';
import shareRoutes from './routes/shares.routes.js';
import miscRoutes from './routes/misc.routes.js';

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin(origin, cb) {
    if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origine non autorisée par CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'coffre-famille', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'DB indisponible' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api', miscRoutes);

// 404 API
app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable.' }));

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Fichier trop volumineux (max ${config.maxFileSizeMb} Mo).` });
  }
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Erreur serveur.' });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Coffre-famille API sur http://127.0.0.1:${config.port} (${config.env})`);
});
