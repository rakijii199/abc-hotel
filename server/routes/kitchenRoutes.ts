/**
 * Kitchen Department Routes
 * Accessible by KITCHEN and ADMIN roles
 */
import { Router } from 'express';
import { KitchenController } from '../controllers/kitchenController.ts';
import { authenticateToken, requireAccess } from '../middleware/authMiddleware.ts';
import { validateBody } from '../middleware/errorHandler.ts';
import { updateOrderStatusSchema } from '../validators/index.ts';

export const kitchenRouter = Router();

// Kitchen Display: VIEW to see tickets, FULL to advance them (Super Admins pass).
kitchenRouter.use(authenticateToken);

// Active Kitchen Tickets
kitchenRouter.get('/orders', requireAccess('KITCHEN', 'VIEW'), KitchenController.getKitchenOrders);
kitchenRouter.put('/orders/:id/status', requireAccess('KITCHEN', 'FULL'), validateBody(updateOrderStatusSchema), KitchenController.updateOrderStatus);

// Kitchen Department Performance Stats
kitchenRouter.get('/stats', requireAccess('KITCHEN', 'VIEW'), KitchenController.getKitchenStats);
