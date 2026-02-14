import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Student, CoachingRule, StudentSanction, IncidentRecord, MasterIncidentType, Role, CounselingSession, SanctionLevel, RedemptionStatus } from '../../types';
import { Gavel, AlertCircle, CheckCircle2, History, MessageSquare, ArrowRight, ClipboardList } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const KesiswaanAction: React.FC = () => {
  const [newSanctions, setNewSanctions] = useState<any[]>([]);
  const [sanctionHistory, setSanctionHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'NEW_SANCTIONS' | 'HISTORY'>('NEW_SANCTIONS');

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
    const sans = DataService.getSanctions();
    const classes = DataService.getClasses();

    // 1. FILTER SANKSI BARU (Otomatis dibuat sistem, belum ada tugas/penebusan)
    // Kriteria: RedemptionStatus === NONE
    const newSanctionList = sans
        .filter(s => s.redemptionStatus === RedemptionStatus.NONE)
        .map(s => ({
            ...s,
            student: stds.find(st => st.id === s.studentId),
            className: classes.find(c => c.id === stds.find(st => st.id === s.studentId)?.classId)?.name || '-'
        }))
        .filter(item => item.student); // Ensure student exists

    setNewSanctions(newSanctionList.sort((a,b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime()));

    // 2. RIWAYAT (Semua sanksi)
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
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Sanksi & Penebusan</h1>
          <p className="text-slate-500">Kelola sanksi yang diterbitkan otomatis oleh sistem.</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
         <button 
           onClick={() => setActiveTab('NEW_SANCTIONS')}
           className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'NEW_SANCTIONS' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <AlertCircle className="h-4 w-4" /> Sanksi Baru (Butuh Tugas) ({newSanctions.length})
         </button>
         <button 
           onClick={() => setActiveTab('HISTORY')}
           className={`px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <History className="h-4 w-4" /> Riwayat Lengkap
         </button>
      </div>

      {activeTab === 'NEW_SANCTIONS' && (
        <div className="space-y-4">
           {newSanctions.length === 0 ? (
             <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <p className="font-bold text-slate-700">Semua Terkendali!</p>
                <p className="text-sm">Tidak ada sanksi baru yang belum diberikan tugas penebusan.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {newSanctions.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-red-300 transition-colors">
                     <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                           <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-900 text-lg">{item.student.name}</span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">{item.className}</span>
                           </div>
                           
                           <div className="flex items-center gap-3 text-sm mt-2">
                              <span className="bg-red-600 text-white px-3 py-1 rounded-md font-bold flex items-center gap-2">
                                <Gavel className="h-4 w-4" /> {item.level}
                              </span>
                              <span className="text-slate-500 text-xs">
                                Ditetapkan: {new Date(item.assignedDate).toLocaleDateString()}
                              </span>
                           </div>
                           
                           <p className="mt-3 text-slate-600 text-sm bg-red-50 p-2 rounded border border-red-100 italic">
                              "{item.notes}"
                           </p>
                        </div>

                        <div className="flex gap-2">
                           <Link 
                             to={`/teacher/student/${item.student.id}`}
                             className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md"
                           >
                              <ClipboardList className="h-4 w-4" /> Beri Tugas
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