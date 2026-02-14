
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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
const isHardcodedFilled = hardcodedConfig.apiKey && hardcodedConfig.apiKey.startsWith("AIza");

let firebaseConfig = null;
const stored = getStoredConfig();

if (isHardcodedFilled) {
  // Selalu prioritaskan hardcoded config jika valid
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
let auth: any = null;

// Fungsi untuk melakukan Handshake keamanan ke Firebase
const connectToFirebase = async () => {
    if (!auth) return false;
    try {
        // Melakukan login sistem di belakang layar
        // Ini membuat request.auth di Rules menjadi TIDAK null
        await signInAnonymously(auth);
        console.log("🔐 Terhubung ke Database dengan Aman (System Auth)");
        return true;
    } catch (error) {
        console.error("Gagal koneksi Auth:", error);
        return false;
    }
};

try {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error("❌ FATAL: Tidak ada konfigurasi Firebase yang ditemukan.");
  } else {
    const app = initializeApp(firebaseConfig);
    
    // Inisialisasi Auth System
    auth = getAuth(app);

    // Inisialisasi Database dengan fitur Enterprise:
    // 1. experimentalForceLongPolling: Menembus firewall/proxy sekolah yang memblokir WebSocket.
    // 2. persistentLocalCache: Menyimpan data di laptop agar tidak hilang saat internet mati.
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true, 
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    
    console.log("🔥 Firebase initialized (Mode Stabil & Offline Aktif)!");
  }
} catch (error) {
  console.error("🔥 Firebase initialization error:", error);
}

export { db, auth, connectToFirebase };
