
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
  Link as LinkIcon, Loader2, Cloud, ChevronRight, Plus
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
  
  // --- DATA STATES ---
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

  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'INPUT' | 'COACHING' | 'SANCTIONS'>('TIMELINE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- FORM STATES ---
  const [formType, setFormType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIncident, setSelectedIncident] = useState('');
  const [incidentNotes, setIncidentNotes] = useState('');
  
  // --- COACHING FORM ---
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

      setSuccessMsg('Laporan berhasil disimpan ke Cloud.');
      setIncidentNotes('');
      setSelectedIncident('');
      setRefreshKey(k => k + 1);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert("Gagal sinkronisasi. Cek koneksi.");
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
      
      setSuccessMsg('Catatan pembinaan telah diamankan di Cloud.');
      setCoachingNotes('');
      setRefreshKey(k => k + 1);
      setActiveTab('TIMELINE');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert("Gagal simpan pembinaan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- TIMELINE BUILDER ---
  const buildTimeline = (): StoryStep[] => {
    const story: StoryStep[] = [];
    
    records.forEach(r => {
      const inc = incidents.find(i => i.id === r.incidentTypeId);
      story.push({
        id: r.id,
        date: r.date,
        type: 'INCIDENT',
        title: inc?.name || 'Kejadian',
        actor: `Pelapor: ${r.recordedBy}`,
        description: r.notes || '-',
        statusLabel: r.status === 'PENDING' ? 'Menunggu Verifikasi' : 'Terverifikasi',
        statusColor: r.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700',
        scoreImpact: r.typeSnapshot === 'VIOLATION' ? r.pointSnapshot : -r.pointSnapshot
      });
    });

    counselingSessions.forEach(c => {
      story.push({
        id: c.id,
        date: c.date,
        type: c.sessionType === 'BK' ? 'COUNSELING_BK' : 'COUNSELING_WALAS',
        title: c.sessionType === 'BK' ? 'Konseling BK' : 'Pembinaan Wali Kelas',
        actor: c.counselorName,
        description: c.notes,
        statusLabel: c.recommendation !== 'NONE' ? `Rujukan: ${c.recommendation}` : 'Selesai',
        statusColor: 'bg-blue-100 text-blue-700'
      });
    });

    sanctions.forEach(s => {
      story.push({
        id: s.id,
        date: s.assignedDate,
        type: 'SANCTION',
        title: `Penerbitan Sanksi ${s.level}`,
        actor: 'Sistem Kesiswaan',
        description: s.notes,
        statusLabel: s.redemptionStatus === 'COMPLETED' ? 'Sudah Penebusan' : 'Aktif',
        statusColor: 'bg-red-100 text-red-700'
      });
    });

    return story.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!student) return <div className="p-8 text-center font-bold">Siswa tidak ditemukan.</div>;

  const stats = DataService.calculateStudentPoints(student.id, records, incidents);
  const statusRule = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const timeline = buildTimeline();
  const isWalas = currentUser?.id === classes.find(c => c.id === student.classId)?.homeroomTeacherId;
  const isBK = currentUser?.roles.includes(Role.BK);

  return (
    <div className="space-y-6 pb-20 animate-fade-in relative">
      
      {/* CLOUD OVERLAY BLOCKER */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800 animate-bounce-slow">
                <Cloud className="h-16 w-16 text-indigo-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Sinkronisasi Cloud...</h3>
                <p className="text-sm text-slate-500 mt-2">Sedang mengunci data di server Google.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-indigo-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      {/* HEADER PREMIUM */}
      <div className="flex flex-col md:flex-row gap-6 md:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <button onClick={() => navigate(-1)} className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors shrink-0"><ArrowLeft className="h-6 w-6" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">{student.name}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${statusRule.color}`}>{statusRule.statusLabel}</span>
          </div>
          <p className="text-slate-500 font-medium">NIS: {student.nis} • Kelas {classes.find(c => c.id === student.classId)?.name}</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center px-4 border-r border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase">Poin Pelanggaran</p><p className="text-2xl font-black text-red-600">{stats.effectiveViolationScore}</p></div>
          <div className="text-center px-4"><p className="text-[10px] font-bold text-slate-400 uppercase">Poin Penghargaan</p><p className="text-2xl font-black text-emerald-600">{stats.achievementPoints}</p></div>
        </div>
      </div>

      {/* TABS INTERAKTIF */}
      <div className="flex border-b border-slate-200 overflow-x-auto bg-white rounded-xl shadow-sm px-2">
        <button onClick={() => setActiveTab('TIMELINE')} className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'TIMELINE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><History className="h-4 w-4" /> Timeline Riwayat</button>
        <button onClick={() => setActiveTab('INPUT')} className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'INPUT' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Plus className="h-4 w-4" /> Catat Kejadian</button>
        {(isWalas || isBK) && (
          <button onClick={() => setActiveTab('COACHING')} className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'COACHING' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><HeartHandshake className="h-4 w-4" /> Input Pembinaan</button>
        )}
        <button onClick={() => setActiveTab('SANCTIONS')} className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-all border-b-2 ${activeTab === 'SANCTIONS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Gavel className="h-4 w-4" /> Status Sanksi</button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'TIMELINE' && (
          <div className="space-y-4">
            {timeline.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-400"><Clock className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="font-medium">Belum ada riwayat aktivitas untuk siswa ini.</p></div>
            ) : (
              <div className="relative space-y-6">
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-100 z-0"></div>
                {timeline.map((step) => (
                  <div key={step.id} className="relative z-10 flex gap-6 group">
                    <div className={`w-12 h-12 rounded-full border-4 border-white flex items-center justify-center shrink-0 shadow-sm ${
                      step.type === 'INCIDENT' ? 'bg-indigo-50 text-indigo-600' :
                      step.type === 'SANCTION' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {step.type === 'INCIDENT' ? <ClipboardList className="h-5 w-5" /> : 
                       step.type === 'SANCTION' ? <Gavel className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group-hover:border-indigo-200 transition-all">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-slate-800">{step.title}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(step.date).toLocaleDateString()} • {new Date(step.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                          {step.statusLabel && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${step.statusColor}`}>{step.statusLabel}</span>}
                       </div>
                       <p className="text-sm text-slate-600 mt-3 leading-relaxed italic">"{step.description}"</p>
                       <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px]">
                          <span className="font-bold text-slate-400">AKTOR: {step.actor}</span>
                          {step.scoreImpact !== undefined && (
                            <span className={`font-black text-xs ${step.scoreImpact > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {step.scoreImpact > 0 ? '+' : ''}{step.scoreImpact} POIN
                            </span>
                          )}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'INPUT' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-slate-50"><h2 className="font-bold text-slate-800 flex items-center gap-2"><Plus className="h-5 w-5 text-indigo-600" /> Catat Kejadian Baru</h2></div>
             <form onSubmit={handleSaveIncident} className="p-8 space-y-6">
                <div className="flex p-1 bg-slate-100 rounded-xl max-w-sm">
                   <button type="button" onClick={() => { setFormType(IncidentTypeCategory.VIOLATION); setSelectedCategory(''); setSelectedIncident(''); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formType === IncidentTypeCategory.VIOLATION ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>PELANGGARAN</button>
                   <button type="button" onClick={() => { setFormType(IncidentTypeCategory.ACHIEVEMENT); setSelectedCategory(''); setSelectedIncident(''); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>PENGHARGAAN</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kategori</label><select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedIncident(''); }}><option value="">-- Pilih Kategori --</option>{categories.filter(c => c.targetType === formType).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
                   <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jenis Kejadian</label><select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={selectedIncident} onChange={e => setSelectedIncident(e.target.value)} disabled={!selectedCategory}><option value="">-- Pilih Kejadian --</option>{incidents.filter(i => i.categoryId === selectedCategory).map(inc => <option key={inc.id} value={inc.id}>{inc.name} ({inc.points} Pt)</option>)}</select></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catatan Detail</label><textarea required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32" placeholder="Tuliskan detail kejadian, lokasi, atau keterangan pendukung..." value={incidentNotes} onChange={e => setIncidentNotes(e.target.value)} /></div>
                {successMsg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {successMsg}</div>}
                <button type="submit" disabled={isSubmitting || !selectedIncident} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:bg-slate-300"><Save className="h-5 w-5" /> Simpan Laporan</button>
             </form>
          </div>
        )}

        {activeTab === 'COACHING' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-slate-50"><h2 className="font-bold text-slate-800 flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-indigo-600" /> Rekam Pembinaan</h2></div>
             <form onSubmit={handleSaveCoaching} className="p-8 space-y-6">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex items-start gap-3"><Info className="h-5 w-5 shrink-0 mt-0.5" /><p>Catatan pembinaan digunakan untuk mendokumentasikan pertemuan tatap muka antara Guru dan Siswa sebagai bagian dari proses perbaikan perilaku.</p></div>
                <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasil Pembinaan / Komitmen Siswa</label><textarea required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32" placeholder="Contoh: Siswa berjanji tidak mengulangi perbuatannya dan bersedia mengikuti piket tambahan..." value={coachingNotes} onChange={e => setCoachingNotes(e.target.value)} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rekomendasi Lanjut</label><select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={coachingRecommendation} onChange={e => setCoachingRecommendation(e.target.value as any)}><option value="NONE">Tidak Ada (Cukup Pembinaan)</option><option value="TO_BK">Rujuk ke Guru BK</option><option value="PARENT_CALL">Panggilan Orang Tua</option><option value="TO_KESISWAAN">Rujuk ke Kesiswaan</option></select></div>
                   <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Kasus</label><select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={coachingStatus} onChange={e => setCoachingStatus(e.target.value as any)}><option value="CLOSED">SELESAI (Masuk Riwayat)</option><option value="OPEN">DALAM PANTAUAN (Masih Aktif)</option></select></div>
                </div>
                <button type="submit" disabled={isSubmitting || !coachingNotes} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:bg-slate-300"><CheckCircle2 className="h-5 w-5" /> Simpan Catatan Pembinaan</button>
             </form>
          </div>
        )}

        {activeTab === 'SANCTIONS' && (
           <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                 <div className="h-14 w-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0"><Gavel className="h-7 w-7" /></div>
                 <div><h3 className="font-bold text-lg text-slate-800">Status Kedisiplinan</h3><p className="text-sm text-slate-500">Ambang batas SP berikutnya adalah pada skor 80 (SP1), 120 (SP2), dan 160 (SP3).</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {sanctions.length === 0 ? (
                   <div className="md:col-span-2 bg-emerald-50 p-12 text-center rounded-2xl border border-dashed border-emerald-200"><CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" /><p className="font-bold text-emerald-800">Siswa belum memiliki riwayat sanksi berat.</p><p className="text-xs text-emerald-600">Perilaku masih dalam batas normal sekolah.</p></div>
                 ) : (
                   sanctions.map(s => (
                     <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-3"><span className="px-3 py-1 bg-red-600 text-white text-xs font-black rounded-lg">{s.level}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(s.assignedDate).toLocaleDateString()}</span></div>
                        <p className="text-sm font-bold text-slate-800 mb-1">Penyebab: <span className="font-normal text-slate-600">"{s.notes}"</span></p>
                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Tugas Penebusan:</p><p className="text-xs font-medium text-slate-700">{s.redemptionTask || 'Belum diberikan tugas oleh kesiswaan.'}</p></div>
                        <div className="mt-4 flex justify-between items-center"><span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${s.redemptionStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{s.redemptionStatus}</span><span className="text-[10px] text-slate-400 italic">Oleh: {s.assignedBy}</span></div>
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

// Mock Info icon as it was used but not imported
const Info: React.FC<{className?: string}> = ({className}) => <AlertCircle className={className} />;

export default StudentProfile;
