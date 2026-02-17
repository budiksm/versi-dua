
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { 
  Student, IncidentRecord, MasterIncidentType, MasterCategory, 
  IncidentTypeCategory, CoachingRule, Role, Teacher, ClassGroup, 
  CounselingSession, StudentSanction, SanctionLevel, RedemptionStatus, IncidentStatus
} from '../../types';
import { 
  ArrowLeft, ShieldAlert, Award, History, Save, AlertTriangle, CheckCircle2, 
  Image as ImageIcon, X, HeartHandshake, Lock, BookOpen, ClipboardList, 
  Gavel, BarChart3, Clock, AlertCircle, Ban, User, PenSquare, FileText, 
  Calendar, Check, Play, Shield, LifeBuoy, MessageCircle, Users, Paperclip, 
  Eye, Link as LinkIcon, Loader2, Cloud, Zap
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

  // UI State
  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'HOMEROOM' | 'BK_COUNSELING' | 'SANCTIONS'>('INCIDENTS');
  const [bkMode, setBkMode] = useState<'CASE' | 'PREVENTIVE'>('CASE');
  const [homeroomMode, setHomeroomMode] = useState<'CASE' | 'PREVENTIVE'>('CASE');

  // Form State
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
    if (!studentId) return;
    const foundStudent = DataService.getStudents().find(s => s.id === studentId);
    if (foundStudent) {
      setStudent(foundStudent);
      setRecords(DataService.getRecords().filter(r => r.studentId === studentId));
      setCategories(DataService.getCategories());
      setIncidents(DataService.getIncidentTypes());
      setRules(DataService.getRules());
      setClasses(DataService.getClasses());
      setCounselingSessions(DataService.getCounselingSessions().filter(s => s.studentId === studentId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setSanctions(DataService.getSanctions().filter(s => s.studentId === studentId).sort((a,b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()));
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

      const relevantSessions = counselingSessions.filter(s => 
          s.relatedRecordIds?.some(id => relatedIncidentIds.includes(id)) || ('id' in item && item.id === s.id)
      );
      relevantSessions.forEach(sess => {
          story.push({
              id: sess.id, date: sess.date, type: sess.sessionType === 'BK' ? 'COUNSELING_BK' : 'COUNSELING_WALAS',
              title: sess.sessionType === 'BK' ? 'Konseling BK' : 'Pembinaan Wali Kelas',
              actor: `${sess.sessionType === 'BK' ? 'Guru BK' : 'Wali Kelas'}: ${sess.counselorName}`,
              description: sess.notes, statusLabel: sess.recommendation !== 'NONE' ? translateRecommendation(sess.recommendation) : 'Selesai',
              statusColor: 'bg-blue-100 text-blue-700'
          });
      });

      if ('level' in item) {
          const s = item as StudentSanction;
          story.push({
              id: s.id, date: s.assignedDate, type: 'SANCTION', title: 'Tindakan Kesiswaan',
              actor: `Kesiswaan (${s.assignedBy})`, description: `Diterbitkan ${s.level}. Alasan: ${s.notes}`,
              statusLabel: s.redemptionStatus === 'COMPLETED' ? 'Sanksi Selesai' : 'Sanksi Aktif',
              statusColor: 'bg-red-100 text-red-700'
          });
      }

      story.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (story.length === 0 && 'sessionType' in item) {
          const sess = item as CounselingSession;
           story.push({
              id: sess.id, date: sess.date, type: sess.sessionType === 'BK' ? 'COUNSELING_BK' : 'COUNSELING_WALAS',
              title: sess.sessionType === 'BK' ? 'Konseling Preventif BK' : 'Pembinaan Preventif',
              actor: sess.counselorName, description: sess.notes, statusLabel: 'Preventif', statusColor: 'bg-blue-50 text-blue-600'
          });
      }
      setStoryLine(story);
      setDetailModalOpen(true);
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

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !student) return;
    setIsSubmitting(true);
    try {
        const incidentDef = incidents.find(i => i.id === selectedIncident);
        if (!incidentDef) return;
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
        setSuccessMsg(`Data berhasil disimpan`);
        setNotes(''); setImageProof(null); setSelectedIncident(''); setSelectedCategory('');
        setRefreshKey(k => k + 1);
        setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) { alert("Gagal sinkronisasi."); } finally { setIsSubmitting(false); }
  };

  const handleSubmitCounseling = async (e: React.FormEvent, type: 'BK' | 'HOMEROOM') => {
    e.preventDefault();
    if (!student) return;
    setIsSubmitting(true);
    try {
        let finalRelatedRecords: string[] = [];
        if (type === 'BK') finalRelatedRecords = (bkMode === 'CASE') ? selectedCounselingRecords : [];
        else if (type === 'HOMEROOM') finalRelatedRecords = (homeroomMode === 'CASE') ? selectedCounselingRecords : [];

        const newSession: CounselingSession = {
          id: `coun_${Date.now()}`, studentId: student.id, counselorId: currentUser?.id || '',
          counselorName: currentUser?.name || 'Unknown', date: new Date().toISOString(),
          notes: counselingNotes, recommendation: counselingRec, status: 'CLOSED',
          sessionType: type, relatedRecordIds: finalRelatedRecords
        };
        if (counselingRec !== 'NONE') newSession.status = 'OPEN';
        await DataService.saveCounselingSessions([...DataService.getCounselingSessions(), newSession]);
        setSuccessMsg('Catatan konseling disimpan!');
        setCounselingNotes(''); setCounselingRec('NONE'); setSelectedCounselingRecords([]);
        setRefreshKey(k => k + 1);
        setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { alert("Gagal simpan."); } finally { setIsSubmitting(false); }
  };

  const handleAssignSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!student) return;
    setIsSubmitting(true);
    try {
        const allSanctions = DataService.getSanctions();
        if (editingSanctionId) {
            const updated = allSanctions.map(s => s.id === editingSanctionId ? {
                ...s, level: sanctionLevel, notes: sanctionNotes,
                redemptionStatus: sanctionRedemptionTask ? RedemptionStatus.ASSIGNED : s.redemptionStatus,
                redemptionTask: sanctionRedemptionTask, assignedBy: `${s.assignedBy} & ${currentUser?.name}`
            } : s);
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
        setSanctionNotes(''); setSanctionRedemptionTask(''); setEditingSanctionId(null);
        setRefreshKey(k => k + 1);
    } catch (err) { alert("Gagal simpan sanksi."); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-indigo-600" /></div>;
  if (!student) return <div className="p-8 text-center font-bold">Siswa Tidak Ditemukan.</div>;

  const stats = DataService.calculateStudentPoints(student.id, records, incidents);
  const recommendedStatus = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const studentClass = classes.find(c => c.id === student.classId);
  const isReporterHomeroom = currentUser?.id === studentClass?.homeroomTeacherId;
  const isBK = currentUser?.roles.includes(Role.BK);
  const isKesiswaan = currentUser?.roles.includes(Role.KESISWAAN);
  const showBkTab = isBK || (isKesiswaan && stats.effectiveViolationScore >= 40);
  
  const history = [...records].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const activeSanction = sanctions.find(s => s.redemptionStatus !== RedemptionStatus.COMPLETED);
  const homeroomViolationRecords = records.filter(r => r.typeSnapshot === 'VIOLATION' && r.status === 'APPROVED' && r.bkStatus !== 'COMPLETED');
  const activeViolationRecordsForForm = records.filter(r => r.typeSnapshot === 'VIOLATION' && r.bkStatus !== 'COMPLETED');

  return (
    <div className="space-y-8 pb-12 animate-fade-in relative">
      {/* SINKRONISASI CLOUD OVERLAY */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center text-slate-800 scale-110">
                <div className="relative mb-6">
                    <Cloud className="h-20 w-20 text-indigo-600 animate-pulse" />
                    <Zap className="h-8 w-8 text-amber-400 absolute -bottom-1 -right-1 animate-bounce" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">Sinkronisasi Cloud...</h3>
                <p className="text-slate-500 mt-2 font-medium">Sedang mengamankan data di server Google.</p>
                <div className="w-56 h-2 bg-slate-100 rounded-full mt-8 overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 self-start"><ArrowLeft className="h-6 w-6" /></button>
        <div>
          <h1 className="text-3xl font-black text-slate-900">{student.name}</h1>
          <p className="text-slate-500 font-bold">NIS: {student.nis} • Kelas {studentClass?.name}</p>
        </div>
        <div className={`md:ml-auto px-4 py-2 rounded-lg border font-black text-xs uppercase tracking-widest flex items-center gap-2 ${activeSanction ? 'bg-red-600 text-white border-red-700' : recommendedStatus.color}`}>
           <AlertTriangle className="h-4 w-4" />
           {activeSanction ? `Sanksi Aktif: ${activeSanction.level}` : `Status: ${recommendedStatus.statusLabel}`}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-red-300 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert className="h-16 w-16 text-red-600" /></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poin Pelanggaran</p>
          <div className="mt-2 flex items-baseline gap-2"><span className={`text-4xl font-black ${stats.effectiveViolationScore > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.effectiveViolationScore}</span><span className="text-sm text-slate-400 font-bold">Poin</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Award className="h-16 w-16 text-emerald-600" /></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poin Penghargaan</p>
          <div className="mt-2 flex items-baseline gap-2"><span className="text-4xl font-black text-emerald-600">{stats.achievementPoints}</span><span className="text-sm text-slate-400 font-bold">Poin</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-orange-300 transition-colors">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Gavel className="h-16 w-16 text-orange-600" /></div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Sanksi</p>
           <div className="mt-2">{activeSanction ? (<div><span className="text-2xl font-black text-red-600 block truncate">{activeSanction.level}</span><span className="text-[10px] font-black text-red-500 uppercase">SANKSI AKTIF</span></div>) : (<div><span className="text-2xl font-black text-emerald-600">Aman</span><p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Tidak ada sanksi aktif</p></div>)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden group hover:border-blue-300 transition-colors">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BarChart3 className="h-16 w-16 text-slate-600" /></div>
           <div className="space-y-3 relative z-10">
             <div className="flex justify-between items-center text-xs font-bold"><span className="text-slate-400 uppercase">Pelanggaran</span><span className="text-red-600">{stats.violationCount}x</span></div>
             <div className="flex justify-between items-center text-xs font-bold"><span className="text-slate-400 uppercase">Penghargaan</span><span className="text-emerald-600">{stats.achievementCount}x</span></div>
             <div className="flex justify-between items-center text-xs font-bold"><span className="text-slate-400 uppercase">Penebusan</span><span className="text-blue-600">{stats.redemptionCount}x</span></div>
           </div>
        </div>
      </div>

      <div className="flex p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto gap-1">
         <button onClick={() => setActiveTab('INCIDENTS')} className={`flex-1 min-w-[160px] py-3.5 px-6 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'INCIDENTS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><ClipboardList className="h-4 w-4" /> Kejadian</button>
         {isReporterHomeroom && (
           <button onClick={() => setActiveTab('HOMEROOM')} className={`flex-1 min-w-[160px] py-3.5 px-6 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'HOMEROOM' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><User className="h-4 w-4" /> Pembinaan Walas</button>
         )}
         {showBkTab && (
           <button onClick={() => setActiveTab('BK_COUNSELING')} className={`flex-1 min-w-[160px] py-3.5 px-6 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'BK_COUNSELING' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><HeartHandshake className="h-4 w-4" /> Konseling BK</button>
         )}
         <button onClick={() => setActiveTab('SANCTIONS')} className={`flex-1 min-w-[160px] py-3.5 px-6 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'SANCTIONS' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><Gavel className="h-4 w-4" /> Sanksi</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'INCIDENTS' && (
           <>
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-indigo-600" /> Input Kejadian Baru</h2>
                    </div>
                    <form onSubmit={handleSubmitIncident} className="p-10 space-y-8">
                        <div className="flex p-1.5 bg-slate-100 rounded-2xl max-w-md shadow-inner">
                            <button type="button" onClick={() => { setFormType(IncidentTypeCategory.VIOLATION); setSelectedCategory(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${formType === IncidentTypeCategory.VIOLATION ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>PELANGGARAN</button>
                            <button type="button" onClick={() => { setFormType(IncidentTypeCategory.ACHIEVEMENT); setSelectedCategory(''); }} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${formType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>PENGHARGAAN</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label><select required value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedIncident(''); }} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 appearance-none"><option value="">-- Pilih --</option>{categories.filter(c => c.targetType === formType).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Kejadian</label><select required disabled={!selectedCategory} value={selectedIncident} onChange={e => setSelectedIncident(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 disabled:opacity-50 appearance-none"><option value="">-- Pilih --</option>{incidents.filter(i => i.type === formType && i.categoryId === selectedCategory).map(inc => <option key={inc.id} value={inc.id}>{inc.name} ({inc.points} Pt)</option>)}</select></div>
                        </div>
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detail Kronologi</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-medium outline-none focus:border-indigo-500" placeholder="Keterangan kejadian..." /></div>
                        {successMsg && <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold flex items-center gap-3 animate-bounce shadow-inner border border-emerald-100"><CheckCircle2 className="h-5 w-5" /> {successMsg}</div>}
                        <button type="submit" disabled={isSubmitting || !selectedIncident} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black tracking-widest shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-slate-200"><Save className="h-6 w-6" /> SIMPAN LAPORAN</button>
                    </form>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-black text-lg mb-2"><History className="h-5 w-5" /> Jejak Digital Siswa</div>
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {history.length === 0 ? <div className="text-slate-500 text-sm italic">Belum ada riwayat tercatat.</div> : 
                    history.map(record => {
                      const incName = incidents.find(i => i.id === record.incidentTypeId)?.name || 'Unknown';
                      return (
                        <div key={record.id} onClick={() => handleOpenDetail(record)} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all cursor-pointer hover:border-indigo-300 hover:shadow-md group">
                           <div className="flex justify-between items-start mb-2">
                                <h4 className="font-black text-sm text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{incName}</h4>
                                <span className={`text-[10px] font-black px-2 py-1 rounded border ${record.typeSnapshot === 'VIOLATION' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{record.typeSnapshot === 'VIOLATION' ? '+' : ''}{record.pointSnapshot} Pt</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(record.date).toLocaleDateString()} • {record.recordedBy}</p>
                           {record.status === 'PENDING' && <div className="mt-3 px-2 py-1 bg-yellow-50 text-yellow-700 text-[10px] font-black rounded border border-yellow-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" /> PENDING</div>}
                        </div>
                      )
                    })
                  }
                </div>
              </div>
           </>
        )}

        {activeTab === 'HOMEROOM' && isReporterHomeroom && (
           <>
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                   <div className="p-8 border-b bg-orange-50/50 border-orange-100 flex justify-between items-center">
                     <h2 className="text-xl font-black flex items-center gap-2 text-orange-800"><User className="h-6 w-6" /> Pembinaan Wali Kelas</h2>
                   </div>
                   <div className="px-10 pt-8">
                      <div className="flex p-1.5 bg-slate-100 rounded-2xl shadow-inner">
                         <button onClick={() => setHomeroomMode('CASE')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${homeroomMode === 'CASE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}>PEMBINAAN KASUS</button>
                         <button onClick={() => setHomeroomMode('PREVENTIVE')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${homeroomMode === 'PREVENTIVE' ? 'bg-white text-yellow-600 shadow-sm' : 'text-slate-500'}`}>TINDAKAN PREVENTIF</button>
                      </div>
                   </div>
                   <form onSubmit={e => handleSubmitCounseling(e, 'HOMEROOM')} className="p-10 space-y-8">
                      {homeroomMode === 'CASE' && (
                          <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Pelanggaran Terkait</label>
                                <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl max-h-48 overflow-y-auto p-3 space-y-2">
                                    {homeroomViolationRecords.map(record => (
                                        <div key={record.id} onClick={() => setSelectedCounselingRecords(prev => prev.includes(record.id) ? prev.filter(id => id !== record.id) : [...prev, record.id])} className={`p-3 rounded-xl border-2 cursor-pointer text-xs font-bold flex items-center gap-3 transition-all ${selectedCounselingRecords.includes(record.id) ? 'bg-orange-50 border-orange-400 text-orange-900' : 'bg-white border-slate-100 hover:border-orange-200'}`}>
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selectedCounselingRecords.includes(record.id) ? 'bg-orange-600 border-orange-600' : 'bg-slate-100'}`}>{selectedCounselingRecords.includes(record.id) && <Check className="h-3 w-3 text-white" />}</div>
                                            <div className="flex-1"><p>{incidents.find(i => i.id === record.incidentTypeId)?.name}</p><p className="text-[10px] text-slate-400 mt-1">{new Date(record.date).toLocaleDateString()}</p></div>
                                        </div>
                                    ))}
                                </div>
                          </div>
                      )}
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasil Pembinaan / Solusi</label><textarea required value={counselingNotes} onChange={e => setCounselingNotes(e.target.value)} rows={6} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-medium outline-none focus:border-orange-500" placeholder="Catat komitmen siswa..." /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rekomendasi Eskalasi</label><select value={counselingRec} onChange={e => setCounselingRec(e.target.value as any)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-orange-500 appearance-none"><option value="NONE">Selesai (Pembinaan Walas)</option><option value="PARENT_CALL">Panggilan Orang Tua</option><option value="TO_BK">Rujuk ke Guru BK</option></select></div>
                      <button type="submit" disabled={isSubmitting || !counselingNotes} className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-[1.5rem] font-black tracking-widest shadow-xl shadow-orange-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-slate-200"><Save className="h-6 w-6" /> ARSIPKAN PEMBINAAN</button>
                   </form>
                </div>
             </div>
           </>
        )}

        {/* --- RIWAYAT KONSELING BK TAB (Versi User) --- */}
        {activeTab === 'BK_COUNSELING' && showBkTab && (
            <>
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-8 border-b bg-blue-50/50 border-blue-100 flex justify-between items-center">
                            <h2 className="text-xl font-black flex items-center gap-2 text-blue-800"><HeartHandshake className="h-6 w-6" /> Sesi Konseling BK</h2>
                        </div>
                        <div className="px-10 pt-8">
                            <div className="flex p-1.5 bg-slate-100 rounded-2xl shadow-inner">
                                <button onClick={() => setBkMode('CASE')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${bkMode === 'CASE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}>PENANGANAN KASUS</button>
                                <button onClick={() => setBkMode('PREVENTIVE')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${bkMode === 'PREVENTIVE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>KONSELING PRIBADI</button>
                            </div>
                        </div>
                        <form onSubmit={e => handleSubmitCounseling(e, 'BK')} className="p-10 space-y-8">
                            {bkMode === 'CASE' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kasus Disiplin Terkait</label>
                                    <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl max-h-48 overflow-y-auto p-3 space-y-2">
                                        {activeViolationRecordsForForm.map(record => (
                                            <div key={record.id} onClick={() => setSelectedCounselingRecords(prev => prev.includes(record.id) ? prev.filter(id => id !== record.id) : [...prev, record.id])} className={`p-3 rounded-xl border-2 cursor-pointer text-xs font-bold flex items-center gap-3 transition-all ${selectedCounselingRecords.includes(record.id) ? 'bg-orange-50 border-orange-400 text-orange-900' : 'bg-white border-slate-100 hover:border-orange-200'}`}>
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selectedCounselingRecords.includes(record.id) ? 'bg-orange-600 border-orange-600' : 'bg-slate-100'}`}>{selectedCounselingRecords.includes(record.id) && <Check className="h-3 w-3 text-white" />}</div>
                                                <div className="flex-1"><p>{incidents.find(i => i.id === record.incidentTypeId)?.name}</p><p className="text-[10px] text-red-500 uppercase font-black mt-1">Skor: {record.pointSnapshot} Poin</p></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasil Konseling / Berita Acara</label><textarea required value={counselingNotes} onChange={e => setCounselingNotes(e.target.value)} rows={6} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-medium outline-none focus:border-blue-500" placeholder="Hasil bimbingan..." /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rekomendasi Lanjut</label><select value={counselingRec} onChange={e => setCounselingRec(e.target.value as any)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 appearance-none"><option value="NONE">Selesai (Cukup Bimbingan)</option><option value="PARENT_CALL">Home Visit / Panggil Ortu</option><option value="TO_KESISWAAN">Eskalasi Sanksi (Kesiswaan)</option></select></div>
                            <button type="submit" disabled={isSubmitting || !counselingNotes} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black tracking-widest shadow-xl shadow-blue-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-slate-200"><Save className="h-6 w-6" /> SIMPAN BERITA ACARA BK</button>
                        </form>
                    </div>
                </div>
            </>
        )}

        {activeTab === 'SANCTIONS' && (
           <>
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                   <div className="p-8 border-b bg-red-50/50 border-red-100 flex justify-between items-center">
                     <h2 className="text-xl font-black flex items-center gap-2 text-red-800"><Gavel className="h-6 w-6" /> Panel Sanksi Kesiswaan</h2>
                   </div>
                   <form onSubmit={handleAssignSanction} className="p-10 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tingkat Sanksi</label><select value={sanctionLevel} onChange={e => setSanctionLevel(e.target.value as any)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-red-500 appearance-none"><option value="SP1">SP 1</option><option value="SP2">SP 2</option><option value="SP3">SP 3</option><option value="SKORSING">Skorsing</option><option value="DROP_OUT">Drop Out</option></select></div>
                         <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tugas Penebusan</label><input value={sanctionRedemptionTask} onChange={e => setSanctionRedemptionTask(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-red-500" placeholder="Misal: Bersihkan masjid 3 hari" /></div>
                      </div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alasan Penjatuhan Sanksi</label><textarea required value={sanctionNotes} onChange={e => setSanctionNotes(e.target.value)} rows={4} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-medium outline-none focus:border-red-500" placeholder="Dasar pertimbangan..." /></div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-[1.5rem] font-black tracking-widest shadow-xl shadow-red-100 flex items-center justify-center gap-3 active:scale-95 disabled:bg-slate-200"><Gavel className="h-6 w-6" /> TERBITKAN SANKSI RESMI</button>
                   </form>
                </div>
             </div>
           </>
        )}

        {/* --- UNIFIED DETAIL MODAL (TIMELINE STORY) --- */}
        {detailModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                        <h2 className="font-black text-xl flex items-center gap-3"><LinkIcon className="h-6 w-6 text-indigo-400" /> Riwayat Kasus Terpadu</h2>
                        <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                        <div className="space-y-0 relative">
                            <div className="absolute left-7 top-4 bottom-4 w-1 bg-slate-200 z-0 rounded-full"></div>
                            {storyLine.map((step, idx) => (
                                <div key={step.id} className="relative z-10 flex gap-6 mb-10 last:mb-0 group">
                                    <div className={`w-14 h-14 rounded-2xl border-4 border-slate-50 flex items-center justify-center shrink-0 shadow-lg
                                        ${step.type === 'INCIDENT' ? 'bg-white text-slate-600' : 
                                          step.type === 'APPROVAL' ? 'bg-emerald-600 text-white' :
                                          step.type === 'COUNSELING_WALAS' ? 'bg-orange-600 text-white' :
                                          step.type === 'COUNSELING_BK' ? 'bg-blue-600 text-white' :
                                          'bg-red-600 text-white'}
                                    `}>
                                        {step.type === 'INCIDENT' && <FileText className="h-6 w-6" />}
                                        {step.type === 'APPROVAL' && <CheckCircle2 className="h-6 w-6" />}
                                        {step.type === 'COUNSELING_WALAS' && <User className="h-6 w-6" />}
                                        {step.type === 'COUNSELING_BK' && <HeartHandshake className="h-6 w-6" />}
                                        {step.type === 'SANCTION' && <Gavel className="h-6 w-6" />}
                                    </div>
                                    <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group-hover:border-indigo-200 transition-all group-hover:-translate-y-1">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-black text-slate-800 text-lg leading-tight">{step.title}</h4>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                    {new Date(step.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {new Date(step.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                            {step.statusLabel && (<span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border ${step.statusColor || 'bg-slate-100 text-slate-600'}`}>{step.statusLabel}</span>)}
                                        </div>
                                        <div className="text-xs text-slate-500 mb-4 font-bold border-b border-slate-50 pb-3"><span className="text-slate-400">AKTOR:</span> {step.actor} {step.scoreImpact && <span className="ml-2 text-red-600">({step.scoreImpact} Poin)</span>}</div>
                                        <p className="text-sm text-slate-600 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">"{step.description || '-'}"</p>
                                        {step.attachmentUrl && (<div className="mt-4 flex justify-end"><button onClick={() => setPreviewImage(step.attachmentUrl || null)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-black transition-all border border-slate-200 shadow-sm"><Paperclip className="h-4 w-4" /> LAMPIRAN BUKTI</button></div>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-6 border-t border-slate-100 flex justify-end"><button onClick={() => setDetailModalOpen(false)} className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl text-sm shadow-xl active:scale-95 transition-all">TUTUP RIWAYAT</button></div>
                </div>
            </div>
        )}

        {previewImage && (
            <div className="fixed inset-0 z-[210] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
                <button className="absolute top-6 right-6 text-white hover:text-slate-300 transition-colors"><X className="h-10 w-10" /></button>
                <img src={previewImage} alt="Preview Bukti" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain ring-4 ring-white/10" onClick={(e) => e.stopPropagation()} />
            </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;
