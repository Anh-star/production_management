const pool = require('../config/db');
const { validationResult } = require('express-validator');

// @desc    Get all defect codes
// @route   GET /api/defect-codes
// @access  Private (Admin)
exports.getDefectCodes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM defect_codes WHERE is_active = TRUE ORDER BY "group", name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Get single defect code by ID
// @route   GET /api/defect-codes/:id
// @access  Private (Admin)
exports.getDefectCodeById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM defect_codes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Defect code not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Create a new defect code
// @route   POST /api/defect-codes
// @access  Private (Admin)
exports.createDefectCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, group } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO defect_codes (code, name, "group") VALUES ($1, $2, $3) RETURNING *',
      [code, name, group]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Defect code with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
};

// @desc    Update a defect code
// @route   PUT /api/defect-codes/:id
// @access  Private (Admin)
exports.updateDefectCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, group, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE defect_codes SET code = $1, name = $2, "group" = $3, is_active = $4 WHERE id = $5 RETURNING *',
      [code, name, group, is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Defect code not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Defect code with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
};

// @desc    Delete a defect code (soft delete)
// @route   DELETE /api/defect-codes/:id
// @access  Private (Admin)
exports.deleteDefectCode = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE defect_codes SET is_active = FALSE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Defect code not found' });
    }
    res.status(200).json({ message: 'Defect code deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
