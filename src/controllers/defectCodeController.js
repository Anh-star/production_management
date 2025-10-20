const pool = require('../config/db');
const { validationResult } = require('express-validator');
const { logToAudit } = require('../utils/audit');

exports.getDefectCodes = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, code, name, "group", severity, is_active FROM defect_codes ORDER BY "group", name');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getDefectCodeById = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, code, name, "group", severity, is_active FROM defect_codes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Defect code not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createDefectCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, group, severity } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO defect_codes (code, name, "group", severity) VALUES ($1, $2, $3, $4) RETURNING *',
      [code, name, group, severity]
    );
    const newDefectCode = result.rows[0];
    await logToAudit('create', 'defect_codes', newDefectCode.id, req.user.id, req.body);
    res.status(201).json(newDefectCode);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Defect code with code '${code}' already exists.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateDefectCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, group, severity, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE defect_codes SET code = $1, name = $2, "group" = $3, severity = $4, is_active = $5 WHERE id = $6 RETURNING *',
      [code, name, group, severity, is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Defect code not found' });
    }
    const updatedDefectCode = result.rows[0];
    await logToAudit('update', 'defect_codes', updatedDefectCode.id, req.user.id, req.body);
    res.json(updatedDefectCode);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Defect code with code '${code}' already exists.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteDefectCode = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE defect_codes SET is_active = FALSE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Defect code not found' });
    }
    await logToAudit('delete', 'defect_codes', req.params.id, req.user.id, {});
    res.status(200).json({ message: 'Defect code deactivated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
