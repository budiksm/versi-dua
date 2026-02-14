
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Cast import.meta to any to avoid TypeScript errors if types are not properly configured
const env = (import.meta as any).env;

// Config mengambil dari Environment Variables (.env)
// Agar API Key tidak terekspos di Source Code (GitHub)
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

let db: any = null;

try {
  // Validasi sederhana untuk memastikan .env sudah dibuat
  if (!firebaseConfig.apiKey) {
    console.error("Firebase Config Error: API Key tidak ditemukan. Pastikan Anda telah membuat file .env berisi VITE_FIREBASE_API_KEY");
  } else {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { db };
