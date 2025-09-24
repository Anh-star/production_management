const pool = require('../config/db');
const { validationResult } = require('express-validator');
const { logToAudit } = require('../utils/audit');

// @desc    Get all 
// @route   GET /api/defect-codes
// @access  Private (Admin)
exports.getDefectCodes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM defect_codes WHERE is_active = TRUE ORDER BY "group", name');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get defect code by ID
// @route   GET /api/defect-codes/:id
// @access  Private (Admin)
exports.getDefectCodeById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM defect_codes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy mã lỗi' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
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
    const newDefectCode = result.rows[0];
    await logToAudit('create', 'defect_codes', newDefectCode.id, req.user.id, req.body);
    res.status(201).json(newDefectCode);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Lỗi với mã '${code}' đã tồn tại.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
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
      return res.status(404).json({ message: 'Không tìm thấy mã lỗi' });
    }
    const updatedDefectCode = result.rows[0];
    await logToAudit('update', 'defect_codes', updatedDefectCode.id, req.user.id, req.body);
    res.json(updatedDefectCode);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Lỗi với mã '${code}' đã tồn tại.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
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
      return res.status(404).json({ message: 'Không tìm thấy mã lỗi' });
    }
    await logToAudit('delete', 'defect_codes', req.params.id, req.user.id, {});
    res.status(200).json({ message: 'Mã lỗi hủy thành công' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
