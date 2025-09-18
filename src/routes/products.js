const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const productValidation = [
  body('code', 'Product code is required').not().isEmpty(),
  body('name', 'Product name is required').not().isEmpty(),
  body('version', 'Version is required').not().isEmpty(),
  body('uom', 'Unit of measure is required').not().isEmpty(),
  body('is_active', 'is_active must be a boolean').optional().isBoolean(),
];
router.get('/', auth, getProducts);
router.get('/:id', auth, getProductById);
router.post('/', auth, authorize('Admin'), productValidation, createProduct);
router.put('/:id', auth, authorize('Admin'), productValidation, updateProduct);
router.delete('/:id', auth, authorize('Admin'), deleteProduct);

module.exports = router;
