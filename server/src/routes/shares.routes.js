import { Router } from 'express';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveDocumentAccess } from '../utils/access.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

/** Partages d'un document (visible par qui peut gérer le document). */
router.get('/document/:id', async (req, res) => {
  const access = await resolveDocumentAccess(req.user, parseInt(req.params.id, 10));
  if (!access || access.permission !== 'download') {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  const rows = await query(
    `SELECT s.id, s.shared_with_user_id, s.permission, s.expires_at, s.revoked, s.created_at,
            u.full_name, u.relationship
     FROM document_shares s JOIN users u ON u.id = s.shared_with_user_id
     WHERE s.document_id = :doc ORDER BY s.created_at DESC`,
    { doc: access.doc.id }
  );
  res.json({ shares: rows });
});

/** Créer ou mettre à jour un partage. */
router.post('/', async (req, res) => {
  const { document_id, user_id, permission = 'view', expires_at } = req.body || {};
  if (!document_id || !user_id) return res.status(400).json({ error: 'document_id et user_id requis.' });

  const access = await resolveDocumentAccess(req.user, parseInt(document_id, 10));
  if (!access || access.permission !== 'download') {
    return res.status(403).json({ error: 'Vous ne pouvez pas partager ce document.' });
  }
  if (parseInt(user_id, 10) === access.doc.owner_user_id) {
    return res.status(400).json({ error: 'Le propriétaire du document y a déjà accès.' });
  }
  const target = await queryOne('SELECT id FROM users WHERE id = :id AND is_active = 1', { id: user_id });
  if (!target) return res.status(404).json({ error: 'Membre introuvable.' });

  const perm = permission === 'download' ? 'download' : 'view';
  await query(
    `INSERT INTO document_shares (document_id, shared_with_user_id, permission, shared_by, expires_at, revoked)
     VALUES (:doc, :uid, :perm, :by, :exp, 0)
     ON DUPLICATE KEY UPDATE permission = VALUES(permission), expires_at = VALUES(expires_at),
                             revoked = 0, shared_by = VALUES(shared_by)`,
    { doc: access.doc.id, uid: user_id, perm, by: req.user.id, exp: expires_at || null }
  );
  // Notifier le membre
  await query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
     VALUES (:uid, 'share', :title, :msg, 'document', :doc)`,
    {
      uid: user_id, title: 'Nouveau document partagé',
      msg: `Le document « ${access.doc.title} » a été partagé avec vous.`, doc: access.doc.id,
    }
  );
  await audit(req, { action: 'SHARE', entityType: 'document', entityId: access.doc.id, details: { user_id, perm, expires_at } });
  res.json({ ok: true });
});

/** Révoquer un partage. */
router.delete('/:id', async (req, res) => {
  const share = await queryOne('SELECT * FROM document_shares WHERE id = :id', { id: parseInt(req.params.id, 10) });
  if (!share) return res.status(404).json({ error: 'Partage introuvable.' });
  const access = await resolveDocumentAccess(req.user, share.document_id);
  if (!access || access.permission !== 'download') {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  await query('UPDATE document_shares SET revoked = 1 WHERE id = :id', { id: share.id });
  await audit(req, { action: 'REVOKE_SHARE', entityType: 'document', entityId: share.document_id, details: { shareId: share.id } });
  res.json({ ok: true });
});

export default router;
