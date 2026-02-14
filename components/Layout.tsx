
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  AlertOctagon
} from 'lucide-react';
import { Role } from '../types';
import { DataService, SyncState } from '../services/dataService';

interface LayoutProps {
  children: React.ReactNode;
  role: Role; 
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Sync Status State
  const [syncState, setSyncState] = useState<SyncState>('IDLE');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const currentUser = DataService.getCurrentUser();

  // Force Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Subscribe to DataService Sync events
    const unsubscribe = DataService.subscribeToSync((state, time) => {
      setSyncState(state);
      if (time) setLastSync(time);
    });
    
    if (currentUser?.mustChangePassword && !successMessage) {
      setShowPasswordModal(true);
    }

    return () => unsubscribe();
  }, [currentUser, successMessage]);

  const handleLogout = () => {
    DataService.logout();
    navigate('/');
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
    if (newPassword.length < 4) {
      setPasswordError('Password minimal 4 karakter.');
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

  // --- MENU CONFIG ---
  const teacherLinks = [
    { path: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/teacher/classes', label: 'Daftar Kelas', icon: Users },
  ];
  const bkLinks = [
    { path: '/teacher/bk/active', label: 'Pembinaan Aktif', icon: HeartHandshake },
  ];
  const kesiswaanLinks = [
    { path: '/teacher/kesiswaan/monitoring', label: 'Monitoring Siswa', icon: MonitorCheck },
    { path: '/teacher/kesiswaan/action', label: 'Pembinaan & SP', icon: Gavel },
  ];
  const adminLinks = [
    { path: '/admin/students', label: 'Manajemen Siswa', icon: Users },
    { path: '/admin/accounts', label: 'Manajemen Akun', icon: UserCog },
    { path: '/admin/config', label: 'Konfigurasi Poin', icon: ShieldCheck },
  ];

  const roles = currentUser?.roles || [];
  let finalLinks: any[] = [];
  
  if (roles.includes(Role.ADMIN)) {
    finalLinks = [...adminLinks];
    if (roles.some(r => [Role.TEACHER, Role.WALIKELAS, Role.BK, Role.KESISWAAN].includes(r))) {
       finalLinks = [...finalLinks, ...teacherLinks];
    }
  } else {
    finalLinks = [...teacherLinks];
  }
  if (roles.includes(Role.BK)) finalLinks = [...finalLinks, ...bkLinks];
  if (roles.includes(Role.KESISWAAN)) finalLinks = [...finalLinks, ...kesiswaanLinks];
  
  finalLinks = finalLinks.filter((link, index, self) =>
    index === self.findIndex((t) => t.path === link.path)
  );

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
                      <input type="password" required className="w-full p-3 border rounded-lg" placeholder="Password Baru" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      <input type="password" required className="w-full p-3 border rounded-lg" placeholder="Konfirmasi Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                      {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
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
        <div className="flex h-16 items-center px-6 border-b border-slate-100 gap-2 font-bold text-indigo-900 text-lg">
           <School className="h-6 w-6 text-indigo-600" /> SMKN Jayakerta
        </div>

        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-50">
           <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
             <User className="h-5 w-5" />
           </div>
           <div className="overflow-hidden">
             <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.name || 'User'}</p>
             <p className="text-[10px] text-slate-500 uppercase leading-tight mt-0.5 truncate">{roles.join(', ')}</p>
           </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {finalLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
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
             {/* SYNC INDICATOR */}
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200" title="Status Sinkronisasi Data">
                {syncState === 'SYNCING' && (
                  <>
                     <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                     <span className="text-xs font-medium text-blue-600">Menyimpan...</span>
                  </>
                )}
                {syncState === 'SAVED' && (
                  <>
                     <Cloud className="h-4 w-4 text-emerald-600" />
                     <span className="text-xs font-medium text-emerald-600">Tersimpan</span>
                  </>
                )}
                {syncState === 'IDLE' && (
                  <>
                     <Cloud className="h-4 w-4 text-slate-400" />
                     <span className="text-xs text-slate-400">Siap</span>
                  </>
                )}
                {syncState === 'ERROR' && (
                  <>
                     <AlertOctagon className="h-4 w-4 text-red-500" />
                     <span className="text-xs font-bold text-red-500">Gagal Simpan!</span>
                  </>
                )}
             </div>
          </div>
          
          <div className="text-xs text-slate-400 hidden sm:block">
            {lastSync ? `Sinkronisasi terakhir: ${lastSync.toLocaleTimeString()}` : ''}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          {syncState === 'ERROR' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-pulse">
               <AlertOctagon className="h-6 w-6 text-red-600 shrink-0" />
               <div>
                  <h3 className="text-sm font-bold text-red-800">Koneksi Database Bermasalah</h3>
                  <p className="text-xs text-red-600 mt-1">
                     Data tidak dapat disimpan ke server. Kemungkinan penyebab:
                     <ul className="list-disc list-inside mt-1 ml-1">
                        <li>Koneksi internet terputus.</li>
                        <li><b>Security Rules Firebase memblokir akses (Paling Umum).</b></li>
                     </ul>
                     Hubungi developer untuk mengubah "Firestore Rules" menjadi Test Mode.
                  </p>
               </div>
            </div>
          )}
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
