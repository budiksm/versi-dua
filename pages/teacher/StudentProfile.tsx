import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  RedemptionStatus
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
  CheckSquare,
  BarChart3,
  Clock,
  PlayCircle,
  AlertCircle,
  Megaphone
} from 'lucide-react';

const StudentProfile: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<Student | null>(null);
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
  const [activeTab, setActiveTab] = useState<'INCIDENTS' | 'COUNSELING' | 'SANCTIONS'>('INCIDENTS');

  // Form State (Incident)
  const [formType, setFormType] = useState<IncidentTypeCategory>(IncidentTypeCategory.VIOLATION);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [imageProof, setImageProof] = useState<string | null>(null);
  
  // Form State (Counseling)
  const [counselingNotes, setCounselingNotes] = useState('');
  const [counselingRec, setCounselingRec] = useState<'NONE' | 'PARENT_CALL' | 'TO_KESISWAAN' | 'SUSPENSION_REVIEW'>('NONE');

  // Form State (Sanction - Kesiswaan Only)
  const [sanctionLevel, setSanctionLevel] = useState<SanctionLevel>(SanctionLevel.SP1);
  const [sanctionNotes, setSanctionNotes] = useState('');
  const [sanctionRedemptionTask, setSanctionRedemptionTask] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Get real logged in user
    const user = DataService.getCurrentUser();
    setCurrentUser(user);

    if (!studentId) return;
    setStudent(DataService.getStudents().find((s: any) => s.id === studentId) || null);
    setRecords(DataService.getRecords().filter((r: any) => r.studentId === studentId));
    setCategories(DataService.getCategories());
    setIncidents(DataService.getIncidentTypes());
    setRules(DataService.getRules());
    setClasses(DataService.getClasses());
    
    // Get Counseling
    const allSessions = DataService.getCounselingSessions();
    setCounselingSessions(allSessions.filter((s: any) => s.studentId === studentId).sort((a:any,b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // Get Sanctions
    const allSanctions = DataService.getSanctions();
    setSanctions(allSanctions.filter((s: any) => s.studentId === studentId).sort((a:any,b:any) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()));

  }, [studentId, refreshKey]);

  if (!student) return <div className="p-8">Siswa tidak ditemukan</div>;

  // Calculate Points
  const stats = DataService.calculateStudentPoints(student.id, records, incidents);
  const recommendedStatus = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
  const history = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Get active sanction
  const activeSanction = sanctions.find(s => s.redemptionStatus !== RedemptionStatus.COMPLETED);
  
  // Get latest Counseling with recommendation (For Kesiswaan Display)
  const latestReferralSession = counselingSessions.find(s => s.recommendation === 'TO_KESISWAAN' || s.recommendation === 'SUSPENSION_REVIEW' || s.status === 'OPEN');

  // Get Dynamic Class Name
  const studentClass = classes.find(c => c.id === student.classId);
  const className = studentClass ? `Kelas ${studentClass.name}` : 'Kelas Tidak Diketahui';

  // PERMISSION LOGIC (Updated for Multi-Role)
  const roles = currentUser?.roles || [];
  
  const isAdmin = roles.includes(Role.ADMIN);
  const isEducator = roles.some(r => [Role.TEACHER, Role.WALIKELAS, Role.BK, Role.KESISWAAN].includes(r));
  const isBK = roles.includes(Role.BK);
  const isKesiswaan = roles.includes(Role.KESISWAAN);

  // Can Record Incident: Educators
  const canRecord = isEducator; 

  // Filtering Logic
  const filteredCategories = categories.filter(c => c.targetType === formType);
  const filteredIncidents = incidents.filter(i => 
    i.isActive && 
    i.type === formType && 
    i.categoryId === selectedCategory
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTypeChange = (type: IncidentTypeCategory) => {
    setFormType(type);
    setSelectedCategory('');
    setSelectedIncident('');
  };

  const handleSubmitIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !selectedCategory) return;
    
    setIsSubmitting(true);
    
    const incidentDef = incidents.find(i => i.id === selectedIncident);
    if (!incidentDef) return;

    const newRecord: IncidentRecord = {
      id: `rec_${Date.now()}`,
      studentId: student.id,
      incidentTypeId: selectedIncident,
      date: new Date().toISOString(),
      notes: notes,
      proofImage: imageProof || undefined,
      recordedBy: currentUser?.name || 'Unknown', 
      pointSnapshot: incidentDef.points,
      typeSnapshot: incidentDef.type
    };

    const allRecords = DataService.getRecords();
    DataService.saveRecords([...allRecords, newRecord]);

    setTimeout(() => {
      setSuccessMsg('Data berhasil disimpan!');
      setIsSubmitting(false);
      setNotes('');
      setImageProof(null);
      setSelectedIncident('');
      setSelectedCategory('');
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 600);
  };

  const handleSubmitCounseling = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newSession: CounselingSession = {
      id: `coun_${Date.now()}`,
      studentId: student.id,
      counselorId: currentUser?.id || '',
      counselorName: currentUser?.name || 'Unknown',
      date: new Date().toISOString(),
      notes: counselingNotes,
      recommendation: counselingRec,
      status: 'CLOSED' // In this simple flow, we close it immediately or we could add status to form
    };
    
    // Quick fix: If recommendation is "To Kesiswaan", maybe consider it "OPEN" for handling? 
    // Or just CLOSED and let Kesiswaan pick it up. Let's keep it CLOSED as a log, Kesiswaan sees "Referrals".
    // For "Siswa Dalam Pantauan" dashboard logic, we might need 'OPEN' status or specific recommendation.
    // Let's set it to OPEN if there is a serious recommendation, so it stays on dashboard.
    if (counselingRec !== 'NONE') {
        newSession.status = 'OPEN';
    }

    const allSessions = DataService.getCounselingSessions();
    DataService.saveCounselingSessions([...allSessions, newSession]);

    setTimeout(() => {
      setSuccessMsg('Catatan konseling disimpan!');
      setIsSubmitting(false);
      setCounselingNotes('');
      setCounselingRec('NONE');
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 600);
  };

  const handleAssignSanction = (e: React.FormEvent) => {
    e.preventDefault();
    if(!isKesiswaan) return;
    setIsSubmitting(true);

    const newSanction: StudentSanction = {
      id: `san_${Date.now()}`,
      studentId: student.id,
      level: sanctionLevel,
      assignedBy: currentUser?.name || 'Kesiswaan',
      assignedDate: new Date().toISOString(),
      notes: sanctionNotes,
      redemptionStatus: sanctionRedemptionTask ? RedemptionStatus.ASSIGNED : RedemptionStatus.NONE,
      redemptionTask: sanctionRedemptionTask,
      isRedeemed: false // Deprecated but kept for type compat
    };

    const allSanctions = DataService.getSanctions();
    // Logic: Is there already an active sanction of the SAME level?
    const existing = allSanctions.find(s => s.studentId === student.id && s.redemptionStatus !== RedemptionStatus.COMPLETED && s.level === sanctionLevel);
    
    if (existing) {
       alert("Siswa ini sudah memiliki sanksi level tersebut yang belum diselesaikan.");
       setIsSubmitting(false);
       return;
    }

    DataService.saveSanctions([...allSanctions, newSanction]);

    setTimeout(() => {
      setSuccessMsg('Sanksi ditetapkan!');
      setIsSubmitting(false);
      setSanctionNotes('');
      setSanctionRedemptionTask('');
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 600);
  };

  const updateRedemptionStatus = (sanctionId: string, newStatus: RedemptionStatus) => {
    if(!isKesiswaan) return;
    
    const allSanctions = DataService.getSanctions();
    const updatedSanctions = allSanctions.map(s => {
      if (s.id === sanctionId) {
        return { 
           ...s, 
           redemptionStatus: newStatus,
           redemptionDate: newStatus === RedemptionStatus.COMPLETED ? new Date().toISOString() : undefined,
           isRedeemed: newStatus === RedemptionStatus.COMPLETED // Keep backward compat
        };
      }
      return s;
    });
    DataService.saveSanctions(updatedSanctions);

    // If completed, log a redemption incident
    if (newStatus === RedemptionStatus.COMPLETED) {
        const redemptionType = incidents.find(i => i.type === IncidentTypeCategory.REDEMPTION) 
            || { id: 'generic_redemption', name: 'Penebusan Sanksi', points: 0, type: IncidentTypeCategory.REDEMPTION };
        
        const newRecord: IncidentRecord = {
          id: `rec_red_${Date.now()}`,
          studentId: student.id,
          incidentTypeId: redemptionType.id as string,
          date: new Date().toISOString(),
          notes: 'Penebusan sanksi disetujui oleh Kesiswaan.',
          recordedBy: currentUser?.name || 'Kesiswaan',
          pointSnapshot: 0,
          typeSnapshot: IncidentTypeCategory.REDEMPTION
        };
        const allRecords = DataService.getRecords();
        DataService.saveRecords([...allRecords, newRecord]);
    }

    setSuccessMsg('Status penebusan diperbarui!');
    setRefreshKey(prev => prev + 1);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const translateRecommendation = (rec: string) => {
    switch(rec) {
      case 'PARENT_CALL': return 'Panggilan Orang Tua';
      case 'TO_KESISWAAN': return 'Rujuk ke Kesiswaan';
      case 'SUSPENSION_REVIEW': return 'Tinjauan Skorsing';
      default: return '-';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Back Button Logic */}
        {isAdmin && !isEducator ? (
            <Link to="/admin/students" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 self-start">
                 <ArrowLeft className="h-6 w-6" />
            </Link>
        ) : (
            <Link to={isBK ? "/teacher/dashboard" : `/teacher/classes/${student.classId}`} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 self-start">
                 <ArrowLeft className="h-6 w-6" />
            </Link>
        )}
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{student.name}</h1>
          <p className="text-slate-500">NIS: {student.nis} • {className}</p>
        </div>
        
        {/* Status Badge: Now shows Active Sanction OR Recommended Status */}
        <div className={`md:ml-auto px-4 py-2 rounded-lg border font-bold text-sm flex items-center gap-2 ${activeSanction ? 'bg-red-600 text-white border-red-700' : recommendedStatus.color}`}>
           <AlertTriangle className="h-4 w-4" />
           {activeSanction ? `Sanksi Aktif: ${activeSanction.level}` : `Status Poin: ${recommendedStatus.statusLabel}`}
        </div>
      </div>

      {/* Stats Cards - Updated to 4 Columns Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* CARD 1: AKUMULASI POIN PELANGGARAN */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-red-300 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldAlert className="h-16 w-16 text-red-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">Poin Pelanggaran</p>
          <div className="mt-2 flex items-baseline gap-2">
             <span className={`text-4xl font-bold ${stats.effectiveViolationScore > 0 ? 'text-red-600' : 'text-slate-800'}`}>
               {stats.effectiveViolationScore}
             </span>
             <span className="text-sm text-slate-400">Poin</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Akumulatif (Tidak berkurang)</p>
        </div>

        {/* CARD 2: TOTAL POIN PENGHARGAAN (NEW) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Award className="h-16 w-16 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">Poin Penghargaan</p>
          <div className="mt-2 flex items-baseline gap-2">
             <span className="text-4xl font-bold text-emerald-600">
               {stats.achievementPoints}
             </span>
             <span className="text-sm text-slate-400">Poin</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Total apresiasi positif</p>
        </div>

        {/* CARD 3: STATUS SANKSI */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-orange-300 transition-colors">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Gavel className="h-16 w-16 text-orange-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">Status Sanksi</p>
          <div className="mt-2">
             {activeSanction ? (
               <div>
                  <span className="text-2xl font-bold text-red-600 block truncate" title={activeSanction.level}>{activeSanction.level}</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold mt-1 uppercase">
                     {activeSanction.redemptionStatus === RedemptionStatus.COMPLETED ? (
                         <span className="text-emerald-500">SELESAI</span>
                     ) : activeSanction.redemptionStatus === RedemptionStatus.IN_PROGRESS ? (
                         <span className="text-blue-500">PROSES PENEBUSAN</span>
                     ) : (
                         <span className="text-red-500">BELUM DITEBUS</span>
                     )}
                  </div>
               </div>
             ) : (
               <div>
                  <span className="text-2xl font-bold text-emerald-600">Aman</span>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase">Tidak ada sanksi aktif</p>
               </div>
             )}
          </div>
          <div className="mt-2 text-xs text-slate-400 truncate" title={`Rekomendasi: ${recommendedStatus.statusLabel}`}>
            Rek: {recommendedStatus.statusLabel}
          </div>
        </div>

        {/* CARD 4: STATISTIK FREKUENSI */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center relative overflow-hidden group hover:border-blue-300 transition-colors">
           <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <BarChart3 className="h-16 w-16 text-slate-600" />
          </div>
           <div className="space-y-3 relative z-10">
             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Pelanggaran</span>
                <span className="font-bold text-red-600">{stats.violationCount}x</span>
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Penghargaan</span>
                <span className="font-bold text-emerald-600">{stats.achievementCount}x</span>
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Penebusan</span>
                <span className="font-bold text-blue-600">{stats.redemptionCount}x</span>
             </div>
           </div>
        </div>
      </div>

      {/* Tabs for Navigation */}
      <div className="border-b border-slate-200">
         <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
            <button
               onClick={() => setActiveTab('INCIDENTS')}
               className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${
                  activeTab === 'INCIDENTS' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
               }`}
            >
               <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Catatan Kejadian
               </span>
            </button>
            {isBK && (
              <button
                 onClick={() => setActiveTab('COUNSELING')}
                 className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${
                    activeTab === 'COUNSELING' 
                    ? 'border-indigo-500 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                 }`}
              >
                 <span className="flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4" /> Bimbingan Konseling
                 </span>
              </button>
            )}
            {isKesiswaan && (
              <button
                 onClick={() => setActiveTab('SANCTIONS')}
                 className={`shrink-0 border-b-2 py-4 px-1 text-sm font-medium ${
                    activeTab === 'SANCTIONS' 
                    ? 'border-red-500 text-red-600' 
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                 }`}
              >
                 <span className="flex items-center gap-2">
                    <Gavel className="h-4 w-4" /> Panel Sanksi & Penebusan
                 </span>
              </button>
            )}
         </nav>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* === TAB 1: INCIDENTS === */}
        {activeTab === 'INCIDENTS' && (
           <>
              {/* INPUT FORM (Left Column) */}
              <div className="lg:col-span-2 space-y-6">
                {canRecord ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                      <h2 className="font-bold text-slate-800 flex items-center gap-2">
                          <ShieldAlert className="h-5 w-5 text-indigo-600" />
                          Input Kejadian Baru
                      </h2>
                      <div className="flex gap-1">
                        {roles.map(r => (
                          <span key={r} className="text-xs font-semibold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                              {r}
                          </span>
                        ))}
                      </div>
                      </div>
                      
                      <form onSubmit={handleSubmitIncident} className="p-6 space-y-6">
                      {/* Type Selection Tabs */}
                      <div className="flex p-1 bg-slate-100 rounded-xl">
                          <button
                          type="button"
                          onClick={() => handleTypeChange(IncidentTypeCategory.VIOLATION)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                              formType === IncidentTypeCategory.VIOLATION 
                              ? 'bg-white text-red-600 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                          >
                          <ShieldAlert className="h-4 w-4" />
                          Pelanggaran
                          </button>
                          <button
                          type="button"
                          onClick={() => handleTypeChange(IncidentTypeCategory.ACHIEVEMENT)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                              formType === IncidentTypeCategory.ACHIEVEMENT
                              ? 'bg-white text-emerald-600 shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                          >
                          <Award className="h-4 w-4" />
                          Penghargaan
                          </button>
                          {/* NOTE: Penebusan is NOT here anymore. Moved to Sanction Panel for Kesiswaan */}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                              Kategori <span className="text-red-500">*</span>
                          </label>
                          <select
                              required
                              value={selectedCategory}
                              onChange={(e) => {
                              setSelectedCategory(e.target.value);
                              setSelectedIncident('');
                              }}
                              className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                          >
                              <option value="">-- Pilih Kategori --</option>
                              {filteredCategories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                          </select>
                          {filteredCategories.length === 0 && (
                              <p className="text-xs text-red-500 mt-1">Tidak ada kategori untuk jenis ini.</p>
                          )}
                          </div>

                          <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                              Jenis Kejadian <span className="text-red-500">*</span>
                          </label>
                          <select
                              required
                              disabled={!selectedCategory}
                              value={selectedIncident}
                              onChange={(e) => setSelectedIncident(e.target.value)}
                              className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                          >
                              <option value="">-- Pilih Kejadian --</option>
                              {filteredIncidents.map(inc => (
                              <option key={inc.id} value={inc.id}>
                                  {inc.name} ({inc.points} Poin)
                              </option>
                              ))}
                          </select>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Bukti Foto (Opsional)</label>
                          {!imageProof ? (
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                              <p className="text-sm text-slate-500"><span className="font-semibold">Klik untuk upload</span> atau drag & drop</p>
                              </div>
                              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                          </label>
                          ) : (
                          <div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden border border-slate-300">
                              <img src={imageProof} alt="Preview" className="w-full h-full object-contain" />
                              <button 
                              type="button"
                              onClick={() => setImageProof(null)}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
                              >
                              <X className="w-4 h-4" />
                              </button>
                          </div>
                          )}
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Catatan Tambahan (Opsional)</label>
                          <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Keterangan kejadian..."
                          />
                      </div>

                      {successMsg && (
                          <div className="p-4 bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5" />
                          {successMsg}
                          </div>
                      )}

                      <button
                          type="submit"
                          disabled={isSubmitting || !selectedIncident || !selectedCategory}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-md transition-all"
                      >
                          <Save className="h-5 w-5" />
                          {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                      </button>
                      </form>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-500">
                      <Lock className="h-12 w-12 mb-4 text-slate-300" />
                      <h3 className="text-lg font-semibold text-slate-700">Mode Lihat Saja</h3>
                      <p>Akun ini (Admin murni) tidak memiliki akses untuk mencatat kejadian. Silakan tambahkan role Guru/Wali Kelas/BK ke akun ini jika ingin mencatat.</p>
                  </div>
                )}
              </div>

              {/* HISTORY LIST (Right Column) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-2">
                  <History className="h-5 w-5" />
                  Riwayat Kejadian
                </div>

                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {history.length === 0 ? (
                    <div className="text-slate-500 text-sm italic">Belum ada riwayat tercatat.</div>
                  ) : (
                    history.map(record => {
                      const incName = incidents.find(i => i.id === record.incidentTypeId)?.name || 'Unknown';
                      const type = record.typeSnapshot;
                      
                      let borderColor = 'bg-slate-400';
                      let badgeColor = 'bg-slate-100 text-slate-700';
                      let sign = '';

                      if (type === IncidentTypeCategory.VIOLATION) {
                        borderColor = 'bg-red-500';
                        badgeColor = 'bg-red-100 text-red-700';
                        sign = '+';
                      } else if (type === IncidentTypeCategory.ACHIEVEMENT) {
                        borderColor = 'bg-emerald-500';
                        badgeColor = 'bg-emerald-100 text-emerald-700';
                        sign = '';
                      } else if (type === IncidentTypeCategory.REDEMPTION) {
                        borderColor = 'bg-blue-500';
                        badgeColor = 'bg-blue-100 text-blue-700';
                        sign = '✓ '; // Redemption doesnt change score, just marks completion
                      }

                      return (
                        <div key={record.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${borderColor}`} />
                          <div className="flex justify-between items-start">
                            <div className="text-xs font-semibold text-slate-400 mb-1">
                              {new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${badgeColor}`}>
                              {type === IncidentTypeCategory.REDEMPTION ? 'Penebusan' : `${sign}${record.pointSnapshot} Poin`}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">{incName}</h4>
                          {record.proofImage && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-slate-100">
                              <img src={record.proofImage} alt="Bukti" className="w-full h-32 object-cover" />
                            </div>
                          )}
                          {record.notes && (
                            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">"{record.notes}"</p>
                          )}
                          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
                            <span>Pencatat: {record.recordedBy}</span>
                            <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">{type}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
           </>
        )}

        {/* === TAB 2: COUNSELING (BK Only) === */}
        {activeTab === 'COUNSELING' && isBK && (
           <>
             {/* INPUT FORM COUNSELING */}
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="p-6 border-b border-slate-100 bg-blue-50 flex justify-between items-center">
                     <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <HeartHandshake className="h-5 w-5 text-blue-600" />
                        Catat Sesi Konseling
                     </h2>
                   </div>
                   
                   <form onSubmit={handleSubmitCounseling} className="p-6 space-y-6">
                      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100 mb-4">
                         Gunakan form ini untuk mencatat hasil wawancara, pembinaan mental, atau pemanggilan siswa. 
                         Data ini bersifat rahasia.
                      </div>
                      
                      <div>
                         <label className="block text-sm font-medium text-slate-700 mb-2">Catatan Konseling / Hasil Pembinaan</label>
                         <textarea
                           required
                           value={counselingNotes}
                           onChange={(e) => setCounselingNotes(e.target.value)}
                           rows={6}
                           className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                           placeholder="Jelaskan permasalahan, solusi yang disepakati, dan respon siswa..."
                         />
                      </div>

                      <div>
                         <label className="block text-sm font-medium text-slate-700 mb-2">Rekomendasi Tindak Lanjut</label>
                         <select
                            value={counselingRec}
                            onChange={(e) => setCounselingRec(e.target.value as any)}
                            className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                         >
                            <option value="NONE">Cukup Pembinaan (Selesai)</option>
                            <option value="PARENT_CALL">Perlu Panggilan Orang Tua</option>
                            <option value="TO_KESISWAAN">Rujuk ke Kesiswaan (Sanksi Berat)</option>
                            <option value="SUSPENSION_REVIEW">Tinjauan Skorsing</option>
                         </select>
                         {counselingRec !== 'NONE' && (
                           <p className="text-xs text-blue-600 mt-2">
                             *Status konseling ini akan otomatis diset OPEN agar dipantau Kesiswaan.
                           </p>
                         )}
                      </div>

                      {successMsg && (
                          <div className="p-4 bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5" />
                          {successMsg}
                          </div>
                      )}

                      <button
                          type="submit"
                          disabled={isSubmitting || !counselingNotes}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-md transition-all"
                      >
                          <Save className="h-5 w-5" />
                          {isSubmitting ? 'Menyimpan...' : 'Simpan Laporan Konseling'}
                      </button>
                   </form>
                </div>
             </div>

             {/* COUNSELING HISTORY */}
             <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-2">
                   <BookOpen className="h-5 w-5" />
                   Riwayat Konseling
                </div>

                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {counselingSessions.length === 0 ? (
                    <div className="text-slate-500 text-sm italic">Belum ada data konseling.</div>
                  ) : (
                    counselingSessions.map(session => (
                      <div key={session.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                         <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
                         <div className="flex justify-between items-start mb-2">
                           <div className="text-xs font-semibold text-slate-500">
                              {new Date(session.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                           </div>
                           {session.recommendation !== 'NONE' && (
                             <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded border border-red-100">
                               ! {translateRecommendation(session.recommendation)}
                             </span>
                           )}
                         </div>
                         
                         <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {session.notes}
                         </p>

                         <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
                            <span className="font-semibold text-slate-500">Konselor:</span> {session.counselorName}
                         </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
           </>
        )}

        {/* === TAB 3: SANCTIONS (Kesiswaan Only) === */}
        {activeTab === 'SANCTIONS' && isKesiswaan && (
          <>
            <div className="lg:col-span-2 space-y-6">
              
              {/* Alert Rujukan BK (New Feature) */}
              {latestReferralSession && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 shadow-sm animate-pulse-slow">
                   <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shrink-0">
                      <Megaphone className="h-5 w-5" />
                   </div>
                   <div>
                      <h3 className="font-bold text-orange-800 text-sm">Rujukan Tindak Lanjut dari BK</h3>
                      <p className="text-xs text-orange-700 mt-1">
                         Konselor <b>{latestReferralSession.counselorName}</b> merekomendasikan: 
                         <span className="font-bold underline ml-1">{translateRecommendation(latestReferralSession.recommendation)}</span>
                      </p>
                      <p className="text-xs text-orange-600 italic mt-1 border-l-2 border-orange-300 pl-2">
                         "{latestReferralSession.notes}"
                      </p>
                   </div>
                </div>
              )}

              {/* PENETAPAN SANKSI FORM */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-6 border-b border-slate-100 bg-red-50 flex justify-between items-center">
                   <h2 className="font-bold text-slate-800 flex items-center gap-2">
                      <Gavel className="h-5 w-5 text-red-600" />
                      Penetapan Sanksi & Kewajiban
                   </h2>
                 </div>
                 
                 <form onSubmit={handleAssignSanction} className="p-6 space-y-6">
                    <div className="bg-red-50 p-4 rounded-lg text-sm text-red-800 border border-red-100 mb-4">
                       <p className="font-bold mb-1">Perhatian:</p>
                       Sanksi ditetapkan secara manual berdasarkan akumulasi poin dan riwayat pembinaan. Penetapan SP1/SP2/SP3 tidak terjadi otomatis.
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm font-medium text-slate-700 mb-2">Pilih Tingkat Sanksi</label>
                         <select
                            value={sanctionLevel}
                            onChange={(e) => setSanctionLevel(e.target.value as SanctionLevel)}
                            className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                         >
                            <option value={SanctionLevel.SP1}>SP 1 (Surat Peringatan 1)</option>
                            <option value={SanctionLevel.SP2}>SP 2 (Surat Peringatan 2)</option>
                            <option value={SanctionLevel.SP3}>SP 3 (Surat Peringatan 3)</option>
                            <option value={SanctionLevel.SKORSING}>Skorsing Sementara</option>
                            <option value={SanctionLevel.DROP_OUT}>Dikembalikan ke Orang Tua (DO)</option>
                         </select>
                       </div>
                    </div>

                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-2">Catatan Penetapan / Dasar Sanksi</label>
                       <textarea
                         required
                         value={sanctionNotes}
                         onChange={(e) => setSanctionNotes(e.target.value)}
                         rows={2}
                         className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                         placeholder="Alasan penetapan sanksi (misal: Poin > 50 dan sudah dibina BK)..."
                       />
                    </div>

                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-2">
                         Kewajiban / Tugas Penebusan (Opsional)
                       </label>
                       <div className="relative">
                          <textarea
                            value={sanctionRedemptionTask}
                            onChange={(e) => setSanctionRedemptionTask(e.target.value)}
                            rows={2}
                            className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-blue-50/30"
                            placeholder="Contoh: Membersihkan perpustakaan, Piket kebersihan 3 hari..."
                          />
                          <p className="text-xs text-slate-500 mt-1">
                             *Jika diisi, status penebusan akan otomatis diset ke "ASSIGNED" (Tugas Diberikan).
                          </p>
                       </div>
                    </div>

                    {successMsg && (
                        <div className="p-4 bg-emerald-100 text-emerald-700 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        {successMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-md transition-all"
                    >
                        <Gavel className="h-5 w-5" />
                        {isSubmitting ? 'Memproses...' : 'Tetapkan Sanksi'}
                    </button>
                 </form>
              </div>

              {/* LIST SANCTIONS */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800">Daftar Sanksi & Penebusan</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {sanctions.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 italic">Belum ada sanksi yang ditetapkan.</div>
                  ) : (
                    sanctions.map(sanction => (
                      <div key={sanction.id} className="p-6 flex flex-col md:flex-row justify-between items-start gap-4 hover:bg-slate-50 transition-colors">
                         <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                               <span className="font-bold text-lg text-slate-800 bg-slate-100 px-3 py-1 rounded-md">{sanction.level}</span>
                               <span className="text-xs text-slate-400">
                                  {new Date(sanction.assignedDate).toLocaleDateString()}
                               </span>
                            </div>
                            
                            <p className="text-sm text-slate-600 mb-3 bg-red-50 p-2 rounded border border-red-100 border-l-4 border-l-red-400">
                               {sanction.notes}
                            </p>

                            {/* Redemption Section inside Card */}
                            <div className="mt-3 border-t border-slate-100 pt-3">
                               <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                                  <ClipboardList className="h-3 w-3" /> STATUS PENEBUSAN:
                               </p>
                               
                               <div className="flex items-center gap-2 mb-2">
                                  {sanction.redemptionStatus === RedemptionStatus.COMPLETED ? (
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> SELESAI
                                    </span>
                                  ) : sanction.redemptionStatus === RedemptionStatus.IN_PROGRESS ? (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> DALAM PROSES
                                    </span>
                                  ) : sanction.redemptionStatus === RedemptionStatus.ASSIGNED ? (
                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> TUGAS DIBERIKAN
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-bold">
                                      BELUM ADA TUGAS
                                    </span>
                                  )}
                               </div>

                               {sanction.redemptionTask && (
                                 <p className="text-sm text-slate-700 italic">
                                    " {sanction.redemptionTask} "
                                 </p>
                               )}

                               {sanction.redemptionStatus === RedemptionStatus.COMPLETED && (
                                   <p className="text-[10px] text-emerald-600 mt-1">
                                      Diselesaikan pada: {new Date(sanction.redemptionDate!).toLocaleDateString()}
                                   </p>
                               )}
                            </div>
                         </div>

                         {/* Action Buttons */}
                         {sanction.redemptionStatus !== RedemptionStatus.COMPLETED && (
                           <div className="flex flex-col gap-2 min-w-[140px]">
                              {sanction.redemptionStatus === RedemptionStatus.NONE && (
                                 <div className="text-xs text-slate-400 text-center mb-1">Set Status:</div>
                              )}
                              
                              {sanction.redemptionStatus !== RedemptionStatus.IN_PROGRESS && (
                                <button 
                                  onClick={() => updateRedemptionStatus(sanction.id, RedemptionStatus.IN_PROGRESS)}
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-sm"
                                >
                                   <PlayCircle className="h-3 w-3" /> Mulai Proses
                                </button>
                              )}
                              
                              <button 
                                onClick={() => updateRedemptionStatus(sanction.id, RedemptionStatus.COMPLETED)}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-sm"
                              >
                                 <CheckSquare className="h-3 w-3" /> Tandai Selesai
                              </button>
                           </div>
                         )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Helper Info */}
            <div className="space-y-4">
               <div className="bg-white border border-slate-200 p-4 rounded-xl text-sm shadow-sm">
                  <h4 className="font-bold mb-2 flex items-center gap-2 text-slate-800">
                    <ClipboardList className="h-4 w-4" /> Alur Penebusan
                  </h4>
                  <ul className="list-disc list-inside space-y-2 text-slate-600">
                    <li><b>Tetapkan Sanksi:</b> Pilih level SP dan berikan tugas penebusan di kolom yang tersedia.</li>
                    <li><b>Proses:</b> Klik tombol "Mulai Proses" jika siswa sudah mulai mengerjakan tugas.</li>
                    <li><b>Selesai:</b> Klik "Tandai Selesai" jika tugas telah dikerjakan dengan baik.</li>
                    <li>Sistem akan otomatis mencatat penyelesaian penebusan di riwayat kejadian siswa sebagai record penebusan (0 poin).</li>
                  </ul>
               </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default StudentProfile;