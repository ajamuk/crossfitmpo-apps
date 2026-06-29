import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP !== 'false';

router.post('/register', (req, res) => {
  if (!ALLOW_SIGNUP) return res.status(403).json({ error: 'Registro deshabilitado' });
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (username.length < 3) return res.status(400).json({ error: 'Usuario demasiado corto (mín. 3)' });
  if (password.length < 6) return res.status(400).json({ error: 'Contraseña demasiado corta (mín. 6)' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Ese usuario ya existe' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  const user = { id: info.lastInsertRowid, username };
  res.json({ token: signToken(user), user: { id: user.id, username, unit: 'kg' } });
});

router.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  res.json({ token: signToken(user), user: { id: user.id, username: user.username, unit: user.unit } });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, unit FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'No encontrado' });
  res.json({ user });
});

router.patch('/me', requireAuth, (req, res) => {
  const unit = req.body.unit === 'lb' ? 'lb' : 'kg';
  db.prepare('UPDATE users SET unit = ? WHERE id = ?').run(unit, req.user.id);
  res.json({ user: { id: req.user.id, username: req.user.username, unit } });
});

export default router;
