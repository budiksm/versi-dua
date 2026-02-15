
import React, { useEffect, useState } from 'react';
import { DataService } from '../../../services/dataService';
import { Student, CounselingSession, Role } from '../../../types';
import { HeartHandshake, Search, AlertCircle, CheckCircle2, MessageSquare, ArrowUpRight, Clock, User, X, Save, Archive } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const ActiveCoaching: React.FC = () => {
  const [activeCases, setActiveCases] = useState<any[]>([]);
  const [closedCases, setClosedCases] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState<'NONE' | 'PARENT_CALL' | 'TO_KESISWAAN' | 'SUSPENSION_REVIEW' | 'TO_BK'>('NONE');
  const [sessionStatus, setSessionStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const incidents = DataService.getIncidentTypes();
    const counselings = DataService.getCounselingSessions();
    const rules = DataService.getRules();
    const classes = DataService.getClasses();

    const activeList: any[] = [];
    const historyList: any[] = [];

    students.forEach(s => {
      const stats = DataService.calculateStudentPoints(s.id, records, incidents);
      const studentCounselings = counselings.filter(c => c.studentId === s.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const latestSession = studentCounselings[0];
      const hasOpenSession = latestSession?.status === 'OPEN';
      
      // LOGIKA HIRARKI BK:
      // 1. Poin >= 40 (High Risk)
      // 2. Ada Referral dari Wali Kelas ('TO_BK')
      
      const latestHomeroomSession = studentCounselings.find(c => c.sessionType === 'HOMEROOM');
      const hasReferralFromHomeroom = latestHomeroomSession?.recommendation === 'TO_BK';
      
      const isHighRisk = stats.effectiveViolationScore >= 40;

      // Base Data Object
      const caseData = {
        student: s,
        className: classes.find(c => c.id === s.classId)?.name || '-',
        score: stats.effectiveViolationScore,
        statusLabel: DataService.getCoachingStatus(stats.effectiveViolationScore, rules).statusLabel,
        statusColor: DataService.getCoachingStatus(stats.effectiveViolationScore, rules).color,
        latestSession,
        hasOpenSession,
        isReferral: hasReferralFromHomeroom,
        historyCount: studentCounselings.length
      };

      // --- LOGIKA FILTER DIPERBAIKI ---
      
      // Kriteria Masuk Tab "Dalam Pantauan" (Active):
      // 1. Memiliki sesi yang statusnya masih OPEN.
      // 2. ATAU (Belum pernah ada sesi BK sama sekali) DAN (Poin >= 40 atau Ada Rujukan).
      //    Artinya: Jika sudah pernah ada sesi dan statusnya CLOSED, dia TIDAK masuk sini lagi 
      //    (karena diasumsikan sudah ditangani di sesi terakhir tersebut).
      
      const isNewCase = !latestSession && (isHighRisk || hasReferralFromHomeroom);
      const needsAttention = hasOpenSession || isNewCase;

      if (needsAttention) {
         activeList.push(caseData);
      } else if (studentCounselings.length > 0) {
         // Jika punya riwayat dan sesi terakhir CLOSED, masuk ke History.
         // Meskipun Poin masih tinggi, ini masuk history karena status terakhir adalah "Selesai/Closed".
         // Jika ingin memantau poin tinggi yang sudah closed, BK bisa menggunakan menu "Monitoring Siswa".
         historyList.push(caseData);
      }
    });

    // Sort Active: Open sessions first, then by score
    activeList.sort((a, b) => {
      if (a.hasOpenSession && !b.hasOpenSession) return -1;
      if (!a.hasOpenSession && b.hasOpenSession) return 1;
      return b.score - a.score;
    });

    // Sort History: Latest session date
    historyList.sort((a, b) => {
       const dateA = a.latestSession ? new Date(a.latestSession.date).getTime() : 0;
       const dateB = b.latestSession ? new Date(b.latestSession.date).getTime() : 0;
       return dateB - dateA;
    });

    setActiveCases(activeList);
    setClosedCases(historyList);
  };

  const handleOpenModal = (student: Student) => {
    setSelectedStudent(student);
    setNotes('');
    setRecommendation('NONE');
    setSessionStatus('OPEN');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsSubmitting(true);

    const currentUser = DataService.getCurrentUser();
    const allSessions = DataService.getCounselingSessions();

    const newSession: CounselingSession = {
      id: `coun_${Date.now()}`,
      studentId: selectedStudent.id,
      counselorId: currentUser?.id || 'bk',
      counselorName: currentUser?.name || 'Guru BK',
      date: new Date().toISOString(),
      notes: notes,
      recommendation: recommendation,
      status: sessionStatus,
      sessionType: 'BK'
    };

    DataService.saveCounselingSessions([...allSessions, newSession]);

    setTimeout(() => {
      setIsSubmitting(false);
      setShowModal(false);
      loadData(); // Refresh list
    }, 600);
  };

  const getFilteredList = () => {
     const list = activeTab === 'ACTIVE' ? activeCases : closedCases;
     return list.filter(c => 
        c.student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.student.nis.includes(searchTerm)
     );
  };

  const displayedCases = getFilteredList();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pembinaan & Konseling</h1>
          <p className="text-slate-500">Kelola sesi konseling siswa aktif dan pantau riwayat pembinaan.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
         <button 
           onClick={() => setActiveTab('ACTIVE')}
           className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'ACTIVE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <AlertCircle className="h-4 w-4" /> Dalam Pantauan ({activeCases.length})
         </button>
         <button 
           onClick={() => setActiveTab('HISTORY')}
           className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'border-slate-500 text-slate-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
         >
           <Archive className="h-4 w-4" /> Riwayat Selesai ({closedCases.length})
         </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari siswa..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayedCases.length === 0 ? (
           <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
             <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
             <p className="font-bold text-slate-700">Daftar Kosong.</p>
             <p className="text-sm">
                {activeTab === 'ACTIVE' 
                    ? "Tidak ada siswa yang sedang dalam sesi aktif atau kasus baru." 
                    : "Belum ada riwayat konseling yang selesai."}
             </p>
           </div>
        ) : (
          displayedCases.map((item, idx) => (
            <div key={idx} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all ${item.hasOpenSession ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'}`}>
              <div className="p-5 flex flex-col md:flex-row gap-4 justify-between">
                
                {/* Info Siswa */}
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-2">
                     <span className="font-bold text-lg text-slate-900">{item.student.name}</span>
                     <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200">
                       {item.className}
                     </span>
                     {item.hasOpenSession && (
                       <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center gap-1 animate-pulse">
                         <Clock className="h-3 w-3" /> SESI AKTIF
                       </span>
                     )}
                     {item.isReferral && (
                       <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold flex items-center gap-1">
                         <AlertCircle className="h-3 w-3" /> RUJUKAN WALI KELAS
                       </span>
                     )}
                   </div>
                   
                   <div className="flex flex-wrap gap-4 text-sm mb-3">
                      <div className={`flex items-center gap-1.5 font-bold px-2 py-1 rounded ${item.score >= 40 ? 'text-red-600 bg-red-50' : 'text-slate-600 bg-slate-50'}`}>
                         <AlertCircle className="h-4 w-4" /> {item.score} Poin
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded font-medium ${item.statusColor}`}>
                         {item.statusLabel}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 px-2 py-1 bg-slate-50 rounded">
                         <MessageSquare className="h-4 w-4" /> {item.historyCount}x Riwayat
                      </div>
                   </div>

                   {/* Last Session Info */}
                   {item.latestSession ? (
                      <div className={`p-3 rounded-lg border text-sm ${item.latestSession.status === 'CLOSED' ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-100'}`}>
                        <p className="text-slate-500 text-xs mb-1 flex items-center gap-1">
                           <User className="h-3 w-3" /> 
                           Terakhir oleh <b>{item.latestSession.counselorName}</b> pada {new Date(item.latestSession.date).toLocaleDateString()}
                        </p>
                        <p className="text-slate-700 italic">"{item.latestSession.notes}"</p>
                        {item.latestSession.recommendation !== 'NONE' && (
                           <div className="mt-1 text-xs font-bold text-red-600 uppercase">
                             Rekomendasi: {item.latestSession.recommendation.replace(/_/g, ' ')}
                           </div>
                        )}
                        <p className={`text-[10px] mt-1 uppercase font-bold ${item.latestSession.status === 'CLOSED' ? 'text-emerald-600' : 'text-blue-600'}`}>
                            Status: {item.latestSession.status === 'CLOSED' ? 'SELESAI (CLOSED)' : 'SEDANG BERJALAN (OPEN)'}
                        </p>
                      </div>
                   ) : (
                      <div className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded">
                        Belum ada riwayat konseling tercatat. Kasus baru.
                      </div>
                   )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 justify-center min-w-[160px]">
                   <button 
                     onClick={() => handleOpenModal(item.student)}
                     className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm"
                   >
                     <HeartHandshake className="h-4 w-4" />
                     {activeTab === 'ACTIVE' ? (item.hasOpenSession ? 'Lanjutkan Sesi' : 'Mulai Sesi') : 'Catat Sesi Baru'}
                   </button>
                   <Link 
                     to={`/teacher/student/${item.student.id}`}
                     className="w-full py-2 px-4 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                   >
                     Lihat Profil <ArrowUpRight className="h-4 w-4" />
                   </Link>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL KONSELING */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
           <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
              <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                 <h2 className="font-bold text-lg flex items-center gap-2">
                    <HeartHandshake className="h-5 w-5" /> Catat Sesi Konseling
                 </h2>
                 <button onClick={() => setShowModal(false)} className="text-blue-100 hover:text-white">
                    <X className="h-5 w-5" />
                 </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                 <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-900 mb-2">
                    Mencatat untuk: <b>{selectedStudent.name}</b> ({selectedStudent.nis})
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan / Hasil Konseling</label>
                    <textarea 
                      required
                      className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none h-32 bg-white text-slate-900"
                      placeholder="Deskripsikan masalah, solusi, dan komitmen siswa..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-1">Status Sesi</label>
                       <select 
                         className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                         value={sessionStatus}
                         onChange={e => setSessionStatus(e.target.value as any)}
                       >
                         <option value="OPEN">OPEN (Masih Dipantau)</option>
                         <option value="CLOSED">CLOSED (Selesai)</option>
                       </select>
                       <p className="text-[10px] text-slate-500 mt-1">
                          *Pilih CLOSED jika pembinaan selesai. Siswa akan pindah ke menu Riwayat.
                       </p>
                    </div>
                    <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-1">Rekomendasi</label>
                       <select 
                         className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                         value={recommendation}
                         onChange={e => setRecommendation(e.target.value as any)}
                       >
                         <option value="NONE">Tidak Ada (Cukup Pembinaan)</option>
                         <option value="PARENT_CALL">Panggil Orang Tua</option>
                         <option value="TO_KESISWAAN">Rujuk ke Kesiswaan</option>
                         <option value="SUSPENSION_REVIEW">Tinjau Skorsing</option>
                       </select>
                    </div>
                 </div>

                 <div className="pt-4 flex justify-end gap-2">
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting || !notes}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4" /> Simpan
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ActiveCoaching;
