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
import { db } from '../database/db.ts';
import { isQuotaExhausted } from '../database/firestoreSync.ts';

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

// Health check endpoints. Liveness is public and minimal; readiness reports
// whether this instance can actually serve data (used by Cloud Run probes).
apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'ABC Hotel & Restaurant Management API',
    timestamp: new Date().toISOString()
  });
});

apiRouter.get('/health/ready', (_req, res) => {
  const databaseReady = db.isInitialized;
  const firestoreThrottled = isQuotaExhausted();
  const ready = databaseReady && !firestoreThrottled;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      databaseEngine: databaseReady ? 'OK' : 'INITIALIZING',
      firestore: firestoreThrottled ? 'THROTTLED' : 'OK'
    },
    timestamp: new Date().toISOString()
  });
});
