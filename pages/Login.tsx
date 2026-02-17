
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Eye, EyeOff, CheckCircle2, Cloud } from 'lucide-react';
import { DataService } from '../services/dataService';
import { Role, Teacher } from '../types';
import WaterLogoLoader from '../components/WaterLogoLoader';

const SCHOOL_LOGO_URL = "https://i.ibb.co.com/HkW9d0t/512.png";
const LOGIN_BACKGROUND_URL = "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=2000";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudReady, setIsCloudReady] = useState(false);

  useEffect(() => {
    // Cek apakah data cloud sudah masuk
    const checkCloud = () => {
        const teachers = DataService.getTeachers();
        if (teachers.length > 0) {
            setIsCloudReady(true);
        }
    };
    
    // Subscribe ke perubahan data
    const unsubscribe = DataService.subscribeToDataChanges(checkCloud);
    checkCloud();

    const currentUser = DataService.getCurrentUser();
    if (currentUser) redirectUser(currentUser);
    
    return () => unsubscribe();
  }, []);

  const redirectUser = (user: Teacher) => {
    const roles = user.roles || [];
    if (roles.includes(Role.ADMIN)) navigate('/admin/students');
    else if (roles.includes(Role.STUDENT)) navigate('/teacher/poe-ibu');
    else if (roles.includes(Role.OSIS)) navigate('/teacher/osis/input');
    else navigate('/teacher/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Jika cloud belum siap, tunggu
    if (DataService.getTeachers().length === 0 && username !== 'admin') {
        setError("Sistem sedang sinkronisasi. Tunggu 5 detik lalu coba lagi.");
        return;
    }

    const user = await DataService.login(username, password);
    
    if (user) {
      setLoginSuccess('Login berhasil! Memuat data...');
      setTimeout(() => {
          setIsLoading(true);
          setTimeout(() => {
              redirectUser(user);
          }, 1500);
      }, 800);
    } else {
      setError('Username atau password salah.');
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 bg-cover bg-center bg-no-repeat bg-blend-overlay"
      style={{ backgroundImage: `url('${LOGIN_BACKGROUND_URL}')` }}
    >
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md animate-fade-in">
            <WaterLogoLoader />
        </div>
      )}

      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-white/50 relative">
        <div className="bg-indigo-900 p-8 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center shadow-2xl mb-4 p-2">
              <img src={SCHOOL_LOGO_URL} alt="Logo Sekolah" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">SMKN JAYAKERTA</h1>
            
            {/* INDIKATOR CLOUD */}
            <div className={`mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isCloudReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-orange-500/20 text-orange-300 animate-pulse'}`}>
               <Cloud className="h-3 w-3" />
               {isCloudReady ? "Cloud Terhubung" : "Menghubungkan ke Cloud..."}
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="NIP atau Username"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
            {loginSuccess && <div className="text-xs text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">{loginSuccess}</div>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-indigo-800 hover:bg-indigo-900 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:bg-indigo-300"
            >
              Masuk Aplikasi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
