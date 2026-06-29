import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// 1RM estimado (fórmula de Epley)
const e1rm = (w, r) => (r > 0 && w > 0 ? w * (1 + r / 30) : 0);

function summarize(workout) {
  const sets = db.prepare(`
    SELECT s.*, e.name, e.muscle_group, e.category
    FROM workout_sets s JOIN exercises e ON e.id = s.exercise_id
    WHERE s.workout_id = ? ORDER BY s.position, s.set_number
  `).all(workout.id);
  let volume = 0, totalSets = 0, totalReps = 0;
  for (const s of sets) {
    if (s.set_type !== 'warmup') {
      volume += s.weight * s.reps;
      totalSets++;
      totalReps += s.reps;
    }
  }
  return { ...workout, sets, volume, total_sets: totalSets, total_reps: totalReps };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 200').all(req.user.id);
  res.json(rows.map(w => {
    const agg = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN set_type!='warmup' THEN weight*reps ELSE 0 END),0) volume,
             COUNT(DISTINCT exercise_id) exercises,
             SUM(CASE WHEN set_type!='warmup' THEN 1 ELSE 0 END) sets
      FROM workout_sets WHERE workout_id = ?
    `).get(w.id);
    return { ...w, ...agg };
  }));
});

router.get('/:id', (req, res) => {
  const w = db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!w) return res.status(404).json({ error: 'No encontrado' });
  res.json(summarize(w));
});

// Última vez que se hizo un ejercicio (para autocompletar) + mejor 1RM histórico (para PRs)
router.get('/last/:exerciseId', (req, res) => {
  const exId = req.params.exerciseId;
  const lastWorkout = db.prepare(`
    SELECT w.id, w.started_at FROM workouts w
    JOIN workout_sets s ON s.workout_id = w.id
    WHERE w.user_id = ? AND s.exercise_id = ? AND w.finished_at IS NOT NULL
    ORDER BY w.started_at DESC LIMIT 1
  `).get(req.user.id, exId);

  let lastSets = [];
  if (lastWorkout) {
    lastSets = db.prepare(`
      SELECT set_number, set_type, weight, reps, rpe
      FROM workout_sets WHERE workout_id = ? AND exercise_id = ?
      ORDER BY set_number
    `).all(lastWorkout.id, exId);
  }

  const allSets = db.prepare(`
    SELECT s.weight, s.reps FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
    WHERE w.user_id = ? AND s.exercise_id = ? AND s.set_type != 'warmup'
  `).all(req.user.id, exId);
  let bestWeight = 0, best1rm = 0;
  for (const s of allSets) {
    if (s.weight > bestWeight) bestWeight = s.weight;
    const est = e1rm(s.weight, s.reps);
    if (est > best1rm) best1rm = est;
  }

  res.json({
    last_date: lastWorkout ? lastWorkout.started_at : null,
    last_sets: lastSets,
    best_weight: bestWeight,
    best_1rm: Math.round(best1rm * 10) / 10,
  });
});

// Guarda un entrenamiento completo (entrante: { name, type, notes, started_at, duration_seconds, routine_id, exercises:[{exercise_id, sets:[{set_type,weight,reps,rpe}]}] })
const saveWorkout = db.transaction((userId, body) => {
  const info = db.prepare(`
    INSERT INTO workouts (user_id, routine_id, name, type, notes, started_at, finished_at, duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `).run(
    userId,
    body.routine_id || null,
    String(body.name || 'Entrenamiento'),
    String(body.type || 'hipertrofia'),
    body.notes ? String(body.notes) : null,
    body.started_at || new Date().toISOString(),
    Number(body.duration_seconds) || 0
  );
  const workoutId = info.lastInsertRowid;
  const ins = db.prepare(`
    INSERT INTO workout_sets (workout_id, exercise_id, position, set_number, set_type, weight, reps, rpe, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  (body.exercises || []).forEach((ex, pos) => {
    (ex.sets || []).forEach((s, i) => {
      if ((Number(s.weight) || 0) === 0 && (Number(s.reps) || 0) === 0) return; // ignora sets vacíos
      ins.run(workoutId, ex.exercise_id, pos, i + 1, s.set_type || 'normal',
        Number(s.weight) || 0, Number(s.reps) || 0, s.rpe != null && s.rpe !== '' ? Number(s.rpe) : null);
    });
  });
  return workoutId;
});

router.post('/', (req, res) => {
  if (!req.body.exercises || !req.body.exercises.length) {
    return res.status(400).json({ error: 'El entrenamiento no tiene ejercicios' });
  }
  const id = saveWorkout(req.user.id, req.body);
  const w = db.prepare('SELECT * FROM workouts WHERE id = ?').get(id);
  res.json(summarize(w));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

export default router;
