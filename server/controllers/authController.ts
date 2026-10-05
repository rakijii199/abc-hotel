/**
 * Auth and User Controllers
 */
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { AuthService } from '../services/authService.ts';

export class AuthController {
  public static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Account created successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async registerCustomerPhone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.registerCustomerPhone(req.body);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Customer registered successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async loginCustomerPhone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.loginCustomerPhone(req.body);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Customer login successful.'
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Login successful.'
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated.'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: req.user
    });
  }

  public static async logout(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  }
}

export class UserController {
  public static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' }
      });
      return;
    }

    const user = AuthService.getUserById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  }

  public static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' }
      });
      return;
    }

    try {
      const updated = await AuthService.updateProfile(req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Profile updated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' }
      });
      return;
    }

    try {
      await AuthService.changePassword(req.user.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Password changed successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: err.message
        }
      });
    }
  }
}
