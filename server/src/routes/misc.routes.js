import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** Catégories (accessibles à tous les utilisateurs authentifiés). */
router.get('/categories', async (req, res) => {
  const rows = await query('SELECT id, name, slug, icon FROM categories ORDER BY sort_order, name');
  res.json({ categories: rows });
});

/** Journal d'audit (owner uniquement). */
router.get('/audit', requireOwner, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const rows = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.ip, a.success, a.details, a.created_at,
            u.full_name AS user_name
     FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.id DESC LIMIT ${limit}`
  );
  res.json({ logs: rows });
});

/** Notifications de l'utilisateur courant. */
router.get('/notifications', async (req, res) => {
  const rows = await query(
    'SELECT * FROM notifications WHERE user_id = :uid ORDER BY created_at DESC LIMIT 100',
    { uid: req.user.id }
  );
  const unread = rows.filter(r => !r.is_read).length;
  res.json({ notifications: rows, unread });
});

router.post('/notifications/read-all', async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE user_id = :uid', { uid: req.user.id });
  res.json({ ok: true });
});

/** Statistiques du tableau de bord (adaptées au rôle). */
router.get('/stats', async (req, res) => {
  if (req.user.role === 'owner') {
    const [docs] = await query('SELECT COUNT(*) AS n FROM documents');
    const [members] = await query("SELECT COUNT(*) AS n FROM users WHERE role='member' AND is_active=1");
    const [expiring] = await query('SELECT COUNT(*) AS n FROM documents WHERE expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
    const [shares] = await query('SELECT COUNT(*) AS n FROM document_shares WHERE revoked=0 AND (expires_at IS NULL OR expires_at > NOW())');
    const byCategory = await query(
      `SELECT c.name, COUNT(d.id) AS n FROM categories c
       LEFT JOIN documents d ON d.category_id = c.id GROUP BY c.id ORDER BY n DESC`
    );
    return res.json({ role: 'owner', documents: docs.n, members: members.n, expiring: expiring.n, active_shares: shares.n, byCategory });
  }
  // Membre
  const [mine] = await query('SELECT COUNT(*) AS n FROM documents WHERE owner_user_id = :uid', { uid: req.user.id });
  const [shared] = await query(
    `SELECT COUNT(*) AS n FROM document_shares WHERE shared_with_user_id = :uid AND revoked=0 AND (expires_at IS NULL OR expires_at > NOW())`,
    { uid: req.user.id }
  );
  const [expiring] = await query(
    'SELECT COUNT(*) AS n FROM documents WHERE owner_user_id = :uid AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)',
    { uid: req.user.id }
  );
  res.json({ role: 'member', documents: mine.n, shared_with_me: shared.n, expiring: expiring.n });
});

export default router;
