import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import exerciseRoutes from './routes/exercises.js';
import routineRoutes from './routes/routines.js';
import workoutRoutes from './routes/workouts.js';
import progressRoutes from './routes/progress.js';
import bodyRoutes from './routes/body.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/body', bodyRoutes);

// Frontend estático (PWA)
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// SPA fallback (cualquier ruta no-API devuelve el index)
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Entrena escuchando en http://0.0.0.0:${PORT}`);
});
