/**
 * Firebase Client Setup (Client-Side Authentication only)
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth (used for customer phone/OTP verification)
export const auth = getAuth(app);

// Application health check via Express backend API
async function checkBackendHealth() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      console.log('[APP] Connected to ABC Hotel backend service.');
    }
  } catch (error) {
    console.warn('[APP] Backend service check pending or offline.');
  }
}

checkBackendHealth();
