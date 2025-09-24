const pool = require('../config/db');
const { validationResult } = require('express-validator');
const { logToAudit } = require('../utils/audit');

// @desc    Get all operations
// @route   GET /api/operations
// @access  Private (Admin)
exports.getOperations = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operations WHERE is_active = TRUE ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single operation by ID
// @route   GET /api/operations/:id
// @access  Private (Admin)
exports.getOperationById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy Operation' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Create a new operation
// @route   POST /api/operations
// @access  Private (Admin)
exports.createOperation = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, machine_type, takt_target_sec } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO operations (code, name, machine_type, takt_target_sec) VALUES ($1, $2, $3, $4) RETURNING *',
      [code, name, machine_type, takt_target_sec]
    );
    const newOperation = result.rows[0];
    await logToAudit('create', 'operations', newOperation.id, req.user.id, req.body);
    res.status(201).json(newOperation);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Operation với mã '${code}' đã tồn tại.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Update an operation
// @route   PUT /api/operations/:id
// @access  Private (Admin)
exports.updateOperation = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, machine_type, takt_target_sec, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE operations SET code = $1, name = $2, machine_type = $3, takt_target_sec = $4, is_active = $5 WHERE id = $6 RETURNING *',
      [code, name, machine_type, takt_target_sec, is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy Operation' });
    }
    const updatedOperation = result.rows[0];
    await logToAudit('update', 'operations', updatedOperation.id, req.user.id, req.body);
    res.json(updatedOperation);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Operation với mã '${code}' đã tồn tại.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete an operation (soft delete)
// @route   DELETE /api/operations/:id
// @access  Private (Admin)
exports.deleteOperation = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE operations SET is_active = FALSE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy Operation' });
    }
    await logToAudit('delete', 'operations', req.params.id, req.user.id, {});
    res.status(200).json({ message: 'Operation đã hủy' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
