/**
 * Manager Routes with Strict RBAC (Role = MANAGER or ADMIN)
 */
import { Router } from 'express';
import { ManagerController } from '../controllers/managerController.ts';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.ts';
import { validateBody } from '../middleware/errorHandler.ts';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  resetEmployeePasswordSchema
} from '../validators/index.ts';

export const managerRouter = Router();

// Enforce authentication & strict MANAGER or ADMIN role (staff does NOT have employee management)
managerRouter.use(authenticateToken);
managerRouter.use(requireRole('MANAGER', 'ADMIN'));

// Manager Executive Stats
managerRouter.get('/stats', ManagerController.getManagerStats);

// Employee Management Endpoints
managerRouter.get('/employees', ManagerController.getEmployees);
managerRouter.post('/employees', validateBody(createEmployeeSchema), ManagerController.createEmployee);
managerRouter.get('/employees/:id', ManagerController.getEmployeeById);
managerRouter.put('/employees/:id', validateBody(updateEmployeeSchema), ManagerController.updateEmployee);
managerRouter.patch('/employees/:id/status', ManagerController.updateEmployeeStatus);
managerRouter.post('/employees/:id/reset-password', validateBody(resetEmployeePasswordSchema), ManagerController.resetEmployeePassword);
managerRouter.delete('/employees/:id', ManagerController.deleteEmployee);
