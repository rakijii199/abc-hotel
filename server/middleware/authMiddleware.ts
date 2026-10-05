/**
 * Authentication & Authorization Middlewares
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.ts';
import { SafeUser, UserRole } from '../types/index.ts';
import { UserRepository } from '../repositories/userRepository.ts';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing. Please log in.'
      }
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { id: string };
    const user = await UserRepository.findById(decoded.id);

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with this token no longer exists.'
        }
      });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account is suspended.'
        }
      });
      return;
    }

    req.user = UserRepository.toSafeUser(user);
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired or is invalid. Please log in again.'
      }
    });
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.'
        }
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.'
        }
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { id: string };
      const user = await UserRepository.findById(decoded.id);
      if (user && user.status === 'ACTIVE') {
        req.user = UserRepository.toSafeUser(user);
      }
    } catch {
      // ignore optional auth failure
    }
  }
  next();
};
