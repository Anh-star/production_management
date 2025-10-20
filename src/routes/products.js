const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
    deleteProduct,
    getProductsWithRouting,
  } = require('../controllers/productController');
  const auth = require('../middleware/auth');
  const authorize = require('../middleware/roles');
  
  const productValidation = [
    body('code', 'Product code is required').not().isEmpty(),
    body('name', 'Product name is required').not().isEmpty(),
    body('version', 'Version is required').not().isEmpty(),
    body('uom', 'Unit of measure is required').not().isEmpty(),
    body('is_active', 'is_active must be a boolean').optional().isBoolean(),
    body('routingSteps', 'Routing steps must be an array with at least one step').optional().isArray({ min: 1 }),
    body('routingSteps.*.step_no', 'Step number is required and must be an integer').optional().isInt(),
    body('routingSteps.*.operation_id', 'Operation ID is required and must be an integer').optional().isInt(),
    body('routingSteps.*.std_time_sec', 'Standard time is required and must be an integer').optional().isInt(),
  ];  
  
  router.get('/', auth, authorize(['Admin', 'Planner', 'QC']), getProducts);
  
  router.get('/with-routing', auth, authorize(['Admin', 'Planner', 'QC']), getProductsWithRouting);
  
  router.get('/:id', auth, authorize(['Admin', 'Planner', 'QC']), getProductById);

router.post('/', auth, authorize('Admin'), productValidation, createProduct);
router.put('/:id', auth, authorize(['Admin', 'Planner', 'QC']), productValidation, updateProduct);
router.delete('/:id', auth, authorize('Admin'), deleteProduct);

module.exports = router;
