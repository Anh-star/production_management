const { validationResult } = require('express-validator');
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { logToAudit } = require('../utils/audit');

exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, name, team_id, is_active FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, role, name, team_id } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, name, team_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, hash, role, name, team_id]
    );
    const newUser = result.rows[0];
    const creatorId = req.user ? req.user.id : null;
    await logToAudit('create', 'users', newUser.id, creatorId, req.body);
    res.status(201).json({ message: 'Người dùng đã tạo', userId: newUser.id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Người dùng tên '${username}' đã tồn tại.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { role, name, team_id, is_active } = req.body;

    try {
        const result = await pool.query(
            'UPDATE users SET role = $1, name = $2, team_id = $3, is_active = $4 WHERE id = $5 RETURNING *',
            [role, name, team_id, is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Người dùng không được tìm thấy' });
        }
        
        await logToAudit('update', 'users', id, req.user.id, req.body);
        res.json({ message: 'Người dùng đã cập nhật thành công', user: result.rows[0] });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE users SET is_active = FALSE WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Người dùng không được tìm thấy' });
        }

        await logToAudit('delete', 'users', id, req.user.id, {});
        res.status(200).json({ message: 'Người dùng đã hủy kích hoạt thành công' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};