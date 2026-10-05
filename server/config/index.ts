/**
 * Application Configuration
 * Enforces strict environment contracts, centralized secret validation,
 * and fail-safe startup for Google Cloud Run production deployments.
 */
import dotenv from 'dotenv';

dotenv.config();

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!envSecret || envSecret.length < 32) {
      throw new Error(
        '[CRITICAL PRODUCTION ERROR] JWT_SECRET environment variable is missing or insecure (<32 chars) in production! ' +
        'Cloud Run instances must use a centralized secret from Google Cloud Secret Manager. Startup aborted.'
      );
    }
    return envSecret;
  }

  // Development and test fallback
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  return 'abc-hotel-dev-jwt-secret-key-do-not-use-in-production-2026';
}

function getDatabaseProvider(): 'firestore' | 'memory' | 'local_json' {
  const provider = (process.env.DATABASE_PROVIDER || '').toLowerCase().trim();

  if (process.env.NODE_ENV === 'production') {
    if (provider && provider !== 'firestore') {
      throw new Error(
        `[CRITICAL PRODUCTION ERROR] DATABASE_PROVIDER="${provider}" is forbidden in production. ` +
        `Cloud Run requires DATABASE_PROVIDER="firestore" as the authoritative persistent source of truth.`
      );
    }
    return 'firestore';
  }

  if (provider === 'local_json') return 'local_json';
  if (provider === 'memory') return 'memory';
  return 'firestore';
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: '7d',
  databaseProvider: getDatabaseProvider(),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'restaurant-com-2a275',
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || 'ai-studio-abchotelluxurydi-cfa9a1a9-b5f3-4a06-9e30-0167035de53d',
  hotel: {
    name: 'ABC Hotel',
    restaurantName: 'ABC Luxury Dining & Lounge',
    address: '742 Heritage Promenade, Royal Gardens, Sector 4, New Delhi / Mumbai',
    phone: '+91 22 4987 6543',
    email: 'concierge@abchotel.com',
    openingHour: 9, // 09:00 AM
    closingHour: 23, // 11:00 PM
    slotDurationMinutes: 30, // 30-minute reservation holding slot
    taxRate: 0.05, // 5% GST
    serviceCharge: 40, // ₹40 standard delivery/service fee
    discountCode: 'WELCOME10', // 10% discount
    discountPercent: 0.10
  }
};
