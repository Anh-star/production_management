const pool = require('../config/db');
const { validationResult } = require('express-validator');

// @desc    Get all operations
// @route   GET /api/operations
// @access  Private (Admin)
exports.getOperations = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operations WHERE is_active = TRUE ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Get single operation by ID
// @route   GET /api/operations/:id
// @access  Private (Admin)
exports.getOperationById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Operation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Operation with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
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
      return res.status(404).json({ message: 'Operation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Operation with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
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
      return res.status(404).json({ message: 'Operation not found' });
    }
    res.status(200).json({ message: 'Operation deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
