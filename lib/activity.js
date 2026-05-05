import { query } from './db.js';

// Fire-and-forget audit write. Errors are swallowed so audit never breaks the main request.
export async function logActivity({ actorId, entityType, entityId, action, metadata = null }) {
  try {
    await query(
      `INSERT INTO activity_logs (actor_id, entity_type, entity_id, action, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, entityType, entityId, action, metadata]
    );
  } catch (err) {
    console.error('activity log failed', err);
  }
}
