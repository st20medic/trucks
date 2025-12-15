import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "test-api-key-for-local-dev",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "test-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "test-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "test-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:test123",
  ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID && {
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  })
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Configure Firestore for better mobile performance
const firestoreSettings = {
  // Enable offline persistence for mobile devices
  experimentalForceLongPolling: true, // Better for mobile networks
  useFetchStreams: false, // Disable streaming for better mobile compatibility
};

// Apply settings if supported
if (typeof window !== 'undefined') {
  // Only run in browser environment
  try {
    // @ts-ignore - Firestore settings may not be fully typed
    if (db.settings) {
      // @ts-ignore
      db.settings(firestoreSettings);
    }
  } catch (error) {
    console.log('Firestore settings not supported in this version');
  }
}

export default app;
