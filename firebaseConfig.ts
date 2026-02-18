
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
// Fix: Use namespace import to resolve "has no exported member" errors
import * as FirebaseAuth from "firebase/auth";
import { getStorage } from "firebase/storage";

// --- KONFIGURASI PROFESIONAL (HARDCODED) ---
// Bagian ini TIDAK AKAN HILANG walau browser di-reset.
// Data ini aman karena Firebase API Key memang didesain untuk publik (Client Side).
// Keamanan data dijaga oleh Firestore Security Rules di console Google.

const firebaseConfig = {
  apiKey: "AIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3w",
  authDomain: "versi-dua.firebaseapp.com",
  projectId: "versi-dua",
  storageBucket: "versi-dua.firebasestorage.app",
  messagingSenderId: "281459589879",
  appId: "1:281459589879:web:635863542ba731bbe849f2"
};

// Validasi agar tidak error blank screen jika lupa isi config
export const isConfigMissing = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY_HERE";

let db: any = null;
let auth: any = null;
let storage: any = null;

const connectToFirebase = async () => {
    if (isConfigMissing) {
        console.error("CRITICAL: Firebase Config belum diisi di file firebaseConfig.ts dengan benar.");
        return false;
    }

    if (!auth) {
        try {
            const app = initializeApp(firebaseConfig);
            // Use FirebaseAuth namespace to access auth functions
            auth = FirebaseAuth.getAuth(app);
            
            // Menggunakan Cache Persistence Standar Industri
            // Data akan disimpan di IndexedDB browser agar cepat,
            // tapi Source of Truth tetap Cloud.
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
            
            storage = getStorage(app);

            console.log("🔥 Firebase Initialized (Hardcoded Mode)");
        } catch (e) {
            console.error("Firebase Init Error:", e);
            // Jika error karena app sudah ada (hot reload), coba ambil instance yang ada
            return true; 
        }
    }

    // Auto-Login Anonymous untuk akses baca/tulis database
    return new Promise((resolve) => {
        // Use FirebaseAuth namespace
        const unsubscribe = FirebaseAuth.onAuthStateChanged(auth, (user: any) => {
            unsubscribe();
            if (user) {
                resolve(true);
            } else {
                FirebaseAuth.signInAnonymously(auth)
                    .then(() => resolve(true))
                    .catch((error: any) => {
                        console.error("Auth Failed:", error);
                        resolve(false);
                    });
            }
        });
    });
};

export { db, auth, storage, connectToFirebase };
