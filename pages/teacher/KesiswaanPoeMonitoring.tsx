
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Role, ClassGroup } from '../../types';
import { Wallet, TrendingUp, TrendingDown, Award, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ClassPoeStats {
  classId: string;
  className: string;
  balance: number;
  totalIn: number;
  totalOut: number;
  transactionCount: number;
}

const KesiswaanPoeMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ClassPoeStats[]>([]);
  const [totalSchoolBalance, setTotalSchoolBalance] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user?.roles.includes(Role.KESISWAAN)) {
      navigate('/teacher/dashboard');
      return;
    }
    loadData();
  }, []);

  const loadData = () => {
    const classes = DataService.getClasses();
    const allFlows = DataService.getCashflows();

    let schoolBalance = 0;
    const classStats: ClassPoeStats[] = [];

    classes.forEach(c => {
       const balanceData = DataService.getClassBalance(c.id);
       schoolBalance += balanceData.balance;
       classStats.push({
         classId: c.id,
         className: c.name,
         ...balanceData
       });
    });

    // Sort by Balance High -> Low
    classStats.sort((a,b) => b.balance - a.balance);

    // Recent Transactions (Global)
    const recent = allFlows
      .filter(f => f.status === 'APPROVED')
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(f => ({
         ...f,
         className: classes.find(c => c.id === f.classId)?.name || 'Unknown'
      }));

    setStats(classStats);
    setTotalSchoolBalance(schoolBalance);
    setRecentTransactions(recent);
  };

  const topClass = stats[0];
  const activeClass = [...stats].sort((a,b) => b.transactionCount - a.transactionCount)[0];

  return (
    <div className="space-y-8 animate-fade-in">
       <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Wallet className="h-6 w-6 text-indigo-600" />
             Monitoring Kas "Poe Ibu"
          </h1>
          <p className="text-slate-500">Rekapitulasi transparansi keuangan kelas seluruh sekolah.</p>
       </div>

       {/* HIGHLIGHT CARDS */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-6 rounded-xl shadow-lg">
             <p className="text-blue-100 text-sm font-medium mb-1">Total Akumulasi Sekolah</p>
             <h2 className="text-4xl font-bold">Rp {totalSchoolBalance.toLocaleString('id-ID')}</h2>
             <div className="mt-4 flex items-center gap-2 text-xs bg-white/20 w-fit px-2 py-1 rounded">
                <TrendingUp className="h-3 w-3" /> Dana Tersimpan Aman
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Award className="h-16 w-16 text-yellow-500" />
             </div>
             <p className="text-slate-500 text-sm font-medium mb-1">Saldo Tertinggi</p>
             {topClass ? (
               <>
                 <h2 className="text-2xl font-bold text-slate-800">{topClass.className}</h2>
                 <p className="text-emerald-600 font-bold mt-1">Rp {topClass.balance.toLocaleString('id-ID')}</p>
               </>
             ) : (
               <p>-</p>
             )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp className="h-16 w-16 text-emerald-500" />
             </div>
             <p className="text-slate-500 text-sm font-medium mb-1">Paling Aktif (Transaksi)</p>
             {activeClass ? (
               <>
                 <h2 className="text-2xl font-bold text-slate-800">{activeClass.className}</h2>
                 <p className="text-indigo-600 font-bold mt-1">{activeClass.transactionCount} Transaksi</p>
               </>
             ) : (
               <p>-</p>
             )}
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* TABEL REKAP KELAS */}
          <div className="lg:col-span-2 space-y-4">
             <h3 className="font-bold text-lg text-slate-800">Rekapitulasi Per Kelas</h3>
             <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                         <th className="px-6 py-3">Nama Kelas</th>
                         <th className="px-6 py-3 text-right">Pemasukan</th>
                         <th className="px-6 py-3 text-right">Pengeluaran</th>
                         <th className="px-6 py-3 text-right">Saldo Akhir</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {stats.map(s => (
                         <tr key={s.classId} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium text-slate-900">{s.className}</td>
                            <td className="px-6 py-3 text-right text-emerald-600">+ {s.totalIn.toLocaleString('id-ID')}</td>
                            <td className="px-6 py-3 text-right text-rose-600">- {s.totalOut.toLocaleString('id-ID')}</td>
                            <td className="px-6 py-3 text-right font-bold text-blue-600">Rp {s.balance.toLocaleString('id-ID')}</td>
                         </tr>
                      ))}
                      {stats.length === 0 && (
                         <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada data kelas.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>

          {/* SIDEBAR: RECENT TRANSACTIONS */}
          <div className="space-y-4">
             <h3 className="font-bold text-lg text-slate-800">Transaksi Terbaru (Global)</h3>
             <div className="space-y-3">
                {recentTransactions.length === 0 ? (
                   <p className="text-slate-500 italic text-sm">Belum ada transaksi.</p>
                ) : (
                   recentTransactions.map((tr, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                         <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-500">{tr.className}</span>
                            <span className="text-[10px] text-slate-400">{new Date(tr.date).toLocaleDateString()}</span>
                         </div>
                         <div className="flex justify-between items-center mb-1">
                            <span className={`text-sm font-bold ${tr.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                               {tr.type === 'IN' ? '+' : '-'} Rp {tr.amount.toLocaleString('id-ID')}
                            </span>
                         </div>
                         <p className="text-xs text-slate-600 line-clamp-2">
                            {tr.description}
                         </p>
                      </div>
                   ))
                )}
             </div>
          </div>
       </div>
    </div>
  );
};

export default KesiswaanPoeMonitoring;
