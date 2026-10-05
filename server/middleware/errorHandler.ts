/**
 * Error Handling, Validation, and Rate Limiting Middlewares
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import rateLimit from 'express-rate-limit';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data.',
            details: err.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message
            }))
          }
        });
        return;
      }
      next(err);
    }
  };
};

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Sanitize internal server logging
  const safeMessage = err?.message || 'Unknown error';
  console.error('[SERVER ERROR]', isProduction ? safeMessage : err);

  const status = err.statusCode || (err.status >= 400 && err.status < 600 ? err.status : 500);

  // In production, mask internal server error details to prevent reconnaissance
  let clientMessage = safeMessage;
  if (status >= 500) {
    clientMessage = 'An internal server error occurred. Please try again later.';
  } else {
    // Sanitize any accidental filesystem paths or internal tokens
    clientMessage = clientMessage.replace(/\/[\w.-]+/g, '[path]').replace(/[a-zA-Z0-9_-]{32,}/g, '[redacted]');
  }

  res.status(status).json({
    success: false,
    error: {
      code: err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
      message: clientMessage,
      ...(isProduction ? {} : { details: err.details })
    }
  });
};

/**
 * Standard Rate Limiter for Authentication & OTP endpoints
 * Restricts brute-force and credential stuffing attacks
 */
export const authRateLimiter = (maxRequests = 20, windowMs = 15 * 60 * 1000) => {
  return rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' || process.env.IS_TEST_RUN === 'true',
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please wait a few minutes and try again.'
      }
    }
  });
};

/**
 * Rate Limiter for Order Creation to prevent denial-of-inventory attacks
 */
export const orderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.IS_TEST_RUN === 'true',
  message: {
    success: false,
    error: {
      code: 'ORDER_RATE_LIMIT',
      message: 'Too many orders placed from this network. Please wait a few minutes before ordering again.'
    }
  }
});

/**
 * Rate Limiter for Payment Operations
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.IS_TEST_RUN === 'true',
  message: {
    success: false,
    error: {
      code: 'PAYMENT_RATE_LIMIT',
      message: 'Too many payment requests. Please wait a few minutes and try again.'
    }
  }
});

/**
 * General API Limiter for whole API surface
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 250,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.IS_TEST_RUN === 'true',
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many API requests. Please slow down.'
    }
  }
});
