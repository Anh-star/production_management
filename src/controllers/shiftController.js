const pool = require('../config/db');
const { validationResult } = require('express-validator');

// @desc    Get all shifts
// @route   GET /api/shifts
// @access  Private (Admin)
exports.getShifts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shifts ORDER BY start_time');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Get single shift by ID
// @route   GET /api/shifts/:id
// @access  Private (Admin)
exports.getShiftById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shifts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Create a new shift
// @route   POST /api/shifts
// @access  Private (Admin)
exports.createShift = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, start_time, end_time } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO shifts (code, name, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [code, name, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Shift with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
};

// @desc    Update a shift
// @route   PUT /api/shifts/:id
// @access  Private (Admin)
exports.updateShift = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, start_time, end_time } = req.body;
  try {
    const result = await pool.query(
      'UPDATE shifts SET code = $1, name = $2, start_time = $3, end_time = $4 WHERE id = $5 RETURNING *',
      [code, name, start_time, end_time, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Shift with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
};

// @desc    Delete a shift
// @route   DELETE /api/shifts/:id
// @access  Private (Admin)
exports.deleteShift = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.status(200).json({ message: 'Shift deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
