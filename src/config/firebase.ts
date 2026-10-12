import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Frontend Firebase configuration for smart-examination-dac73
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoKeyForSmartExamUniversity2026',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'smart-examination-dac73.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'smart-examination-dac73',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'smart-examination-dac73.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '942734749702',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:942734749702:web:a1b2c3d4e5f6g7h8',
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Connectivity check helper
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'health', 'ping'));
    return true;
  } catch (err: any) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is operating offline or uncredentialed.');
    }
    return false;
  }
}
