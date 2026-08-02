import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query, queryOne } from '../config/db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const user = await queryOne('SELECT * FROM users WHERE email = :email', { email: String(email).toLowerCase() });
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    await audit(req, { userId: user?.id ?? null, action: 'LOGIN', success: false, details: { email } });
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  await query('UPDATE users SET last_login = NOW() WHERE id = :id', { id: user.id });
  await audit(req, { userId: user.id, action: 'LOGIN', success: true });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { current, next: newPass } = req.body || {};
  if (!current || !newPass || String(newPass).length < 8) {
    return res.status(400).json({ error: 'Mot de passe actuel requis et nouveau mot de passe >= 8 caractères.' });
  }
  const row = await queryOne('SELECT password_hash FROM users WHERE id = :id', { id: req.user.id });
  if (!(await bcrypt.compare(current, row.password_hash))) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }
  const hash = await bcrypt.hash(newPass, 12);
  await query('UPDATE users SET password_hash = :h WHERE id = :id', { h: hash, id: req.user.id });
  await audit(req, { action: 'PASSWORD_CHANGE' });
  res.json({ ok: true });
});

export default router;
