import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM body_log WHERE user_id = ? ORDER BY date DESC').all(req.user.id);
  res.json(rows);
});

router.post('/', (req, res) => {
  const date = String(req.body.date || new Date().toISOString().slice(0, 10));
  const num = v => (v === '' || v == null ? null : Number(v));
  const info = db.prepare(`
    INSERT INTO body_log (user_id, date, bodyweight, waist, chest, arm, thigh, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, date, num(req.body.bodyweight), num(req.body.waist),
    num(req.body.chest), num(req.body.arm), num(req.body.thigh),
    req.body.notes ? String(req.body.notes) : null);
  res.json(db.prepare('SELECT * FROM body_log WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM body_log WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

export default router;
