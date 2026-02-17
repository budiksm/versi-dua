
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { MasterCategory, MasterIncidentType, CoachingRule, IncidentTypeCategory } from '../../types';
import { Save, Plus, Trash2, List, Shield, AlertTriangle, X, Upload, FileSpreadsheet, Download, CheckSquare, Pencil, Brush, ChevronUp, ChevronDown, ArrowUpDown, Square, Cloud, Gavel, Scale } from 'lucide-react';

type SortKey = 'name' | 'type' | 'category' | 'points' | 'severity';
type SortDirection = 'asc' | 'desc';

const PointConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATEGORY' | 'INCIDENT' | 'RULES'>('INCIDENT');
  const [isSaving, setIsSaving] = useState(false);
  
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [showIncModal, setShowIncModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  
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

  // Rule Form (New)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<CoachingRule>>({
      minPoints: 0,
      maxPoints: 0,
      statusLabel: '',
      color: 'bg-slate-100 text-slate-800'
  });

  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc'
  });

  useEffect(() => { refreshData(); }, []);

  const refreshData = () => {
    setCategories(DataService.getCategories());
    setIncidents(DataService.getIncidentTypes());
    
    // Sort rules by minPoints to keep them orderly
    const loadedRules = DataService.getRules();
    setRules(loadedRules.sort((a,b) => a.minPoints - b.minPoints));
    
    setSelectedIncidentIds([]);
  };

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

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Hapus kategori ini? Semua kejadian di dalamnya mungkin akan kehilangan referensi kategori.')) {
      setIsSaving(true);
      try {
        const updated = categories.filter(c => c.id !== id);
        await DataService.saveCategories(updated);
        setCategories(updated);
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

  const handleDeleteIncident = async (id: string) => {
      if(confirm('Hapus jenis kejadian ini?')) {
          setIsSaving(true);
          try {
            const updated = incidents.filter(i => i.id !== id);
            await DataService.saveIncidentTypes(updated);
            setIncidents(updated);
          } finally {
            setIsSaving(false);
          }
      }
  }

  // --- RULE MANAGEMENT ---
  const handleEditRule = (rule: CoachingRule) => {
      setEditingRuleId(rule.id);
      setRuleForm(rule);
      setShowRuleModal(true);
  };

  const handleAddRuleClick = () => {
      setEditingRuleId(null);
      setRuleForm({ minPoints: 0, maxPoints: 0, statusLabel: '', color: 'bg-slate-100 text-slate-800' });
      setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          let updatedRules: CoachingRule[];
          if (editingRuleId) {
              updatedRules = rules.map(r => r.id === editingRuleId ? { ...r, ...ruleForm } as CoachingRule : r);
          } else {
              const newRule: CoachingRule = {
                  id: `rule_${Date.now()}`,
                  minPoints: Number(ruleForm.minPoints),
                  maxPoints: Number(ruleForm.maxPoints),
                  statusLabel: ruleForm.statusLabel || 'Status Baru',
                  color: ruleForm.color || 'bg-slate-100 text-slate-800'
              };
              updatedRules = [...rules, newRule];
          }
          // Sort rules to ensure consistency
          updatedRules.sort((a,b) => a.minPoints - b.minPoints);
          
          await DataService.saveRules(updatedRules);
          setRules(updatedRules);
          setShowRuleModal(false);
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteRule = async (id: string) => {
      if(confirm('Hapus aturan batas poin ini?')) {
          setIsSaving(true);
          try {
              const updated = rules.filter(r => r.id !== id);
              await DataService.saveRules(updated);
              setRules(updated);
          } finally {
              setIsSaving(false);
          }
      }
  };

  return (
    <div className="space-y-6">
      {isSaving && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800">
                <Cloud className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Sinkronisasi Cloud...</h3>
                <p className="text-sm text-slate-500 mt-2">Sistem sedang mengunci data Anda di server Google.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                </div>
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
          <button onClick={() => setActiveTab('RULES')} className={`px-6 py-4 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${activeTab === 'RULES' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Gavel className="h-4 w-4" /> Aturan & Ambang Batas</button>
        </div>

        <div className="p-6">
          {activeTab === 'CATEGORY' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                  <div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg text-sm font-medium border border-indigo-100 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Total Kategori: {categories.length}
                  </div>
                  <button onClick={() => { resetCategoryForm(); setShowCatModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Plus className="h-4 w-4" /> Tambah Kategori</button>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600"><tr><th className="px-6 py-3">Nama Kategori</th><th className="px-6 py-3">Tipe Poin</th><th className="text-right px-6 py-3">Aksi</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{categories.map(c => (<tr key={c.id} className="hover:bg-slate-50"><td className="px-6 py-3 font-medium text-slate-800">{c.name}</td><td className="px-6 py-3"><span className={`px-2 py-1 rounded-md text-xs font-bold ${c.targetType === 'VIOLATION' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.targetType === 'VIOLATION' ? 'Pelanggaran' : 'Prestasi / Penghargaan'}</span></td><td className="text-right px-6 py-3 flex justify-end gap-2"><button onClick={() => handleEditCategory(c)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDeleteCategory(c.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 className="h-4 w-4" /></button></td></tr>))}</tbody>
                  </table>
              </div>
            </div>
          )}

          {activeTab === 'INCIDENT' && (
            <div className="space-y-4 animate-fade-in">
               <div className="flex justify-between items-center">
                   <div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg text-sm font-medium border border-indigo-100 flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Total Item: {incidents.length}
                   </div>
                   <button onClick={() => setShowIncModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Plus className="h-4 w-4" /> Tambah Kejadian</button>
               </div>
               <div className="overflow-hidden rounded-xl border border-slate-200">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600"><tr><th className="px-6 py-3">Nama Kejadian</th><th className="px-6 py-3">Kategori</th><th className="px-6 py-3 text-center">Bobot Poin</th><th className="text-right px-6 py-3">Aksi</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                          {incidents.map(inc => {
                              const catName = categories.find(c => c.id === inc.categoryId)?.name || '-';
                              return (
                                  <tr key={inc.id} className="hover:bg-slate-50">
                                      <td className="px-6 py-3 font-medium text-slate-900">{inc.name}</td>
                                      <td className="px-6 py-3 text-slate-500">{catName}</td>
                                      <td className="px-6 py-3 text-center"><span className={`font-bold px-2 py-1 rounded ${inc.type === 'VIOLATION' ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>{inc.points}</span></td>
                                      <td className="text-right px-6 py-3"><button onClick={() => handleDeleteIncident(inc.id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"><Trash2 className="h-4 w-4" /></button></td>
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
                          <p>Aturan ini menentukan status pembinaan siswa secara otomatis berdasarkan akumulasi poin pelanggaran mereka. Pastikan rentang poin tidak tumpang tindih.</p>
                      </div>
                  </div>

                  <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-700">Daftar Aturan</h3>
                      <button onClick={handleAddRuleClick} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><Plus className="h-4 w-4" /> Tambah Aturan</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rules.map(rule => (
                          <div key={rule.id} className="bg-white border-2 border-slate-100 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all group relative">
                              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleEditRule(rule)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Pencil className="h-4 w-4" /></button>
                                  <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 className="h-4 w-4" /></button>
                              </div>
                              <div className="flex items-center gap-3 mb-3">
                                  <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${rule.color}`}>
                                      {rule.statusLabel}
                                  </div>
                              </div>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-black text-slate-800">{rule.minPoints}</span>
                                  <span className="text-slate-400 font-medium">s/d</span>
                                  <span className="text-3xl font-black text-slate-800">{rule.maxPoints > 900 ? '∞' : rule.maxPoints}</span>
                                  <span className="text-sm text-slate-500 ml-1">Poin</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
                                  <div className={`h-full ${rule.color.replace('bg-', 'bg-').split(' ')[0].replace('100', '500')}`} style={{ width: '100%' }}></div>
                              </div>
                          </div>
                      ))}
                      {rules.length === 0 && (
                          <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              Belum ada aturan yang dikonfigurasi.
                          </div>
                      )}
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
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Tipe Poin</label>
                        <select className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none bg-white font-medium" value={catType} onChange={e => setCatType(e.target.value as any)}>
                            <option value="VIOLATION">Pelanggaran (Poin Sanksi)</option>
                            <option value="ACHIEVEMENT">Prestasi (Poin Apresiasi)</option>
                        </select>
                    </div>
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
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg text-slate-800">{editingRuleId ? 'Edit Aturan' : 'Buat Aturan Baru'}</h3>
                      <button onClick={() => setShowRuleModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                  </div>
                  <form onSubmit={handleSaveRule} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Min Poin</label><input type="number" required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none font-bold text-center" value={ruleForm.minPoints} onChange={e => setRuleForm({...ruleForm, minPoints: Number(e.target.value)})} /></div>
                          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Poin</label><input type="number" required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none font-bold text-center" value={ruleForm.maxPoints} onChange={e => setRuleForm({...ruleForm, maxPoints: Number(e.target.value)})} /></div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Label Status</label>
                          <input type="text" required className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none" placeholder="Contoh: SP 1" value={ruleForm.statusLabel} onChange={e => setRuleForm({...ruleForm, statusLabel: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Warna Indikator (CSS Class)</label>
                          <select className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 outline-none bg-white" value={ruleForm.color} onChange={e => setRuleForm({...ruleForm, color: e.target.value})}>
                              <option value="bg-slate-100 text-slate-800">Abu-abu (Normal)</option>
                              <option value="bg-blue-100 text-blue-800">Biru (Info)</option>
                              <option value="bg-yellow-100 text-yellow-800">Kuning (Peringatan)</option>
                              <option value="bg-orange-100 text-orange-800">Oranye (Bahaya)</option>
                              <option value="bg-red-100 text-red-800">Merah (Kritis)</option>
                              <option value="bg-purple-100 text-purple-800">Ungu (Khusus)</option>
                          </select>
                          <div className={`mt-2 p-2 rounded text-xs font-bold text-center ${ruleForm.color}`}>Preview Tampilan Label</div>
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">Simpan Aturan</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default PointConfiguration;
