
import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../../services/dataService';
import { MasterCategory, MasterIncidentType, CoachingRule, IncidentTypeCategory } from '../../types';
import { Save, Plus, Trash2, List, Shield, AlertTriangle, X, Upload, FileSpreadsheet, Download, CheckSquare, Pencil, Brush, ChevronUp, ChevronDown, ArrowUpDown, Square, Cloud } from 'lucide-react';

type SortKey = 'name' | 'type' | 'category' | 'points' | 'severity';
type SortDirection = 'asc' | 'desc';

const PointConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATEGORY' | 'INCIDENT' | 'RULES'>('INCIDENT');
  const [isSaving, setIsSaving] = useState(false);
  
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);

  const [showCatModal, setShowCatModal] = useState(false);
  const [showIncModal, setShowIncModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);

  const [newIncName, setNewIncName] = useState('');
  const [newIncType, setNewIncType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [newIncCatId, setNewIncCatId] = useState('');
  const [newIncPoints, setNewIncPoints] = useState(0);
  const [newIncSeverity, setNewIncSeverity] = useState<'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'>('LOW');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc'
  });

  useEffect(() => { refreshData(); }, []);

  const refreshData = () => {
    setCategories(DataService.getCategories());
    setIncidents(DataService.getIncidentTypes());
    setRules(DataService.getRules());
    setSelectedIncidentIds([]);
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleBatchDelete = async () => {
    if (selectedIncidentIds.length === 0) return;
    if (confirm(`Hapus ${selectedIncidentIds.length} data?`)) {
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
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Hapus kategori ini?')) {
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
    } finally {
        setIsSaving(false);
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
        <div><h1 className="text-2xl font-bold text-slate-800">Konfigurasi Poin</h1><p className="text-slate-500">Atur kategori dan bobot poin.</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          <button onClick={() => setActiveTab('INCIDENT')} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'INCIDENT' ? 'border-indigo-600 text-indigo-600' : 'text-slate-500'}`}>Jenis Kejadian</button>
          <button onClick={() => setActiveTab('CATEGORY')} className={`px-6 py-3 font-bold text-sm border-b-2 ${activeTab === 'CATEGORY' ? 'border-indigo-600 text-indigo-600' : 'text-slate-500'}`}>Kategori</button>
        </div>

        <div className="p-6">
          {activeTab === 'CATEGORY' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center"><h3 className="font-bold">Kategori</h3><button onClick={() => setShowCatModal(true)} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm flex gap-2"><Plus className="h-4 w-4" /> Tambah</button></div>
              <table className="w-full text-sm text-left">
                <thead><tr className="bg-slate-50 border-b"><th>Nama</th><th>Tipe</th><th className="text-right px-3">Aksi</th></tr></thead>
                <tbody>{categories.map(c => (<tr key={c.id} className="border-b"><td>{c.name}</td><td>{c.targetType}</td><td className="text-right"><button onClick={() => handleDeleteCategory(c.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></button></td></tr>))}</tbody>
              </table>
            </div>
          )}

          {activeTab === 'INCIDENT' && (
            <div className="space-y-4">
               <div className="flex justify-between items-center"><h3 className="font-bold">Daftar Kejadian</h3><div className="flex gap-2"><button onClick={() => setShowIncModal(true)} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm">Tambah</button></div></div>
               <table className="w-full text-sm text-left">
                  <thead><tr className="bg-slate-50 border-b"><th>Nama</th><th>Tipe</th><th>Bobot</th><th className="text-right px-3">Aksi</th></tr></thead>
                  <tbody>{incidents.map(inc => (<tr key={inc.id} className="border-b"><td>{inc.name}</td><td>{inc.type}</td><td className="font-bold">{inc.points}</td><td className="text-right"><button onClick={() => DataService.saveIncidentTypes(incidents.filter(i => i.id !== inc.id))} className="text-red-500"><Trash2 className="h-4 w-4" /></button></td></tr>))}</tbody>
               </table>
            </div>
          )}
        </div>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white p-6 rounded-xl w-full max-w-sm"><form onSubmit={handleSaveCategory} className="space-y-4"><h3 className="font-bold">Kategori</h3><input required className="w-full border p-2 rounded" placeholder="Nama" value={catName} onChange={e => setCatName(e.target.value)} /><button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">Simpan</button></form></div></div>
      )}

      {showIncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white p-6 rounded-xl w-full max-w-md"><form onSubmit={handleAddIncident} className="space-y-4"><h3 className="font-bold">Kejadian Baru</h3><select className="w-full border p-2 rounded" value={newIncType} onChange={e => setNewIncType(e.target.value as any)}><option value="VIOLATION">Pelanggaran</option><option value="ACHIEVEMENT">Penghargaan</option></select><select required className="w-full border p-2 rounded" value={newIncCatId} onChange={e => setNewIncCatId(e.target.value)}><option value="">-- Pilih Kategori --</option>{categories.filter(c => c.targetType === newIncType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input required className="w-full border p-2 rounded" placeholder="Nama Kejadian" value={newIncName} onChange={e => setNewIncName(e.target.value)} /><input type="number" className="w-full border p-2 rounded" placeholder="Poin" value={newIncPoints} onChange={e => setNewIncPoints(Number(e.target.value))} /><button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">Simpan</button></form></div></div>
      )}
    </div>
  );
};

export default PointConfiguration;
