const { validationResult } = require('express-validator');
const pool = require('../config/db');
const { logToAudit } = require('../utils/audit');

exports.getProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code, name, version, uom, quality_spec_json, routingSteps } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      'INSERT INTO products (code, name, version, uom, quality_spec_json) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, name, version, uom, quality_spec_json, is_active',
      [code, name, version, uom, quality_spec_json]
    );
    const newProduct = productResult.rows[0];

    if (routingSteps && routingSteps.length > 0) {
      await client.query(
        'UPDATE routing_headers SET is_active = FALSE WHERE product_id = $1',
        [newProduct.id]
      );

      const headerResult = await client.query(
        'INSERT INTO routing_headers (product_id, version, is_active) VALUES ($1, $2, TRUE) RETURNING id',
        [newProduct.id, newProduct.version || '1.0']
      );
      const routingId = headerResult.rows[0].id;

      for (const step of routingSteps) {
        await client.query(
          'INSERT INTO routing_steps (routing_id, step_no, operation_id, std_time_sec) VALUES ($1, $2, $3, $4)',
          [routingId, step.step_no, step.operation_id, step.std_time_sec]
        );
      }
    }

    await client.query('COMMIT');
    await logToAudit('create', 'products', newProduct.id, req.user.id, req.body);
    res.status(201).json(newProduct);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({ message: `Product with code '${code}' already exists.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

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
    const updatedProduct = result.rows[0];
    await logToAudit('update', 'products', updatedProduct.id, req.user.id, req.body);
    res.json(updatedProduct);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: `Product with code '${code}' already exists.` });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await logToAudit('delete', 'products', req.params.id, req.user.id, {});
    res.status(200).json({ message: 'Product deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProductsWithRouting = async (req, res) => {
  try {
    const productsResult = await pool.query('SELECT id, code, name, version, uom, is_active FROM products ORDER BY name');
    const productsWithRouting = await Promise.all(productsResult.rows.map(async (product) => {
      const routingRes = await pool.query(
        'SELECT id FROM routing_headers WHERE product_id = $1 AND is_active = TRUE',
        [product.id]
      );
      return { ...product, has_active_routing: routingRes.rows.length > 0 };
    }));
    res.json(productsWithRouting);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
