const pool = require('../config/db');
const { validationResult } = require('express-validator');
const { logToAudit } = require('../utils/audit');

exports.getShifts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shifts ORDER BY start_time');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getShiftById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shifts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

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
    const newShift = result.rows[0];
    await logToAudit('create', 'shifts', newShift.id, req.user.id, req.body);
    res.status(201).json(newShift);
  } catch (err) {
    if (err.code === '23505') { 
      return res.status(400).json({ message: `Shift with code '${code}' already exists.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

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
    const updatedShift = result.rows[0];
    await logToAudit('update', 'shifts', updatedShift.id, req.user.id, req.body);
    res.json(updatedShift);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Shift with code '${code}' already exists.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteShift = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM shifts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    await logToAudit('delete', 'shifts', req.params.id, req.user.id, {});
    res.status(200).json({ message: 'Shift deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
