const pool = require('../config/db');
const { validationResult } = require('express-validator');
const { logToAudit } = require('../utils/audit');

exports.startProduction = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { po_id, operation_id, shift_id, line } = req.body;
  const user_id = req.user?.userId;

  if (!user_id) {
    return res.status(401).json({ message: 'Unauthorized: User ID not found in token.' });
  }

  try {
    const poStatusRes = await pool.query('SELECT status FROM production_orders WHERE id = $1', [po_id]);
    if (poStatusRes.rows.length > 0 && poStatusRes.rows[0].status === 'Completed') {
      return res.status(400).json({ message: 'Cannot start production on a completed order.' });
    }

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
    const newReport = result.rows[0];

    await pool.query(
        'UPDATE po_operations SET status = $1 WHERE po_id = $2 AND operation_id = $3',
        ['InProgress', po_id, operation_id]
    );

    await pool.query(
        'UPDATE production_orders SET status = $1 WHERE id = $2',
        ['In Progress', po_id]
    );

    await logToAudit('start production', 'prod_reports', newReport.id, user_id, req.body);
    res.status(201).json({ message: 'Production started successfully', report: newReport });
  } catch (err) {
    console.error('Error in startProduction:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.stopProduction = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { prod_report_id, qty_ok, qty_ng, note, is_final } = req.body;
  
  let defects = [];
  if (req.body.defects) {
    try {
      defects = JSON.parse(req.body.defects);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid defects JSON format.' });
    } 
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentReportRes = await client.query('SELECT * FROM prod_reports WHERE id = $1 FOR UPDATE', [prod_report_id]);
    if (currentReportRes.rows.length === 0) {
      throw new Error('Production report not found.');
    }
    const currentReport = currentReportRes.rows[0];

    const newQtyOk = (currentReport.qty_ok || 0) + (parseInt(qty_ok, 10) || 0);
    const newQtyNg = (currentReport.qty_ng || 0) + (parseInt(qty_ng, 10) || 0);
    const newNote = (note && note.trim() !== '') 
      ? [currentReport.note || '', note].filter(Boolean).join(' | ') 
      : currentReport.note || '';
      
    const newEndedAt = is_final === 'true' ? new Date() : (currentReport.ended_at || null);

    const updateQuery = `
      UPDATE prod_reports
      SET
        qty_ok = $1,
        qty_ng = $2,
        note = $3,
        ended_at = $4
      WHERE id = $5
      RETURNING *
    `;
    const queryParams = [newQtyOk, newQtyNg, newNote, newEndedAt, prod_report_id];
    const reportRes = await client.query(updateQuery, queryParams);
    const updatedReport = reportRes.rows[0];

    if (defects && defects.length > 0) {
      for (const defect of defects) {
        await client.query(
          'INSERT INTO defect_reports (prod_report_id, defect_code_id, qty, note) VALUES ($1, $2, $3, $4)',
          [prod_report_id, defect.defect_code_id, defect.qty, defect.note || '']
        );
      }
    }

    const totalQtyRes = await client.query(
      'SELECT SUM(qty_ok) as total_ok FROM prod_reports WHERE po_id = $1',
      [updatedReport.po_id]
    );
    const totalOk = totalQtyRes.rows[0].total_ok || 0;

    const poRes = await client.query('SELECT qty_plan FROM production_orders WHERE id = $1', [updatedReport.po_id]);
    const qtyPlan = poRes.rows[0].qty_plan;

    if (totalOk >= qtyPlan) {
      await client.query(
        'UPDATE production_orders SET status = $1 WHERE id = $2',
        ['Completed', updatedReport.po_id]
      );
    }
    
    await logToAudit('stop production', 'prod_reports', prod_report_id, req.user.userId, req.body);
    
    await client.query('COMMIT');
    
    res.status(200).json({ message: 'Production report updated successfully', report: updatedReport });
    
  } catch (err) {
    
    await client.query('ROLLBACK');
    
    console.error(err.message);
    
    res.status(500).json({ error: 'Server error' });
    
  } finally {
    
    client.release();
    
  }
    
};

    exports.getAllReports = async (req, res) => {
    
      try {
    
        const query = `
    
          SELECT
    
            pr.id,
    
            pr.started_at,
    
            pr.ended_at,
    
            pr.qty_ok,
    
            pr.qty_ng,
    
            pr.note,
    
            pr.line,
    
            u.name as user_name,
    
            po.code as po_code,
    
            p.name as product_name,
    
            op.name as operation_name,
    
            s.name as shift_name,

            (
              SELECT JSON_AGG(JSON_BUILD_OBJECT('qty', dr.qty, 'defect_codes', dc.*))
              FROM defect_reports dr
              JOIN defect_codes dc ON dr.defect_code_id = dc.id
              WHERE dr.prod_report_id = pr.id
            ) as defect_reports
    
          FROM prod_reports pr
    
          LEFT JOIN users u ON pr.user_id = u.id
    
          LEFT JOIN production_orders po ON pr.po_id = po.id
    
          LEFT JOIN products p ON po.product_id = p.id
    
          LEFT JOIN operations op ON pr.operation_id = op.id
    
          LEFT JOIN shifts s ON pr.shift_id = s.id
    
          GROUP BY pr.id, u.name, po.code, p.name, op.name, s.name

          ORDER BY pr.started_at DESC
    
        `;
    
        const result = await pool.query(query);
    
        res.json(result.rows);
    
      } catch (err) {
    
        console.error(err.message);
    
        res.status(500).json({ error: 'Server error' });
    
      }
    
    };
 
    exports.getParetoReport = async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
    
      const { start_date, end_date, po_id, product_id, operation_id, limit = 10 } = req.query;
    
      let query = `
        SELECT
          dc.name AS defect_name,
          SUM(dr.qty) AS count
        FROM defect_reports dr
        JOIN defect_codes dc ON dr.defect_code_id = dc.id
        JOIN prod_reports pr ON dr.prod_report_id = pr.id
      `;
    
      const whereClauses = [];
      const queryParams = [];
      let paramIndex = 1;

      if (!start_date && !end_date) {
          whereClauses.push(`pr.started_at >= NOW() - interval '7 days'`);
      }
    
      if (start_date) {
        whereClauses.push(`pr.started_at >= $${paramIndex++}`);
        queryParams.push(start_date);
      }
      if (end_date) {
        whereClauses.push(`pr.started_at <= $${paramIndex++}`);
        queryParams.push(end_date);
      }
      if (po_id) {
        whereClauses.push(`pr.po_id = $${paramIndex++}`);
        queryParams.push(po_id);
      }
      if (product_id) {
        query += ' JOIN production_orders po ON pr.po_id = po.id';
        whereClauses.push(`po.product_id = $${paramIndex++}`);
        queryParams.push(product_id);
      }
      if (operation_id) {
        whereClauses.push(`pr.operation_id = $${paramIndex++}`);
        queryParams.push(operation_id);
      }
    
      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ');
      }
    
      query += `
        GROUP BY dc.name
        ORDER BY count DESC
        LIMIT $${paramIndex++}
      `;
      queryParams.push(limit);
    
      try {
        const result = await pool.query(query, queryParams);
        const defects = result.rows.map(row => ({ 
            defect_name: row.defect_name,
            count: Number(row.count) 
        }));
    
        res.json(defects);
      } catch (err) {
        console.error('Failed Query:', query);
        console.error('Query Params:', queryParams);
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
      }
    };

exports.getDailyReport = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ message: 'start_date and end_date are required.' });
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

exports.getReportById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT
                pr.id, pr.started_at, pr.ended_at, pr.qty_ok, pr.qty_ng,
                pr.note, pr.line,
                u.name as user_name,
                po.code as po_code,
                p.name as product_name,
                op.name as operation_name,
                s.name as shift_name,
                (
                    SELECT JSON_AGG(JSON_BUILD_OBJECT('qty', dr.qty, 'defect_code', dc.name, 'defect_note', dr.note))
                    FROM defect_reports dr
                    JOIN defect_codes dc ON dr.defect_code_id = dc.id
                    WHERE dr.prod_report_id = pr.id
                ) as defect_details
            FROM prod_reports pr
            LEFT JOIN users u ON pr.user_id = u.id
            LEFT JOIN production_orders po ON pr.po_id = po.id
            LEFT JOIN products p ON po.product_id = p.id
            LEFT JOIN operations op ON pr.operation_id = op.id
            LEFT JOIN shifts s ON pr.shift_id = s.id
            WHERE pr.id = $1
            GROUP BY pr.id, u.name, po.code, p.name, op.name, s.name
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};
