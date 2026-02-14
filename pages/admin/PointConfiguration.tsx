
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { MasterCategory, MasterIncidentType, CoachingRule, IncidentTypeCategory } from '../../types';
import { Save, Plus, Trash2, List, Shield, AlertTriangle, X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Pencil, Database, RotateCcw } from 'lucide-react';

const PointConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATEGORY' | 'INCIDENT' | 'RULES'>('INCIDENT');
  
  // Data State
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);

  // Modals State
  const [showCatModal, setShowCatModal] = useState(false);
  const [showIncModal, setShowIncModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDbConfigModal, setShowDbConfigModal] = useState(false);
  
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Form State: Category (Shared for Add/Edit)
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);

  // Form State: New Incident
  const [newIncName, setNewIncName] = useState('');
  const [newIncType, setNewIncType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [newIncCatId, setNewIncCatId] = useState('');
  const [newIncPoints, setNewIncPoints] = useState(0);
  const [newIncSeverity, setNewIncSeverity] = useState<'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'>('LOW');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // DB Config State
  const [dbConfigJson, setDbConfigJson] = useState('');

  useEffect(() => {
    refreshData();
    
    // Load existing config string for display
    const stored = localStorage.getItem('firebase_manual_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDbConfigJson(JSON.stringify(parsed, null, 2));
      } catch (e) {
        setDbConfigJson(stored);
      }
    }
  }, []);

  const refreshData = () => {
    setCategories(DataService.getCategories());
    setIncidents(DataService.getIncidentTypes());
    setRules(DataService.getRules());
  };

  // --- CATEGORY HANDLERS ---

  const openAddCategory = () => {
    setIsEditingCategory(false);
    setEditingCategoryId(null);
    setCatName('');
    setCatType(IncidentTypeCategory.VIOLATION);
    setShowCatModal(true);
  };

  const openEditCategory = (cat: MasterCategory) => {
    setIsEditingCategory(true);
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatType(cat.targetType);
    setShowCatModal(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    let updated: MasterCategory[];

    if (isEditingCategory && editingCategoryId) {
      updated = categories.map(c => 
        c.id === editingCategoryId ? { ...c, name: catName, targetType: catType } : c
      );
    } else {
      const newCat: MasterCategory = {
        id: `cat_${Date.now()}`,
        name: catName,
        targetType: catType
      };
      updated = [...categories, newCat];
    }

    DataService.saveCategories(updated);
    setCategories(updated);
    setShowCatModal(false);
    setCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('Hapus kategori ini? Jenis kejadian yang terkait dengan kategori ini akan kehilangan referensi kategorinya.')) {
      const updated = categories.filter(c => c.id !== id);
      DataService.saveCategories(updated);
      setCategories(updated);
      
      // Optional: Cleanup incidents that were using this category
      const updatedIncidents = incidents.map(inc => 
        inc.categoryId === id ? { ...inc, categoryId: '' } : inc
      );
      DataService.saveIncidentTypes(updatedIncidents);
      setIncidents(updatedIncidents);
    }
  };

  // --- INCIDENT HANDLERS ---

  const handleAddIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const newInc: MasterIncidentType = {
      id: `inc_${Date.now()}`,
      name: newIncName,
      type: newIncType,
      categoryId: newIncCatId,
      points: Number(newIncPoints),
      severity: newIncSeverity,
      isActive: true
    };
    const updated = [...incidents, newInc];
    DataService.saveIncidentTypes(updated);
    refreshData();
    setShowIncModal(false);
    setNewIncName('');
    setNewIncPoints(0);
  };

  const handleDeleteIncident = (id: string) => {
    if (confirm('Hapus jenis kejadian ini?')) {
      const updated = incidents.filter(i => i.id !== id);
      DataService.saveIncidentTypes(updated);
      setIncidents(updated);
    }
  };

  // --- DB CONFIG HANDLER ---
  const handleSaveDbConfig = () => {
    try {
      if (!dbConfigJson.trim()) {
        if(confirm("Apakah Anda yakin ingin menghapus konfigurasi manual? Aplikasi akan kembali menggunakan environment variables.")) {
           localStorage.removeItem('firebase_manual_config');
           alert("Konfigurasi dihapus. Halaman akan direfresh.");
           window.location.reload();
        }
        return;
      }
      
      const parsed = JSON.parse(dbConfigJson);
      if (!parsed.apiKey || !parsed.projectId) {
         throw new Error("JSON tidak valid. Pastikan minimal ada 'apiKey' dan 'projectId'.");
      }
      
      localStorage.setItem('firebase_manual_config', JSON.stringify(parsed));
      alert("Konfigurasi Database berhasil disimpan! Aplikasi akan terhubung ulang.");
      window.location.reload();
    } catch (e: any) {
      alert("Gagal menyimpan: " + e.message);
    }
  };

  // --- IMPORT LOGIC ---

  const downloadTemplate = () => {
    const csvContent = "Nama Kejadian,Tipe (VIOLATION/ACHIEVEMENT/REDEMPTION),Nama Kategori,Bobot Poin,Tingkat (LOW/MEDIUM/HIGH/CRITICAL)\nSiswa berkelahi di sekolah,VIOLATION,Kedisiplinan,50,CRITICAL\nJuara Lomba Nasional,ACHIEVEMENT,Prestasi Non-Akademik,100,HIGH";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_master_kejadian.csv");
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

        const newIncidents: MasterIncidentType[] = [];
        const errors: string[] = [];

        // Skip header
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(/,|;/).map(c => c.trim().replace(/^"|"$/g, ''));
          
          if (cols.length < 5) continue;

          const [name, type, categoryName, points, severity] = cols;

          // 1. Validate Category Existence
          const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
          
          if (!category) {
            errors.push(`Baris ${i+1}: Kategori "${categoryName}" tidak ditemukan di sistem.`);
            continue;
          }

          // 2. Validate Type match with category
          if (category.targetType !== type) {
             errors.push(`Baris ${i+1}: Tipe "${type}" tidak sesuai dengan Kategori "${categoryName}" (${category.targetType}).`);
             continue;
          }

          newIncidents.push({
            id: `inc_imp_${Date.now()}_${i}`,
            name,
            type: type as IncidentTypeCategory,
            categoryId: category.id,
            points: Number(points) || 0,
            severity: severity as any,
            isActive: true
          });
        }

        if (errors.length > 0) {
          setImportError(errors.join('\n'));
        }

        if (newIncidents.length > 0) {
          const updated = [...incidents, ...newIncidents];
          DataService.saveIncidentTypes(updated);
          setIncidents(updated);
          setImportSuccess(`Berhasil mengimpor ${newIncidents.length} data kejadian.`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          
          setTimeout(() => {
            setShowImportModal(false);
            setImportSuccess('');
            setImportError('');
          }, 2000);
        }

      } catch (err) {
        setImportError('Gagal memproses file. Pastikan format CSV valid.');
      }
    };
    reader.readAsText(file);
  };

  // Filter categories for the Incident Modal based on selected Type
  const filteredCategoriesForModal = categories.filter(c => c.targetType === newIncType);

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
        activeTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Konfigurasi Poin & Pelanggaran</h1>
          <p className="text-slate-500">Atur kategori, bobot poin, dan kebijakan pembinaan siswa.</p>
        </div>
        <button 
          onClick={() => setShowDbConfigModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 shadow-md"
        >
          <Database className="h-4 w-4" /> Koneksi Database
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          <TabButton id="INCIDENT" label="Jenis Kejadian & Bobot" icon={List} />
          <TabButton id="CATEGORY" label="Kategori" icon={Shield} />
          <TabButton id="RULES" label="Aturan Status Pembinaan" icon={AlertTriangle} />
        </div>

        <div className="p-6">
          {/* --- TAB KATEGORI --- */}
          {activeTab === 'CATEGORY' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Daftar Kategori Kejadian</h3>
                <button 
                  onClick={openAddCategory}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" /> Tambah Kategori
                </button>
              </div>
              
              <div className="overflow-hidden border rounded-lg">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 border-b">
                     <tr>
                       <th className="p-3">Nama Kategori</th>
                       <th className="p-3">Tipe Target</th>
                       <th className="p-3 text-right">Aksi</th>
                     </tr>
                   </thead>
                   <tbody>
                      {categories.map(c => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-medium text-slate-900">{c.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold 
                              ${c.targetType === IncidentTypeCategory.VIOLATION ? 'bg-red-100 text-red-600' : 
                                c.targetType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                              {c.targetType}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                             <div className="flex justify-end gap-2">
                               <button 
                                 onClick={() => openEditCategory(c)} 
                                 className="text-indigo-500 hover:bg-indigo-50 p-1.5 rounded transition-colors"
                                 title="Edit Kategori"
                               >
                                 <Pencil className="h-4 w-4" />
                               </button>
                               <button 
                                 onClick={() => handleDeleteCategory(c.id)} 
                                 className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                 title="Hapus Kategori"
                               >
                                 <Trash2 className="h-4 w-4" />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                      {categories.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-500 italic">Belum ada kategori yang dikonfigurasi.</td>
                        </tr>
                      )}
                   </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- TAB INCIDENT --- */}
          {activeTab === 'INCIDENT' && (
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Master Data Jenis Kejadian</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowImportModal(true)}
                      className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-50"
                    >
                      <Upload className="h-4 w-4" /> Import CSV
                    </button>
                    <button 
                      onClick={() => setShowIncModal(true)}
                      className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4" /> Tambah Kejadian
                    </button>
                  </div>
               </div>

               <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 border-b">
                     <tr>
                       <th className="p-3">Nama Kejadian</th>
                       <th className="p-3">Tipe</th>
                       <th className="p-3">Kategori</th>
                       <th className="p-3">Bobot Poin</th>
                       <th className="p-3">Tingkat</th>
                       <th className="p-3 text-right">Aksi</th>
                     </tr>
                   </thead>
                   <tbody>
                      {incidents.map(inc => (
                        <tr key={inc.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-medium text-slate-900">{inc.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${inc.type === IncidentTypeCategory.VIOLATION ? 'bg-red-100 text-red-600' : inc.type === IncidentTypeCategory.ACHIEVEMENT ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                              {inc.type === IncidentTypeCategory.VIOLATION ? 'Pelanggaran' : inc.type === IncidentTypeCategory.ACHIEVEMENT ? 'Penghargaan' : 'Penebusan'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{categories.find(c => c.id === inc.categoryId)?.name || <span className="text-red-400 italic">Tanpa Kategori</span>}</td>
                          <td className="p-3 font-bold">{inc.points}</td>
                          <td className="p-3 text-xs uppercase text-slate-500 font-semibold">{inc.severity}</td>
                          <td className="p-3 text-right">
                             <button onClick={() => handleDeleteIncident(inc.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors">
                               <Trash2 className="h-4 w-4" />
                             </button>
                          </td>
                        </tr>
                      ))}
                      {incidents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500 italic">Belum ada jenis kejadian yang dikonfigurasi.</td>
                        </tr>
                      )}
                   </tbody>
                </table>
               </div>
            </div>
          )}

          {/* --- TAB RULES --- */}
          {activeTab === 'RULES' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Aturan Status Pembinaan</h3>
              <p className="text-sm text-slate-500 mb-4">Sistem akan otomatis memberikan label status berdasarkan total poin siswa.</p>
               <div className="grid gap-4">
                  {rules.map(rule => (
                    <div key={rule.id} className={`p-4 rounded-lg border flex items-center justify-between ${rule.color.replace('text', 'border')}`}>
                      <div>
                        <span className={`text-sm font-bold px-2 py-1 rounded bg-white/50 border border-black/5`}>
                          {rule.minPoints} - {rule.maxPoints} Poin
                        </span>
                        <h4 className="mt-2 font-bold text-lg">{rule.statusLabel}</h4>
                      </div>
                      <div className="text-sm opacity-70 italic">
                        Otomatis Sistem
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL DB CONFIG (SECURE) --- */}
      {showDbConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
             <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                <h2 className="font-bold flex items-center gap-2">
                   <Database className="h-5 w-5 text-blue-400" />
                   Konfigurasi Database (Firebase)
                </h2>
                <button onClick={() => setShowDbConfigModal(false)} className="text-slate-400 hover:text-white">
                   <X className="h-5 w-5" />
                </button>
             </div>
             
             <div className="p-6 overflow-y-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
                   <p className="font-bold flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4" /> Area Sensitif
                   </p>
                   Hanya ubah konfigurasi ini jika aplikasi kehilangan koneksi atau Anda berpindah project Firebase. 
                   Data tersimpan di browser Anda.
                </div>

                <label className="block text-sm font-bold text-slate-700 mb-2">Firebase Config Object (JSON):</label>
                <textarea 
                  className="w-full h-64 p-3 bg-slate-900 text-green-400 font-mono text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  ...\n}'}
                  value={dbConfigJson}
                  onChange={e => setDbConfigJson(e.target.value)}
                />
             </div>

             <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button 
                  onClick={() => setShowDbConfigModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveDbConfig}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"
                >
                  <RotateCcw className="h-4 w-4" /> Simpan & Reload
                </button>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL ADD/EDIT CATEGORY --- */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-lg text-slate-800">{isEditingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}</h3>
               <button onClick={() => setShowCatModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <X className="h-5 w-5" />
               </button>
             </div>
             <form onSubmit={handleSaveCategory} className="space-y-4">
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Kategori</label>
                 <input 
                    required 
                    type="text" 
                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    value={catName}
                    onChange={e => setCatName(e.target.value)}
                    placeholder="Contoh: Kedisiplinan"
                 />
               </div>
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">Peruntukan</label>
                 <select 
                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={catType}
                    onChange={e => setCatType(e.target.value as IncidentTypeCategory)}
                 >
                   <option value={IncidentTypeCategory.VIOLATION}>Pelanggaran (Violation)</option>
                   <option value={IncidentTypeCategory.ACHIEVEMENT}>Penghargaan (Achievement)</option>
                   <option value={IncidentTypeCategory.REDEMPTION}>Penebusan (Redemption)</option>
                 </select>
               </div>
               <div className="pt-2">
                 <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all flex items-center justify-center gap-2">
                   <Save className="h-4 w-4" />
                   {isEditingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* --- MODAL ADD INCIDENT --- */}
      {showIncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-lg text-slate-800">Tambah Jenis Kejadian</h3>
               <button onClick={() => setShowIncModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <X className="h-5 w-5" />
               </button>
             </div>
             <form onSubmit={handleAddIncident} className="space-y-4">
               {/* 1. Pilih Tipe Dulu */}
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">Tipe Kejadian</label>
                 <select 
                    className="w-full border border-slate-300 p-2.5 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newIncType}
                    onChange={e => {
                      setNewIncType(e.target.value as IncidentTypeCategory);
                      setNewIncCatId(''); // Reset category when type changes
                    }}
                 >
                   <option value={IncidentTypeCategory.VIOLATION}>Pelanggaran</option>
                   <option value={IncidentTypeCategory.ACHIEVEMENT}>Penghargaan</option>
                   <option value={IncidentTypeCategory.REDEMPTION}>Penebusan</option>
                 </select>
               </div>

               {/* 2. Pilih Kategori (Filtered) */}
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">Kategori</label>
                 <select 
                    required
                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newIncCatId}
                    onChange={e => setNewIncCatId(e.target.value)}
                 >
                   <option value="">-- Pilih Kategori --</option>
                   {filteredCategoriesForModal.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                   ))}
                 </select>
                 {filteredCategoriesForModal.length === 0 && (
                   <p className="text-xs text-red-500 mt-1">Belum ada kategori untuk tipe ini. Tambahkan kategori di tab Kategori terlebih dahulu.</p>
                 )}
               </div>

               {/* 3. Detail Lain */}
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Kejadian</label>
                 <input 
                    required 
                    type="text" 
                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                    value={newIncName}
                    onChange={e => setNewIncName(e.target.value)}
                    placeholder="Contoh: Datang Terlambat"
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">Bobot Poin</label>
                   <input 
                      required 
                      type="number" 
                      min="0"
                      className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={newIncPoints}
                      onChange={e => setNewIncPoints(Number(e.target.value))}
                   />
                 </div>
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1">Tingkat</label>
                   <select 
                      className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newIncSeverity}
                      onChange={e => setNewIncSeverity(e.target.value as any)}
                   >
                     <option value="LOW">Ringan (Low)</option>
                     <option value="MEDIUM">Sedang (Medium)</option>
                     <option value="HIGH">Berat (High)</option>
                     <option value="CRITICAL">Sangat Berat</option>
                   </select>
                 </div>
               </div>

               <button 
                 type="submit" 
                 disabled={!newIncCatId} 
                 className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all disabled:bg-slate-300 disabled:cursor-not-allowed mt-4"
               >
                 Simpan Jenis Kejadian
               </button>
             </form>
          </div>
        </div>
      )}

      {/* --- MODAL IMPORT CSV --- */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
           <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                     <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                     Import Master Kejadian Massal
                  </h2>
                  <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
              </div>

              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                    <p className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                       <AlertCircle className="h-4 w-4 text-orange-500" /> Aturan Validasi:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 space-y-1 text-xs">
                      <li>Kolom: Nama Kejadian, Tipe, <b>Nama Kategori</b>, Bobot, Tingkat.</li>
                      <li className="text-red-600 font-bold underline">Nama Kategori harus sudah terdaftar di sistem!</li>
                      <li>Tipe harus berupa: VIOLATION, ACHIEVEMENT, atau REDEMPTION.</li>
                      <li>Tingkat harus berupa: LOW, MEDIUM, HIGH, atau CRITICAL.</li>
                    </ul>
                 </div>
                 
                 <button 
                   onClick={downloadTemplate}
                   className="w-full py-2.5 px-4 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center justify-center gap-2 font-bold transition-all"
                 >
                    <Download className="h-4 w-4" /> Download Template CSV
                 </button>

                 <div className="pt-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih File CSV Kejadian</label>
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
    </div>
  );
};

export default PointConfiguration;
