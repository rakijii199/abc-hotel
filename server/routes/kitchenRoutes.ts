/**
 * Kitchen Department Routes
 * Accessible by KITCHEN and ADMIN roles
 */
import { Router } from 'express';
import { KitchenController } from '../controllers/kitchenController.ts';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.ts';
import { validateBody } from '../middleware/errorHandler.ts';
import { updateOrderStatusSchema } from '../validators/index.ts';

export const kitchenRouter = Router();

// Guarded by Token Authentication and Role Check (KITCHEN, ADMIN, MANAGER, or STAFF)
kitchenRouter.use(authenticateToken);
kitchenRouter.use(requireRole('KITCHEN', 'ADMIN', 'MANAGER', 'STAFF'));

// Active Kitchen Tickets
kitchenRouter.get('/orders', KitchenController.getKitchenOrders);
kitchenRouter.put('/orders/:id/status', validateBody(updateOrderStatusSchema), KitchenController.updateOrderStatus);

// Kitchen Department Performance Stats
kitchenRouter.get('/stats', KitchenController.getKitchenStats);
