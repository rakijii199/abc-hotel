/**
 * Full-Stack Express Server for ABC Hotel
 * Hardened for Production, Cloud Run, and Google Cloud / Firebase Environments
 */
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './server/config/index.ts';
import { apiRouter } from './server/routes/index.ts';
import { globalErrorHandler, generalApiLimiter } from './server/middleware/errorHandler.ts';
import { db } from './server/database/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = config.port;

  // Trust first proxy hop (Google Cloud Run / Load Balancer) for accurate client IP in rate limiters
  app.set('trust proxy', 1);

  // Disable x-powered-by header
  app.disable('x-powered-by');

  // Production Security Headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Vite SPA runtime
            'https://checkout.razorpay.com',
            'https://apis.google.com',
            'https://www.gstatic.com'
          ],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://images.unsplash.com',
            'https://lh3.googleusercontent.com',
            'https://*.googleusercontent.com',
            'https://*.razorpay.com'
          ],
          connectSrc: [
            "'self'",
            'https://*.run.app',
            'https://*.firebaseapp.com',
            'https://*.web.app',
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://api.razorpay.com',
            'https://lumberjack.razorpay.com',
            'ws:',
            'wss:'
          ],
          frameSrc: [
            "'self'",
            'https://api.razorpay.com',
            'https://checkout.razorpay.com',
            'https://*.firebaseapp.com'
          ],
          frameAncestors: [
            "'self'",
            'https://*.google.com',
            'https://*.run.app',
            'https://*.web.app'
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false // frame-ancestors in CSP securely restricts framing while allowing AI Studio preview
    })
  );

  // Additional Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    next();
  });

  // Strict CORS Allowlist (No Wildcards with Credentials)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://restaurant-com-2a275.web.app',
    'https://restaurant-com-2a275.firebaseapp.com',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : [])
  ];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.web.app') ||
        origin.endsWith('.firebaseapp.com');

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Body Parsing Middleware (Restricted to 2MB to prevent large-payload DoS)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Ensure Database Engine is initialized
  await db.initialize();

  // Apply General API Rate Limiting to all /api endpoints
  app.use('/api', generalApiLimiter);

  // Mount API router
  app.use('/api', apiRouter);

  // Serve Swagger OpenAPI JSON
  app.get('/api/openapi.json', (_req, res) => {
    res.sendFile(path.join(__dirname, 'server/swagger/openapi.json'));
  });

  // Explicit 404 Handler for /api/* - NEVER fall through to index.html for API requests
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'API_ROUTE_NOT_FOUND',
        message: 'The requested API endpoint was not found on this server.'
      }
    });
  });

  // Global Error Handler
  app.use(globalErrorHandler);

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Dynamic Vite server integration
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ABC HOTEL] Server is running securely on http://0.0.0.0:${PORT}`);
  });

  // Graceful Shutdown for Cloud Run container lifecycle
  const handleShutdown = (signal: string) => {
    console.log(`[ABC HOTEL] Received ${signal}. Gracefully shutting down HTTP server...`);
    server.close(() => {
      console.log('[ABC HOTEL] HTTP server closed. Process exiting cleanly.');
      process.exit(0);
    });

    // Force exit after 10s if connections refuse to terminate
    setTimeout(() => {
      console.error('[ABC HOTEL] Forcefully shutting down after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[ABC HOTEL] Failed to start server:', err);
  process.exit(1);
});
