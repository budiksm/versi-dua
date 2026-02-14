
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Settings, Database, Save, X, RotateCcw } from 'lucide-react';
import { DataService } from '../services/dataService';
import { Role } from '../types';

// --- KONFIGURASI GAMBAR (GANTI LINK DI SINI) ---
const SCHOOL_LOGO_URL = "https://i.ibb.co.com/HkW9d0t/512.png";
// Tips: Gunakan gambar pemandangan sekolah ukuran 1920x1080
const LOGIN_BACKGROUND_URL = "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=2000";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Configuration Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configJson, setConfigJson] = useState('');

  useEffect(() => {
    // Load existing config string for display
    const stored = localStorage.getItem('firebase_manual_config');
    if (stored) {
      // Pretty print JSON
      try {
        const parsed = JSON.parse(stored);
        setConfigJson(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setConfigJson(stored);
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay
    setTimeout(() => {
      const user = DataService.login(username, password);
      
      if (user) {
        const roles = user.roles || [];
        
        // Priority Redirect:
        // 1. If Admin, go to Admin Panel
        // 2. Else go to Teacher Dashboard
        if (roles.includes(Role.ADMIN)) {
          navigate('/admin/students');
        } else {
          navigate('/teacher/dashboard');
        }
      } else {
        setError('Username atau password salah.');
        setIsLoading(false);
      }
    }, 800);
  };

  const handleSaveConfig = () => {
    try {
      if (!configJson.trim()) {
        localStorage.removeItem('firebase_manual_config');
        alert("Konfigurasi dihapus. Aplikasi akan menggunakan Environment Variables.");
        window.location.reload();
        return;
      }
      
      const parsed = JSON.parse(configJson);
      if (!parsed.apiKey || !parsed.projectId) {
         throw new Error("JSON tidak valid. Pastikan minimal ada 'apiKey' dan 'projectId'.");
      }
      
      localStorage.setItem('firebase_manual_config', JSON.stringify(parsed));
      alert("Konfigurasi berhasil disimpan! Halaman akan dimuat ulang.");
      window.location.reload();
    } catch (e: any) {
      alert("Gagal menyimpan: " + e.message);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 bg-cover bg-center bg-no-repeat bg-blend-overlay"
      style={{ backgroundImage: `url('${LOGIN_BACKGROUND_URL}')` }}
    >
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/50 relative">
        
        {/* SETTINGS BUTTON */}
        <button 
          onClick={() => setShowConfigModal(true)}
          className="absolute top-4 right-4 text-white/50 hover:text-white z-20 transition-colors p-2 rounded-full hover:bg-white/10"
          title="Konfigurasi Database"
        >
           <Settings className="h-5 w-5" />
        </button>

        <div className="bg-indigo-900 p-8 text-center relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-800/50 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo Container */}
            <div className="h-28 w-28 bg-white rounded-full flex items-center justify-center shadow-2xl mb-6 border-4 border-indigo-100/30 overflow-hidden p-2">
              <img 
                src={SCHOOL_LOGO_URL}
                alt="Logo Sekolah" 
                className="w-full h-full object-contain"
              />
            </div>
            
            <h1 className="text-3xl font-bold text-white tracking-wide drop-shadow-md">SMKN JAYAKERTA</h1>
            <p className="mt-2 text-indigo-200 text-xs uppercase tracking-wider font-medium">Sistem Monitoring Kesiswaan</p>
          </div>
        </div>

        <div className="p-8 pt-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="Masukkan NIP atau Username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-pulse">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-800 hover:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
            >
              {isLoading ? 'Memproses...' : 'Masuk Aplikasi'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              Lupa password? Hubungi Admin.
            </p>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-slate-500 font-medium text-center max-w-xs leading-relaxed">
        &copy; {new Date().getFullYear()} SMKN Jayakerta<br/>
        Jl. Raya Kemiri, Jayamakmur, Kec. Jayakerta, Karawang, Jawa Barat 41352
      </p>

      {/* DATABASE CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
             <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                <h2 className="font-bold flex items-center gap-2">
                   <Database className="h-5 w-5 text-blue-400" />
                   Konfigurasi Database (Firebase)
                </h2>
                <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white">
                   <X className="h-5 w-5" />
                </button>
             </div>
             
             <div className="p-6 overflow-y-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
                   <p className="font-bold flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4" /> Mode Pemulihan Koneksi
                   </p>
                   Jika data Anda hilang/reset, kemungkinan aplikasi kehilangan koneksi ke database.
                   Paste kode konfigurasi Firebase Anda di bawah ini untuk menghubungkan ulang secara manual.
                </div>

                <label className="block text-sm font-bold text-slate-700 mb-2">Firebase Config Object (JSON):</label>
                <textarea 
                  className="w-full h-64 p-3 bg-slate-900 text-green-400 font-mono text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  ...\n}'}
                  value={configJson}
                  onChange={e => setConfigJson(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-2">
                   *Anda bisa mendapatkan kode ini dari Firebase Console &gt; Project Settings.
                </p>
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button 
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveConfig}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"
                >
                  <RotateCcw className="h-4 w-4" /> Simpan & Reload
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
