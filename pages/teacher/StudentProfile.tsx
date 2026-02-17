
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

  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'HOMEROOM' | 'BK_COUNSELING' | 'SANCTIONS'>('INCIDENTS');
  const [bkMode, setBkMode] = useState<'CASE' | 'PREVENTIVE'>('CASE');
  const [homeroomMode, setHomeroomMode] = useState<'CASE' | 'PREVENTIVE'>('CASE');

  const [formType, setFormType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [imageProof, setImageProof] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  
  const [counselingNotes, setCounselingNotes] = useState('');
  const [counselingRec, setCounselingRec] = useState<'NONE' | 'PARENT_CALL' | 'TO_KESISWAAN' | 'SUSPENSION_REVIEW' | 'TO_BK'>('NONE');
  const [selectedCounselingRecords, setSelectedCounselingRecords] = useState<string[]>([]);

  const [sanctionLevel, setSanctionLevel] = useState<SanctionLevel>(SanctionLevel.SP1);
  const [sanctionNotes, setSanctionNotes] = useState('');
  const [sanctionRedemptionTask, setSanctionRedemptionTask] = useState('');
  const [editingSanctionId, setEditingSanctionId] = useState<string | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [storyLine, setStoryLine] = useState<StoryStep[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleOpenDetail = (item: any) => {
      const story: StoryStep[] = [];
      let relatedIncidentIds: string[] = [];
      
      if ('incidentTypeId' in item) relatedIncidentIds = [item.id];
      else if ('sessionType' in item) relatedIncidentIds = item.relatedRecordIds || [];

      const relatedIncidents = records.filter(r => relatedIncidentIds.includes(r.id));
      relatedIncidents.forEach(inc => {
          const incName = incidents.find(i => i.id === inc.incidentTypeId)?.name || 'Unknown';
          story.push({
              id: inc.id, date: inc.date, type: 'INCIDENT', title: 'Pencatatan Pelanggaran',
              actor: `Guru: ${inc.recordedBy}`, description: `${incName}. ${inc.notes}`,
              statusLabel: inc.status === 'PENDING' ? 'Menunggu Verifikasi' : 'Terverifikasi',
              statusColor: inc.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700',
              attachmentUrl: inc.proofImage, scoreImpact: inc.pointSnapshot
          });
          if (inc.status === 'APPROVED') {
              story.push({
                  id: `${inc.id}_approve`, date: inc.date, type: 'APPROVAL', title: 'Persetujuan Wali Kelas',
                  actor: 'Wali Kelas', description: 'Laporan diverifikasi valid dan poin dicatat.',
                  statusLabel: 'Aktif', statusColor: 'bg-green-100 text-green-700'
              });
          }
      });

      const relevantSessions = counselingSessions.filter(s => s.relatedRecordIds?.some(id => relatedIncidentIds.includes(id)) || ('id' in item && item.id === s.id));
      relevantSessions.forEach(sess => {
          story.push({
              id: sess.id, date: sess.date, type: sess.sessionType === 'BK' ? 'COUNSELING_BK' : 'COUNSELING_WALAS',
              title: sess.sessionType === 'BK' ? 'Konseling BK' : 'Pembinaan Wali Kelas',
              actor: `${sess.sessionType === 'BK' ? 'Guru BK' : 'Wali Kelas'}: ${sess.counselorName}`,
              description: sess.notes, statusLabel: sess.recommendation !== 'NONE' ? translateRecommendation(sess.recommendation) : 'Selesai',
              statusColor: 'bg-blue-100 text-blue-700'
          });
      });

      story.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setStoryLine(story);
      setDetailModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            setImageProof(canvas.toDataURL('image/jpeg', 0.6));
            setIsCompressing(false);
          };
        };
      } catch (error) { alert("Gagal memproses gambar."); setIsCompressing(false); }
    }
  };

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !selectedCategory || !student) return;
    
    setIsSubmitting(true);
    try {
        const incidentDef = incidents.find(i => i.id === selectedIncident);
        if (!incidentDef) throw new Error("Incident not found");

        const initialStatus: IncidentStatus = isReporterHomeroom ? 'APPROVED' : 'PENDING';
        const newRecord: IncidentRecord = {
          id: `rec_${Date.now()}`, studentId: student.id, incidentTypeId: selectedIncident,
          date: new Date().toISOString(), notes: notes, proofImage: imageProof || undefined,
          recordedBy: currentUser?.name || 'Unknown', pointSnapshot: incidentDef.points,
          typeSnapshot: incidentDef.type, status: initialStatus
        };

        if (initialStatus === 'APPROVED' && newRecord.pointSnapshot >= 40 && newRecord.typeSnapshot === IncidentTypeCategory.VIOLATION) {
            newRecord.bkStatus = 'REQUIRED';
        }

        await DataService.saveRecords([...DataService.getRecords(), newRecord]);
        if (incidentDef.type === IncidentTypeCategory.VIOLATION && initialStatus === 'APPROVED') {
            await DataService.evaluateAndApplySanction(student.id);
        }

        setSuccessMsg(`Data berhasil disimpan ke Cloud.`);
        setNotes('');
        setImageProof(null);
        setSelectedIncident('');
        setSelectedCategory('');
        setRefreshKey(prev => prev + 1);
        setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
        alert("Gagal sinkronisasi data. Silakan coba lagi.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSubmitCounseling = async (e: React.FormEvent, type: 'BK' | 'HOMEROOM') => {
    e.preventDefault();
    if (!student) return;
    setIsSubmitting(true);
    try {
        const newSession: CounselingSession = {
          id: `coun_${Date.now()}`, studentId: student.id, counselorId: currentUser?.id || '',
          counselorName: currentUser?.name || 'Unknown', date: new Date().toISOString(),
          notes: counselingNotes, recommendation: counselingRec, status: counselingRec !== 'NONE' ? 'OPEN' : 'CLOSED',
          sessionType: type, relatedRecordIds: (type === 'BK' ? (bkMode === 'CASE' ? selectedCounselingRecords : []) : (homeroomMode === 'CASE' ? selectedCounselingRecords : []))
        };
        await DataService.saveCounselingSessions([...DataService.getCounselingSessions(), newSession]);
        setSuccessMsg('Catatan konseling aman di Cloud!');
        setCounselingNotes('');
        setCounselingRec('NONE');
        setSelectedCounselingRecords([]);
        setRefreshKey(prev => prev + 1);
        setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
        alert("Gagal menyimpan ke Cloud. Periksa koneksi internet.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAssignSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!isKesiswaan || !student) return;
    setIsSubmitting(true);
    try {
        const allSanctions = DataService.getSanctions();
        if (editingSanctionId) {
            const updated = allSanctions.map(s => s.id === editingSanctionId ? { ...s, level: sanctionLevel, notes: sanctionNotes, redemptionStatus: sanctionRedemptionTask ? RedemptionStatus.ASSIGNED : s.redemptionStatus, redemptionTask: sanctionRedemptionTask } : s);
            await DataService.saveSanctions(updated);
        } else {
            const newSanction: StudentSanction = {
              id: `san_${Date.now()}`, studentId: student.id, level: sanctionLevel,
              assignedBy: currentUser?.name || 'Kesiswaan', assignedDate: new Date().toISOString(),
              notes: sanctionNotes, redemptionStatus: sanctionRedemptionTask ? RedemptionStatus.ASSIGNED : RedemptionStatus.NONE,
              redemptionTask: sanctionRedemptionTask, isRedeemed: false
            };
            await DataService.saveSanctions([...allSanctions, newSanction]);
        }
        setSuccessMsg('Status sanksi berhasil diupdate!');
        setSanctionNotes('');
        setSanctionRedemptionTask('');
        setEditingSanctionId(null);
        setRefreshKey(prev => prev + 1);
        setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) { alert("Gagal update Cloud."); }
    finally { setIsSubmitting(false); }
  };

  const updateRedemptionStatus = async (sanctionId: string, status: RedemptionStatus) => {
    setIsSubmitting(true);
    try {
        const updated = DataService.getSanctions().map(s => s.id === sanctionId ? { ...s, redemptionStatus: status, redemptionDate: status === RedemptionStatus.COMPLETED ? new Date().toISOString() : s.redemptionDate, isRedeemed: status === RedemptionStatus.COMPLETED } : s);
        await DataService.saveSanctions(updated);
        setRefreshKey(prev => prev + 1);
        setSuccessMsg('Progress penebusan disimpan.');
    } catch (e) { alert("Gagal update status."); }
    finally { setIsSubmitting(false); }
  };

  const translateRecommendation = (rec: string) => {
    switch(rec) {
      case 'PARENT_CALL': return 'Panggilan Orang Tua';
      case 'TO_KESISWAAN': return 'Rujuk ke Kesiswaan';
      case 'SUSPENSION_REVIEW': return 'Tinjauan Skorsing';
      case 'TO_BK': return 'Rujuk ke BK';
      default: return '-';
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" /><p>Memuat profil...</p></div>;
  if (!student) return <div className="p-8 text-center"><h2 className="text-xl font-bold">Siswa Tidak Ditemukan</h2></div>;

  const stats = DataService.calculateStudentPoints(student.id, records, incidents);
  const recommendedStatus = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const activeSanction = sanctions.find(s => s.redemptionStatus !== RedemptionStatus.COMPLETED);
  const studentClass = classes.find(c => c.id === student.classId);
  const isReporterHomeroom = currentUser?.id === studentClass?.homeroomTeacherId;
  const isKesiswaan = currentUser?.roles.includes(Role.KESISWAAN);

  return (
    <div className="space-y-8 pb-12 animate-fade-in relative">
      
      {/* REAL-SYNC LOADING OVERLAY */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white">
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

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 self-start"><ArrowLeft className="h-6 w-6" /></button>
        <div><h1 className="text-3xl font-bold text-slate-900">{student.name}</h1><p className="text-slate-500">NIS: {student.nis} • Kelas {studentClass?.name || '-'}</p></div>
        <div className={`md:ml-auto px-4 py-2 rounded-lg border font-bold text-sm flex items-center gap-2 ${activeSanction ? 'bg-red-600 text-white border-red-700' : recommendedStatus.color}`}><AlertTriangle className="h-4 w-4" />{activeSanction ? `Sanksi Aktif: ${activeSanction.level}` : `Status: ${recommendedStatus.statusLabel}`}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200"><p className="text-sm font-medium text-slate-500">Poin Pelanggaran</p><div className="mt-2 flex items-baseline gap-2"><span className={`text-4xl font-bold ${stats.effectiveViolationScore > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.effectiveViolationScore}</span><span className="text-sm text-slate-400">Poin</span></div></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200"><p className="text-sm font-medium text-slate-500">Poin Penghargaan</p><div className="mt-2 flex items-baseline gap-2"><span className="text-4xl font-bold text-emerald-600">{stats.achievementPoints}</span><span className="text-sm text-slate-400">Poin</span></div></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200"><p className="text-sm font-medium text-slate-500">Status Sanksi</p><div className="mt-2">{activeSanction ? <span className="text-2xl font-bold text-red-600">{activeSanction.level}</span> : <span className="text-2xl font-bold text-emerald-600">Aman</span>}</div></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-center"><div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-slate-500">Pelanggaran</span><span className="font-bold text-red-600">{stats.violationCount}x</span></div><div className="flex justify-between text-sm"><span className="text-slate-500">Penghargaan</span><span className="font-bold text-emerald-600">{stats.achievementCount}x</span></div></div></div>
      </div>

      <div className="border-b border-slate-200">
         <nav className="-mb-px flex gap-6 overflow-x-auto">
            <button onClick={() => setActiveTab('INCIDENTS')} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'INCIDENTS' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:border-slate-300'}`}><ClipboardList className="h-4 w-4 inline mr-2" /> Catatan Kejadian</button>
            {isReporterHomeroom && <button onClick={() => setActiveTab('HOMEROOM')} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'HOMEROOM' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500'}`}><User className="h-4 w-4 inline mr-2" /> Pembinaan Wali Kelas</button>}
            {(currentUser?.roles.includes(Role.BK) || isKesiswaan) && <button onClick={() => setActiveTab('BK_COUNSELING')} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'BK_COUNSELING' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}><HeartHandshake className="h-4 w-4 inline mr-2" /> BK</button>}
            {isKesiswaan && <button onClick={() => setActiveTab('SANCTIONS')} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'SANCTIONS' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500'}`}><Gavel className="h-4 w-4 inline mr-2" /> Sanksi</button>}
         </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'INCIDENTS' && (
           <>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b bg-slate-50"><h2 className="font-bold text-slate-800">Input Kejadian Baru</h2></div>
                    <form onSubmit={handleSubmitIncident} className="p-6 space-y-4">
                      <div className="flex p-1 bg-slate-100 rounded-lg"><button type="button" onClick={() => setFormType(IncidentTypeCategory.VIOLATION)} className={`flex-1 py-2 rounded-md text-sm font-medium ${formType === IncidentTypeCategory.VIOLATION ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>Pelanggaran</button><button type="button" onClick={() => setFormType(IncidentTypeCategory.ACHIEVEMENT)} className={`flex-1 py-2 rounded-md text-sm font-medium ${formType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Penghargaan</button></div>
                      <div className="grid grid-cols-2 gap-4">
                          <select required value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="p-3 border rounded-lg bg-white"><option value="">-- Pilih Kategori --</option>{categories.filter(c => c.targetType === formType).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select>
                          <select required value={selectedIncident} onChange={(e) => setSelectedIncident(e.target.value)} className="p-3 border rounded-lg bg-white"><option value="">-- Pilih Kejadian --</option>{incidents.filter(i => i.categoryId === selectedCategory).map(inc => <option key={inc.id} value={inc.id}>{inc.name} ({inc.points} Pt)</option>)}</select>
                      </div>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full p-3 border rounded-lg" placeholder="Catatan tambahan..."></textarea>
                      <button type="submit" disabled={!selectedIncident} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-indigo-700 disabled:bg-slate-300 flex items-center justify-center gap-2"><Save className="h-5 w-5" /> Simpan Kejadian</button>
                    </form>
                </div>
              </div>
              <div className="space-y-4"><h3 className="font-bold text-lg">Riwayat</h3>{records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => (<div key={r.id} onClick={() => handleOpenDetail(r)} className="p-4 bg-white border rounded-xl hover:shadow-md cursor-pointer"><div className="flex justify-between font-bold text-sm"><span>{incidents.find(i => i.id === r.incidentTypeId)?.name}</span><span className={r.typeSnapshot === 'VIOLATION' ? 'text-red-600' : 'text-emerald-600'}>{r.pointSnapshot} Pt</span></div><p className="text-xs text-slate-500 mt-1">{new Date(r.date).toLocaleDateString()} • {r.recordedBy}</p></div>))}</div>
           </>
        )}
      </div>

      {detailModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-slate-900 text-white p-5 flex justify-between items-center"><h2 className="font-bold">Riwayat Kasus Terpadu</h2><button onClick={() => setDetailModalOpen(false)}><X className="h-6 w-6" /></button></div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50"><div className="space-y-6">{storyLine.map(step => (<div key={step.id} className="flex gap-4"><div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 shadow-sm"><FileText className="h-5 w-5 text-indigo-600" /></div><div className="flex-1 bg-white p-4 rounded-xl border border-slate-200"><h4 className="font-bold text-slate-800">{step.title}</h4><p className="text-xs text-slate-500">{new Date(step.date).toLocaleDateString()} • {step.actor}</p><p className="mt-3 text-sm text-slate-700 italic">"{step.description}"</p></div></div>))}</div></div>
                    <div className="p-4 border-t flex justify-end"><button onClick={() => setDetailModalOpen(false)} className="px-6 py-2 bg-slate-200 font-bold rounded-lg">Tutup</button></div>
                </div>
            </div>
      )}
    </div>
  );
};

export default StudentProfile;
