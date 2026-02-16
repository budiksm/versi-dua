
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { IncidentRecord, MasterIncidentType, IncidentTypeCategory, ClassGroup, Teacher, Role, Student, SanctionLevel, RedemptionStatus, CounselingSession, IncidentStatus, StudentSanction } from '../../types';
import { AlertTriangle, Award, Clock, Star, Users, ArrowRight, UserX, Search, BookOpen, AlertCircle, HeartHandshake, Gavel, CheckCircle2, ClipboardList, UserCheck, ArrowUpRight, X, Inbox, Check, Ban, ChevronLeft, ChevronRight, Skull, Zap, PenTool, ExternalLink, TrendingUp, ShieldAlert, User, Calendar } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const TeacherDashboard: React.FC = () => {
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [myClasses, setMyClasses] = useState<ClassGroup[]>([]);
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);
  
  // Approval Specific State
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [rejectRecordId, setRejectRecordId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Pagination State for Recent Activities
  const [recentPage, setRecentPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  // BK Specific State
  const [highRiskStudents, setHighRiskStudents] = useState<{student: Student, score: number, status: string}[]>([]);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<Student[]>([]);
  const [counselingCount, setCounselingCount] = useState(0);

  // Kesiswaan Specific State
  const [allSanctions, setAllSanctions] = useState<StudentSanction[]>([]);
  const [sp1Count, setSp1Count] = useState<number>(0);
  const [sp2Count, setSp2Count] = useState<number>(0);
  const [sp3Count, setSp3Count] = useState<number>(0);
  const [doCount, setDoCount] = useState<number>(0); 
  const [activeRedemptions, setActiveRedemptions] = useState<number>(0);
  const [pendingTaskSanctions, setPendingTaskSanctions] = useState<any[]>([]); 
  
  // STATS DETAIL MODAL STATE (General)
  const [showStatModal, setShowStatModal] = useState(false);
  const [selectedStatType, setSelectedStatType] = useState<string | null>(null); 
  
  // CLASS DETAIL MODAL STATE (Homeroom Interactive)
  const [classDetail, setClassDetail] = useState<{
    isOpen: boolean;
    title: string;
    type: 'STUDENTS' | 'INCIDENTS'; // Mode tampilan
    data: any[]; // Data array
  }>({ isOpen: false, title: '', type: 'STUDENTS', data: [] });

  // NEW: BK Referrals for Kesiswaan
  const [bkHandledList, setBkHandledList] = useState<{student: Student, score: number, session: CounselingSession}[]>([]);

  // QUICK TASK MODAL STATE
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedSanction, setSelectedSanction] = useState<any>(null);
  const [taskInput, setTaskInput] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    refreshDashboard();
    
    // Subscribe to Realtime Updates
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
    if (user && user.roles.includes(Role.OSIS) && !user.roles.includes(Role.TEACHER)) {
        navigate('/teacher/osis/input');
        return;
    }
    
    const recs = DataService.getRecords();
    const incs = DataService.getIncidentTypes();
    const stds = DataService.getStudents();
    const rules = DataService.getRules();
    const counselings = DataService.getCounselingSessions();
    const sanctions = DataService.getSanctions();
    const classes = DataService.getClasses();

    setRecords(recs);
    setIncidents(incs);
    setStudents(stds);
    setCounselingCount(counselings.length);
    
    if (user) {
      const myClassGroups = classes.filter(c => c.homeroomTeacherId === user.id);
      setMyClasses(myClassGroups);

      if (myClassGroups.length > 0) {
         const myStudentIds = stds.filter(s => myClassGroups.some(c => c.id === s.classId)).map(s => s.id);
         const now = new Date().getTime();
         const AUTO_ACCEPT_MS = 2 * 24 * 60 * 60 * 1000; 

         const pendings = recs.filter(r => {
            const isMyStudent = myStudentIds.includes(r.studentId);
            const isPending = r.status === 'PENDING' || (!r.status && false); 
            const isNotAutoAccepted = (now - new Date(r.date).getTime()) < AUTO_ACCEPT_MS;
            return isMyStudent && isPending && isNotAutoAccepted;
         }).map(r => ({
            ...r,
            studentName: stds.find(s => s.id === r.studentId)?.name || 'Unknown',
            incidentName: incs.find(i => i.id === r.incidentTypeId)?.name || 'Unknown'
         }));
         setPendingApprovals(pendings);
      }

      if (user.roles.includes(Role.BK)) {
        const riskList: {student: Student, score: number, status: string}[] = [];
        stds.forEach(s => {
          const stats = DataService.calculateStudentPoints(s.id, recs, incs);
          if (stats.effectiveViolationScore >= 40) {
             const status = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
             riskList.push({
               student: s,
               score: stats.effectiveViolationScore,
               status: status.statusLabel
             });
          }
        });
        setHighRiskStudents(riskList.sort((a,b) => b.score - a.score).slice(0, 10));
      }

      if (user.roles.includes(Role.KESISWAAN)) {
        setAllSanctions(sanctions);
        const sp1 = sanctions.filter(s => s.level === SanctionLevel.SP1 && !s.isRedeemed).length;
        const sp2 = sanctions.filter(s => s.level === SanctionLevel.SP2 && !s.isRedeemed).length;
        const sp3 = sanctions.filter(s => s.level === SanctionLevel.SP3 && !s.isRedeemed).length;
        const doStat = sanctions.filter(s => s.level === SanctionLevel.DROP_OUT).length;
        const activeRed = sanctions.filter(s => s.redemptionStatus === RedemptionStatus.IN_PROGRESS).length;

        setSp1Count(sp1);
        setSp2Count(sp2);
        setSp3Count(sp3);
        setDoCount(doStat);
        setActiveRedemptions(activeRed);

        const unhandledSanctions = sanctions
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
             if (latestSession && (latestSession.recommendation === 'TO_KESISWAAN' || latestSession.recommendation === 'SUSPENSION_REVIEW')) {
                 const stats = DataService.calculateStudentPoints(s.id, recs, incs);
                 bkReferrals.push({ student: s, score: stats.effectiveViolationScore, session: latestSession });
             }
        });
        setBkHandledList(bkReferrals);
      }
    }
  }

  // --- INTERACTIVE HANDLER FOR WALIKELAS CARD ---
  const handleOpenClassDetail = (title: string, type: 'STUDENTS' | 'INCIDENTS', data: any[]) => {
      setClassDetail({
          isOpen: true,
          title,
          type,
          data
      });
  };

  // --- STATS MODAL HANDLERS ---
  const handleOpenStatModal = (type: string) => {
      setSelectedStatType(type);
      setShowStatModal(true);
  };

  const getStudentsForStatModal = () => {
      if (!selectedStatType) return [];
      const allClasses = DataService.getClasses(); 
      let filteredSanctions: StudentSanction[] = [];

      if (selectedStatType === 'REDEMPTION') {
          filteredSanctions = allSanctions.filter(s => s.redemptionStatus === RedemptionStatus.IN_PROGRESS);
      } else {
          filteredSanctions = allSanctions.filter(s => s.level === selectedStatType && !s.isRedeemed);
      }

      return filteredSanctions.map(s => {
          const st = students.find(student => student.id === s.studentId);
          const cl = allClasses.find(c => c.id === st?.classId);
          return {
              id: s.id,
              studentId: s.studentId,
              studentName: st?.name || 'Unknown',
              studentNis: st?.nis || '-',
              className: cl?.name || '-',
              date: s.assignedDate,
              notes: s.notes
          };
      });
  };

  const handleOpenTaskModal = (sanctionItem: any) => {
      setSelectedSanction(sanctionItem);
      setTaskInput('');
      setShowTaskModal(true);
  };

  const handleSaveTask = () => {
      if(!selectedSanction || !currentUser || !taskInput.trim()) return;
      const allSanctions = DataService.getSanctions();
      const updatedSanctions = allSanctions.map(s => {
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
      alert("Tugas penebusan berhasil ditetapkan! Siswa sekarang dapat mulai mengerjakan.");
  };

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setGlobalSearchTerm(term);
    if (term.trim().length > 0) {
      const results = students.filter(s => 
        s.name.toLowerCase().includes(term.toLowerCase()) || 
        s.nis.includes(term)
      );
      setGlobalSearchResults(results.slice(0, 8)); 
    } else {
      setGlobalSearchResults([]);
    }
  };

  const handleApprove = (id: string) => {
    DataService.resolveIncident(id, 'APPROVED');
    const rec = records.find(r => r.id === id);
    if (rec) DataService.evaluateAndApplySanction(rec.studentId); 
    refreshDashboard();
  };

  const handleRejectClick = (id: string) => {
    setRejectRecordId(id);
    setRejectReason('');
  };

  const confirmReject = () => {
    if (rejectRecordId && rejectReason) {
      DataService.resolveIncident(rejectRecordId, 'REJECTED', rejectReason);
      setRejectRecordId(null);
      refreshDashboard();
    } else {
      alert("Alasan penolakan wajib diisi.");
    }
  };

  const getIncidentName = (id: string) => incidents.find(i => i.id === id)?.name || 'Unknown';
  const getStudentName = (id: string) => students.find(s => s.id === id)?.name || 'Unknown';

  const isBK = currentUser?.roles.includes(Role.BK);
  const isKesiswaan = currentUser?.roles.includes(Role.KESISWAAN);
  const isAdmin = currentUser?.roles.includes(Role.ADMIN);

  const shouldFilterMyClass = myClasses.length > 0 && !isKesiswaan && !isAdmin && !isBK;
  const myStudentIds = students.filter(s => myClasses.some(c => c.id === s.classId)).map(s => s.id);

  const allRecentRecords = [...records]
    .filter(r => {
        if (r.status === 'REJECTED') return false;
        if (shouldFilterMyClass) return myStudentIds.includes(r.studentId);
        return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const totalPages = Math.ceil(allRecentRecords.length / ITEMS_PER_PAGE);
  const currentRecords = allRecentRecords.slice(recentPage * ITEMS_PER_PAGE, (recentPage + 1) * ITEMS_PER_PAGE);

  const handlePrevPage = () => { if (recentPage > 0) setRecentPage(prev => prev - 1); };
  const handleNextPage = () => { if (recentPage < totalPages - 1) setRecentPage(prev => prev + 1); };

  const violationsToday = records.filter(r => 
    r.typeSnapshot === IncidentTypeCategory.VIOLATION && r.status !== 'REJECTED' &&
    new Date(r.date).toDateString() === new Date().toDateString()
  ).length;

  const achievementsToday = records.filter(r => 
    r.typeSnapshot === IncidentTypeCategory.ACHIEVEMENT && r.status !== 'REJECTED' &&
    new Date(r.date).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Guru</h1>
          <p className="text-slate-500">
            Selamat datang, <span className="font-semibold text-indigo-600">{currentUser?.name}</span>.
          </p>
        </div>
      </div>

      {pendingApprovals.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-5 shadow-sm animate-fade-in">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg">
                 <Inbox className="h-5 w-5" />
              </div>
              <div>
                 <h2 className="font-bold text-slate-800">Persetujuan Laporan Masuk</h2>
                 <p className="text-xs text-slate-500">Laporan dari guru lain atau OSIS untuk kelas Anda.</p>
              </div>
           </div>
           <div className="space-y-3">
              {pendingApprovals.map((req) => (
                 <div key={req.id} className="bg-white p-4 rounded-lg border border-yellow-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="flex-1">
                       <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-800">{req.studentName}</span>
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">
                             {new Date(req.date).toLocaleDateString()}
                          </span>
                       </div>
                       <p className="text-sm text-slate-600 font-medium">{req.incidentName} <span className="text-red-500">({req.pointSnapshot} Poin)</span></p>
                       <p className="text-xs text-slate-400 mt-1">Pelapor: {req.recordedBy}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                       <button onClick={() => handleApprove(req.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm"><Check className="h-3 w-3" /> Terima</button>
                       <button onClick={() => handleRejectClick(req.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm"><Ban className="h-3 w-3" /> Tolak</button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* --- KESISWAAN DASHBOARD --- */}
      {isKesiswaan && (
        <div className="space-y-6 animate-fade-in">
          {/* ... (Existing Kesiswaan Logic) ... */}
          <div className="bg-slate-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
             <div className="absolute right-0 top-0 opacity-5">
               <Gavel className="h-64 w-64 -mr-16 -mt-16 text-white" />
             </div>

             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-2 bg-orange-500 rounded-lg">
                      <Gavel className="h-6 w-6 text-white" />
                   </div>
                   <div>
                     <h2 className="text-xl font-bold">Dashboard Kesiswaan</h2>
                     <p className="text-slate-400 text-sm">Pusat kontrol ketertiban dan kedisiplinan sekolah</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                   <div onClick={() => handleOpenStatModal(SanctionLevel.SP1)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                      <p className="text-orange-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 1 <ExternalLink className="h-3 w-3" /></p>
                      <p className="text-3xl font-bold mt-1">{sp1Count}</p>
                   </div>
                   <div onClick={() => handleOpenStatModal(SanctionLevel.SP2)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                      <p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 2 <ExternalLink className="h-3 w-3" /></p>
                      <p className="text-3xl font-bold mt-1">{sp2Count}</p>
                   </div>
                   <div onClick={() => handleOpenStatModal(SanctionLevel.SP3)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                      <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 3 <ExternalLink className="h-3 w-3" /></p>
                      <p className="text-3xl font-bold mt-1">{sp3Count}</p>
                   </div>
                   <div onClick={() => handleOpenStatModal(SanctionLevel.DROP_OUT)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-red-500/50 bg-red-900/30 cursor-pointer hover:bg-red-900/50 transition-all hover:scale-105">
                      <p className="text-red-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Skull className="h-3 w-3" /> Drop Out <ExternalLink className="h-3 w-3" /></p>
                      <p className="text-3xl font-bold mt-1">{doCount}</p>
                   </div>
                   <div onClick={() => handleOpenStatModal('REDEMPTION')} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                      <p className="text-blue-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Penebusan Jalan <ExternalLink className="h-3 w-3" /></p>
                      <p className="text-3xl font-bold mt-1">{activeRedemptions}</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-2 bg-white text-slate-800 rounded-lg p-5 shadow-sm">
                      <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-700">
                        <Zap className="h-5 w-5 text-yellow-600" />
                        Antrean Sanksi Otomatis (Butuh Tugas)
                      </h3>
                      <div className="overflow-hidden border border-slate-200 rounded-lg">
                        <div className="max-h-[350px] overflow-y-auto">
                          <table className="w-full text-sm text-left relative">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                              <tr>
                                <th className="px-3 py-2">Siswa & Kelas</th>
                                <th className="px-3 py-2 text-center">Level SP</th>
                                <th className="px-3 py-2">Info</th>
                                <th className="px-3 py-2 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {pendingTaskSanctions.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500 flex flex-col items-center justify-center"><CheckCircle2 className="h-8 w-8 text-green-500 mb-2" /><span className="font-semibold">Semua Bersih!</span></td></tr>
                              ) : (
                                pendingTaskSanctions.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-3 py-2"><div className="font-bold text-slate-900">{item.student.name}</div><div className="text-xs text-slate-500">{item.className}</div></td>
                                    <td className="px-3 py-2 text-center"><span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">{item.level}</span></td>
                                    <td className="px-3 py-2 text-xs text-slate-500"><div>Poin: <b>{item.currentScore}</b></div></td>
                                    <td className="px-3 py-2 text-right">
                                        <button onClick={() => handleOpenTaskModal(item)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 ml-auto transition-transform active:scale-95"><PenTool className="h-3 w-3" /> Beri Tugas</button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                   </div>
                   <div className="bg-white text-slate-800 rounded-lg p-5 shadow-sm flex flex-col">
                      <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-700"><UserCheck className="h-5 w-5 text-blue-600" /> Rujukan dari BK</h3>
                      <div className="flex-1 overflow-y-auto max-h-[350px] space-y-3 pr-1">
                         {bkHandledList.length === 0 ? <div className="text-center text-slate-500 text-xs py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">Tidak ada rujukan aktif dari BK.</div> : 
                           bkHandledList.map((item, idx) => (
                             <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-100 relative group">
                                <div className="flex justify-between items-start mb-1"><span className="font-bold text-slate-800 text-sm">{item.student.name}</span><span className="font-bold text-red-600 text-xs">{item.score} Poin</span></div>
                                <div className="text-xs text-slate-600 mb-2 line-clamp-2">"{item.session.notes}"</div>
                                <div className="flex justify-between items-center mt-2 border-t border-blue-100 pt-2">
                                   <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-red-100 text-red-700">PERLU SANKSI</span>
                                   <Link to={`/teacher/student/${item.student.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center">Lihat <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
                                </div>
                             </div>
                           ))
                         }
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
      
      {/* Teacher Section (INTERACTIVE UPDATE) */}
      <div className="space-y-6">
        {myClasses.length > 0 ? (
          myClasses.map(cls => {
            // --- CALCULATION LOGIC FOR CLASS STATS ---
            const classStudents = students.filter(s => s.classId === cls.id);
            const studentIds = classStudents.map(s => s.id);
            const maleCount = classStudents.filter(s => s.gender === 'L').length;
            const femaleCount = classStudents.filter(s => s.gender === 'P').length;

            let totalClassPoints = 0;
            
            // Arrays for Modal
            const listStudentsInCoaching: any[] = [];
            const listCleanStudents: any[] = [];
            const listApproachingBK: any[] = [];
            const listCandidateSP1: any[] = [];
            const listCandidateSP2: any[] = [];
            const listCandidateSP3: any[] = [];

            let highestScore = -1;
            let highestStudentId = '';
            let highestStudentName = '-';

            classStudents.forEach(s => {
               const stats = DataService.calculateStudentPoints(s.id, records, incidents);
               const score = stats.effectiveViolationScore;
               totalClassPoints += score;

               const studentData = { id: s.id, name: s.name, nis: s.nis, score };

               if (score === 0) listCleanStudents.push(studentData);
               if (score >= 20) listStudentsInCoaching.push(studentData);
               
               if (score >= 30 && score < 40) listApproachingBK.push(studentData);
               if (score >= 70 && score < 80) listCandidateSP1.push(studentData);
               if (score >= 110 && score < 120) listCandidateSP2.push(studentData); // Assuming SP2 starts at 120
               if (score >= 150 && score < 160) listCandidateSP3.push(studentData); // Assuming SP3 starts at 160

               if (score > highestScore) {
                  highestScore = score;
                  highestStudentName = s.name;
                  highestStudentId = s.id;
               }
            });

            // Cases This Month (For Modal)
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const casesThisMonth = records.filter(r => 
                studentIds.includes(r.studentId) && 
                r.typeSnapshot === IncidentTypeCategory.VIOLATION &&
                new Date(r.date).getMonth() === currentMonth &&
                new Date(r.date).getFullYear() === currentYear
            ).map(r => ({
                id: r.id,
                date: r.date,
                studentId: r.studentId,
                studentName: students.find(s => s.id === r.studentId)?.name || 'Unknown',
                incidentName: incidents.find(i => i.id === r.incidentTypeId)?.name || 'Unknown',
                points: r.pointSnapshot
            }));

            return (
              <div key={cls.id} className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg overflow-hidden text-white relative">
                 <div className="absolute right-0 top-0 opacity-10 pointer-events-none"><Star className="h-64 w-64 -mr-16 -mt-16" /></div>

                 <div className="relative z-10">
                    {/* HEADER */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/10">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-white/20 rounded-lg"><Users className="h-6 w-6 text-white" /></div>
                           <div>
                              <h2 className="text-xl font-bold">Kelas Perwalian: {cls.name}</h2>
                              <p className="text-blue-200 text-xs">Total Siswa: {classStudents.length} Orang</p>
                           </div>
                        </div>
                        <Link to={`/teacher/classes/${cls.id}`} className="px-4 py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-md text-sm">
                           Kelola Kelas <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {/* CONTENT GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
                       
                       {/* Bagian 1: Statistik Siswa */}
                       <div className="p-6 space-y-4">
                          <h3 className="font-bold text-blue-100 flex items-center gap-2 text-sm border-b border-white/20 pb-2 mb-3"><Users className="h-4 w-4" /> Statistik Siswa</h3>
                          <div className="grid grid-cols-2 gap-3">
                             <div className="bg-white/10 rounded-lg p-3 text-center"><User className="h-5 w-5 mx-auto mb-1 opacity-80" /><p className="text-lg font-bold">{maleCount}</p><p className="text-[10px] text-blue-200 uppercase">Laki-laki</p></div>
                             <div className="bg-white/10 rounded-lg p-3 text-center"><User className="h-5 w-5 mx-auto mb-1 opacity-80 text-pink-200" /><p className="text-lg font-bold">{femaleCount}</p><p className="text-[10px] text-blue-200 uppercase">Perempuan</p></div>
                          </div>
                          <div className="space-y-2 mt-2">
                             <div 
                                onClick={() => handleOpenClassDetail('Siswa Dalam Pembinaan (Poin ≥ 20)', 'STUDENTS', listStudentsInCoaching)}
                                className="flex justify-between items-center text-sm cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors group"
                             >
                                <span className="text-blue-200 group-hover:text-white">Dalam Pembinaan</span>
                                <span className="font-bold bg-white/20 px-2 rounded text-xs group-hover:bg-white group-hover:text-indigo-600 transition-colors">{listStudentsInCoaching.length}</span>
                             </div>
                             <div 
                                onClick={() => handleOpenClassDetail('Siswa Bebas Pelanggaran (0 Poin)', 'STUDENTS', listCleanStudents)}
                                className="flex justify-between items-center text-sm cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors group"
                             >
                                <span className="text-blue-200 group-hover:text-white">Bebas Pelanggaran</span>
                                <span className="font-bold bg-emerald-500/30 text-emerald-100 px-2 rounded text-xs group-hover:bg-emerald-400 group-hover:text-white">{listCleanStudents.length}</span>
                             </div>
                          </div>
                       </div>

                       {/* Bagian 2: Ringkasan Disiplin */}
                       <div className="p-6 space-y-4">
                          <h3 className="font-bold text-blue-100 flex items-center gap-2 text-sm border-b border-white/20 pb-2 mb-3"><TrendingUp className="h-4 w-4" /> Ringkasan Disiplin</h3>
                          <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg mb-3">
                             <ShieldAlert className="h-8 w-8 text-yellow-300 opacity-80" />
                             <div><p className="text-2xl font-bold">{totalClassPoints}</p><p className="text-xs text-blue-200 uppercase">Total Poin Kelas</p></div>
                          </div>
                          <div className="space-y-2">
                             <div className="text-sm">
                                <p className="text-blue-200 text-xs mb-1">Pelanggar Tertinggi:</p>
                                <div className="flex justify-between font-medium bg-white/5 p-2 rounded">
                                   {highestScore > 0 ? (
                                     <Link to={`/teacher/student/${highestStudentId}`} className="truncate max-w-[120px] hover:text-yellow-300 hover:underline cursor-pointer">{highestStudentName}</Link>
                                   ) : (
                                     <span className="truncate max-w-[120px]">-</span>
                                   )}
                                   <span className="text-yellow-300">{highestScore > 0 ? highestScore : 0} Poin</span>
                                </div>
                             </div>
                             <div 
                                onClick={() => handleOpenClassDetail(`Kejadian Bulan Ini (${new Date().toLocaleDateString('id-ID', {month: 'long'})})`, 'INCIDENTS', casesThisMonth)}
                                className="flex justify-between items-center text-sm pt-2 cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors group"
                             >
                                <span className="text-blue-200 group-hover:text-white">Kasus Bulan Ini</span>
                                <span className="font-bold group-hover:text-yellow-300">{casesThisMonth.length} Kejadian</span>
                             </div>
                          </div>
                       </div>

                       {/* Bagian 3: Status Kritis */}
                       <div className="p-6 space-y-4 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle className="h-24 w-24 text-red-500" /></div>
                          <h3 className="font-bold text-blue-100 flex items-center gap-2 text-sm border-b border-white/20 pb-2 mb-3"><AlertTriangle className="h-4 w-4" /> Status Perhatian</h3>
                          
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                             {/* Approaching BK */}
                             <div 
                                onClick={() => handleOpenClassDetail('Mendekati Ambang BK (30-39 Poin)', 'STUDENTS', listApproachingBK)}
                                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listApproachingBK.length > 0 ? 'bg-orange-500/20 border-orange-400/30 hover:bg-orange-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                             >
                                <div><p className={`font-bold text-xs ${listApproachingBK.length > 0 ? 'text-orange-200' : 'text-slate-300'}`}>{listApproachingBK.length} Siswa</p><p className="text-[10px] text-blue-200">Mendekati BK (30-39)</p></div>
                                {listApproachingBK.length > 0 && <AlertCircle className="h-4 w-4 text-orange-300" />}
                             </div>

                             {/* Candidate SP 1 */}
                             <div 
                                onClick={() => handleOpenClassDetail('Kandidat SP 1 (70-79 Poin)', 'STUDENTS', listCandidateSP1)}
                                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listCandidateSP1.length > 0 ? 'bg-red-500/20 border-red-400/30 hover:bg-red-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                             >
                                <div><p className={`font-bold text-xs ${listCandidateSP1.length > 0 ? 'text-red-200' : 'text-slate-300'}`}>{listCandidateSP1.length} Siswa</p><p className="text-[10px] text-blue-200">Kandidat SP 1 (70-79)</p></div>
                                {listCandidateSP1.length > 0 && <ShieldAlert className="h-4 w-4 text-red-300" />}
                             </div>

                             {/* Candidate SP 2 */}
                             <div 
                                onClick={() => handleOpenClassDetail('Kandidat SP 2 (110-119 Poin)', 'STUDENTS', listCandidateSP2)}
                                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listCandidateSP2.length > 0 ? 'bg-red-600/30 border-red-500/40 hover:bg-red-600/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                             >
                                <div><p className={`font-bold text-xs ${listCandidateSP2.length > 0 ? 'text-red-100' : 'text-slate-300'}`}>{listCandidateSP2.length} Siswa</p><p className="text-[10px] text-blue-200">Kandidat SP 2 (110-119)</p></div>
                                {listCandidateSP2.length > 0 && <Skull className="h-4 w-4 text-red-200" />}
                             </div>

                             {/* Candidate SP 3 */}
                             <div 
                                onClick={() => handleOpenClassDetail('Kandidat SP 3 (150-159 Poin)', 'STUDENTS', listCandidateSP3)}
                                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listCandidateSP3.length > 0 ? 'bg-rose-900/40 border-rose-700/50 hover:bg-rose-900/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                             >
                                <div><p className={`font-bold text-xs ${listCandidateSP3.length > 0 ? 'text-rose-100' : 'text-slate-300'}`}>{listCandidateSP3.length} Siswa</p><p className="text-[10px] text-blue-200">Kandidat SP 3 (150-159)</p></div>
                                {listCandidateSP3.length > 0 && <Ban className="h-4 w-4 text-rose-200" />}
                             </div>
                          </div>
                       </div>

                    </div>
                 </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-3 text-indigo-100 hidden"><UserX className="h-8 w-8 opacity-50" /><div><p className="font-semibold">Tidak ada kelas perwalian.</p></div></div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"><div className="p-3 bg-red-100 text-red-600 rounded-lg"><AlertTriangle className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Pelanggaran Hari Ini</p><p className="text-2xl font-bold text-slate-900">{violationsToday}</p></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"><div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Award className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Prestasi Hari Ini</p><p className="text-2xl font-bold text-slate-900">{achievementsToday}</p></div></div>
        <button onClick={() => navigate('/teacher/classes')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 p-6 rounded-xl shadow-sm flex flex-col items-center justify-center transition-colors group"><span className="font-semibold text-lg group-hover:text-indigo-600 transition-colors">Lihat Semua Kelas</span><span className="text-slate-400 text-sm mt-1">Pencatatan kelas lain</span></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-slate-800">
                Aktivitas Terkini {shouldFilterMyClass ? '(Kelas Perwalian)' : ''}
            </h2>
          </div>
          {allRecentRecords.length > ITEMS_PER_PAGE && (
            <div className="flex items-center gap-2">
               <button onClick={handlePrevPage} disabled={recentPage === 0} className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-5 w-5 text-slate-600" /></button>
               <span className="text-xs font-mono text-slate-400">{recentPage + 1}/{totalPages}</span>
               <button onClick={handleNextPage} disabled={recentPage === totalPages - 1} className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-5 w-5 text-slate-600" /></button>
            </div>
          )}
        </div>
        <div className="divide-y divide-slate-100 min-h-[300px]">
          {currentRecords.length === 0 ? (
            <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-full pt-16"><Clock className="h-8 w-8 text-slate-300 mb-2" />
               {shouldFilterMyClass ? "Belum ada aktivitas di kelas perwalian Anda." : "Belum ada data kejadian."}
            </div>
          ) : (
            currentRecords.map(record => (
              <div key={record.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors animate-fade-in">
                <div className={`mt-1 h-2 w-2 rounded-full ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{getStudentName(record.studentId)}</p>
                  <p className="text-sm text-slate-600">{getIncidentName(record.incidentTypeId)}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(record.date).toLocaleDateString()} • Oleh: {record.recordedBy}</p>
                </div>
                <div className={`text-sm font-bold ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'text-red-600' : 'text-emerald-600'}`}>{record.typeSnapshot === IncidentTypeCategory.VIOLATION ? '+' : '-'}{record.pointSnapshot} Poin</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- CLASS DETAIL MODAL --- */}
      {classDetail.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
              <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
                 <h3 className="font-bold flex items-center gap-2">
                    {classDetail.type === 'STUDENTS' ? <Users className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                    {classDetail.title}
                 </h3>
                 <button onClick={() => setClassDetail({ ...classDetail, isOpen: false })} className="hover:bg-indigo-700 p-1 rounded">
                    <X className="h-5 w-5" />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-0">
                 {classDetail.data.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic">Tidak ada data untuk kategori ini.</div>
                 ) : (
                    <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 border-b border-slate-100 text-slate-600">
                          <tr>
                             {classDetail.type === 'STUDENTS' ? (
                                <>
                                   <th className="px-4 py-3">Nama Siswa</th>
                                   <th className="px-4 py-3 text-center">Poin</th>
                                   <th className="px-4 py-3 text-right">Aksi</th>
                                </>
                             ) : (
                                <>
                                   <th className="px-4 py-3">Tanggal</th>
                                   <th className="px-4 py-3">Siswa & Kejadian</th>
                                   <th className="px-4 py-3 text-right">Aksi</th>
                                </>
                             )}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {classDetail.data.map((item, idx) => (
                             <tr key={idx} className="hover:bg-slate-50">
                                {classDetail.type === 'STUDENTS' ? (
                                   <>
                                      <td className="px-4 py-3">
                                         <div className="font-bold text-slate-800">{item.name}</div>
                                         <div className="text-xs text-slate-500">{item.nis}</div>
                                      </td>
                                      <td className="px-4 py-3 text-center font-bold text-red-600">{item.score}</td>
                                      <td className="px-4 py-3 text-right">
                                         <Link to={`/teacher/student/${item.id}`} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition-colors">Profil</Link>
                                      </td>
                                   </>
                                ) : (
                                   <>
                                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                         {new Date(item.date).toLocaleDateString()}
                                      </td>
                                      <td className="px-4 py-3">
                                         <div className="font-bold text-slate-800 text-xs">{item.studentName}</div>
                                         <div className="text-xs text-slate-600">{item.incidentName} <span className="text-red-500 font-bold">({item.points} Poin)</span></div>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                         <Link to={`/teacher/student/${item.studentId}`} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition-colors">Lihat</Link>
                                      </td>
                                   </>
                                )}
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 )}
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
                 <button onClick={() => setClassDetail({ ...classDetail, isOpen: false })} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-bold">Tutup</button>
              </div>
           </div>
        </div>
      )}

      {/* QUICK TASK MODAL */}
      {showTaskModal && selectedSanction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2">
                          <ClipboardList className="h-5 w-5" /> Tetapkan Tugas Penebusan
                      </h3>
                      <button onClick={() => setShowTaskModal(false)} className="hover:bg-indigo-700 p-1 rounded">
                          <X className="h-5 w-5" />
                      </button>
                  </div>
                  <div className="p-6">
                      <div className="mb-4 text-center">
                          <p className="text-slate-500 text-sm">Siswa</p>
                          <p className="font-bold text-slate-900 text-lg">{selectedSanction.student.name}</p>
                          <div className="inline-block mt-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">
                              Status: {selectedSanction.level}
                          </div>
                      </div>
                      
                      <label className="block text-sm font-bold text-slate-700 mb-2">Tugas Penebusan Wajib:</label>
                      <textarea 
                          className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                          placeholder="Contoh: Membersihkan Masjid, Menghafal Surat Pendek, Piket Perpustakaan..."
                          value={taskInput}
                          onChange={(e) => setTaskInput(e.target.value)}
                          autoFocus
                      />

                      <button 
                          onClick={handleSaveTask}
                          disabled={!taskInput.trim()}
                          className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                      >
                          <CheckCircle2 className="h-4 w-4" /> Simpan & Tetapkan
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- REJECT MODAL (For Teachers/Walikelas) --- */}
      {rejectRecordId && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
               <h3 className="font-bold text-lg mb-2 text-slate-800">Tolak Laporan?</h3>
               <textarea 
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-4"
                  rows={3}
                  placeholder="Alasan penolakan..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
               />
               <div className="flex justify-end gap-2">
                  <button onClick={() => setRejectRecordId(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Batal</button>
                  <button onClick={confirmReject} disabled={!rejectReason} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">Tolak</button>
               </div>
            </div>
         </div>
      )}

      {/* STATS DETAIL MODAL (NEW) */}
      {showStatModal && selectedStatType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                      <h3 className="font-bold flex items-center gap-2">
                          <Users className="h-5 w-5" /> 
                          Daftar Siswa - {selectedStatType === 'REDEMPTION' ? 'Sedang Penebusan' : selectedStatType}
                      </h3>
                      <button onClick={() => setShowStatModal(false)} className="text-slate-400 hover:text-white">
                          <X className="h-5 w-5" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-0">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 border-b border-slate-100 text-slate-600">
                              <tr>
                                  <th className="px-4 py-3 font-semibold">Nama Siswa</th>
                                  <th className="px-4 py-3 font-semibold">Kelas</th>
                                  <th className="px-4 py-3 font-semibold">Tgl Penetapan</th>
                                  <th className="px-4 py-3 text-right">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {getStudentsForStatModal().length === 0 ? (
                                  <tr>
                                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">
                                          Tidak ada data siswa untuk kategori ini.
                                      </td>
                                  </tr>
                              ) : (
                                  getStudentsForStatModal().map((s) => (
                                      <tr key={s.id} className="hover:bg-slate-50">
                                          <td className="px-4 py-3">
                                              <div className="font-bold text-slate-800">{s.studentName}</div>
                                              <div className="text-xs text-slate-500">{s.studentNis}</div>
                                          </td>
                                          <td className="px-4 py-3 text-slate-600">{s.className}</td>
                                          <td className="px-4 py-3 text-slate-500">{new Date(s.date).toLocaleDateString()}</td>
                                          <td className="px-4 py-3 text-right">
                                              <Link 
                                                  to={`/teacher/student/${s.studentId}`}
                                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors"
                                              >
                                                  Lihat Profil <ArrowRight className="h-3 w-3" />
                                              </Link>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
                      <button onClick={() => setShowStatModal(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-bold">
                          Tutup
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* BK Section */}
      {isBK && !isKesiswaan && (
        <div className="space-y-6 animate-fade-in">
           {/* Removing overflow-hidden to allow dropdowns to spill out */}
           <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white relative">
              
              {/* Separate container for background decoration to keep clipping */}
              <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                  <div className="absolute right-0 top-0 opacity-10">
                    <HeartHandshake className="h-64 w-64 -mr-16 -mt-16" />
                  </div>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2 bg-white/20 rounded-lg"><BookOpen className="h-6 w-6 text-white" /></div>
                   <h2 className="text-xl font-bold">Dashboard Bimbingan & Konseling</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="text-indigo-100 text-sm">Siswa Dalam Pantauan</p>
                      <p className="text-3xl font-bold mt-1">{highRiskStudents.length}</p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="text-indigo-100 text-sm">Total Riwayat Konseling</p>
                      <p className="text-3xl font-bold mt-1">{counselingCount}</p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 relative">
                       <label className="text-indigo-100 text-sm block mb-2 flex items-center gap-2">
                          <Search className="h-4 w-4" /> Cari Siswa
                       </label>
                       {/* FIXED SEARCH DROPDOWN UI */}
                       <div className="relative">
                          <input 
                            type="text" 
                            className="w-full bg-white text-slate-800 px-3 py-2 rounded text-sm outline-none" 
                            placeholder="Ketik Nama..." 
                            value={globalSearchTerm} 
                            onChange={handleGlobalSearch} 
                          />
                          {globalSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white mt-1 rounded-lg shadow-xl overflow-hidden text-slate-800 border border-slate-200 max-h-96 overflow-y-auto" style={{ zIndex: 9999 }}>
                               {globalSearchResults.map(s => (
                                 <Link 
                                   key={s.id} 
                                   to={`/teacher/student/${s.id}`} 
                                   className="block px-4 py-2 hover:bg-slate-100 text-sm border-b last:border-0 font-bold"
                                 >
                                   {s.name}
                                 </Link>
                               ))}
                            </div>
                          )}
                       </div>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}
      
      {/* Teacher Section */}
      <div className="bg-indigo-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10"><Star className="h-48 w-48 -mr-10 -mt-10" /></div>
        <div className="relative z-10">
          <h2 className="text-lg font-medium text-indigo-100 mb-4">Kelas Perwalian Anda</h2>
          {myClasses.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {myClasses.map(cls => (
                <div key={cls.id} className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 min-w-[200px]">
                  <h3 className="text-2xl font-bold">{cls.name}</h3>
                  <div className="mt-2 space-y-3">
                    <span className="text-sm text-indigo-100 flex items-center gap-1"><Users className="h-4 w-4" /> {students.filter(s => s.classId === cls.id).length} Siswa</span>
                    <Link to={`/teacher/classes/${cls.id}`} className="inline-flex w-full justify-center items-center gap-1 text-sm font-semibold bg-white text-indigo-600 px-3 py-2 rounded hover:bg-indigo-50 transition-colors shadow-sm">Kelola Kelas <ArrowRight className="h-3 w-3" /></Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-3 text-indigo-100"><UserX className="h-8 w-8 opacity-50" /><div><p className="font-semibold">Tidak ada kelas perwalian.</p></div></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"><div className="p-3 bg-red-100 text-red-600 rounded-lg"><AlertTriangle className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Pelanggaran Hari Ini</p><p className="text-2xl font-bold text-slate-900">{violationsToday}</p></div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"><div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Award className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Prestasi Hari Ini</p><p className="text-2xl font-bold text-slate-900">{achievementsToday}</p></div></div>
        <button onClick={() => navigate('/teacher/classes')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 p-6 rounded-xl shadow-sm flex flex-col items-center justify-center transition-colors group"><span className="font-semibold text-lg group-hover:text-indigo-600 transition-colors">Lihat Semua Kelas</span><span className="text-slate-400 text-sm mt-1">Pencatatan kelas lain</span></button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-slate-400" /><h2 className="font-semibold text-slate-800">Aktivitas Terkini {shouldFilterMyClass ? '(Kelas Perwalian)' : ''}</h2></div>
          {allRecentRecords.length > ITEMS_PER_PAGE && (
            <div className="flex items-center gap-2">
               <button onClick={handlePrevPage} disabled={recentPage === 0} className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-5 w-5 text-slate-600" /></button>
               <span className="text-xs font-mono text-slate-400">{recentPage + 1}/{totalPages}</span>
               <button onClick={handleNextPage} disabled={recentPage === totalPages - 1} className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-5 w-5 text-slate-600" /></button>
            </div>
          )}
        </div>
        <div className="divide-y divide-slate-100 min-h-[300px]">
          {currentRecords.length === 0 ? (
            <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-full pt-16"><Clock className="h-8 w-8 text-slate-300 mb-2" />{shouldFilterMyClass ? "Belum ada aktivitas di kelas perwalian Anda." : "Belum ada data kejadian."}</div>
          ) : (
            currentRecords.map(record => (
              <div key={record.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors animate-fade-in">
                <div className={`mt-1 h-2 w-2 rounded-full ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{getStudentName(record.studentId)}</p>
                  <p className="text-sm text-slate-600">{getIncidentName(record.incidentTypeId)}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(record.date).toLocaleDateString()} • Oleh: {record.recordedBy}</p>
                </div>
                <div className={`text-sm font-bold ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'text-red-600' : 'text-emerald-600'}`}>{record.typeSnapshot === IncidentTypeCategory.VIOLATION ? '+' : '-'}{record.pointSnapshot} Poin</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
