
import React, { useState, useEffect } from 'react';
import { DataService } from '../../services/dataService';
import { Teacher, Role, ClassGroup } from '../../types';
import { Plus, Trash2, UserCog, Shield, Pencil, X, Save, Cloud, User, Search, Filter, ShieldCheck, UserCheck, Star, Zap } from 'lucide-react';

const AccountManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: '', nip: '', roles: [Role.TEACHER], username: '', password: '', assignedClassId: ''
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
        alert("Gagal sinkronisasi akun.");
    } finally {
        setIsSaving(false);
    }
  };

  const toggleRole = (role: Role) => {
    const current = formData.roles || [];
    setFormData({ ...formData, roles: current.includes(role) ? current.filter(r => r !== role) : [...current, role] });
  };

  const getOnlineStatus = (lastActive?: string) => {
    if (!lastActive) return { text: 'OFFLINE', color: 'bg-slate-300' };
    const diff = Date.now() - new Date(lastActive).getTime();
    if (diff < 5 * 60000) return { text: 'ONLINE', color: 'bg-emerald-500 animate-pulse' };
    return { text: new Date(lastActive).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), color: 'bg-slate-400' };
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.nip.includes(searchTerm) || 
    t.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {isSaving && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white">
            <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center text-slate-800 scale-110">
                <Cloud className="h-20 w-20 text-indigo-600 animate-pulse mb-6" />
                <h3 className="text-2xl font-black tracking-tight">Menyimpan Akun...</h3>
                <p className="text-slate-500 mt-2 font-medium">Menyinkronkan otentikasi ke database Google.</p>
                <div className="w-56 h-2 bg-slate-100 rounded-full mt-8 overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manajemen Akses Pengguna</h1>
          <p className="text-slate-500 font-medium">Kelola otentikasi dan hak akses hirarki sekolah.</p>
        </div>
        <button onClick={() => { setIsEditMode(false); setFormData({name:'', nip:'', username:'', password:'123', roles:[Role.TEACHER]}); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-black tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all"><Plus className="h-6 w-6" /> TAMBAH AKUN BARU</button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input type="text" placeholder="Cari nama, nip, atau username..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs"><Filter className="h-4 w-4" /> TOTAL: {filteredTeachers.length} AKUN</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map(t => {
          const status = getOnlineStatus(t.lastActiveAt);
          return (
            <div key={t.id} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
               <div className="flex justify-between items-start mb-5">
                  <div className="relative">
                    <div className="h-16 w-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center text-slate-400 group-hover:from-indigo-50 group-hover:to-indigo-100 group-hover:text-indigo-600 transition-all shadow-inner border border-slate-100"><User className="h-8 w-8" /></div>
                    <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white ${status.color}`} title={status.text}></div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                     <button onClick={() => { setEditingId(t.id); setFormData(t); setIsEditMode(true); setIsModalOpen(true); }} className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><Pencil className="h-4 w-4" /></button>
                     <button onClick={() => { if(confirm('Hapus akun?')) DataService.saveTeachers(teachers.filter(acc => acc.id !== t.id)) }} className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm"><Trash2 className="h-4 w-4" /></button>
                  </div>
               </div>
               
               <div className="mb-6">
                  <h3 className="font-black text-lg text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{t.name}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">NIP: {t.nip} • @{t.username}</p>
               </div>

               <div className="flex flex-wrap gap-1.5 mb-6">
                  {t.roles.map(r => (
                    <span key={r} className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tighter shadow-sm border ${
                      r === Role.ADMIN ? 'bg-purple-600 text-white border-purple-500' :
                      r === Role.BK ? 'bg-blue-600 text-white border-blue-500' :
                      r === Role.KESISWAAN ? 'bg-orange-500 text-white border-orange-400' :
                      r === Role.WALIKELAS ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>{r}</span>
                  ))}
               </div>

               <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{status.text}</span>
                  <div className="flex -space-x-2">
                     {t.roles.includes(Role.ADMIN) && <ShieldCheck className="h-5 w-5 text-purple-400" />}
                     {t.roles.includes(Role.KESISWAAN) && <Zap className="h-5 w-5 text-orange-400" />}
                     {t.roles.includes(Role.WALIKELAS) && <Star className="h-5 w-5 text-yellow-400" />}
                  </div>
               </div>
            </div>
          )
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-fade-in backdrop-blur-sm overflow-y-auto">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden my-auto">
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center relative overflow-hidden">
                 <div className="absolute right-0 top-0 opacity-10"><UserCog className="h-32 w-32 -mr-8 -mt-8" /></div>
                 <div className="relative z-10">
                    <h2 className="text-2xl font-black tracking-tight">{isEditMode ? 'Sinkronisasi Profil Akun' : 'Inisialisasi Akun Baru'}</h2>
                    <p className="text-indigo-100 text-xs font-bold mt-1 uppercase tracking-widest">{isEditMode ? 'ID: ' + editingId : 'Konfigurasi Akses Hirarki'}</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-2xl transition-all relative z-10"><X className="h-6 w-6" /></button>
              </div>
              <form onSubmit={handleSave} className="p-10 space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Lengkap Guru / Siswa</label><input required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" placeholder="Contoh: Drs. H. Ahmad Fauzi" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">NIP / Identitas Pegawai</label><input required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" placeholder="Nomor Induk Pegawai" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Username Login</label><input required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label><input required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Otoritas & Hak Akses (Multi-Role)</label>
                    <div className="grid grid-cols-2 gap-2">
                        {[Role.TEACHER, Role.WALIKELAS, Role.BK, Role.KESISWAAN, Role.ADMIN, Role.STUDENT, Role.OSIS].map(r => (
                          <div key={r} onClick={() => toggleRole(r)} className={`p-3 border-2 rounded-2xl cursor-pointer text-[10px] font-black text-center transition-all flex items-center justify-center gap-2 ${formData.roles?.includes(r) ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-300'}`}>
                             {formData.roles?.includes(r) && <ShieldCheck className="h-3 w-3" />}
                             {r}
                          </div>
                        ))}
                    </div>
                 </div>
                 {formData.roles?.includes(Role.STUDENT) && (
                    <div className="space-y-2 animate-fade-in bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                       <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Tugaskan Sebagai Bendahara Kelas</label>
                       <select className="w-full p-4 bg-white border-2 border-indigo-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" value={formData.assignedClassId} onChange={e => setFormData({...formData, assignedClassId: e.target.value})}>
                          <option value="">-- Pilih Kelas --</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                 )}
                 <button type="submit" disabled={isSaving} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black tracking-widest shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:bg-slate-200"><Save className="h-6 w-6" /> TERBITKAN AKSES DIGITAL</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
