import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Lista ejercicios incorporados + propios del usuario
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, muscle_group, category, is_custom
    FROM exercises
    WHERE user_id IS NULL OR user_id = ?
    ORDER BY muscle_group, name
  `).all(req.user.id);
  res.json(rows);
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  const muscle_group = String(req.body.muscle_group || 'Otro').trim();
  const category = String(req.body.category || 'barra').trim();
  if (!name) return res.status(400).json({ error: 'Nombre obligatorio' });
  const info = db.prepare(
    'INSERT INTO exercises (user_id, name, muscle_group, category, is_custom) VALUES (?, ?, ?, ?, 1)'
  ).run(req.user.id, name, muscle_group, category);
  res.json({ id: info.lastInsertRowid, name, muscle_group, category, is_custom: 1 });
});

router.delete('/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM exercises WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!ex) return res.status(404).json({ error: 'No encontrado o no es tuyo' });
  db.prepare('DELETE FROM exercises WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
