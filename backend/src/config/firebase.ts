import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

// firebase-admin switches to the Auth emulator by itself when this variable is set, and the
// emulator accepts unsigned tokens. Clear it so tokens are always checked against live Firebase.
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

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
// export const firebaseAuth = {
//   verifyIdToken: async (token: string) => {
//     console.log('[MOCK] Verifying Firebase Token:', token);
//     return {
//       uid: 'mock-user-123',
//       phone_number: '+919999999999',
//       email: 'mockuser@example.com'
//     };
//   }
// } as any;
