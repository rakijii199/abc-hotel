/**
 * Auth & User Routes
 */
import { Router } from 'express';
import { AuthController, UserController } from '../controllers/authController.ts';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware.ts';
import { validateBody, authRateLimiter } from '../middleware/errorHandler.ts';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  registerCustomerPhoneSchema,
  loginCustomerPhoneSchema
} from '../validators/index.ts';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter(15), validateBody(registerSchema), AuthController.register);
authRouter.post('/customer/register', authRateLimiter(15), validateBody(registerCustomerPhoneSchema), AuthController.registerCustomerPhone);
authRouter.post('/customer/login', authRateLimiter(20), validateBody(loginCustomerPhoneSchema), AuthController.loginCustomerPhone);
authRouter.post('/login', authRateLimiter(20), validateBody(loginSchema), AuthController.login);
authRouter.get('/me', authenticateToken, AuthController.me);
authRouter.post('/logout', optionalAuth, AuthController.logout);

export const userRouter = Router();

userRouter.use(authenticateToken);
userRouter.get('/me', UserController.getProfile);
userRouter.put('/me', validateBody(updateProfileSchema), UserController.updateProfile);
userRouter.put('/me/password', validateBody(changePasswordSchema), UserController.changePassword);
