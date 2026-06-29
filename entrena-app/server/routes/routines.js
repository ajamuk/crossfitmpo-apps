import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

function loadRoutine(id, userId) {
  const routine = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(id, userId);
  if (!routine) return null;
  routine.exercises = db.prepare(`
    SELECT re.id, re.exercise_id, re.position, re.target_sets, re.target_reps, re.rest_seconds,
           e.name, e.muscle_group, e.category
    FROM routine_exercises re
    JOIN exercises e ON e.id = re.exercise_id
    WHERE re.routine_id = ?
    ORDER BY re.position
  `).all(id);
  return routine;
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  for (const r of rows) {
    r.exercise_count = db.prepare('SELECT COUNT(*) c FROM routine_exercises WHERE routine_id = ?').get(r.id).c;
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const routine = loadRoutine(req.params.id, req.user.id);
  if (!routine) return res.status(404).json({ error: 'No encontrada' });
  res.json(routine);
});

const saveExercises = db.transaction((routineId, exercises) => {
  db.prepare('DELETE FROM routine_exercises WHERE routine_id = ?').run(routineId);
  const ins = db.prepare(`
    INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, target_reps, rest_seconds)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  (exercises || []).forEach((ex, i) => {
    ins.run(routineId, ex.exercise_id, i, ex.target_sets || 3, String(ex.target_reps || '8-12'), ex.rest_seconds || 120);
  });
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre obligatorio' });
  const type = String(req.body.type || 'hipertrofia');
  const notes = req.body.notes ? String(req.body.notes) : null;
  const info = db.prepare('INSERT INTO routines (user_id, name, type, notes) VALUES (?, ?, ?, ?)')
    .run(req.user.id, name, type, notes);
  saveExercises(info.lastInsertRowid, req.body.exercises);
  res.json(loadRoutine(info.lastInsertRowid, req.user.id));
});

router.put('/:id', (req, res) => {
  const routine = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!routine) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE routines SET name = ?, type = ?, notes = ? WHERE id = ?').run(
    String(req.body.name || routine.name),
    String(req.body.type || routine.type),
    req.body.notes != null ? String(req.body.notes) : routine.notes,
    routine.id
  );
  if (req.body.exercises) saveExercises(routine.id, req.body.exercises);
  res.json(loadRoutine(routine.id, req.user.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'No encontrada' });
  res.json({ ok: true });
});

export default router;
