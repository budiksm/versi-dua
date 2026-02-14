
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Student, CoachingRule, StudentSanction, IncidentRecord, MasterIncidentType, Role, CounselingSession, SanctionLevel, RedemptionStatus } from '../../types';
import { Gavel, AlertCircle, CheckCircle2, History, MessageSquare, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const KesiswaanAction: React.FC = () => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [sanctionHistory, setSanctionHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'CANDIDATES' | 'HISTORY'>('CANDIDATES');

  const navigate = useNavigate();

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user?.roles.includes(Role.KESISWAAN)) {
      navigate('/teacher/dashboard');
      return;
    }
    loadData();
  }, []);

  const loadData = () => {
    const stds = DataService.getStudents();
    const recs = DataService.getRecords();
    const incs = DataService.getIncidentTypes();
    const rules = DataService.getRules();
    const sans = DataService.getSanctions();
    const classes = DataService.getClasses();
    const counselings = DataService.getCounselingSessions();

    const candList: any[] = [];
    stds.forEach(s => {
      const stats = DataService.calculateStudentPoints(s.id, recs, incs);
      const score = stats.effectiveViolationScore;
      const studentSanctions = sans.filter(sn => sn.studentId === s.id && !sn.isRedeemed);
      const latestCounseling = counselings.filter(c => c.studentId === s.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      let neededSP: string | null = null;
      // Updated Thresholds: 80, 120, 160
      if (score >= 160) neededSP = 'SP 3';
      else if (score >= 120) neededSP = 'SP 2';
      else if (score >= 80) neededSP = 'SP 1';

      const alreadyHasMatchedSP = studentSanctions.some(sn => sn.level === neededSP?.replace(' ', ''));

      if (neededSP && !alreadyHasMatchedSP) {
        candList.push({
          student: s,
          score,
          neededSP,
          latestCounseling,
          className: classes.find(c => c.id === s.classId)?.name || '-'
        });
      }
    });

    setCandidates(candList.sort((a,b) => b.score - a.score));

    const history = sans.map(sn => ({
        ...sn,
        studentName: stds.find(s => s.id === sn.studentId)?.name || 'Unknown'
    })).sort((a,b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime());
    setSanctionHistory(history);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pembinaan & Penetapan SP</h1>
          <p className="text-slate-500">Proses administratif kesiswaan untuk penegakan disiplin.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
         <button 
           onClick={() => setActiveTab('CANDIDATES')}
           className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'CANDIDATES' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <AlertCircle className="h-4 w-4" /> Kandidat Sanksi Baru ({candidates.length})
         </button>
         <button 
           onClick={() => setActiveTab('HISTORY')}
           className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <History className="h-4 w-4" /> Riwayat Penetapan
         </button>
      </div>

      {activeTab === 'CANDIDATES' && (
        <div className="space-y-4">
           {candidates.length === 0 ? (
             <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <p className="font-bold text-slate-700">Semua Terkendali!</p>
                <p className="text-sm">Tidak ada siswa yang melewati ambang poin tanpa sanksi saat ini.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {candidates.map((cand, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-red-300 transition-colors">
                     <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                           <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-900 text-lg">{cand.student.name}</span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">{cand.className}</span>
                           </div>
                           <div className="flex items-center gap-4 text-sm">
                              <div className="text-red-600 font-bold">Skor: {cand.score} Poin</div>
                              <div className="text-orange-600 font-bold flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" /> Rekomendasi: {cand.neededSP}
                              </div>
                           </div>
                           
                           {cand.latestCounseling && (
                             <div className="mt-3 bg-blue-50 p-2 rounded-lg text-xs text-blue-700 flex items-start gap-2 border border-blue-100">
                                <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                <div>
                                   <b>BK:</b> "{cand.latestCounseling.notes}" 
                                   <span className="block mt-1 font-bold text-[10px] uppercase">Rekomendasi: {cand.latestCounseling.recommendation}</span>
                                </div>
                             </div>
                           )}
                        </div>

                        <div className="flex gap-2">
                           <Link 
                             to={`/teacher/student/${cand.student.id}`}
                             className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md"
                           >
                              Proses Penetapan <ArrowRight className="h-4 w-4" />
                           </Link>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-700">Tanggal</th>
                    <th className="px-6 py-4 font-bold text-slate-700">Nama Siswa</th>
                    <th className="px-6 py-4 font-bold text-slate-700">Level</th>
                    <th className="px-6 py-4 font-bold text-slate-700">Keterangan</th>
                    <th className="px-6 py-4 font-bold text-slate-700 text-center">Status Penebusan</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {sanctionHistory.map((sn, idx) => (
                   <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                         {new Date(sn.assignedDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">{sn.studentName}</td>
                      <td className="px-6 py-4">
                         <span className="px-2 py-1 bg-red-50 text-red-700 rounded font-bold border border-red-100">
                           {sn.level}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 italic">
                         {sn.notes}
                      </td>
                      <td className="px-6 py-4 text-center">
                         <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase
                            ${sn.redemptionStatus === RedemptionStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}
                         `}>
                           {sn.redemptionStatus}
                         </span>
                      </td>
                   </tr>
                 ))}
                 {sanctionHistory.length === 0 && (
                   <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada riwayat sanksi tercatat.</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
};

export default KesiswaanAction;
