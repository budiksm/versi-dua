
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DataService, SyncState } from '../services/dataService';
import { 
  Users, 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  GraduationCap,
  ShieldCheck,
  UserCog,
  User,
  School,
  MonitorCheck,
  Gavel,
  HeartHandshake,
  Lock,
  CheckCircle,
  Cloud,
  RefreshCw,
  AlertOctagon,
  RotateCcw,
  ClipboardList,
  Wallet,
  Clock,
  ShieldAlert,
  Search,
  Wifi,
  WifiOff,
  CloudCheck,
  CloudOff
} from 'lucide-react';
import { Role } from '../types';

// ============================================================================
// 👇👇👇 GANTI LINK LOGO SEKOLAH DI BARIS BAWAH INI 👇👇👇
const SCHOOL_LOGO_URL = "https://i.ibb.co.com/HkW9d0t/512.png"; 
// ============================================================================

interface LayoutProps {
  children: React.ReactNode;
  role: Role; 
}

// Tipe data untuk item menu yang lebih fleksibel
type MenuItemType = 'link' | 'header' | 'separator';

interface MenuItem {
  type: MenuItemType;
  label?: string;
  path?: string;
  icon?: any;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Sync Status State
  const [syncState, setSyncState] = useState<SyncState>('IDLE');
  const [lastSync, setLastSync] = useState<Date | null>(new Date());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Logo Error State (Fallback if image fails)
  const [logoError, setLogoError] = useState(false);
  
  const currentUser = DataService.getCurrentUser();

  // Force Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Network Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to DataService Sync events
    const unsubscribe = DataService.subscribeToSync((state, time, error) => {
      setSyncState(state);
      if (time) setLastSync(time);
      if (error) setSyncError(error);
    });

    // Heartbeat
    if (currentUser) {
       DataService.updateHeartbeat(currentUser.id);
       const interval = setInterval(() => {
          DataService.updateHeartbeat(currentUser.id);
       }, 60000);
       return () => {
         clearInterval(interval);
         unsubscribe();
         window.removeEventListener('online', handleOnline);
         window.removeEventListener('offline', handleOffline);
       };
    }
    
    if (currentUser?.mustChangePassword && !successMessage) {
      setShowPasswordModal(true);
    }

    return () => {
       unsubscribe();
       window.removeEventListener('online', handleOnline);
       window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser, successMessage]);

  const handleLogout = () => {
    DataService.logout();
    navigate('/');
  };
  
  const handleResetConnection = async () => {
    if(confirm("Tindakan ini akan membersihkan cache database di browser untuk memperbaiki error koneksi. Data di server aman. Lanjutkan?")) {
        try {
            // Clear IndexedDB Firebase
            const dbs = await window.indexedDB.databases();
            dbs.forEach(db => { 
                if(db.name && db.name.includes('firebase')) {
                    window.indexedDB.deleteDatabase(db.name);
                }
            });
            localStorage.clear();
            window.location.reload();
        } catch (e) {
            alert("Gagal reset otomatis. Silakan hapus history browser Anda secara manual.");
            window.location.reload();
        }
    }
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok.');
      return;
    }
    if (newPassword === '123') {
      setPasswordError('Dilarang menggunakan password default "123".');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password minimal 6 karakter.');
      return;
    }
    
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    
    if (!hasLetter || !hasNumber) {
        setPasswordError('Password wajib kombinasi huruf dan angka.');
        return;
    }

    if (currentUser) {
      setIsSavingPass(true);
      setTimeout(() => {
        DataService.updatePassword(currentUser.id, newPassword);
        setIsSavingPass(false);
        setSuccessMessage('Password berhasil diubah!');
        setTimeout(() => {
          setShowPasswordModal(false);
          setSuccessMessage('');
        }, 1000);
      }, 800);
    }
  };

  // --- MENU CONFIGURATION LOGIC ---
  const getMenuItems = (): MenuItem[] => {
    if (!currentUser) return [];
    const roles = currentUser.roles || [];
    const isWalikelas = roles.includes(Role.WALIKELAS);

    // 1. ADMIN
    if (roles.includes(Role.ADMIN)) {
        return [
            { type: 'header', label: 'Administrator' },
            { type: 'link', path: '/admin/students', label: 'Manajemen Siswa', icon: Users },
            { type: 'link', path: '/admin/accounts', label: 'Manajemen Akun', icon: UserCog },
            { type: 'link', path: '/admin/config', label: 'Konfigurasi Poin', icon: ShieldCheck },
            { type: 'separator' },
            { type: 'header', label: 'Menu Guru' },
            { type: 'link', path: '/teacher/dashboard', label: 'Dashboard Guru', icon: LayoutDashboard },
            { type: 'link', path: '/teacher/classes', label: 'Data Kelas', icon: Users },
        ];
    }

    // 2. KESISWAAN
    if (roles.includes(Role.KESISWAAN)) {
        const items: MenuItem[] = [
            { type: 'link', path: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { type: 'separator' },
            { type: 'link', path: '/teacher/kesiswaan/monitoring', label: 'Monitoring Siswa', icon: MonitorCheck },
            { type: 'link', path: '/teacher/kesiswaan/poe-monitoring', label: 'Monitoring Poe Ibu', icon: Wallet },
            { type: 'separator' },
            { type: 'link', path: '/teacher/kesiswaan/action', label: 'Pembinaan & SP', icon: Gavel },
            { type: 'link', path: '/teacher/kesiswaan/logs', label: 'Log Input Guru', icon: ClipboardList },
        ];
        if (isWalikelas) {
            items.push({ type: 'separator' });
            items.push({ type: 'link', path: '/teacher/poe-ibu', label: 'Kas Poe Ibu', icon: Wallet });
        }
        items.push({ type: 'separator' });
        items.push({ type: 'link', path: '/teacher/classes', label: 'Data Kelas', icon: Users });
        return items;
    }

    // 3. GURU BK
    if (roles.includes(Role.BK)) {
        const items: MenuItem[] = [
            { type: 'header', label: 'Monitoring' },
            { type: 'link', path: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { type: 'link', path: '/teacher/bk/monitoring', label: 'Monitoring Siswa', icon: Search },
            { type: 'header', label: 'Pembinaan' },
            { type: 'link', path: '/teacher/bk/active', label: 'Pembinaan Aktif', icon: HeartHandshake },
        ];
        if (isWalikelas) {
            items.push({ type: 'header', label: 'Keuangan' });
            items.push({ type: 'link', path: '/teacher/poe-ibu', label: 'Kas Poe Ibu', icon: Wallet });
        }
        items.push({ type: 'separator' });
        items.push({ type: 'link', path: '/teacher/classes', label: 'Data Kelas', icon: Users });
        return items;
    }

    // 4. SISWA (BENDAHARA)
    if (roles.includes(Role.STUDENT)) {
        return [
            { type: 'header', label: 'Menu Siswa' },
            { type: 'link', path: '/teacher/poe-ibu', label: 'Kas Poe Ibu', icon: Wallet },
            { type: 'link', path: '/teacher/student/input', label: 'Lapor Pelanggaran', icon: ShieldAlert },
        ];
    }

    // 5. OSIS
    if (roles.includes(Role.OSIS)) {
        return [
            { type: 'link', path: '/teacher/osis/input', label: 'Input Keterlambatan', icon: Clock },
        ];
    }

    // 6. GURU / WALI KELAS (Default)
    const teacherItems: MenuItem[] = [
        { type: 'link', path: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { type: 'link', path: '/teacher/classes', label: 'Daftar Kelas', icon: Users },
    ];
    if (isWalikelas) {
        teacherItems.push({ type: 'link', path: '/teacher/poe-ibu', label: 'Kas Poe Ibu', icon: Wallet });
    }
    return teacherItems;
  };

  const menuItems = getMenuItems();

  return (
    <div className="flex h-screen bg-slate-50">
      
      {/* PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
              <div className="bg-red-600 p-6 text-center text-white">
                 <Lock className="h-12 w-12 mx-auto mb-2 opacity-90" />
                 <h2 className="text-xl font-bold">Wajib Ganti Password</h2>
                 <p className="text-red-100 text-sm mt-1">Demi keamanan akun Anda.</p>
              </div>
              <div className="p-8">
                 {successMessage ? (
                    <div className="text-center py-8">
                       <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                       <h3 className="text-xl font-bold">Berhasil!</h3>
                    </div>
                 ) : (
                   <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
                      <div>
                          <p className="text-xs text-slate-500 mb-2 bg-slate-50 p-2 rounded border">
                              Format Baru: Minimal 6 karakter, wajib kombinasi huruf & angka.
                          </p>
                          <input type="password" required className="w-full p-3 border rounded-lg" placeholder="Password Baru" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      </div>
                      <input type="password" required className="w-full p-3 border rounded-lg" placeholder="Konfirmasi Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                      {passwordError && <p className="text-red-500 text-sm font-bold">{passwordError}</p>}
                      <button type="submit" disabled={isSavingPass} className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">
                        {isSavingPass ? 'Menyimpan...' : 'Simpan Password'}
                      </button>
                   </form>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center px-6 border-b border-slate-100 gap-3 font-bold text-indigo-900 text-lg">
           {!logoError ? (
               <img 
                 src={SCHOOL_LOGO_URL} 
                 alt="Logo" 
                 className="h-8 w-8 object-contain" 
                 onError={() => setLogoError(true)}
               />
           ) : (
               <School className="h-8 w-8 text-indigo-600" />
           )}
           <span>SMKN Jayakerta</span>
        </div>

        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-50">
           <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
             <User className="h-5 w-5" />
           </div>
           <div className="overflow-hidden">
             <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.name || 'User'}</p>
             <p className="text-[10px] text-slate-500 uppercase leading-tight mt-0.5 truncate">{currentUser?.roles?.join(', ') || ''}</p>
           </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {menuItems.map((item, index) => {
            if (item.type === 'header') return <div key={index} className="px-4 mt-6 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</div>;
            if (item.type === 'separator') return <hr key={index} className="my-3 border-slate-200" />;
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={index}
                to={item.path || '#'}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {Icon && <Icon className="h-5 w-5" />}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full border-t border-slate-100 p-4 bg-white">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <LogOut className="h-5 w-5" /> Keluar
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between bg-white px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
             <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 lg:hidden">
               <Menu className="h-6 w-6" />
             </button>
             
             {/* --- DATABASE INDICATOR (TRAFFIC LIGHT) --- */}
             <div className="flex items-center gap-3">
                {/* 1. STATE: OFFLINE */}
                {!isOnline && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 border border-red-200 animate-pulse" title="Koneksi Internet Terputus">
                        <WifiOff className="h-4 w-4 text-red-600" />
                        <span className="text-xs font-bold text-red-600 hidden sm:inline">Offline</span>
                    </div>
                )}

                {/* 2. STATE: ERROR */}
                {isOnline && syncState === 'ERROR' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 border border-red-200" title="Gagal terhubung ke Database">
                        <CloudOff className="h-4 w-4 text-red-600" />
                        <span className="text-xs font-bold text-red-600 hidden sm:inline">Koneksi DB Error!</span>
                    </div>
                )}

                {/* 3. STATE: SYNCING */}
                {isOnline && syncState === 'SYNCING' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 border border-blue-200" title="Sedang mengirim data ke Cloud...">
                        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                        <span className="text-xs font-bold text-blue-600 hidden sm:inline">Menyimpan...</span>
                    </div>
                )}

                {/* 4. STATE: AMAN (IDLE/SAVED) */}
                {isOnline && (syncState === 'IDLE' || syncState === 'SAVED') && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200" title="Data tersimpan aman di Cloud">
                        <CloudCheck className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-600 hidden sm:inline">Aman di Cloud</span>
                    </div>
                )}
             </div>
          </div>
          
          <div className="text-xs text-slate-400 hidden sm:block">
            {lastSync ? `Disinkronkan: ${lastSync.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}` : ''}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          {(syncState === 'ERROR' || !isOnline) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col md:flex-row items-start gap-4 animate-fade-in shadow-sm">
               <div className="flex items-start gap-3">
                   <AlertOctagon className="h-6 w-6 text-red-600 shrink-0 mt-1" />
                   <div>
                      <h3 className="text-sm font-bold text-red-800">Koneksi Database Bermasalah</h3>
                      <p className="text-xs text-red-600 leading-relaxed mt-1">
                         {!isOnline 
                            ? "Internet Anda terputus. Data tidak akan tersimpan ke Cloud sampai Anda online kembali." 
                            : `Terjadi kesalahan saat menghubungi server: ${syncError || "Koneksi timeout"}. Coba refresh halaman.`
                         }
                      </p>
                   </div>
               </div>
               
               {isOnline && (
                   <button 
                     onClick={handleResetConnection}
                     className="mt-2 md:mt-0 md:ml-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-2 shrink-0"
                   >
                     <RotateCcw className="h-4 w-4" />
                     Reset Koneksi
                   </button>
               )}
            </div>
          )}
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
