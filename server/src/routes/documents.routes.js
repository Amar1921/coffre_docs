import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { encryptBuffer, decryptBuffer, randomStoredName } from '../utils/crypto.js';
import { resolveDocumentAccess } from '../utils/access.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});

const ALLOWED = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'image/gif', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

/** Tris autorisés (liste blanche — jamais d'injection dans ORDER BY). */
const SORTS = {
  date_desc: 'd.created_at DESC',
  date_asc: 'd.created_at ASC',
  name_asc: 'd.title ASC',
  name_desc: 'd.title DESC',
  size_desc: 'd.size_bytes DESC',
  size_asc: 'd.size_bytes ASC',
  expiry_asc: 'd.expiry_date IS NULL, d.expiry_date ASC',
};

/** Liste des documents visibles par l'utilisateur (avec filtres et tri). */
router.get('/', async (req, res) => {
  const { q, category, member, expiring, sort, date_from, date_to, type, favorite, archived } = req.query;
  const params = { uid: req.user.id };
  const where = [];

  if (req.user.role === 'owner') {
    if (member) { where.push('d.owner_user_id = :member'); params.member = parseInt(member, 10); }
  } else {
    where.push(`(d.owner_user_id = :uid OR d.id IN (
      SELECT document_id FROM document_shares
      WHERE shared_with_user_id = :uid AND revoked = 0 AND (expires_at IS NULL OR expires_at > NOW())
    ))`);
  }
  // Par défaut, on masque les documents archivés ; archived=1 les affiche seuls.
  where.push(archived === '1' ? 'd.archived = 1' : 'd.archived = 0');
  if (category) { where.push('d.category_id = :cat'); params.cat = parseInt(category, 10); }
  if (q) { where.push('(d.title LIKE :q OR d.description LIKE :q OR d.original_name LIKE :q)'); params.q = `%${q}%`; }
  if (expiring === '1') { where.push('d.expiry_date IS NOT NULL AND d.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)'); }
  if (favorite === '1') { where.push('d.is_favorite = 1'); }
  if (date_from) { where.push('d.created_at >= :from'); params.from = date_from; }
  if (date_to) { where.push('d.created_at < DATE_ADD(:to, INTERVAL 1 DAY)'); params.to = date_to; }
  if (type === 'pdf') { where.push("d.mime_type = 'application/pdf'"); }
  else if (type === 'image') { where.push("d.mime_type LIKE 'image/%'"); }
  else if (type === 'other') { where.push("d.mime_type <> 'application/pdf' AND d.mime_type NOT LIKE 'image/%'"); }

  const orderBy = SORTS[sort] || SORTS.date_desc;
  const sql = `
    SELECT d.id, d.title, d.description, d.category_id, d.owner_user_id, d.original_name,
           d.mime_type, d.extension, d.size_bytes, d.issue_date, d.expiry_date, d.created_at,
           d.is_favorite, d.archived, d.archived_at,
           c.name AS category_name, c.icon AS category_icon,
           u.full_name AS owner_name,
           (d.owner_user_id <> :uid) AS is_shared
    FROM documents d
    LEFT JOIN categories c ON c.id = d.category_id
    LEFT JOIN users u ON u.id = d.owner_user_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${orderBy}
    LIMIT 500`;
  const rows = await query(sql, params);
  res.json({ documents: rows });
});

/** Documents dont l'expiration approche (30 j) — visibles par l'utilisateur. */
router.get('/expiring', async (req, res) => {
  const params = { uid: req.user.id };
  let scope = '1=1';
  if (req.user.role !== 'owner') {
    scope = `(d.owner_user_id = :uid OR d.id IN (
      SELECT document_id FROM document_shares
      WHERE shared_with_user_id = :uid AND revoked = 0 AND (expires_at IS NULL OR expires_at > NOW())))`;
  }
  const rows = await query(
    `SELECT d.id, d.title, d.expiry_date, u.full_name AS owner_name,
            DATEDIFF(d.expiry_date, CURDATE()) AS days_left
     FROM documents d LEFT JOIN users u ON u.id = d.owner_user_id
     WHERE ${scope} AND d.archived = 0 AND d.expiry_date IS NOT NULL
       AND d.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
     ORDER BY d.expiry_date ASC LIMIT 100`,
    params
  );
  res.json({ documents: rows });
});

/** Métadonnées d'un document. */
router.get('/:id', async (req, res) => {
  const access = await resolveDocumentAccess(req.user, parseInt(req.params.id, 10));
  if (!access) return res.status(404).json({ error: 'Document introuvable ou accès refusé.' });
  const { doc, permission } = access;
  const { enc_iv, enc_tag, stored_name, ...safe } = doc;
  res.json({ document: safe, permission });
});

/** Téléversement d'un document (chiffré au repos). */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni.' });
  if (ALLOWED.size && !ALLOWED.has(req.file.mimetype)) {
    return res.status(400).json({ error: `Type de fichier non autorisé (${req.file.mimetype}).` });
  }

  const { title, description, category_id, issue_date, expiry_date } = req.body || {};
  // Un membre ne peut téléverser que POUR lui-même ; l'owner peut cibler un membre.
  let ownerUserId = req.user.id;
  if (req.user.role === 'owner' && req.body.owner_user_id) {
    ownerUserId = parseInt(req.body.owner_user_id, 10);
  }

  // Chiffrement
  const { data, iv, tag, sha256 } = encryptBuffer(req.file.buffer);
  const ext = path.extname(req.file.originalname).replace('.', '').slice(0, 20);
  const storedName = randomStoredName(ext);

  fs.mkdirSync(config.storageDir, { recursive: true });
  fs.writeFileSync(path.join(config.storageDir, storedName), data, { mode: 0o600 });

  const result = await query(
    `INSERT INTO documents
      (title, description, category_id, owner_user_id, uploaded_by, original_name, stored_name,
       mime_type, extension, size_bytes, checksum_sha256, enc_iv, enc_tag, issue_date, expiry_date)
     VALUES
      (:title, :desc, :cat, :owner, :by, :orig, :stored, :mime, :ext, :size, :sha, :iv, :tag, :issue, :expiry)`,
    {
      title: title || req.file.originalname,
      desc: description || null,
      cat: category_id ? parseInt(category_id, 10) : null,
      owner: ownerUserId,
      by: req.user.id,
      orig: req.file.originalname,
      stored: storedName,
      mime: req.file.mimetype,
      ext,
      size: req.file.size,
      sha: sha256,
      iv, tag,
      issue: issue_date || null,
      expiry: expiry_date || null,
    }
  );
  await audit(req, { action: 'UPLOAD', entityType: 'document', entityId: result.insertId, details: { title, ownerUserId } });
  res.status(201).json({ id: result.insertId });
});

/** Modifier les métadonnées d'un document. */
router.put('/:id', async (req, res) => {
  const access = await resolveDocumentAccess(req.user, parseInt(req.params.id, 10));
  if (!access || access.permission !== 'download') {
    return res.status(403).json({ error: 'Modification non autorisée.' });
  }
  const { title, description, category_id, issue_date, expiry_date } = req.body || {};
  await query(
    `UPDATE documents SET title = :title, description = :desc, category_id = :cat,
            issue_date = :issue, expiry_date = :expiry WHERE id = :id`,
    {
      id: access.doc.id,
      title: title || access.doc.title,
      desc: description ?? access.doc.description,
      cat: category_id ? parseInt(category_id, 10) : null,
      issue: issue_date || null,
      expiry: expiry_date || null,
    }
  );
  await audit(req, { action: 'UPDATE', entityType: 'document', entityId: access.doc.id });
  res.json({ ok: true });
});

/** Archiver / désarchiver un document (le fichier reste chiffré sur disque). */
router.patch('/:id/archive', async (req, res) => {
  const access = await resolveDocumentAccess(req.user, parseInt(req.params.id, 10));
  if (!access || access.permission !== 'download') {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
  const archived = req.body?.archived === false ? 0 : 1;
  await query(
    'UPDATE documents SET archived = :arch, archived_at = :at WHERE id = :id',
    { id: access.doc.id, arch: archived, at: archived ? new Date() : null }
  );
  await audit(req, { action: archived ? 'ARCHIVE' : 'UNARCHIVE', entityType: 'document', entityId: access.doc.id });
  res.json({ ok: true, archived: !!archived });
});

/** Marquer / retirer un document des favoris. */
router.patch('/:id/favorite', async (req, res) => {
  const access = await resolveDocumentAccess(req.user, parseInt(req.params.id, 10));
  if (!access || access.permission !== 'download') {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }
  const fav = req.body?.favorite === false ? 0 : 1;
  await query('UPDATE documents SET is_favorite = :fav WHERE id = :id', { id: access.doc.id, fav });
  res.json({ ok: true, favorite: !!fav });
});

/** Consulter (inline) ou télécharger (attachment) un document déchiffré. */
async function serveFile(req, res, disposition) {
  const access = await resolveDocumentAccess(req.user, parseInt(req.params.id, 10));
  if (!access) return res.status(404).json({ error: 'Document introuvable ou accès refusé.' });
  const { doc } = access;
  const filePath = path.join(config.storageDir, doc.stored_name);
  if (!fs.existsSync(filePath)) return res.status(410).json({ error: 'Fichier absent du stockage.' });

  try {
    const enc = fs.readFileSync(filePath);
    const plain = decryptBuffer(enc, doc.enc_iv, doc.enc_tag);
    await audit(req, { action: disposition === 'attachment' ? 'DOWNLOAD' : 'VIEW', entityType: 'document', entityId: doc.id });
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(doc.original_name)}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(plain);
  } catch (e) {
    console.error('[decrypt] échec:', e.message);
    res.status(500).json({ error: 'Déchiffrement impossible (fichier altéré ?).' });
  }
}
router.get('/:id/view', (req, res) => serveFile(req, res, 'inline'));
router.get('/:id/download', (req, res) => serveFile(req, res, 'attachment'));

/** Supprimer un document (fichier + ligne). */
router.delete('/:id', async (req, res) => {
  const access = await resolveDocumentAccess(req.user, parseInt(req.params.id, 10));
  if (!access || access.permission !== 'download') {
    return res.status(403).json({ error: 'Suppression non autorisée.' });
  }
  const filePath = path.join(config.storageDir, access.doc.stored_name);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
  await query('DELETE FROM documents WHERE id = :id', { id: access.doc.id });
  await audit(req, { action: 'DELETE', entityType: 'document', entityId: access.doc.id });
  res.json({ ok: true });
});

export default router;
