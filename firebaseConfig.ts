
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

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
  if (localStorage.getItem('firebase_manual_config')) {
     localStorage.removeItem('firebase_manual_config');
  }
  firebaseConfig = hardcodedConfig;
  console.log("✅ Config: Hardcoded");
} else if (stored) {
  firebaseConfig = stored;
  console.log("ℹ️ Config: Manual");
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
    console.log("ℹ️ Config: Environment");
  }
}

let db: any = null;
let auth: any = null;

// Fungsi Handshake Lebih Robust
const connectToFirebase = async () => {
    if (!auth) return false;

    // Tunggu sebentar untuk cek state auth yang tersimpan (biar gak login ulang terus)
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe(); // Stop listening
            if (user) {
                console.log("🔐 [Auth] Sesi dipulihkan:", user.uid);
                resolve(true);
            } else {
                console.log("🔐 [Auth] Mencoba login sistem baru...");
                signInAnonymously(auth)
                    .then((cred) => {
                        console.log("🔐 [Auth] Login Berhasil:", cred.user.uid);
                        resolve(true);
                    })
                    .catch((error) => {
                        console.error("❌ [Auth GAGAL]:", error);
                        if (error.code === 'auth/operation-not-allowed') {
                            alert("⚠️ PERHATIAN: Fitur 'Anonymous' belum diaktifkan di Firebase Console!\n\nBuka Firebase Console -> Authentication -> Sign-in method -> Aktifkan Anonymous.");
                        }
                        resolve(false);
                    });
            }
        });
    });
};

try {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.error("❌ FATAL: Config missing.");
  } else {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    // Gunakan settingan cache yang lebih agresif tapi aman
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true, 
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    
    console.log("🔥 Firebase init done.");
  }
} catch (error) {
  console.error("🔥 Firebase init error:", error);
}

export { db, auth, connectToFirebase };
