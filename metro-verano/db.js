// db.js — Conexion y esquema de la base de datos SQLite
// Usamos better-sqlite3 (sincrono, rapido) con un archivo local. Cero servicios externos.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Carpeta donde se guarda el archivo de la base de datos
const dirDatos = path.join(__dirname, 'data');
if (!fs.existsSync(dirDatos)) {
  fs.mkdirSync(dirDatos, { recursive: true });
}

// Abrimos (o creamos) el archivo SQLite local
const db = new Database(path.join(dirDatos, 'metro-verano.db'));

// WAL = mejor rendimiento de lecturas concurrentes (varios usuarios a la vez)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Creamos las tablas si no existen.
// Los CHECK garantizan que box, categoria y formato_timer solo admitan valores validos (enums).
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_usuario TEXT NOT NULL UNIQUE,
    box            TEXT NOT NULL CHECK (box IN ('Parla', 'Las Rosas', 'Getafe')),
    creado_en      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entrenamientos (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre                TEXT NOT NULL,
    categoria             TEXT NOT NULL CHECK (categoria IN ('Cardio', 'Fuerza', 'CrossFit')),
    descripcion           TEXT NOT NULL,
    formato_timer         TEXT NOT NULL CHECK (formato_timer IN ('AMRAP', 'EMOM', 'For Time', 'Tabata', 'Libre')),
    duracion_objetivo_seg INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS registros (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id        INTEGER NOT NULL,
    entrenamiento_id  INTEGER NOT NULL,
    fecha             TEXT NOT NULL DEFAULT (datetime('now')),
    duracion_real_seg INTEGER NOT NULL DEFAULT 0,
    notas             TEXT,
    FOREIGN KEY (usuario_id)       REFERENCES usuarios(id),
    FOREIGN KEY (entrenamiento_id) REFERENCES entrenamientos(id)
  );
`);

module.exports = db;
