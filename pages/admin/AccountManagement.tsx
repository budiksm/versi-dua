
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { Teacher, Role, ClassGroup } from '../../types';
import { Plus, Trash2, UserCog, Shield, Key, Pencil, X, Save, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, ArrowUpDown, History, User, Cloud } from 'lucide-react';

type SortKey = 'name' | 'nip' | 'username' | 'lastActive';
type SortDirection = 'asc' | 'desc';

const AccountManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
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
    key: 'name',
    direction: 'asc'
  });

  useEffect(() => {
    refreshData();
    const unsubscribe = DataService.subscribeToDataChanges(() => refreshData());
    return () => unsubscribe();
  }, []);

  const refreshData = () => {
    setTeachers(DataService.getTeachers());
    setClasses(DataService.getClasses());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roles || formData.roles.length === 0) return;
    setIsSaving(true);
    try {
        const userData: any = {
            name: formData.name || '',
            nip: formData.nip || '',
            roles: formData.roles || [],
            username: formData.username,
            password: formData.password,
            assignedClassId: formData.roles?.includes(Role.STUDENT) ? formData.assignedClassId : undefined 
        };

        if (isEditMode && editingId) {
          const updated = teachers.map(t => t.id === editingId ? { ...t, ...userData } : t);
          await DataService.saveTeachers(updated);
        } else {
          const newAcc: Teacher = { id: `acc_${Date.now()}`, ...userData, mustChangePassword: true };
          await DataService.saveTeachers([...teachers, newAcc]);
        }
        setIsModalOpen(false);
    } catch (err) {
        alert("Gagal simpan.");
    } finally {
        setIsSaving(false);
    }
  };

  const toggleRole = (role: Role) => {
    const current = formData.roles || [];
    setFormData({ ...formData, roles: current.includes(role) ? current.filter(r => r !== role) : [...current, role] });
  };

  const sortedTeachers = [...teachers].sort((a, b) => {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    if (sortConfig.key === 'name') return a.name.localeCompare(b.name) * dir;
    return 0;
  });

  const getOnlineStatus = (lastActive?: string) => {
    if (!lastActive) return { text: 'N/A', color: 'bg-slate-300' };
    const diff = Date.now() - new Date(lastActive).getTime();
    if (diff < 5 * 60000) return { text: 'Online', color: 'bg-emerald-500 animate-pulse' };
    return { text: new Date(lastActive).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), color: 'bg-slate-400' };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isSaving && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800 animate-bounce-slow">
                <Cloud className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Sinkronisasi Cloud...</h3>
                <p className="text-sm text-slate-500 mt-2">Menyimpan data akun ke database sekolah.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div><h1 className="text-2xl font-bold text-slate-800">Manajemen Akun Pengguna</h1><p className="text-slate-500">Kelola akses guru, wali kelas, BK, dan kesiswaan.</p></div>
        <div className="flex gap-2">
          <button onClick={() => setIsImportModalOpen(true)} className="bg-white border text-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-slate-50"><Upload className="h-4 w-4" /> Import</button>
          <button onClick={() => { setIsEditMode(false); setFormData({name:'', nip:'', username:'', password:'123', roles:[Role.TEACHER]}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"><Plus className="h-5 w-5" /> Tambah Akun</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-600">Status</th>
              <th className="px-6 py-4 font-bold text-slate-600 cursor-pointer" onClick={() => setSortConfig({key:'name', direction: sortConfig.direction==='asc'?'desc':'asc'})}>Nama & Username</th>
              <th className="px-6 py-4 font-bold text-slate-600">Hak Akses (Roles)</th>
              <th className="px-6 py-4 font-bold text-slate-600">Terakhir Aktif</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTeachers.map(t => {
              const status = getOnlineStatus(t.lastActiveAt);
              return (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-center"><div className={`h-2.5 w-2.5 rounded-full mx-auto ${status.color}`} title={status.text}></div></td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{t.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 tracking-wider">@{t.username} • {t.nip}</div>
                  </td>
                  <td className="px-6 py-4 flex flex-wrap gap-1">
                    {t.roles.map(r => (
                      <span key={r} className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                        r === Role.ADMIN ? 'bg-purple-100 text-purple-700' :
                        r === Role.BK ? 'bg-blue-100 text-blue-700' :
                        r === Role.KESISWAAN ? 'bg-orange-100 text-orange-700' :
                        r === Role.WALIKELAS ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>{r}</span>
                    ))}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-500">{status.text}</td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingId(t.id); setFormData(t); setIsEditMode(true); setIsModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if(confirm('Hapus akun?')) DataService.saveTeachers(teachers.filter(acc => acc.id !== t.id)) }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                     </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-indigo-600 p-5 text-white flex justify-between items-center">
                 <h2 className="font-bold text-lg">{isEditMode ? 'Edit Profil Akun' : 'Buat Akun Baru'}</h2>
                 <button onClick={() => setIsModalOpen(false)} className="hover:bg-indigo-700 p-1 rounded-lg"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Dasar</label><input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nama Lengkap" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /><input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="NIP / NIS" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} /></div>
                 <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</label><input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label><input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hak Akses (Multiple)</label><div className="grid grid-cols-2 gap-2">
                    {[Role.TEACHER, Role.WALIKELAS, Role.BK, Role.KESISWAAN, Role.ADMIN, Role.STUDENT, Role.OSIS].map(r => (
                      <div key={r} onClick={() => toggleRole(r)} className={`p-2 border rounded-xl cursor-pointer text-[10px] font-bold text-center transition-all ${formData.roles?.includes(r) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-300'}`}>{r}</div>
                    ))}
                 </div></div>
                 <button type="submit" disabled={isSaving} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:bg-slate-300"><Save className="h-5 w-5" /> Simpan Perubahan</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
