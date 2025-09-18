const pool = require('../config/db');
const { validationResult } = require('express-validator');

// @desc    Get aggregated production data for dashboards
// @route   GET /api/dashboard
// @access  Private (Planner, QC, Admin)
exports.getDashboardSummary = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { start_date, end_date, shift_id, line, po_id, product_id } = req.query;

  let query = `
    SELECT
      pr.po_id,
      po.code as po_code,
      po.qty_plan,
      pr.operation_id,
      op.name as operation_name,
      pr.shift_id,
      s.name as shift_name,
      pr.line,
      p.id as product_id,
      p.name as product_name,
      SUM(pr.qty_ok) as total_qty_ok,
      SUM(pr.qty_ng) as total_qty_ng,
      SUM(pr.runtime_min) as total_runtime_min,
      SUM(pr.downtime_min) as total_downtime_min,
      CASE
        WHEN po.qty_plan > 0 THEN SUM(pr.qty_ok) / po.qty_plan
        ELSE 0
      END as plan_attainment,
      CASE
        WHEN SUM(pr.runtime_min) > 0 THEN SUM(pr.qty_ok) / SUM(pr.runtime_min)
        ELSE 0
      END as efficiency_output_per_min
    FROM prod_reports pr
    JOIN production_orders po ON pr.po_id = po.id
    JOIN products p ON po.product_id = p.id
    JOIN operations op ON pr.operation_id = op.id
    JOIN shifts s ON pr.shift_id = s.id
  `;

  const whereClauses = [];
  const queryParams = [];
  let paramIndex = 1;

  if (start_date) {
    whereClauses.push(`pr.started_at >= ${paramIndex++}`);
    queryParams.push(start_date);
  }
  if (end_date) {
    whereClauses.push(`pr.started_at <= ${paramIndex++}`);
    queryParams.push(end_date);
  }
  if (shift_id) {
    whereClauses.push(`pr.shift_id = ${paramIndex++}`);
    queryParams.push(shift_id);
  }
  if (line) {
    whereClauses.push(`pr.line = ${paramIndex++}`);
    queryParams.push(line);
  }
  if (po_id) {
    whereClauses.push(`pr.po_id = ${paramIndex++}`);
    queryParams.push(po_id);
  }
  if (product_id) {
    whereClauses.push(`po.product_id = ${paramIndex++}`);
    queryParams.push(product_id);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += `
    GROUP BY
      pr.po_id, po.code, po.qty_plan, pr.operation_id, op.name, pr.shift_id, s.name, pr.line, p.id, p.name
    ORDER BY
      po_code, shift_name, line;
  `;

  try {
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve dashboard data', details: err.message });
  }
};
