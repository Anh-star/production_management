const { validationResult } = require('express-validator');
const pool = require('../config/db');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE is_active = TRUE ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Private
exports.getProductById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private (Admin)
exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, version, uom, quality_spec_json } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (code, name, version, uom, quality_spec_json) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [code, name, version, uom, quality_spec_json]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Product with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private (Admin)
exports.updateProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, version, uom, quality_spec_json, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET code = $1, name = $2, version = $3, uom = $4, quality_spec_json = $5, is_active = $6 WHERE id = $7 RETURNING *',
      [code, name, version, uom, quality_spec_json, is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Product with code '${code}' already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
};

// @desc    Delete a product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private (Admin)
exports.deleteProduct = async (req, res) => {
  try {

    const result = await pool.query(
      'UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json({ message: 'Product deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
