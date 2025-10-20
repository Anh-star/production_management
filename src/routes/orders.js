const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  getOrderProgress,
  deleteOrder,
} = require('../controllers/orderController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const orderValidation = [
  body('code', 'Order code is required').not().isEmpty(),
  body('product_id', 'Product ID must be an integer').isInt(),
  body('qty_plan', 'Planned quantity must be a positive number').isInt({ gt: 0 }),
  body('start_plan', 'Planned start date is required').isISO8601(),
  body('end_plan', 'Planned end date is required').isISO8601(),
];

const orderUpdateValidation = [
    ...orderValidation,
    body('status', 'Status is required').not().isEmpty(),
];

const idParamValidation = [
    param('id', 'Order ID must be an integer').isInt()
];

router.get('/', auth, authorize(['Admin', 'Planner', 'QC', 'Operator']), getOrders);

router.get('/:id', auth, authorize(['Admin', 'Planner', 'QC', 'Operator']), idParamValidation, getOrderById);

router.get('/:id/progress', auth, authorize(['Admin', 'Planner', 'QC', 'Operator']), idParamValidation, getOrderProgress);

router.post('/', auth, authorize(['Admin', 'Planner']), orderValidation, createOrder);

router.put('/:id', auth, authorize(['Admin', 'Planner']), orderUpdateValidation, updateOrder);

router.delete('/:id', auth, authorize(['Admin', 'Planner']), idParamValidation, deleteOrder);

module.exports = router;