import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
if (process.env.NODE_ENV !== 'production' && authEmulatorHost) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = authEmulatorHost;
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Critical Error: Firebase service account credentials are missing in the environment variables.');
}

// 2. Initialize Firebase App (Modular Singleton Pattern)
if (!getApps().length) {
  initializeApp({
    projectId,
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// 3. Export the Auth instance for use in the service layer
export const firebaseAuth = getAuth();
