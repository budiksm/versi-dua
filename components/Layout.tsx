
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
  CheckCircle
} from 'lucide-react';
import { Role } from '../types';
import { DataService } from '../services/dataService';

interface LayoutProps {
  children: React.ReactNode;
  role: Role; 
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // We need to trigger re-renders when user data changes (e.g. password update)
  const currentUser = DataService.getCurrentUser();

  // Force Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Only show if the flag is true AND we haven't just successfully updated it (successMessage check)
    if (currentUser?.mustChangePassword && !successMessage) {
      setShowPasswordModal(true);
    }
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
      setPasswordError('Dilarang menggunakan password default "123". Harap gunakan password lain.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Password minimal 4 karakter.');
      return;
    }

    if (currentUser) {
      setIsSavingPass(true);
      // Simulate API call
      setTimeout(() => {
        DataService.updatePassword(currentUser.id, newPassword);
        setIsSavingPass(false);
        setSuccessMessage('Password berhasil diubah!');
        
        // Close modal after short delay to show success message
        setTimeout(() => {
          setShowPasswordModal(false);
          setSuccessMessage('');
          // No reload needed. The modal closes, user is already on the protected route.
        }, 1000);
      }, 800);
    }
  };

  // Base Teacher Links
  const teacherLinks = [
    { path: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/teacher/classes', label: 'Daftar Kelas', icon: Users },
  ];

  // BK Specific Links
  const bkLinks = [
    { path: '/teacher/bk/active', label: 'Pembinaan Aktif', icon: HeartHandshake },
  ];

  // Kesiswaan Specific Links
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
  const hasAdminRole = roles.includes(Role.ADMIN);
  const isKesiswaan = roles.includes(Role.KESISWAAN);
  const isBK = roles.includes(Role.BK);

  let finalLinks: any[] = [];
  
  if (hasAdminRole) {
    finalLinks = [...adminLinks];
    // Admins who are also educators get teacher links
    if (roles.some(r => [Role.TEACHER, Role.WALIKELAS, Role.BK, Role.KESISWAAN].includes(r))) {
       finalLinks = [...finalLinks, ...teacherLinks];
    }
  } else {
    finalLinks = [...teacherLinks];
  }

  // Inject BK menus if eligible
  if (isBK) {
    // Insert BK links after Dashboard/Classes but before Kesiswaan if exists
    finalLinks = [...finalLinks, ...bkLinks];
  }

  // Inject Kesiswaan menus if eligible
  if (isKesiswaan) {
    finalLinks = [...finalLinks, ...kesiswaanLinks];
  }
  
  // Remove duplicates
  finalLinks = finalLinks.filter((link, index, self) =>
    index === self.findIndex((t) => t.path === link.path)
  );

  const getMenuLabel = () => {
    if (roles.length > 0) return roles.join(' & ');
    return 'User';
  };

  return (
    <div className="flex h-screen bg-slate-50">
      
      {/* BLOCKING PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
              <div className="bg-red-600 p-6 text-center text-white">
                 <Lock className="h-12 w-12 mx-auto mb-2 opacity-90" />
                 <h2 className="text-xl font-bold">Wajib Ganti Password</h2>
                 <p className="text-red-100 text-sm mt-1">Akun baru wajib mengubah password default demi keamanan.</p>
              </div>
              <div className="p-8">
                 {successMessage ? (
                    <div className="text-center py-8 animate-fade-in">
                       <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                          <CheckCircle className="h-8 w-8" />
                       </div>
                       <h3 className="text-xl font-bold text-slate-800 mb-2">Berhasil!</h3>
                       <p className="text-slate-500">Password Anda telah diperbarui. Mengalihkan...</p>
                    </div>
                 ) : (
                   <form onSubmit={handlePasswordChangeSubmit} className="space-y-5">
                      <div>
                         <label className="block text-sm font-bold text-slate-700 mb-1">Password Baru</label>
                         <input 
                           type="password" 
                           required
                           autoFocus
                           className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all"
                           placeholder="Masukkan password baru..."
                           value={newPassword}
                           onChange={e => setNewPassword(e.target.value)}
                         />
                         <p className="text-xs text-slate-400 mt-1">Dilarang menggunakan "123"</p>
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-slate-700 mb-1">Konfirmasi Password</label>
                         <input 
                           type="password" 
                           required
                           className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all"
                           placeholder="Ulangi password baru..."
                           value={confirmPassword}
                           onChange={e => setConfirmPassword(e.target.value)}
                         />
                      </div>

                      {passwordError && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                          <X className="h-4 w-4 mt-0.5 shrink-0" />
                          {passwordError}
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={isSavingPass}
                        className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isSavingPass ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
                      </button>

                      <div className="text-center pt-2">
                         <p className="text-xs text-slate-400">Anda tidak dapat menutup halaman ini sampai password diganti.</p>
                      </div>
                   </form>
                 )}
              </div>
           </div>
        </div>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-indigo-900 text-lg">
            <School className="h-6 w-6 text-indigo-600" />
            <span className="truncate">SMKN Jayakerta</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-50">
           <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
             <User className="h-5 w-5" />
           </div>
           <div className="overflow-hidden">
             <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.name || 'User'}</p>
             <p className="text-[10px] text-slate-500 uppercase leading-tight mt-0.5 truncate">{getMenuLabel()}</p>
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between bg-white px-6 shadow-sm lg:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold text-slate-700">SMKN Jayakerta</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
