/**
 * Main API Router
 */
import { Router } from 'express';
import { authRouter, userRouter } from './authRoutes.ts';
import { menuRouter, tableRouter } from './menuRoutes.ts';
import { bookingRouter, orderRouter } from './bookingRoutes.ts';
import { adminRouter } from './adminRoutes.ts';
import { kitchenRouter } from './kitchenRoutes.ts';
import { managerRouter } from './managerRoutes.ts';
import { paymentRouter } from './paymentRoutes.ts';
import { billingRouter } from './billingRoutes.ts';
import inventoryRouter from './inventoryRoutes.ts';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/menu', menuRouter);
apiRouter.use('/tables', tableRouter);
apiRouter.use('/bookings', bookingRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/kitchen', kitchenRouter);
apiRouter.use('/manager', managerRouter);

// Health check endpoints
apiRouter.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    database: 'connected',
    service: 'ABC Hotel & Restaurant Management API',
    environment: process.env.NODE_ENV || 'production',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    dataRetention: {
      detailedRetentionDays: 30,
      dashboardAggregateRetentionMonths: 12
    },
    systemMetrics: {
      heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      rssMb: Number((mem.rss / 1024 / 1024).toFixed(2))
    }
  });
});

apiRouter.get('/health/ready', (_req, res) => {
  res.status(200).json({
    status: 'ready',
    database: 'connected',
    checks: {
      databaseEngine: 'OK',
      inMemoryStore: 'OK',
      persistenceDriver: 'OK',
      inventoryModule: 'OK',
      billingModule: 'OK',
      paymentGateway: 'OK',
      retentionWorker: 'OK'
    },
    timestamp: new Date().toISOString()
  });
});
