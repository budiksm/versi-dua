
import React, { useEffect, useState } from 'react';
import { DataService } from '../../../services/dataService';
import { Student, Role, BkCounselingStatus } from '../../../types';
import { HeartHandshake, Search, AlertCircle, CheckCircle2, MessageSquare, ArrowUpRight, User, AlertTriangle, Archive, ExternalLink, BookOpen, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ActiveCoaching: React.FC = () => {
  const [priorityCases, setPriorityCases] = useState<any[]>([]); // Baru, Dikembalikan, Required
  const [monitoringCases, setMonitoringCases] = useState<any[]>([]); // Pantauan Rutin, Referred
  const [closedCases, setClosedCases] = useState<any[]>([]); // Selesai
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PRIORITY' | 'MONITORING' | 'HISTORY'>('PRIORITY');
  
  const navigate = useNavigate();

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user?.roles.includes(Role.BK)) {
      navigate('/teacher/dashboard');
      return;
    }
    loadData();
  }, []);

  const loadData = () => {
    const students = DataService.getStudents();
    const records = DataService.getRecords();
    const incidentsData = DataService.getIncidentTypes();
    const counselings = DataService.getCounselingSessions();
    const rules = DataService.getRules();
    const classes = DataService.getClasses();

    const priorityList: any[] = [];
    const monitoringList: any[] = [];
    const historyList: any[] = [];

    const bkRule = rules.find(r => r.statusLabel.toUpperCase().includes('BK'));
    const bkThreshold = bkRule ? bkRule.minPoints : 40;

    students.forEach(s => {
      const stats = DataService.calculateStudentPoints(s.id, records, incidentsData);
      const studentCounselings = counselings.filter(c => c.studentId === s.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestSession = studentCounselings[0];
      const studentRecords = records.filter(r => r.studentId === s.id);

      // --- STATUS IDENTIFICATION ---
      // Get all active statuses for this student
      const activeStatuses = [...new Set(studentRecords.map(r => r.bkStatus))];
      
      const isReturned = activeStatuses.includes('RETURNED_TO_BK');
      const isReferred = activeStatuses.includes('REFERRED_TO_KESISWAAN') || activeStatuses.includes('REFERRED');
      const isMonitoring = activeStatuses.includes('MONITORING');
      const isRequired = activeStatuses.includes('REQUIRED');
      const isCompleted = studentRecords.length > 0 && studentRecords.every(r => r.bkStatus === 'COMPLETED' || r.bkStatus === 'NONE' || !r.bkStatus);

      // Next Eval Date (From Monitoring Records)
      const monitoringRecord = studentRecords.find(r => r.bkStatus === 'MONITORING' && r.nextEvaluationDate);
      const nextEvalDate = monitoringRecord ? monitoringRecord.nextEvaluationDate : null;
      
      let isOverdue = false;
      if (nextEvalDate) {
          isOverdue = new Date() > new Date(nextEvalDate);
      }

      // Check Referral from Homeroom (New Logic)
      const latestHomeroomSession = studentCounselings.find(c => c.sessionType === 'HOMEROOM');
      const hasReferralFromHomeroom = latestHomeroomSession?.recommendation === 'TO_BK' && 
                                      (!latestSession || latestSession.sessionType !== 'BK' || new Date(latestHomeroomSession.date) > new Date(latestSession.date));

      const caseData = {
        student: s,
        className: classes.find(c => c.id === s.classId)?.name || '-',
        score: stats.effectiveViolationScore,
        statusLabel: DataService.getCoachingStatus(stats.effectiveViolationScore, rules).statusLabel,
        statusColor: DataService.getCoachingStatus(stats.effectiveViolationScore, rules).color,
        latestSession,
        nextEvalDate,
        isOverdue,
        referralInfo: hasReferralFromHomeroom ? {
            from: latestHomeroomSession?.counselorName,
            date: latestHomeroomSession?.date,
            note: latestHomeroomSession?.notes
        } : null,
        historyCount: studentCounselings.length,
        triggers: [] as string[]
      };

      // --- GROUPING LOGIC ---
      
      // 1. PRIORITY (Required, Returned, High Score New)
      if (isRequired || isReturned || hasReferralFromHomeroom) {
          if (isReturned) caseData.triggers.push('Dikembalikan Kesiswaan');
          if (hasReferralFromHomeroom) caseData.triggers.push('Rujukan Wali Kelas');
          if (isRequired) caseData.triggers.push('Pelanggaran Baru');
          
          priorityList.push(caseData);
      }
      
      // 2. MONITORING (Routine, Referred, Ongoing)
      else if (isMonitoring || isReferred) {
          if (isReferred) caseData.triggers.push('Di Kesiswaan');
          if (isMonitoring) caseData.triggers.push('Pantauan Rutin');
          if (isOverdue) caseData.triggers.push('EVALUASI ULANG');
          
          monitoringList.push(caseData);
      }

      // 3. HISTORY (Completed)
      else if (isCompleted && studentCounselings.length > 0) {
          historyList.push(caseData);
      }
      
      // Fallback: If score high but no record/status set yet (edge case)
      else if (stats.effectiveViolationScore >= bkThreshold && !latestSession) {
          caseData.triggers.push(`Poin Tinggi (${stats.effectiveViolationScore})`);
          priorityList.push(caseData);
      }
    });

    // Sorting
    priorityList.sort((a, b) => b.score - a.score);
    // Sort Monitoring: Overdue first
    monitoringList.sort((a, b) => (a.isOverdue === b.isOverdue) ? b.score - a.score : a.isOverdue ? -1 : 1);
    historyList.sort((a, b) => {
       const dateA = a.latestSession ? new Date(a.latestSession.date).getTime() : 0;
       const dateB = b.latestSession ? new Date(b.latestSession.date).getTime() : 0;
       return dateB - dateA;
    });

    setPriorityCases(priorityList);
    setMonitoringCases(monitoringList);
    setClosedCases(historyList);
  };

  const displayedCases = (activeTab === 'PRIORITY' ? priorityCases : activeTab === 'MONITORING' ? monitoringCases : closedCases)
    .filter(c => c.student.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.student.nis.includes(searchTerm));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-purple-600" />
            Manajemen Kasus BK
          </h1>
          <p className="text-slate-500">Pusat kontrol konseling dan penanganan masalah siswa.</p>
        </div>
      </div>

      {/* NEW SIMPLIFIED TABS - PURPLE THEME */}
      <div className="flex border-b border-purple-200 overflow-x-auto">
         <button 
            onClick={() => setActiveTab('PRIORITY')} 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'PRIORITY' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
            <AlertTriangle className="h-4 w-4" /> 
            Prioritas & Baru 
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === 'PRIORITY' ? 'bg-purple-200 text-purple-800' : 'bg-slate-200 text-slate-600'}`}>{priorityCases.length}</span>
         </button>
         <button 
            onClick={() => setActiveTab('MONITORING')} 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'MONITORING' ? 'border-fuchsia-500 text-fuchsia-600 bg-fuchsia-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
            <Search className="h-4 w-4" /> 
            Pantauan Rutin
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === 'MONITORING' ? 'bg-fuchsia-200 text-fuchsia-800' : 'bg-slate-200 text-slate-600'}`}>{monitoringCases.length}</span>
         </button>
         <button 
            onClick={() => setActiveTab('HISTORY')} 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeTab === 'HISTORY' ? 'border-slate-500 text-slate-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
         >
            <Archive className="h-4 w-4" /> 
            Riwayat Selesai
         </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-purple-100">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
              <input type="text" placeholder="Cari nama siswa atau NIS..." className="w-full pl-9 pr-4 py-2 bg-purple-50/30 border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none text-slate-800" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayedCases.length === 0 ? (
           <div className="bg-white p-12 text-center rounded-xl border border-dashed border-purple-200 text-slate-500">
               <CheckCircle2 className="h-12 w-12 text-purple-300 mx-auto mb-4" />
               <p className="font-bold text-slate-700">Tidak ada kasus dalam daftar ini.</p>
               <p className="text-sm">Situasi kondusif.</p>
           </div>
        ) : (
          displayedCases.map((item, idx) => (
            <div key={idx} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${activeTab === 'PRIORITY' ? 'border-l-4 border-l-red-500 border-slate-200' : activeTab === 'MONITORING' ? 'border-slate-200 border-l-4 border-l-fuchsia-500' : 'border-slate-200 hover:border-purple-300'}`}>
              <div className="p-5 flex flex-col md:flex-row gap-4 justify-between">
                
                {/* Bagian Kiri: Info Siswa & Status */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg text-slate-900">{item.student.name}</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200">{item.className}</span>
                    </div>

                    {/* Trigger Badges */}
                    {(activeTab === 'PRIORITY' || activeTab === 'MONITORING') && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {item.triggers.map((t: string, i: number) => (
                                <span key={i} className={`px-2 py-1 text-xs font-bold rounded border flex items-center gap-1 ${t === 'EVALUASI ULANG' ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                    <AlertCircle className="h-3 w-3" /> {t}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Info Rujukan Spesifik */}
                    {item.referralInfo && activeTab === 'PRIORITY' && (
                        <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg text-sm text-orange-900 mb-3">
                            <p className="font-bold text-xs flex items-center gap-1 mb-1">
                                <User className="h-3 w-3" /> Rujukan dari Wali Kelas ({item.referralInfo.from}):
                            </p>
                            <p className="italic text-xs">"{item.referralInfo.note}"</p>
                        </div>
                    )}

                    {/* Statistik Umum */}
                    <div className="flex flex-wrap gap-3 text-sm items-center">
                        <div className={`flex items-center gap-1.5 font-bold ${item.score >= 40 ? 'text-red-600' : 'text-slate-600'}`}>
                            <AlertCircle className="h-4 w-4" /> {item.score} Poin
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${item.statusColor}`}>
                            {item.statusLabel}
                        </div>
                        <div className="text-slate-400 text-xs">• {item.historyCount}x Riwayat Konseling</div>
                    </div>
                </div>

                {/* Bagian Kanan: Aksi Langsung */}
                <div className="flex flex-col gap-2 justify-center min-w-[180px] border-l border-slate-100 pl-4 md:pl-6">
                    {/* Monitoring Info */}
                    {activeTab === 'MONITORING' && item.nextEvalDate && (
                        <div className={`text-xs px-2 py-1 rounded text-center font-bold mb-1 border ${item.isOverdue ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                            <div className="flex items-center justify-center gap-1">
                                <Clock className="h-3 w-3" /> Target: {new Date(item.nextEvalDate).toLocaleDateString()}
                            </div>
                        </div>
                    )}
                    
                    <Link 
                        to={`/teacher/student/${item.student.id}`} 
                        className={`w-full py-2.5 px-4 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 ${activeTab === 'PRIORITY' ? 'bg-purple-600 hover:bg-purple-700' : activeTab === 'MONITORING' ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : 'bg-slate-500 hover:bg-slate-600'}`}
                    >
                        <HeartHandshake className="h-4 w-4" />
                        {activeTab === 'PRIORITY' ? 'Tangani Kasus' : activeTab === 'MONITORING' ? 'Lanjut Pantau' : 'Lihat Detail'}
                    </Link>
                    
                    <Link 
                        to={`/teacher/student/${item.student.id}`} 
                        className="w-full py-2 px-4 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        Profil Lengkap <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>

              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActiveCoaching;
