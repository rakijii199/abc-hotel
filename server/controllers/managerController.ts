/**
 * Manager Controller for Hotel Operations & Employee Management
 * Role-Based Access Control: Exclusively for Hotel Managers and Operations Staff
 */
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { AuditRepository } from '../repositories/auditRepository.ts';
import { OrderRepository } from '../repositories/orderRepository.ts';
import { TableRepository } from '../repositories/tableRepository.ts';
import { User, UserRole, UserStatus } from '../types/index.ts';

export class ManagerController {
  /**
   * Get all hotel employees with search & role/status filters
   */
  public static async getEmployees(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { role, status, search } = req.query;
      const employees = await UserRepository.findEmployees({
        role: typeof role === 'string' ? role : undefined,
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined
      });

      const safeEmployees = employees.map(UserRepository.toSafeUser);
      res.status(200).json({
        success: true,
        data: safeEmployees
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_EMPLOYEES_FAILED', message: err.message }
      });
    }
  }

  /**
   * Get employee by ID
   */
  public static async getEmployeeById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await UserRepository.findById(id);

      if (!user || user.role === 'CUSTOMER') {
        res.status(404).json({
          success: false,
          error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee account not found.' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: UserRepository.toSafeUser(user)
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: err.message }
      });
    }
  }

  /**
   * Create a new employee with unique username and email
   */
  public static async createEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { firstName, lastName, username, email, phone, password, role, status } = req.body;

      const cleanUsername = (username || '').toLowerCase().trim();
      const cleanEmail = (email || '').toLowerCase().trim();

      // Check unique username
      if (cleanUsername) {
        const existingUsername = await UserRepository.findByUsername(cleanUsername);
        if (existingUsername) {
          res.status(400).json({
            success: false,
            error: { code: 'USERNAME_EXISTS', message: `Username "${cleanUsername}" is already taken.` }
          });
          return;
        }
      }

      // Check unique email
      const existingEmail = await UserRepository.findByEmail(cleanEmail);
      if (existingEmail) {
        res.status(400).json({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: `An account with email "${cleanEmail}" already exists.` }
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password || 'Password@123', 10);
      const employeeId = `usr-emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const newEmployee: User = {
        id: employeeId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        phone: phone.trim(),
        passwordHash,
        role: role as UserRole,
        status: (status as UserStatus) || 'ACTIVE',
        createdBy: req.user?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await UserRepository.create(newEmployee);

      // Record audit log
      if (req.user) {
        AuditRepository.record({
          adminId: req.user.id,
          adminEmail: req.user.email,
          action: 'CREATE_EMPLOYEE',
          entity: 'EMPLOYEE',
          entityId: newEmployee.id,
          newValue: {
            name: `${newEmployee.firstName} ${newEmployee.lastName}`,
            username: newEmployee.username,
            role: newEmployee.role,
            email: newEmployee.email
          }
        });
      }

      res.status(201).json({
        success: true,
        data: UserRepository.toSafeUser(newEmployee),
        message: `Employee "${newEmployee.firstName} ${newEmployee.lastName}" created successfully.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_EMPLOYEE_FAILED', message: err.message }
      });
    }
  }

  /**
   * Update employee details (Name, Phone, Role, Status)
   */
  public static async updateEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, phone, role, status } = req.body;

      const user = await UserRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found.' }
        });
        return;
      }

      // Check unique email if email changed
      if (email && email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
        const existingEmail = await UserRepository.findByEmail(email.toLowerCase().trim());
        if (existingEmail && existingEmail.id !== id) {
          res.status(400).json({
            success: false,
            error: { code: 'EMAIL_EXISTS', message: `Email "${email}" is already used by another account.` }
          });
          return;
        }
      }

      const updates: Partial<User> = {};
      if (firstName !== undefined) updates.firstName = firstName.trim();
      if (lastName !== undefined) updates.lastName = lastName.trim();
      if (email !== undefined) updates.email = email.toLowerCase().trim();
      if (phone !== undefined) updates.phone = phone.trim();
      if (role !== undefined) updates.role = role as UserRole;
      if (status !== undefined) updates.status = status as UserStatus;

      const updated = await UserRepository.update(id, updates);

      if (req.user && updated) {
        AuditRepository.record({
          adminId: req.user.id,
          adminEmail: req.user.email,
          action: 'UPDATE_EMPLOYEE',
          entity: 'EMPLOYEE',
          entityId: id,
          oldValue: { role: user.role, status: user.status },
          newValue: { role: updated.role, status: updated.status }
        });
      }

      res.status(200).json({
        success: true,
        data: updated ? UserRepository.toSafeUser(updated) : null,
        message: 'Employee updated successfully.'
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_EMPLOYEE_FAILED', message: err.message }
      });
    }
  }

  /**
   * Toggle or update employee status (ACTIVE <-> INACTIVE)
   */
  public static async updateEmployeeStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Status must be ACTIVE, INACTIVE, or SUSPENDED.' }
        });
        return;
      }

      // Prevent deactivating own account
      if (req.user?.id === id && status !== 'ACTIVE') {
        res.status(400).json({
          success: false,
          error: { code: 'CANNOT_DEACTIVATE_SELF', message: 'You cannot deactivate your own active session.' }
        });
        return;
      }

      const user = await UserRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Employee not found.' }
        });
        return;
      }

      const updates: Partial<User> = {
        status: status as UserStatus,
        deactivatedAt: status === 'INACTIVE' ? new Date().toISOString() : undefined,
        deactivatedBy: status === 'INACTIVE' ? req.user?.id : undefined
      };

      const updated = await UserRepository.update(id, updates);

      if (req.user && updated) {
        AuditRepository.record({
          adminId: req.user.id,
          adminEmail: req.user.email,
          action: 'CHANGE_EMPLOYEE_STATUS',
          entity: 'EMPLOYEE',
          entityId: id,
          oldValue: { status: user.status },
          newValue: { status: updated.status }
        });
      }

      res.status(200).json({
        success: true,
        data: updated ? UserRepository.toSafeUser(updated) : null,
        message: `Employee status changed to ${status}.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'STATUS_UPDATE_FAILED', message: err.message }
      });
    }
  }

  /**
   * Reset employee password by Manager
   */
  public static async resetEmployeePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      const user = await UserRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Employee not found.' }
        });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await UserRepository.update(id, { passwordHash });

      if (req.user) {
        AuditRepository.record({
          adminId: req.user.id,
          adminEmail: req.user.email,
          action: 'RESET_EMPLOYEE_PASSWORD',
          entity: 'EMPLOYEE',
          entityId: id,
          newValue: { resetBy: req.user.email }
        });
      }

      res.status(200).json({
        success: true,
        message: `Password for ${user.firstName} ${user.lastName} has been reset successfully.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'PASSWORD_RESET_FAILED', message: err.message }
      });
    }
  }

  /**
   * Delete / Soft-Remove an employee
   */
  public static async deleteEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      if (req.user?.id === id) {
        res.status(400).json({
          success: false,
          error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account.' }
        });
        return;
      }

      const user = await UserRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Employee not found.' }
        });
        return;
      }

      await UserRepository.softRemove(id, req.user?.id || 'manager', reason);

      if (req.user) {
        AuditRepository.record({
          adminId: req.user.id,
          adminEmail: req.user.email,
          action: 'DELETE_EMPLOYEE',
          entity: 'EMPLOYEE',
          entityId: id,
          oldValue: { name: `${user.firstName} ${user.lastName}`, role: user.role }
        });
      }

      res.status(200).json({
        success: true,
        message: `Employee "${user.firstName} ${user.lastName}" removed from system.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: err.message }
      });
    }
  }

  /**
   * Manager Dashboard Overview Stats
   */
  public static async getManagerStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const employeeStats = await UserRepository.getEmployeeStats();
      const allOrders = await OrderRepository.getAll();
      const allTables = await TableRepository.getAll();
      const todayStr = new Date().toISOString().split('T')[0];

      const todayOrders = allOrders.filter((o) => (o.createdAt || '').startsWith(todayStr));
      const todayRevenue = todayOrders
        .filter((o) => o.paymentStatus === 'PAID')
        .reduce((sum, o) => sum + (o.total || 0), 0);
      const activeTables = allTables.filter((t) => t.status === 'OCCUPIED' || t.status === 'RESERVED').length;

      res.status(200).json({
        success: true,
        data: {
          employeeStats,
          todayOrdersCount: todayOrders.length,
          todayRevenue,
          activeTables,
          pendingDeliveries: allOrders.filter((o) => o.status === 'READY' || o.status === 'DELIVERY_ACCEPTED' || o.status === 'OUT_FOR_DELIVERY').length
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_STATS_FAILED', message: err.message }
      });
    }
  }
}
