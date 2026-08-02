import { queryOne } from '../config/db.js';

/**
 * Détermine si un utilisateur peut accéder à un document et avec quelle permission.
 * - owner : accès total à tous les documents (permission 'download').
 * - membre : accès à ses propres documents (download), ou aux documents partagés
 *   avec lui via un partage actif (non révoqué et non expiré).
 * @returns {Promise<{doc:object, permission:'download'|'view'}|null>}
 */
export async function resolveDocumentAccess(user, documentId) {
  const doc = await queryOne('SELECT * FROM documents WHERE id = :id', { id: documentId });
  if (!doc) return null;

  // Propriétaire de l'app : accès total
  if (user.role === 'owner') return { doc, permission: 'download' };

  // Propriétaire du document (le membre lui-même)
  if (doc.owner_user_id === user.id) return { doc, permission: 'download' };

  // Partage actif ?
  const share = await queryOne(
    `SELECT permission FROM document_shares
     WHERE document_id = :doc AND shared_with_user_id = :uid
       AND revoked = 0 AND (expires_at IS NULL OR expires_at > NOW())`,
    { doc: documentId, uid: user.id }
  );
  if (share) return { doc, permission: share.permission };

  return null;
}
