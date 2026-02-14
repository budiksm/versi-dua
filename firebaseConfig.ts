
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// --- AREA KONFIGURASI UTAMA ---
const hardcodedConfig = {
  apiKey: "AIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3w",
  authDomain: "versi-dua.firebaseapp.com",
  projectId: "versi-dua",
  storageBucket: "versi-dua.firebasestorage.app",
  messagingSenderId: "281459589879",
  appId: "1:281459589879:web:635863542ba731bbe849f2"
};

// ------------------------------------------------------------------

const getStoredConfig = () => {
  try {
    const stored = localStorage.getItem('firebase_manual_config');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Gagal membaca konfigurasi manual:", e);
  }
  return null;
};

// Cek apakah user sudah mengisi hardcoded config dengan benar
// Kunci Firebase selalu dimulai dengan "AIza"
const isHardcodedFilled = hardcodedConfig.apiKey && hardcodedConfig.apiKey.startsWith("AIza");

let firebaseConfig = null;
const stored = getStoredConfig();

// LOGIKA BARU YANG LEBIH KUAT:
if (isHardcodedFilled) {
  // Jika kode hardcoded sudah diisi dengan benar, KITA PAKAI ITU.
  // Kita abaikan/hapus konfigurasi manual yang mungkin rusak di LocalStorage agar tidak konflik.
  if (localStorage.getItem('firebase_manual_config')) {
     console.log("⚠️ Membersihkan konfigurasi manual lama demi konfigurasi hardcoded yang valid.");
     localStorage.removeItem('firebase_manual_config');
  }
  firebaseConfig = hardcodedConfig;
  console.log("✅ Menggunakan Konfigurasi: OTOMATIS (Hardcoded)");
} else if (stored) {
  firebaseConfig = stored;
  console.log("ℹ️ Menggunakan Konfigurasi: MANUAL (LocalStorage)");
} else {
  // Coba ambil dari Environment Variable sebagai cadangan terakhir
  const env = (import.meta as any).env || {};
  if (env.VITE_FIREBASE_API_KEY) {
    firebaseConfig = {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID
    };
    console.log("ℹ️ Menggunakan Konfigurasi: ENVIRONMENT (.env)");
  }
}

let db: any = null;

try {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error("❌ FATAL: Tidak ada konfigurasi Firebase yang ditemukan.");
  } else {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    
    // Opsional: Aktifkan persistensi offline (cache)
    // Ini membantu jika koneksi internet putus-nyambung
    // enableIndexedDbPersistence(db).catch((err) => {
    //    if (err.code == 'failed-precondition') {
    //        console.log('Persistence failed: Multiple tabs open');
    //    } else if (err.code == 'unimplemented') {
    //        console.log('Persistence is not available in this browser');
    //    }
    // });
    
    console.log("🔥 Firebase initialized successfully!");
  }
} catch (error) {
  console.error("🔥 Firebase initialization error:", error);
}

export { db };
