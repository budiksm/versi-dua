
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Role, ClassGroup, CashflowRecord } from '../../types';
import { Wallet, TrendingUp, TrendingDown, Award, AlertTriangle, ArrowRight, Filter, Eye, X, CheckCircle2, Ban, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ClassPoeStats {
  classId: string;
  className: string;
  level: number;
  balance: number;
  totalIn: number;
  totalOut: number;
  transactionCount: number;
  
  // New metrics for monitoring
  monthIn: number;
  monthOut: number;
  monthTxCount: number;
  
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const KesiswaanPoeMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ClassPoeStats[]>([]);
  
  // Aggregate Stats (Follows Filter)
  const [aggBalance, setAggBalance] = useState(0);
  const [aggMonthIn, setAggMonthIn] = useState(0);
  const [aggPending, setAggPending] = useState(0);
  const [aggApproved, setAggApproved] = useState(0);

  // Filters
  const [selectedLevel, setSelectedLevel] = useState<number | 'ALL'>('ALL');

  // Detail Modal
  const [detailClassId, setDetailClassId] = useState<string | null>(null);
  const [classTransactions, setClassTransactions] = useState<CashflowRecord[]>([]);
  const [detailClassName, setDetailClassName] = useState('');

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user?.roles.includes(Role.KESISWAAN)) {
      navigate('/teacher/dashboard');
      return;
    }
    loadData();
  }, [selectedLevel]); // Reload when filter changes

  const loadData = () => {
    const classes = DataService.getClasses();
    const allFlows = DataService.getCashflows();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const classStats: ClassPoeStats[] = [];
    
    // Agregat Variables
    let totalBal = 0;
    let totalMIn = 0;
    let totalPend = 0;
    let totalAppr = 0;

    // Filter Classes based on Level
    const filteredClasses = classes.filter(c => selectedLevel === 'ALL' ? true : c.level === selectedLevel);

    filteredClasses.forEach(c => {
       const cFlows = allFlows.filter(f => f.classId === c.id);
       
       // Calculate specific stats per class
       let balance = 0;
       let tin = 0, tout = 0;
       let mIn = 0, mOut = 0, mTx = 0;
       let cPend = 0, cAppr = 0, cRej = 0;

       cFlows.forEach(f => {
           const d = new Date(f.date);
           const isThisMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;

           // Counters
           if (f.status === 'PENDING') cPend++;
           if (f.status === 'APPROVED') cAppr++;
           if (f.status === 'REJECTED') cRej++;

           // Financials (Only Approved counts)
           if (f.status === 'APPROVED') {
               if (f.type === 'IN') { 
                   tin += f.amount;
                   if (isThisMonth) mIn += f.amount;
               } else { 
                   tout += f.amount; 
                   if (isThisMonth) mOut += f.amount;
               }
               
               if (isThisMonth) mTx++;
           }
       });

       balance = tin - tout;

       // Add to Aggregate
       totalBal += balance;
       totalMIn += mIn;
       totalPend += cPend;
       totalAppr += cAppr;

       classStats.push({
         classId: c.id,
         className: c.name,
         level: c.level,
         balance,
         totalIn: tin,
         totalOut: tout,
         transactionCount: cFlows.length,
         monthIn: mIn,
         monthOut: mOut,
         monthTxCount: mTx,
         pendingCount: cPend,
         approvedCount: cAppr,
         rejectedCount: cRej
       });
    });

    // Sort by Balance High -> Low
    classStats.sort((a,b) => b.balance - a.balance);

    setStats(classStats);
    setAggBalance(totalBal);
    setAggMonthIn(totalMIn);
    setAggPending(totalPend);
    setAggApproved(totalAppr);
  };

  const handleOpenDetail = (classId: string, className: string) => {
      const allFlows = DataService.getCashflows();
      const cFlows = allFlows.filter(f => f.classId === classId);
      // Sort: Pending first, then by date desc
      cFlows.sort((a, b) => {
          if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
          if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      setClassTransactions(cFlows);
      setDetailClassName(className);
      setDetailClassId(classId);
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
       <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Wallet className="h-6 w-6 text-indigo-600" />
             Monitoring Kas "Poe Ibu"
          </h1>
          <p className="text-slate-500">Rekapitulasi transparansi keuangan kelas seluruh sekolah.</p>
       </div>

       {/* FILTER BAR */}
       <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex overflow-x-auto gap-2">
           {[
               { label: 'Semua Kelas', val: 'ALL' },
               { label: 'Kelas 10', val: 10 },
               { label: 'Kelas 11', val: 11 },
               { label: 'Kelas 12', val: 12 }
           ].map(opt => (
               <button 
                 key={opt.val}
                 onClick={() => setSelectedLevel(opt.val as any)}
                 className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${selectedLevel === opt.val ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
               >
                   {opt.label}
               </button>
           ))}
       </div>

       {/* HIGHLIGHT CARDS (AGGREGATE) */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-5 rounded-xl shadow-lg">
             <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Total Saldo {selectedLevel !== 'ALL' ? `Kls ${selectedLevel}` : 'Sekolah'}</p>
             <h2 className="text-3xl font-black">Rp {aggBalance.toLocaleString('id-ID')}</h2>
             <div className="mt-3 flex items-center gap-2 text-[10px] bg-white/20 w-fit px-2 py-1 rounded">
                <TrendingUp className="h-3 w-3" /> Dana Tersimpan
             </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm">
             <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pemasukan Bulan Ini</p>
             <h2 className="text-2xl font-bold text-emerald-600">+ {aggMonthIn.toLocaleString('id-ID')}</h2>
             <p className="text-xs text-slate-400 mt-1">Akumulasi Approved</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-orange-100 shadow-sm">
             <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Menunggu Approval</p>
             <h2 className="text-2xl font-bold text-orange-600">{aggPending} Transaksi</h2>
             <p className="text-xs text-slate-400 mt-1">Total PENDING</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
             <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Transaksi Valid</p>
             <h2 className="text-2xl font-bold text-blue-600">{aggApproved} Transaksi</h2>
             <p className="text-xs text-slate-400 mt-1">Status APPROVED</p>
          </div>
       </div>

       {/* GRID KARTU KELAS */}
       <div>
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-600" /> Detail Per Kelas
          </h3>
          
          {stats.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Tidak ada data kelas untuk filter ini.
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {stats.map(c => (
                      <div key={c.classId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-300 transition-all hover:shadow-md group">
                          <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                              <div>
                                  <h4 className="font-bold text-lg text-slate-800">{c.className}</h4>
                                  <p className="text-xs text-slate-500">Tingkat {c.level}</p>
                              </div>
                              <div className="text-right">
                                  <p className="text-xs text-slate-400 font-bold uppercase">Saldo</p>
                                  <p className="text-xl font-black text-indigo-600">Rp {c.balance.toLocaleString('id-ID')}</p>
                              </div>
                          </div>
                          
                          <div className="p-5 grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                              <div>
                                  <p className="text-xs text-slate-400 mb-0.5">Bulan Ini (In)</p>
                                  <p className="font-bold text-emerald-600">+ {c.monthIn.toLocaleString('id-ID')}</p>
                              </div>
                              <div>
                                  <p className="text-xs text-slate-400 mb-0.5">Bulan Ini (Out)</p>
                                  <p className="font-bold text-rose-600">- {c.monthOut.toLocaleString('id-ID')}</p>
                              </div>
                              
                              <div className="col-span-2 pt-2 border-t border-slate-50 grid grid-cols-3 text-center gap-2">
                                  <div className="bg-orange-50 rounded p-1">
                                      <p className="text-[10px] text-orange-600 font-bold">PENDING</p>
                                      <p className="font-black text-orange-700">{c.pendingCount}</p>
                                  </div>
                                  <div className="bg-emerald-50 rounded p-1">
                                      <p className="text-[10px] text-emerald-600 font-bold">APPROVED</p>
                                      <p className="font-black text-emerald-700">{c.approvedCount}</p>
                                  </div>
                                  <div className="bg-rose-50 rounded p-1">
                                      <p className="text-[10px] text-rose-600 font-bold">REJECTED</p>
                                      <p className="font-black text-rose-700">{c.rejectedCount}</p>
                                  </div>
                              </div>
                          </div>

                          <button 
                            onClick={() => handleOpenDetail(c.classId, c.className)}
                            className="w-full py-3 bg-slate-50 hover:bg-indigo-50 text-indigo-600 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-t border-slate-100"
                          >
                              Lihat Detail <ArrowRight className="h-4 w-4" />
                          </button>
                      </div>
                  ))}
              </div>
          )}
       </div>

       {/* DETAIL MODAL */}
       {detailClassId && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
               <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                   <div className="bg-indigo-600 text-white p-5 flex justify-between items-center shrink-0">
                       <div>
                           <h2 className="font-bold text-lg flex items-center gap-2"><Wallet className="h-5 w-5" /> Detail Kas: {detailClassName}</h2>
                           <p className="text-xs text-indigo-200">Riwayat transaksi lengkap</p>
                       </div>
                       <button onClick={() => setDetailClassId(null)} className="text-indigo-200 hover:text-white transition-colors">
                           <X className="h-6 w-6" />
                       </button>
                   </div>

                   <div className="flex-1 overflow-y-auto p-0">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 shadow-sm">
                               <tr>
                                   <th className="px-6 py-3">Tanggal</th>
                                   <th className="px-6 py-3">Keterangan</th>
                                   <th className="px-6 py-3">Pencatat & Verifikator</th>
                                   <th className="px-6 py-3 text-right">Nominal</th>
                                   <th className="px-6 py-3 text-center">Status</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {classTransactions.map(tr => (
                                   <tr key={tr.id} className="hover:bg-slate-50 group">
                                       <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                           {new Date(tr.date).toLocaleDateString()}
                                       </td>
                                       <td className="px-6 py-4">
                                           <div className="font-medium text-slate-800">{tr.description}</div>
                                           <div className="text-xs text-slate-400 mt-0.5 capitalize">{tr.type === 'IN' ? 'Pemasukan' : 'Pengeluaran'}</div>
                                       </td>
                                       <td className="px-6 py-4">
                                           <div className="text-xs">
                                               <p className="text-slate-700"><b>Input:</b> {tr.recordedBy}</p>
                                               {tr.verifiedBy ? (
                                                   <p className="text-emerald-600 mt-0.5"><b>ACC:</b> {tr.verifiedBy}</p>
                                               ) : tr.status === 'REJECTED' ? (
                                                   <p className="text-rose-600 mt-0.5"><b>Ditolak</b></p>
                                               ) : (
                                                   <p className="text-orange-500 mt-0.5 italic">Menunggu...</p>
                                               )}
                                           </div>
                                       </td>
                                       <td className={`px-6 py-4 text-right font-bold ${tr.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                           {tr.type === 'IN' ? '+' : '-'} {tr.amount.toLocaleString('id-ID')}
                                       </td>
                                       <td className="px-6 py-4 text-center">
                                           <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase inline-flex items-center gap-1 ${
                                               tr.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                                               tr.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 
                                               'bg-orange-100 text-orange-700'
                                           }`}>
                                               {tr.status === 'APPROVED' ? <CheckCircle2 className="h-3 w-3" /> : 
                                                tr.status === 'REJECTED' ? <Ban className="h-3 w-3" /> : 
                                                <Clock className="h-3 w-3" />}
                                               {tr.status}
                                           </span>
                                       </td>
                                   </tr>
                               ))}
                               {classTransactions.length === 0 && (
                                   <tr>
                                       <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">Belum ada transaksi.</td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                   </div>
                   
                   <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
                       <button onClick={() => setDetailClassId(null)} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm transition-colors">
                           Tutup
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default KesiswaanPoeMonitoring;
