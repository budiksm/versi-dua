
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { Teacher, Role, ClassGroup, ActivityLog } from '../../types';
import { Plus, Trash2, UserCog, Shield, Key, CheckSquare, Pencil, X, School, Wallet, Clock, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, ArrowUpDown, History, Smartphone, Monitor } from 'lucide-react';

type SortKey = 'name' | 'nip' | 'username' | 'roles' | 'lastActive';
type SortDirection = 'asc' | 'desc';

const AccountManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]); // Load Classes
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  
  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: '', nip: '', roles: [Role.TEACHER], username: '', password: '', assignedClassId: ''
  });

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'lastActive', // Default sort by online status
    direction: 'desc'
  });

  // Log Modal State
  const [selectedUserLogs, setSelectedUserLogs] = useState<ActivityLog[]>([]);
  const [selectedUserName, setSelectedUserName] = useState('');

  useEffect(() => {
    refreshData();
    // Subscribe to Realtime Updates
    const unsubscribe = DataService.subscribeToDataChanges(() => {
        refreshData();
    });
    
    return () => unsubscribe();
  }, []);

  const refreshData = () => {
    setTeachers(DataService.getTeachers());
    setClasses(DataService.getClasses());
    setLogs(DataService.getActivityLogs());
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData({ name: '', nip: '', roles: [Role.TEACHER], username: '', password: '123', assignedClassId: '' }); 
    setIsModalOpen(true);
  };

  const openEditModal = (teacher: Teacher) => {
    setIsEditMode(true);
    setEditingId(teacher.id);
    setFormData({
      name: teacher.name,
      nip: teacher.nip,
      roles: teacher.roles,
      username: teacher.username,
      password: teacher.password,
      assignedClassId: teacher.assignedClassId || ''
    });
    setIsModalOpen(true);
  };

  const openLogModal = (teacher: Teacher) => {
    const userLogs = logs.filter(l => l.userId === teacher.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setSelectedUserLogs(userLogs);
    setSelectedUserName(teacher.name);
    setIsLogModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.roles || formData.roles.length === 0) {
      alert("Pilih minimal satu role!");
      return;
    }

    if (formData.roles.includes(Role.STUDENT) && !formData.assignedClassId) {
        alert("Untuk akun Siswa, Anda wajib memilih Kelas!");
        return;
    }

    const isUsernameTaken = teachers.some(t => 
      t.username === formData.username && t.id !== editingId
    );

    if (isUsernameTaken) {
      alert("Username sudah digunakan oleh akun lain!");
      return;
    }

    const userDataToSave = {
        name: formData.name || '',
        nip: formData.nip || '',
        roles: formData.roles || [],
        username: formData.username,
        password: formData.password,
        assignedClassId: formData.roles?.includes(Role.STUDENT) ? formData.assignedClassId : undefined 
    };

    if (isEditMode && editingId) {
      const updatedTeachers = teachers.map(t => {
        if (t.id === editingId) {
          return { ...t, ...userDataToSave };
        }
        return t;
      });
      DataService.saveTeachers(updatedTeachers);
      setTeachers(updatedTeachers);
    } else {
      const newTeacher: Teacher = {
        id: `t_${Date.now()}`,
        ...userDataToSave,
        mustChangePassword: true 
      };
      const updatedTeachers = [...teachers, newTeacher];
      DataService.saveTeachers(updatedTeachers);
      setTeachers(updatedTeachers);
    }

    setIsModalOpen(false);
    setFormData({ name: '', nip: '', roles: [Role.TEACHER], username: '', password: '', assignedClassId: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus akun ini?')) {
      const updated = teachers.filter(t => t.id !== id);
      DataService.saveTeachers(updated);
      setTeachers(updated);
    }
  };

  const toggleRole = (role: Role) => {
    const currentRoles = formData.roles || [];
    if (currentRoles.includes(role)) {
      setFormData({ ...formData, roles: currentRoles.filter(r => r !== role) });
    } else {
      setFormData({ ...formData, roles: [...currentRoles, role] });
    }
  };

  // --- ONLINE STATUS HELPER ---
  const getOnlineStatus = (lastActive?: string) => {
    if (!lastActive) return { text: 'Belum pernah login', color: 'text-slate-400', isOnline: false };
    
    const diff = new Date().getTime() - new Date(lastActive).getTime();
    if (diff < 5 * 60 * 1000) { // < 5 mins
       return { text: 'Sedang Online', color: 'text-emerald-600', isOnline: true };
    } else if (diff < 60 * 60 * 1000) { // < 1 hour
       const mins = Math.floor(diff / 60000);
       return { text: `${mins} menit lalu`, color: 'text-slate-500', isOnline: false };
    } else if (diff < 24 * 60 * 60 * 1000) {
       const hours = Math.floor(diff / 3600000);
       return { text: `${hours} jam lalu`, color: 'text-slate-500', isOnline: false };
    } else {
       return { text: new Date(lastActive).toLocaleDateString(), color: 'text-slate-400', isOnline: false };
    }
  };

  // --- SORTING LOGIC ---
  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTeachers = [...teachers].sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    switch (sortConfig.key) {
      case 'name':
        return a.name.localeCompare(b.name) * direction;
      case 'nip':
        return a.nip.localeCompare(b.nip) * direction;
      case 'username':
        return (a.username || '').localeCompare(b.username || '') * direction;
      case 'roles':
        const rolesA = a.roles.join(', ');
        const rolesB = b.roles.join(', ');
        return rolesA.localeCompare(rolesB) * direction;
      case 'lastActive':
        const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return (timeA - timeB) * direction;
      default:
        return 0;
    }
  });

  const SortHeader = ({ label, sKey, align = 'left' }: { label: string, sKey: SortKey, align?: 'left'|'right'|'center' }) => (
    <th 
      className={`px-6 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors select-none text-${align}`}
      onClick={() => handleSort(sKey)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <span className="text-slate-400">
          {sortConfig.key === sKey ? (
            sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 text-indigo-600" /> : <ChevronDown className="h-4 w-4 text-indigo-600" />
          ) : (
            <ArrowUpDown className="h-4 w-4" />
          )}
        </span>
      </div>
    </th>
  );

  // --- IMPORT LOGIC ---
  const downloadTemplate = () => {
    const headers = "Nama Lengkap,NIP,Username,Password,Role (Gunakan ; untuk banyak role),ID Kelas (Wajib jika Siswa)";
    const example1 = "Budi Guru,19800101,pakbudi,123,TEACHER;WALIKELAS,";
    const example2 = "Siti Bendahara,1001,siti,123,STUDENT,c1";
    const csvContent = `${headers}\n${example1}\n${example2}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_akun.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportError('');
    setImportSuccess('');

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        
        if (rows.length < 2) {
          setImportError('File kosong atau format salah.');
          return;
        }

        const newAccounts: Teacher[] = [];
        const errors: string[] = [];
        let successCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(/,|;/).map(c => c.trim().replace(/^"|"$/g, ''));
          
          if (cols.length < 4) continue;

          const [name, nip, username, password, roleStr, assignedClassId] = cols;

          // Basic Validation
          if (!username || !roleStr) {
             errors.push(`Baris ${i+1}: Username dan Role wajib diisi.`);
             continue;
          }

          // Duplicate Username Check
          if (teachers.some(t => t.username === username) || newAccounts.some(t => t.username === username)) {
             errors.push(`Baris ${i+1}: Username "${username}" sudah digunakan.`);
             continue;
          }

          // Parse Roles
          const roles = roleStr.split(';').map(r => r.trim().toUpperCase()) as Role[];
          
          // Role Validation
          const validRoles = Object.values(Role);
          if (roles.some(r => !validRoles.includes(r))) {
             errors.push(`Baris ${i+1}: Role tidak valid. Gunakan format kapital (contoh: TEACHER;ADMIN).`);
             continue;
          }

          // Class Validation for Students
          if (roles.includes(Role.STUDENT) && !assignedClassId) {
             errors.push(`Baris ${i+1}: Akun STUDENT wajib menyertakan ID Kelas.`);
             continue;
          }

          newAccounts.push({
            id: `t_imp_${Date.now()}_${i}`,
            name,
            nip,
            username,
            password: password || '123',
            roles,
            assignedClassId: assignedClassId || undefined,
            mustChangePassword: true
          });
          successCount++;
        }

        if (errors.length > 0) {
           setImportError(errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n...dan ${errors.length - 5} error lainnya.` : ''));
        }

        if (successCount > 0) {
           const updated = [...teachers, ...newAccounts];
           DataService.saveTeachers(updated);
           setTeachers(updated);
           setImportSuccess(`Berhasil mengimpor ${successCount} akun baru.`);
           
           if (fileInputRef.current) fileInputRef.current.value = '';
           
           setTimeout(() => {
              if(errors.length === 0) setIsImportModalOpen(false);
              setImportSuccess('');
           }, 2000);
        }

      } catch (err) {
        setImportError('Gagal memproses file. Pastikan format CSV valid.');
      }
    };
    reader.readAsText(file);
  };

  const availableRoles = [
    { id: Role.TEACHER, label: 'Guru Mata Pelajaran', color: 'bg-slate-100 text-slate-700' },
    { id: Role.WALIKELAS, label: 'Wali Kelas', color: 'bg-green-100 text-green-700' },
    { id: Role.BK, label: 'Guru BK', color: 'bg-blue-100 text-blue-700' },
    { id: Role.KESISWAAN, label: 'Staf Kesiswaan', color: 'bg-orange-100 text-orange-700' },
    { id: Role.ADMIN, label: 'Admin / Tata Usaha', color: 'bg-purple-100 text-purple-700' },
    { id: Role.STUDENT, label: 'Siswa', color: 'bg-pink-100 text-pink-700' },
    { id: Role.OSIS, label: 'OSIS', color: 'bg-yellow-100 text-yellow-800' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Akun</h1>
          <p className="text-slate-500">Kelola akun dan pantau aktivitas pengguna.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button 
            onClick={openAddModal}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Tambah Akun
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700 w-10">Status</th>
              <SortHeader label="Nama Lengkap" sKey="name" />
              <SortHeader label="Role & Akses" sKey="roles" />
              <SortHeader label="Terakhir Aktif" sKey="lastActive" />
              <th className="px-6 py-3 font-semibold text-slate-700 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTeachers.map(t => {
              const status = getOnlineStatus(t.lastActiveAt);
              return (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3">
                   <div className={`h-3 w-3 rounded-full ${status.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} title={status.isOnline ? "Online" : "Offline"}></div>
                </td>
                <td className="px-6 py-3 font-medium text-slate-900">
                    <div className="flex flex-col">
                        <span>{t.name}</span>
                        <span className="text-xs text-slate-400 font-normal">@{t.username} • {t.nip}</span>
                        {t.roles.includes(Role.STUDENT) && t.assignedClassId && (
                            <div className="text-xs text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                                <School className="h-3 w-3" />
                                {classes.find(c => c.id === t.assignedClassId)?.name || 'Kelas Terhapus'}
                            </div>
                        )}
                    </div>
                </td>
                <td className="px-6 py-3">
                  <div className="flex flex-wrap gap-1">
                    {t.roles && t.roles.map(r => {
                       const roleConfig = availableRoles.find(ar => ar.id === r);
                       return (
                        <span key={r} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleConfig?.color || 'bg-slate-100'}`}>
                            {r === Role.ADMIN ? <Shield className="h-3 w-3" /> : ''}
                            {r === Role.STUDENT ? <Wallet className="h-3 w-3" /> : ''}
                            {r === Role.OSIS ? <Clock className="h-3 w-3" /> : ''}
                            {roleConfig?.label || r}
                        </span>
                       );
                    })}
                    {t.mustChangePassword && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700" title="User harus ganti password saat login">
                             Wajib Ganti Password
                        </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                   <span className={`text-xs font-medium ${status.color}`}>
                      {status.text}
                   </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => openLogModal(t)} 
                      className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                      title="Lihat Log Login"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => openEditModal(t)} 
                      className="text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"
                      title="Edit Akun"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(t.id)} 
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                      title="Hapus Akun"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* --- IMPORT MODAL --- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
           <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                     <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                     Import Akun Massal
                  </h2>
                  <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
              </div>

              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                    <p className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                       <AlertCircle className="h-4 w-4 text-orange-500" /> Aturan Validasi:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 space-y-1 text-xs">
                      <li>Kolom: <b>Nama, NIP, Username, Password, Role, ID Kelas</b>.</li>
                      <li>Role bisa lebih dari satu, pisahkan dengan titik koma (;). Contoh: <b>TEACHER;WALIKELAS</b>.</li>
                      <li>Role valid: TEACHER, WALIKELAS, BK, KESISWAAN, ADMIN, STUDENT, OSIS.</li>
                      <li>Jika Role = <b>STUDENT</b>, kolom ID Kelas wajib diisi.</li>
                    </ul>
                 </div>
                 
                 <button 
                   onClick={downloadTemplate}
                   className="w-full py-2.5 px-4 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center justify-center gap-2 font-bold transition-all"
                 >
                    <Download className="h-4 w-4" /> Download Template CSV
                 </button>

                 <div className="pt-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih File CSV</label>
                    <input 
                      type="file" 
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleImportCSV}
                      className="block w-full text-xs text-slate-500
                        file:mr-4 file:py-2.5 file:px-4
                        file:rounded-full file:border-0
                        file:text-xs file:font-bold
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100
                        transition-all
                      "
                    />
                 </div>

                 {importError && (
                    <div className="p-3 bg-red-50 text-red-600 text-[10px] rounded-lg whitespace-pre-line max-h-32 overflow-y-auto border border-red-100 font-medium">
                       {importError}
                    </div>
                 )}

                 {importSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg flex items-center gap-2 border border-emerald-100 font-bold">
                       <CheckCircle2 className="h-4 w-4" /> {importSuccess}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* --- ADD/EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl w-full max-w-md m-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{isEditMode ? 'Edit Akun' : 'Tambah Akun Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 font-medium">Nama Lengkap</label>
                <input required type="text" className="w-full border p-2 rounded-lg" placeholder="Nama Guru / Siswa / Petugas" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1 font-medium">NIP / NIS</label>
                <input required type="text" className="w-full border p-2 rounded-lg" placeholder="Identitas unik" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm mb-1 font-medium">Username</label>
                    <input required type="text" className="w-full border p-2 rounded-lg" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-sm mb-1 font-medium">Password</label>
                    <input required type="text" className="w-full border p-2 rounded-lg" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    {!isEditMode && <p className="text-[10px] text-slate-500 mt-1">Default "123".</p>}
                 </div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <label className="block text-sm mb-3 font-medium flex items-center gap-2">
                   <Key className="h-4 w-4 text-slate-500" />
                   Pilih Role / Jabatan
                </label>
                <div className="space-y-2">
                  {availableRoles.map((roleOption) => {
                    const isChecked = formData.roles?.includes(roleOption.id);
                    return (
                      <div 
                        key={roleOption.id}
                        onClick={() => toggleRole(roleOption.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                         <div className={`h-5 w-5 rounded flex items-center justify-center border ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                            {isChecked && <CheckSquare className="h-4 w-4" />}
                         </div>
                         <span className={`text-sm font-medium ${isChecked ? 'text-indigo-900' : 'text-slate-600'}`}>
                           {roleOption.label}
                         </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* SPECIAL INPUT FOR STUDENT ROLE: CLASS ASSIGNMENT */}
              {formData.roles?.includes(Role.STUDENT) && (
                  <div className="bg-pink-50 p-4 rounded-lg border border-pink-200 animate-fade-in">
                      <label className="block text-sm font-bold text-pink-800 mb-2 flex items-center gap-2">
                          <School className="h-4 w-4" />
                          Tugaskan ke Kelas (Wajib)
                      </label>
                      <p className="text-xs text-pink-600 mb-2">Akun ini hanya akan bisa mengakses Poe Ibu kelas yang dipilih.</p>
                      <select 
                        required
                        className="w-full border border-pink-300 p-2.5 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white"
                        value={formData.assignedClassId}
                        onChange={e => setFormData({...formData, assignedClassId: e.target.value})}
                      >
                          <option value="">-- Pilih Kelas --</option>
                          {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name} (Tingkat {c.level})</option>
                          ))}
                      </select>
                  </div>
              )}

              <div className="flex gap-2 justify-end mt-4 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm">
                  {isEditMode ? 'Simpan Perubahan' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LOG MODAL --- */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
              <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2">
                    <History className="h-5 w-5" /> Riwayat Login: {selectedUserName}
                 </h3>
                 <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                 {selectedUserLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 italic">
                       Belum ada riwayat login tercatat.
                    </div>
                 ) : (
                    selectedUserLogs.map(log => (
                       <div key={log.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center">
                          <div>
                             <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                {log.action === 'LOGIN' ? <span className="text-green-600">LOGIN</span> : <span className="text-slate-500">LOGOUT</span>}
                                <span className="text-xs font-normal text-slate-400">| {log.deviceInfo ? 'Web App' : 'Unknown'}</span>
                             </div>
                             <div className="text-xs text-slate-500 mt-1">
                                {new Date(log.timestamp).toLocaleDateString('id-ID', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                             </div>
                          </div>
                          <div className="text-right">
                             <div className="text-lg font-mono font-bold text-slate-800">
                                {new Date(log.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                             </div>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
