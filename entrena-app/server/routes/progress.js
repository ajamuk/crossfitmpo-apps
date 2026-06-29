import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const e1rm = (w, r) => (r > 0 && w > 0 ? w * (1 + r / 30) : 0);

// Resumen general (dashboard)
router.get('/summary', (req, res) => {
  const uid = req.user.id;
  const total = db.prepare("SELECT COUNT(*) c FROM workouts WHERE user_id = ? AND finished_at IS NOT NULL").get(uid).c;
  const week = db.prepare(`
    SELECT COUNT(*) c FROM workouts
    WHERE user_id = ? AND finished_at IS NOT NULL AND started_at >= datetime('now','-7 days')
  `).get(uid).c;
  const month = db.prepare(`
    SELECT COUNT(*) c FROM workouts
    WHERE user_id = ? AND finished_at IS NOT NULL AND started_at >= datetime('now','-30 days')
  `).get(uid).c;
  const volume = db.prepare(`
    SELECT COALESCE(SUM(s.weight*s.reps),0) v FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
    WHERE w.user_id = ? AND s.set_type != 'warmup'
  `).get(uid).v;

  // Racha de semanas consecutivas con al menos 1 entreno
  const days = db.prepare(`
    SELECT DISTINCT date(started_at) d FROM workouts
    WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY d DESC
  `).all(uid).map(r => r.d);

  res.json({ total, week, month, volume: Math.round(volume), trained_days: days.length, last_days: days.slice(0, 60) });
});

// Días entrenados para el calendario (con tipo)
router.get('/calendar', (req, res) => {
  const rows = db.prepare(`
    SELECT date(started_at) date, type, COUNT(*) n
    FROM workouts WHERE user_id = ? AND finished_at IS NOT NULL
    GROUP BY date(started_at) ORDER BY date DESC
  `).all(req.user.id);
  res.json(rows);
});

// Series por grupo muscular (últimos N días)
router.get('/muscle-volume', (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 365);
  const rows = db.prepare(`
    SELECT e.muscle_group, COUNT(*) sets, COALESCE(SUM(s.weight*s.reps),0) volume
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
    JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.set_type != 'warmup'
      AND w.started_at >= datetime('now', ?)
    GROUP BY e.muscle_group ORDER BY sets DESC
  `).all(req.user.id, `-${days} days`);
  res.json(rows);
});

// Volumen semanal (tendencia)
router.get('/volume-trend', (req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%Y-%W', started_at) week,
           MIN(date(started_at)) week_start,
           COALESCE(SUM(s.weight*s.reps),0) volume,
           COUNT(DISTINCT w.id) workouts
    FROM workouts w
    JOIN workout_sets s ON s.workout_id = w.id AND s.set_type != 'warmup'
    WHERE w.user_id = ? AND w.finished_at IS NOT NULL
    GROUP BY week ORDER BY week DESC LIMIT 16
  `).all(req.user.id);
  res.json(rows.reverse());
});

// Progresión de un ejercicio (peso máx y 1RM estimado por sesión)
router.get('/exercise/:id', (req, res) => {
  const sets = db.prepare(`
    SELECT date(w.started_at) date, s.weight, s.reps
    FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
    WHERE w.user_id = ? AND s.exercise_id = ? AND s.set_type != 'warmup' AND w.finished_at IS NOT NULL
    ORDER BY w.started_at
  `).all(req.user.id, req.params.id);

  const byDate = new Map();
  for (const s of sets) {
    const cur = byDate.get(s.date) || { date: s.date, top_weight: 0, best_1rm: 0, volume: 0 };
    cur.top_weight = Math.max(cur.top_weight, s.weight);
    cur.best_1rm = Math.max(cur.best_1rm, e1rm(s.weight, s.reps));
    cur.volume += s.weight * s.reps;
    byDate.set(s.date, cur);
  }
  const series = [...byDate.values()].map(d => ({ ...d, best_1rm: Math.round(d.best_1rm * 10) / 10 }));
  res.json(series);
});

// Récords personales por ejercicio
router.get('/prs', (req, res) => {
  const sets = db.prepare(`
    SELECT s.exercise_id, e.name, e.muscle_group, s.weight, s.reps, date(w.started_at) date
    FROM workout_sets s
    JOIN workouts w ON w.id = s.workout_id
    JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ? AND s.set_type != 'warmup' AND w.finished_at IS NOT NULL
  `).all(req.user.id);

  const prs = new Map();
  for (const s of sets) {
    const cur = prs.get(s.exercise_id) || {
      exercise_id: s.exercise_id, name: s.name, muscle_group: s.muscle_group,
      best_weight: 0, best_weight_reps: 0, best_1rm: 0, best_1rm_date: null, best_volume_set: 0,
    };
    if (s.weight > cur.best_weight) { cur.best_weight = s.weight; cur.best_weight_reps = s.reps; }
    const est = e1rm(s.weight, s.reps);
    if (est > cur.best_1rm) { cur.best_1rm = est; cur.best_1rm_date = s.date; }
    cur.best_volume_set = Math.max(cur.best_volume_set, s.weight * s.reps);
    prs.set(s.exercise_id, cur);
  }
  const out = [...prs.values()]
    .map(p => ({ ...p, best_1rm: Math.round(p.best_1rm * 10) / 10 }))
    .sort((a, b) => b.best_1rm - a.best_1rm);
  res.json(out);
});

export default router;
