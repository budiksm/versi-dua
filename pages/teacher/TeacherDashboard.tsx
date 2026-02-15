
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { IncidentRecord, MasterIncidentType, IncidentTypeCategory, ClassGroup, Teacher, Role, Student, SanctionLevel, RedemptionStatus, CounselingSession, IncidentStatus } from '../../types';
import { AlertTriangle, Award, Clock, Star, Users, ArrowRight, UserX, Search, BookOpen, AlertCircle, HeartHandshake, Gavel, CheckCircle2, ClipboardList, UserCheck, ArrowUpRight, X, Inbox, Check, Ban, ChevronLeft, ChevronRight, Skull } from 'lucide-react';
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
  const [sp1Candidates, setSp1Candidates] = useState<number>(0);
  const [sp2Candidates, setSp2Candidates] = useState<number>(0);
  const [sp3Candidates, setSp3Candidates] = useState<number>(0);
  const [doCandidates, setDoCandidates] = useState<number>(0); // NEW: Drop Out Candidates
  const [activeRedemptions, setActiveRedemptions] = useState<number>(0);
  const [monitoringList, setMonitoringList] = useState<any[]>([]);
  
  // NEW: BK Referrals for Kesiswaan
  const [bkHandledList, setBkHandledList] = useState<{student: Student, score: number, session: CounselingSession}[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    refreshDashboard();
  }, []);

  const refreshDashboard = () => {
    const user = DataService.getCurrentUser();
    setCurrentUser(user);
    
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

      // --- LOGIC: PENDING APPROVALS FOR WALIKELAS ---
      if (myClassGroups.length > 0) {
         const myStudentIds = stds.filter(s => myClassGroups.some(c => c.id === s.classId)).map(s => s.id);
         const now = new Date().getTime();
         const AUTO_ACCEPT_MS = 2 * 24 * 60 * 60 * 1000; // 48 Hours

         const pendings = recs.filter(r => {
            const isMyStudent = myStudentIds.includes(r.studentId);
            const isPending = r.status === 'PENDING' || (!r.status && false); // Default approved, so !status is safe
            const isNotAutoAccepted = (now - new Date(r.date).getTime()) < AUTO_ACCEPT_MS;
            return isMyStudent && isPending && isNotAutoAccepted;
         }).map(r => ({
            ...r,
            studentName: stds.find(s => s.id === r.studentId)?.name || 'Unknown',
            incidentName: incs.find(i => i.id === r.incidentTypeId)?.name || 'Unknown'
         }));
         setPendingApprovals(pendings);
      }

      // BK LOGIC: Detect students with points >= 40 (Pembinaan BK & Above)
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

      // KESISWAAN LOGIC: Based on new thresholds
      if (user.roles.includes(Role.KESISWAAN)) {
        let countSP1 = 0, countSP2 = 0, countSP3 = 0, countDO = 0;
        const monitorData: any[] = [];
        const bkReferrals: {student: Student, score: number, session: CounselingSession}[] = [];

        stds.forEach(s => {
          const stats = DataService.calculateStudentPoints(s.id, recs, incs);
          const score = stats.effectiveViolationScore;
          
          // Check sanctions
          const studentSanctions = sanctions.filter(san => san.studentId === s.id); 
          const activeSanction = studentSanctions.find(san => san.redemptionStatus !== RedemptionStatus.COMPLETED);
          
          const hasSP1 = sanctions.some(san => san.studentId === s.id && san.level === SanctionLevel.SP1);
          const hasSP2 = sanctions.some(san => san.studentId === s.id && san.level === SanctionLevel.SP2);
          const hasSP3 = sanctions.some(san => san.studentId === s.id && san.level === SanctionLevel.SP3);

          let candidateLevel = null;
          // Updated thresholds: 80, 120, 160, 201
          if (score >= 80 && score <= 119 && !hasSP1) { countSP1++; candidateLevel = 'SP 1'; }
          if (score >= 120 && score <= 159 && !hasSP2) { countSP2++; candidateLevel = 'SP 2'; }
          if (score >= 160 && score <= 200 && !hasSP3) { countSP3++; candidateLevel = 'SP 3'; }
          if (score > 200) { countDO++; candidateLevel = 'DROP OUT'; }

          if (candidateLevel) {
            monitorData.push({
              student: s,
              score,
              activeSanctionLevel: activeSanction?.level || '-',
              redemptionStatus: activeSanction?.redemptionStatus || 'NONE',
              candidateFor: candidateLevel
            });
          }

          const sSessions = counselings.filter(c => c.studentId === s.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestSession = sSessions[0];
          
          if (latestSession) {
             if (
                 latestSession.status === 'OPEN' || 
                 latestSession.recommendation === 'TO_KESISWAAN' || 
                 latestSession.recommendation === 'SUSPENSION_REVIEW'
             ) {
                 bkReferrals.push({
                    student: s,
                    score: score,
                    session: latestSession
                 });
             }
          }
        });

        const activeRedemptionCount = sanctions.filter(s => s.redemptionStatus === RedemptionStatus.ASSIGNED || s.redemptionStatus === RedemptionStatus.IN_PROGRESS).length;

        setSp1Candidates(countSP1);
        setSp2Candidates(countSP2);
        setSp3Candidates(countSP3);
        setDoCandidates(countDO);
        setActiveRedemptions(activeRedemptionCount);
        // Show top 20 prioritized
        setMonitoringList(monitorData.sort((a,b) => b.score - a.score).slice(0, 20)); 
        setBkHandledList(bkReferrals.sort((a,b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime()));
      }
    }
  }

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setGlobalSearchTerm(term);
    if (term.length > 2) {
      const results = students.filter(s => 
        s.name.toLowerCase().includes(term.toLowerCase()) || 
        s.nis.includes(term)
      );
      setGlobalSearchResults(results.slice(0, 5));
    } else {
      setGlobalSearchResults([]);
    }
  };

  const handleApprove = (id: string) => {
    DataService.resolveIncident(id, 'APPROVED');
    // Check auto sanction logic
    const rec = records.find(r => r.id === id);
    if (rec) {
       DataService.evaluateAndApplySanction(rec.studentId);
    }
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

  // --- PAGINATION LOGIC ---
  const allRecentRecords = [...records]
    .filter(r => r.status !== 'REJECTED')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const totalPages = Math.ceil(allRecentRecords.length / ITEMS_PER_PAGE);
  const currentRecords = allRecentRecords.slice(recentPage * ITEMS_PER_PAGE, (recentPage + 1) * ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    if (recentPage > 0) setRecentPage(prev => prev - 1);
  };

  const handleNextPage = () => {
    if (recentPage < totalPages - 1) setRecentPage(prev => prev + 1);
  };

  const violationsToday = records.filter(r => 
    r.typeSnapshot === IncidentTypeCategory.VIOLATION && 
    r.status !== 'REJECTED' &&
    new Date(r.date).toDateString() === new Date().toDateString()
  ).length;

  const achievementsToday = records.filter(r => 
    r.typeSnapshot === IncidentTypeCategory.ACHIEVEMENT && 
    r.status !== 'REJECTED' &&
    new Date(r.date).toDateString() === new Date().toDateString()
  ).length;

  const isBK = currentUser?.roles.includes(Role.BK);
  const isKesiswaan = currentUser?.roles.includes(Role.KESISWAAN);

  const translateRecShort = (rec: string) => {
    if (rec === 'TO_KESISWAAN') return 'Rujuk SP';
    if (rec === 'SUSPENSION_REVIEW') return 'Tinjau Skors';
    if (rec === 'PARENT_CALL') return 'Panggil Ortu';
    if (rec === 'TO_BK') return 'Rujuk BK';
    return 'Pembinaan';
  };

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

      {/* --- APPROVAL WIDGET (ONLY FOR WALI KELAS WITH PENDING ITEMS) --- */}
      {pendingApprovals.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-5 shadow-sm animate-fade-in">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg">
                 <Inbox className="h-5 w-5" />
              </div>
              <div>
                 <h2 className="font-bold text-slate-800">Persetujuan Laporan Masuk</h2>
                 <p className="text-xs text-slate-500">
                    Laporan dari guru lain untuk kelas Anda. Otomatis diterima dalam 2x24 jam jika tidak direspon.
                 </p>
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
                       {req.notes && <p className="text-xs text-slate-500 italic mt-1">"{req.notes}"</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                       <button 
                         onClick={() => handleApprove(req.id)}
                         className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                       >
                          <Check className="h-3 w-3" /> Terima
                       </button>
                       <button 
                         onClick={() => handleRejectClick(req.id)}
                         className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                       >
                          <Ban className="h-3 w-3" /> Tolak
                       </button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* --- REJECT MODAL --- */}
      {rejectRecordId && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
               <h3 className="font-bold text-lg mb-2 text-slate-800">Tolak Laporan?</h3>
               <p className="text-sm text-slate-500 mb-4">
                  Anda wajib memberikan alasan penolakan. Laporan ini tidak akan dihitung dalam poin siswa.
               </p>
               <textarea 
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-4"
                  rows={3}
                  placeholder="Contoh: Siswa sudah izin kepada saya sebelumnya..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
               />
               <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => setRejectRecordId(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmReject}
                    disabled={!rejectReason}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                  >
                    Konfirmasi Tolak
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ... (Existing Kesiswaan Dashboard Code) ... */}
      {isKesiswaan && (
        <div className="space-y-6 animate-fade-in">
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
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                      <p className="text-orange-300 text-[10px] font-bold uppercase tracking-wider">Kandidat SP 1</p>
                      <p className="text-3xl font-bold mt-1">{sp1Candidates}</p>
                      <p className="text-[10px] text-slate-400">Poin 80-119</p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                      <p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider">Kandidat SP 2</p>
                      <p className="text-3xl font-bold mt-1">{sp2Candidates}</p>
                      <p className="text-[10px] text-slate-400">Poin 120-159</p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                      <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Kandidat SP 3</p>
                      <p className="text-3xl font-bold mt-1">{sp3Candidates}</p>
                      <p className="text-[10px] text-slate-400">Poin 160-200</p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-red-500/50 bg-red-900/30">
                      <p className="text-red-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                         <Skull className="h-3 w-3" /> Kandidat DO
                      </p>
                      <p className="text-3xl font-bold mt-1">{doCandidates}</p>
                      <p className="text-[10px] text-slate-400">Poin {'>'} 200</p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                      <p className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Penebusan Aktif</p>
                      <p className="text-3xl font-bold mt-1">{activeRedemptions}</p>
                      <p className="text-[10px] text-slate-400">Dalam Proses</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-2 bg-white text-slate-800 rounded-lg p-5 shadow-sm">
                      <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-700">
                        <ClipboardList className="h-5 w-5 text-indigo-600" />
                        Daftar Tindak Lanjut (Unresolved)
                      </h3>
                      <p className="text-xs text-slate-500 mb-3 -mt-2">Siswa di bawah ini memenuhi syarat sanksi baru tetapi belum diproses.</p>
                      {/* WRAPPER SCROLL DAN BORDER */}
                      <div className="overflow-hidden border border-slate-200 rounded-lg">
                        <div className="max-h-[350px] overflow-y-auto">
                          <table className="w-full text-sm text-left relative">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                              <tr>
                                <th className="px-3 py-2">Siswa</th>
                                <th className="px-3 py-2 text-center">Poin</th>
                                <th className="px-3 py-2">Rekomendasi</th>
                                <th className="px-3 py-2 text-center">Status</th>
                                <th className="px-3 py-2 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {monitoringList.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                                    <span className="font-semibold">Semua Beres!</span>
                                    <span className="text-xs">Tidak ada siswa yang menunggu penanganan sanksi.</span>
                                </td></tr>
                              ) : (
                                monitoringList.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-medium">{item.student.name}</td>
                                    <td className="px-3 py-2 text-center font-bold text-red-600">{item.score}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold animate-pulse flex items-center gap-1 w-fit
                                            ${item.candidateFor === 'DROP OUT' ? 'bg-slate-800 text-white' : 'bg-red-100 text-red-700'}
                                        `}>
                                          <AlertCircle className="h-3 w-3" /> Layak {item.candidateFor}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="flex justify-center items-center" title="Belum ditangani (Perlu Sanksi)">
                                          <div className="bg-red-50 px-2 py-1 rounded border border-red-100 text-[10px] text-red-600 font-bold">
                                            BELUM DIPROSES
                                          </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Link to={`/teacher/student/${item.student.id}`} className="text-indigo-600 hover:underline text-xs font-bold border border-indigo-200 px-2 py-1 rounded bg-indigo-50">
                                          Proses
                                        </Link>
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
                      <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-700">
                        <UserCheck className="h-5 w-5 text-blue-600" />
                        Siswa Ditangani BK
                      </h3>
                      <div className="flex-1 overflow-y-auto max-h-[350px] space-y-3 pr-1">
                         {bkHandledList.length === 0 ? (
                           <div className="text-center text-slate-500 text-xs py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                             Tidak ada siswa yang sedang dalam rujukan aktif BK.
                           </div>
                         ) : (
                           bkHandledList.map((item, idx) => (
                             <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-100 relative group">
                                <div className="flex justify-between items-start mb-1">
                                   <span className="font-bold text-slate-800 text-sm">{item.student.name}</span>
                                   <span className="font-bold text-red-600 text-xs">{item.score} Poin</span>
                                </div>
                                <div className="text-xs text-slate-600 mb-2 line-clamp-2">
                                   "{item.session.notes}"
                                </div>
                                <div className="flex justify-between items-center mt-2 border-t border-blue-100 pt-2">
                                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase
                                      ${item.session.recommendation === 'TO_KESISWAAN' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}
                                   `}>
                                      {translateRecShort(item.session.recommendation)}
                                   </span>
                                   <Link to={`/teacher/student/${item.student.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center">
                                      Lihat Detail <ArrowUpRight className="h-3 w-3 ml-0.5" />
                                   </Link>
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

      {isBK && !isKesiswaan && (
        <div className="space-y-6 animate-fade-in">
           <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-10">
                <HeartHandshake className="h-64 w-64 -mr-16 -mt-16" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2 bg-white/20 rounded-lg">
                      <BookOpen className="h-6 w-6 text-white" />
                   </div>
                   <h2 className="text-xl font-bold">Dashboard Bimbingan & Konseling</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="text-indigo-100 text-sm">Siswa Bina BK (Poin ≥ 40)</p>
                      <p className="text-3xl font-bold mt-1">{highRiskStudents.length} <span className="text-sm font-normal opacity-75">Siswa</span></p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="text-indigo-100 text-sm">Total Sesi Konseling</p>
                      <p className="text-3xl font-bold mt-1">{counselingCount} <span className="text-sm font-normal opacity-75">Sesi</span></p>
                   </div>
                   <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                       <label className="text-indigo-100 text-sm block mb-2 flex items-center gap-2">
                          <Search className="h-4 w-4" /> Cari Siswa (Global)
                       </label>
                       <div className="relative">
                          <input 
                            type="text" 
                            className="w-full bg-white text-slate-800 px-3 py-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Nama atau NIS..."
                            value={globalSearchTerm}
                            onChange={handleGlobalSearch}
                          />
                          {globalSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white mt-1 rounded-lg shadow-xl overflow-hidden z-20 text-slate-800">
                               {globalSearchResults.map(s => (
                                 <Link 
                                   key={s.id} 
                                   to={`/teacher/student/${s.id}`}
                                   className="block px-4 py-2 hover:bg-slate-100 text-sm border-b last:border-0"
                                 >
                                   <span className="font-bold">{s.name}</span> <span className="text-xs text-slate-500">({s.nis})</span>
                                 </Link>
                               ))}
                            </div>
                          )}
                       </div>
                   </div>
                </div>

                <div className="bg-white/95 text-slate-800 rounded-lg p-4 shadow-sm">
                   <h3 className="font-bold flex items-center gap-2 mb-3 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      Siswa Perlu Perhatian Khusus
                   </h3>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Nama</th>
                            <th className="px-3 py-2 text-center">Poin</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {highRiskStudents.length === 0 ? (
                             <tr><td colSpan={4} className="p-4 text-center text-slate-500">Tidak ada siswa dengan poin tinggi (≥ 40) saat ini.</td></tr>
                           ) : (
                             highRiskStudents.map(({student, score, status}) => (
                               <tr key={student.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-medium">{student.name}</td>
                                  <td className="px-3 py-2 text-center font-bold text-red-600">{score}</td>
                                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{status}</span></td>
                                  <td className="px-3 py-2 text-right">
                                     <Link to={`/teacher/student/${student.id}`} className="text-blue-600 hover:underline text-xs font-semibold">
                                        Tinjau
                                     </Link>
                                  </td>
                               </tr>
                             ))
                           )}
                        </tbody>
                     </table>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}
      
      <div className="bg-indigo-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10">
          <Star className="h-48 w-48 -mr-10 -mt-10" />
        </div>
        <div className="relative z-10">
          <h2 className="text-lg font-medium text-indigo-100 mb-4">Kelas Perwalian Anda</h2>
          
          {myClasses.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {myClasses.map(cls => (
                <div key={cls.id} className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20 min-w-[200px]">
                  <h3 className="text-2xl font-bold">{cls.name}</h3>
                  <div className="mt-2 space-y-3">
                    <span className="text-sm text-indigo-100 flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {students.filter(s => s.classId === cls.id).length} Siswa
                    </span>
                    <Link to={`/teacher/classes/${cls.id}`} className="inline-flex w-full justify-center items-center gap-1 text-sm font-semibold bg-white text-indigo-600 px-3 py-2 rounded hover:bg-indigo-50 transition-colors shadow-sm">
                      Kelola Kelas <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-3 text-indigo-100">
               <UserX className="h-8 w-8 opacity-50" />
               <div>
                 <p className="font-semibold">Tidak ada kelas perwalian.</p>
                 <p className="text-xs opacity-75">Anda belum ditugaskan sebagai Wali Kelas oleh Admin.</p>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Pelanggaran Hari Ini</p>
            <p className="text-2xl font-bold text-slate-900">{violationsToday}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Prestasi Hari Ini</p>
            <p className="text-2xl font-bold text-slate-900">{achievementsToday}</p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/teacher/classes')}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 p-6 rounded-xl shadow-sm flex flex-col items-center justify-center transition-colors group"
        >
          <span className="font-semibold text-lg group-hover:text-indigo-600 transition-colors">Lihat Semua Kelas</span>
          <span className="text-slate-400 text-sm mt-1">Pencatatan kelas lain</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <Clock className="h-5 w-5 text-slate-400" />
             <h2 className="font-semibold text-slate-800">Aktivitas Terkini</h2>
          </div>
          
          {/* PAGINATION CONTROLS */}
          {allRecentRecords.length > ITEMS_PER_PAGE && (
            <div className="flex items-center gap-2">
               <button 
                 onClick={handlePrevPage} 
                 disabled={recentPage === 0}
                 className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 <ChevronLeft className="h-5 w-5 text-slate-600" />
               </button>
               <span className="text-xs font-mono text-slate-400">
                 {recentPage + 1}/{totalPages}
               </span>
               <button 
                 onClick={handleNextPage} 
                 disabled={recentPage === totalPages - 1}
                 className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 <ChevronRight className="h-5 w-5 text-slate-600" />
               </button>
            </div>
          )}
        </div>
        <div className="divide-y divide-slate-100 min-h-[300px]">
          {currentRecords.length === 0 ? (
            <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-full pt-16">
               <Clock className="h-8 w-8 text-slate-300 mb-2" />
               Belum ada data kejadian.
            </div>
          ) : (
            currentRecords.map(record => (
              <div key={record.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors animate-fade-in">
                <div className={`mt-1 h-2 w-2 rounded-full ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{getStudentName(record.studentId)}</p>
                  <p className="text-sm text-slate-600">{getIncidentName(record.incidentTypeId)}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(record.date).toLocaleDateString()} • Oleh: {record.recordedBy}
                  </p>
                </div>
                <div className={`text-sm font-bold ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'text-red-600' : 'text-emerald-600'}`}>
                  {record.typeSnapshot === IncidentTypeCategory.VIOLATION ? '+' : '-'}{record.pointSnapshot} Poin
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
