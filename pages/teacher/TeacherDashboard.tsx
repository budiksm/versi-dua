
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

  // BK Specific State (Refactored)
  const [bkStats, setBkStats] = useState({
      activeCounseling: 0,
      mandatoryCases: 0,
      referrals: 0,
      highRiskCount: 0, // Renamed from approachingSP
      monthlySessions: 0
  });
  const [bkMandatoryList, setBkMandatoryList] = useState<any[]>([]);
  const [bkReferralList, setBkReferralList] = useState<any[]>([]);
  const [bkRecentActivity, setBkRecentActivity] = useState<CounselingSession[]>([]);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<Student[]>([]);

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

  // UNIFIED DETAIL MODAL STATE (Interactive Dashboard)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [storyLine, setStoryLine] = useState<StoryStep[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    refreshDashboard();
    
    // Subscribe to Realtime Updates
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
    setCounselingSessions(counselings); // Saved for modal
    setSanctions(allSanctionsList); // Saved for modal
    
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

        // 1. Calculate Per-Student Stats
        stds.forEach(s => {
            const stats = DataService.calculateStudentPoints(s.id, recs, incs);
            const sSessions = counselings.filter(c => c.studentId === s.id);
            const latestSession = sSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const latestHomeroom = sSessions.find(c => c.sessionType === 'HOMEROOM');

            // Active Counseling (Open Session)
            if (latestSession && latestSession.status === 'OPEN') {
                activeCount++;
            }

            // --- LOGIKA "MANDATORY" / WAJIB KONSELING ---
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

            // Referrals (From Homeroom)
            if (latestHomeroom && latestHomeroom.recommendation === 'TO_BK') {
                const newerBKSession = sSessions.find(c => c.sessionType === 'BK' && new Date(c.date) > new Date(latestHomeroom.date));
                if (!newerBKSession) {
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

            // High Risk Students (Mendekati SP1, SP2, atau SP3)
            // Logika: Poin di atas Threshold BK tapi belum sampai SP3 (kecuali sudah dihandle)
            if (stats.effectiveViolationScore >= (thresholds.sp1 * 0.7) && stats.effectiveViolationScore < thresholds.sp3) {
                highRiskCount++;
            }
        });

        // 2. Monthly Stats
        monthlyCount = counselings.filter(c => new Date(c.date).getMonth() === currentMonth).length;

        // 3. Recent Activity
        const recentActivity = counselings
            .filter(c => c.sessionType === 'BK')
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);

        setBkStats({
            activeCounseling: activeCount,
            mandatoryCases: mandatoryCount,
            referrals: referralCount,
            highRiskCount: highRiskCount,
            monthlySessions: monthlyCount
        });
        setBkMandatoryList(mandatoryListTemp.sort((a,b) => b.score - a.score).slice(0, 10)); // Top 10 Priority
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
             if (latestSession && (latestSession.recommendation === 'TO_KESISWAAN' || latestSession.recommendation === 'SUSPENSION_REVIEW')) {
                 const stats = DataService.calculateStudentPoints(s.id, recs, incs);
                 bkReferrals.push({ student: s, score: stats.effectiveViolationScore, session: latestSession });
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

  // --- UNIFIED STORY LINE BUILDER (Same as StudentProfile) ---
  const handleOpenDetail = (item: IncidentRecord | CounselingSession | StudentSanction) => {
      const story: StoryStep[] = [];
      
      // Context logic
      let relatedIncidentIds: string[] = [];
      if ('incidentTypeId' in item) {
          relatedIncidentIds = [item.id];
      } else if ('sessionType' in item) {
          relatedIncidentIds = item.relatedRecordIds || [];
      }

      // 1. INCIDENT NODES
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
          if (inc.status === 'APPROVED') {
              story.push({
                  id: `${inc.id}_approve`,
                  date: inc.date,
                  type: 'APPROVAL',
                  title: 'Persetujuan Wali Kelas',
                  actor: 'Wali Kelas',
                  description: 'Laporan diverifikasi valid dan poin dicatat.',
                  statusLabel: 'Aktif',
                  statusColor: 'bg-green-100 text-green-700'
              });
          }
      });

      // 2. SESSION NODES
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

      // 3. SANCTION NODES (Placeholder logic if we had links)
      
      story.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setStoryLine(story);
      setDetailModalOpen(true);
  };

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
      const allRules = DataService.getRules();
      let filteredStudents: any[] = []; 

      // --- LOGIKA DATA MODAL UNTUK BK & KESISWAAN ---
      
      // 1. Logic BK
      if (selectedStatType.startsWith('BK_')) {
          const allCounselings = DataService.getCounselingSessions();
          const thresholds = getDynamicThresholds(allRules);
          
          students.forEach(s => {
              const stats = DataService.calculateStudentPoints(s.id, records, incidents);
              const sSessions = allCounselings.filter(c => c.studentId === s.id);
              const latestSession = sSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              const latestHomeroom = sSessions.find(c => c.sessionType === 'HOMEROOM');

              let include = false;
              let note = '';
              let riskBadge: 'YELLOW' | 'ORANGE' | 'RED' | null = null;

              if (selectedStatType === 'BK_ACTIVE' && latestSession?.status === 'OPEN') {
                  include = true;
                  note = 'Sesi Aktif';
              } else if (selectedStatType === 'BK_MANDATORY') {
                  const hasRequiredRecord = records.some(r => r.studentId === s.id && r.bkStatus === 'REQUIRED');
                  const latestBKSession = sSessions.filter(c => c.sessionType === 'BK').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  const latestViolation = records.filter(r => r.studentId === s.id && r.typeSnapshot === IncidentTypeCategory.VIOLATION).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  let unhandledHighScore = false;
                  if (stats.effectiveViolationScore >= thresholds.bk) {
                     if (!latestBKSession) unhandledHighScore = true;
                     else if (latestViolation && new Date(latestViolation.date).getTime() > new Date(latestBKSession.date).getTime()) unhandledHighScore = true;
                  }

                  if (hasRequiredRecord || unhandledHighScore) {
                      include = true;
                      note = `Poin: ${stats.effectiveViolationScore}`;
                  }
              } else if (selectedStatType === 'BK_REFERRAL') {
                  if (latestHomeroom?.recommendation === 'TO_BK') {
                      const newerBK = sSessions.find(c => c.sessionType === 'BK' && new Date(c.date) > new Date(latestHomeroom.date));
                      if (!newerBK) {
                          include = true;
                          note = `Dari: ${latestHomeroom.counselorName}`;
                      }
                  }
              } else if (selectedStatType === 'BK_HIGH_RISK') {
                  const score = stats.effectiveViolationScore;
                  
                  // Gunakan threshold dinamis
                  if (score >= (thresholds.sp1 * 0.7) && score < thresholds.sp3) {
                      include = true;
                      
                      let nextLabel = '';
                      let nextThreshold = 0;
                      
                      if (score < thresholds.sp1) {
                          riskBadge = 'YELLOW';
                          nextLabel = 'SP 1';
                          nextThreshold = thresholds.sp1;
                      } else if (score < thresholds.sp2) {
                          riskBadge = 'ORANGE';
                          nextLabel = 'SP 2';
                          nextThreshold = thresholds.sp2;
                      } else {
                          riskBadge = 'RED';
                          nextLabel = 'SP 3';
                          nextThreshold = thresholds.sp3;
                      }

                      const coachingStatusRule = DataService.getCoachingStatus(score, allRules);
                      const coachingStatus = coachingStatusRule?.statusLabel || 'Tidak Diketahui';
                      
                      note = `${score} Poin – Mendekati ${nextLabel} (Ambang ${nextThreshold} Poin). Status: ${coachingStatus}.`;
                  }
              }

              if (include) {
                  const cl = allClasses.find(c => c.id === s.classId);
                  filteredStudents.push({
                      id: `stat_${s.id}`,
                      studentId: s.id,
                      studentName: s.name,
                      studentNis: s.nis,
                      className: cl?.name || '-',
                      date: new Date().toISOString(), // Dummy date for sort
                      notes: note,
                      riskBadge: riskBadge
                  });
              }
          });
          
      } else {
          // 2. Logic Kesiswaan (Existing)
          let filteredSanctions: StudentSanction[] = [];
          if (selectedStatType === 'REDEMPTION') {
              filteredSanctions = allSanctions.filter(s => s.redemptionStatus === RedemptionStatus.IN_PROGRESS);
          } else {
              filteredSanctions = allSanctions.filter(s => s.level === selectedStatType && !s.isRedeemed);
          }

          filteredStudents = filteredSanctions.map(s => {
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
      }

      return filteredStudents;
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

  // --- FILTERED STATS FOR WALIKELAS ---
  const violationsToday = records.filter(r => 
    r.typeSnapshot === IncidentTypeCategory.VIOLATION && 
    r.status !== 'REJECTED' &&
    new Date(r.date).toDateString() === new Date().toDateString() &&
    (!shouldFilterMyClass || myStudentIds.includes(r.studentId)) 
  ).length;

  const achievementsToday = records.filter(r => 
    r.typeSnapshot === IncidentTypeCategory.ACHIEVEMENT && 
    r.status !== 'REJECTED' &&
    new Date(r.date).toDateString() === new Date().toDateString() &&
    (!shouldFilterMyClass || myStudentIds.includes(r.studentId)) 
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
            <div className="bg-slate-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 pointer-events-none"><Gavel className="h-64 w-64 -mr-16 -mt-16" /></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-orange-500 rounded-lg"><Gavel className="h-6 w-6 text-white" /></div>
                        <div><h2 className="text-xl font-bold">Dashboard Kesiswaan</h2><p className="text-slate-400 text-sm">Pusat kontrol ketertiban dan kedisiplinan sekolah</p></div>
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-sm">{item.student.name} <span className="text-slate-400 font-normal">({item.className})</span></div>
                                                <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                                                    <span className="text-red-400 font-bold">{item.level}</span> • Skor: {item.currentScore}
                                                </div>
                                            </div>
                                            <button onClick={() => handleOpenTaskModal(item)} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded shadow-sm">Beri Tugas</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

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
                                        <div key={idx} className="p-3 hover:bg-white/5 transition-colors flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-sm">{item.student.name}</div>
                                                <div className="text-xs text-slate-300 mt-0.5">
                                                    {translateRecommendation(item.session.recommendation)}
                                                </div>
                                            </div>
                                            <Link to={`/teacher/student/${item.student.id}`} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded">Lihat</Link>
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

    {/* --- BK DASHBOARD --- */}
    {isBK && !isKesiswaan && (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 pointer-events-none"><HeartHandshake className="h-64 w-64 -mr-16 -mt-16" /></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-white/20 rounded-lg"><BookOpen className="h-6 w-6 text-white" /></div>
                        <div><h2 className="text-xl font-bold">Dashboard Bimbingan & Konseling</h2><p className="text-blue-100 text-sm">Monitoring kesehatan mental dan perilaku siswa.</p></div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div onClick={() => handleOpenStatModal('BK_ACTIVE')} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Konseling Aktif <ExternalLink className="h-3 w-3" /></p>
                            <p className="text-3xl font-bold mt-1">{bkStats.activeCounseling}</p>
                        </div>
                        <div onClick={() => handleOpenStatModal('BK_MANDATORY')} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-red-400/50 bg-red-900/20 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                            <p className="text-red-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Prioritas (Wajib) <ExternalLink className="h-3 w-3" /></p>
                            <p className="text-3xl font-bold mt-1">{bkStats.mandatoryCases}</p>
                        </div>
                        <div onClick={() => handleOpenStatModal('BK_REFERRAL')} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                            <p className="text-orange-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Rujukan Walas <ExternalLink className="h-3 w-3" /></p>
                            <p className="text-3xl font-bold mt-1">{bkStats.referrals}</p>
                        </div>
                        <div onClick={() => handleOpenStatModal('BK_HIGH_RISK')} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 cursor-pointer hover:bg-white/20 transition-all hover:scale-105">
                            <p className="text-yellow-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Risiko Tinggi <ExternalLink className="h-3 w-3" /></p>
                            <p className="text-3xl font-bold mt-1">{bkStats.highRiskCount}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-wider">Sesi Bulan Ini</p>
                            <p className="text-3xl font-bold mt-1">{bkStats.monthlySessions}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white/10 rounded-xl border border-white/10 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-sm flex items-center gap-2 text-red-200"><AlertCircle className="h-4 w-4" /> Siswa Wajib Konseling</h3>
                            </div>
                            <div className="divide-y divide-white/10 max-h-60 overflow-y-auto">
                                {bkMandatoryList.length === 0 ? (
                                    <div className="p-4 text-center text-blue-200 text-xs">Tidak ada siswa yang mencapai ambang batas poin (40).</div>
                                ) : (
                                    bkMandatoryList.map((item, idx) => (
                                        <div key={idx} className="p-3 hover:bg-white/10 transition-colors flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-sm text-white">{item.student.name} <span className="text-blue-300 font-normal">({item.className})</span></div>
                                                <div className="text-xs text-red-300 mt-0.5 font-medium">
                                                    {item.score} Poin - {item.topIncident}
                                                </div>
                                            </div>
                                            <Link to={`/teacher/student/${item.student.id}`} className="px-3 py-1.5 bg-white text-indigo-700 text-xs font-bold rounded hover:bg-blue-50">Proses</Link>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white/10 rounded-xl border border-white/10 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-sm flex items-center gap-2 text-orange-200"><User className="h-4 w-4" /> Masuk: Rujukan Wali Kelas</h3>
                            </div>
                            <div className="divide-y divide-white/10 max-h-60 overflow-y-auto">
                                {bkReferralList.length === 0 ? (
                                    <div className="p-4 text-center text-blue-200 text-xs">Tidak ada rujukan baru dari Wali Kelas.</div>
                                ) : (
                                    bkReferralList.map((item, idx) => (
                                        <div key={idx} className="p-3 hover:bg-white/10 transition-colors flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-sm text-white">{item.student.name} <span className="text-blue-300 font-normal">({item.className})</span></div>
                                                <div className="text-xs text-orange-200 mt-0.5">
                                                    Dari: {item.homeroomName}
                                                </div>
                                                <div className="text-[10px] text-blue-200 italic mt-0.5 truncate max-w-[200px]">"{item.note}"</div>
                                            </div>
                                            <Link to={`/teacher/student/${item.student.id}`} className="px-3 py-1.5 bg-orange-500/80 text-white text-xs font-bold rounded hover:bg-orange-500">Terima</Link>
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
      
      {/* --- HOMEROOM / TEACHER DASHBOARD (INTERACTIVE) --- */}
      {myClasses.length > 0 && (
        <div className="space-y-6">
          {myClasses.map(cls => {
            const classStudents = students.filter(s => s.classId === cls.id);
            const studentIds = classStudents.map(s => s.id);
            const maleCount = classStudents.filter(s => s.gender === 'L').length;
            const femaleCount = classStudents.filter(s => s.gender === 'P').length;

            let totalClassPoints = 0;
            
            const listStudentsInCoaching: any[] = [];
            const listCleanStudents: any[] = [];
            
            // Perbaikan Logika Kategori (Inclusive Check)
            const listRangeBK: any[] = [];
            const listRangeSP1: any[] = [];
            const listRangeSP2: any[] = [];
            const listRangeSP3: any[] = [];

            let highestScore = -1;
            let highestStudentId = '';
            let highestStudentName = '-';

            // Get Dynamic Thresholds for Walikelas View
            const rules = DataService.getRules();
            const thresholds = getDynamicThresholds(rules);

            classStudents.forEach(s => {
               const stats = DataService.calculateStudentPoints(s.id, records, incidents);
               const score = stats.effectiveViolationScore;
               totalClassPoints += score;

               const studentData = { id: s.id, name: s.name, nis: s.nis, score };

               if (score === 0) listCleanStudents.push(studentData);
               if (score >= 20) listStudentsInCoaching.push(studentData);
               
               // Fix Logic: Pastikan rentang poin tertangkap dengan benar
               // BK: score >= BK (40) dan belum SP1
               if (score >= thresholds.bk && score < thresholds.sp1) listRangeBK.push(studentData);
               
               // SP1: score >= SP1 (80) dan belum SP2
               if (score >= thresholds.sp1 && score < thresholds.sp2) listRangeSP1.push(studentData);
               
               // SP2: score >= SP2 (120) dan belum SP3
               if (score >= thresholds.sp2 && score < thresholds.sp3) listRangeSP2.push(studentData);
               
               // SP3: score >= SP3 (160)
               if (score >= thresholds.sp3) listRangeSP3.push(studentData);

               if (score > highestScore) {
                  highestScore = score;
                  highestStudentName = s.name;
                  highestStudentId = s.id;
               }
            });

            // Cases This Month
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
                    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/10">
                        <div className="flex items-center gap-3"><div className="p-2 bg-white/20 rounded-lg"><Users className="h-6 w-6 text-white" /></div><div><h2 className="text-xl font-bold">Kelas Perwalian: {cls.name}</h2><p className="text-blue-200 text-xs">Total Siswa: {classStudents.length} Orang</p></div></div>
                        <Link to={`/teacher/classes/${cls.id}`} className="px-4 py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-md text-sm">Kelola Kelas <ArrowRight className="h-4 w-4" /></Link>
                    </div>
                    {/* ... Stats Grid ... */}
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
                       <div className="p-6 space-y-4">
                          <h3 className="font-bold text-blue-100 flex items-center gap-2 text-sm border-b border-white/20 pb-2 mb-3"><Users className="h-4 w-4" /> Statistik Siswa</h3>
                          <div className="grid grid-cols-2 gap-3">
                             <div className="bg-white/10 rounded-lg p-3 text-center"><User className="h-5 w-5 mx-auto mb-1 opacity-80" /><p className="text-lg font-bold">{maleCount}</p><p className="text-[10px] text-blue-200 uppercase">Laki-laki</p></div>
                             <div className="bg-white/10 rounded-lg p-3 text-center"><User className="h-5 w-5 mx-auto mb-1 opacity-80 text-pink-200" /><p className="text-lg font-bold">{femaleCount}</p><p className="text-[10px] text-blue-200 uppercase">Perempuan</p></div>
                          </div>
                          {/* ... Interactive Rows ... */}
                          <div className="space-y-2 mt-2">
                             <div onClick={() => handleOpenClassDetail('Siswa Dalam Pembinaan (Poin ≥ 20)', 'STUDENTS', listStudentsInCoaching)} className="flex justify-between items-center text-sm cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors group"><span className="text-blue-200 group-hover:text-white">Dalam Pembinaan</span><span className="font-bold bg-white/20 px-2 rounded text-xs group-hover:bg-white group-hover:text-indigo-600 transition-colors">{listStudentsInCoaching.length}</span></div>
                             <div onClick={() => handleOpenClassDetail('Siswa Bebas Pelanggaran (0 Poin)', 'STUDENTS', listCleanStudents)} className="flex justify-between items-center text-sm cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors group"><span className="text-blue-200 group-hover:text-white">Bebas Pelanggaran</span><span className="font-bold bg-emerald-500/30 text-emerald-100 px-2 rounded text-xs group-hover:bg-emerald-400 group-hover:text-white">{listCleanStudents.length}</span></div>
                          </div>
                       </div>
                       {/* ... Middle Column ... */}
                       <div className="p-6 space-y-4">
                          <h3 className="font-bold text-blue-100 flex items-center gap-2 text-sm border-b border-white/20 pb-2 mb-3"><TrendingUp className="h-4 w-4" /> Ringkasan Disiplin</h3>
                          <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg mb-3"><ShieldAlert className="h-8 w-8 text-yellow-300 opacity-80" /><div><p className="text-2xl font-bold">{totalClassPoints}</p><p className="text-xs text-blue-200 uppercase">Total Poin Kelas</p></div></div>
                          <div className="space-y-2"><div className="text-sm"><p className="text-blue-200 text-xs mb-1">Pelanggar Tertinggi:</p><div className="flex justify-between font-medium bg-white/5 p-2 rounded">{highestScore > 0 ? (<Link to={`/teacher/student/${highestStudentId}`} className="truncate max-w-[120px] hover:text-yellow-300 hover:underline cursor-pointer">{highestStudentName}</Link>) : (<span className="truncate max-w-[120px]">-</span>)}<span className="text-yellow-300">{highestScore > 0 ? highestScore : 0} Poin</span></div></div><div onClick={() => handleOpenClassDetail(`Kejadian Bulan Ini (${new Date().toLocaleDateString('id-ID', {month: 'long'})})`, 'INCIDENTS', casesThisMonth)} className="flex justify-between items-center text-sm pt-2 cursor-pointer hover:bg-white/10 p-1.5 rounded transition-colors group"><span className="text-blue-200 group-hover:text-white">Kasus Bulan Ini</span><span className="font-bold group-hover:text-yellow-300">{casesThisMonth.length} Kejadian</span></div></div>
                       </div>
                       {/* ... Right Column (Status) ... */}
                       <div className="p-6 space-y-4 relative">
                          <h3 className="font-bold text-blue-100 flex items-center gap-2 text-sm border-b border-white/20 pb-2 mb-3"><AlertTriangle className="h-4 w-4" /> Status Perhatian</h3>
                          <div className="space-y-2">
                             {/* BK */}
                             <div onClick={() => handleOpenClassDetail(`Perlu Konseling BK (${thresholds.bk}-${thresholds.sp1-1} Poin)`, 'STUDENTS', listRangeBK)} className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listRangeBK.length > 0 ? 'bg-orange-500/20 border-orange-400/30 hover:bg-orange-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}><div><p className={`font-bold text-xs ${listRangeBK.length > 0 ? 'text-orange-200' : 'text-slate-300'}`}>{listRangeBK.length} Siswa</p><p className="text-[10px] text-blue-200">Perlu BK ({thresholds.bk}+)</p></div>{listRangeBK.length > 0 && <AlertCircle className="h-4 w-4 text-orange-300" />}</div>
                             
                             {/* SP 1 */}
                             <div onClick={() => handleOpenClassDetail(`Status SP 1 (${thresholds.sp1}-${thresholds.sp2-1} Poin)`, 'STUDENTS', listRangeSP1)} className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listRangeSP1.length > 0 ? 'bg-yellow-500/20 border-yellow-400/30 hover:bg-yellow-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}><div><p className={`font-bold text-xs ${listRangeSP1.length > 0 ? 'text-yellow-200' : 'text-slate-300'}`}>{listRangeSP1.length} Siswa</p><p className="text-[10px] text-blue-200">SP 1 ({thresholds.sp1}+)</p></div>{listRangeSP1.length > 0 && <AlertTriangle className="h-4 w-4 text-yellow-300" />}</div>

                             {/* SP 2 */}
                             <div onClick={() => handleOpenClassDetail(`Status SP 2 (${thresholds.sp2}-${thresholds.sp3-1} Poin)`, 'STUDENTS', listRangeSP2)} className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listRangeSP2.length > 0 ? 'bg-orange-600/30 border-orange-500/40 hover:bg-orange-600/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}><div><p className={`font-bold text-xs ${listRangeSP2.length > 0 ? 'text-orange-100' : 'text-slate-300'}`}>{listRangeSP2.length} Siswa</p><p className="text-[10px] text-blue-200">SP 2 ({thresholds.sp2}+)</p></div>{listRangeSP2.length > 0 && <AlertTriangle className="h-4 w-4 text-orange-300" />}</div>

                             {/* SP 3 */}
                             <div onClick={() => handleOpenClassDetail(`Status SP 3 (${thresholds.sp3}+ Poin)`, 'STUDENTS', listRangeSP3)} className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] ${listRangeSP3.length > 0 ? 'bg-red-600/30 border-red-500/40 hover:bg-red-600/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}><div><p className={`font-bold text-xs ${listRangeSP3.length > 0 ? 'text-red-200' : 'text-slate-300'}`}>{listRangeSP3.length} Siswa</p><p className="text-[10px] text-blue-200">SP 3 ({thresholds.sp3}+)</p></div>{listRangeSP3.length > 0 && <Skull className="h-4 w-4 text-red-300" />}</div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- DAILY STATS & NAVIGATION --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg"><AlertTriangle className="h-6 w-6" /></div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Pelanggaran Hari Ini</p>
                <p className="text-2xl font-bold text-slate-900">{violationsToday}</p>
                {shouldFilterMyClass && <p className="text-[10px] text-slate-400">Khusus Kelas Anda</p>}
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Award className="h-6 w-6" /></div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Prestasi Hari Ini</p>
                <p className="text-2xl font-bold text-slate-900">{achievementsToday}</p>
                {shouldFilterMyClass && <p className="text-[10px] text-slate-400">Khusus Kelas Anda</p>}
            </div>
        </div>
        <button onClick={() => navigate('/teacher/classes')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 p-6 rounded-xl shadow-sm flex flex-col items-center justify-center transition-colors group">
            <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <LayoutGrid className="h-6 w-6" />
            </div>
            <span className="font-semibold text-lg group-hover:text-indigo-600 transition-colors">Lihat Semua Kelas</span>
            <span className="text-slate-400 text-sm mt-1">Pencatatan kelas lain</span>
        </button>
      </div>

      {/* --- RECENT ACTIVITY (INTERACTIVE) --- */}
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
              <div 
                key={record.id} 
                onClick={() => handleOpenDetail(record)}
                className="p-4 flex items-start gap-4 hover:bg-indigo-50 transition-colors cursor-pointer group animate-fade-in relative"
              >
                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="flex-1">
                  <p className="font-medium text-slate-900 group-hover:text-indigo-700 transition-colors">{getStudentName(record.studentId)}</p>
                  <p className="text-sm text-slate-600">{getIncidentName(record.incidentTypeId)}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(record.date).toLocaleDateString()} • Oleh: {record.recordedBy}</p>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-bold ${record.typeSnapshot === IncidentTypeCategory.VIOLATION ? 'text-red-600' : 'text-emerald-600'}`}>
                        {record.typeSnapshot === IncidentTypeCategory.VIOLATION ? '+' : ''}{record.pointSnapshot} Poin
                    </div>
                    <span className="text-[10px] text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Lihat Detail</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- UNIFIED DETAIL MODAL (TIMELINE) --- */}
      {detailModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
                        <h2 className="font-bold text-lg flex items-center gap-2"><LinkIcon className="h-5 w-5 text-indigo-400" /> Riwayat Kasus Terpadu</h2>
                        <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        <div className="space-y-0 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>

                            {storyLine.map((step, idx) => (
                                <div key={step.id} className="relative z-10 flex gap-4 mb-8 last:mb-0 group">
                                    {/* Timeline Node */}
                                    <div className={`w-12 h-12 rounded-full border-4 border-slate-50 flex items-center justify-center shrink-0 shadow-sm
                                        ${step.type === 'INCIDENT' ? 'bg-white text-slate-600' : 
                                          step.type === 'APPROVAL' ? 'bg-green-100 text-green-600' :
                                          step.type === 'COUNSELING_WALAS' ? 'bg-orange-100 text-orange-600' :
                                          step.type === 'COUNSELING_BK' ? 'bg-blue-100 text-blue-600' :
                                          'bg-red-600 text-white'}
                                    `}>
                                        {step.type === 'INCIDENT' && <FileText className="h-5 w-5" />}
                                        {step.type === 'APPROVAL' && <CheckCircle2 className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_WALAS' && <User className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_BK' && <HeartHandshake className="h-5 w-5" />}
                                        {step.type === 'SANCTION' && <Gavel className="h-5 w-5" />}
                                    </div>

                                    {/* Content Card */}
                                    <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">{step.title}</h4>
                                                <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                    {new Date(step.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {new Date(step.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                            {step.statusLabel && (
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${step.statusColor || 'bg-slate-100 text-slate-600'}`}>
                                                    {step.statusLabel}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100">
                                            <span className="font-semibold">Oleh:</span> {step.actor}
                                            {step.scoreImpact && <span className="ml-2 font-bold text-red-600">(Bobot: {step.scoreImpact} Poin)</span>}
                                        </div>

                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                            "{step.description || '-'}"
                                        </p>

                                        {/* ATTACHMENT PAPERCLIP */}
                                        {step.attachmentUrl && (
                                            <div className="mt-3 flex justify-end">
                                                <button 
                                                    onClick={() => setPreviewImage(step.attachmentUrl || null)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors border border-slate-200"
                                                >
                                                    <Paperclip className="h-3 w-3" /> Lampiran Bukti
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-4 border-t border-slate-200 flex justify-end"><button onClick={() => setDetailModalOpen(false)} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm">Tutup</button></div>
                </div>
            </div>
      )}

      {/* LIGHTBOX FOR IMAGE PREVIEW */}
      {previewImage && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300"><X className="h-8 w-8" /></button>
                <img src={previewImage} alt="Preview Bukti" className="max-w-full max-h-[90vh] rounded shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            </div>
      )}

      {/* ... (Existing Modals: ClassDetail, StatModal, TaskModal, RejectModal) ... */}
      
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

      {showStatModal && selectedStatType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                      <h3 className="font-bold flex items-center gap-2">
                          <Users className="h-5 w-5" /> 
                          {selectedStatType.startsWith('BK_') ? 'Detail Statistik BK' : `Daftar Siswa - ${selectedStatType === 'REDEMPTION' ? 'Sedang Penebusan' : selectedStatType}`}
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
                                  <th className="px-4 py-3 font-semibold">Info Detail</th>
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
                                              <div className="flex items-center gap-2">
                                                  {s.riskBadge && (
                                                      <div className={`h-3 w-3 rounded-full shrink-0 ${
                                                          s.riskBadge === 'RED' ? 'bg-red-500' : 
                                                          s.riskBadge === 'ORANGE' ? 'bg-orange-500' : 'bg-yellow-400'
                                                      }`} title={`Risiko: ${s.riskBadge}`} />
                                                  )}
                                                  <div>
                                                      <div className="font-bold text-slate-800">{s.studentName}</div>
                                                      <div className="text-xs text-slate-500">{s.studentNis}</div>
                                                  </div>
                                              </div>
                                          </td>
                                          <td className="px-4 py-3 text-slate-600">{s.className}</td>
                                          <td className="px-4 py-3 text-slate-500">
                                              <div className="text-xs leading-relaxed" title={s.notes}>{s.notes}</div>
                                          </td>
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
    </div>
  );
};

export default TeacherDashboard;
