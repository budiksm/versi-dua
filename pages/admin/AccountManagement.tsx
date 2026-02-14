
import React, { useState, useEffect } from 'react';
import { DataService } from '../../services/dataService';
import { Teacher, Role } from '../../types';
import { Plus, Trash2, UserCog, Shield, Key, CheckSquare, Pencil, X } from 'lucide-react';

const AccountManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: '', nip: '', roles: [Role.TEACHER], username: '', password: ''
  });

  useEffect(() => {
    setTeachers(DataService.getTeachers());
  }, []);

  const openAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormData({ name: '', nip: '', roles: [Role.TEACHER], username: '', password: '123' }); // Default password suggestion
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
      password: teacher.password
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate roles
    if (!formData.roles || formData.roles.length === 0) {
      alert("Pilih minimal satu role!");
      return;
    }

    // Check if username already exists (exclude current user if editing)
    const isUsernameTaken = teachers.some(t => 
      t.username === formData.username && t.id !== editingId
    );

    if (isUsernameTaken) {
      alert("Username sudah digunakan oleh akun lain!");
      return;
    }

    if (isEditMode && editingId) {
      // --- UPDATE LOGIC ---
      const updatedTeachers = teachers.map(t => {
        if (t.id === editingId) {
          return {
            ...t,
            name: formData.name || '',
            nip: formData.nip || '',
            roles: formData.roles || [],
            username: formData.username,
            password: formData.password
          };
        }
        return t;
      });
      DataService.saveTeachers(updatedTeachers);
      setTeachers(updatedTeachers);
    } else {
      // --- CREATE LOGIC ---
      const newTeacher: Teacher = {
        id: `t_${Date.now()}`,
        name: formData.name || '',
        nip: formData.nip || '',
        roles: formData.roles || [],
        username: formData.username,
        password: formData.password,
        mustChangePassword: true // FORCE CHANGE ON FIRST LOGIN FOR NEW ACCOUNTS
      };
      const updatedTeachers = [...teachers, newTeacher];
      DataService.saveTeachers(updatedTeachers);
      setTeachers(updatedTeachers);
    }

    setIsModalOpen(false);
    setFormData({ name: '', nip: '', roles: [Role.TEACHER], username: '', password: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus akun guru ini?')) {
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

  const availableRoles = [
    { id: Role.TEACHER, label: 'Guru Mata Pelajaran' },
    { id: Role.WALIKELAS, label: 'Wali Kelas' },
    { id: Role.BK, label: 'Guru BK' },
    { id: Role.KESISWAAN, label: 'Staf Kesiswaan' },
    { id: Role.ADMIN, label: 'Admin / Tata Usaha' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Akun Guru</h1>
          <p className="text-slate-500">Kelola akun, NIP, hak akses (Role), dan kredensial login.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Tambah Akun
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Nama Guru</th>
              <th className="px-6 py-3 font-semibold text-slate-700">NIP</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Username</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Role / Jabatan</th>
              <th className="px-6 py-3 font-semibold text-slate-700 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teachers.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{t.name}</td>
                <td className="px-6 py-3">{t.nip}</td>
                <td className="px-6 py-3 text-slate-600">{t.username || '-'}</td>
                <td className="px-6 py-3">
                  <div className="flex flex-wrap gap-1">
                    {t.roles && t.roles.map(r => (
                      <span key={r} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium 
                        ${r === Role.ADMIN ? 'bg-purple-100 text-purple-700' :
                          r === Role.BK ? 'bg-blue-100 text-blue-700' :
                          r === Role.KESISWAAN ? 'bg-orange-100 text-orange-700' :
                          r === Role.WALIKELAS ? 'bg-green-100 text-green-700' :
                          'bg-slate-100 text-slate-700'}`}>
                        {r === Role.ADMIN ? <Shield className="h-3 w-3" /> : ''}
                        {r}
                      </span>
                    ))}
                    {t.mustChangePassword && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700" title="User harus ganti password saat login">
                             Wajib Ganti Password
                        </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex justify-end gap-2">
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
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl w-full max-w-md m-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{isEditMode ? 'Edit Akun Guru' : 'Tambah Akun Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 font-medium">Nama Lengkap & Gelar</label>
                <input required type="text" className="w-full border p-2 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1 font-medium">NIP</label>
                <input required type="text" className="w-full border p-2 rounded-lg" value={formData.nip} onChange={e => setFormData({...formData, nip: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm mb-1 font-medium">Username</label>
                    <input required type="text" className="w-full border p-2 rounded-lg" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-sm mb-1 font-medium">Password</label>
                    <input required type="text" className="w-full border p-2 rounded-lg" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    {!isEditMode && <p className="text-[10px] text-slate-500 mt-1">Default "123" disarankan. User wajib ganti saat login.</p>}
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
    </div>
  );
};

export default AccountManagement;
