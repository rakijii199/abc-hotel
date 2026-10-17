/**
 * Manager Routes with Strict RBAC (Role = MANAGER or ADMIN)
 */
import { Router } from 'express';
import { ManagerController } from '../controllers/managerController.ts';
import { authenticateToken, requireAccess, requireAnyAccess, requireSuperAdmin } from '../middleware/authMiddleware.ts';
import { validateBody } from '../middleware/errorHandler.ts';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  resetEmployeePasswordSchema,
  updateRoleAccessSchema
} from '../validators/index.ts';

export const managerRouter = Router();

// User Management: viewing needs User Management access; every change to
// users, roles, privileges or access requires a Super Admin.
managerRouter.use(authenticateToken);
const USERS_VIEW = requireAccess('USERS', 'VIEW');
const ACCESS_VIEW = requireAnyAccess([['USERS', 'VIEW'], ['ROLES', 'VIEW'], ['PRIVILEGES', 'VIEW'], ['ACCESS_CONTROL', 'VIEW']]);

// Manager Executive Stats
managerRouter.get('/stats', USERS_VIEW, ManagerController.getManagerStats);

// Employee Management Endpoints
managerRouter.get('/employees', USERS_VIEW, ManagerController.getEmployees);
managerRouter.post('/employees', requireSuperAdmin, validateBody(createEmployeeSchema), ManagerController.createEmployee);
managerRouter.get('/employees/:id', USERS_VIEW, ManagerController.getEmployeeById);
managerRouter.put('/employees/:id', requireSuperAdmin, validateBody(updateEmployeeSchema), ManagerController.updateEmployee);
managerRouter.patch('/employees/:id/status', requireSuperAdmin, ManagerController.updateEmployeeStatus);
managerRouter.post('/employees/:id/reset-password', requireSuperAdmin, validateBody(resetEmployeePasswordSchema), ManagerController.resetEmployeePassword);
managerRouter.delete('/employees/:id', requireSuperAdmin, ManagerController.deleteEmployee);

// Roles, Privileges & Access Control
managerRouter.get('/access', ACCESS_VIEW, ManagerController.getAccessOverview);
managerRouter.put('/access/roles/:role', requireSuperAdmin, validateBody(updateRoleAccessSchema), ManagerController.updateRoleAccess);
