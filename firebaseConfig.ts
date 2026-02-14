
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- AREA KONFIGURASI UTAMA (PASTE KODE FIREBASE ANDA DI SINI) ---
// Agar "Otomatis" jalan, ganti tulisan di bawah ini dengan kode dari Firebase Console.
// Biarkan tanda kutipnya.
const hardcodedConfig = {
  apiKey: "AIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3w",
  authDomain: "versi-dua.firebaseapp.com",
  projectId: "versi-dua",
  storageBucket: "versi-dua.firebasestorage.app",
  messagingSenderId: "281459589879",
  appId: "1:281459589879:web:635863542ba731bbe849f2"
};

// ------------------------------------------------------------------

// Helper untuk mengambil config manual dari LocalStorage (jika pernah disetting via Admin Panel)
const getStoredConfig = () => {
  try {
    const stored = localStorage.getItem('firebase_manual_config');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Gagal membaca konfigurasi manual:", e);
  }
  return null;
};

// Helper untuk membaca Environment Variables (jika pakai .env)
const env = (import.meta as any).env || {};
const envConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

// LOGIKA PRIORITAS KONFIGURASI:
// 1. Config Manual (dari LocalStorage Admin Panel) - Paling Prioritas
// 2. Config Hardcoded (dari file ini langsung) - Agar "Otomatis" jalan
// 3. Config Env (dari .env) - Opsional
let firebaseConfig = null;

const stored = getStoredConfig();
const isHardcodedFilled = hardcodedConfig.apiKey !== "AIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3w";
const isEnvFilled = envConfig.apiKey !== undefined;

if (stored) {
  firebaseConfig = stored;
  console.log("Menggunakan Konfigurasi: MANUAL (LocalStorage)");
} else if (isHardcodedFilled) {
  firebaseConfig = hardcodedConfig;
  console.log("Menggunakan Konfigurasi: OTOMATIS (Hardcoded)");
} else if (isEnvFilled) {
  firebaseConfig = envConfig;
  console.log("Menggunakan Konfigurasi: ENVIRONMENT (.env)");
}

let db: any = null;

try {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.warn("⚠️ DATABASE BELUM TERHUBUNG: API Key tidak ditemukan.");
    console.warn("Solusi: Buka file 'firebaseConfig.ts' dan paste kode Firebase Anda di variabel 'hardcodedConfig'.");
  } else {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { db };
