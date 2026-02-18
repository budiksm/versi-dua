
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { IncidentRecord, MasterIncidentType, IncidentTypeCategory, ClassGroup, Teacher, Role, Student, SanctionLevel, RedemptionStatus, CounselingSession, IncidentStatus, StudentSanction, CoachingRule } from '../../types';
import { AlertTriangle, Award, Clock, Star, Users, ArrowRight, UserX, Search, BookOpen, AlertCircle, HeartHandshake, Gavel, CheckCircle2, ClipboardList, UserCheck, ArrowUpRight, X, Inbox, Check, Ban, ChevronLeft, ChevronRight, Skull, Zap, PenTool, ExternalLink, TrendingUp, ShieldAlert, User, Calendar, LayoutGrid, UserPlus, Activity, MessageSquare, FileText, Paperclip, Link as LinkIcon, RotateCcw, Save, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

// --- INTERFACE UNTUK TIMELINE STORY ---
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
  // UX OPTIMIZATION: Synchronous State Initialization
  const [records, setRecords] = useState<IncidentRecord[]>(() => DataService.getRecords());
  const [incidents, setIncidents] = useState<MasterIncidentType[]>(() => DataService.getIncidentTypes());
  const [students, setStudents] = useState<Student[]>(() => DataService.getStudents());
  const [myClasses, setMyClasses] = useState<ClassGroup[]>([]); 
  const [allClasses, setAllClasses] = useState<ClassGroup[]>(() => DataService.getClasses());
  const [currentUser, setCurrentUser] = useState<Teacher | null>(() => DataService.getCurrentUser());
  
  const [counselingSessions, setCounselingSessions] = useState<CounselingSession[]>(() => DataService.getCounselingSessions());
  const [sanctions, setSanctions] = useState<StudentSanction[]>(() => DataService.getSanctions());

  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [rejectRecordId, setRejectRecordId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [recentPage, setRecentPage] = useState(0);
  const ITEMS_PER_PAGE = 5;

  const [bkStats, setBkStats] = useState({
      activeCounseling: 0,
      mandatoryCases: 0,
      referrals: 0,
      highRiskCount: 0, 
      monthlySessions: 0,
      returnedCount: 0
  });
  const [bkMandatoryList, setBkMandatoryList] = useState<any[]>([]);
  const [bkReferralList, setBkReferralList] = useState<any[]>([]);
  const [bkRecentActivity, setBkRecentActivity] = useState<CounselingSession[]>([]);

  // Kesiswaan Specific State
  const [allSanctions, setAllSanctions] = useState<StudentSanction[]>(() => DataService.getSanctions());
  const [sp1Count, setSp1Count] = useState<number>(0);
  const [sp2Count, setSp2Count] = useState<number>(0);
  const [sp3Count, setSp3Count] = useState<number>(0);
  const [doCount, setDoCount] = useState<number>(0); 
  const [activeRedemptions, setActiveRedemptions] = useState<number>(0);
  const [pendingTaskSanctions, setPendingTaskSanctions] = useState<any[]>([]); 
  const [bkHandledList, setBkHandledList] = useState<{student: Student, score: number, session: CounselingSession, recordIds: string[]}[]>([]);
  
  // Kesiswaan UI State
  const [kesiswaanTab, setKesiswaanTab] = useState<'REFERRALS' | 'SANCTIONS'>('REFERRALS');
  const [expandedReferralIdx, setExpandedReferralIdx] = useState<number | null>(null);
  const [kesiswaanNote, setKesiswaanNote] = useState('');
  const [kesiswaanAttachment, setKesiswaanAttachment] = useState<File | null>(null);
  const [isProcessingReferral, setIsProcessingReferral] = useState(false);

  const [showStatModal, setShowStatModal] = useState(false);
  const [selectedStatType, setSelectedStatType] = useState<string | null>(null); 
  
  const [classDetail, setClassDetail] = useState<{
    isOpen: boolean;
    title: string;
    type: 'STUDENTS' | 'INCIDENTS';
    data: any[];
  }>({ isOpen: false, title: '', type: 'STUDENTS', data: [] });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedSanction, setSelectedSanction] = useState<any>(null);
  const [taskInput, setTaskInput] = useState('');

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

      if (user.roles.includes(Role.BK)) {
        const thresholds = getDynamicThresholds(rules);
        let activeCount = 0;
        let mandatoryCount = 0;
        let referralCount = 0;
        let highRiskCount = 0;
        let monthlyCount = 0;
        let returnedCount = 0;
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

            // Check for RETURNED_TO_BK status
            const hasReturnedRecord = recs.some(r => r.studentId === s.id && r.bkStatus === 'RETURNED_TO_BK');
            if (hasReturnedRecord) {
                returnedCount++;
                referralListTemp.push({
                    student: s,
                    className: classes.find(c => c.id === s.classId)?.name || '-',
                    homeroomName: 'Kesiswaan (Dikembalikan)',
                    date: new Date().toISOString(),
                    note: 'Kasus dikembalikan oleh Kesiswaan untuk penanganan lanjut.',
                    isReturned: true
                });
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

            // REVISED REFERRAL LOGIC
            const referralSessions = sSessions.filter(c => c.sessionType === 'HOMEROOM' && c.recommendation === 'TO_BK');
            referralSessions.forEach(refSession => {
                 const newerBKSession = sSessions.find(c => c.sessionType === 'BK' && new Date(c.date) > new Date(refSession.date));
                 const relatedIds = refSession.relatedRecordIds || [];
                 const allRelatedResolved = relatedIds.length > 0 && relatedIds.every(id => {
                    const r = recs.find(rec => rec.id === id);
                    return r && (r.bkStatus === 'COMPLETED' || r.bkStatus === 'REFERRED');
                 });

                 if (!newerBKSession && !allRelatedResolved) {
                    referralCount++;
                    referralListTemp.push({
                        student: s,
                        className: classes.find(c => c.id === s.classId)?.name || '-',
                        homeroomName: refSession.counselorName,
                        date: refSession.date,
                        note: refSession.notes,
                        isReturned: false
                    });
                 }
            });

            if (stats.effectiveViolationScore >= (thresholds.sp1 * 0.7) && stats.effectiveViolationScore < thresholds.sp3) {
                highRiskCount++;
            }
        });

        const uniqueReferrals = Array.from(new Map(referralListTemp.map(item => [item.student.id, item])).values());

        monthlyCount = counselings.filter(c => new Date(c.date).getMonth() === currentMonth).length;

        const recentActivity = counselings
            .filter(c => c.sessionType === 'BK')
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);

        setBkStats({
            activeCounseling: activeCount,
            mandatoryCases: mandatoryCount,
            referrals: uniqueReferrals.length,
            highRiskCount: highRiskCount,
            monthlySessions: monthlyCount,
            returnedCount: returnedCount
        });
        setBkMandatoryList(mandatoryListTemp.sort((a,b) => b.score - a.score).slice(0, 10));
        setBkReferralList(uniqueReferrals.sort((a,b) => {
            if (a.isReturned && !b.isReturned) return -1;
            if (!a.isReturned && b.isReturned) return 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }));
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

        const bkReferrals: {student: Student, score: number, session: CounselingSession, recordIds: string[]}[] = [];
        stds.forEach(s => {
             const referredRecords = recs.filter(r => r.studentId === s.id && r.bkStatus === 'REFERRED');
             if (referredRecords.length > 0) {
                 const sSessions = counselings.filter(c => c.studentId === s.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                 const referralSession = sSessions.find(sess => sess.recommendation === 'TO_KESISWAAN' || sess.recommendation === 'SUSPENSION_REVIEW');
                 if (referralSession) {
                     const stats = DataService.calculateStudentPoints(s.id, recs, incs);
                     bkReferrals.push({ 
                         student: s, 
                         score: stats.effectiveViolationScore, 
                         session: referralSession,
                         recordIds: referredRecords.map(r => r.id)
                     });
                 }
             }
        });
        setBkHandledList(bkReferrals);
      }
    }
  }

  // --- KESISWAAN ACTIONS ---
  
  const handleKesiswaanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const validation = StorageService.validateFile(file);
          if (!validation.valid) {
              alert(validation.error);
              return;
          }
          setKesiswaanAttachment(file);
      }
  };

  const handleKesiswaanAction = async (item: any, action: 'CLOSE' | 'RETURN') => {
      if (!kesiswaanNote.trim()) { alert("Wajib mengisi catatan/keterangan keputusan."); return; }
      
      setIsProcessingReferral(true);
      try {
          const actionType = action === 'CLOSE' ? 'CLOSE' : 'RETURN_TO_BK';
          let uploadUrl = undefined;
          
          if (kesiswaanAttachment) {
              uploadUrl = await StorageService.uploadFile(kesiswaanAttachment, `kesiswaan/actions/${Date.now()}_attachment`);
          }

          await DataService.processKesiswaanReferral(item.recordIds, actionType, kesiswaanNote, uploadUrl, currentUser?.name, currentUser?.id);
          
          setExpandedReferralIdx(null);
          setKesiswaanNote('');
          setKesiswaanAttachment(null);
          refreshDashboard();
          alert(action === 'CLOSE' ? "Kasus ditutup." : "Kasus dikembalikan ke BK.");
      } catch (e) {
          alert("Gagal memproses. Periksa koneksi.");
      } finally {
          setIsProcessingReferral(false);
      }
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

  const handleOpenDetail = (item: IncidentRecord | CounselingSession | StudentSanction) => {
      const story: StoryStep[] = [];
      let relatedIncidentIds: string[] = [];
      if ('incidentTypeId' in item) { relatedIncidentIds = [item.id]; } 
      else if ('sessionType' in item) { relatedIncidentIds = item.relatedRecordIds || []; }

      const relatedIncidents = records.filter(r => relatedIncidentIds.includes(r.id));
      relatedIncidents.forEach(inc => {
          const incName = incidents.find(i => i.id === inc.incidentTypeId)?.name || 'Unknown';
          story.push({ id: inc.id, date: inc.date, type: 'INCIDENT', title: 'Pencatatan Pelanggaran', actor: `Guru: ${inc.recordedBy}`, description: `${incName}. ${inc.notes}`, statusLabel: inc.status === 'PENDING' ? 'Menunggu Verifikasi' : 'Terverifikasi', statusColor: inc.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700', attachmentUrl: inc.proofImage, scoreImpact: inc.pointSnapshot });
          if (inc.status === 'APPROVED') { story.push({ id: `${inc.id}_approve`, date: inc.date, type: 'APPROVAL', title: 'Persetujuan Wali Kelas', actor: 'Wali Kelas', description: 'Laporan diverifikasi valid dan poin dicatat.', statusLabel: 'Aktif', statusColor: 'bg-green-100 text-green-700' }); }
      });

      const relevantSessions = counselingSessions.filter(s => s.relatedRecordIds?.some(id => relatedIncidentIds.includes(id)) || ('id' in item && item.id === s.id));
      relevantSessions.forEach(sess => {
          story.push({ id: sess.id, date: sess.date, type: sess.sessionType as any, title: sess.sessionType === 'BK' ? 'Konseling BK' : sess.sessionType === 'KESISWAAN' ? 'Keputusan Kesiswaan' : 'Pembinaan Wali Kelas', actor: `${sess.sessionType}: ${sess.counselorName}`, description: sess.notes, statusLabel: sess.recommendation !== 'NONE' ? translateRecommendation(sess.recommendation) : 'Selesai', statusColor: 'bg-blue-100 text-blue-700', attachmentUrl: sess.attachmentUrl });
      });

      if ('level' in item) {
          const s = item as StudentSanction;
          story.push({ id: s.id, date: s.assignedDate, type: 'SANCTION', title: 'Tindakan Kesiswaan', actor: `Kesiswaan (${s.assignedBy})`, description: `Diterbitkan ${s.level}. ${s.notes}`, statusLabel: s.redemptionStatus === 'COMPLETED' ? 'Sanksi Selesai' : 'Sanksi Aktif', statusColor: 'bg-red-100 text-red-700' });
      }

      story.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setStoryLine(story);
      setDetailModalOpen(true);
  };

  const handleOpenClassDetail = (title: string, type: 'STUDENTS' | 'INCIDENTS', data: any[]) => {
      setClassDetail({ isOpen: true, title, type, data });
  };

  const handleOpenStatModal = (type: string) => {
      setSelectedStatType(type);
      setShowStatModal(true);
  };

  const getStudentsForStatModal = () => {
      if (!selectedStatType) return [];
      const allClassesList = DataService.getClasses(); 
      const allRules = DataService.getRules();
      let filteredStudents: any[] = []; 

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

              if (selectedStatType === 'BK_ACTIVE' && latestSession?.status === 'OPEN') { include = true; note = 'Sesi Aktif'; } 
              else if (selectedStatType === 'BK_MANDATORY') {
                  const hasRequiredRecord = records.some(r => r.studentId === s.id && r.bkStatus === 'REQUIRED');
                  const latestBKSession = sSessions.filter(c => c.sessionType === 'BK').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  const latestViolation = records.filter(r => r.studentId === s.id && r.typeSnapshot === IncidentTypeCategory.VIOLATION).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                  let unhandledHighScore = false;
                  if (stats.effectiveViolationScore >= thresholds.bk) {
                     if (!latestBKSession) unhandledHighScore = true;
                     else if (latestViolation && new Date(latestViolation.date).getTime() > new Date(latestBKSession.date).getTime()) unhandledHighScore = true;
                  }
                  if (hasRequiredRecord || unhandledHighScore) { include = true; note = `Poin: ${stats.effectiveViolationScore}`; }
              } else if (selectedStatType === 'BK_REFERRAL') {
                  if (latestHomeroom?.recommendation === 'TO_BK') {
                      const newerBK = sSessions.find(c => c.sessionType === 'BK' && new Date(c.date) > new Date(latestHomeroom.date));
                      const relatedIds = latestHomeroom.relatedRecordIds || [];
                      const allRelatedResolved = relatedIds.length > 0 && relatedIds.every(id => {
                          const r = records.find(rec => rec.id === id);
                          return r && (r.bkStatus === 'COMPLETED' || r.bkStatus === 'REFERRED');
                      });
                      if (!newerBK && !allRelatedResolved) { include = true; note = `Dari: ${latestHomeroom.counselorName}`; }
                  }
              } else if (selectedStatType === 'BK_HIGH_RISK') {
                  const score = stats.effectiveViolationScore;
                  if (score >= (thresholds.sp1 * 0.7) && score < thresholds.sp3) {
                      include = true;
                      let nextLabel = '';
                      if (score < thresholds.sp1) { riskBadge = 'YELLOW'; nextLabel = 'SP 1'; }
                      else if (score < thresholds.sp2) { riskBadge = 'ORANGE'; nextLabel = 'SP 2'; }
                      else { riskBadge = 'RED'; nextLabel = 'SP 3'; }
                      note = `${score} Poin – Mendekati ${nextLabel}.`;
                  }
              }

              if (include) {
                  const cl = allClassesList.find(c => c.id === s.classId);
                  filteredStudents.push({ id: `stat_${s.id}`, studentId: s.id, studentName: s.name, studentNis: s.nis, className: cl?.name || '-', date: new Date().toISOString(), notes: note, riskBadge: riskBadge });
              }
          });
      } else {
          let filteredSanctions: StudentSanction[] = [];
          if (selectedStatType === 'REDEMPTION') { filteredSanctions = allSanctions.filter(s => s.redemptionStatus === RedemptionStatus.IN_PROGRESS); } 
          else { filteredSanctions = allSanctions.filter(s => s.level === selectedStatType && !s.isRedeemed); }

          filteredStudents = filteredSanctions.map(s => {
              const st = students.find(student => student.id === s.studentId);
              const cl = allClassesList.find(c => c.id === st?.classId);
              return { id: s.id, studentId: s.studentId, studentName: st?.name || 'Unknown', studentNis: st?.nis || '-', className: cl?.name || '-', date: s.assignedDate, notes: s.notes };
          });
      }
      return filteredStudents;
  };

  const handleOpenTaskModal = (sanctionItem: any) => { setSelectedSanction(sanctionItem); setTaskInput(''); setShowTaskModal(true); };
  const handleSaveTask = () => {
      if(!selectedSanction || !currentUser || !taskInput.trim()) return;
      const allSanctionsList = DataService.getSanctions();
      const updatedSanctions = allSanctionsList.map(s => {
          if (s.id === selectedSanction.sanctionId) {
              return { ...s, redemptionTask: taskInput, redemptionStatus: RedemptionStatus.ASSIGNED, assignedBy: `${s.assignedBy} & ${currentUser.name}` };
          }
          return s;
      });
      DataService.saveSanctions(updatedSanctions);
      setShowTaskModal(false); setTaskInput(''); setSelectedSanction(null); refreshDashboard(); alert("Tugas penebusan berhasil ditetapkan!");
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
      <div className="flex justify-between items-end">
        <div><h1 className="text-2xl font-bold text-slate-800">Dashboard Guru</h1><p className="text-slate-500">Selamat datang, <span className="font-semibold text-indigo-600">{currentUser?.name}</span>.</p></div>
      </div>

      {pendingApprovals.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-5 shadow-sm animate-fade-in">
           <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg"><Inbox className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-800">Persetujuan Laporan Masuk</h2><p className="text-xs text-slate-500">Laporan dari guru lain atau OSIS untuk kelas Anda.</p></div></div>
           <div className="space-y-3">
              {pendingApprovals.map((req) => (
                 <div key={req.id} className="bg-white p-4 rounded-lg border border-yellow-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-800">{req.studentName}</span><span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">{new Date(req.date).toLocaleDateString()}</span></div><p className="text-sm text-slate-600 font-medium">{req.incidentName} <span className="text-red-500">({req.pointSnapshot} Poin)</span></p><p className="text-xs text-slate-400 mt-1">Pelapor: {req.recordedBy}</p></div><div className="flex items-center gap-2 shrink-0"><button onClick={() => handleApprove(req.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm"><Check className="h-3 w-3" /> Terima</button><button onClick={() => handleRejectClick(req.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm"><Ban className="h-3 w-3" /> Tolak</button></div></div>
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
                    <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-orange-500 rounded-lg"><Gavel className="h-6 w-6 text-white" /></div><div><h2 className="text-xl font-bold">Dashboard Kesiswaan</h2><p className="text-slate-400 text-sm">Pusat kontrol ketertiban dan kedisiplinan sekolah</p></div></div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div onClick={() => handleOpenStatModal(SanctionLevel.SP1)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-orange-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 1 <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{sp1Count}</p></div>
                        <div onClick={() => handleOpenStatModal(SanctionLevel.SP2)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 2 <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{sp2Count}</p></div>
                        <div onClick={() => handleOpenStatModal(SanctionLevel.SP3)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Aktif SP 3 <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{sp3Count}</p></div>
                        <div onClick={() => handleOpenStatModal(SanctionLevel.DROP_OUT)} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-red-500/50 bg-red-900/30 cursor-pointer hover:bg-red-900/50 transition-all hover:scale-105"><p className="text-red-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Skull className="h-3 w-3" /> Drop Out <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{doCount}</p></div>
                        <div onClick={() => handleOpenStatModal('REDEMPTION')} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-all hover:scale-105"><p className="text-blue-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">Penebusan Jalan <ExternalLink className="h-3 w-3" /></p><p className="text-3xl font-bold mt-1">{activeRedemptions}</p></div>
                    </div>
                    
                    <div className="bg-slate-700/50 rounded-xl border border-white/10 overflow-hidden">
                        <div className="flex border-b border-white/10 bg-white/5">
                            <button onClick={() => setKesiswaanTab('REFERRALS')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-all ${kesiswaanTab === 'REFERRALS' ? 'text-blue-300 border-b-2 border-blue-400 bg-white/5' : 'text-slate-400 hover:text-white'}`}><HeartHandshake className="h-4 w-4" /> Tinjauan Kasus (Rujukan BK)</button>
                            <button onClick={() => setKesiswaanTab('SANCTIONS')} className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-all ${kesiswaanTab === 'SANCTIONS' ? 'text-orange-300 border-b-2 border-orange-400 bg-white/5' : 'text-slate-400 hover:text-white'}`}><ClipboardList className="h-4 w-4" /> Panel Sanksi & Tugas</button>
                        </div>

                        {kesiswaanTab === 'REFERRALS' && (
                            <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                                {bkHandledList.length === 0 ? (<div className="p-8 text-center text-slate-400 text-sm">Tidak ada rujukan eskalasi dari BK.</div>) : (bkHandledList.map((item, idx) => (
                                    <div key={idx} className="p-4 hover:bg-white/5 transition-colors">
                                        <div className="flex justify-between items-start cursor-pointer" onClick={() => setExpandedReferralIdx(expandedReferralIdx === idx ? null : idx)}>
                                            <div>
                                                <div className="font-bold text-sm text-white">{item.student.name} <span className="text-slate-400 font-normal">({item.score} Poin)</span></div>
                                                <div className="text-xs text-slate-300 mt-1 italic">"{item.session.notes.substring(0, 80)}..."</div>
                                                <div className="text-[10px] text-blue-300 mt-1">Oleh: {item.session.counselorName} • {new Date(item.session.date).toLocaleDateString()}</div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs text-blue-300 bg-blue-900/50 px-2 py-1 rounded border border-blue-700">{translateRecommendation(item.session.recommendation)}</span>
                                                <div className="text-[10px] text-slate-400 mt-2">{expandedReferralIdx === idx ? 'Tutup' : 'Tangani'} <ChevronDown className={`inline h-3 w-3 transition-transform ${expandedReferralIdx === idx ? 'rotate-180' : ''}`} /></div>
                                            </div>
                                        </div>
                                        
                                        {/* EXPANDED ACTION FORM */}
                                        {expandedReferralIdx === idx && (
                                            <div className="mt-4 pt-4 border-t border-white/10 bg-white/5 p-4 rounded-lg space-y-3 animate-fade-in">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-300 mb-1">Catatan Keputusan Kesiswaan (Wajib)</label>
                                                    <textarea 
                                                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-400 outline-none" 
                                                        rows={3} 
                                                        placeholder="Tuliskan hasil pembinaan atau alasan pengembalian..."
                                                        value={kesiswaanNote}
                                                        onChange={e => setKesiswaanNote(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-300 mb-1">Lampiran Bukti (Opsional)</label>
                                                    <div className="flex items-center gap-2">
                                                        <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded flex items-center gap-2">
                                                            <ImageIcon className="h-3 w-3" /> Upload Foto
                                                            <input type="file" className="hidden" accept="image/*" onChange={handleKesiswaanFile} />
                                                        </label>
                                                        {kesiswaanAttachment && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Terlampir</span>}
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2 pt-2">
                                                    <button onClick={() => handleKesiswaanAction(item, 'RETURN')} disabled={isProcessingReferral} className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold rounded flex items-center gap-1 disabled:opacity-50"><RotateCcw className="h-3 w-3" /> Kembalikan ke BK</button>
                                                    <button onClick={() => handleKesiswaanAction(item, 'CLOSE')} disabled={isProcessingReferral} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded flex items-center gap-1 disabled:opacity-50"><Check className="h-3 w-3" /> Selesaikan Kasus</button>
                                                    <Link to={`/teacher/student/${item.student.id}`} className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded flex items-center gap-1"><Gavel className="h-3 w-3" /> Lanjut Sanksi</Link>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )))}
                            </div>
                        )}

                        {kesiswaanTab === 'SANCTIONS' && (
                            <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                                {pendingTaskSanctions.length === 0 ? (<div className="p-8 text-center text-slate-400 text-sm">Tidak ada sanksi baru yang butuh tugas.</div>) : (pendingTaskSanctions.map((item, idx) => (
                                    <div key={idx} className="p-4 hover:bg-white/5 transition-colors flex justify-between items-center"><div><div className="font-bold text-sm text-white">{item.student.name} <span className="text-slate-400 font-normal">({item.className})</span></div><div className="text-xs text-slate-300 mt-0.5 flex items-center gap-2"><span className="text-red-400 font-bold">{item.level}</span> • Skor: {item.currentScore}</div></div><button onClick={() => handleOpenTaskModal(item)} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded shadow-sm">Beri Tugas</button></div>
                                )))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* ... (BK and Walas dashboard sections remain same, just rendering logic) ... */}
    
    {/* --- RECENT ACTIVITY (INTERACTIVE) --- */}
    {/* ... (Recent Activity section remains same) ... */}

    {/* ... (Modals remain same) ... */}
    
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
                                          step.type === 'KESISWAAN' ? 'bg-red-600 text-white' :
                                          'bg-red-600 text-white'}
                                    `}>
                                        {step.type === 'INCIDENT' && <FileText className="h-5 w-5" />}
                                        {step.type === 'APPROVAL' && <CheckCircle2 className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_WALAS' && <User className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_BK' && <HeartHandshake className="h-5 w-5" />}
                                        {step.type === 'KESISWAAN' && <Gavel className="h-5 w-5" />}
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
