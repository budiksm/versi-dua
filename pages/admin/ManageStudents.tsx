
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { Student, ClassGroup, Teacher, Role } from '../../types';
import { Plus, Trash2, Users, ChevronRight, ArrowLeft, UserCog, Check, X, Pencil, Save, Upload, FileSpreadsheet, Download, AlertCircle, ChevronUp, ChevronDown, ArrowUpDown, Square, CheckSquare, Cloud } from 'lucide-react';

type SortKey = 'name' | 'nis' | 'gender';
type SortDirection = 'asc' | 'desc';

const ManageStudents: React.FC = () => {
  const [view, setView] = useState<'CLASSES' | 'STUDENTS'>('CLASSES');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  // UI State
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // New Class Form
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState(10);

  // Edit Class Form
  const [editClassData, setEditClassData] = useState<{name: string, level: number}>({ name: '', level: 10 });

  // Student Form (Add & Edit)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<Partial<Student>>({
    name: '', nis: '', gender: 'L', birthPlace: '', birthDate: '', address: ''
  });

  // Assign Teacher Form
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // --- BULK & SORT STATE ---
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc'
  });

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    setSelectedStudentIds([]);
  }, [view, selectedClassId]);

  const refreshData = () => {
    setStudents(DataService.getStudents());
    setClasses(DataService.getClasses());
    setTeachers(DataService.getTeachers());
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedStudents = (studentList: Student[]) => {
    const sorted = [...studentList];
    sorted.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.key) {
        case 'name': return a.name.localeCompare(b.name) * direction;
        case 'nis': return a.nis.localeCompare(b.nis) * direction;
        case 'gender': return a.gender.localeCompare(b.gender) * direction;
        default: return 0;
      }
    });
    return sorted;
  };

  const handleSelectAll = (currentListIds: string[]) => {
    if (selectedStudentIds.length === currentListIds.length && currentListIds.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(currentListIds);
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedStudentIds(prev => [...prev, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    
    if (confirm(`Yakin ingin menghapus ${selectedStudentIds.length} siswa terpilih? Data pelanggaran mereka juga akan hilang.`)) {
      setIsSaving(true);
      try {
        const updated = students.filter(s => !selectedStudentIds.includes(s.id));
        await DataService.saveStudents(updated);
        setStudents(updated);
        setSelectedStudentIds([]);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        const newClass: ClassGroup = {
          id: `c_${Date.now()}`,
          name: newClassName,
          level: newClassLevel
        };
        const updated = [...classes, newClass];
        await DataService.saveClasses(updated);
        setClasses(updated);
        setIsClassModalOpen(false);
        setNewClassName('');
    } finally {
        setIsSaving(false);
    }
  };

  const openEditClassModal = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    if (cls) {
      setEditClassData({ name: cls.name, level: cls.level });
      setIsEditClassModalOpen(true);
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        const updatedClasses = classes.map(c => {
          if (c.id === selectedClassId) {
            return { ...c, name: editClassData.name, level: editClassData.level };
          }
          return c;
        });
        await DataService.saveClasses(updatedClasses);
        setClasses(updatedClasses);
        setIsEditClassModalOpen(false);
    } finally {
        setIsSaving(false);
    }
  };

  const openAddStudentModal = () => {
    setEditingStudentId(null);
    setStudentForm({ name: '', nis: '', gender: 'L', birthPlace: '', birthDate: '', address: '' });
    setIsStudentModalOpen(true);
  };

  const openEditStudentModal = (student: Student) => {
    setEditingStudentId(student.id);
    setStudentForm({
      name: student.name,
      nis: student.nis,
      gender: student.gender,
      birthPlace: student.birthPlace,
      birthDate: student.birthDate,
      address: student.address,
      status: student.status
    });
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;

    setIsSaving(true);
    try {
        let updatedStudents: Student[];

        if (editingStudentId) {
          updatedStudents = students.map(s => {
            if (s.id === editingStudentId) {
              return {
                ...s,
                name: studentForm.name || '',
                nis: studentForm.nis || '',
                gender: studentForm.gender as 'L'|'P',
                birthPlace: studentForm.birthPlace,
                birthDate: studentForm.birthDate,
                address: studentForm.address
              };
            }
            return s;
          });
        } else {
          const newStudentData: Student = {
            id: `s_${Date.now()}`,
            classId: selectedClassId,
            status: 'ACTIVE',
            name: studentForm.name || '',
            nis: studentForm.nis || '',
            gender: studentForm.gender as 'L'|'P',
            birthPlace: studentForm.birthPlace,
            birthDate: studentForm.birthDate,
            address: studentForm.address
          };
          updatedStudents = [...students, newStudentData];
        }

        await DataService.saveStudents(updatedStudents);
        setStudents(updatedStudents);
        setIsStudentModalOpen(false);
        setStudentForm({ name: '', nis: '', gender: 'L', birthPlace: '', birthDate: '', address: '' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm('Hapus siswa ini? Data poin dan pelanggaran juga akan hilang.')) {
      setIsSaving(true);
      try {
        const updated = students.filter(s => s.id !== id);
        await DataService.saveStudents(updated);
        setStudents(updated);
        if (selectedStudentIds.includes(id)) {
          setSelectedStudentIds(prev => prev.filter(i => i !== id));
        }
      } finally {
        setIsSaving(false);
      }
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Nama Lengkap,NIS,Jenis Kelamin (L/P),Tempat Lahir,Tanggal Lahir (YYYY-MM-DD),Alamat\nBudi Santoso,12345,L,Jakarta,2008-01-01,Jl. Sudirman No. 1";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_import_siswa.csv";
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportError('');
    setImportSuccess('');

    if (!file || !selectedClassId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        if (rows.length < 2) { setImportError('File kosong.'); return; }

        setIsSaving(true);
        const newStudents: Student[] = [];
        let successCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(/,|;/).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 2 && cols[0] && cols[1]) {
            if (!students.some(s => s.nis === cols[1])) {
               newStudents.push({
                 id: `s_imp_${Date.now()}_${i}`,
                 classId: selectedClassId,
                 status: 'ACTIVE',
                 name: cols[0],
                 nis: cols[1],
                 gender: (cols[2]?.toUpperCase() === 'P' ? 'P' : 'L'),
                 birthPlace: cols[3] || '',
                 birthDate: cols[4] || '',
                 address: cols[5] || ''
               });
               successCount++;
            }
          }
        }

        if (successCount > 0) {
          const updatedStudents = [...students, ...newStudents];
          await DataService.saveStudents(updatedStudents);
          setStudents(updatedStudents);
          setImportSuccess(`Berhasil mengimpor ${successCount} siswa.`);
          setTimeout(() => { setIsImportModalOpen(false); setImportSuccess(''); }, 1500);
        } else {
          setImportError('Tidak ada data valid.');
        }
      } catch (err) {
        setImportError('Gagal baca CSV.');
      } finally {
        setIsSaving(false);
      }
    };
    reader.readAsText(file);
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;
    setIsSaving(true);
    try {
        const updatedClasses = classes.map(c => {
          if (c.id === selectedClassId) {
            return { ...c, homeroomTeacherId: selectedTeacherId || undefined };
          }
          return c;
        });
        await DataService.saveClasses(updatedClasses);
        setClasses(updatedClasses);
        setIsTeacherModalOpen(false);
    } finally {
        setIsSaving(false);
    }
  };

  const SortHeader = ({ label, sKey, className = "" }: { label: string, sKey: SortKey, className?: string }) => (
    <th className={`px-6 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors select-none ${className}`} onClick={() => handleSort(sKey)}>
      <div className={`flex items-center gap-2`}>{label} <div className="flex flex-col">{sortConfig.key === sKey ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-300" />}</div></div>
    </th>
  );

  if (view === 'CLASSES') {
    return (
      <div className="space-y-6">
        {/* OVERLAY LOADING */}
        {isSaving && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800">
                  <Cloud className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                  <h3 className="text-xl font-bold">Sinkronisasi Cloud...</h3>
                  <p className="text-sm text-slate-500 mt-2">Memastikan data tersimpan aman di server Google.</p>
                  <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                      <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                  </div>
              </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-slate-800">Data Kelas & Siswa</h1><p className="text-slate-500">Pilih kelas untuk mengelola siswa</p></div>
          <button onClick={() => setIsClassModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-md"><Plus className="h-4 w-4" /> Tambah Kelas</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {classes.map(cls => {
            const count = students.filter(s => s.classId === cls.id).length;
            const homeroomName = teachers.find(t => t.id === cls.homeroomTeacherId)?.name || 'Belum ada Wali Kelas';
            return (
              <div key={cls.id} onClick={() => { setSelectedClassId(cls.id); setView('STUDENTS'); }} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group">
                <div className="flex justify-between items-start mb-4"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Users className="h-6 w-6" /></div><span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">{count} Siswa</span></div>
                <h3 className="text-lg font-bold text-slate-900">{cls.name}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><UserCog className="h-3 w-3" /> {homeroomName}</p>
                <div className="mt-4 flex items-center text-sm text-indigo-600 font-medium">Kelola Siswa <ChevronRight className="h-4 w-4" /></div>
              </div>
            );
          })}
        </div>

        {isClassModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-sm">
              <h2 className="text-lg font-bold mb-4">Tambah Kelas Baru</h2>
              <form onSubmit={handleAddClass} className="space-y-4">
                <div><label className="block text-sm mb-1">Nama Kelas</label><input required type="text" className="w-full border p-2 rounded" placeholder="Contoh: X IPA 1" value={newClassName} onChange={e => setNewClassName(e.target.value)} /></div>
                <div><label className="block text-sm mb-1">Tingkat</label><select className="w-full border p-2 rounded" value={newClassLevel} onChange={e => setNewClassLevel(Number(e.target.value))}><option value={10}>Kelas 10</option><option value={11}>Kelas 11</option><option value={12}>Kelas 12</option></select></div>
                <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={() => setIsClassModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Batal</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Simpan</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentClass = classes.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s => s.classId === selectedClassId);
  const sortedClassStudents = getSortedStudents(classStudents);
  const currentHomeroom = teachers.find(t => t.id === currentClass?.homeroomTeacherId);
  const availableHomeroomTeachers = teachers.filter(t => {
     const isWaliKelas = t.roles?.includes(Role.WALIKELAS);
     const assignedClass = classes.find(c => c.homeroomTeacherId === t.id);
     return isWaliKelas && (!assignedClass || assignedClass.id === selectedClassId);
  });

  return (
    <div className="space-y-6">
       {/* OVERLAY LOADING */}
       {isSaving && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800">
                  <Cloud className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                  <h3 className="text-xl font-bold">Sinkronisasi Cloud...</h3>
                  <p className="text-sm text-slate-500 mt-2">Sedang mengirim data ke server Google.</p>
                  <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                      <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                  </div>
              </div>
          </div>
        )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
            <button onClick={() => setView('CLASSES')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"><ArrowLeft className="h-6 w-6" /></button>
            <div className="flex-1">
              <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-slate-800">Kelas {currentClass?.name}</h1><button onClick={openEditClassModal} className="text-slate-400 hover:text-indigo-600 transition-colors p-1"><Pencil className="h-5 w-5" /></button></div>
              <p className="text-slate-500">{classStudents.length} Siswa Terdaftar</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50"><Upload className="h-4 w-4" /> Import</button>
              <button onClick={openAddStudentModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"><Plus className="h-4 w-4" /> Tambah Siswa</button>
            </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
           <div className="flex items-center gap-3"><div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center"><UserCog className="h-5 w-5" /></div><div><p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Wali Kelas</p><p className="font-bold text-slate-800 text-lg">{currentHomeroom ? currentHomeroom.name : <span className="text-red-500 italic">Belum ditentukan</span>}</p></div></div>
           <button onClick={() => { setSelectedTeacherId(currentClass?.homeroomTeacherId || ''); setIsTeacherModalOpen(true); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors">{currentHomeroom ? 'Ganti Wali Kelas' : 'Pilih Wali Kelas'}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {selectedStudentIds.length > 0 && (
           <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center justify-between animate-fade-in"><div className="flex items-center gap-3"><span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">{selectedStudentIds.length}</span><span className="text-indigo-900 font-medium text-sm">Siswa Terpilih</span></div><button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm transition-colors"><Trash2 className="h-4 w-4" /> Hapus Terpilih</button></div>
        )}
        <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3 w-10 text-center"><button onClick={() => handleSelectAll(classStudents.map(s => s.id))} className="text-slate-400 hover:text-indigo-600 flex items-center justify-center w-full h-full">{selectedStudentIds.length > 0 && selectedStudentIds.length === classStudents.length ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5" />}</button></th><SortHeader label="Nama" sKey="name" /><SortHeader label="NIS" sKey="nis" /><SortHeader label="L/P" sKey="gender" /><th className="px-6 py-3 font-semibold text-slate-700">TTL</th><th className="px-6 py-3 font-semibold text-slate-700">Alamat</th><th className="px-6 py-3 font-semibold text-slate-700 text-right">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{sortedClassStudents.map(s => (<tr key={s.id} className={`hover:bg-slate-50 transition-colors ${selectedStudentIds.includes(s.id) ? 'bg-indigo-50' : ''}`}><td className="px-4 py-3 text-center"><button onClick={() => handleSelectRow(s.id)} className="flex items-center justify-center w-full h-full text-slate-400 hover:text-indigo-600">{selectedStudentIds.includes(s.id) ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5" />}</button></td><td className="px-6 py-3 font-medium text-slate-900">{s.name}</td><td className="px-6 py-3">{s.nis}</td><td className="px-6 py-3">{s.gender}</td><td className="px-6 py-3">{s.birthPlace && s.birthDate ? `${s.birthPlace}, ${s.birthDate}` : '-'}</td><td className="px-6 py-3 truncate max-w-xs">{s.address || '-'}</td><td className="px-6 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => openEditStudentModal(s)} className="text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>))}</tbody></table>
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4"><div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-green-600" /> Import Siswa</h2><button onClick={() => setIsImportModalOpen(false)} className="text-slate-400"><X className="h-5 w-5" /></button></div><div className="space-y-4"><div className="p-4 bg-slate-50 rounded-lg border text-sm"><p className="font-semibold mb-2">Kolom: Nama, NIS, L/P, Tempat Lahir, Tgl Lahir, Alamat.</p></div><button onClick={downloadTemplate} className="w-full py-2 px-4 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center justify-center gap-2 font-medium"><Download className="h-4 w-4" /> Template CSV</button><div className="pt-2"><label className="block text-sm font-medium mb-2">Upload File CSV</label><input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700" /></div>{importError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {importError}</div>}{importSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg flex items-center gap-2"><Check className="h-4 w-4" /> {importSuccess}</div>}</div></div></div>
      )}

      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4"><div className="bg-white p-6 rounded-xl w-full max-w-lg m-4 shadow-xl"><h2 className="text-lg font-bold mb-4">{editingStudentId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h2><form onSubmit={handleSaveStudent} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div className="col-span-2"><label className="block text-sm mb-1">Nama</label><input required type="text" className="w-full border p-2 rounded" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} /></div><div><label className="block text-sm mb-1">NIS</label><input required type="text" className="w-full border p-2 rounded" value={studentForm.nis} onChange={e => setStudentForm({...studentForm, nis: e.target.value})} /></div><div><label className="block text-sm mb-1">L/P</label><select className="w-full border p-2 rounded" value={studentForm.gender} onChange={e => setStudentForm({...studentForm, gender: e.target.value as any})}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div><div><label className="block text-sm mb-1">Tempat Lahir</label><input type="text" className="w-full border p-2 rounded" value={studentForm.birthPlace} onChange={e => setStudentForm({...studentForm, birthPlace: e.target.value})} /></div><div><label className="block text-sm mb-1">Tgl Lahir</label><input type="date" className="w-full border p-2 rounded" value={studentForm.birthDate} onChange={e => setStudentForm({...studentForm, birthDate: e.target.value})} /></div><div className="col-span-2"><label className="block text-sm mb-1">Alamat</label><textarea className="w-full border p-2 rounded" rows={2} value={studentForm.address} onChange={e => setStudentForm({...studentForm, address: e.target.value})} /></div></div><div className="flex gap-2 justify-end mt-6"><button type="button" onClick={() => setIsStudentModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Batal</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"><Save className="h-4 w-4" /> Simpan</button></div></form></div></div>
      )}

      {isEditClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white p-6 rounded-xl w-full max-w-sm"><h2 className="text-lg font-bold mb-4">Edit Kelas</h2><form onSubmit={handleUpdateClass} className="space-y-4"><div><label className="block text-sm mb-1 font-medium">Nama</label><input required type="text" className="w-full border p-2 rounded" value={editClassData.name} onChange={e => setEditClassData({...editClassData, name: e.target.value})} /></div><div><label className="block text-sm mb-1 font-medium">Tingkat</label><select className="w-full border p-2 rounded" value={editClassData.level} onChange={e => setEditClassData({...editClassData, level: Number(e.target.value)})}><option value={10}>10</option><option value={11}>11</option><option value={12}>12</option></select></div><div className="flex gap-2 justify-end mt-6"><button type="button" onClick={() => setIsEditClassModalOpen(false)} className="px-4 py-2 text-slate-600 rounded">Batal</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Simpan</button></div></form></div></div>
      )}

      {isTeacherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4 shadow-2xl"><div className="bg-white p-6 rounded-xl w-full max-w-md m-4"><div className="flex justify-between items-center mb-4 border-b pb-4"><div><h2 className="text-lg font-bold text-slate-800">Pilih Wali Kelas</h2></div><button onClick={() => setIsTeacherModalOpen(false)} className="text-slate-400"><X className="h-5 w-5" /></button></div><form onSubmit={handleAssignTeacher} className="space-y-4"><div><label className="block text-sm font-medium mb-2 text-slate-700">Nama Guru</label><select className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)}><option value="">-- Pilih --</option>{availableHomeroomTeachers.map(t => (<option key={t.id} value={t.id}>{t.name} ({t.nip})</option>))}</select></div><div className="flex gap-2 justify-end mt-6 pt-2"><button type="button" onClick={() => setIsTeacherModalOpen(false)} className="px-4 py-2 text-slate-600 rounded-lg">Batal</button><button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm">Simpan</button></div></form></div></div>
      )}
    </div>
  );
};

export default ManageStudents;
