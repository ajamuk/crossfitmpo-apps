import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// La BD vive fuera de /server para poder montarla como volumen en el VPS.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'entrena.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'kg',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercises (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = global / built-in
  name         TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'barra',  -- barra, mancuerna, maquina, polea, peso corporal, kettlebell
  is_custom    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS routines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'hipertrofia',
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id   INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  target_sets  INTEGER NOT NULL DEFAULT 3,
  target_reps  TEXT NOT NULL DEFAULT '8-12',
  rest_seconds INTEGER NOT NULL DEFAULT 120
);

CREATE TABLE IF NOT EXISTS workouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id  INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'hipertrofia',
  notes       TEXT,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  set_number  INTEGER NOT NULL DEFAULT 1,
  set_type    TEXT NOT NULL DEFAULT 'normal', -- warmup, normal, drop, fallo
  weight      REAL NOT NULL DEFAULT 0,
  reps        INTEGER NOT NULL DEFAULT 0,
  rpe         REAL,
  completed   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS body_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  bodyweight REAL,
  waist      REAL,
  chest      REAL,
  arm        REAL,
  thigh      REAL,
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_workouts_user   ON workouts(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sets_workout     ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise    ON workout_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercises_user   ON exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_body_user        ON body_log(user_id, date);
`);

// ---- Biblioteca de ejercicios incorporada (fuerza / hipertrofia) ----
const BUILTIN_EXERCISES = [
  // Pecho
  ['Press de banca', 'Pecho', 'barra'],
  ['Press inclinado con barra', 'Pecho', 'barra'],
  ['Press de banca con mancuernas', 'Pecho', 'mancuerna'],
  ['Press inclinado con mancuernas', 'Pecho', 'mancuerna'],
  ['Aperturas con mancuernas', 'Pecho', 'mancuerna'],
  ['Cruce de poleas', 'Pecho', 'polea'],
  ['Press en máquina (pecho)', 'Pecho', 'maquina'],
  ['Fondos en paralelas', 'Pecho', 'peso corporal'],
  // Espalda
  ['Peso muerto', 'Espalda', 'barra'],
  ['Peso muerto rumano', 'Espalda', 'barra'],
  ['Remo con barra', 'Espalda', 'barra'],
  ['Remo con mancuerna', 'Espalda', 'mancuerna'],
  ['Dominadas', 'Espalda', 'peso corporal'],
  ['Jalón al pecho', 'Espalda', 'polea'],
  ['Remo en polea baja', 'Espalda', 'polea'],
  ['Pull-over en polea', 'Espalda', 'polea'],
  // Pierna
  ['Sentadilla', 'Pierna', 'barra'],
  ['Sentadilla frontal', 'Pierna', 'barra'],
  ['Prensa de pierna', 'Pierna', 'maquina'],
  ['Zancadas con mancuernas', 'Pierna', 'mancuerna'],
  ['Extensión de cuádriceps', 'Pierna', 'maquina'],
  ['Curl femoral', 'Pierna', 'maquina'],
  ['Hip thrust', 'Pierna', 'barra'],
  ['Elevación de gemelos', 'Pierna', 'maquina'],
  ['Sentadilla búlgara', 'Pierna', 'mancuerna'],
  // Hombro
  ['Press militar', 'Hombro', 'barra'],
  ['Press de hombro con mancuernas', 'Hombro', 'mancuerna'],
  ['Elevaciones laterales', 'Hombro', 'mancuerna'],
  ['Pájaros (posterior)', 'Hombro', 'mancuerna'],
  ['Face pull', 'Hombro', 'polea'],
  // Bíceps
  ['Curl con barra', 'Bíceps', 'barra'],
  ['Curl con mancuernas', 'Bíceps', 'mancuerna'],
  ['Curl martillo', 'Bíceps', 'mancuerna'],
  ['Curl en polea', 'Bíceps', 'polea'],
  // Tríceps
  ['Press francés', 'Tríceps', 'barra'],
  ['Extensión en polea', 'Tríceps', 'polea'],
  ['Press cerrado', 'Tríceps', 'barra'],
  ['Fondos en banco', 'Tríceps', 'peso corporal'],
  // Core
  ['Plancha', 'Core', 'peso corporal'],
  ['Crunch en polea', 'Core', 'polea'],
  ['Elevación de piernas colgado', 'Core', 'peso corporal'],
  ['Rueda abdominal', 'Core', 'peso corporal'],
  // CrossFit / metcon
  ['Clean (cargada)', 'Olímpico', 'barra'],
  ['Snatch (arrancada)', 'Olímpico', 'barra'],
  ['Thruster', 'Olímpico', 'barra'],
  ['Swing con kettlebell', 'Full body', 'kettlebell'],
  ['Wall ball', 'Full body', 'peso corporal'],
  ['Burpees', 'Full body', 'peso corporal'],
];

const exCount = db.prepare('SELECT COUNT(*) c FROM exercises WHERE user_id IS NULL').get().c;
if (exCount === 0) {
  const ins = db.prepare('INSERT INTO exercises (user_id, name, muscle_group, category, is_custom) VALUES (NULL, ?, ?, ?, 0)');
  const tx = db.transaction((rows) => rows.forEach(r => ins.run(...r)));
  tx(BUILTIN_EXERCISES);
  console.log(`[db] Sembrados ${BUILTIN_EXERCISES.length} ejercicios incorporados.`);
}

export default db;
