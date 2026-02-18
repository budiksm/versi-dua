
import React, { useEffect, useState } from 'react';
import { DataService } from '../../../services/dataService';
import { Student, Role } from '../../../types';
import { HeartHandshake, Search, AlertCircle, CheckCircle2, MessageSquare, ArrowUpRight, User, AlertTriangle, Archive, ExternalLink, BookOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ActiveCoaching: React.FC = () => {
  const [priorityCases, setPriorityCases] = useState<any[]>([]);
  const [monitoringCases, setMonitoringCases] = useState<any[]>([]);
  const [closedCases, setClosedCases] = useState<any[]>([]);
  
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

    // Cari threshold BK dari Rules (default 40)
    const bkRule = rules.find(r => r.statusLabel.toUpperCase().includes('BK'));
    const bkThreshold = bkRule ? bkRule.minPoints : 40;

    students.forEach(s => {
      const stats = DataService.calculateStudentPoints(s.id, records, incidentsData);
      const studentCounselings = counselings.filter(c => c.studentId === s.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const latestSession = studentCounselings[0];
      const hasOpenSession = latestSession?.status === 'OPEN';
      
      // Cek Rujukan dari Wali Kelas
      const latestHomeroomSession = studentCounselings.find(c => c.sessionType === 'HOMEROOM');
      // Logic referral: Ada rekomendasi TO_BK dan (belum ada sesi BK ATAU sesi BK terakhir lebih lama dari sesi walas)
      const hasReferralFromHomeroom = latestHomeroomSession?.recommendation === 'TO_BK' && 
                                      (!latestSession || latestSession.sessionType !== 'BK' || new Date(latestHomeroomSession.date) > new Date(latestSession.date));

      // Cek Status Mandatory (Required Record)
      const hasRequiredRecord = records.some(r => r.studentId === s.id && r.bkStatus === 'REQUIRED');
      
      // Cek Poin Tinggi
      const isHighPoints = stats.effectiveViolationScore >= bkThreshold;

      const caseData = {
        student: s,
        className: classes.find(c => c.id === s.classId)?.name || '-',
        score: stats.effectiveViolationScore,
        statusLabel: DataService.getCoachingStatus(stats.effectiveViolationScore, rules).statusLabel,
        statusColor: DataService.getCoachingStatus(stats.effectiveViolationScore, rules).color,
        latestSession,
        hasOpenSession,
        referralInfo: hasReferralFromHomeroom ? {
            from: latestHomeroomSession?.counselorName,
            date: latestHomeroomSession?.date,
            note: latestHomeroomSession?.notes
        } : null,
        historyCount: studentCounselings.length,
        triggers: [] as string[]
      };

      // --- LOGIKA PENGELOMPOKAN ---
      
      // 1. KASUS PRIORITAS (Wajib Ditangani)
      if (hasReferralFromHomeroom || hasRequiredRecord || (isHighPoints && !latestSession)) {
          if(hasReferralFromHomeroom) caseData.triggers.push('Rujukan Wali Kelas');
          if(hasRequiredRecord) caseData.triggers.push('Pelanggaran Berat (Auto)');
          if(isHighPoints) caseData.triggers.push(`Poin Tinggi (${stats.effectiveViolationScore})`);
          
          priorityList.push(caseData);
      } 
      // 2. PANTAUAN RUTIN (Sedang berjalan atau Poin Menengah)
      else if (hasOpenSession || (stats.effectiveViolationScore >= 20)) {
          monitoringList.push(caseData);
      }
      // 3. RIWAYAT (Punya history tapi case closed)
      else if (studentCounselings.length > 0) {
          historyList.push(caseData);
      }
    });

    // Sorting
    priorityList.sort((a, b) => b.score - a.score);
    monitoringList.sort((a, b) => b.score - a.score);
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
            Prioritas Penanganan 
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
            <div key={idx} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${activeTab === 'PRIORITY' ? 'border-l-4 border-l-red-500 border-slate-200' : 'border-slate-200 hover:border-purple-300'}`}>
              <div className="p-5 flex flex-col md:flex-row gap-4 justify-between">
                
                {/* Bagian Kiri: Info Siswa & Status */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg text-slate-900">{item.student.name}</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200">{item.className}</span>
                    </div>

                    {/* Trigger Badges (Prioritas) */}
                    {activeTab === 'PRIORITY' && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {item.triggers.map((t: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-200 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> {t}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Info Rujukan Spesifik */}
                    {item.referralInfo && (
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
                    {item.latestSession && item.hasOpenSession && (
                        <div className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded text-center font-bold mb-1 border border-purple-200">
                            Sesi Terakhir: {new Date(item.latestSession.date).toLocaleDateString()}
                        </div>
                    )}
                    
                    <Link 
                        to={`/teacher/student/${item.student.id}`} 
                        className={`w-full py-2.5 px-4 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 ${activeTab === 'PRIORITY' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-fuchsia-600 hover:bg-fuchsia-700'}`}
                    >
                        <HeartHandshake className="h-4 w-4" />
                        {activeTab === 'PRIORITY' ? 'Tangani Kasus' : 'Lihat & Konseling'}
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
