
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { Teacher, Role, ClassGroup, ActivityLog } from '../../types';
import { Plus, Trash2, UserCog, Shield, Key, CheckSquare, Pencil, X, School, Wallet, Clock, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, ArrowUpDown, History, Smartphone, Monitor, Cloud } from 'lucide-react';

type SortKey = 'name' | 'nip' | 'username' | 'roles' | 'lastActive';
type SortDirection = 'asc' | 'desc';

const AccountManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: '', nip: '', roles: [Role.TEACHER], username: '', password: '', assignedClassId: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'lastActive',
    direction: 'desc'
  });

  const [selectedUserLogs, setSelectedUserLogs] = useState<ActivityLog[]>([]);
  const [selectedUserName, setSelectedUserName] = useState('');

  useEffect(() => {
    refreshData();
    const unsubscribe = DataService.subscribeToDataChanges(() => { refreshData(); });
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roles || formData.roles.length === 0) return;
    if (formData.roles.includes(Role.STUDENT) && !formData.assignedClassId) return;

    setIsSaving(true);
    try {
        const userDataToSave = {
            name: formData.name || '',
            nip: formData.nip || '',
            roles: formData.roles || [],
            username: formData.username,
            password: formData.password,
            assignedClassId: formData.roles?.includes(Role.STUDENT) ? formData.assignedClassId : undefined 
        };

        if (isEditMode && editingId) {
          const updatedTeachers = teachers.map(t => t.id === editingId ? { ...t, ...userDataToSave } : t);
          await DataService.saveTeachers(updatedTeachers);
          setTeachers(updatedTeachers);
        } else {
          const newTeacher: Teacher = { id: `t_${Date.now()}`, ...userDataToSave, mustChangePassword: true };
          const updatedTeachers = [...teachers, newTeacher];
          await DataService.saveTeachers(updatedTeachers);
          setTeachers(updatedTeachers);
        }
        setIsModalOpen(false);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus akun ini?')) {
      setIsSaving(true);
      try {
        const updated = teachers.filter(t => t.id !== id);
        await DataService.saveTeachers(updated);
        setTeachers(updated);
      } finally {
        setIsSaving(false);
      }
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

  const getOnlineStatus = (lastActive?: string) => {
    if (!lastActive) return { text: 'Belum pernah login', color: 'text-slate-400', isOnline: false };
    const diff = new Date().getTime() - new Date(lastActive).getTime();
    if (diff < 5 * 60 * 1000) return { text: 'Sedang Online', color: 'text-emerald-600', isOnline: true };
    return { text: new Date(lastActive).toLocaleTimeString(), color: 'text-slate-500', isOnline: false };
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedTeachers = [...teachers].sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    if (sortConfig.key === 'name') return a.name.localeCompare(b.name) * direction;
    return 0;
  });

  const SortHeader = ({ label, sKey, align = 'left' }: any) => (
    <th className="px-6 py-3 font-semibold text-slate-700 cursor-pointer" onClick={() => handleSort(sKey)}>
      <div className="flex items-center gap-2">{label} <ArrowUpDown className="h-3 w-3" /></div>
    </th>
  );

  const availableRoles = [
    { id: Role.TEACHER, label: 'Guru Mapel', color: 'bg-slate-100' },
    { id: Role.WALIKELAS, label: 'Wali Kelas', color: 'bg-green-100' },
    { id: Role.BK, label: 'Guru BK', color: 'bg-blue-100' },
    { id: Role.KESISWAAN, label: 'Kesiswaan', color: 'bg-orange-100' },
    { id: Role.ADMIN, label: 'Admin/TU', color: 'bg-purple-100' },
    { id: Role.STUDENT, label: 'Siswa', color: 'bg-pink-100' },
    { id: Role.OSIS, label: 'OSIS', color: 'bg-yellow-100' },
  ];

  return (
    <div className="space-y-6">
      {isSaving && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800">
                <Cloud className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Menyimpan Akun...</h3>
                <p className="text-sm text-slate-500 mt-2">Menunggu konfirmasi Google Cloud.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-800">Manajemen Akun</h1><p className="text-slate-500">Kelola akun dan pantau aktivitas pengguna.</p></div>
        <div className="flex gap-2">
          <button onClick={() => setIsImportModalOpen(true)} className="bg-white border text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2"><Upload className="h-4 w-4" /> Import</button>
          <button onClick={openAddModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"><Plus className="h-4 w-4" /> Tambah</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b"><tr><th></th><SortHeader label="Nama" sKey="name" /><th>Role</th><th>Aktif</th><th className="text-right px-6">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTeachers.map(t => {
              const status = getOnlineStatus(t.lastActiveAt);
              return (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-6 py-3"><div className={`h-2 w-2 rounded-full ${status.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></div></td>
                <td className="px-6 py-3 font-medium"><div><p>{t.name}</p><p className="text-[10px] text-slate-400">@{t.username}</p></div></td>
                <td className="px-6 py-3 flex flex-wrap gap-1">{t.roles.map(r => <span key={r} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{r}</span>)}</td>
                <td className="px-6 py-3 text-xs">{status.text}</td>
                <td className="px-6 py-3 text-right">
                    <button onClick={() => openEditModal(t)} className="text-indigo-600 mr-2"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-4">{isEditMode ? 'Edit Akun' : 'Tambah Akun'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input required className="w-full border p-2 rounded" placeholder="Nama" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input required className="w-full border p-2 rounded" placeholder="NIP/NIS" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input required className="w-full border p-2 rounded" placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                <input required className="w-full border p-2 rounded" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="p-3 bg-slate-50 rounded border text-xs">
                <p className="font-bold mb-2">Role:</p>
                <div className="grid grid-cols-2 gap-2">
                  {availableRoles.map(r => (
                    <div key={r.id} onClick={() => toggleRole(r.id)} className={`p-2 border rounded cursor-pointer ${formData.roles?.includes(r.id) ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{r.label}</div>
                  ))}
                </div>
              </div>
              {formData.roles?.includes(Role.STUDENT) && (
                <select required className="w-full border p-2 rounded text-sm" value={formData.assignedClassId} onChange={e => setFormData({...formData, assignedClassId: e.target.value})}>
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2">Batal</button><button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded">Simpan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
