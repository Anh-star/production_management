const pool = require('../config/db');
const { validationResult } = require('express-validator');
const { logToAudit } = require('../utils/audit');

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
      return res.status(400).json({ message: 'Một báo cáo sản xuất đang hoạt động đã tồn tại cho task này.', report: existingReport.rows[0] });
    }

    const result = await pool.query(
      'INSERT INTO prod_reports (po_id, operation_id, user_id, shift_id, line, started_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [po_id, operation_id, user_id, shift_id, line]
    );
    const newReport = result.rows[0];

    await pool.query(
        'UPDATE po_operations SET status = $1 WHERE po_id = $2 AND operation_id = $3',
        ['InProgress', po_id, operation_id]
    );

    await logToAudit('start production', 'prod_reports', newReport.id, user_id, req.body);
    res.status(201).json({ message: 'Sản xuất đã bắt đầu thành công', report: newReport });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
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

  const { prod_report_id, qty_ok, qty_ng, runtime_min, downtime_min, note } = req.body;
 
  let defects = [];
  if (req.body.defects) {
    try {
      defects = JSON.parse(req.body.defects);
    } catch (e) {
      return res.status(400).json({ error: 'Định dạng JSON lỗi không hợp lệ.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reportRes = await client.query(
      'UPDATE prod_reports SET qty_ok = $1, qty_ng = $2, runtime_min = $3, downtime_min = $4, note = $5, ended_at = NOW() WHERE id = $6 RETURNING *',
      [qty_ok, qty_ng, runtime_min, downtime_min, note, prod_report_id]
    );

    if (reportRes.rows.length === 0) {
      throw new Error('Không tìm thấy báo cáo sản xuất.');
    }

    const updatedReport = reportRes.rows[0];

    if (defects && defects.length > 0) {
      for (let i = 0; i < defects.length; i++) {
        const defect = defects[i];
        const imageFile = req.files && req.files[i] ? req.files[i] : null;
        const imageUrl = imageFile ? imageFile.path : null;

        await client.query(
          'INSERT INTO defect_reports (prod_report_id, defect_code_id, qty, note, image_url) VALUES ($1, $2, $3, $4, $5)',
          [prod_report_id, defect.defect_code_id, defect.qty, defect.note, imageUrl]
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

    await logToAudit('stop production', 'prod_reports', prod_report_id, req.user.id, req.body, client);
    res.status(200).json({ message: 'Sản xuất đã dừng lại và báo cáo đã được gửi thành công', report: updatedReport });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
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
    const defects = result.rows.map(row => ({ ...row, total_qty: Number(row.total_qty) }));

    const grandTotal = defects.reduce((sum, row) => sum + row.total_qty, 0);
    let cumulativeTotal = 0;
    const paretoData = defects.map(row => {
      cumulativeTotal += row.total_qty;
      return {
        ...row,
        cumulative_percentage: grandTotal > 0 ? (cumulativeTotal / grandTotal) : 0
      };
    });

    res.json(paretoData);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get Daily Production Report
// @route   GET /api/reports/daily
// @access  Private (Planner, QC, Admin)
exports.getDailyReport = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ message: 'start_date và end_date cần thiết.' });
    }

    const query = `
    WITH date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval) AS report_date
    ),
    daily_plan AS (
        SELECT
            d.report_date,
            -- Divide plan by the number of days the PO is active to get a daily target
            COALESCE(SUM(po.qty_plan / (po.end_plan - po.start_plan + 1)), 0) AS total_plan
        FROM date_series d
        LEFT JOIN production_orders po ON d.report_date BETWEEN po.start_plan AND po.end_plan
        GROUP BY d.report_date
    ),
    daily_actual AS (
        SELECT
            DATE(pr.started_at) AS report_date,
            SUM(pr.qty_ok) AS total_ok,
            SUM(pr.qty_ng) AS total_ng
        FROM prod_reports pr
        WHERE DATE(pr.started_at) BETWEEN $1::date AND $2::date
        GROUP BY DATE(pr.started_at)
    )
    SELECT
        dp.report_date,
        dp.total_plan,
        COALESCE(da.total_ok, 0) AS total_ok,
        COALESCE(da.total_ng, 0) AS total_ng,
        CASE
            WHEN dp.total_plan > 0 THEN COALESCE(da.total_ok, 0) / dp.total_plan
            ELSE 0
        END AS plan_attainment
    FROM daily_plan dp
    LEFT JOIN daily_actual da ON dp.report_date = da.report_date
    ORDER BY dp.report_date;
    `;

    try {
        const result = await pool.query(query, [start_date, end_date]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};
