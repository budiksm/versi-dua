
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay
    setTimeout(() => {
      const user = DataService.login(username, password);
      
      if (user) {
        const roles = user.roles || [];
        
        // Priority Redirect Logic
        if (roles.includes(Role.ADMIN)) {
          navigate('/admin/students');
        } else if (roles.includes(Role.STUDENT)) {
          // Siswa langsung ke Poe Ibu
          navigate('/teacher/poe-ibu');
        } else if (roles.includes(Role.OSIS)) {
          // OSIS langsung ke Input Keterlambatan
          navigate('/teacher/osis/input');
        } else {
          // Guru, BK, Walikelas, Kesiswaan ke Dashboard
          navigate('/teacher/dashboard');
        }
      } else {
        setError('Username atau password salah.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 bg-cover bg-center bg-no-repeat bg-blend-overlay"
      style={{ backgroundImage: `url('${LOGIN_BACKGROUND_URL}')` }}
    >
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/50 relative">
        
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
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
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
    </div>
  );
};

export default Login;
