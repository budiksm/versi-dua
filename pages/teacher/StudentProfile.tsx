
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
  IncidentStatus,
  BkCounselingStatus
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
  Check, 
  Play, 
  Shield, 
  LifeBuoy, 
  Paperclip, 
  Link as LinkIcon, 
  Loader2,
  Cloud,
  Zap,
  ArrowDown,
  ArrowRight,
  Users
} from 'lucide-react';

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

const StudentProfile: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data States
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [counselingSessions, setCounselingSessions] = useState<CounselingSession[]>([]);
  const [sanctions, setSanctions] = useState<StudentSanction[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); 
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);

  // UI States
  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'HOMEROOM' | 'BK_COUNSELING' | 'SANCTIONS'>('INCIDENTS');
  const [bkMode, setBkMode] = useState<'CASE' | 'PREVENTIVE'>('CASE');
  const [homeroomMode, setHomeroomMode] = useState<'CASE' | 'PREVENTIVE'>('CASE');

  // Form States
  const [formType, setFormType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [imageProof, setImageProof] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [counselingNotes, setCounselingNotes] = useState('');
  const [counselingRec, setCounselingRec] = useState<'NONE' | 'PARENT_CALL' | 'TO_KESISWAAN' | 'SUSPENSION_REVIEW' | 'TO_BK'>('NONE');
  const [selectedCounselingRecords, setSelectedCounselingRecords] = useState<string[]>([]);

  // Sanction Form State
  const [sanctionLevel, setSanctionLevel] = useState<SanctionLevel>(SanctionLevel.SP1);
  const [sanctionNotes, setSanctionNotes] = useState('');
  const [sanctionRedemptionTask, setSanctionRedemptionTask] = useState('');
  const [editingSanctionId, setEditingSanctionId] = useState<string | null>(null);

  // Computed Sanction Options State (New)
  const [availableSanctionOptions, setAvailableSanctionOptions] = useState<SanctionLevel[]>([]);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [storyLine, setStoryLine] = useState<StoryStep[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const user = DataService.getCurrentUser();
    setCurrentUser(user);
    loadStudentData();

    const unsubscribe = DataService.subscribeToDataChanges(() => {
        setRefreshKey(prev => prev + 1); 
        loadStudentData();
    });
    
    return () => unsubscribe();
  }, [studentId, refreshKey]);

  useEffect(() => {
      if (student && rules.length > 0) {
          const stats = DataService.calculateStudentPoints(student.id, records, incidents);
          const score = stats.effectiveViolationScore;
          
          const currentRule = rules.find(r => score >= r.minPoints && score <= r.maxPoints);
          let targetLevel: SanctionLevel | null = null;

          if (currentRule) {
              const label = currentRule.statusLabel.toUpperCase();
              if (label.includes('SP 1')) targetLevel = SanctionLevel.SP1;
              else if (label.includes('SP 2')) targetLevel = SanctionLevel.SP2;
              else if (label.includes('SP 3')) targetLevel = SanctionLevel.SP3;
              else if (label.includes('SKORS')) targetLevel = SanctionLevel.SKORSING;
              else if (label.includes('DROP')) targetLevel = SanctionLevel.DROP_OUT;
          }

          const existingLevels = sanctions.map(s => s.level);
          const allLevels = Object.values(SanctionLevel);
          
          let filteredOptions = allLevels.filter(lvl => !existingLevels.includes(lvl));
          setAvailableSanctionOptions(filteredOptions);
          
          if (!editingSanctionId && filteredOptions.length > 0) {
              if (targetLevel && filteredOptions.includes(targetLevel)) {
                  setSanctionLevel(targetLevel);
              } else {
                  setSanctionLevel(filteredOptions[0]);
              }
          }
      }
  }, [student, rules, records, sanctions, editingSanctionId]);

  const loadStudentData = () => {
    setIsLoading(true);
    if (!studentId) { setIsLoading(false); return; }
    
    try {
        const allStudents = DataService.getStudents() || [];
        const foundStudent = allStudents.find((s: any) => s.id === studentId);
        
        if (foundStudent) {
            setStudent(foundStudent);
            const allRecords = DataService.getRecords() || [];
            setRecords(allRecords.filter((r: any) => r && r.studentId === studentId));
            setCategories(DataService.getCategories() || []);
            setIncidents(DataService.getIncidentTypes() || []);
            setRules(DataService.getRules() || []);
            setClasses(DataService.getClasses() || []);
            
            const allSessions = DataService.getCounselingSessions() || [];
            setCounselingSessions(allSessions.filter((s: any) => s.studentId === studentId).sort((a:any,b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            const allSanctions = DataService.getSanctions() || [];
            setSanctions(allSanctions.filter((s: any) => s.studentId === studentId).sort((a:any,b:any) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()));
        } else {
            setStudent(null);
        }
    } catch (e) {
        console.error("Error loading student profile", e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleOpenDetail = (item: any) => {
      const story: StoryStep[] = [];
      let relatedIncidentIds: string[] = [];
      if ('incidentTypeId' in item) relatedIncidentIds = [item.id];
      else if ('sessionType' in item) relatedIncidentIds = item.relatedRecordIds || [];

      const relatedIncidents = records.filter(r => relatedIncidentIds.includes(r.id));
      relatedIncidents.forEach(inc => {
          const incName = incidents.find(i => i.id === inc.incidentTypeId)?.name || 'Unknown';
          story.push({ id: inc.id, date: inc.date, type: 'INCIDENT', title: 'Pencatatan Pelanggaran', actor: `Guru: ${inc.recordedBy}`, description: `${incName}. ${inc.notes}`, statusLabel: inc.status === 'PENDING' ? 'Menunggu Verifikasi' : 'Terverifikasi', statusColor: inc.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700', attachmentUrl: inc.proofImage, scoreImpact: inc.pointSnapshot });
          if (inc.status === 'APPROVED') story.push({ id: `${inc.id}_approve`, date: inc.date, type: 'APPROVAL', title: 'Persetujuan Wali Kelas', actor: 'Wali Kelas', description: 'Laporan diverifikasi valid dan poin dicatat.', statusLabel: 'Aktif', statusColor: 'bg-green-100 text-green-700' });
      });

      const relevantSessions = counselingSessions.filter(s => s.relatedRecordIds?.some(id => relatedIncidentIds.includes(id)) || ('id' in item && item.id === s.id));
      relevantSessions.forEach(sess => {
          story.push({ id: sess.id, date: sess.date, type: sess.sessionType as any, title: sess.sessionType === 'BK' ? 'Konseling BK' : sess.sessionType === 'KESISWAAN' ? 'Keputusan Kesiswaan' : 'Pembinaan Wali Kelas', actor: `${sess.sessionType}: ${sess.counselorName}`, description: sess.notes, statusLabel: sess.recommendation !== 'NONE' ? translateRecommendation(sess.recommendation) : 'Selesai', statusColor: 'bg-blue-100 text-blue-700', attachmentUrl: sess.attachmentUrl });
      });

      if ('level' in item) {
          const s = item as StudentSanction;
          story.push({ id: s.id, date: s.assignedDate, type: 'SANCTION', title: 'Tindakan Kesiswaan', actor: `Kesiswaan (${s.assignedBy})`, description: `Diterbitkan ${s.level}. Alasan: ${s.notes}`, statusLabel: s.redemptionStatus === 'COMPLETED' ? 'Sanksi Selesai' : 'Sanksi Aktif', statusColor: 'bg-red-100 text-red-700' });
      }
      story.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (story.length === 0 && 'sessionType' in item) { 
          const sess = item as CounselingSession;
          story.push({ id: sess.id, date: sess.date, type: sess.sessionType as any, title: sess.sessionType === 'BK' ? 'Konseling Preventif' : 'Pembinaan Preventif', actor: sess.counselorName, description: sess.notes, statusLabel: 'Preventif', statusColor: 'bg-blue-50 text-blue-600', attachmentUrl: sess.attachmentUrl });
      }
      setStoryLine(story);
      setDetailModalOpen(true);
  };

  const toggleCounselingRecord = (id: string) => { if (selectedCounselingRecords.includes(id)) setSelectedCounselingRecords(p => p.filter(x => x !== id)); else setSelectedCounselingRecords(p => [...p, id]); };
  const handleTypeChange = (type: IncidentTypeCategory) => { setFormType(type); setSelectedCategory(''); setSelectedIncident(''); };
  
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = scaleSize < 1 ? MAX_WIDTH : img.width;
          canvas.height = scaleSize < 1 ? img.height * scaleSize : img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setIsCompressing(true); try { const compressedBase64 = await compressImage(file); setImageProof(compressedBase64); } catch (error) { alert("Gagal memproses gambar."); } finally { setIsCompressing(false); } }
  };

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !selectedCategory || !student) return;
    setIsSubmitting(true);
    try {
        const incidentDef = incidents.find(i => i.id === selectedIncident);
        if (!incidentDef) return;
        const studentClass = classes.find(c => c.id === student.classId);
        const isHomeroom = currentUser?.id === studentClass?.homeroomTeacherId;
        const initialStatus: IncidentStatus = isHomeroom ? 'APPROVED' : 'PENDING';
        const newRecord: IncidentRecord = { id: `rec_${Date.now()}`, studentId: student.id, incidentTypeId: selectedIncident, date: new Date().toISOString(), notes: notes, proofImage: imageProof || undefined, recordedBy: currentUser?.name || 'Unknown', pointSnapshot: incidentDef.points, typeSnapshot: IncidentTypeCategory.VIOLATION, status: initialStatus };
        const bkRule = rules.find(r => r.statusLabel.toUpperCase().includes('BK'));
        const bkThreshold = bkRule ? bkRule.minPoints : 40;
        if (initialStatus === 'APPROVED' && newRecord.pointSnapshot >= bkThreshold && newRecord.typeSnapshot === IncidentTypeCategory.VIOLATION) newRecord.bkStatus = 'REQUIRED';
        await DataService.saveRecords([...DataService.getRecords(), newRecord]);
        if (incidentDef.type === IncidentTypeCategory.VIOLATION && initialStatus === 'APPROVED') await DataService.evaluateAndApplySanction(student.id);
        setSuccessMsg(`Data berhasil disimpan`); setNotes(''); setImageProof(null); setSelectedIncident(''); setSelectedCategory(''); setRefreshKey(prev => prev + 1); setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) { alert("Gagal menyimpan data."); } finally { setIsSubmitting(false); }
  };

  const handleSubmitCounseling = async (e: React.FormEvent, type: 'BK' | 'HOMEROOM') => {
    e.preventDefault();
    if (!student) return;
    
    // MANDATORY CHECK
    if (!counselingNotes.trim()) { alert("Catatan pembinaan wajib diisi!"); return; }
    if (!imageProof) { alert("Bukti foto dokumentasi wajib dilampirkan!"); return; }

    setIsSubmitting(true);
    try {
        let finalRelatedRecords: string[] = [];
        if (type === 'BK') finalRelatedRecords = (bkMode === 'CASE') ? selectedCounselingRecords : [];
        else if (type === 'HOMEROOM') finalRelatedRecords = (homeroomMode === 'CASE') ? selectedCounselingRecords : [];

        const newSession: CounselingSession = { 
            id: `coun_${Date.now()}`, 
            studentId: student.id, 
            counselorId: currentUser?.id || '', 
            counselorName: currentUser?.name || 'Unknown', 
            date: new Date().toISOString(), 
            notes: counselingNotes, 
            recommendation: counselingRec, 
            status: counselingRec !== 'NONE' ? 'OPEN' : 'CLOSED', 
            sessionType: type, 
            relatedRecordIds: finalRelatedRecords,
            attachmentUrl: imageProof // Save mandatory image
        };
        await DataService.saveCounselingSessions([...DataService.getCounselingSessions(), newSession]);

        if (finalRelatedRecords.length > 0) {
            const updatedRecords = DataService.getRecords().map(r => {
                if (finalRelatedRecords.includes(r.id)) {
                    let newBkStatus: BkCounselingStatus = r.bkStatus || 'NONE';
                    
                    if (type === 'HOMEROOM') { 
                        if (counselingRec === 'TO_BK') newBkStatus = 'REQUIRED'; 
                        else if (counselingRec === 'NONE') newBkStatus = 'COMPLETED'; 
                    } else if (type === 'BK') {
                        // CRITICAL FIX: If referred to Kesiswaan, do NOT set to COMPLETED
                        if (counselingRec === 'TO_KESISWAAN' || counselingRec === 'SUSPENSION_REVIEW') {
                            newBkStatus = 'REFERRED';
                        } else {
                            newBkStatus = 'COMPLETED';
                        }
                    }
                    return { ...r, bkStatus: newBkStatus };
                }
                return r;
            });
            await DataService.saveRecords(updatedRecords);
        }
        setSuccessMsg('Catatan konseling disimpan!'); setCounselingNotes(''); setCounselingRec('NONE'); setImageProof(null); setSelectedCounselingRecords([]); setRefreshKey(prev => prev + 1); setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) { alert("Gagal menyimpan sesi konseling."); } finally { setIsSubmitting(false); }
  };

  const handleAssignSanction = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!student) return;
    setIsSubmitting(true);
    try {
        const allSanctions = DataService.getSanctions();
        if (editingSanctionId) {
            const updatedSanctions = allSanctions.map(s => {
                if (s.id === editingSanctionId) {
                    return { ...s, level: sanctionLevel, notes: sanctionNotes, redemptionStatus: sanctionRedemptionTask ? RedemptionStatus.ASSIGNED : s.redemptionStatus, redemptionTask: sanctionRedemptionTask, assignedBy: `${s.assignedBy} & ${currentUser?.name}` };
                }
                return s;
            });
            await DataService.saveSanctions(updatedSanctions);
            setSuccessMsg('Data sanksi berhasil diperbarui!');
        } else {
            const newSanction: StudentSanction = { id: `san_${Date.now()}`, studentId: student.id, level: sanctionLevel, assignedBy: currentUser?.name || 'Kesiswaan', assignedDate: new Date().toISOString(), notes: sanctionNotes, redemptionStatus: sanctionRedemptionTask ? RedemptionStatus.ASSIGNED : RedemptionStatus.NONE, redemptionTask: sanctionRedemptionTask, isRedeemed: false };
            await DataService.saveSanctions([...allSanctions, newSanction]);
            setSuccessMsg('Sanksi baru ditetapkan!');
        }
        setSanctionNotes(''); setSanctionRedemptionTask(''); setEditingSanctionId(null); setRefreshKey(prev => prev + 1); setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) { alert("Gagal menyimpan sanksi."); } finally { setIsSubmitting(false); }
  };

  const startEditSanction = (s: StudentSanction) => { setEditingSanctionId(s.id); setSanctionLevel(s.level); setSanctionNotes(s.notes); setSanctionRedemptionTask(s.redemptionTask || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelEditSanction = () => { setEditingSanctionId(null); setSanctionNotes(''); setSanctionRedemptionTask(''); };
  
  const updateRedemptionStatus = async (sanctionId: string, status: RedemptionStatus) => {
    setIsSubmitting(true);
    try {
        const updatedSanctions = DataService.getSanctions().map(s => s.id === sanctionId ? { ...s, redemptionStatus: status, redemptionDate: status === RedemptionStatus.COMPLETED ? new Date().toISOString() : s.redemptionDate, isRedeemed: status === RedemptionStatus.COMPLETED } : s);
        await DataService.saveSanctions(updatedSanctions);
        setRefreshKey(prev => prev + 1);
        if (status === RedemptionStatus.IN_PROGRESS) setSuccessMsg('Penebusan dimulai!'); else if (status === RedemptionStatus.COMPLETED) setSuccessMsg('Sanksi diselesaikan!');
        setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { alert("Gagal update status."); } finally { setIsSubmitting(false); }
  };

  const translateRecommendation = (rec: string) => { switch(rec) { case 'PARENT_CALL': return 'Panggilan Orang Tua'; case 'TO_KESISWAAN': return 'Rujuk ke Kesiswaan'; case 'SUSPENSION_REVIEW': return 'Tinjauan Skorsing'; case 'TO_BK': return 'Rujuk ke BK'; default: return '-'; } };
  
  const getStatusBadge = (status?: IncidentStatus) => {
    if (status === 'PENDING') return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold border border-yellow-200 flex items-center gap-1"><Clock className="h-3 w-3"/> PENDING</span>;
    if (status === 'REJECTED') return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold border border-red-200 flex items-center gap-1"><Ban className="h-3 w-3"/> DITOLAK</span>;
    return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold border border-green-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> OK</span>;
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500"><Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" /><p>Memuat profil siswa...</p></div>;
  if (!student) return <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500"><div className="bg-red-50 p-6 rounded-full mb-4"><User className="h-12 w-12 text-red-400" /></div><h2 className="text-xl font-bold text-slate-800">Siswa Tidak Ditemukan</h2><p className="mb-6">Data siswa mungkin telah dihapus atau ID tidak valid.</p><button onClick={() => navigate(-1)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Kembali</button></div>;

  const stats = DataService.calculateStudentPoints(student.id, records, incidents);
  const recommendedStatus = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const history = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const activeSanction = sanctions.find(s => s.redemptionStatus !== RedemptionStatus.COMPLETED);
  const studentClass = classes.find(c => c.id === student.classId);
  const className = studentClass ? `Kelas ${studentClass.name}` : 'Kelas Tidak Diketahui';
  const isReporterHomeroom = currentUser?.id === studentClass?.homeroomTeacherId;
  const homeroomSessions = counselingSessions.filter(s => s.sessionType === 'HOMEROOM');
  const bkSessions = counselingSessions.filter(s => s.sessionType === 'BK' || !s.sessionType);
  const violationRecords = records.filter(r => r.typeSnapshot === 'VIOLATION').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // FIX: Also exclude REFERRED and RETURNED_TO_BK from BK form list to avoid duplicates
  const activeViolationRecordsForForm = violationRecords.filter(r => r.bkStatus !== 'COMPLETED' && r.bkStatus !== 'REFERRED');
  
  const homeroomViolationRecords = violationRecords.filter(r => r.status === 'APPROVED' && r.bkStatus !== 'COMPLETED' && r.bkStatus !== 'REFERRED');
  const bkRule = rules.find(r => r.statusLabel.toUpperCase().includes('BK'));
  const bkThreshold = bkRule ? bkRule.minPoints : 40;
  const hasMandatoryBKCondition = stats.effectiveViolationScore >= bkThreshold || counselingSessions.some(s => s.sessionType === 'HOMEROOM' && s.recommendation === 'TO_BK') || records.some(r => r.bkStatus === 'REQUIRED');
  const roles = currentUser?.roles || [];
  const isAdmin = roles.includes(Role.ADMIN);
  const isEducator = roles.some(r => [Role.TEACHER, Role.WALIKELAS, Role.BK, Role.KESISWAAN].includes(r));
  const isBK = roles.includes(Role.BK);
  const isKesiswaan = roles.includes(Role.KESISWAAN);
  const showBkTab = isBK || (isKesiswaan && hasMandatoryBKCondition);
  const canInputBk = isBK; 
  const hasReferralToKesiswaan = counselingSessions.some(s => s.sessionType === 'BK' && (s.recommendation === 'TO_KESISWAAN' || s.recommendation === 'SUSPENSION_REVIEW'));
  const hasHighPoints = stats.effectiveViolationScore >= 80;
  const shouldShowSanctionPanel = isKesiswaan && (hasHighPoints || activeSanction !== undefined || hasReferralToKesiswaan);
  const canRecord = isEducator; 
  const filteredCategories = categories.filter(c => c.targetType === formType);
  const filteredIncidents = incidents.filter(i => i.isActive && i.type === formType && i.categoryId === selectedCategory);
  
  // Logic to find returned cases
  const returnedCaseRecords = records.filter(r => r.studentId === student.id && r.bkStatus === 'RETURNED_TO_BK');
  const hasReturnedCase = returnedCaseRecords.length > 0;

  // Logic for Homeroom Referral
  const activeHomeroomReferral = homeroomSessions.find(s => { 
      if (s.recommendation !== 'TO_BK') return false; 
      const relatedIds = s.relatedRecordIds || []; 
      if (relatedIds.length > 0) { 
          // Referral is active if any related record is NOT completed
          const hasActiveIncident = relatedIds.some(id => { 
              const rec = records.find(r => r.id === id); 
              return rec && rec.bkStatus !== 'COMPLETED' && rec.bkStatus !== 'REFERRED'; 
          }); 
          return hasActiveIncident; 
      } 
      // If no related IDs, check strictly date vs latest BK
      const newerBK = bkSessions.find(bk => new Date(bk.date) > new Date(s.date)); 
      return !newerBK; 
  });

  return (
    <div className="space-y-8 pb-12 animate-fade-in relative">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {isAdmin && !isEducator ? (<Link to="/admin/students" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 self-start"><ArrowLeft className="h-6 w-6" /></Link>) : (<button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 self-start"><ArrowLeft className="h-6 w-6" /></button>)}
        <div><h1 className="text-3xl font-bold text-slate-900">{student.name}</h1><p className="text-slate-500">NIS: {student.nis} • {className}</p></div>
        <div className={`md:ml-auto px-4 py-2 rounded-lg border font-bold text-sm flex items-center gap-2 ${activeSanction ? 'bg-red-600 text-white border-red-700' : recommendedStatus.color}`}><AlertTriangle className="h-4 w-4" />{activeSanction ? `Sanksi Aktif: ${activeSanction.level}` : `Status: ${recommendedStatus.statusLabel}`}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-red-300 transition-colors"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert className="h-16 w-16 text-red-600" /></div><p className="text-sm font-medium text-slate-500">Poin Pelanggaran</p><div className="mt-2 flex items-baseline gap-2"><span className={`text-4xl font-bold ${stats.effectiveViolationScore > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.effectiveViolationScore}</span><span className="text-sm text-slate-400">Poin</span></div><p className="mt-2 text-xs text-slate-400">Akumulatif (Disetujui)</p></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-emerald-300 transition-colors"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Award className="h-16 w-16 text-emerald-600" /></div><p className="text-sm font-medium text-slate-500">Poin Penghargaan</p><div className="mt-2 flex items-baseline gap-2"><span className="text-4xl font-bold text-emerald-600">{stats.achievementPoints}</span><span className="text-sm text-slate-400">Poin</span></div><p className="mt-2 text-xs text-slate-400">Total apresiasi positif</p></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-orange-300 transition-colors"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Gavel className="h-16 w-16 text-orange-600" /></div><p className="text-sm font-medium text-slate-500">Status Sanksi</p><div className="mt-2">{activeSanction ? (<div><span className="text-2xl font-bold text-red-600 block truncate" title={activeSanction.level}>{activeSanction.level}</span><div className="flex items-center gap-1 text-[10px] font-bold mt-1 uppercase">{activeSanction.redemptionStatus === RedemptionStatus.COMPLETED ? (<span className="text-emerald-500">SELESAI</span>) : activeSanction.redemptionStatus === RedemptionStatus.IN_PROGRESS ? (<span className="text-blue-500">PROSES PENEBUSAN</span>) : (<span className="text-red-500">BELUM DITEBUS</span>)}</div></div>) : (<div><span className="text-2xl font-bold text-emerald-600">Aman</span><p className="text-[10px] text-slate-400 mt-1 uppercase">Tidak ada sanksi aktif</p></div>)}</div><div className="mt-2 text-xs text-slate-400 truncate" title={`Rekomendasi: ${recommendedStatus.statusLabel}`}>Rek: {recommendedStatus.statusLabel}</div></div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden group hover:border-blue-300 transition-colors"><div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BarChart3 className="h-16 w-16 text-slate-600" /></div><div className="space-y-3 relative z-10"><div className="flex justify-between items-center text-sm"><span className="text-slate-500">Pelanggaran</span><span className="font-bold text-red-600">{stats.violationCount}x</span></div><div className="flex justify-between items-center text-sm"><span className="text-slate-500">Penghargaan</span><span className="font-bold text-emerald-600">{stats.achievementCount}x</span></div><div className="flex justify-between items-center text-sm"><span className="text-slate-500">Penebusan</span><span className="font-bold text-blue-600">{stats.redemptionCount}x</span></div></div></div>
      </div>

      <div className="border-b border-slate-200">
         <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
            <button onClick={() => setActiveTab('INCIDENTS')} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'INCIDENTS' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}><span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Catatan Kejadian</span></button>
            {isReporterHomeroom && (<button onClick={() => { setActiveTab('HOMEROOM'); setCounselingRec('NONE'); setHomeroomMode('CASE'); setSelectedCounselingRecords([]); }} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'HOMEROOM' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}><span className="flex items-center gap-2"><User className="h-4 w-4" /> Pembinaan Wali Kelas</span></button>)}
            {showBkTab && (<button onClick={() => { setActiveTab('BK_COUNSELING'); setCounselingRec('NONE'); setBkMode('CASE'); setSelectedCounselingRecords([]); }} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'BK_COUNSELING' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}><span className="flex items-center gap-2"><HeartHandshake className="h-4 w-4" /> Bimbingan Konseling</span></button>)}
            {shouldShowSanctionPanel && (<button onClick={() => setActiveTab('SANCTIONS')} className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'SANCTIONS' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}><span className="flex items-center gap-2"><Gavel className="h-4 w-4" /> Panel Kesiswaan</span></button>)}
         </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* TAB 1: INCIDENTS */}
        {activeTab === 'INCIDENTS' && (
           <>
              <div className="lg:col-span-2 space-y-6">
                {canRecord ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h2 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-indigo-600" /> Input Kejadian Baru</h2></div>
                      <form onSubmit={handleSubmitIncident} className="p-6 space-y-6">
                      {!isReporterHomeroom && formType === IncidentTypeCategory.VIOLATION && (<div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-sm text-yellow-800 flex items-start gap-2"><AlertCircle className="h-5 w-5 shrink-0" /><div><p className="font-bold">Menunggu Persetujuan Wali Kelas</p><p className="text-xs mt-1">Anda bukan wali kelas siswa ini. Laporan pelanggaran akan berstatus <b>PENDING</b> sampai disetujui oleh Wali Kelas.</p></div></div>)}
                      <div className="flex p-1 bg-slate-100 rounded-xl"><button type="button" onClick={() => handleTypeChange(IncidentTypeCategory.VIOLATION)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${formType === IncidentTypeCategory.VIOLATION ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><ShieldAlert className="h-4 w-4" /> Pelanggaran</button><button type="button" onClick={() => handleTypeChange(IncidentTypeCategory.ACHIEVEMENT)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${formType === IncidentTypeCategory.ACHIEVEMENT ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Award className="h-4 w-4" /> Penghargaan</button></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-700 mb-2">Kategori <span className="text-red-500">*</span></label><select required value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedIncident(''); }} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900"><option value="">-- Pilih Kategori --</option>{filteredCategories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}</select></div><div><label className="block text-sm font-medium text-slate-700 mb-2">Jenis Kejadian <span className="text-red-500">*</span></label><select required disabled={!selectedCategory} value={selectedIncident} onChange={(e) => setSelectedIncident(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"><option value="">-- Pilih Kejadian --</option>{filteredIncidents.map(inc => (<option key={inc.id} value={inc.id}>{inc.name} ({inc.points} Poin)</option>))}</select></div></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-2">Bukti Foto (Opsional)</label>{!imageProof ? (<label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${isCompressing ? 'opacity-50 cursor-wait' : ''}`}><div className="flex flex-col items-center justify-center pt-5 pb-6">{isCompressing ? (<><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div><p className="text-sm text-slate-500">Memproses gambar...</p></>) : (<><ImageIcon className="w-8 h-8 text-slate-400 mb-2" /><p className="text-sm text-slate-500"><span className="font-semibold">Klik untuk upload</span></p></>)}</div><input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isCompressing} /></label>) : (<div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden border border-slate-300"><img src={imageProof} alt="Preview" className="w-full h-full object-contain" /><button type="button" onClick={() => setImageProof(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"><X className="w-4 h-4" /></button></div>)}</div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-2">Catatan Tambahan (Opsional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900" placeholder="Keterangan kejadian..." /></div>
                      {successMsg && (<div className="p-4 bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> {successMsg}</div>)}
                      <button type="submit" disabled={isSubmitting || !selectedIncident || !selectedCategory || isCompressing} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-md transition-all"><Save className="h-5 w-5" /> {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}</button></form>
                  </div>
                ) : (<div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-500"><Lock className="h-12 w-12 mb-4 text-slate-300" /><h3 className="text-lg font-semibold text-slate-700">Mode Lihat Saja</h3><p>Akun ini tidak memiliki akses untuk mencatat kejadian.</p></div>)}
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-2"><History className="h-5 w-5" /> Riwayat Kejadian</div>
                <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
                  {history.length === 0 ? (<div className="text-slate-500 text-sm italic">Belum ada riwayat tercatat.</div>) : (history.map(record => {
                      const incName = incidents.find(i => i.id === record.incidentTypeId)?.name || 'Unknown';
                      const isCompleted = record.bkStatus === 'COMPLETED';
                      const isRequired = record.bkStatus === 'REQUIRED';
                      const isReferred = record.bkStatus === 'REFERRED';
                      const isReturned = record.bkStatus === 'RETURNED_TO_BK';
                      
                      return (
                        <div key={record.id} onClick={() => handleOpenDetail(record)} className={`bg-white p-3 rounded-lg border shadow-sm transition-all cursor-pointer group relative overflow-hidden ${isCompleted ? 'border-emerald-200 bg-emerald-50/50' : isReferred ? 'border-orange-200 bg-orange-50/50' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'}`}>
                          {isCompleted && (<div className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-bl-lg text-[10px] font-bold border-l border-b border-emerald-200 flex items-center gap-1"><Check className="h-3 w-3" /> KASUS SELESAI</div>)}
                          {isReferred && (<div className="absolute top-0 right-0 bg-orange-100 text-orange-700 px-2 py-1 rounded-bl-lg text-[10px] font-bold border-l border-b border-orange-200 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> DI KESISWAAN</div>)}
                          {isReturned && (<div className="absolute top-0 right-0 bg-red-100 text-red-700 px-2 py-1 rounded-bl-lg text-[10px] font-bold border-l border-b border-red-200 flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> DIKEMBALIKAN</div>)}
                          {isRequired && !isReturned && (<div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-2 py-1 rounded-bl-lg text-[10px] font-bold border-l border-b border-blue-200 flex items-center gap-1 animate-pulse"><ArrowRight className="h-3 w-3" /> DIRUJUK KE BK</div>)}
                          <div className="flex justify-between items-start mb-1 pr-24"><div className="flex-1"><h4 className={`font-bold text-sm line-clamp-1 ${isCompleted ? 'text-emerald-900' : 'text-slate-800 group-hover:text-indigo-600'}`}>{incName}</h4><p className="text-xs text-slate-500 mt-0.5">{new Date(record.date).toLocaleDateString()} • {record.recordedBy}</p></div></div>
                          <div className="flex justify-between items-center mt-2"><div className="flex items-center gap-2">{getStatusBadge(record.status)}<span className={`text-[10px] font-bold px-2 py-1 rounded border border-transparent ${record.typeSnapshot === 'VIOLATION' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{record.typeSnapshot === 'VIOLATION' ? `+${record.pointSnapshot}` : record.pointSnapshot} Pt</span></div><div className="flex items-center gap-1 text-xs text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Lihat Detail <ArrowLeft className="h-3 w-3 rotate-180" /></div></div>
                        </div>
                      )
                    }))}
                </div>
              </div>
           </>
        )}

        {/* TAB 2: HOMEROOM */}
        {activeTab === 'HOMEROOM' && isReporterHomeroom && (
           <>
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="p-6 border-b flex justify-between items-center bg-orange-50 border-orange-100"><h2 className="font-bold flex items-center gap-2 text-orange-800"><User className="h-5 w-5" /> Catat Pembinaan Wali Kelas</h2></div>
                   <div className="px-6 pt-6"><div className="flex p-1 bg-slate-100 rounded-lg"><button onClick={() => setHomeroomMode('CASE')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${homeroomMode === 'CASE' ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-200' : 'text-slate-500 hover:text-slate-700'}`}><Shield className="h-4 w-4" /> Pembinaan Kasus (Disiplin)</button><button onClick={() => setHomeroomMode('PREVENTIVE')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${homeroomMode === 'PREVENTIVE' ? 'bg-white text-yellow-600 shadow-sm ring-1 ring-yellow-200' : 'text-slate-500 hover:text-slate-700'}`}><Users className="h-4 w-4" /> Pembinaan Preventif (Personal)</button></div></div>
                   <form onSubmit={(e) => handleSubmitCounseling(e, 'HOMEROOM')} className="p-6 space-y-6">
                      {homeroomMode === 'CASE' ? (
                          <>
                            <div className="p-4 rounded-lg text-sm border mb-4 bg-orange-50 text-orange-800 border-orange-100"><p className="font-bold mb-1 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Mode Pembinaan Kasus</p><p>Pilih pelanggaran di bawah ini untuk ditindaklanjuti. Pembinaan ini tercatat dalam alur disiplin siswa.</p></div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">Pilih Pelanggaran Terkait</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                                    {homeroomViolationRecords.length === 0 ? (<p className="text-xs text-slate-400 italic p-4 text-center">Tidak ada pelanggaran aktif yang belum tuntas.</p>) : (homeroomViolationRecords.map(record => {
                                            const incidentName = incidents.find(i => i.id === record.incidentTypeId)?.name || 'Unknown';
                                            const isSelected = selectedCounselingRecords.includes(record.id);
                                            return (
                                                <div key={record.id} onClick={() => toggleCounselingRecord(record.id)} className={`p-3 rounded-lg border cursor-pointer text-xs flex items-center gap-3 transition-all ${isSelected ? 'bg-orange-50 border-orange-300 text-orange-900' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-300'}`}>{isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}</div>
                                                    <div className="flex-1"><div className="flex justify-between"><span className="font-bold text-sm">{incidentName}</span><span className="font-bold text-red-600">+{record.pointSnapshot} Poin</span></div><div className="flex items-center gap-2 mt-1"><span className="text-slate-500">{new Date(record.date).toLocaleDateString()}</span></div></div>
                                                </div>
                                            )
                                        }))}
                                </div>
                            </div>
                          </>
                      ) : (<div className="p-4 rounded-lg text-sm border mb-4 bg-yellow-50 text-yellow-800 border-yellow-100"><p className="font-bold mb-1 flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> Mode Pembinaan Preventif</p><p>Gunakan untuk sesi curhat, masalah keluarga, atau motivasi belajar. Tidak terkait poin pelanggaran.</p></div>)}
                      <div><label className="block text-sm font-medium text-slate-700 mb-2">Catatan Pembinaan / Solusi <span className="text-red-500">*</span></label><textarea required value={counselingNotes} onChange={(e) => setCounselingNotes(e.target.value)} rows={6} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-slate-900" placeholder="Jelaskan permasalahan siswa..." /></div>
                      
                      {/* MANDATORY IMAGE UPLOAD */}
                      <div><label className="block text-sm font-medium text-slate-700 mb-2">Bukti Foto Dokumentasi <span className="text-red-500">*</span></label>{!imageProof ? (<label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${isCompressing ? 'opacity-50 cursor-wait' : ''}`}><div className="flex flex-col items-center justify-center pt-5 pb-6">{isCompressing ? (<><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-2"></div><p className="text-sm text-slate-500">Memproses gambar...</p></>) : (<><ImageIcon className="w-8 h-8 text-slate-400 mb-2" /><p className="text-sm text-slate-500"><span className="font-semibold">Klik untuk upload</span> (Wajib)</p></>)}</div><input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isCompressing} /></label>) : (<div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden border border-slate-300"><img src={imageProof} alt="Preview" className="w-full h-full object-contain" /><button type="button" onClick={() => setImageProof(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"><X className="w-4 h-4" /></button></div>)}</div>

                      <div><label className="block text-sm font-medium text-slate-700 mb-2">Rekomendasi Tindak Lanjut</label><select value={counselingRec} onChange={(e) => setCounselingRec(e.target.value as any)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-slate-900"><option value="NONE">Selesai (Cukup Pembinaan)</option><option value="PARENT_CALL">Perlu Panggilan Orang Tua</option>{homeroomMode === 'CASE' ? (<option value="TO_BK">Rujuk ke BK (Eskalasi Kasus Disiplin)</option>) : (<option value="TO_BK">Rekomendasi Konseling BK (Preventif)</option>)}</select></div>
                      
                      <button type="submit" disabled={isSubmitting || !counselingNotes || !imageProof || isCompressing} className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-md transition-all"><Save className="h-5 w-5" /> Simpan Pembinaan</button>
                   </form>
                </div>
             </div>
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-2"><BookOpen className="h-5 w-5" /> Riwayat Pembinaan</div>
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {homeroomSessions.length === 0 ? <div className="text-slate-500 text-sm italic">Belum ada data.</div> : 
                    homeroomSessions.map(session => {
                      const isCaseSession = session.relatedRecordIds && session.relatedRecordIds.length > 0;
                      let isCaseResolved = false;
                      if (isCaseSession) { const relatedRecs = records.filter(r => session.relatedRecordIds?.includes(r.id)); if (relatedRecs.length > 0 && relatedRecs.every(r => r.bkStatus === 'COMPLETED')) { isCaseResolved = true; } }
                      const isReferredToBK = session.recommendation === 'TO_BK';
                      return (
                        <div key={session.id} onClick={() => handleOpenDetail(session)} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md cursor-pointer hover:border-orange-300">
                           <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isCaseResolved ? 'bg-emerald-500' : isReferredToBK ? 'bg-blue-500 animate-pulse' : isCaseSession ? 'bg-yellow-400' : 'bg-slate-400'}`} />
                           <div className="flex justify-between items-start mb-2 pl-2">
                             <div className="flex flex-col"><span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit mb-1 ${isCaseSession ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{isCaseSession ? 'Pembinaan Kasus' : 'Pembinaan Preventif'}</span><div className="text-xs font-semibold text-slate-500">{new Date(session.date).toLocaleDateString()}</div></div>
                             {isCaseResolved ? (<span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Kasus Selesai</span>) : isReferredToBK ? (<span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-200 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Dirujuk ke BK</span>) : (session.recommendation !== 'NONE' && (<span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded border border-red-100">! {translateRecommendation(session.recommendation)}</span>))}
                           </div>
                           <p className="text-sm text-slate-700 whitespace-pre-wrap pl-2 border-l-2 border-slate-100 ml-1 line-clamp-2">{session.notes}</p>
                           {isCaseSession && <div className="mt-3 ml-2 text-[10px] bg-slate-100 text-slate-600 p-2 rounded border border-slate-200 flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-orange-500" /><span>Menindaklanjuti {session.relatedRecordIds!.length} pelanggaran.</span></div>}
                           <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1 pl-2"><span className="font-semibold text-slate-500">Wali Kelas:</span> {session.counselorName} <span className="text-indigo-500 font-bold ml-auto flex items-center gap-1">Detail <ArrowLeft className="h-3 w-3 rotate-180" /></span></div>
                        </div>
                      )
                    })
                  }
                </div>
             </div>
           </>
        )}

        {/* TAB 3: BK */}
        {activeTab === 'BK_COUNSELING' && showBkTab && (
           <>
             {canInputBk && (
                <div className="lg:col-span-2 space-y-6">
                    {/* ALERT FOR RETURNED CASES */}
                    {hasReturnedCase && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex gap-3 animate-fade-in shadow-sm mb-4">
                            <div className="bg-red-100 p-2 rounded-full h-fit"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-red-800 text-sm">Kasus Dikembalikan Kesiswaan</h3>
                                <p className="text-xs text-red-700 mt-1">
                                    Kasus ini telah dikembalikan oleh Kesiswaan untuk penanganan lebih lanjut oleh BK. 
                                    Harap lakukan konseling tambahan sebelum menutup kasus atau merujuk kembali.
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <button onClick={() => { setBkMode('CASE'); setSelectedCounselingRecords(returnedCaseRecords.map(r => r.id)); window.scrollTo({top: 400, behavior:'smooth'}); }} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded font-bold hover:bg-red-700 flex items-center gap-1 shadow-sm"><Check className="h-3 w-3" /> Tangani Sekarang</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeHomeroomReferral && !hasReturnedCase && (
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex gap-3 animate-fade-in shadow-sm">
                            <div className="bg-blue-100 p-2 rounded-full h-fit"><AlertTriangle className="h-6 w-6 text-blue-600" /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-blue-800 text-sm">Menindaklanjuti Rujukan Wali Kelas</h3>
                                <p className="text-xs text-blue-700 mt-1"><b>{activeHomeroomReferral.counselorName}</b> merujuk siswa ini pada tanggal <b>{new Date(activeHomeroomReferral.date).toLocaleDateString()}</b>.<br/>Catatan: <i>"{activeHomeroomReferral.notes}"</i></p>
                                <div className="mt-3 flex gap-2"><button onClick={() => { setBkMode('CASE'); setSelectedCounselingRecords(activeHomeroomReferral.relatedRecordIds || []); }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm"><Check className="h-3 w-3" /> Tangani Kasus Ini Sekarang</button></div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-center bg-violet-50 border-violet-100"><h2 className="font-bold flex items-center gap-2 text-violet-800"><HeartHandshake className="h-5 w-5" /> Catat Sesi Konseling BK</h2></div>
                    <div className="px-6 pt-6"><div className="flex p-1 bg-slate-100 rounded-lg">{hasMandatoryBKCondition && (<button onClick={() => setBkMode('CASE')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${bkMode === 'CASE' ? 'bg-white text-violet-600 shadow-sm ring-1 ring-violet-200' : 'text-slate-500 hover:text-slate-700'}`}><Shield className="h-4 w-4" /> Konseling Kasus (Disiplin)</button>)}<button onClick={() => setBkMode('PREVENTIVE')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${bkMode === 'PREVENTIVE' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-500 hover:text-slate-700'}`}><LifeBuoy className="h-4 w-4" /> Konseling Preventif</button></div></div>
                    <form onSubmit={(e) => handleSubmitCounseling(e, 'BK')} className="p-6 space-y-6">
                        {bkMode === 'CASE' ? (
                            <>
                                <div className="p-4 rounded-lg text-sm border mb-4 bg-violet-50 text-violet-800 border-violet-100 flex items-start gap-2"><AlertTriangle className="h-5 w-5 shrink-0" /><div><p className="font-bold">Mode Penanganan Kasus</p><p className="text-xs mt-1">Gunakan mode ini untuk menindaklanjuti pelanggaran spesifik. Kasus yang dipilih akan ditandai sebagai <b>SELESAI</b> jika tidak dirujuk ke Kesiswaan.</p></div></div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">Pilih Kasus / Pelanggaran Terkait</label>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                                        {activeViolationRecordsForForm.length === 0 && returnedCaseRecords.length === 0 ? (<p className="text-xs text-slate-400 italic p-4 text-center">Tidak ada pelanggaran aktif yang butuh penanganan.</p>) : (
                                            <>
                                            {/* Returned Cases First */}
                                            {returnedCaseRecords.map(record => {
                                                const incidentName = incidents.find(i => i.id === record.incidentTypeId)?.name || 'Unknown';
                                                const isSelected = selectedCounselingRecords.includes(record.id);
                                                return (
                                                    <div key={record.id} onClick={() => toggleCounselingRecord(record.id)} className={`p-3 rounded-lg border cursor-pointer text-xs flex items-center gap-3 transition-all ${isSelected ? 'bg-red-50 border-red-300 text-red-900' : 'bg-red-50/50 border-red-200 hover:bg-red-50'}`}>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-red-500 border-red-500' : 'bg-white border-slate-300'}`}>{isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}</div>
                                                        <div className="flex-1"><div className="flex justify-between"><span className="font-bold text-sm">{incidentName}</span><span className="font-bold text-red-600">+{record.pointSnapshot} Poin</span></div><div className="flex items-center gap-2 mt-1"><span className="text-slate-500">{new Date(record.date).toLocaleDateString()}</span><span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">DIKEMBALIKAN</span></div></div>
                                                    </div>
                                                )
                                            })}
                                            {/* Active Violations */}
                                            {activeViolationRecordsForForm.map(record => {
                                                const incidentName = incidents.find(i => i.id === record.incidentTypeId)?.name || 'Unknown';
                                                const isSelected = selectedCounselingRecords.includes(record.id);
                                                const isRequired = record.bkStatus === 'REQUIRED';
                                                return (
                                                    <div key={record.id} onClick={() => toggleCounselingRecord(record.id)} className={`p-3 rounded-lg border cursor-pointer text-xs flex items-center gap-3 transition-all ${isSelected ? 'bg-violet-50 border-violet-300 text-violet-900' : 'bg-white border-slate-200 hover:bg-slate-100'}`}>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-500 border-violet-500' : 'bg-white border-slate-300'}`}>{isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}</div>
                                                        <div className="flex-1"><div className="flex justify-between"><span className="font-bold text-sm">{incidentName}</span><span className="font-bold text-red-600">+{record.pointSnapshot} Poin</span></div><div className="flex items-center gap-2 mt-1"><span className="text-slate-500">{new Date(record.date).toLocaleDateString()}</span>{isRequired && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">WAJIB</span>}</div></div>
                                                    </div>
                                                )
                                            })}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (<div className="p-4 rounded-lg text-sm border mb-4 bg-blue-50 text-blue-800 border-blue-100 flex items-start gap-2"><LifeBuoy className="h-5 w-5 shrink-0" /><div><p className="font-bold">Mode Konseling Preventif</p><p className="text-xs mt-1">Gunakan mode ini untuk bimbingan karir, masalah pribadi, atau rujukan wali kelas yang <b>bukan</b> pelanggaran disiplin. Tidak mengubah status poin.</p></div></div>)}
                        
                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Catatan Konseling / Hasil <span className="text-red-500">*</span></label><textarea required value={counselingNotes} onChange={(e) => setCounselingNotes(e.target.value)} rows={6} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white text-slate-900" placeholder={bkMode === 'CASE' ? "Jelaskan penyelesaian kasus dan komitmen siswa..." : "Catat hasil diskusi dan saran pengembangan diri..."} /></div>
                        
                        {/* MANDATORY IMAGE UPLOAD */}
                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Bukti Foto Dokumentasi <span className="text-red-500">*</span></label>{!imageProof ? (<label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${isCompressing ? 'opacity-50 cursor-wait' : ''}`}><div className="flex flex-col items-center justify-center pt-5 pb-6">{isCompressing ? (<><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mb-2"></div><p className="text-sm text-slate-500">Memproses gambar...</p></>) : (<><ImageIcon className="w-8 h-8 text-slate-400 mb-2" /><p className="text-sm text-slate-500"><span className="font-semibold">Klik untuk upload</span> (Wajib)</p></>)}</div><input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isCompressing} /></label>) : (<div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden border border-slate-300"><img src={imageProof} alt="Preview" className="w-full h-full object-contain" /><button type="button" onClick={() => setImageProof(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"><X className="w-4 h-4" /></button></div>)}</div>

                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Rekomendasi Tindak Lanjut</label><select value={counselingRec} onChange={(e) => setCounselingRec(e.target.value as any)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white text-slate-900"><option value="NONE">Cukup Pembinaan (Selesai)</option><option value="PARENT_CALL">Perlu Panggilan Orang Tua</option><option value="TO_KESISWAAN">Rujuk ke Kesiswaan (Eskalasi)</option><option value="SUSPENSION_REVIEW">Tinjauan Skorsing</option></select></div>
                        <button type="submit" disabled={isSubmitting || !counselingNotes || !imageProof || isCompressing} className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-md transition-all"><Save className="h-5 w-5" /> {isSubmitting ? 'Menyimpan...' : 'Simpan Laporan BK'}</button>
                    </form>
                    </div>
                </div>
             )}
             <div className={`space-y-4 ${!canInputBk ? 'lg:col-span-3' : ''}`}>
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-2"><BookOpen className="h-5 w-5" /> Riwayat Konseling BK</div>
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {bkSessions.length === 0 ? <div className="text-slate-500 text-sm italic">Belum ada data.</div> : 
                    bkSessions.map(session => {
                      const isCaseCounseling = session.relatedRecordIds && session.relatedRecordIds.length > 0;
                      let isCaseResolved = false;
                      if (isCaseCounseling) { const relatedRecs = records.filter(r => session.relatedRecordIds?.includes(r.id)); if (relatedRecs.length > 0 && relatedRecs.every(r => r.bkStatus === 'COMPLETED')) { isCaseResolved = true; } }
                      const isReferralResponse = homeroomSessions.some(h => h.recommendation === 'TO_BK' && new Date(h.date) < new Date(session.date) && ((session.relatedRecordIds?.some(id => h.relatedRecordIds?.includes(id))) || (!session.relatedRecordIds?.length && !h.relatedRecordIds?.length)));
                      const isReferralToKesiswaan = session.recommendation === 'TO_KESISWAAN' || session.recommendation === 'SUSPENSION_REVIEW';

                      return (
                        <div key={session.id} onClick={() => handleOpenDetail(session)} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md cursor-pointer hover:border-violet-300">
                           <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isCaseResolved ? 'bg-emerald-500' : isReferralToKesiswaan ? 'bg-orange-500' : isCaseCounseling ? 'bg-violet-500' : 'bg-blue-400'}`} />
                           {isReferralResponse && (<div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-2 py-1 rounded-bl-lg text-[9px] font-bold flex items-center gap-1 border-l border-b border-blue-200"><ArrowDown className="h-3 w-3" /> RESPON RUJUKAN</div>)}
                           <div className="flex justify-between items-start mb-3 pl-2 pr-20"><div className="flex flex-col"><span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit mb-1 ${isCaseCounseling ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{isCaseCounseling ? 'Konseling Kasus' : 'Konseling Preventif'}</span><span className="text-xs font-semibold text-slate-500">{new Date(session.date).toLocaleDateString()}</span></div></div>
                           <div className="mb-3 pl-2 flex flex-wrap gap-2">{isCaseResolved ? (<span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded border border-emerald-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Kasus Selesai</span>) : isReferralToKesiswaan ? (<span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase rounded border border-orange-200 flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Ke Kesiswaan</span>) : (session.recommendation !== 'NONE' && (<span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded border border-red-100">! {translateRecommendation(session.recommendation)}</span>))}</div>
                           <p className="text-sm text-slate-700 whitespace-pre-wrap pl-2 border-l-2 border-slate-100 ml-1 line-clamp-2">{session.notes}</p>
                           {isCaseCounseling && <div className="mt-3 ml-2 text-[10px] bg-slate-100 text-slate-600 p-2 rounded border border-slate-200 flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-violet-500" /><span>Menangani {session.relatedRecordIds!.length} kasus pelanggaran.</span></div>}
                           <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1 pl-2"><User className="h-3 w-3" /> <span className="font-semibold text-slate-500">Konselor:</span> {session.counselorName} <span className="text-indigo-500 font-bold ml-auto flex items-center gap-1">Detail <ArrowLeft className="h-3 w-3 rotate-180" /></span></div>
                        </div>
                      )
                    })
                  }
                </div>
             </div>
           </>
        )}

        {/* TAB 4: SANCTIONS */}
        {activeTab === 'SANCTIONS' && shouldShowSanctionPanel && (
           <>
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className={`p-6 border-b border-slate-100 flex justify-between items-center ${editingSanctionId ? 'bg-orange-50' : 'bg-red-50'}`}>
                     <h2 className={`font-bold flex items-center gap-2 ${editingSanctionId ? 'text-orange-800' : 'text-slate-800'}`}>{editingSanctionId ? <PenSquare className="h-5 w-5" /> : <Gavel className="h-5 w-5 text-red-600" />}{editingSanctionId ? 'Edit Sanksi / Beri Tugas' : 'Panel Kesiswaan (Sanksi)'}</h2>
                     {editingSanctionId && <button onClick={cancelEditSanction} className="text-xs text-orange-700 hover:underline font-bold">Batal Edit</button>}
                   </div>
                   <form onSubmit={handleAssignSanction} className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-medium text-slate-700 mb-2">Tingkat Sanksi</label>
                             <select value={sanctionLevel} onChange={(e) => setSanctionLevel(e.target.value as any)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-slate-900">
                                {availableSanctionOptions.length > 0 ? (
                                    availableSanctionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                                ) : (
                                    <option value="" disabled>Semua Sanksi Sudah Diberikan</option>
                                )}
                             </select>
                             <p className="text-[10px] text-slate-500 mt-1">*Opsi disesuaikan dengan poin ({stats.effectiveViolationScore}) dan riwayat sanksi siswa.</p>
                         </div>
                         <div><label className="block text-sm font-medium text-slate-700 mb-2">Tugas Penebusan</label><input type="text" value={sanctionRedemptionTask} onChange={(e) => setSanctionRedemptionTask(e.target.value)} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-slate-900" placeholder="Contoh: Membersihkan Masjid..." /></div>
                      </div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-2">Alasan</label><textarea required value={sanctionNotes} onChange={(e) => setSanctionNotes(e.target.value)} rows={4} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-slate-900" placeholder="Dasar penetapan..." /></div>
                      <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold py-4 rounded-xl shadow-md">{editingSanctionId ? <Save className="h-5 w-5" /> : <Gavel className="h-5 w-5" />} {isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
                   </form>
                </div>
             </div>
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-2"><Gavel className="h-5 w-5" /> Riwayat Sanksi</div>
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {sanctions.length === 0 ? <div className="text-slate-500 text-sm italic">Belum ada sanksi.</div> : 
                    sanctions.map(item => (
                      <div key={item.id} onClick={() => handleOpenDetail(item)} className={`bg-white p-5 rounded-xl border shadow-sm relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${editingSanctionId === item.id ? 'border-orange-400 ring-2 ring-orange-100' : 'border-slate-200'}`}>
                         <div className="flex justify-between items-start mb-2"><div className="text-xs font-semibold text-slate-500">{new Date(item.assignedDate).toLocaleDateString()}</div><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${item.redemptionStatus === RedemptionStatus.COMPLETED ? 'bg-green-100 text-green-700 border-green-200' : item.redemptionStatus === RedemptionStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{item.redemptionStatus === RedemptionStatus.COMPLETED ? 'Selesai' : item.redemptionStatus === RedemptionStatus.IN_PROGRESS ? 'Sedang Jalan' : 'Belum Dikerjakan'}</span></div>
                         <div className="flex items-center justify-between mb-2"><span className="text-lg font-bold text-red-600">{item.level}</span>{item.redemptionStatus === RedemptionStatus.NONE && <button onClick={(e) => { e.stopPropagation(); startEditSanction(item); }} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-bold z-10 relative"><PenSquare className="h-3 w-3" /> Edit</button>}</div>
                         <p className="text-sm text-slate-700 mb-3 bg-slate-50 p-2 rounded">"{item.notes}"</p>
                         {item.redemptionTask && <div className="text-xs bg-yellow-50 p-2 rounded border border-yellow-100 text-yellow-800 mb-3"><b>Tugas:</b> {item.redemptionTask}</div>}
                         <div className="flex gap-2 justify-end mt-2">
                            {item.redemptionStatus === RedemptionStatus.ASSIGNED && item.redemptionTask && (<button onClick={(e) => { e.stopPropagation(); updateRedemptionStatus(item.id, RedemptionStatus.IN_PROGRESS); }} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm flex items-center gap-1 z-10 relative"><Play className="h-3 w-3" /> Mulai Penebusan</button>)}
                            {item.redemptionStatus === RedemptionStatus.IN_PROGRESS && (<button onClick={(e) => { e.stopPropagation(); updateRedemptionStatus(item.id, RedemptionStatus.COMPLETED); }} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 shadow-sm flex items-center gap-1 z-10 relative"><Check className="h-3 w-3" /> Selesai</button>)}
                         </div>
                         <div className="mt-2 text-[10px] text-slate-400 text-right flex items-center justify-end gap-1">Oleh: {item.assignedBy} <span className="text-indigo-500 font-bold ml-2">Detail</span></div>
                      </div>
                    ))
                  }
                </div>
             </div>
           </>
        )}

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
                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>
                            {storyLine.map((step, idx) => (
                                <div key={step.id} className="relative z-10 flex gap-4 mb-8 last:mb-0 group">
                                    <div className={`w-12 h-12 rounded-full border-4 border-slate-50 flex items-center justify-center shrink-0 shadow-sm ${step.type === 'INCIDENT' ? 'bg-white text-slate-600' : step.type === 'APPROVAL' ? 'bg-green-100 text-green-600' : step.type === 'COUNSELING_WALAS' ? 'bg-orange-100 text-orange-600' : step.type === 'COUNSELING_BK' ? 'bg-blue-100 text-blue-600' : step.type === 'KESISWAAN' ? 'bg-red-600 text-white' : 'bg-red-600 text-white'}`}>
                                        {step.type === 'INCIDENT' && <FileText className="h-5 w-5" />}
                                        {step.type === 'APPROVAL' && <CheckCircle2 className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_WALAS' && <User className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_BK' && <HeartHandshake className="h-5 w-5" />}
                                        {step.type === 'KESISWAAN' && <Gavel className="h-5 w-5" />}
                                        {step.type === 'SANCTION' && <Gavel className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">{step.title}</h4>
                                                <p className="text-xs text-slate-500 font-mono mt-0.5">{new Date(step.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {new Date(step.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                                            </div>
                                            {step.statusLabel && <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${step.statusColor || 'bg-slate-100 text-slate-600'}`}>{step.statusLabel}</span>}
                                        </div>
                                        <div className="text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100"><span className="font-semibold">Oleh:</span> {step.actor} {step.scoreImpact && <span className="ml-2 font-bold text-red-600">(Bobot: {step.scoreImpact} Poin)</span>}</div>
                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{step.description || '-'}"</p>
                                        {step.attachmentUrl && (
                                            <div className="mt-3 flex justify-end"><button onClick={() => setPreviewImage(step.attachmentUrl || null)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors border border-slate-200"><Paperclip className="h-3 w-3" /> Lampiran Bukti</button></div>
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

      </div>
    </div>
  );
};

export default StudentProfile;
