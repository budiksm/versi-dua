
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// --- KONFIGURASI PROFESIONAL (HARDCODED) ---
// Bagian ini TIDAK AKAN HILANG walau browser di-reset.
// Data ini aman karena Firebase API Key memang didesain untuk publik (Client Side).
// Keamanan data dijaga oleh Firestore Security Rules di console Google, bukan disembunyikan di sini.

const firebaseConfig = {
  apiKey: "AIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3w",
  authDomain: "versi-dua.firebaseapp.com",
  projectId: "versi-dua",
  storageBucket: "versi-dua.firebasestorage.app",
  messagingSenderId: "281459589879",
  appId: "1:281459589879:web:635863542ba731bbe849f2"
};

// Validasi agar tidak error blank screen jika lupa isi config
// Cek jika API Key masih default atau kosong (sekarang sudah diisi)
export const isConfigMissing = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY_HERE";

let db: any = null;
let auth: any = null;

const connectToFirebase = async () => {
    if (isConfigMissing) {
        console.error("CRITICAL: Firebase Config belum diisi di file firebaseConfig.ts dengan benar.");
        return false;
    }

    if (!auth) {
        try {
            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            
            // Menggunakan Cache Persistence Standar Industri
            // Data akan disimpan di IndexedDB browser agar cepat,
            // tapi Source of Truth tetap Cloud.
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
            console.log("🔥 Firebase Initialized (Hardcoded Mode)");
        } catch (e) {
            console.error("Firebase Init Error:", e);
            return false;
        }
    }

    // Auto-Login Anonymous untuk akses baca/tulis database
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(true);
            } else {
                signInAnonymously(auth)
                    .then(() => resolve(true))
                    .catch((error) => {
                        console.error("Auth Failed:", error);
                        resolve(false);
                    });
            }
        });
    });
};

export { db, auth, connectToFirebase };