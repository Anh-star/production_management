const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  getOrderProgress,
} = require('../controllers/orderController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const orderValidation = [
  body('code', 'Mã đơn hàng là bắt buộc').not().isEmpty(),
  body('product_id', 'Mã sản phẩm phải là một số nguyên').isInt(),
  body('qty_plan', 'Số lượng dự kiến phải là một số dương').isInt({ gt: 0 }),
  body('start_plan', 'Cần có ngày bắt đầu đã được lên kế hoạch').isISO8601().toDate(),
  body('end_plan', 'Cần có ngày kết thúc đã được lên kế hoạch').isISO8601().toDate(),
];

const orderUpdateValidation = [
    ...orderValidation,
    body('status', 'Trạng thái là bắt buộc').not().isEmpty(),
];

const idParamValidation = [
    param('id', 'ID đơn hàng phải là số nguyên').isInt()
];
router.get('/', auth, getOrders);
router.get('/:id', auth, idParamValidation, getOrderById);
router.get('/:id/progress', auth, idParamValidation, getOrderProgress);
router.post('/', auth, authorize(['Admin', 'Planner']), orderValidation, createOrder);
router.put('/:id', auth, authorize(['Admin', 'Planner']), orderUpdateValidation, updateOrder);

module.exports = router;
