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

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user.userId;
  const requesterRole = req.user.role;

  if (requesterRole !== 'Admin' && Number(id) !== Number(requesterId)) {
    console.error(`AuthZ failed: Param ID=${id} (${typeof id}), Token ID=${requesterId} (${typeof requesterId}), Role=${requesterRole}`);
    return res.status(403).json({ message: 'Forbidden: You do not have permission to view this profile.' });
  }

  try {
    const result = await pool.query('SELECT id, username, role, name, team_id, is_active FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validation errors in createUser:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, role, name, team_id, is_active } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, name, team_id, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [username, hash, role, name, team_id, is_active]
    );
    const newUser = result.rows[0];
    const creatorId = req.user ? req.user.userId : null;
    await logToAudit('create', 'users', newUser.id, creatorId, req.body);
    res.status(201).json({ message: 'User created', userId: newUser.id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `User with username '${username}' already exists.` });
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
        const fields = [];
        const queryParams = [id];
        let paramIndex = 1;

        if (role !== undefined) {
            fields.push(`role = $${++paramIndex}`);
            queryParams.push(role);
        }
        if (name !== undefined) {
            fields.push(`name = $${++paramIndex}`);
            queryParams.push(name);
        }
        if (team_id !== undefined) {
            fields.push(`team_id = $${++paramIndex}`);
            queryParams.push(team_id);
        }
        if (is_active !== undefined) {
            fields.push(`is_active = $${++paramIndex}`);
            queryParams.push(is_active);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;

        const result = await pool.query(query, queryParams);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        await logToAudit('update', 'users', id, req.user.userId, req.body);
        res.json({ message: 'User updated successfully', user: result.rows[0] });

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
            return res.status(404).json({ message: 'User not found' });
        }

        await logToAudit('delete', 'users', id, req.user.userId, {});
        res.status(200).json({ message: 'User deactivated successfully' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updatePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { password } = req.body;

    console.log(`Updating password for user ID: ${id}`);
    console.log(`Plaintext password: ${password}`);

    try {
        const hash = await bcrypt.hash(password, 10);
        console.log(`Generated hash: ${hash}`);

        const result = await pool.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
            [hash, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        await logToAudit('update_password', 'users', id, req.user.userId, {});
        res.json({ message: 'Password updated successfully' });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
};