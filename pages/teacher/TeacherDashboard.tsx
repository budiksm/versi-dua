
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { IncidentRecord, MasterIncidentType, IncidentTypeCategory, ClassGroup, Teacher, Role, Student, SanctionLevel, RedemptionStatus, CounselingSession, IncidentStatus, StudentSanction, CoachingRule } from '../../types';
import { AlertTriangle, Award, Clock, Star, Users, ArrowRight, UserX, Search, BookOpen, AlertCircle, HeartHandshake, Gavel, CheckCircle2, ClipboardList, UserCheck, ArrowUpRight, X, Inbox, Check, Ban, ChevronLeft, ChevronRight, Skull, Zap, PenTool, ExternalLink, TrendingUp, ShieldAlert, User, Calendar, LayoutGrid, UserPlus, Activity, MessageSquare, FileText, Paperclip, Link as LinkIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

// --- INTERFACE UNTUK TIMELINE STORY ---
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

const TeacherDashboard: React.FC = () => {
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [myClasses, setMyClasses] = useState<ClassGroup[]>([]);
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);
  
  // Data for Detail Modal Logic
  const [counselingSessions, setCounselingSessions] = useState<CounselingSession[]>([]);
  const [sanctions, setSanctions] = useState<StudentSanction[]>([]);

  // Approval Specific State
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [rejectRecordId, setRejectRecordId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Pagination State for Recent Activities
  const [recentPage, setRecentPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  // BK Specific State
  const [bkStats, setBkStats] = useState({
      activeCounseling: 0,
      mandatoryCases: 0,
      referrals: 0,
      highRiskCount: 0, 
      monthlySessions: 0
  });
  const [bkMandatoryList, setBkMandatoryList] = useState<any[]>([]);
  const [bkReferralList, setBkReferralList] = useState<any[]>([]);
  const [bkRecentActivity, setBkRecentActivity] = useState<CounselingSession[]>([]);

  // Kesiswaan Specific State
  const [allSanctions, setAllSanctions] = useState<StudentSanction[]>([]);
  const [sp1Count, setSp1Count] = useState<number>(0);
  const [sp2Count, setSp2Count] = useState<number>(0);
  const [sp3Count, setSp3Count] = useState<number>(0);
  const [doCount, setDoCount] = useState<number>(0); 
  const [activeRedemptions, setActiveRedemptions] = useState<number>(0);
  const [pendingTaskSanctions, setPendingTaskSanctions] = useState<any[]>([]); 
  
  // STATS DETAIL MODAL STATE
  const [showStatModal, setShowStatModal] = useState(false);
  const [selectedStatType, setSelectedStatType] = useState<string | null>(null); 
  
  // NEW: BK Referrals for Kesiswaan
  const [bkHandledList, setBkHandledList] = useState<{student: Student, score: number, session: CounselingSession}[]>([]);

  // QUICK TASK MODAL STATE
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedSanction, setSelectedSanction] = useState<any>(null);
  const [taskInput, setTaskInput] = useState('');

  // UNIFIED DETAIL MODAL STATE
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [storyLine, setStoryLine] = useState<StoryStep[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    refreshDashboard();
    const unsubscribe = DataService.subscribeToDataChanges(() => {
        refreshDashboard();
    });
    return () => unsubscribe();
  }, []);

  // --- HELPER UNTUK MENDAPATKAN AMBANG BATAS DINAMIS ---
  const getDynamicThresholds = (rules: CoachingRule[]) => {
      const getRuleMin = (keyword: string, defaultVal: number) => {
          const r = rules.find(x => x.statusLabel.toUpperCase().includes(keyword));
          return r ? r.minPoints : defaultVal;
      };
      
      return {
          bk: getRuleMin('BK', 40),
          sp1: getRuleMin('SP 1', 80),
          sp2: getRuleMin('SP 2', 120),
          sp3: getRuleMin('SP 3', 160)
      };
  };

  const refreshDashboard = () => {
    const user = DataService.getCurrentUser();
    setCurrentUser(user);

    if (user && user.roles.includes(Role.STUDENT) && !user.roles.includes(Role.TEACHER)) {
        navigate('/teacher/poe-ibu');
        return;
    }
    if (user && user.roles.includes(Role.OSIS) && !user.roles.includes(Role.TEACHER)) {
        navigate('/teacher/osis/input');
        return;
    }
    
    const recs = DataService.getRecords();
    const incs = DataService.getIncidentTypes();
    const stds = DataService.getStudents();
    const rules = DataService.getRules();
    const counselings = DataService.getCounselingSessions();
    const allSanctionsList = DataService.getSanctions();
    const classes = DataService.getClasses();

    setRecords(recs);
    setIncidents(incs);
    setStudents(stds);
    setCounselingSessions(counselings); 
    setSanctions(allSanctionsList); 
    setAllClasses(classes);
    
    if (user) {
      const myClassGroups = classes.filter(c => c.homeroomTeacherId === user.id);
      setMyClasses(myClassGroups);

      if (myClassGroups.length > 0) {
         const myStudentIds = stds.filter(s => myClassGroups.some(c => c.id === s.classId)).map(s => s.id);
         const now = new Date().getTime();
         const AUTO_ACCEPT_MS = 2 * 24 * 60 * 60 * 1000; 

         const pendings = recs.filter(r => {
            const isMyStudent = myStudentIds.includes(r.studentId);
            const isPending = r.status === 'PENDING'; 
            const isNotAutoAccepted = (now - new Date(r.date).getTime()) < AUTO_ACCEPT_MS;
            return isMyStudent && isPending && isNotAutoAccepted;
         }).map(r => ({
            ...r,
            studentName: stds.find(s => s.id === r.studentId)?.name || 'Unknown',
            incidentName: incs.find(i => i.id === r.incidentTypeId)?.name || 'Unknown'
         }));
         setPendingApprovals(pendings);
      }

      // --- LOGIKA DASHBOARD BK (DINAMIS) ---
      if (user.roles.includes(Role.BK)) {
        const thresholds = getDynamicThresholds(rules);
        let activeCount = 0;
        let mandatoryCount = 0;
        let referralCount = 0;
        let highRiskCount = 0;
        let monthlyCount = 0;

        const currentMonth = new Date().getMonth();
        const mandatoryListTemp: any[] = [];
        const referralListTemp: any[] = [];

        stds.forEach(s => {
            const stats = DataService.calculateStudentPoints(s.id, recs, incs);
            const sSessions = counselings.filter(c => c.studentId === s.id);
            const latestSession = sSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const latestHomeroom = sSessions.find(c => c.sessionType === 'HOMEROOM');

            if (latestSession && latestSession.status === 'OPEN') {
                activeCount++;
            }

            const hasRequiredRecord = recs.some(r => r.studentId === s.id && r.bkStatus === 'REQUIRED');
            const latestBKSession = sSessions.filter(c => c.sessionType === 'BK').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const latestViolation = recs.filter(r => r.studentId === s.id && r.typeSnapshot === IncidentTypeCategory.VIOLATION).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            
            let unhandledHighScore = false;
            if (stats.effectiveViolationScore >= thresholds.bk) {
               if (!latestBKSession) {
                  unhandledHighScore = true;
               } else if (latestViolation && new Date(latestViolation.date).getTime() > new Date(latestBKSession.date).getTime()) {
                  unhandledHighScore = true;
               }
            }

            if (hasRequiredRecord || unhandledHighScore) {
                mandatoryCount++;
                const activeViolations = recs.filter(r => r.studentId === s.id && (r.bkStatus === 'REQUIRED' || (r.pointSnapshot >= 10 && r.typeSnapshot === IncidentTypeCategory.VIOLATION))).sort((a,b) => b.pointSnapshot - a.pointSnapshot);
                const topViolation = activeViolations[0];
                
                if (topViolation) { 
                    mandatoryListTemp.push({
                        student: s,
                        score: stats.effectiveViolationScore,
                        className: classes.find(c => c.id === s.classId)?.name || '-',
                        topIncident: incs.find(i => i.id === topViolation.incidentTypeId)?.name || 'Akumulasi Poin',
                        incidentDate: topViolation.date
                    });
                } else if (stats.effectiveViolationScore >= thresholds.bk) {
                    mandatoryListTemp.push({
                        student: s,
                        score: stats.effectiveViolationScore,
                        className: classes.find(c => c.id === s.classId)?.name || '-',
                        topIncident: 'Akumulasi Poin Tinggi',
                        incidentDate: new Date().toISOString()
                    });
                }
            }

            if (latestHomeroom && latestHomeroom.recommendation === 'TO_BK') {
                const newerBKSession = sSessions.find(c => c.sessionType === 'BK' && new Date(c.date) > new Date(latestHomeroom.date));
                const relatedIds = latestHomeroom.relatedRecordIds || [];
                const allRelatedResolved = relatedIds.length > 0 && relatedIds.every(id => {
                    const r = recs.find(rec => rec.id === id);
                    return r && r.bkStatus === 'COMPLETED';
                });

                if (!newerBKSession && !allRelatedResolved) {
                    referralCount++;
                    referralListTemp.push({
                        student: s,
                        className: classes.find(c => c.id === s.classId)?.name || '-',
                        homeroomName: latestHomeroom.counselorName,
                        date: latestHomeroom.date,
                        note: latestHomeroom.notes
                    });
                }
            }

            if (stats.effectiveViolationScore >= (thresholds.sp1 * 0.7) && stats.effectiveViolationScore < thresholds.sp3) {
                highRiskCount++;
            }
        });

        monthlyCount = counselings.filter(c => new Date(c.date).getMonth() === currentMonth).length;
        const recentActivity = counselings.filter(c => c.sessionType === 'BK').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

        setBkStats({ activeCounseling: activeCount, mandatoryCases: mandatoryCount, referrals: referralCount, highRiskCount: highRiskCount, monthlySessions: monthlyCount });
        setBkMandatoryList(mandatoryListTemp.sort((a,b) => b.score - a.score).slice(0, 10)); 
        setBkReferralList(referralListTemp.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setBkRecentActivity(recentActivity);
      }

      if (user.roles.includes(Role.KESISWAAN)) {
        setAllSanctions(allSanctionsList);
        const sp1 = allSanctionsList.filter(s => s.level === SanctionLevel.SP1 && !s.isRedeemed).length;
        const sp2 = allSanctionsList.filter(s => s.level === SanctionLevel.SP2 && !s.isRedeemed).length;
        const sp3 = allSanctionsList.filter(s => s.level === SanctionLevel.SP3 && !s.isRedeemed).length;
        const doStat = allSanctionsList.filter(s => s.level === SanctionLevel.DROP_OUT).length;
        const activeRed = allSanctionsList.filter(s => s.redemptionStatus === RedemptionStatus.IN_PROGRESS).length;

        setSp1Count(sp1);
        setSp2Count(sp2);
        setSp3Count(sp3);
        setDoCount(doStat);
        setActiveRedemptions(activeRed);

        const unhandledSanctions = allSanctionsList
            .filter(s => s.redemptionStatus === RedemptionStatus.NONE)
            .map(s => {
                const stud = stds.find(st => st.id === s.studentId);
                if (!stud) return null;
                const stats = DataService.calculateStudentPoints(stud.id, recs, incs);
                return {
                    sanctionId: s.id,
                    student: stud,
                    level: s.level,
                    date: s.assignedDate,
                    currentScore: stats.effectiveViolationScore,
                    className: classes.find(c => c.id === stud.classId)?.name || 'Unknown'
                };
            })
            .filter(Boolean) as any[];

        setPendingTaskSanctions(unhandledSanctions.sort((a,b) => b.currentScore - a.currentScore));

        const bkReferrals: {student: Student, score: number, session: CounselingSession}[] = [];
        stds.forEach(s => {
             const sSessions = counselings.filter(c => c.studentId === s.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
             const latestSession = sSessions[0];
             // Check if recommendation is directed to Kesiswaan
             if (latestSession && (latestSession.recommendation === 'TO_KESISWAAN' || latestSession.recommendation === 'SUSPENSION_REVIEW')) {
                 // But wait, has this been handled? 
                 // If there is a sanction created AFTER this session, it's handled.
                 const handledSanction = allSanctionsList.find(san => san.studentId === s.id && new Date(san.assignedDate) > new Date(latestSession.date));
                 
                 if (!handledSanction) {
                     const stats = DataService.calculateStudentPoints(s.id, recs, incs);
                     bkReferrals.push({ student: s, score: stats.effectiveViolationScore, session: latestSession });
                 }
             }
        });
        setBkHandledList(bkReferrals);
      }
    }
  }

  const translateRecommendation = (rec: string) => {
    switch(rec) {
      case 'PARENT_CALL': return 'Panggilan Orang Tua';
      case 'TO_KESISWAAN': return 'Rujuk ke Kesiswaan';
      case 'SUSPENSION_REVIEW': return 'Tinjauan Skorsing';
      case 'TO_BK': return 'Rujuk ke BK';
      default: return '-';
    }
  };

  const handleOpenDetail = (item: IncidentRecord | CounselingSession | StudentSanction) => {
      const story: StoryStep[] = [];
      let relatedIncidentIds: string[] = [];
      if ('incidentTypeId' in item) relatedIncidentIds = [item.id];
      else if ('sessionType' in item) relatedIncidentIds = item.relatedRecordIds || [];

      const relatedIncidents = records.filter(r => relatedIncidentIds.includes(r.id));
      relatedIncidents.forEach(inc => {
          const incName = incidents.find(i => i.id === inc.incidentTypeId)?.name || 'Unknown';
          story.push({
              id: inc.id,
              date: inc.date,
              type: 'INCIDENT',
              title: 'Pencatatan Pelanggaran',
              actor: `Guru: ${inc.recordedBy}`,
              description: `${incName}. ${inc.notes}`,
              statusLabel: inc.status === 'PENDING' ? 'Menunggu Verifikasi' : 'Terverifikasi',
              statusColor: inc.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700',
              attachmentUrl: inc.proofImage,
              scoreImpact: inc.pointSnapshot
          });
      });
      
      const relevantSessions = counselingSessions.filter(s => 
          s.relatedRecordIds?.some(id => relatedIncidentIds.includes(id)) ||
          ('id' in item && item.id === s.id)
      );
      relevantSessions.forEach(sess => {
          story.push({
              id: sess.id,
              date: sess.date,
              type: sess.sessionType === 'BK' ? 'COUNSELING_BK' : 'COUNSELING_WALAS',
              title: sess.sessionType === 'BK' ? 'Konseling BK' : 'Pembinaan Wali Kelas',
              actor: `${sess.sessionType === 'BK' ? 'Guru BK' : 'Wali Kelas'}: ${sess.counselorName}`,
              description: sess.notes,
              statusLabel: sess.recommendation !== 'NONE' ? translateRecommendation(sess.recommendation) : 'Selesai',
              statusColor: 'bg-blue-100 text-blue-700'
          });
      });

      if ('level' in item) {
          const s = item as StudentSanction;
          story.push({ id: s.id, date: s.assignedDate, type: 'SANCTION', title: 'Tindakan Kesiswaan', actor: `Kesiswaan (${s.assignedBy})`, description: `Diterbitkan ${s.level}. ${s.notes}`, statusLabel: s.redemptionStatus === 'COMPLETED' ? 'Sanksi Selesai' : 'Sanksi Aktif', statusColor: 'bg-red-100 text-red-700' });
      }

      story.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setStoryLine(story);
      setDetailModalOpen(true);
  };

  const handleOpenStatModal = (type: string) => {
    setSelectedStatType(type);
    setShowStatModal(true);
  };

  const handleOpenTaskModal = (sanctionItem: any) => {
      setSelectedSanction(sanctionItem);
      setTaskInput('');
      setShowTaskModal(true);
  };

  const handleSaveTask = () => {
      if(!selectedSanction || !currentUser || !taskInput.trim()) return;
      const allSanctionsList = DataService.getSanctions();
      const updatedSanctions = allSanctionsList.map(s => {
          if (s.id === selectedSanction.sanctionId) {
              return {
                  ...s,
                  redemptionTask: taskInput,
                  redemptionStatus: RedemptionStatus.ASSIGNED, 
                  assignedBy: `${s.assignedBy} & ${currentUser.name}` 
              };
          }
          return s;
      });
      DataService.saveSanctions(updatedSanctions);
      setShowTaskModal(false);
      setTaskInput('');
      setSelectedSanction(null);
      refreshDashboard();
      alert("Tugas penebusan berhasil ditetapkan!");
  };

  const handleApprove = (id: string) => { DataService.resolveIncident(id, 'APPROVED'); const rec = records.find(r => r.id === id); if (rec) DataService.evaluateAndApplySanction(rec.studentId); refreshDashboard(); };
  const handleRejectClick = (id: string) => { setRejectRecordId(id); setRejectReason(''); };
  const confirmReject = () => { if (rejectRecordId && rejectReason) { DataService.resolveIncident(rejectRecordId, 'REJECTED', rejectReason); setRejectRecordId(null); refreshDashboard(); } else { alert("Alasan penolakan wajib diisi."); } };
  
  const getIncidentName = (id: string) => incidents.find(i => i.id === id)?.name || 'Unknown';
  const getStudentName = (id: string) => students.find(s => s.id === id)?.name || 'Unknown';

  const isBK = currentUser?.roles.includes(Role.BK);
  const isKesiswaan = currentUser?.roles.includes(Role.KESISWAAN);
  const isAdmin = currentUser?.roles.includes(Role.ADMIN);
  const shouldFilterMyClass = myClasses.length > 0 && !isKesiswaan && !isAdmin && !isBK;
  const myStudentIds = students.filter(s => myClasses.some(c => c.id === s.classId)).map(s => s.id);

  const allRecentRecords = [...records].filter(r => { if (r.status === 'REJECTED') return false; if (shouldFilterMyClass) return myStudentIds.includes(r.studentId); return true; }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalPages = Math.ceil(allRecentRecords.length / ITEMS_PER_PAGE);
  const currentRecords = allRecentRecords.slice(recentPage * ITEMS_PER_PAGE, (recentPage + 1) * ITEMS_PER_PAGE);
  const handlePrevPage = () => { if (recentPage > 0) setRecentPage(prev => prev - 1); };
  const handleNextPage = () => { if (recentPage < totalPages - 1) setRecentPage(prev => prev + 1); };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER & APPROVALS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800">Dashboard Guru</h1><p className="text-slate-500">Selamat datang, <span className="font-semibold text-indigo-600">{currentUser?.name}</span>.</p></div>
      </div>

      {pendingApprovals.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2"><Clock className="h-5 w-5" /> Menunggu Persetujuan Anda</h2>
          <div className="space-y-3">
            {pendingApprovals.map(r => (
              <div key={r.id} className="bg-white p-4 rounded-lg border border-yellow-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                   <div className="bg-red-100 p-2 rounded-full text-red-600"><AlertCircle className="h-5 w-5" /></div>
                   <div><p className="font-bold text-slate-800">{r.studentName}</p><p className="text-sm text-slate-600">{r.incidentName} • {new Date(r.date).toLocaleDateString()}</p><p className="text-xs text-slate-400 mt-1">Pelapor: {r.recordedBy}</p></div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                   <button onClick={() => handleRejectClick(r.id)} className="flex-1 md:flex-none px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200">Tolak</button>
                   <button onClick={() => handleApprove(r.id)} className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-md">Setujui</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- KESISWAAN DASHBOARD --- */}
      {isKesiswaan && (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 pointer-events-none"><Gavel className="h-64 w-64 -mr-16 -mt-16" /></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-orange-500 rounded-lg"><Gavel className="h-6 w-6 text-white" /></div><div><h2 className="text-xl font-bold">Dashboard Kesiswaan</h2><p className="text-slate-400 text-sm">Pusat kontrol ketertiban dan kedisiplinan sekolah</p></div></div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div onClick={() => handleOpenStatModal(SanctionLevel.SP1)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-orange-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 1 <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{sp1Count}</p></div>
                        <div onClick={() => handleOpenStatModal(SanctionLevel.SP2)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 2 <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{sp2Count}</p></div>
                        <div onClick={() => handleOpenStatModal(SanctionLevel.SP3)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 3 <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{sp3Count}</p></div>
                        <div onClick={() => handleOpenStatModal(SanctionLevel.DROP_OUT)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-red-500/50 bg-red-900/30 cursor-pointer hover:bg-red-900/50 transition-all hover:scale-105"><p className="text-red-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Skull className="h-3 w-3" /> Drop Out <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{doCount}</p></div>
                        <div onClick={() => handleOpenStatModal('REDEMPTION')} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-blue-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Penebusan Jalan <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{activeRedemptions}</p></div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ANTREAN SANKSI */}
                        <div className="bg-slate-700/50 rounded-xl border border-white/10 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-sm flex items-center gap-2 text-orange-300"><ClipboardList className="h-4 w-4" /> Antrean Sanksi Otomatis</h3>
                                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingTaskSanctions.length}</span>
                            </div>
                            <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                                {pendingTaskSanctions.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 text-xs">Aman. Tidak ada sanksi baru yang butuh tugas.</div>
                                ) : (
                                    pendingTaskSanctions.map((item, idx) => (
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors flex justify-between items-center group">
                                            <div>
                                                <div className="font-bold text-sm">{item.student.name} <span className="text-slate-400 font-normal">({item.className})</span></div>
                                                <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                                                    <span className="text-red-400 font-bold">{item.level}</span> • Skor: {item.currentScore}
                                                </div>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenTaskModal(item); }} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded shadow-sm cursor-pointer z-10">Beri Tugas</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* RUJUKAN TINDAK LANJUT DARI BK */}
                        <div className="bg-slate-700/50 rounded-xl border border-white/10 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-sm flex items-center gap-2 text-blue-300"><HeartHandshake className="h-4 w-4" /> Rujukan Tindakan Lanjut (Dari BK)</h3>
                                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{bkHandledList.length}</span>
                            </div>
                            <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                                {bkHandledList.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 text-xs">Tidak ada rujukan eskalasi dari BK.</div>
                                ) : (
                                    bkHandledList.map((item, idx) => (
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-sm">{item.student.name}</div>
                                                    <div className="text-xs text-slate-400">Skor Poin: {item.score}</div>
                                                </div>
                                                <Link to={`/teacher/student/${item.student.id}`} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-sm">Proses Sanksi</Link>
                                            </div>
                                            <div className="bg-blue-900/30 p-2 rounded border border-blue-500/30 text-xs">
                                                <div className="flex items-center gap-1 font-bold text-blue-300 mb-1"><ArrowRight className="h-3 w-3" /> RUJUKAN DARI BK:</div>
                                                <div className="text-slate-300">Rek: <span className="text-white font-medium">{translateRecommendation(item.session.recommendation)}</span></div>
                                                <div className="text-slate-400 italic mt-1">"{item.session.notes}"</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- DASHBOARD BK --- */}
      {isBK && (
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kasus Aktif</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-indigo-600">{bkStats.activeCounseling}</h3><Activity className="h-6 w-6 text-indigo-200" /></div></div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Wajib Konseling</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-red-600">{bkStats.mandatoryCases}</h3><AlertCircle className="h-6 w-6 text-red-200" /></div></div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rujukan Wali Kelas</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-orange-600">{bkStats.referrals}</h3><Inbox className="h-6 w-6 text-orange-200" /></div></div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sesi Bulan Ini</p><div className="flex items-end justify-between mt-2"><h3 className="text-3xl font-bold text-emerald-600">{bkStats.monthlySessions}</h3><Calendar className="h-6 w-6 text-emerald-200" /></div></div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800 flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-600" /> Kasus Prioritas (Wajib)</h3><Link to="/teacher/bk/active" className="text-xs font-bold text-indigo-600 hover:underline">Lihat Semua</Link></div>
                 <div className="divide-y divide-slate-100">
                    {bkMandatoryList.length === 0 ? <div className="p-6 text-center text-slate-500 text-sm">Tidak ada kasus prioritas saat ini.</div> : 
                       bkMandatoryList.map((item, idx) => (
                          <div key={idx} className="p-4 hover:bg-slate-50 flex justify-between items-center">
                             <div><p className="font-bold text-slate-900 text-sm">{item.student.name} <span className="text-slate-500 font-normal">({item.className})</span></p><p className="text-xs text-red-600 font-medium mt-0.5">{item.topIncident} • {new Date(item.incidentDate).toLocaleDateString()}</p></div>
                             <Link to={`/teacher/student/${item.student.id}`} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100">Tangani</Link>
                          </div>
                       ))
                    }
                 </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Inbox className="h-5 w-5 text-orange-600" /> Rujukan Wali Kelas</h3><span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{bkReferralList.length}</span></div>
                 <div className="divide-y divide-slate-100">
                    {bkReferralList.length === 0 ? <div className="p-6 text-center text-slate-500 text-sm">Belum ada rujukan masuk.</div> : 
                       bkReferralList.map((item, idx) => (
                          <div key={idx} className="p-4 hover:bg-slate-50">
                             <div className="flex justify-between items-start mb-2"><div><p className="font-bold text-slate-900 text-sm">{item.student.name}</p><p className="text-xs text-slate-500">Dari: {item.homeroomName}</p></div><Link to={`/teacher/student/${item.student.id}`} className="px-3 py-1.5 bg-orange-50 text-orange-600 text-xs font-bold rounded-lg hover:bg-orange-100">Proses</Link></div>
                             <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded italic line-clamp-2">"{item.note}"</p>
                          </div>
                       ))
                    }
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- DASHBOARD GURU MAPEL / WALI KELAS --- */}
      {myClasses.length > 0 && !isKesiswaan && !isAdmin && !isBK && (
        <div className="space-y-4">
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="h-5 w-5 text-indigo-600" /> Kelas Saya</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myClasses.map(cls => (
                 <Link key={cls.id} to={`/teacher/classes/${cls.id}`} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group">
                    <div className="flex justify-between items-start mb-2"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Users className="h-6 w-6" /></div><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{students.filter(s => s.classId === cls.id).length} Siswa</span></div>
                    <h3 className="text-lg font-bold text-slate-900">{cls.name}</h3><p className="text-xs text-slate-500 mt-1">Kelola Siswa & Laporan</p>
                 </Link>
              ))}
           </div>
        </div>
      )}

      {/* --- RECENT ACTIVITY (GLOBAL) --- */}
      <div className="space-y-4">
         <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /> Aktivitas Terbaru Sekolah</h2>
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
               {currentRecords.length === 0 ? <div className="p-8 text-center text-slate-500">Belum ada aktivitas tercatat.</div> : 
                  currentRecords.map(r => (
                     <div key={r.id} onClick={() => handleOpenDetail(r as any)} className="p-4 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors group">
                        <div className="flex items-center gap-4">
                           <div className={`p-2 rounded-full shrink-0 ${r.typeSnapshot === 'VIOLATION' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{r.typeSnapshot === 'VIOLATION' ? <ShieldAlert className="h-5 w-5" /> : <Award className="h-5 w-5" />}</div>
                           <div><p className="text-sm font-bold text-slate-900"><span className="text-indigo-600">{getStudentName(r.studentId)}</span> - {getIncidentName(r.incidentTypeId)}</p><p className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()} • Oleh {r.recordedBy}</p></div>
                        </div>
                        <div className="text-right"><span className={`text-sm font-bold ${r.typeSnapshot === 'VIOLATION' ? 'text-red-600' : 'text-emerald-600'}`}>{r.typeSnapshot === 'VIOLATION' ? '+' : ''}{r.pointSnapshot} Poin</span><div className="text-[10px] text-slate-400 group-hover:text-indigo-500 transition-colors">Lihat Detail</div></div>
                     </div>
                  ))
               }
            </div>
            {currentRecords.length > 0 && (
               <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                  <button onClick={handlePrevPage} disabled={recentPage === 0} className="p-2 hover:bg-slate-200 rounded-lg disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-xs text-slate-500 font-medium">Halaman {recentPage + 1}</span>
                  <button onClick={handleNextPage} disabled={recentPage >= Math.ceil(records.length/ITEMS_PER_PAGE)-1} className="p-2 hover:bg-slate-200 rounded-lg disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
               </div>
            )}
         </div>
      </div>

      {/* --- MODALS --- */}
      {showTaskModal && selectedSanction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold mb-2">Beri Tugas Penebusan</h3>
                <p className="text-sm text-slate-500 mb-4">Siswa: {selectedSanction.student.name} ({selectedSanction.level})</p>
                <textarea className="w-full border p-3 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} placeholder="Contoh: Membersihkan perpustakaan selama 3 hari..." value={taskInput} onChange={e => setTaskInput(e.target.value)} />
                <div className="flex justify-end gap-2"><button onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-bold">Batal</button><button onClick={handleSaveTask} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold">Simpan Tugas</button></div>
            </div>
        </div>
      )}
      
      {showStatModal && selectedStatType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                 <button onClick={() => setShowStatModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="h-6 w-6" /></button>
                 <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Gavel className="h-5 w-5 text-indigo-600" /> Detail Data: {selectedStatType === 'REDEMPTION' ? 'Penebusan Berjalan' : selectedStatType}</h3>
                 <div className="max-h-[60vh] overflow-y-auto space-y-2">
                    {(() => {
                        let list: any[] = [];
                        if (selectedStatType === 'REDEMPTION') list = allSanctions.filter(s => s.redemptionStatus === RedemptionStatus.IN_PROGRESS);
                        else list = allSanctions.filter(s => s.level === selectedStatType && !s.isRedeemed);
                        
                        if(list.length === 0) return <p className="text-slate-500 italic text-center py-4">Tidak ada data aktif untuk kategori ini.</p>;
                        
                        return list.map((item, idx) => {
                             const st = students.find(s => s.id === item.studentId);
                             const cl = allClasses.find(c => c.id === st?.classId) || DataService.getClasses().find(c => c.id === st?.classId);
                             return (<div key={idx} className="p-3 border rounded-lg hover:bg-slate-50 flex justify-between items-center cursor-pointer" onClick={() => navigate(`/teacher/student/${item.studentId}`)}><div><p className="font-bold text-slate-800">{st?.name} <span className="font-normal text-slate-500">({cl?.name || '?'})</span></p><p className="text-xs text-slate-500">Sejak: {new Date(item.assignedDate).toLocaleDateString()}</p></div><div className="text-right"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold">{item.level}</span></div></div>)
                        })
                    })()}
                 </div>
            </div>
        </div>
      )}

      {/* DETAIL MODAL TIMELINE */}
      {detailModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
                        <h2 className="font-bold text-lg flex items-center gap-2"><LinkIcon className="h-5 w-5 text-indigo-400" /> Riwayat Kasus Terpadu</h2>
                        <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        <div className="space-y-0 relative">
                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>
                            {storyLine.map((step, idx) => (
                                <div key={step.id} className="relative z-10 flex gap-4 mb-8 last:mb-0 group">
                                    <div className={`w-12 h-12 rounded-full border-4 border-slate-50 flex items-center justify-center shrink-0 shadow-sm ${step.type === 'INCIDENT' ? 'bg-white text-slate-600' : step.type === 'APPROVAL' ? 'bg-green-100 text-green-600' : step.type === 'COUNSELING_WALAS' ? 'bg-orange-100 text-orange-600' : step.type === 'COUNSELING_BK' ? 'bg-blue-100 text-blue-600' : 'bg-red-600 text-white'}`}>
                                        {step.type === 'INCIDENT' && <FileText className="h-5 w-5" />}
                                        {step.type === 'APPROVAL' && <CheckCircle2 className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_WALAS' && <User className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_BK' && <HeartHandshake className="h-5 w-5" />}
                                        {step.type === 'SANCTION' && <Gavel className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2"><div><h4 className="font-bold text-slate-800 text-base">{step.title}</h4><p className="text-xs text-slate-500 font-mono mt-0.5">{new Date(step.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {new Date(step.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p></div>{step.statusLabel && <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${step.statusColor || 'bg-slate-100 text-slate-600'}`}>{step.statusLabel}</span>}</div>
                                        <div className="text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100"><span className="font-semibold">Oleh:</span> {step.actor} {step.scoreImpact && <span className="ml-2 font-bold text-red-600">(Bobot: {step.scoreImpact} Poin)</span>}</div>
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{step.description || '-'}"</p>
                                        {step.attachmentUrl && (<div className="mt-3 flex justify-end"><button onClick={() => setPreviewImage(step.attachmentUrl || null)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors border border-slate-200"><Paperclip className="h-3 w-3" /> Lampiran Bukti</button></div>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-4 border-t border-slate-200 flex justify-end"><button onClick={() => setDetailModalOpen(false)} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm">Tutup</button></div>
                </div>
            </div>
      )}

      {/* REJECT REASON MODAL */}
      {rejectRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
           <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold mb-4">Alasan Penolakan</h3>
              <textarea autoFocus className="w-full border p-3 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-red-500 outline-none" rows={3} placeholder="Tulis alasan..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              <div className="flex justify-end gap-2"><button onClick={() => setRejectRecordId(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold">Batal</button><button onClick={confirmReject} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold">Tolak Laporan</button></div>
           </div>
        </div>
      )}

      {previewImage && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300"><X className="h-8 w-8" /></button>
                <img src={previewImage} alt="Preview Bukti" className="max-w-full max-h-[90vh] rounded shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
