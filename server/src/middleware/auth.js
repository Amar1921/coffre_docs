import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { queryOne } from '../config/db.js';

/** Vérifie le JWT et charge l'utilisateur courant. */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentification requise.' });

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await queryOne(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = :id',
      { id: payload.sub }
    );
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Compte introuvable ou désactivé.' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

/** Réserve la route au propriétaire (owner). */
export function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Action réservée au propriétaire.' });
  }
  next();
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpires,
  });
}
