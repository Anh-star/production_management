const { validationResult } = require('express-validator');
const pool = require('../config/db');

exports.getOrders = async (req, res) => {
  const { status, product_id } = req.query;

  try {
    let query = `
      WITH report_qty AS (
        SELECT 
          po_id, 
          SUM(qty_ok) as total_qty_ok
        FROM prod_reports
        GROUP BY po_id
      )
      SELECT 
        po.id, 
        po.code, 
        po.product_id, 
        p.name as product_name,
        po.qty_plan, 
        po.start_plan, 
        po.end_plan, 
        po.status,
        COALESCE(rq.total_qty_ok, 0) as actual_qty,
        CASE 
          WHEN po.qty_plan > 0 THEN (COALESCE(rq.total_qty_ok, 0) * 100.0 / po.qty_plan)
          ELSE 0 
        END as progress
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      LEFT JOIN report_qty rq ON po.id = rq.po_id
    `;
    
    const whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereClauses.push(`po.status = $${paramIndex++}`);
      queryParams.push(status);
    }
    if (product_id) {
      whereClauses.push(`po.product_id = $${paramIndex++}`);
      queryParams.push(product_id);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    query += `
      ORDER BY po.start_plan DESC
    `;

    const result = await pool.query(query, queryParams);
    console.log('Get Orders Query:', query);
    console.log('Get Orders Rows:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Get Orders Error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const orderResult = await pool.query('SELECT * FROM production_orders WHERE id = $1', [req.params.id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Production order not found' });
    } 
    const order = orderResult.rows[0];

    const opsResult = await pool.query(
      'SELECT po.*, op.name as operation_name FROM po_operations po JOIN operations op ON po.operation_id = op.id WHERE po.po_id = $1 ORDER BY po.step_no',
      [req.params.id]
    );
    order.operations = opsResult.rows;

    res.json(order);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createOrder = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, product_id, qty_plan, start_plan, end_plan } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productRes = await client.query('SELECT is_active FROM products WHERE id = $1', [product_id]);
    if (productRes.rows.length === 0) {
      throw new Error('Product not found.');
    }
    if (!productRes.rows[0].is_active) {
      throw new Error('Cannot create order for an inactive product.');
    }

    const routingRes = await client.query(
      'SELECT id FROM routing_headers WHERE product_id = $1 AND is_active = TRUE',
      [product_id]
    );
    if (routingRes.rows.length === 0) {
      throw new Error('No active routing found for the selected product. Please ensure a routing is configured and active.');
    }
    const routingId = routingRes.rows[0].id;

    const stepsRes = await client.query(
      'SELECT * FROM routing_steps WHERE routing_id = $1 ORDER BY step_no',
      [routingId]
    );
    if (stepsRes.rows.length === 0) {
      throw new Error('The active routing has no steps defined. Please configure steps for the routing.');
    }
    const routingSteps = stepsRes.rows;

    const poRes = await client.query(
      'INSERT INTO production_orders (code, product_id, qty_plan, start_plan, end_plan) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [code, product_id, qty_plan, start_plan ? new Date(start_plan) : null, end_plan ? new Date(end_plan) : null]
    );
    const poId = poRes.rows[0].id;

    for (const step of routingSteps) {
      await client.query(
        'INSERT INTO po_operations (po_id, step_no, operation_id, qty_plan) VALUES ($1, $2, $3, $4)',
        [poId, step.step_no, step.operation_id, qty_plan]
      );
    }

    await client.query('COMMIT');
    const newPoResult = await pool.query(
      `SELECT 
        po.id, 
        po.code, 
        po.product_id, 
        p.name as product_name,
        po.qty_plan, 
        po.start_plan, 
        po.end_plan, 
        po.status,
        0 as actual_qty, -- Newly created POs have 0 actual_qty
        0 as progress -- Newly created POs have 0 progress
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      WHERE po.id = $1`,
      [poId]
    );

    const newPo = newPoResult.rows[0];

    res.status(201).json({ message: 'Production order and operations created successfully', po: newPo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    if (err.code === '23505') {
      return res.status(400).json({ error: `Production Order with code '${code}' already exists.` });
    }
    if (err.message === 'Product not found.') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Cannot create order for an inactive product.' ||
        err.message === 'No active routing found for the selected product. Please ensure a routing is configured and active.' ||
        err.message === 'The active routing has no steps defined. Please configure steps for the routing.') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

exports.updateOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { code, product_id, qty_plan, start_plan, end_plan, status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE production_orders SET code = $1, product_id = $2, qty_plan = $3, start_plan = $4, end_plan = $5, status = $6 WHERE id = $7 RETURNING id',
            [code, product_id, qty_plan, start_plan ? new Date(start_plan) : null, end_plan ? new Date(end_plan) : null, status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Production order not found' });
        }

        const updatedPoId = result.rows[0].id;
        const updatedPoResult = await pool.query(
            `SELECT 
                po.id, 
                po.code, 
                po.product_id, 
                p.name as product_name,
                po.qty_plan, 
                po.start_plan, 
                po.end_plan, 
                po.status
            FROM production_orders po
            JOIN products p ON po.product_id = p.id
            WHERE po.id = $1`,
            [updatedPoId]
        );
        res.json(updatedPoResult.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getOrderProgress = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    const query = `
        WITH last_op AS (
            SELECT operation_id
            FROM po_operations
            WHERE po_id = $1
            ORDER BY step_no DESC
            LIMIT 1
        ),
        final_qty AS (
            SELECT SUM(pr.qty_ok) as total_final_ok
            FROM prod_reports pr
            WHERE pr.po_id = $1 AND pr.operation_id = (SELECT operation_id FROM last_op)
        )
        SELECT
            po.id as po_id,
            po.qty_plan,
            (SELECT total_final_ok FROM final_qty) as final_operation_ok,
            CASE
                WHEN po.qty_plan > 0 THEN (SELECT total_final_ok FROM final_qty) / po.qty_plan
                ELSE 0
            END as progress
        FROM production_orders po
        WHERE po.id = $1;
    `;

    try {
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Production order not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM production_orders WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Production order not found' });
        }
        res.json({ message: 'Production order deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};

