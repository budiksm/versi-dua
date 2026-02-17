
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// --- KONFIGURASI FIREBASE ---
// Kita menghapus hardcoded config DEMO.
// Anda WAJIB memasukkan config Anda sendiri melalui Menu Admin > Koneksi Database
// atau melalui Environment Variables.

const getStoredConfig = () => {
  try {
    const stored = localStorage.getItem('firebase_manual_config');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Gagal membaca konfigurasi:", e);
  }
  return null;
};

let firebaseConfig = getStoredConfig();

// Fallback ke Environment Variables (Best Practice untuk Production Deployment)
if (!firebaseConfig) {
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
  }
}

// Export status untuk UI
export const isConfigMissing = !firebaseConfig;

let db: any = null;
let auth: any = null;

const connectToFirebase = async () => {
    if (!firebaseConfig) return false;

    if (!auth) {
        try {
            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            // Menggunakan Cache Firestore Native (Lebih aman & cepat daripada localStorage manual)
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
        } catch (e) {
            console.error("Firebase Init Error:", e);
            return false;
        }
    }

    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                console.log("☁️ Terhubung ke Cloud:", user.uid);
                resolve(true);
            } else {
                signInAnonymously(auth)
                    .then(() => {
                        console.log("☁️ Login Cloud Berhasil");
                        resolve(true);
                    })
                    .catch((error) => {
                        console.error("❌ Gagal Login Cloud:", error);
                        resolve(false);
                    });
            }
        });
    });
};

export { db, auth, connectToFirebase };
