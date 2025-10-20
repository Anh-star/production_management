const pool = require('../config/db');
const { validationResult } = require('express-validator');

exports.getDashboardSummary = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { start_date, end_date, shift_id, line, po_id, product_id } = req.query;
  let query = `
    SELECT
      SUM(pr.qty_ok) as total_production,
      CASE
        WHEN SUM(po.qty_plan) > 0 THEN SUM(pr.qty_ok) / SUM(po.qty_plan)
        ELSE 0
      END as plan_achievement_rate,
      CASE
        WHEN SUM(pr.qty_ok) > 0 THEN (SUM(pr.qty_ng) * 100.0 / SUM(pr.qty_ok))
        WHEN SUM(pr.qty_ng) > 0 AND SUM(pr.qty_ok) = 0 THEN 100.0
        ELSE 0
      END as defect_rate,
      0 AS oee_rate
    FROM prod_reports pr
    JOIN production_orders po ON pr.po_id = po.id
    JOIN products p ON po.product_id = p.id
    JOIN operations op ON pr.operation_id = op.id
    JOIN shifts s ON pr.shift_id = s.id
  `;

  const whereClauses = ['pr.started_at >= CURRENT_DATE'];
  const queryParams = [];
  let paramIndex = 1;

  if (start_date) {
    whereClauses.push(`pr.started_at >= $${paramIndex++}`);
    queryParams.push(start_date);
  }
  if (end_date) {
    whereClauses.push(`pr.started_at <= $${paramIndex++}`);
    queryParams.push(end_date);
  }
  if (shift_id) {
    whereClauses.push(`pr.shift_id = $${paramIndex++}`);
    queryParams.push(shift_id);
  }
  if (line) {
    whereClauses.push(`pr.line = $${paramIndex++}`);
    queryParams.push(line);
  }
  if (po_id) {
    whereClauses.push(`pr.po_id = $${paramIndex++}`);
    queryParams.push(po_id);
  }
  if (product_id) {
    whereClauses.push(`po.product_id = $${paramIndex++}`);
    queryParams.push(product_id);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  try {
    const result = await pool.query(query, queryParams);
    const kpis = result.rows[0] || {
      total_production: 0,
      plan_achievement_rate: 0,
      defect_rate: 0,
      oee_rate: 0,
    };

    kpis.total_production = parseInt(kpis.total_production, 10) || 0;
    kpis.plan_achievement_rate = parseFloat(kpis.plan_achievement_rate) || 0;
    kpis.defect_rate = parseFloat(kpis.defect_rate) || 0;
    kpis.oee_rate = parseFloat(kpis.oee_rate) || 0;
    
    res.json(kpis);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
