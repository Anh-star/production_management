const { validationResult } = require('express-validator');
const pool = require('../config/db');

// @desc    Get all production orders
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM production_orders ORDER BY start_plan DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Get a single production order by ID with its operations
// @route   GET /api/orders/:id
// @access  Private
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
    res.status(500).json({ error: err.message });
  }
};

// @desc    Create a new production order and its operations
// @route   POST /api/orders
// @access  Private (Planner, Admin)
exports.createOrder = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, product_id, qty_plan, start_plan, end_plan } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const routingRes = await client.query(
      'SELECT id FROM routing_headers WHERE product_id = $1 AND is_active = TRUE',
      [product_id]
    );
    if (routingRes.rows.length === 0) {
      throw new Error('No active routing found for the selected product.');
    }
    const routingId = routingRes.rows[0].id;

    const stepsRes = await client.query(
      'SELECT * FROM routing_steps WHERE routing_id = $1 ORDER BY step_no',
      [routingId]
    );
    if (stepsRes.rows.length === 0) {
      throw new Error('The active routing has no steps defined.');
    }
    const routingSteps = stepsRes.rows;

    const poRes = await client.query(
      'INSERT INTO production_orders (code, product_id, qty_plan, start_plan, end_plan) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [code, product_id, qty_plan, start_plan, end_plan]
    );
    const poId = poRes.rows[0].id;

    for (const step of routingSteps) {
      await client.query(
        'INSERT INTO po_operations (po_id, step_no, operation_id, qty_plan) VALUES ($1, $2, $3, $4)',
        [poId, step.step_no, step.operation_id, qty_plan]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Production order and operations created successfully', po_id: poId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Transaction failed', details: err.message });
  } finally {
    client.release();
  }
};

// @desc    Update a production order's status or details
// @route   PUT /api/orders/:id
// @access  Private (Planner, Admin)
exports.updateOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { code, product_id, qty_plan, start_plan, end_plan, status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE production_orders SET code = $1, product_id = $2, qty_plan = $3, start_plan = $4, end_plan = $5, status = $6 WHERE id = $7 RETURNING *',
            [code, product_id, qty_plan, start_plan, end_plan, status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Production order not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
