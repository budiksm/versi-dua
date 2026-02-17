
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { MasterCategory, MasterIncidentType, CoachingRule, IncidentTypeCategory } from '../../types';
import { Save, Plus, Trash2, List, Shield, AlertTriangle, X, Upload, FileSpreadsheet, Download, CheckSquare, Pencil, Brush, ChevronUp, ChevronDown, ArrowUpDown, Square } from 'lucide-react';

type SortKey = 'name' | 'type' | 'category' | 'points' | 'severity';
type SortDirection = 'asc' | 'desc';

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

  // --- NEW STATES FOR SORTING & SELECTION ---
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc'
  });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setCategories(DataService.getCategories());
    setIncidents(DataService.getIncidentTypes());
    setRules(DataService.getRules());
    setSelectedIncidentIds([]);
  };

  // --- SORTING LOGIC ---
  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedIncidents = () => {
    const sorted = [...incidents];
    sorted.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.key) {
        case 'name': return a.name.localeCompare(b.name) * direction;
        case 'type': return a.type.localeCompare(b.type) * direction;
        case 'points': return (a.points - b.points) * direction;
        case 'severity':
          const severityWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
          return (severityWeight[a.severity] - severityWeight[b.severity]) * direction;
        case 'category':
          const catA = categories.find(c => c.id === a.categoryId)?.name || '';
          const catB = categories.find(c => c.id === b.categoryId)?.name || '';
          return catA.localeCompare(catB) * direction;
        default: return 0;
      }
    });
    return sorted;
  };

  // --- BATCH SELECTION LOGIC ---
  const handleSelectAll = () => {
    if (selectedIncidentIds.length === incidents.length) {
      setSelectedIncidentIds([]);
    } else {
      setSelectedIncidentIds(incidents.map(i => i.id));
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedIncidentIds.includes(id)) {
      setSelectedIncidentIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIncidentIds(prev => [...prev, id]);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIncidentIds.length === 0) return;
    if (confirm(`Yakin ingin menghapus ${selectedIncidentIds.length} data kejadian terpilih?`)) {
      const updatedIncidents = incidents.filter(i => !selectedIncidentIds.includes(i.id));
      DataService.saveIncidentTypes(updatedIncidents);
      setIncidents(updatedIncidents);
      setSelectedIncidentIds([]);
    }
  };

  // --- MAINTENANCE HANDLER ---
  const handleCleanupData = () => {
    if (confirm("Fitur ini akan menghapus semua data pelanggaran yang ID siswanya sudah tidak ada. Lanjutkan?")) {
        const result = DataService.cleanupOrphanData();
        alert(`Pembersihan Selesai!\n\n${result.deletedRecords} Kejadian Dihapus.`);
        refreshData();
    }
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
      updated = [...categories, { id: `cat_${Date.now()}`, name: catName, targetType: catType }];
    }
    DataService.saveCategories(updated);
    setCategories(updated);
    setShowCatModal(false);
    setCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('Hapus kategori ini?')) {
      const updated = categories.filter(c => c.id !== id);
      DataService.saveCategories(updated);
      setCategories(updated);
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
    DataService.saveIncidentTypes([...incidents, newInc]);
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

  // --- IMPORT LOGIC ---
  const downloadTemplate = () => {
    const csvContent = "Nama Kejadian,Tipe (VIOLATION/ACHIEVEMENT/REDEMPTION),Nama Kategori,Bobot Poin,Tingkat (LOW/MEDIUM/HIGH/CRITICAL)\nSiswa berkelahi,VIOLATION,Kedisiplinan,50,CRITICAL";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_master_kejadian.csv";
    link.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        if (rows.length < 2) { setImportError('File kosong/salah.'); return; }
        const newIncidents: MasterIncidentType[] = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(/,|;/).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 5) continue;
          const [name, type, categoryName, points, severity] = cols;
          const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
          if (!category) continue;
          newIncidents.push({
            id: `inc_imp_${Date.now()}_${i}`,
            name, type: type as IncidentTypeCategory, categoryId: category.id, points: Number(points), severity: severity as any, isActive: true
          });
        }
        if (newIncidents.length > 0) {
          DataService.saveIncidentTypes([...incidents, ...newIncidents]);
          setIncidents([...incidents, ...newIncidents]);
          setImportSuccess(`Berhasil import ${newIncidents.length} data.`);
          setTimeout(() => { setShowImportModal(false); setImportSuccess(''); }, 2000);
        }
      } catch (err) { setImportError('Gagal memproses file.'); }
    };
    reader.readAsText(file);
  };

  const filteredCategoriesForModal = categories.filter(c => c.targetType === newIncType);
  const sortedIncidents = getSortedIncidents();

  const SortHeader = ({ label, sKey, className = "" }: { label: string, sKey: SortKey, className?: string }) => (
    <th className={`p-3 cursor-pointer hover:bg-slate-100 transition-colors select-none ${className}`} onClick={() => handleSort(sKey)}>
      <div className={`flex items-center gap-2`}>{label} <span className="text-slate-400">{sortConfig.key === sKey ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4" />}</span></div>
    </th>
  );

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Konfigurasi Poin & Pelanggaran</h1>
          <p className="text-slate-500">Atur kategori, bobot poin, dan kebijakan pembinaan siswa.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleCleanupData} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 shadow-md">
              <Brush className="h-4 w-4" /> Bersihkan Data Sampah
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          <TabButton id="INCIDENT" label="Jenis Kejadian" icon={List} />
          <TabButton id="CATEGORY" label="Kategori" icon={Shield} />
          <TabButton id="RULES" label="Aturan Status" icon={AlertTriangle} />
        </div>

        <div className="p-6">
          {activeTab === 'CATEGORY' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Daftar Kategori</h3>
                <button onClick={openAddCategory} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-indigo-700"><Plus className="h-4 w-4" /> Tambah</button>
              </div>
              <div className="overflow-hidden border rounded-lg">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 border-b"><tr><th className="p-3">Nama Kategori</th><th className="p-3">Tipe</th><th className="p-3 text-right">Aksi</th></tr></thead>
                   <tbody>
                      {categories.map(c => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50"><td className="p-3 font-medium">{c.name}</td><td className="p-3">{c.targetType}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => openEditCategory(c)} className="text-indigo-500"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDeleteCategory(c.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></button></div></td></tr>
                      ))}
                   </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'INCIDENT' && (
            <div className="space-y-4">
               <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                     <h3 className="font-semibold text-lg">Master Data Jenis Kejadian</h3>
                     {selectedIncidentIds.length > 0 && <button onClick={handleBatchDelete} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-bold"><Trash2 className="h-4 w-4" /> Hapus {selectedIncidentIds.length}</button>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowImportModal(true)} className="bg-white border text-slate-700 px-3 py-2 rounded text-sm flex gap-2"><Upload className="h-4 w-4" /> Import</button>
                    <button onClick={() => setShowIncModal(true)} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm flex gap-2"><Plus className="h-4 w-4" /> Tambah</button>
                  </div>
               </div>
               <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 border-b">
                     <tr>
                       <th className="p-3 w-10 text-center"><button onClick={handleSelectAll}>{selectedIncidentIds.length > 0 && selectedIncidentIds.length === incidents.length ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5" />}</button></th>
                       <SortHeader label="Nama" sKey="name" />
                       <SortHeader label="Tipe" sKey="type" />
                       <SortHeader label="Bobot" sKey="points" />
                       <th className="p-3 text-right">Aksi</th>
                     </tr>
                   </thead>
                   <tbody>
                      {sortedIncidents.map(inc => (
                        <tr key={inc.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 text-center"><button onClick={() => handleSelectRow(inc.id)}>{selectedIncidentIds.includes(inc.id) ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5 text-slate-300" />}</button></td>
                          <td className="p-3 font-medium">{inc.name}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${inc.type === 'VIOLATION' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{inc.type}</span></td>
                          <td className="p-3 font-bold">{inc.points}</td>
                          <td className="p-3 text-right"><button onClick={() => handleDeleteIncident(inc.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></button></td>
                        </tr>
                      ))}
                   </tbody>
                </table>
               </div>
            </div>
          )}

          {activeTab === 'RULES' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Aturan Status (Otomatis)</h3>
               <div className="grid gap-4">
                  {rules.map(rule => (
                    <div key={rule.id} className={`p-4 rounded-lg border flex justify-between ${rule.color.replace('text', 'border')}`}>
                      <div><span className="font-bold bg-white/50 px-2 rounded">{rule.minPoints} - {rule.maxPoints} Poin</span><h4 className="mt-2 font-bold">{rule.statusLabel}</h4></div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm">
             <div className="flex justify-between mb-4"><h3 className="font-bold">Kategori</h3><button onClick={() => setShowCatModal(false)}><X className="h-5 w-5" /></button></div>
             <form onSubmit={handleSaveCategory} className="space-y-4">
               <input required className="w-full border p-2 rounded" placeholder="Nama Kategori" value={catName} onChange={e => setCatName(e.target.value)} />
               <select className="w-full border p-2 rounded" value={catType} onChange={e => setCatType(e.target.value as any)}><option value="VIOLATION">Pelanggaran</option><option value="ACHIEVEMENT">Penghargaan</option></select>
               <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold">Simpan</button>
             </form>
          </div>
        </div>
      )}

      {showIncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between mb-4"><h3 className="font-bold">Kejadian Baru</h3><button onClick={() => setShowIncModal(false)}><X className="h-5 w-5" /></button></div>
             <form onSubmit={handleAddIncident} className="space-y-4">
               <select className="w-full border p-2 rounded" value={newIncType} onChange={e => { setNewIncType(e.target.value as any); setNewIncCatId(''); }}><option value="VIOLATION">Pelanggaran</option><option value="ACHIEVEMENT">Penghargaan</option></select>
               <select required className="w-full border p-2 rounded" value={newIncCatId} onChange={e => setNewIncCatId(e.target.value)}><option value="">-- Kategori --</option>{filteredCategoriesForModal.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
               <input required className="w-full border p-2 rounded" placeholder="Nama Kejadian" value={newIncName} onChange={e => setNewIncName(e.target.value)} />
               <div className="grid grid-cols-2 gap-4">
                 <input required type="number" className="w-full border p-2 rounded" placeholder="Poin" value={newIncPoints} onChange={e => setNewIncPoints(Number(e.target.value))} />
                 <select className="w-full border p-2 rounded" value={newIncSeverity} onChange={e => setNewIncSeverity(e.target.value as any)}><option value="LOW">Ringan</option><option value="MEDIUM">Sedang</option><option value="HIGH">Berat</option><option value="CRITICAL">Kritis</option></select>
               </div>
               <button type="submit" disabled={!newIncCatId} className="w-full bg-indigo-600 text-white py-2 rounded font-bold disabled:bg-slate-300">Simpan</button>
             </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
           <div className="bg-white p-6 rounded-xl w-full max-w-lg">
              <div className="flex justify-between mb-4"><h2 className="font-bold">Import CSV</h2><button onClick={() => setShowImportModal(false)}><X className="h-5 w-5" /></button></div>
              <div className="space-y-4">
                 <button onClick={downloadTemplate} className="w-full py-2 border rounded font-bold text-indigo-700 bg-indigo-50"><Download className="h-4 w-4 inline mr-2" /> Template</button>
                 <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700" />
                 {importError && <div className="text-red-600 text-sm">{importError}</div>}
                 {importSuccess && <div className="text-emerald-600 text-sm">{importSuccess}</div>}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PointConfiguration;
