import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

/** Liste des membres (owner uniquement) avec nombre de documents. */
router.get('/', requireOwner, async (req, res) => {
  const rows = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.relationship, u.is_active, u.last_login, u.created_at,
            (SELECT COUNT(*) FROM documents d WHERE d.owner_user_id = u.id) AS documents_count
     FROM users u ORDER BY u.role='owner' DESC, u.full_name`
  );
  res.json({ members: rows });
});

/** Créer un membre. */
router.post('/', requireOwner, async (req, res) => {
  const { email, full_name, phone, relationship, password } = req.body || {};
  if (!email || !full_name) return res.status(400).json({ error: 'Email et nom complet requis.' });
  const exists = await queryOne('SELECT id FROM users WHERE email = :e', { e: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });

  const pass = password && password.length >= 8 ? password : Math.random().toString(36).slice(2, 12);
  const hash = await bcrypt.hash(pass, 12);
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, relationship)
     VALUES (:email, :hash, :name, :phone, 'member', :rel)`,
    { email: String(email).toLowerCase(), hash, name: full_name, phone: phone || null, rel: relationship || null }
  );
  await audit(req, { action: 'MEMBER_CREATE', entityType: 'user', entityId: result.insertId, details: { email } });
  res.status(201).json({ id: result.insertId, temporaryPassword: password ? undefined : pass });
});

/** Modifier un membre. */
router.put('/:id', requireOwner, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { full_name, phone, relationship, is_active, password } = req.body || {};
  const target = await queryOne('SELECT id, role FROM users WHERE id = :id', { id });
  if (!target) return res.status(404).json({ error: 'Membre introuvable.' });
  if (target.role === 'owner' && is_active === false) {
    return res.status(400).json({ error: 'Impossible de désactiver le propriétaire.' });
  }

  const fields = [];
  const params = { id };
  if (full_name !== undefined) { fields.push('full_name = :full_name'); params.full_name = full_name; }
  if (phone !== undefined) { fields.push('phone = :phone'); params.phone = phone || null; }
  if (relationship !== undefined) { fields.push('relationship = :rel'); params.rel = relationship || null; }
  if (is_active !== undefined) { fields.push('is_active = :active'); params.active = is_active ? 1 : 0; }
  if (password && password.length >= 8) { fields.push('password_hash = :hash'); params.hash = await bcrypt.hash(password, 12); }
  if (!fields.length) return res.json({ ok: true });

  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = :id`, params);
  await audit(req, { action: 'MEMBER_UPDATE', entityType: 'user', entityId: id });
  res.json({ ok: true });
});

/** Supprimer un membre (et ses documents en cascade). */
router.delete('/:id', requireOwner, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: 'Vous ne pouvez pas vous supprimer.' });
  const target = await queryOne('SELECT role FROM users WHERE id = :id', { id });
  if (!target) return res.status(404).json({ error: 'Membre introuvable.' });
  if (target.role === 'owner') return res.status(400).json({ error: 'Impossible de supprimer le propriétaire.' });
  await query('DELETE FROM users WHERE id = :id', { id });
  await audit(req, { action: 'MEMBER_DELETE', entityType: 'user', entityId: id });
  res.json({ ok: true });
});

/** Liste simplifiée pour les sélecteurs de partage (owner). */
router.get('/options', requireOwner, async (req, res) => {
  const rows = await query(
    `SELECT id, full_name, relationship FROM users WHERE is_active = 1 ORDER BY role='owner' DESC, full_name`
  );
  res.json({ members: rows });
});

export default router;
