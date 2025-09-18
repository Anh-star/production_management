const pool = require('../config/db');
const { validationResult } = require('express-validator');

// @desc    Start a production report for a specific PO operation
// @route   POST /api/reports/start
// @access  Private (Operator, Admin)
exports.startProduction = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { po_id, operation_id, shift_id, line } = req.body;
  const user_id = req.user.id;

  try {
    const existingReport = await pool.query(
      'SELECT * FROM prod_reports WHERE user_id = $1 AND operation_id = $2 AND po_id = $3 AND ended_at IS NULL',
      [user_id, operation_id, po_id]
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ message: 'An active production report already exists for this task.', report: existingReport.rows[0] });
    }

    const result = await pool.query(
      'INSERT INTO prod_reports (po_id, operation_id, user_id, shift_id, line, started_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [po_id, operation_id, user_id, shift_id, line]
    );

    await pool.query(
        'UPDATE po_operations SET status = $1 WHERE po_id = $2 AND operation_id = $3',
        ['InProgress', po_id, operation_id]
    );


    res.status(201).json({ message: 'Production started successfully', report: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start production', details: err.message });
  }
};

// @desc    Stop/End a production report and log defects
// @route   POST /api/reports/stop
// @access  Private (Operator, Admin)
exports.stopProduction = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { prod_report_id, qty_ok, qty_ng, runtime_min, downtime_min, note, defects } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reportRes = await client.query(
      'UPDATE prod_reports SET qty_ok = $1, qty_ng = $2, runtime_min = $3, downtime_min = $4, note = $5, ended_at = NOW() WHERE id = $6 RETURNING *',
      [qty_ok, qty_ng, runtime_min, downtime_min, note, prod_report_id]
    );

    if (reportRes.rows.length === 0) {
      throw new Error('Production report not found.');
    }

    const updatedReport = reportRes.rows[0];

    if (defects && defects.length > 0) {
      for (const defect of defects) {
        await client.query(
          'INSERT INTO defect_reports (prod_report_id, defect_code_id, qty, note) VALUES ($1, $2, $3, $4)',
          [prod_report_id, defect.defect_code_id, defect.qty, defect.note]
        );
      }
    }

    const totalQtyRes = await client.query(
        'SELECT SUM(qty_ok) as total_ok FROM prod_reports WHERE po_id = $1 AND operation_id = $2',
        [updatedReport.po_id, updatedReport.operation_id]
    );
    const totalOk = totalQtyRes.rows[0].total_ok || 0;

    const poOpRes = await client.query(
        'SELECT qty_plan FROM po_operations WHERE po_id = $1 AND operation_id = $2',
        [updatedReport.po_id, updatedReport.operation_id]
    );
    const qtyPlan = poOpRes.rows[0].qty_plan;

    if (totalOk >= qtyPlan) {
        await client.query(
            'UPDATE po_operations SET status = $1 WHERE po_id = $2 AND operation_id = $3',
            ['Completed', updatedReport.po_id, updatedReport.operation_id]
        );
    }


    await client.query('COMMIT');
    res.status(200).json({ message: 'Production stopped and report submitted successfully', report: updatedReport });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Transaction failed', details: err.message });
  } finally {
    client.release();
  }
};

// @desc    Get Pareto report for defects
// @route   GET /api/reports/pareto
// @access  Private (Planner, QC, Admin)
exports.getParetoReport = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { start_date, end_date, po_id, product_id, operation_id, limit = 10 } = req.query;

  let query = `
    SELECT
      dc.code AS defect_code,
      dc.name AS defect_name,
      dc."group" AS defect_group,
      SUM(dr.qty) AS total_qty
    FROM defect_reports dr
    JOIN defect_codes dc ON dr.defect_code_id = dc.id
    JOIN prod_reports pr ON dr.prod_report_id = pr.id
    JOIN production_orders po ON pr.po_id = po.id
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
  if (po_id) {
    whereClauses.push(`pr.po_id = ${paramIndex++}`);
    queryParams.push(po_id);
  }
  if (product_id) {
    whereClauses.push(`po.product_id = ${paramIndex++}`);
    queryParams.push(product_id);
  }
  if (operation_id) {
    whereClauses.push(`pr.operation_id = ${paramIndex++}`);
    queryParams.push(operation_id);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += `
    GROUP BY dc.code, dc.name, dc."group"
    ORDER BY total_qty DESC
    LIMIT ${paramIndex++}
  `;
  queryParams.push(limit);

  try {
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate Pareto report', details: err.message });
  }
};
