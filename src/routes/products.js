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
  body('code', 'Mã sản phẩm là bắt buộc').not().isEmpty(),
  body('name', 'Tên sản phẩm là bắt buộc').not().isEmpty(),
  body('version', 'Cần có phiên bản').not().isEmpty(),
  body('uom', 'Cần có đơn vị đo lường').not().isEmpty(),
  body('is_active', 'is_active phải là một giá trị boolean').optional().isBoolean(),
];
router.get('/', auth, getProducts);
router.get('/:id', auth, getProductById);
router.post('/', auth, authorize('Admin'), productValidation, createProduct);
router.put('/:id', auth, authorize('Admin'), productValidation, updateProduct);
router.delete('/:id', auth, authorize('Admin'), deleteProduct);

module.exports = router;
