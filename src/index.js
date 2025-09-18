const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./config/swagger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const shiftRoutes = require('./routes/shifts');
const operationRoutes = require('./routes/operations');
const defectCodeRoutes = require('./routes/defectCodes');
const routingRoutes = require('./routes/routings');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/operations', operationRoutes);
app.use('/api/defect-codes', defectCodeRoutes);
app.use('/api/routings', routingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
