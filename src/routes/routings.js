const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  createRouting,
  getActiveRoutingForProduct,
} = require('../controllers/routingController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');

const routingValidation = [
  body('product_id', 'Product ID is required').isInt(),
  body('version', 'Version is required').not().isEmpty(),
  body('steps', 'Routing steps must be an array with at least one step').isArray({ min: 1 }),
  body('steps.*.step_no', 'Step number is required and must be an integer').isInt(),
  body('steps.*.operation_id', 'Operation ID is required and must be an integer').isInt(),
  body('steps.*.std_time_sec', 'Standard time is required and must be an integer').isInt(),
];
router.post('/', auth, authorize(['Admin', 'Planner']), routingValidation, createRouting);
router.get('/product/:productId', auth, getActiveRoutingForProduct);

module.exports = router;
