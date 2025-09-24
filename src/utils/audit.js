const pool = require('../config/db');

const logToAudit = async (action, entity, entity_id, user_id, payload, client = pool) => {
  try {
    let sanitizedPayload = payload;
    if (payload && typeof payload === 'object' && payload.password) {
      const { password, ...rest } = payload;
      sanitizedPayload = rest;
    }

    await client.query(
      'INSERT INTO audit_logs (action, entity, entity_id, user_id, payload_json) VALUES ($1, $2, $3, $4, $5)',
      [action, entity, entity_id, user_id, sanitizedPayload]
    );
  } catch (err) {
    console.error('Failed to write to audit log:', err);
  }
};

module.exports = { logToAudit };
