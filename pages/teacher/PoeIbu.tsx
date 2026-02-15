
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { CashflowRecord, CashflowType, Role, Teacher } from '../../types';
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  History, 
  AlertCircle, 
  Save, 
  Filter,
  Ban,
  PenLine
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PoeIbu: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  const [className, setClassName] = useState('');
  
  const [balance, setBalance] = useState(0);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  
  const [transactions, setTransactions] = useState<CashflowRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Form State
  const [activeTab, setActiveTab] = useState<'LIST' | 'INPUT_IN' | 'INPUT_OUT' | 'VERIFY'>('LIST');
  const [amount, setAmount] = useState<number>(0);
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipient, setRecipient] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Correction Mode
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user) {
      navigate('/');
      return;
    }
    setCurrentUser(user);

    // DETERMINE CLASS ID
    let classIdToLoad = '';
    const classes = DataService.getClasses();

    if (user.roles.includes(Role.STUDENT)) {
      // If Student (Bendahara), get assigned class
      classIdToLoad = user.assignedClassId || '';
    } else if (user.roles.includes(Role.WALIKELAS)) {
      // If Walikelas, find class where they are homeroom
      const cls = classes.find(c => c.homeroomTeacherId === user.id);
      classIdToLoad = cls?.id || '';
    }

    if (!classIdToLoad) {
      // If no class assigned, show empty state or redirect
      // For now, just stay state null
    } else {
      setCurrentClassId(classIdToLoad);
      const clsName = classes.find(c => c.id === classIdToLoad)?.name || 'Unknown Class';
      setClassName(clsName);
    }
  }, [navigate]);

  useEffect(() => {
    if (currentClassId) {
      loadTransactions();
    }
  }, [currentClassId]);

  const loadTransactions = () => {
    if (!currentClassId) return;
    const allFlows = DataService.getCashflows();
    const classFlows = allFlows.filter(f => f.classId === currentClassId);
    
    // Calculate Balance
    const stats = DataService.getClassBalance(currentClassId);
    setBalance(stats.balance);
    setTotalIn(stats.totalIn);
    setTotalOut(stats.totalOut);

    // Sort Descending
    classFlows.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(classFlows);

    setPendingCount(classFlows.filter(f => f.status === 'PENDING').length);
  };

  const handleInputSubmit = (e: React.FormEvent, type: CashflowType) => {
    e.preventDefault();
    if (!currentClassId || !currentUser) return;

    setIsSubmitting(true);

    const isWalikelas = currentUser.roles.includes(Role.WALIKELAS);
    // Walikelas -> Auto Approved
    // Student -> Pending
    const status = isWalikelas ? 'APPROVED' : 'PENDING';
    const verifier = isWalikelas ? currentUser.name : undefined;
    const verifyDate = isWalikelas ? new Date().toISOString() : undefined;

    const newRecord: CashflowRecord = {
      id: `cf_${Date.now()}`,
      classId: currentClassId,
      type,
      amount: Number(amount),
      date,
      description: desc,
      recipient: type === 'OUT' ? recipient : undefined,
      recordedBy: currentUser.name,
      recordedById: currentUser.id,
      recordedByRole: isWalikelas ? Role.WALIKELAS : Role.STUDENT,
      status,
      verifiedBy: verifier,
      verifiedDate: verifyDate
    };

    const flows = DataService.getCashflows();
    DataService.saveCashflows([...flows, newRecord]);

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg('Transaksi berhasil dicatat!');
      setAmount(0);
      setDesc('');
      setRecipient('');
      setActiveTab('LIST');
      loadTransactions();
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 600);
  };

  const handleVerify = (id: string, isRejected = false) => {
    if (!currentUser) return;
    DataService.verifyCashflow(id, currentUser.name, isRejected);
    loadTransactions();
  };

  const handleCorrection = (id: string) => {
    if (!currentUser) return;
    if (confirm("Apakah Anda yakin ingin mengkoreksi (membatalkan) transaksi ini? Saldo akan dikembalikan, dan transaksi akan ditandai sebagai 'CORRECTED'. Anda perlu menginput ulang transaksi yang benar.")) {
        DataService.voidCashflow(id, currentUser);
        loadTransactions();
    }
  };

  // Permission Check
  const isWalikelas = currentUser?.roles.includes(Role.WALIKELAS);

  if (!currentClassId) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
         <Ban className="h-12 w-12 mx-auto mb-4 text-slate-300" />
         <h2 className="text-xl font-bold text-slate-700">Akses Ditolak / Kelas Tidak Ditemukan</h2>
         <p className="mt-2">Anda tidak terdaftar sebagai Wali Kelas ataupun Bendahara di kelas manapun.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-indigo-600" />
            Kas "Poe Ibu" - {className}
          </h1>
          <p className="text-slate-500">
            Pencatatan keuangan kelas transparan, fleksibel, dan terpercaya.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right">
           <p className="text-xs text-slate-500 font-bold uppercase">Saldo Kas Saat Ini</p>
           <p className="text-2xl font-bold text-blue-600">Rp {balance.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
               <ArrowUpCircle className="h-6 w-6" />
            </div>
            <div>
               <p className="text-xs font-bold text-emerald-800 uppercase">Total Pemasukan (Verified)</p>
               <p className="text-xl font-bold text-emerald-700">Rp {totalIn.toLocaleString('id-ID')}</p>
            </div>
         </div>
         <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
               <ArrowDownCircle className="h-6 w-6" />
            </div>
            <div>
               <p className="text-xs font-bold text-rose-800 uppercase">Total Pengeluaran (Verified)</p>
               <p className="text-xl font-bold text-rose-700">Rp {totalOut.toLocaleString('id-ID')}</p>
            </div>
         </div>
      </div>

      {/* TABS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="flex border-b border-slate-100 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('LIST')}
              className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'LIST' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
               <History className="h-4 w-4" /> Riwayat Transaksi
            </button>
            <button 
              onClick={() => setActiveTab('INPUT_IN')}
              className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'INPUT_IN' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
               <ArrowUpCircle className="h-4 w-4" /> Input Pemasukan
            </button>
            <button 
              onClick={() => setActiveTab('INPUT_OUT')}
              className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'INPUT_OUT' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
               <ArrowDownCircle className="h-4 w-4" /> Input Pengeluaran
            </button>
            {isWalikelas && (
              <button 
                onClick={() => setActiveTab('VERIFY')}
                className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'VERIFY' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <CheckCircle2 className="h-4 w-4" /> Verifikasi ({pendingCount})
              </button>
            )}
         </div>

         <div className="p-6">
            {/* TAB: LIST */}
            {activeTab === 'LIST' && (
               <div className="space-y-4">
                  {transactions.length === 0 ? (
                     <p className="text-center text-slate-500 italic py-8">Belum ada transaksi tercatat.</p>
                  ) : (
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                 <th className="px-4 py-3">Tanggal</th>
                                 <th className="px-4 py-3">Keterangan</th>
                                 <th className="px-4 py-3">Tipe</th>
                                 <th className="px-4 py-3 text-right">Jumlah</th>
                                 <th className="px-4 py-3 text-center">Status</th>
                                 <th className="px-4 py-3 text-right">Aksi</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {transactions.map(tr => (
                                 <tr key={tr.id} className={`hover:bg-slate-50 ${tr.status === 'CORRECTED' ? 'opacity-50 bg-slate-50 grayscale' : ''}`}>
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                       {new Date(tr.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                       <div className="font-medium text-slate-900">{tr.description}</div>
                                       {tr.recipient && <div className="text-xs text-slate-500">Penerima: {tr.recipient}</div>}
                                       <div className="text-[10px] text-slate-400 mt-1">
                                          Input: {tr.recordedBy} {tr.verifiedBy ? `| Acc: ${tr.verifiedBy}` : ''}
                                       </div>
                                    </td>
                                    <td className="px-4 py-3">
                                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tr.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                          {tr.type === 'IN' ? 'MASUK' : 'KELUAR'}
                                       </span>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${tr.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'} ${tr.status !== 'APPROVED' ? 'opacity-50' : ''}`}>
                                       {tr.type === 'IN' ? '+' : '-'} {tr.amount.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                       {tr.status === 'APPROVED' && <span className="text-emerald-600 font-bold text-xs">Verified</span>}
                                       {tr.status === 'PENDING' && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200">Pending</span>}
                                       {tr.status === 'REJECTED' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">Ditolak</span>}
                                       {tr.status === 'CORRECTED' && <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold line-through">Dikoreksi</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                       {tr.status === 'APPROVED' && (
                                          <button 
                                            onClick={() => handleCorrection(tr.id)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                            title="Koreksi Transaksi (Batalkan)"
                                          >
                                             <PenLine className="h-4 w-4" />
                                          </button>
                                       )}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>
            )}

            {/* TAB: INPUT */}
            {(activeTab === 'INPUT_IN' || activeTab === 'INPUT_OUT') && (
               <div className="max-w-lg mx-auto">
                  <div className={`p-4 rounded-lg mb-6 border ${activeTab === 'INPUT_IN' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                     <h3 className="font-bold flex items-center gap-2">
                        {activeTab === 'INPUT_IN' ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                        Catat {activeTab === 'INPUT_IN' ? 'Pemasukan' : 'Pengeluaran'} Kas
                     </h3>
                     <p className="text-sm mt-1 opacity-80">
                        {isWalikelas ? 'Transaksi akan otomatis disetujui karena Anda adalah Wali Kelas.' : 'Transaksi akan berstatus PENDING hingga disetujui Wali Kelas.'}
                     </p>
                  </div>

                  <form onSubmit={(e) => handleInputSubmit(e, activeTab === 'INPUT_IN' ? 'IN' : 'OUT')} className="space-y-4">
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal</label>
                        <input 
                           type="date" required 
                           value={date} onChange={e => setDate(e.target.value)}
                           className="w-full border border-slate-300 rounded-lg p-2.5"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Jumlah (Rp)</label>
                        <input 
                           type="number" required min="1"
                           value={amount || ''} onChange={e => setAmount(Number(e.target.value))}
                           className="w-full border border-slate-300 rounded-lg p-2.5"
                           placeholder="0"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Keterangan</label>
                        <textarea 
                           required rows={2}
                           value={desc} onChange={e => setDesc(e.target.value)}
                           className="w-full border border-slate-300 rounded-lg p-2.5"
                           placeholder={activeTab === 'INPUT_IN' ? "Contoh: Uang kas minggu ke-3..." : "Contoh: Beli spidol dan penghapus..."}
                        />
                     </div>
                     
                     {activeTab === 'INPUT_OUT' && (
                        <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1">Penerima Dana / Toko</label>
                           <input 
                              type="text" required 
                              value={recipient} onChange={e => setRecipient(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg p-2.5"
                              placeholder="Contoh: Toko Alat Tulis Jaya / Pak Budi"
                           />
                        </div>
                     )}

                     {successMsg && (
                        <div className="bg-emerald-100 text-emerald-700 p-3 rounded-lg flex items-center gap-2 text-sm font-bold">
                           <CheckCircle2 className="h-4 w-4" /> {successMsg}
                        </div>
                     )}

                     <button 
                        type="submit" 
                        disabled={isSubmitting || amount <= 0}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${activeTab === 'INPUT_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} disabled:bg-slate-300`}
                     >
                        <Save className="h-5 w-5" /> Simpan Transaksi
                     </button>
                  </form>
               </div>
            )}

            {/* TAB: VERIFY (WALIKELAS ONLY) */}
            {activeTab === 'VERIFY' && isWalikelas && (
               <div className="space-y-4">
                  {transactions.filter(t => t.status === 'PENDING').length === 0 ? (
                     <div className="text-center py-12 text-slate-500">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
                        <p>Tidak ada transaksi yang menunggu verifikasi.</p>
                     </div>
                  ) : (
                     <div className="grid gap-4">
                        {transactions.filter(t => t.status === 'PENDING').map(tr => (
                           <div key={tr.id} className="bg-white border border-yellow-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                              <div className="flex-1">
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tr.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                       {tr.type === 'IN' ? 'PEMASUKAN' : 'PENGELUARAN'}
                                    </span>
                                    <span className="text-sm text-slate-500">{new Date(tr.date).toLocaleDateString()}</span>
                                 </div>
                                 <p className="font-bold text-slate-800 text-lg">Rp {tr.amount.toLocaleString('id-ID')}</p>
                                 <p className="text-slate-600">{tr.description}</p>
                                 <p className="text-xs text-slate-400 mt-1">Diinput oleh: {tr.recordedBy}</p>
                              </div>
                              <div className="flex gap-2">
                                 <button 
                                   onClick={() => handleVerify(tr.id, true)}
                                   className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-sm font-bold hover:bg-rose-50"
                                 >
                                    Tolak
                                 </button>
                                 <button 
                                   onClick={() => handleVerify(tr.id, false)}
                                   className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-sm"
                                 >
                                    Setujui
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default PoeIbu;
