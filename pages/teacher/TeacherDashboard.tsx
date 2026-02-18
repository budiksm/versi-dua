
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { IncidentRecord, MasterIncidentType, IncidentTypeCategory, ClassGroup, Teacher, Role, Student, SanctionLevel, RedemptionStatus, CounselingSession, StudentSanction, CoachingRule } from '../../types';
import { AlertTriangle, Award, Users, ArrowRight, HeartHandshake, Gavel, CheckCircle2, ClipboardList, Check, Ban, ChevronLeft, ChevronRight, Skull, Inbox, Activity, FileText, Paperclip, Link as LinkIcon, ExternalLink, X, List } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

// --- INTERFACE ---
interface StoryStep {
  id: string;
  date: string;
  type: 'INCIDENT' | 'APPROVAL' | 'COUNSELING_WALAS' | 'COUNSELING_BK' | 'SANCTION' | 'KESISWAAN';
  title: string;
  actor: string;
  description: string;
  statusLabel?: string;
  statusColor?: string;
  attachmentUrl?: string;
  scoreImpact?: number;
}

const TeacherDashboard: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [counselingSessions, setCounselingSessions] = useState<CounselingSession[]>([]);
  const [sanctions, setSanctions] = useState<StudentSanction[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);

  // State Views
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [recentPage, setRecentPage] = useState(0);
  
  // Kesiswaan Dashboard State
  const [sp1Count, setSp1Count] = useState<number>(0);
  const [sp2Count, setSp2Count] = useState<number>(0);
  const [sp3Count, setSp3Count] = useState<number>(0);
  const [doCount, setDoCount] = useState<number>(0); 
  const [activeRedemptions, setActiveRedemptions] = useState<number>(0);
  const [pendingTaskSanctions, setPendingTaskSanctions] = useState<any[]>([]); 
  const [bkHandledList, setBkHandledList] = useState<{student: Student, score: number, session: CounselingSession}[]>([]);

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedSanction, setSelectedSanction] = useState<any>(null);
  const [taskInput, setTaskInput] = useState('');
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [storyLine, setStoryLine] = useState<StoryStep[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [rejectRecordId, setRejectRecordId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const navigate = useNavigate();
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    refreshDashboard();
    const unsubscribe = DataService.subscribeToDataChanges(() => {
        refreshDashboard();
    });
    return () => unsubscribe();
  }, []);

  const refreshDashboard = () => {
    const user = DataService.getCurrentUser();
    setCurrentUser(user);

    if (user && user.roles.includes(Role.STUDENT) && !user.roles.includes(Role.TEACHER)) {
        navigate('/teacher/poe-ibu');
        return;
    }
    
    // Load Data safely
    const recs = DataService.getRecords() || [];
    const incs = DataService.getIncidentTypes() || [];
    const stds = DataService.getStudents() || [];
    const cls = DataService.getClasses() || [];
    const sess = DataService.getCounselingSessions() || [];
    const sanc = DataService.getSanctions() || [];
    const rls = DataService.getRules() || [];

    setRecords(recs);
    setIncidents(incs);
    setStudents(stds);
    setClasses(cls);
    setCounselingSessions(sess);
    setSanctions(sanc);
    setRules(rls);

    if (user) {
        // 1. PENDING APPROVALS (For Homeroom Teachers)
        const myClassGroups = cls.filter(c => c.homeroomTeacherId === user.id);
        if (myClassGroups.length > 0) {
            const myStudentIds = stds.filter(s => myClassGroups.some(c => c.id === s.classId)).map(s => s.id);
            const pendings = recs.filter(r => myStudentIds.includes(r.studentId) && r.status === 'PENDING').map(r => ({
                ...r,
                studentName: stds.find(s => s.id === r.studentId)?.name || 'Unknown',
                incidentName: incs.find(i => i.id === r.incidentTypeId)?.name || 'Unknown'
            }));
            setPendingApprovals(pendings);
        }

        // 2. KESISWAAN LOGIC
        if (user.roles.includes(Role.KESISWAAN)) {
            // Stats
            setSp1Count(sanc.filter(s => s.level === SanctionLevel.SP1 && !s.isRedeemed).length);
            setSp2Count(sanc.filter(s => s.level === SanctionLevel.SP2 && !s.isRedeemed).length);
            setSp3Count(sanc.filter(s => s.level === SanctionLevel.SP3 && !s.isRedeemed).length);
            setDoCount(sanc.filter(s => s.level === SanctionLevel.DROP_OUT).length);
            setActiveRedemptions(sanc.filter(s => s.redemptionStatus === RedemptionStatus.IN_PROGRESS).length);

            // Antrian Sanksi (Butuh Tugas)
            const sanctionsNeedTask = sanc
                .filter(s => s.redemptionStatus === RedemptionStatus.NONE)
                .map(s => {
                    const st = stds.find(x => x.id === s.studentId);
                    if (!st) return null;
                    const stats = DataService.calculateStudentPoints(st.id, recs, incs);
                    return {
                        sanctionId: s.id,
                        student: st,
                        level: s.level,
                        date: s.assignedDate,
                        currentScore: stats.effectiveViolationScore,
                        className: cls.find(c => c.id === st.classId)?.name || '-'
                    };
                })
                .filter(Boolean) as any[];
            setPendingTaskSanctions(sanctionsNeedTask);

            // Rujukan dari BK
            const referrals: any[] = [];
            stds.forEach(s => {
                const referredRecords = recs.filter(r => r.studentId === s.id && r.bkStatus === 'REFERRED');
                if (referredRecords.length > 0) {
                    const sessions = sess.filter(c => c.studentId === s.id);
                    const referralSession = sessions.find(ss => ss.recommendation === 'TO_KESISWAAN' || ss.recommendation === 'SUSPENSION_REVIEW');
                    if (referralSession) {
                        const stats = DataService.calculateStudentPoints(s.id, recs, incs);
                        referrals.push({
                            student: s,
                            score: stats.effectiveViolationScore,
                            session: referralSession
                        });
                    }
                }
            });
            setBkHandledList(referrals);
        }
    }
  };

  const handleApprove = async (id: string) => { 
      await DataService.resolveIncident(id, 'APPROVED'); 
      const rec = records.find(r => r.id === id); 
      if (rec) await DataService.evaluateAndApplySanction(rec.studentId); 
      refreshDashboard(); 
  };

  const handleRejectClick = (id: string) => { setRejectRecordId(id); setRejectReason(''); };
  const confirmReject = async () => { 
      if (rejectRecordId && rejectReason) { 
          await DataService.resolveIncident(rejectRecordId, 'REJECTED', rejectReason); 
          setRejectRecordId(null); 
          refreshDashboard(); 
      } 
  };

  const handleOpenTaskModal = (item: any) => { setSelectedSanction(item); setTaskInput(''); setShowTaskModal(true); };
  const handleSaveTask = async () => {
      if(!selectedSanction || !currentUser) return;
      const allSanc = DataService.getSanctions();
      const updated = allSanc.map(s => s.id === selectedSanction.sanctionId ? { ...s, redemptionTask: taskInput, redemptionStatus: RedemptionStatus.ASSIGNED, assignedBy: `${s.assignedBy} & ${currentUser.name}` } : s);
      await DataService.saveSanctions(updated);
      setShowTaskModal(false);
      refreshDashboard();
  };

  // Helper for Recent Activity
  const myClassGroups = classes.filter(c => c.homeroomTeacherId === currentUser?.id);
  const myStudentIds = students.filter(s => myClassGroups.some(c => c.id === s.classId)).map(s => s.id);
  const isKesiswaan = currentUser?.roles.includes(Role.KESISWAAN);
  const shouldFilterMyClass = !isKesiswaan && !currentUser?.roles.includes(Role.ADMIN) && !currentUser?.roles.includes(Role.BK);
  
  const recentRecords = records
    .filter(r => r.status !== 'REJECTED' && (!shouldFilterMyClass || myStudentIds.includes(r.studentId)))
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(recentPage * ITEMS_PER_PAGE, (recentPage + 1) * ITEMS_PER_PAGE);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div><h1 className="text-2xl font-bold text-slate-800">Dashboard Guru</h1><p className="text-slate-500">Selamat datang, <span className="font-semibold text-indigo-600">{currentUser?.name}</span>.</p></div>
      </div>

      {pendingApprovals.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
           <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg"><Inbox className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-800">Persetujuan Laporan Masuk</h2><p className="text-xs text-slate-500">Verifikasi laporan untuk kelas Anda.</p></div></div>
           <div className="space-y-3">
              {pendingApprovals.map((req) => (
                 <div key={req.id} className="bg-white p-4 rounded-lg border border-yellow-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex-1"><div className="font-bold text-slate-800">{req.studentName}</div><div className="text-sm text-slate-600">{req.incidentName} <span className="text-red-500">({req.pointSnapshot} Poin)</span></div><div className="text-xs text-slate-400">Pelapor: {req.recordedBy}</div></div>
                    <div className="flex gap-2"><button onClick={() => handleApprove(req.id)} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold flex items-center gap-1"><Check className="h-3 w-3" /> Terima</button><button onClick={() => handleRejectClick(req.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold flex items-center gap-1"><Ban className="h-3 w-3" /> Tolak</button></div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {isKesiswaan && (
        <div className="space-y-6">
            {/* STATS */}
            <div className="bg-slate-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white/10 rounded-lg p-4 text-center"><p className="text-orange-300 text-xs font-bold uppercase">Aktif SP 1</p><p className="text-2xl font-bold mt-1">{sp1Count}</p></div>
                    <div className="bg-white/10 rounded-lg p-4 text-center"><p className="text-orange-400 text-xs font-bold uppercase">Aktif SP 2</p><p className="text-2xl font-bold mt-1">{sp2Count}</p></div>
                    <div className="bg-white/10 rounded-lg p-4 text-center"><p className="text-red-400 text-xs font-bold uppercase">Aktif SP 3</p><p className="text-2xl font-bold mt-1">{sp3Count}</p></div>
                    <div className="bg-red-900/40 rounded-lg p-4 text-center border border-red-500/30"><p className="text-red-300 text-xs font-bold uppercase">Drop Out</p><p className="text-2xl font-bold mt-1">{doCount}</p></div>
                    <div className="bg-white/10 rounded-lg p-4 text-center"><p className="text-blue-300 text-xs font-bold uppercase">Penebusan</p><p className="text-2xl font-bold mt-1">{activeRedemptions}</p></div>
                </div>
            </div>

            {/* QUEUES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 h-80 overflow-y-auto">
                    <h3 className="font-bold text-sm text-blue-700 flex items-center gap-2 mb-3"><HeartHandshake className="h-4 w-4" /> Rujukan dari BK <span className="bg-blue-100 px-2 rounded-full text-xs">{bkHandledList.length}</span></h3>
                    <div className="space-y-2">
                        {bkHandledList.length === 0 ? <p className="text-center text-slate-400 text-xs py-10">Tidak ada rujukan.</p> : bkHandledList.map((item, i) => (
                            <div key={i} className="p-3 border rounded-lg hover:bg-slate-50 flex justify-between items-center">
                                <div><div className="font-bold text-slate-800 text-sm">{item.student?.name}</div><div className="text-xs text-slate-500">Skor: {item.score}</div></div>
                                <Link to={`/teacher/student/${item.student?.id}`} className="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold">Lihat</Link>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 h-80 overflow-y-auto">
                    <h3 className="font-bold text-sm text-orange-700 flex items-center gap-2 mb-3"><Gavel className="h-4 w-4" /> Antrian Sanksi (Butuh Tugas) <span className="bg-orange-100 px-2 rounded-full text-xs">{pendingTaskSanctions.length}</span></h3>
                    <div className="space-y-2">
                        {pendingTaskSanctions.length === 0 ? <p className="text-center text-slate-400 text-xs py-10">Tidak ada sanksi baru.</p> : pendingTaskSanctions.map((item, i) => (
                            <div key={i} className="p-3 border rounded-lg hover:bg-slate-50 flex justify-between items-center">
                                <div><div className="font-bold text-slate-800 text-sm">{item.student?.name}</div><div className="text-xs text-red-600 font-bold">{item.level}</div></div>
                                <button onClick={() => handleOpenTaskModal(item)} className="text-xs bg-orange-600 text-white px-3 py-1 rounded font-bold">Beri Tugas</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* RECENT ACTIVITY */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /> Aktivitas Terbaru</h2>
        <div className="space-y-4">
            {recentRecords.length === 0 ? <p className="text-slate-500 text-sm">Belum ada aktivitas.</p> : recentRecords.map(r => {
                const sName = students.find(s => s.id === r.studentId)?.name || 'Unknown';
                const iName = incidents.find(i => i.id === r.incidentTypeId)?.name || 'Unknown';
                return (
                    <div key={r.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div><div className="font-bold text-slate-700 text-sm">{sName}</div><div className="text-xs text-slate-500">{iName}</div></div>
                        <div className={`font-bold text-sm ${r.typeSnapshot === 'VIOLATION' ? 'text-red-500' : 'text-emerald-500'}`}>{r.pointSnapshot} Pt</div>
                    </div>
                );
            })}
        </div>
      </div>

      {/* TASK MODAL */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
                <h3 className="font-bold text-lg mb-4">Tetapkan Tugas Penebusan</h3>
                <div className="bg-slate-50 p-3 rounded mb-4 text-sm"><p>Siswa: <b>{selectedSanction?.student?.name}</b></p><p>Sanksi: <span className="text-red-600 font-bold">{selectedSanction?.level}</span></p></div>
                <input autoFocus type="text" className="w-full border p-3 rounded mb-4" placeholder="Deskripsi tugas..." value={taskInput} onChange={e => setTaskInput(e.target.value)} />
                <div className="flex justify-end gap-2"><button onClick={() => setShowTaskModal(false)} className="px-4 py-2 bg-slate-100 rounded text-slate-600 font-bold">Batal</button><button onClick={handleSaveTask} disabled={!taskInput.trim()} className="px-4 py-2 bg-orange-600 text-white rounded font-bold">Simpan</button></div>
            </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
           <div className="bg-white p-6 rounded-xl w-full max-w-sm">
              <h3 className="font-bold mb-4">Alasan Penolakan</h3>
              <textarea autoFocus className="w-full border p-2 rounded mb-4" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              <div className="flex justify-end gap-2"><button onClick={() => setRejectRecordId(null)} className="px-4 py-2 bg-slate-100 rounded">Batal</button><button onClick={confirmReject} className="px-4 py-2 bg-red-600 text-white rounded">Tolak</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
