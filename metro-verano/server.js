// server.js — Servidor Express de la app "Metro Verano"
// Sirve la API JSON y el frontend estatico (SPA vanilla) desde /public.

const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PUERTO = process.env.PORT || 3010; // puerto alto libre por defecto

// Middlewares
app.use(express.json()); // parsea cuerpos JSON
app.use(express.static(path.join(__dirname, 'public'))); // sirve el frontend

// Valores validos (deben coincidir con los CHECK de la base de datos)
const BOXES = ['Parla', 'Las Rosas', 'Getafe'];
const CATEGORIAS = ['Cardio', 'Fuerza', 'CrossFit'];

// ---------------------------------------------------------------------------
// POST /api/usuarios — crea o recupera un usuario por nombre + box
// Body: { nombre_usuario, box }
// ---------------------------------------------------------------------------
app.post('/api/usuarios', (req, res) => {
  const nombre_usuario = (req.body.nombre_usuario || '').trim();
  const box = (req.body.box || '').trim();

  if (!nombre_usuario) {
    return res.status(400).json({ error: 'Falta el nombre de usuario' });
  }
  if (!BOXES.includes(box)) {
    return res.status(400).json({ error: 'Box no valido', boxes: BOXES });
  }

  // Si ya existe ese nombre, lo recuperamos (identificacion simple, sin contrasena)
  const existente = db.prepare('SELECT * FROM usuarios WHERE nombre_usuario = ?').get(nombre_usuario);
  if (existente) {
    return res.json(existente);
  }

  // Si no existe, lo creamos con su box
  const info = db.prepare('INSERT INTO usuarios (nombre_usuario, box) VALUES (?, ?)').run(nombre_usuario, box);
  const nuevo = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(nuevo);
});

// ---------------------------------------------------------------------------
// GET /api/entrenamientos?categoria= — lista entrenamientos (opcionalmente filtrados)
// ---------------------------------------------------------------------------
app.get('/api/entrenamientos', (req, res) => {
  const categoria = (req.query.categoria || '').trim();

  let filas;
  if (categoria && CATEGORIAS.includes(categoria)) {
    filas = db.prepare('SELECT * FROM entrenamientos WHERE categoria = ? ORDER BY id').all(categoria);
  } else {
    filas = db.prepare('SELECT * FROM entrenamientos ORDER BY categoria, id').all();
  }
  res.json(filas);
});

// ---------------------------------------------------------------------------
// POST /api/registros — guarda un entrenamiento completado
// Body: { usuario_id, entrenamiento_id, duracion_real_seg, notas }
// ---------------------------------------------------------------------------
app.post('/api/registros', (req, res) => {
  const usuario_id = Number(req.body.usuario_id);
  const entrenamiento_id = Number(req.body.entrenamiento_id);
  const duracion_real_seg = Number(req.body.duracion_real_seg) || 0;
  const notas = (req.body.notas || '').trim();

  if (!usuario_id || !entrenamiento_id) {
    return res.status(400).json({ error: 'Faltan usuario_id o entrenamiento_id' });
  }

  // Comprobamos que existan para no crear registros huerfanos
  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(usuario_id);
  const entreno = db.prepare('SELECT id FROM entrenamientos WHERE id = ?').get(entrenamiento_id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!entreno) return res.status(404).json({ error: 'Entrenamiento no encontrado' });

  const info = db.prepare(`
    INSERT INTO registros (usuario_id, entrenamiento_id, duracion_real_seg, notas)
    VALUES (?, ?, ?, ?)
  `).run(usuario_id, entrenamiento_id, duracion_real_seg, notas);

  const registro = db.prepare('SELECT * FROM registros WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(registro);
});

// ---------------------------------------------------------------------------
// GET /api/registros/:usuario_id — historial de un usuario (con datos del entreno)
// ---------------------------------------------------------------------------
app.get('/api/registros/:usuario_id', (req, res) => {
  const usuario_id = Number(req.params.usuario_id);
  if (!usuario_id) return res.status(400).json({ error: 'usuario_id no valido' });

  const filas = db.prepare(`
    SELECT r.id, r.fecha, r.duracion_real_seg, r.notas,
           e.id AS entrenamiento_id, e.nombre, e.categoria, e.formato_timer
    FROM registros r
    JOIN entrenamientos e ON e.id = r.entrenamiento_id
    WHERE r.usuario_id = ?
    ORDER BY r.fecha DESC
  `).all(usuario_id);

  res.json(filas);
});

// ---------------------------------------------------------------------------
// GET /api/ranking?box= — ranking por nº de entrenamientos completados
// Sin box (o box vacio) = ranking global. Con box = solo ese box.
// ---------------------------------------------------------------------------
app.get('/api/ranking', (req, res) => {
  const box = (req.query.box || '').trim();

  let filas;
  if (box && BOXES.includes(box)) {
    filas = db.prepare(`
      SELECT u.nombre_usuario, u.box, count(r.id) AS total
      FROM usuarios u
      LEFT JOIN registros r ON r.usuario_id = u.id
      WHERE u.box = ?
      GROUP BY u.id
      ORDER BY total DESC, u.nombre_usuario ASC
    `).all(box);
  } else {
    filas = db.prepare(`
      SELECT u.nombre_usuario, u.box, count(r.id) AS total
      FROM usuarios u
      LEFT JOIN registros r ON r.usuario_id = u.id
      GROUP BY u.id
      ORDER BY total DESC, u.nombre_usuario ASC
    `).all();
  }
  res.json(filas);
});

// Fallback: cualquier ruta no-API devuelve la SPA (index.html)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PUERTO, () => {
  console.log(`Metro Verano escuchando en http://localhost:${PUERTO}`);
});
