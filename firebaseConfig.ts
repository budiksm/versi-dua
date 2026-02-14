
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Helper untuk mengambil config manual dari LocalStorage (jika user input lewat UI Login)
const getStoredConfig = () => {
  try {
    const stored = localStorage.getItem('firebase_manual_config');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Gagal membaca konfigurasi manual:", e);
  }
  return null;
};

// Cast import.meta to any
const env = (import.meta as any).env || {};

// Prioritas: 1. Manual Config (LocalStorage), 2. Env Vars (.env)
const manualConfig = getStoredConfig();

const firebaseConfig = manualConfig || {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

let db: any = null;

try {
  // Validasi sederhana
  if (!firebaseConfig.apiKey) {
    console.warn("Firebase Config belum tersedia. Silakan klik ikon Gear di halaman Login untuk memasukkan konfigurasi.");
  } else {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized successfully (" + (manualConfig ? "Manual Config" : "Env Config") + ")");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { db };
