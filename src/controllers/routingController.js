const pool = require('../config/db');
const { validationResult } = require('express-validator');
const { logToAudit } = require('../utils/audit');

// @desc    Create a new routing for a product
// @route   POST /api/routings
// @access  Private (Planner, Admin)
exports.createRouting = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { product_id, version, steps } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE routing_headers SET is_active = FALSE WHERE product_id = $1 AND version = $2',
      [product_id, version]
    );

    const headerResult = await client.query(
      'INSERT INTO routing_headers (product_id, version, is_active) VALUES ($1, $2, TRUE) RETURNING id',
      [product_id, version]
    );
    const routingId = headerResult.rows[0].id;

    for (const step of steps) {
      await client.query(
        'INSERT INTO routing_steps (routing_id, step_no, operation_id, std_time_sec) VALUES ($1, $2, $3, $4)',
        [routingId, step.step_no, step.operation_id, step.std_time_sec]
      );
    }

    await client.query('COMMIT');
    
    await logToAudit('create', 'routing_headers', routingId, req.user.id, req.body, client);

    res.status(201).json({ message: 'Tuyến được tạo thành công', routing_id: routingId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

// @desc    Get the active routing for a product
// @route   GET /api/routings/product/:productId
// @access  Private
exports.getActiveRoutingForProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const headerResult = await pool.query(
      'SELECT * FROM routing_headers WHERE product_id = $1 AND is_active = TRUE',
      [productId]
    );

    if (headerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tuyến hoạt động cho sản phẩm này.' });
    }
    const routingHeader = headerResult.rows[0];

    const stepsResult = await pool.query(
      'SELECT rs.step_no, rs.operation_id, op.name as operation_name, rs.std_time_sec FROM routing_steps rs JOIN operations op ON rs.operation_id = op.id WHERE rs.routing_id = $1 ORDER BY rs.step_no',
      [routingHeader.id]
    );

    res.json({ ...routingHeader, steps: stepsResult.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
