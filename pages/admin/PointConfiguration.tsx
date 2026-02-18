
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { MasterCategory, MasterIncidentType, CoachingRule, IncidentTypeCategory } from '../../types';
import { Save, Plus, Trash2, List, Shield, AlertTriangle, X, Upload, FileSpreadsheet, Download, CheckSquare, Pencil, Brush, ChevronUp, ChevronDown, ArrowUpDown, Square, Cloud, Gavel, Scale, Check, AlertCircle, Database, RotateCcw } from 'lucide-react';

type SortKey = 'name' | 'type' | 'category' | 'points' | 'severity';
type SortDirection = 'asc' | 'desc';

const PointConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATEGORY' | 'INCIDENT' | 'RULES' | 'MAINTENANCE'>('INCIDENT');
  const [isSaving, setIsSaving] = useState(false);
  
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [showIncModal, setShowIncModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Category Form
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);

  // Incident Form
  const [newIncName, setNewIncName] = useState('');
  const [newIncType, setNewIncType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [newIncCatId, setNewIncCatId] = useState('');
  const [newIncPoints, setNewIncPoints] = useState(0);
  const [newIncSeverity, setNewIncSeverity] = useState<'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'>('LOW');

  // Rule Form
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<CoachingRule>>({
      minPoints: 0,
      maxPoints: 0,
      statusLabel: '',
      color: 'bg-slate-100 text-slate-800'
  });

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  // SORT & SELECT STATE
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  
  const [incidentSort, setIncidentSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'name', direction: 'asc' });
  const [categorySort, setCategorySort] = useState<{ key: string; direction: SortDirection }>({ key: 'name', direction: 'asc' });

  // MAINTENANCE STATE
  const [cleanupStats, setCleanupStats] = useState<any>(null);

  useEffect(() => { refreshData(); }, []);

  const refreshData = () => {
    setCategories(DataService.getCategories());
    setIncidents(DataService.getIncidentTypes());
    
    const loadedRules = DataService.getRules();
    setRules(loadedRules.sort((a,b) => a.minPoints - b.minPoints));
    
    setSelectedIncidentIds([]);
    setSelectedCategoryIds([]);
  };

  // --- SORTING HELPERS ---
  const handleIncidentSort = (key: SortKey) => {
    const direction = (incidentSort.key === key && incidentSort.direction === 'asc') ? 'desc' : 'asc';
    setIncidentSort({ key, direction });
  };

  const handleCategorySort = (key: string) => {
    const direction = (categorySort.key === key && categorySort.direction === 'asc') ? 'desc' : 'asc';
    setCategorySort({ key, direction });
  };

  const getSortedIncidents = () => {
    const sorted = [...incidents].sort((a, b) => {
        const dir = incidentSort.direction === 'asc' ? 1 : -1;
        if (incidentSort.key === 'name') return a.name.localeCompare(b.name) * dir;
        if (incidentSort.key === 'points') return (a.points - b.points) * dir;
        if (incidentSort.key === 'category') {
            const catA = categories.find(c => c.id === a.categoryId)?.name || '';
            const catB = categories.find(c => c.id === b.categoryId)?.name || '';
            return catA.localeCompare(catB) * dir;
        }
        return 0;
    });
    return sorted;
  };

  const getSortedCategories = () => {
      const sorted = [...categories].sort((a,b) => {
          const dir = categorySort.direction === 'asc' ? 1 : -1;
          if (categorySort.key === 'name') return a.name.localeCompare(b.name) * dir;
          if (categorySort.key === 'type') return a.targetType.localeCompare(b.targetType) * dir;
          return 0;
      });
      return sorted;
  };

  // --- SELECTION HELPERS ---
  const toggleIncidentSelection = (id: string) => {
      setSelectedIncidentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAllIncidents = () => {
      if (selectedIncidentIds.length === incidents.length) setSelectedIncidentIds([]);
      else setSelectedIncidentIds(incidents.map(i => i.id));
  };

  const toggleCategorySelection = (id: string) => {
      setSelectedCategoryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAllCategories = () => {
      if (selectedCategoryIds.length === categories.length) setSelectedCategoryIds([]);
      else setSelectedCategoryIds(categories.map(c => c.id));
  };

  // --- ACTION HANDLERS ---

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        let updated: MasterCategory[];
        if (isEditingCategory && editingCategoryId) {
          updated = categories.map(c => c.id === editingCategoryId ? { ...c, name: catName, targetType: catType } : c);
        } else {
          updated = [...categories, { id: `cat_${Date.now()}`, name: catName, targetType: catType }];
        }
        await DataService.saveCategories(updated);
        setCategories(updated);
        setShowCatModal(false);
        resetCategoryForm();
    } finally {
        setIsSaving(false);
    }
  };

  const resetCategoryForm = () => {
      setCatName('');
      setCatType(IncidentTypeCategory.VIOLATION);
      setIsEditingCategory(false);
      setEditingCategoryId(null);
  };

  const handleEditCategory = (cat: MasterCategory) => {
      setCatName(cat.name);
      setCatType(cat.targetType);
      setEditingCategoryId(cat.id);
      setIsEditingCategory(true);
      setShowCatModal(true);
  };

  const handleBulkDeleteCategories = async () => {
      if (selectedCategoryIds.length === 0) return;
      if (confirm(`Hapus ${selectedCategoryIds.length} kategori terpilih? Kejadian terkait mungkin akan error.`)) {
          setIsSaving(true);
          try {
              const updated = categories.filter(c => !selectedCategoryIds.includes(c.id));
              await DataService.saveCategories(updated);
              setCategories(updated);
              setSelectedCategoryIds([]);
          } finally {
              setIsSaving(false);
          }
      }
  };

  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        const newInc: MasterIncidentType = {
          id: `inc_${Date.now()}`,
          name: newIncName,
          type: newIncType,
          categoryId: newIncCatId,
          points: Number(newIncPoints),
          severity: newIncSeverity,
          isActive: true
        };
        await DataService.saveIncidentTypes([...incidents, newInc]);
        refreshData();
        setShowIncModal(false);
        setNewIncName('');
        setNewIncPoints(0);
    } finally {
        setIsSaving(false);
    }
  };

  const handleBulkDeleteIncidents = async () => {
      if(selectedIncidentIds.length === 0) return;
      if(confirm(`Hapus ${selectedIncidentIds.length} jenis kejadian terpilih?`)) {
          setIsSaving(true);
          try {
            const updated = incidents.filter(i => !selectedIncidentIds.includes(i.id));
            await DataService.saveIncidentTypes(updated);
            setIncidents(updated);
            setSelectedIncidentIds([]);
          } finally {
            setIsSaving(false);
          }
      }
  };

  // --- MAINTENANCE HANDLERS ---
  const handleBackup = () => {
      const json = DataService.exportDataJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_sekolah_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!confirm("PERINGATAN: Restore akan menimpa SEMUA data saat ini dengan data dari file backup. Lanjutkan?")) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          setIsSaving(true);
          try {
              const success = await DataService.restoreDataJSON(evt.target?.result as string);
              if (success) {
                  alert("Data berhasil dipulihkan!");
                  window.location.reload();
              } else {
                  alert("Gagal memulihkan data. Format file salah.");
              }
          } finally {
              setIsSaving(false);
          }
      };
      reader.readAsText(file);
  };

  const handleCleanup = async () => {
      if (!confirm("Bersihkan data sampah? Sistem akan menghapus riwayat, poin, dan konseling milik siswa yang sudah tidak ada di database.")) return;
      setIsSaving(true);
      try {
          const stats = await DataService.cleanupOrphanData();
          setCleanupStats(stats);
      } finally {
          setIsSaving(false);
      }
  };

  // --- IMPORT LOGIC ---
  const downloadTemplate = () => {
    const csvContent = "Nama Kejadian,Poin,Nama Kategori,Tipe (PELANGGARAN/PENGHARGAAN)\nTerlambat Sekolah,5,Kedisiplinan,PELANGGARAN\nJuara Lomba,50,Prestasi,PENGHARGAAN";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_kejadian.csv";
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportError('');
    setImportSuccess('');

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        if (rows.length < 2) { setImportError('File kosong atau format salah.'); return; }

        setIsSaving(true);
        const newIncidents: MasterIncidentType[] = [];
        const newCategories: MasterCategory[] = [...categories];
        let successCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(/,|;/).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 3 && cols[0] && cols[1] && cols[2]) {
             const incName = cols[0];
             const points = Number(cols[1]);
             const catName = cols[2];
             const typeStr = cols[3]?.toUpperCase() === 'PENGHARGAAN' ? 'ACHIEVEMENT' : 'VIOLATION';
             
             let category = newCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
             if (!category) {
                 category = { id: `cat_imp_${Date.now()}_${i}`, name: catName, targetType: typeStr as IncidentTypeCategory };
                 newCategories.push(category);
             }

             if (!incidents.some(inc => inc.name.toLowerCase() === incName.toLowerCase() && inc.categoryId === category!.id)) {
                 newIncidents.push({ id: `inc_imp_${Date.now()}_${i}`, name: incName, points: points, categoryId: category.id, type: typeStr as IncidentTypeCategory, isActive: true, severity: points >= 50 ? 'HIGH' : points >= 20 ? 'MEDIUM' : 'LOW' });
                 successCount++;
             }
          }
        }

        if (successCount > 0) {
            if (newCategories.length > categories.length) { await DataService.saveCategories(newCategories); setCategories(newCategories); }
            const updatedIncidents = [...incidents, ...newIncidents];
            await DataService.saveIncidentTypes(updatedIncidents);
            setIncidents(updatedIncidents);
            setImportSuccess(`Berhasil mengimpor ${successCount} kejadian.`);
            setTimeout(() => { setIsImportModalOpen(false); setImportSuccess(''); }, 1500);
        } else {
            setImportError('Tidak ada data valid yang bisa diimpor.');
        }
      } catch (err) {
        setImportError('Gagal membaca file CSV.');
      } finally {
        setIsSaving(false);
      }
    };
    reader.readAsText(file);
  };

  // --- RULE MANAGEMENT ---
  const handleEditRule = (rule: CoachingRule) => { setEditingRuleId(rule.id); setRuleForm(rule); setShowRuleModal(true); };
  const handleAddRuleClick = () => { setEditingRuleId(null); setRuleForm({ minPoints: 0, maxPoints: 0, statusLabel: '', color: 'bg-slate-100 text-slate-800' }); setShowRuleModal(true); };
  const handleSaveRule = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          let updatedRules: CoachingRule[];
          if (editingRuleId) { updatedRules = rules.map(r => r.id === editingRuleId ? { ...r, ...ruleForm } as CoachingRule : r); } 
          else { const newRule: CoachingRule = { id: `rule_${Date.now()}`, minPoints: Number(ruleForm.minPoints), maxPoints: Number(ruleForm.maxPoints), statusLabel: ruleForm.statusLabel || 'Status Baru', color: ruleForm.color || 'bg-slate-100 text-slate-800' }; updatedRules = [...rules, newRule]; }
          updatedRules.sort((a,b) => a.minPoints - b.minPoints);
          await DataService.saveRules(updatedRules);
          setRules(updatedRules);
          setShowRuleModal(false);
      } finally { setIsSaving(false); }
  };
  const handleDeleteRule = async (id: string) => { if(confirm('Hapus aturan batas poin ini?')) { setIsSaving(true); try { const updated = rules.filter(r => r.id !== id); await DataService.saveRules(updated); setRules(updated); } finally { setIsSaving(false); } } };

  const SortHeader = ({ label, sKey, onClick, currentSort }: { label: string, sKey: string, onClick: (k: any) => void, currentSort: {key: string, direction: SortDirection} }) => (
    <th className="px-6 py-3 cursor-pointer hover:bg-slate-200 transition-colors select-none" onClick={() => onClick(sKey)}>
      <div className="flex items-center gap-2">{label} {currentSort.key === sKey ? (currentSort.direction === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />) : <ArrowUpDown className="h-3 w-3 text-slate-400" />}</div>
    </th>
  );

  return (
    <div className="space-y-6">
      {isSaving && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800">
                <Cloud className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Sinkronisasi Cloud...</h3>
                <p className="text-sm text-slate-500 mt-2">Sistem sedang mengunci data Anda di server Google.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden"><div className="h-full bg-indigo-600 animate-progress-indeterminate"></div></div>
            </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Scale className="h-6 w-6 text-indigo-600" /> Konfigurasi Poin & Aturan</h1>
            <p className="text-slate-500">Atur jenis pelanggaran, kategori, dan ambang batas sanksi.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50/50">
          <button onClick={() => setActiveTab('INCIDENT')} className={`px-6 py-4 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${activeTab === 'INCIDENT' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><List className="h-4 w-4" /> Jenis Kejadian</button>
          <button onClick={() => setActiveTab('CATEGORY')} className={`px-6 py-4 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${activeTab === 'CATEGORY' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Shield className="h-4 w-4" /> Kategori</button>
          <button onClick={() => setActiveTab('RULES')} className={`px-6 py-4 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${activeTab === 'RULES' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Gavel className="h-4 w-4" /> Aturan</button>
          <button onClick={() => setActiveTab('MAINTENANCE')} className={`px-6 py-4 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${activeTab === 'MAINTENANCE' ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Database className="h-4 w-4" /> Maintenance</button>
        </div>

        <div className="p-6">
          {activeTab === 'CATEGORY' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg text-sm font-medium border border-indigo-100 flex items-center gap-2">
                          <Shield className="h-4 w-4" /> Total: {categories.length}
                      </div>
                      {selectedCategoryIds.length > 0 && (
                          <button onClick={handleBulkDeleteCategories} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-200"><Trash2 className="h-4 w-4" /> Hapus {selectedCategoryIds.length} Terpilih</button>
                      )}
                  </div>
                  <button onClick={() => { resetCategoryForm(); setShowCatModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Plus className="h-4 w-4" /> Tambah Kategori</button>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center"><button onClick={toggleAllCategories} className="text-slate-400 hover:text-indigo-600 flex items-center justify-center w-full h-full">{selectedCategoryIds.length > 0 && selectedCategoryIds.length === categories.length ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5" />}</button></th>
                            <SortHeader label="Nama Kategori" sKey="name" onClick={handleCategorySort} currentSort={categorySort} />
                            <SortHeader label="Tipe Poin" sKey="type" onClick={handleCategorySort} currentSort={categorySort} />
                            <th className="text-right px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {getSortedCategories().map(c => (
                            <tr key={c.id} className={`hover:bg-slate-50 ${selectedCategoryIds.includes(c.id) ? 'bg-indigo-50' : ''}`}>
                                <td className="px-4 py-3 text-center"><button onClick={() => toggleCategorySelection(c.id)} className="flex items-center justify-center w-full h-full text-slate-400 hover:text-indigo-600">{selectedCategoryIds.includes(c.id) ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5" />}</button></td>
                                <td className="px-6 py-3 font-medium text-slate-800">{c.name}</td>
                                <td className="px-6 py-3"><span className={`px-2 py-1 rounded-md text-xs font-bold ${c.targetType === 'VIOLATION' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.targetType === 'VIOLATION' ? 'Pelanggaran' : 'Prestasi / Penghargaan'}</span></td>
                                <td className="text-right px-6 py-3 flex justify-end gap-2"><button onClick={() => handleEditCategory(c)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded"><Pencil className="h-4 w-4" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                  </table>
              </div>
            </div>
          )}

          {activeTab === 'INCIDENT' && (
            <div className="space-y-4 animate-fade-in">
               <div className="flex justify-between items-center">
                   <div className="flex items-center gap-2">
                       <div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg text-sm font-medium border border-indigo-100 flex items-center gap-2">
                          <List className="h-4 w-4" /> Total: {incidents.length}
                       </div>
                       {selectedIncidentIds.length > 0 && (
                          <button onClick={handleBulkDeleteIncidents} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-200"><Trash2 className="h-4 w-4" /> Hapus {selectedIncidentIds.length} Terpilih</button>
                       )}
                   </div>
                   <div className="flex gap-2">
                       <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm"><Upload className="h-4 w-4" /> Import CSV</button>
                       <button onClick={() => setShowIncModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Plus className="h-4 w-4" /> Tambah Kejadian</button>
                   </div>
               </div>
               <div className="overflow-hidden rounded-xl border border-slate-200">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                              <th className="px-4 py-3 w-10 text-center"><button onClick={toggleAllIncidents} className="text-slate-400 hover:text-indigo-600 flex items-center justify-center w-full h-full">{selectedIncidentIds.length > 0 && selectedIncidentIds.length === incidents.length ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5" />}</button></th>
                              <SortHeader label="Nama Kejadian" sKey="name" onClick={handleIncidentSort} currentSort={incidentSort} />
                              <SortHeader label="Kategori" sKey="category" onClick={handleIncidentSort} currentSort={incidentSort} />
                              <SortHeader label="Bobot Poin" sKey="points" onClick={handleIncidentSort} currentSort={incidentSort} />
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {getSortedIncidents().map(inc => {
                              const catName = categories.find(c => c.id === inc.categoryId)?.name || '-';
                              return (
                                  <tr key={inc.id} className={`hover:bg-slate-50 ${selectedIncidentIds.includes(inc.id) ? 'bg-indigo-50' : ''}`}>
                                      <td className="px-4 py-3 text-center"><button onClick={() => toggleIncidentSelection(inc.id)} className="flex items-center justify-center w-full h-full text-slate-400 hover:text-indigo-600">{selectedIncidentIds.includes(inc.id) ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5" />}</button></td>
                                      <td className="px-6 py-3 font-medium text-slate-900">{inc.name}</td>
                                      <td className="px-6 py-3 text-slate-500">{catName}</td>
                                      <td className="px-6 py-3 text-center"><span className={`font-bold px-2 py-1 rounded ${inc.type === 'VIOLATION' ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>{inc.points}</span></td>
                                  </tr>
                              );
                          })}
                      </tbody>
                   </table>
               </div>
            </div>
          )}

          {activeTab === 'RULES' && (
              <div className="space-y-6 animate-fade-in">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800 text-sm flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                          <p className="font-bold">Konfigurasi Ambang Batas Poin (Rules)</p>
                          <p>Aturan ini menentukan status pembinaan siswa secara otomatis.</p>
                      </div>
                  </div>
                  <div className="flex justify-between items-center"><h3 className="font-bold text-slate-700">Daftar Aturan</h3><button onClick={handleAddRuleClick} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Plus className="h-4 w-4" /> Tambah Aturan</button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rules.map(rule => (
                          <div key={rule.id} className="bg-white border-2 border-slate-100 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all group relative">
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleEditRule(rule)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 className="h-4 w-4" /></button></div>
                              <div className="flex items-center gap-3 mb-3"><div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${rule.color}`}>{rule.statusLabel}</div></div>
                              <div className="flex items-baseline gap-1"><span className="text-3xl font-black text-slate-800">{rule.minPoints}</span><span className="text-slate-400 font-medium">s/d</span><span className="text-3xl font-black text-slate-800">{rule.maxPoints > 900 ? '∞' : rule.maxPoints}</span><span className="text-sm text-slate-500 ml-1">Poin</span></div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden"><div className={`h-full ${rule.color.replace('bg-', 'bg-').split(' ')[0].replace('100', '500')}`} style={{ width: '100%' }}></div></div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {activeTab === 'MAINTENANCE' && (
              <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
                  <div className="text-center mb-8">
                      <h2 className="text-2xl font-black text-slate-800">Sistem Maintenance</h2>
                      <p className="text-slate-500">Backup data, pulihkan data, atau bersihkan database dari sampah.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* BACKUP */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all text-center">
                          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Download className="h-8 w-8" /></div>
                          <h3 className="font-bold text-slate-800 mb-2">Backup Database (JSON)</h3>
                          <p className="text-sm text-slate-500 mb-6">Unduh seluruh data sekolah dalam format JSON. Simpan file ini di tempat aman (Harddisk/Google Drive) sebagai cadangan manual.</p>
                          <button onClick={handleBackup} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md">Download Backup</button>
                      </div>

                      {/* RESTORE */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-orange-300 transition-all text-center">
                          <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4"><RotateCcw className="h-8 w-8" /></div>
                          <h3 className="font-bold text-slate-800 mb-2">Restore Database</h3>
                          <p className="text-sm text-slate-500 mb-6">Kembalikan data dari file backup JSON. <span className="text-red-600 font-bold">PERINGATAN:</span> Data saat ini akan ditimpa total.</p>
                          <label className="w-full py-3 bg-white border-2 border-orange-200 text-orange-700 font-bold rounded-xl cursor-pointer hover:bg-orange-50 block">
                              Pilih File Backup
                              <input type="file" ref={restoreInputRef} onChange={handleRestore} accept=".json" className="hidden" />
                          </label>
                      </div>
                  </div>

                  {/* CLEANUP */}
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100 mt-8">
                      <div className="flex items-start gap-4">
                          <div className="p-3 bg-white rounded-full text-red-600 shadow-sm"><Trash2 className="h-6 w-6" /></div>
                          <div className="flex-1">
                              <h3 className="font-bold text-red-800 text-lg">Pembersihan Data Sampah (Garbage Collection)</h3>
                              <p className="text-sm text-red-600 mt-1 mb-4">Gunakan fitur ini jika Anda baru saja menghapus banyak siswa. Sistem akan memindai seluruh database dan menghapus riwayat pelanggaran, poin, konseling, dan sanksi yang pemiliknya (Siswa) sudah tidak ada.</p>
                              
                              {cleanupStats ? (
                                  <div className="bg-white p-4 rounded-xl border border-red-100 text-sm mb-4">
                                      <p className="font-bold text-slate-700 mb-2">Hasil Pembersihan:</p>
                                      <ul className="list-disc list-inside text-slate-600 space-y-1">
                                          <li>Riwayat Poin Dihapus: <b>{cleanupStats.recordsDeleted}</b></li>
                                          <li>Sanksi Dihapus: <b>{cleanupStats.sanctionsDeleted}</b></li>
                                          <li>Konseling Dihapus: <b>{cleanupStats.counselingDeleted}</b></li>
                                      </ul>
                                      <button onClick={() => setCleanupStats(null)} className="mt-3 text-xs font-bold text-indigo-600 hover:underline">Tutup Laporan</button>
                                  </div>
                              ) : (
                                  <button onClick={handleCleanup} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm">Jalankan Pembersihan</button>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* MODAL KATEGORI */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-slate-800">{isEditingCategory ? 'Edit Kategori' : 'Kategori Baru'}</h3><button onClick={() => setShowCatModal(false)}><X className="h-5 w-5 text-slate-400" /></button></div>
                <form onSubmit={handleSaveCategory} className="space-y-4">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Nama Kategori</label><input required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none font-medium" placeholder="Contoh: Kedisiplinan" value={catName} onChange={e => setCatName(e.target.value)} /></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Tipe Poin</label><select className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none bg-white font-medium" value={catType} onChange={e => setCatType(e.target.value as any)}><option value="VIOLATION">Pelanggaran (Poin Sanksi)</option><option value="ACHIEVEMENT">Prestasi (Poin Apresiasi)</option></select></div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Simpan Kategori</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL KEJADIAN */}
      {showIncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-slate-800">Tambah Kejadian</h3><button onClick={() => setShowIncModal(false)}><X className="h-5 w-5 text-slate-400" /></button></div>
                <form onSubmit={handleAddIncident} className="space-y-4">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Jenis Input</label><select className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none bg-white" value={newIncType} onChange={e => setNewIncType(e.target.value as any)}><option value="VIOLATION">Pelanggaran</option><option value="ACHIEVEMENT">Penghargaan</option></select></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Kategori</label><select required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none bg-white" value={newIncCatId} onChange={e => setNewIncCatId(e.target.value)}><option value="">-- Pilih Kategori --</option>{categories.filter(c => c.targetType === newIncType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Nama Kejadian</label><input required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="Contoh: Terlambat Sekolah" value={newIncName} onChange={e => setNewIncName(e.target.value)} /></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Bobot Poin</label><input type="number" className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="0" value={newIncPoints} onChange={e => setNewIncPoints(Number(e.target.value))} /></div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Simpan Kejadian</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL ATURAN (RULES) */}
      {showRuleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-slate-800">{editingRuleId ? 'Edit Aturan' : 'Buat Aturan Baru'}</h3><button onClick={() => setShowRuleModal(false)}><X className="h-5 w-5 text-slate-400" /></button></div>
                  <form onSubmit={handleSaveRule} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Poin</label><input type="number" required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none font-bold text-center" value={ruleForm.minPoints} onChange={e => setRuleForm({...ruleForm, minPoints: Number(e.target.value)})} /></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Poin</label><input type="number" required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none font-bold text-center" value={ruleForm.maxPoints} onChange={e => setRuleForm({...ruleForm, maxPoints: Number(e.target.value)})} /></div></div>
                      <div><label className="block text-sm font-bold text-slate-700 mb-1">Label Status</label><input type="text" required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="Contoh: SP 1" value={ruleForm.statusLabel} onChange={e => setRuleForm({...ruleForm, statusLabel: e.target.value})} /></div>
                      <div><label className="block text-sm font-bold text-slate-700 mb-1">Warna Indikator (CSS Class)</label><select className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none bg-white" value={ruleForm.color} onChange={e => setRuleForm({...ruleForm, color: e.target.value})}><option value="bg-slate-100 text-slate-800">Abu-abu (Normal)</option><option value="bg-blue-100 text-blue-800">Biru (Info)</option><option value="bg-yellow-100 text-yellow-800">Kuning (Peringatan)</option><option value="bg-orange-100 text-orange-800">Oranye (Bahaya)</option><option value="bg-red-100 text-red-800">Merah (Kritis)</option><option value="bg-purple-100 text-purple-800">Ungu (Khusus)</option></select><div className={`mt-2 p-2 rounded text-xs font-bold text-center ${ruleForm.color}`}>Preview Tampilan Label</div></div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Simpan Aturan</button>
                  </form>
              </div>
          </div>
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-green-600" /> Import Kejadian (CSV)</h2><button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-red-500"><X className="h-5 w-5" /></button></div>
                <div className="space-y-4"><div className="p-4 bg-slate-50 rounded-lg border text-sm text-slate-600"><p className="font-semibold mb-2">Kolom Wajib:</p><ul className="list-disc list-inside space-y-1 text-xs"><li>Nama Kejadian (Contoh: Membolos)</li><li>Poin (Contoh: 10)</li><li>Nama Kategori (Contoh: Kedisiplinan)</li><li>Tipe (PELANGGARAN / PENGHARGAAN)</li></ul></div><button onClick={downloadTemplate} className="w-full py-2 px-4 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center justify-center gap-2 font-medium"><Download className="h-4 w-4" /> Download Template CSV</button><div className="pt-2"><label className="block text-sm font-medium mb-2">Upload File CSV</label><input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" /></div>{importError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {importError}</div>}{importSuccess && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg flex items-center gap-2"><Check className="h-4 w-4" /> {importSuccess}</div>}</div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PointConfiguration;
