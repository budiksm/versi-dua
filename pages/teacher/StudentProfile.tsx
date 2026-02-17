
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { 
  Student, 
  IncidentRecord, 
  MasterIncidentType, 
  MasterCategory, 
  IncidentTypeCategory, 
  CoachingRule,
  Role,
  Teacher,
  ClassGroup,
  CounselingSession,
  StudentSanction,
  SanctionLevel,
  RedemptionStatus,
  IncidentStatus
} from '../../types';
import { 
  ArrowLeft, 
  ShieldAlert, 
  Award, 
  History, 
  Save, 
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  X,
  HeartHandshake,
  Lock,
  BookOpen,
  ClipboardList,
  Gavel,
  BarChart3,
  Clock,
  AlertCircle,
  Ban,
  User,
  PenSquare,
  FileText,
  Calendar,
  Check,
  Play,
  Shield,
  LifeBuoy,
  MessageCircle,
  Users,
  Paperclip,
  Eye,
  Link as LinkIcon,
  Loader2,
  CloudUpload
} from 'lucide-react';

interface StoryStep {
  id: string;
  date: string;
  type: 'INCIDENT' | 'APPROVAL' | 'COUNSELING_WALAS' | 'COUNSELING_BK' | 'SANCTION';
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
  
  // --- STATE DATA ---
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [counselingSessions, setCounselingSessions] = useState<CounselingSession[]>([]);
  const [sanctions, setSanctions] = useState<StudentSanction[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); 
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);

  // --- STATE UI ---
  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'HOMEROOM' | 'BK_COUNSELING' | 'SANCTIONS'>('INCIDENTS');
  const [isSubmitting, setIsSubmitting] = useState(false); // PENGUNCI LAYAR
  const [successMsg, setSuccessMsg] = useState('');

  // --- STATE FORM PELANGGARAN ---
  const [formType, setFormType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [imageProof, setImageProof] = useState<string | null>(null);

  useEffect(() => {
    const user = DataService.getCurrentUser();
    setCurrentUser(user);
    loadStudentData();
  }, [studentId, refreshKey]);

  const loadStudentData = () => {
    setIsLoading(true);
    if (!studentId) { setIsLoading(false); return; }
    
    const foundStudent = DataService.getStudents().find((s: any) => s.id === studentId);
    if (foundStudent) {
        setStudent(foundStudent);
        setRecords(DataService.getRecords().filter((r: any) => r.studentId === studentId));
        setCategories(DataService.getCategories());
        setIncidents(DataService.getIncidentTypes());
        setRules(DataService.getRules());
        setClasses(DataService.getClasses());
        setCounselingSessions(DataService.getCounselingSessions().filter((s: any) => s.studentId === studentId).sort((a:any,b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setSanctions(DataService.getSanctions().filter((s: any) => s.studentId === studentId).sort((a:any,b:any) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()));
    }
    setIsLoading(false);
  };

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !selectedCategory || !student) return;
    
    // 1. AKTIFKAN PENGUNCI LAYAR
    setIsSubmitting(true);
    
    try {
        const incidentDef = incidents.find(i => i.id === selectedIncident);
        if (!incidentDef) throw new Error("Kejadian tidak ditemukan");

        const initialStatus: IncidentStatus = isReporterHomeroom ? 'APPROVED' : 'PENDING';
        const newRecord: IncidentRecord = {
          id: `rec_${Date.now()}`, 
          studentId: student.id, 
          incidentTypeId: selectedIncident,
          date: new Date().toISOString(), 
          notes: notes, 
          recordedBy: currentUser?.name || 'Unknown', 
          pointSnapshot: incidentDef.points,
          typeSnapshot: incidentDef.type, 
          status: initialStatus
        };

        // 2. TUNGGU RESPON DARI GOOGLE CLOUD
        await DataService.saveRecords([...DataService.getRecords(), newRecord]);
        
        // Cek jika butuh sanksi otomatis
        if (incidentDef.type === IncidentTypeCategory.VIOLATION && initialStatus === 'APPROVED') {
            await DataService.evaluateAndApplySanction(student.id);
        }

        // 3. JIKA BERHASIL: BERI NOTIFIKASI & RESET FORM
        setSuccessMsg(`Berhasil! Data tersimpan di Cloud.`);
        setNotes('');
        setSelectedIncident('');
        setSelectedCategory('');
        setRefreshKey(prev => prev + 1);
        setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
        alert("Gagal sinkronisasi. Periksa internet Anda.");
    } finally {
        // 4. BUKA KUNCI LAYAR
        setIsSubmitting(false);
    }
  };

  // --- HELPERS ---
  const stats = DataService.calculateStudentPoints(student?.id || '', records, incidents);
  const recommendedStatus = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const activeSanction = sanctions.find(s => s.redemptionStatus !== RedemptionStatus.COMPLETED);
  const studentClass = classes.find(c => c.id === student?.classId);
  const isReporterHomeroom = currentUser?.id === studentClass?.homeroomTeacherId;
  const isKesiswaan = currentUser?.roles.includes(Role.KESISWAAN);

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" /><p>Memuat profil...</p></div>;
  if (!student) return <div className="p-8 text-center"><h2 className="text-xl font-bold">Siswa Tidak Ditemukan</h2></div>;

  return (
    <div className="space-y-8 pb-12 animate-fade-in relative">
      
      {/* OVERLAY LOADING (PENGUNCI LAYAR) */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800 animate-bounce-slow">
                <CloudUpload className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Sinkronisasi Cloud...</h3>
                <p className="text-sm text-slate-500 mt-2">Sedang memastikan data aman di server Google.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 self-start"><ArrowLeft className="h-6 w-6" /></button>
        <div><h1 className="text-3xl font-bold text-slate-900">{student.name}</h1><p className="text-slate-500">NIS: {student.nis} • Kelas {studentClass?.name || '-'}</p></div>
        <div className={`md:ml-auto px-4 py-2 rounded-lg border font-bold text-sm flex items-center gap-2 ${activeSanction ? 'bg-red-600 text-white border-red-700' : recommendedStatus.color}`}><AlertTriangle className="h-4 w-4" />{activeSanction ? `Sanksi Aktif: ${activeSanction.level}` : `Status: ${recommendedStatus.statusLabel}`}</div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200"><p className="text-sm font-medium text-slate-500">Poin Pelanggaran</p><div className="mt-2 flex items-baseline gap-2"><span className={`text-4xl font-bold ${stats.effectiveViolationScore > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.effectiveViolationScore}</span><span className="text-sm text-slate-400">Poin</span></div></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200"><p className="text-sm font-medium text-slate-500">Poin Penghargaan</p><div className="mt-2 flex items-baseline gap-2"><span className="text-4xl font-bold text-emerald-600">{stats.achievementPoints}</span><span className="text-sm text-slate-400">Poin</span></div></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-center"><div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-slate-500">Pelanggaran</span><span className="font-bold text-red-600">{stats.violationCount}x</span></div><div className="flex justify-between text-sm"><span className="text-slate-500">Penghargaan</span><span className="font-bold text-emerald-600">{stats.achievementCount}x</span></div></div></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200"><p className="text-sm font-medium text-slate-500">Status Sanksi</p><div className="mt-2">{activeSanction ? <span className="text-2xl font-bold text-red-600">{activeSanction.level}</span> : <span className="text-2xl font-bold text-emerald-600">Aman</span>}</div></div>
      </div>

      {/* TABS & FORM */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b bg-slate-50"><h2 className="font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-600" /> Input Kejadian Baru</h2></div>
          <form onSubmit={handleSubmitIncident} className="p-6 space-y-4">
            <div className="flex p-1 bg-slate-100 rounded-lg"><button type="button" onClick={() => { setFormType(IncidentTypeCategory.VIOLATION); setSelectedCategory(''); setSelectedIncident(''); }} className={`flex-1 py-2 rounded-md text-sm font-bold ${formType === IncidentTypeCategory.VIOLATION ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>Pelanggaran</button><button type="button" onClick={() => { setFormType(IncidentTypeCategory.ACHIEVEMENT); setSelectedCategory(''); setSelectedIncident(''); }} className={`flex-1 py-2 rounded-md text-sm font-bold ${formType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Penghargaan</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select required value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedIncident(''); }} className="p-3 border rounded-lg bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"><option value="">-- Pilih Kategori --</option>{categories.filter(c => c.targetType === formType).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select>
                <select required value={selectedIncident} onChange={(e) => setSelectedIncident(e.target.value)} className="p-3 border rounded-lg bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" disabled={!selectedCategory}><option value="">-- Pilih Kejadian --</option>{incidents.filter(i => i.categoryId === selectedCategory).map(inc => <option key={inc.id} value={inc.id}>{inc.name} ({inc.points} Pt)</option>)}</select>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full p-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tambahkan catatan khusus jika ada..."></textarea>
            
            {successMsg && <p className="text-emerald-600 text-sm font-bold animate-pulse">{successMsg}</p>}
            
            <button type="submit" disabled={!selectedIncident || isSubmitting} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-indigo-700 disabled:bg-slate-300 flex items-center justify-center gap-2 transition-all"><Save className="h-5 w-5" /> Simpan Kejadian</button>
          </form>
      </div>

      {/* RIWAYAT */}
      <div className="space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><History className="h-5 w-5" /> Riwayat Siswa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => (
                  <div key={r.id} className="p-4 bg-white border border-slate-200 rounded-xl flex justify-between items-start">
                      <div>
                          <p className="font-bold text-slate-800">{incidents.find(i => i.id === r.incidentTypeId)?.name}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(r.date).toLocaleDateString()} • Oleh: {r.recordedBy}</p>
                          <p className="text-xs text-slate-600 mt-2 italic">"{r.notes || '-'}"</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${r.typeSnapshot === 'VIOLATION' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {r.typeSnapshot === 'VIOLATION' ? '+' : '-'}{r.pointSnapshot} Pt
                      </span>
                  </div>
              ))}
              {records.length === 0 && <div className="col-span-2 p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">Belum ada riwayat kejadian.</div>}
          </div>
      </div>
    </div>
  );
};

export default StudentProfile;
