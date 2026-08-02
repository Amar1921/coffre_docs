import { query } from '../config/db.js';

/** Enregistre une entrée dans le journal d'audit (best effort). */
export async function audit(req, { userId = null, action, entityType = null, entityId = null, details = null, success = true }) {
  try {
    const uid = userId ?? req?.user?.id ?? null;
    const ip = (req?.headers?.['x-forwarded-for']?.split(',')[0] || req?.socket?.remoteAddress || '').toString().slice(0, 45);
    const ua = (req?.headers?.['user-agent'] || '').toString().slice(0, 255);
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip, user_agent, details, success)
       VALUES (:uid, :action, :et, :eid, :ip, :ua, :details, :success)`,
      {
        uid, action, et: entityType, eid: entityId, ip, ua,
        details: details ? JSON.stringify(details) : null,
        success: success ? 1 : 0,
      }
    );
  } catch (e) {
    console.error('[audit] échec:', e.message);
  }
}
