
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { 
  Student, IncidentRecord, MasterIncidentType, MasterCategory, 
  IncidentTypeCategory, CoachingRule, Role, Teacher, ClassGroup, 
  CounselingSession, StudentSanction, SanctionLevel, RedemptionStatus, IncidentStatus
} from '../../types';
import { 
  ArrowLeft, ShieldAlert, Award, History, Save, AlertTriangle, CheckCircle2, 
  X, HeartHandshake, BookOpen, ClipboardList, Gavel, Clock, AlertCircle, 
  User, PenSquare, FileText, Check, Shield, MessageCircle, Paperclip, 
  Link as LinkIcon, Loader2, Cloud, ChevronRight, Plus, Info, Zap, UserCheck, Calendar
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
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'INPUT' | 'COACHING' | 'SANCTIONS'>('TIMELINE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [formType, setFormType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIncident, setSelectedIncident] = useState('');
  const [incidentNotes, setIncidentNotes] = useState('');
  
  const [coachingNotes, setCoachingNotes] = useState('');
  const [coachingRecommendation, setCoachingRecommendation] = useState<any>('NONE');
  const [coachingStatus, setCoachingStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');

  useEffect(() => {
    const user = DataService.getCurrentUser();
    setCurrentUser(user);
    loadData();
  }, [studentId, refreshKey]);

  const loadData = () => {
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
      setCounselingSessions(DataService.getCounselingSessions().filter(s => s.studentId === studentId));
      setSanctions(DataService.getSanctions().filter(s => s.studentId === studentId));
    }
    setIsLoading(false);
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !student || !currentUser) return;
    setIsSubmitting(true);
    try {
      const incidentDef = incidents.find(i => i.id === selectedIncident);
      if (!incidentDef) return;

      const isWalas = currentUser.id === classes.find(c => c.id === student.classId)?.homeroomTeacherId;
      
      const newRecord: IncidentRecord = {
        id: `rec_${Date.now()}`,
        studentId: student.id,
        incidentTypeId: selectedIncident,
        date: new Date().toISOString(),
        notes: incidentNotes,
        recordedBy: currentUser.name,
        pointSnapshot: incidentDef.points,
        typeSnapshot: incidentDef.type,
        status: isWalas ? 'APPROVED' : 'PENDING',
        bkStatus: (incidentDef.points >= 40 && incidentDef.type === 'VIOLATION') ? 'REQUIRED' : 'NONE'
      };

      const allRecords = DataService.getRecords();
      await DataService.saveRecords([...allRecords, newRecord]);
      if (isWalas) await DataService.evaluateAndApplySanction(student.id);

      setSuccessMsg('Laporan tersimpan di Cloud.');
      setIncidentNotes('');
      setSelectedIncident('');
      setRefreshKey(k => k + 1);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert("Gagal sinkronisasi data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCoaching = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !currentUser) return;
    setIsSubmitting(true);
    try {
      const isBK = currentUser.roles.includes(Role.BK);
      const newSession: CounselingSession = {
        id: `coun_${Date.now()}`,
        studentId: student.id,
        counselorId: currentUser.id,
        counselorName: currentUser.name,
        date: new Date().toISOString(),
        notes: coachingNotes,
        recommendation: coachingRecommendation,
        status: coachingStatus,
        sessionType: isBK ? 'BK' : 'HOMEROOM'
      };

      const allSessions = DataService.getCounselingSessions();
      await DataService.saveCounselingSessions([...allSessions, newSession]);
      
      setSuccessMsg('Catatan pembinaan berhasil diarsipkan.');
      setCoachingNotes('');
      setRefreshKey(k => k + 1);
      setActiveTab('TIMELINE');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert("Gagal simpan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildTimeline = (): StoryStep[] => {
    const story: StoryStep[] = [];
    records.forEach(r => {
      if (r.status === 'REJECTED') return;
      const inc = incidents.find(i => i.id === r.incidentTypeId);
      story.push({
        id: r.id, date: r.date, type: 'INCIDENT', title: inc?.name || 'Kejadian',
        actor: r.recordedBy, description: r.notes || '-',
        statusLabel: r.status === 'PENDING' ? 'Menunggu Verifikasi' : 'Terverifikasi',
        statusColor: r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
        scoreImpact: r.typeSnapshot === 'VIOLATION' ? r.pointSnapshot : -r.pointSnapshot
      });
    });
    counselingSessions.forEach(c => {
      story.push({
        id: c.id, date: c.date, type: c.sessionType === 'BK' ? 'COUNSELING_BK' : 'COUNSELING_WALAS',
        title: c.sessionType === 'BK' ? 'Konseling BK' : 'Pembinaan Wali Kelas',
        actor: c.counselorName, description: c.notes,
        statusLabel: c.recommendation !== 'NONE' ? `Rujukan: ${c.recommendation}` : 'Selesai',
        statusColor: 'bg-indigo-100 text-indigo-700'
      });
    });
    sanctions.forEach(s => {
      story.push({
        id: s.id, date: s.assignedDate, type: 'SANCTION', title: `Penerbitan Sanksi ${s.level}`,
        actor: s.assignedBy, description: s.notes,
        statusLabel: s.redemptionStatus === 'COMPLETED' ? 'Selesai' : 'Aktif',
        statusColor: 'bg-rose-100 text-rose-700'
      });
    });
    return story.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;
  if (!student) return <div className="p-8 text-center font-bold text-slate-500">Siswa tidak ditemukan dalam database.</div>;

  const stats = DataService.calculateStudentPoints(student.id, records, incidents);
  const statusRule = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const timeline = buildTimeline();
  const currentClass = classes.find(c => c.id === student.classId);
  const isWalas = currentUser?.id === currentClass?.homeroomTeacherId;
  const isBK = currentUser?.roles.includes(Role.BK);

  return (
    <div className="space-y-8 pb-24 animate-fade-in relative max-w-6xl mx-auto">
      {/* CLOUD OVERLAY */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white">
            <div className="bg-white p-10 rounded-3xl shadow-2xl flex flex-col items-center text-slate-800 scale-110">
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

      {/* --- HERO HEADER SECTION --- */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
        <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200 shrink-0 shadow-inner">
             <User className="h-12 w-12" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{student.name}</h1>
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border ${statusRule.color}`}>{statusRule.statusLabel}</span>
              {isWalas && <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1.5"><UserCheck className="h-3 w-3" /> WALI KELAS</span>}
            </div>
            <div className="flex flex-wrap gap-4 text-slate-500 font-bold text-xs uppercase tracking-widest">
               <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Shield className="h-3.5 w-3.5 text-indigo-500" /> NIS: {student.nis}</span>
               <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><BookOpen className="h-3.5 w-3.5 text-indigo-500" /> KELAS {currentClass?.name}</span>
               <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Calendar className="h-3.5 w-3.5 text-indigo-500" /> STATUS {student.status}</span>
            </div>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1 md:w-32 bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center shadow-sm">
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-tighter mb-1">Poin Pelanggaran</p>
                <p className="text-4xl font-black text-rose-600">{stats.effectiveViolationScore}</p>
            </div>
            <div className="flex-1 md:w-32 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center shadow-sm">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter mb-1">Poin Prestasi</p>
                <p className="text-4xl font-black text-emerald-600">{stats.achievementPoints}</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="flex p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto gap-1">
        {[
          {id:'TIMELINE', label:'Timeline Riwayat', icon: History},
          {id:'INPUT', label:'Catat Kejadian', icon: Plus},
          {id:'COACHING', label:'Pembinaan Tatap Muka', icon: HeartHandshake, restricted: !(isWalas || isBK)},
          {id:'SANCTIONS', label:'Status Sanksi', icon: Gavel}
        ].filter(t => !t.restricted).map((t) => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            <t.icon className={`h-4.5 w-4.5 ${activeTab === t.id ? 'animate-bounce' : ''}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* --- CONTENT SECTION --- */}
      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'TIMELINE' && (
          <div className="space-y-6">
            {timeline.length === 0 ? (
              <div className="bg-white p-20 text-center rounded-3xl border-4 border-dashed border-slate-100 flex flex-col items-center">
                 <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-200"><Clock className="h-10 w-10" /></div>
                 <p className="text-slate-400 font-bold text-lg">Belum Ada Jejak Digital</p>
                 <p className="text-slate-300 text-sm mt-1">Seluruh aktivitas siswa akan terekam secara otomatis di sini.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-8 top-10 bottom-10 w-1 bg-gradient-to-b from-indigo-100 via-purple-50 to-transparent rounded-full z-0"></div>
                <div className="space-y-10">
                  {timeline.map((step, idx) => (
                    <div key={step.id} className="relative z-10 flex gap-8 group animate-fade-in" style={{animationDelay: `${idx * 0.05}s`}}>
                      <div className={`w-16 h-16 rounded-2xl border-4 border-white flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110 ${
                        step.type === 'INCIDENT' ? 'bg-indigo-600 text-white shadow-indigo-100' : 
                        step.type === 'SANCTION' ? 'bg-rose-600 text-white shadow-rose-100' : 'bg-amber-500 text-white shadow-amber-100'
                      }`}>
                        {step.type === 'INCIDENT' ? <ClipboardList className="h-7 w-7" /> : 
                         step.type === 'SANCTION' ? <Gavel className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
                      </div>
                      <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group-hover:-translate-y-1">
                         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                            <div>
                              <h4 className="text-xl font-black text-slate-800 leading-tight">{step.title}</h4>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {new Date(step.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})} • {new Date(step.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            {step.statusLabel && <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter border ${step.statusColor}`}>{step.statusLabel}</span>}
                         </div>
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-slate-600 leading-relaxed italic text-sm">"{step.description}"</p>
                         </div>
                         <div className="mt-5 pt-4 border-t border-slate-50 flex flex-wrap justify-between items-center gap-4">
                            <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-bold">{step.actor.charAt(0)}</div><span className="text-[10px] font-black text-slate-400 uppercase">Petugas: {step.actor}</span></div>
                            {step.scoreImpact !== undefined && (
                              <div className={`px-4 py-1.5 rounded-xl text-xs font-black shadow-inner ${step.scoreImpact > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {step.scoreImpact > 0 ? '+' : ''}{step.scoreImpact} POIN KESALAHAN
                              </div>
                            )}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'INPUT' && (
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden">
             <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><PenSquare className="h-6 w-6" /></div>
                <div><h2 className="text-2xl font-black text-slate-800">Pencatatan Kejadian</h2><p className="text-slate-500 text-sm font-medium">Input data pelanggaran atau prestasi secara akurat.</p></div>
             </div>
             <form onSubmit={handleSaveIncident} className="p-10 space-y-8">
                <div className="flex p-1.5 bg-slate-100 rounded-[1.25rem] max-w-md shadow-inner">
                   <button type="button" onClick={() => { setFormType(IncidentTypeCategory.VIOLATION); setSelectedCategory(''); setSelectedIncident(''); }} className={`flex-1 py-3.5 rounded-xl text-xs font-black tracking-widest transition-all ${formType === IncidentTypeCategory.VIOLATION ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>PELANGGARAN</button>
                   <button type="button" onClick={() => { setFormType(IncidentTypeCategory.ACHIEVEMENT); setSelectedCategory(''); setSelectedIncident(''); }} className={`flex-1 py-3.5 rounded-xl text-xs font-black tracking-widest transition-all ${formType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>PENGHARGAAN</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Kategori Master</label><select required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none" value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedIncident(''); }}><option value="">-- Pilih Kategori --</option>{categories.filter(c => c.targetType === formType).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
                   <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Jenis Kejadian Spesifik</label><select required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none disabled:opacity-50" value={selectedIncident} onChange={e => setSelectedIncident(e.target.value)} disabled={!selectedCategory}><option value="">-- Pilih Kejadian --</option>{incidents.filter(i => i.categoryId === selectedCategory).map(inc => <option key={inc.id} value={inc.id}>{inc.name} ({inc.points} Poin)</option>)}</select></div>
                </div>
                <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Kronologi / Catatan Pendukung</label><textarea required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all h-40" placeholder="Jelaskan secara mendetail waktu, tempat, dan situasi kejadian..." value={incidentNotes} onChange={e => setIncidentNotes(e.target.value)} /></div>
                {successMsg && <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold flex items-center gap-3 animate-bounce shadow-inner border border-emerald-100"><CheckCircle2 className="h-5 w-5" /> {successMsg}</div>}
                <button type="submit" disabled={isSubmitting || !selectedIncident} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black tracking-widest shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none"><Save className="h-6 w-6" /> SIMPAN LAPORAN DIGITAL</button>
             </form>
          </div>
        )}

        {activeTab === 'COACHING' && (
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden">
             <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-100"><HeartHandshake className="h-6 w-6" /></div>
                <div><h2 className="text-2xl font-black text-slate-800">Berita Acara Pembinaan</h2><p className="text-slate-500 text-sm font-medium">Dokumentasikan sesi konseling atau pembinaan langsung.</p></div>
             </div>
             <form onSubmit={handleSaveCoaching} className="p-10 space-y-8">
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 text-sm text-indigo-700 flex items-start gap-4"><Info className="h-6 w-6 shrink-0 mt-0.5 text-indigo-500" /><p className="font-medium leading-relaxed">Gunakan form ini setelah Anda memanggil siswa ke ruang guru/BK. Catat komitmen tertulis mereka di sini agar memiliki landasan hukum jika terjadi pengulangan.</p></div>
                <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Isi Perjanjian / Hasil Pertemuan</label><textarea required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm font-medium outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all h-48" placeholder="Contoh: Siswa mengakui kesalahan, meminta maaf, dan bersedia dicukur jika mengulangi rambut panjang..." value={coachingNotes} onChange={e => setCoachingNotes(e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Eskalasi / Rekomendasi</label><select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none" value={coachingRecommendation} onChange={e => setCoachingRecommendation(e.target.value as any)}><option value="NONE">Cukup Pembinaan Disini</option><option value="TO_BK">Rujuk ke Guru BK (Eskalasi)</option><option value="PARENT_CALL">Panggilan Orang Tua (Home Visit)</option><option value="TO_KESISWAAN">Tindakan Disiplin Kesiswaan</option></select></div>
                   <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Status Penanganan</label><select className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none" value={coachingStatus} onChange={e => setCoachingStatus(e.target.value as any)}><option value="CLOSED">Selesai / Damai</option><option value="OPEN">Masih Dipantau (Siswa Bersyarat)</option></select></div>
                </div>
                <button type="submit" disabled={isSubmitting || !coachingNotes} className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-[1.5rem] font-black tracking-widest shadow-2xl shadow-amber-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none"><CheckCircle2 className="h-6 w-6" /> ARSIPKAN HASIL PEMBINAAN</button>
             </form>
          </div>
        )}

        {activeTab === 'SANCTIONS' && (
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-slate-100">
                 <div className="h-20 w-20 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 shadow-inner"><Gavel className="h-10 w-10" /></div>
                 <div className="text-center md:text-left"><h3 className="font-black text-2xl text-slate-800 tracking-tight">Status Sanksi Resmi</h3><p className="text-sm font-medium text-slate-500">Monitoring Surat Peringatan (SP) dan tugas penebusan poin yang sedang berjalan.</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {sanctions.length === 0 ? (
                   <div className="md:col-span-2 bg-emerald-50/50 p-20 text-center rounded-[2.5rem] border-4 border-dashed border-emerald-100 flex flex-col items-center">
                     <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-6 drop-shadow-sm" />
                     <p className="font-black text-2xl text-emerald-800 tracking-tight">Siswa Sangat Tertib</p>
                     <p className="text-emerald-600 font-medium mt-2">Tidak ditemukan catatan sanksi formal/berat untuk siswa ini.</p>
                   </div>
                 ) : (
                   sanctions.map(s => (
                     <div key={s.id} className="group bg-white p-8 rounded-[2rem] border border-slate-200 shadow-lg hover:shadow-2xl hover:border-rose-200 transition-all duration-300">
                        <div className="flex justify-between items-start mb-6"><span className="px-5 py-1.5 bg-rose-600 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-200 uppercase tracking-widest">{s.level}</span><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{new Date(s.assignedDate).toLocaleDateString()}</span></div>
                        <div className="space-y-4">
                           <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pemicu Sanksi</p><p className="text-sm font-bold text-slate-800 italic leading-relaxed">"{s.notes}"</p></div>
                           <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-rose-50/30 group-hover:border-rose-100 transition-colors"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ShieldAlert className="h-3 w-3 text-rose-500" /> Tugas Penebusan Wajib</p><p className="text-xs font-bold text-slate-700 leading-relaxed">{s.redemptionTask || 'Tugas belum ditetapkan kesiswaan.'}</p></div>
                        </div>
                        <div className="mt-8 flex justify-between items-center"><span className={`text-[10px] font-black px-4 py-1.5 rounded-xl border uppercase tracking-widest shadow-sm ${s.redemptionStatus === 'COMPLETED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{s.redemptionStatus}</span><span className="text-[10px] font-black text-slate-400 uppercase">Oleh: {s.assignedBy}</span></div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;
