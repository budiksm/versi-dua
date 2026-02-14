import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- PENTING: GANTI DENGAN CONFIG DARI CONSOLE FIREBASE ANDA ---
// Caranya: Buka console.firebase.google.com -> Project Settings -> General -> Your Apps
const firebaseConfig = {
  apiKey: "AIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3w",
  authDomain: "versi-dua.firebaseapp.com",
  projectId: "versi-dua",
  storageBucket: "versi-dua.firebasestorage.app",
  messagingSenderId: "281459589879",
  appId: "1:281459589879:web:635863542ba731bbe849f2"
};

// Cek apakah user sudah mengisi config atau belum
const isConfigured = firebaseConfig.apiKey !== "AIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3wAIzaSyAycrr3a5Hg5IgWdSxRNcSbuqY_rROeY3w";

let db: any = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} else {
  console.warn("⚠️ Firebase belum dikonfigurasi! Aplikasi berjalan dalam mode OFFLINE (LocalStorage Only). Data tidak akan sinkron antar device.");
}

export { db };
