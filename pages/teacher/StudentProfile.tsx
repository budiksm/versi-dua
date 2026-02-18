
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { 
  Student, IncidentRecord, MasterIncidentType, MasterCategory, IncidentTypeCategory, CoachingRule, Role, Teacher, ClassGroup, CounselingSession, StudentSanction, SanctionLevel, RedemptionStatus, IncidentStatus, BkCounselingStatus
} from '../../types';
import { 
  ArrowLeft, ShieldAlert, Award, History, Save, AlertTriangle, CheckCircle2, Image as ImageIcon, X, HeartHandshake, Lock, BookOpen, Gavel, AlertCircle, Ban, User, PenSquare, FileText, Check, Play, Shield, LifeBuoy, Paperclip, Link as LinkIcon, Loader2, ArrowDown, ArrowRight
} from 'lucide-react';

interface StoryStep {
  id: string;
  date: string;
  type: string;
  title: string;
  actor: string;
  description: string;
  statusLabel?: string;
  statusColor?: string;
  attachmentUrl?: string;
  scoreImpact?: number;
}

const StudentProfile: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);
  const [counselingSessions, setCounselingSessions] = useState<CounselingSession[]>([]);
  const [sanctions, setSanctions] = useState<StudentSanction[]>([]);
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);

  // UI
  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'HOMEROOM' | 'BK_COUNSELING' | 'SANCTIONS'>('INCIDENTS');
  const [formType, setFormType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  
  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [storyLine, setStoryLine] = useState<StoryStep[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(DataService.getCurrentUser());
    loadStudentData();
    const unsubscribe = DataService.subscribeToDataChanges(() => loadStudentData());
    return () => unsubscribe();
  }, [studentId]);

  const loadStudentData = () => {
    if (!studentId) return;
    const std = DataService.getStudents().find(s => s.id === studentId);
    if (std) {
        setStudent(std);
        setRecords(DataService.getRecords().filter(r => r.studentId === studentId));
        setIncidents(DataService.getIncidentTypes());
        setCategories(DataService.getCategories());
        setRules(DataService.getRules());
        setCounselingSessions(DataService.getCounselingSessions().filter(s => s.studentId === studentId));
        setSanctions(DataService.getSanctions().filter(s => s.studentId === studentId));
        setClasses(DataService.getClasses());
    }
    setIsLoading(false);
  };

  const handleOpenDetail = (item: any) => {
      // Simplified detail logic for stability
      const story: StoryStep[] = [];
      const date = item.date || item.assignedDate;
      story.push({
          id: item.id,
          date: date,
          type: 'ITEM',
          title: 'Detail Item',
          actor: item.recordedBy || item.counselorName || item.assignedBy || 'System',
          description: item.notes || '',
          statusLabel: 'Detail',
          attachmentUrl: item.proofImage || item.attachmentUrl
      });
      setStoryLine(story);
      setDetailModalOpen(true);
  };

  const handleSubmitIncident = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!student || !selectedIncident) return;
      setIsSubmitting(true);
      try {
          const incDef = incidents.find(i => i.id === selectedIncident);
          if(!incDef) return;
          
          let proofUrl = undefined;
          if (selectedFile) {
             proofUrl = await StorageService.uploadFile(selectedFile, `proofs/${Date.now()}`);
          }

          const studentClass = classes.find(c => c.id === student.classId);
          const isHomeroom = currentUser?.id === studentClass?.homeroomTeacherId;
          const status = isHomeroom ? 'APPROVED' : 'PENDING';

          const newRec: IncidentRecord = {
              id: `rec_${Date.now()}`,
              studentId: student.id,
              incidentTypeId: selectedIncident,
              date: new Date().toISOString(),
              notes,
              recordedBy: currentUser?.name || 'Unknown',
              pointSnapshot: incDef.points,
              typeSnapshot: formType,
              status,
              proofImage: proofUrl
          };
          
          await DataService.saveRecords([...DataService.getRecords(), newRec]);
          if(status === 'APPROVED' && formType === IncidentTypeCategory.VIOLATION) {
              await DataService.evaluateAndApplySanction(student.id);
          }
          
          setNotes(''); setSelectedFile(null); setImagePreview(null); setSelectedIncident(''); setSelectedCategory('');
          alert('Data tersimpan!');
      } catch (e) { alert('Gagal menyimpan.'); } finally { setIsSubmitting(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const valid = StorageService.validateFile(file);
          if(!valid.valid) { alert(valid.error); return; }
          setSelectedFile(file);
          setImagePreview(URL.createObjectURL(file));
      }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div>;
  if (!student) return <div className="p-8 text-center">Siswa tidak ditemukan</div>;

  const stats = DataService.calculateStudentPoints(student.id, records, incidents);
  const status = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const history = [...records].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="h-6 w-6" /></button>
            <div><h1 className="text-2xl font-bold">{student.name}</h1><p className="text-slate-500">{student.nis}</p></div>
            <div className={`ml-auto px-4 py-2 rounded-lg font-bold border ${status.color}`}>{status.statusLabel}</div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center"><p className="text-xs font-bold text-red-600 uppercase">Poin Pelanggaran</p><p className="text-3xl font-black text-red-700">{stats.effectiveViolationScore}</p></div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center"><p className="text-xs font-bold text-emerald-600 uppercase">Poin Prestasi</p><p className="text-3xl font-black text-emerald-700">{stats.achievementPoints}</p></div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center"><p className="text-xs font-bold text-blue-600 uppercase">Jumlah Kasus</p><p className="text-3xl font-black text-blue-700">{stats.violationCount}</p></div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><p className="text-xs font-bold text-slate-600 uppercase">Penebusan</p><p className="text-3xl font-black text-slate-700">{stats.redemptionCount}</p></div>
        </div>

        {/* TABS */}
        <div className="flex border-b overflow-x-auto">
            <button onClick={() => setActiveTab('INCIDENTS')} className={`px-6 py-3 font-bold border-b-2 ${activeTab === 'INCIDENTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Pelanggaran & Prestasi</button>
            <button onClick={() => setActiveTab('HOMEROOM')} className={`px-6 py-3 font-bold border-b-2 ${activeTab === 'HOMEROOM' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500'}`}>Wali Kelas</button>
            <button onClick={() => setActiveTab('BK_COUNSELING')} className={`px-6 py-3 font-bold border-b-2 ${activeTab === 'BK_COUNSELING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>Bimbingan Konseling</button>
            <button onClick={() => setActiveTab('SANCTIONS')} className={`px-6 py-3 font-bold border-b-2 ${activeTab === 'SANCTIONS' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500'}`}>Sanksi</button>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {activeTab === 'INCIDENTS' && (
                <>
                    <div className="lg:col-span-2">
                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><PenSquare className="h-5 w-5" /> Input Kejadian</h3>
                            <form onSubmit={handleSubmitIncident} className="space-y-4">
                                <div className="flex gap-2"><button type="button" onClick={() => setFormType(IncidentTypeCategory.VIOLATION)} className={`flex-1 py-2 rounded border ${formType === IncidentTypeCategory.VIOLATION ? 'bg-red-50 border-red-200 text-red-700 font-bold' : 'bg-white'}`}>Pelanggaran</button><button type="button" onClick={() => setFormType(IncidentTypeCategory.ACHIEVEMENT)} className={`flex-1 py-2 rounded border ${formType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'bg-white'}`}>Prestasi</button></div>
                                <select className="w-full p-2 border rounded" value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedIncident(''); }}><option value="">Pilih Kategori</option>{categories.filter(c => c.targetType === formType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                <select className="w-full p-2 border rounded" value={selectedIncident} onChange={e => setSelectedIncident(e.target.value)} disabled={!selectedCategory}><option value="">Pilih Kejadian</option>{incidents.filter(i => i.categoryId === selectedCategory && i.type === formType).map(i => <option key={i.id} value={i.id}>{i.name} ({i.points} Poin)</option>)}</select>
                                <textarea className="w-full p-2 border rounded" rows={3} placeholder="Catatan..." value={notes} onChange={e => setNotes(e.target.value)} />
                                <input type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700" />
                                {imagePreview && <img src={imagePreview} className="h-32 object-contain border rounded" />}
                                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 disabled:bg-slate-300">Simpan Data</button>
                            </form>
                        </div>
                    </div>
                    <div className="lg:col-span-1 space-y-4">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><History className="h-5 w-5" /> Riwayat ({history.length})</h3>
                        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                            {history.length === 0 ? <p className="text-slate-400 italic">Belum ada riwayat.</p> : history.map(rec => {
                                const incName = incidents.find(i => i.id === rec.incidentTypeId)?.name || 'Unknown';
                                return (
                                    <div key={rec.id} onClick={() => handleOpenDetail(rec)} className="p-3 bg-white border rounded shadow-sm hover:bg-slate-50 cursor-pointer">
                                        <div className="font-bold text-sm text-slate-800">{incName}</div>
                                        <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{new Date(rec.date).toLocaleDateString()}</span><span className={`font-bold ${rec.typeSnapshot === 'VIOLATION' ? 'text-red-600' : 'text-emerald-600'}`}>{rec.pointSnapshot} Poin</span></div>
                                        {rec.status === 'PENDING' && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded">PENDING</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
            
            {/* OTHER TABS PLACEHOLDER FOR SAFETY */}
            {activeTab !== 'INCIDENTS' && (
                <div className="col-span-3 p-8 text-center text-slate-500 border rounded-xl bg-slate-50">
                    <p>Fitur {activeTab} aktif. Silakan gunakan dashboard Kesiswaan/BK untuk manajemen mendalam.</p>
                </div>
            )}
        </div>

        {detailModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-lg p-6">
                    <h2 className="font-bold text-lg mb-4">Detail Riwayat</h2>
                    <div className="space-y-4">
                        {storyLine.map((s, i) => (
                            <div key={i} className="border-l-2 border-slate-200 pl-4 pb-4">
                                <p className="font-bold text-sm">{s.title}</p>
                                <p className="text-xs text-slate-500">{new Date(s.date).toLocaleString()} • {s.actor}</p>
                                <p className="text-sm mt-1">{s.description}</p>
                                {s.attachmentUrl && <img src={s.attachmentUrl} className="mt-2 h-32 border rounded" />}
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setDetailModalOpen(false)} className="mt-4 w-full py-2 bg-slate-200 font-bold rounded">Tutup</button>
                </div>
            </div>
        )}
    </div>
  );
};

export default StudentProfile;
