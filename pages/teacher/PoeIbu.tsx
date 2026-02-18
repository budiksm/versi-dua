
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { CashflowRecord, CashflowType, Role, Teacher, CashflowStatus } from '../../types';
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock, 
  CheckCircle2, 
  History, 
  Save, 
  Ban,
  Cloud,
  Check,
  X,
  AlertTriangle,
  Filter
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
  
  const [transactions, setTransactions] = useState<CashflowRecord[]>([]); // History (Approved/Rejected)
  const [pendingTransactions, setPendingTransactions] = useState<CashflowRecord[]>([]); // Pending for approval

  const [activeTab, setActiveTab] = useState<'LIST' | 'INPUT_IN' | 'INPUT_OUT' | 'VERIFY'>('LIST');
  const [amount, setAmount] = useState<number>(0);
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipient, setRecipient] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isWalikelas = currentUser?.roles.includes(Role.WALIKELAS);

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user) { navigate('/'); return; }
    setCurrentUser(user);

    let classIdToLoad = '';
    const classes = DataService.getClasses();
    if (user.roles.includes(Role.STUDENT)) classIdToLoad = user.assignedClassId || '';
    else if (user.roles.includes(Role.WALIKELAS)) classIdToLoad = classes.find(c => c.homeroomTeacherId === user.id)?.id || '';

    if (classIdToLoad) {
      setCurrentClassId(classIdToLoad);
      setClassName(classes.find(c => c.id === classIdToLoad)?.name || 'Unknown');
    }
  }, [navigate]);

  useEffect(() => {
    if (currentClassId) loadTransactions();
  }, [currentClassId]);

  const loadTransactions = () => {
    if (!currentClassId) return;
    const allFlows = DataService.getCashflows().filter(f => f.classId === currentClassId);
    
    // Calculate Balance only from APPROVED
    const approvedFlows = allFlows.filter(f => f.status === 'APPROVED');
    let tin = 0, tout = 0;
    approvedFlows.forEach(f => f.type === 'IN' ? tin += f.amount : tout += f.amount);
    
    setBalance(tin - tout);
    setTotalIn(tin);
    setTotalOut(tout);

    // Split Lists
    setTransactions(allFlows.filter(f => f.status !== 'PENDING').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setPendingTransactions(allFlows.filter(f => f.status === 'PENDING').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const handleInputSubmit = async (e: React.FormEvent, type: CashflowType) => {
    e.preventDefault();
    if (!currentClassId || !currentUser) return;

    setIsSubmitting(true);
    try {
        // If Walikelas inputs, auto-approve. If Student, Pending.
        const status: CashflowStatus = isWalikelas ? 'APPROVED' : 'PENDING';
        
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
          status: status,
          verifiedBy: isWalikelas ? currentUser.name : undefined,
          verifiedDate: isWalikelas ? new Date().toISOString() : undefined
        };

        await DataService.saveCashflows([...DataService.getCashflows(), newRecord]);
        
        setSuccessMsg(isWalikelas ? 'Transaksi Berhasil Disimpan!' : 'Transaksi Terkirim! Menunggu Persetujuan Wali Kelas.');
        setAmount(0); setDesc(''); setRecipient('');
        setActiveTab('LIST');
        loadTransactions();
        setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { 
        alert("Gagal mengirim dana. Periksa internet."); 
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleVerification = async (recordId: string, isApproved: boolean) => {
      if (!currentUser) return;
      setIsSubmitting(true);
      try {
          const allFlows = DataService.getCashflows();
          const updatedFlows = allFlows.map(f => {
              if (f.id === recordId) {
                  return {
                      ...f,
                      status: isApproved ? 'APPROVED' : 'REJECTED' as CashflowStatus,
                      verifiedBy: currentUser.name,
                      verifiedDate: new Date().toISOString()
                  };
              }
              return f;
          });
          
          await DataService.saveCashflows(updatedFlows);
          loadTransactions();
          setSuccessMsg(isApproved ? 'Transaksi Disetujui (ACC)' : 'Transaksi Ditolak');
          setTimeout(() => setSuccessMsg(''), 2000);
      } catch (e) {
          alert("Gagal memproses verifikasi.");
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!currentClassId) return <div className="p-8 text-center text-slate-500 flex flex-col items-center"><Ban className="h-12 w-12 mb-4 text-slate-300" /><h2>Akses Ditolak. Hubungi Admin untuk penugasan kelas.</h2></div>;

  return (
    <div className="space-y-6 pb-12 relative">
      
      {/* LOADING OVERLAY */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800">
                <Cloud className="h-16 w-16 text-emerald-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Memproses Data...</h3>
                <p className="text-sm text-slate-500 mt-2">Menyinkronkan kas kelas ke Cloud.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-emerald-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      {/* HEADER & BALANCE */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="h-6 w-6 text-indigo-600" />Kas Poe Ibu - {className}</h1>
            <p className="text-slate-500 text-sm mt-1">{isWalikelas ? 'Dashboard Pengelolaan Kas Kelas' : 'Form Input Penyetoran Kas'}</p>
        </div>
        <div className="bg-white px-6 py-4 rounded-xl border border-indigo-100 shadow-sm text-right min-w-[200px]">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Saldo Akhir</p>
            <p className="text-3xl font-black text-indigo-600">Rp {balance.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
             <div className="bg-white p-3 rounded-full shadow-sm"><ArrowUpCircle className="h-6 w-6 text-emerald-600" /></div>
             <div><p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Pemasukan (Approved)</p><p className="text-xl font-bold text-emerald-700">Rp {totalIn.toLocaleString('id-ID')}</p></div>
         </div>
         <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
             <div className="bg-white p-3 rounded-full shadow-sm"><ArrowDownCircle className="h-6 w-6 text-rose-600" /></div>
             <div><p className="text-xs font-bold text-rose-800 uppercase tracking-wide">Pengeluaran (Approved)</p><p className="text-xl font-bold text-rose-700">Rp {totalOut.toLocaleString('id-ID')}</p></div>
         </div>
      </div>

      {/* MAIN PANEL */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="flex border-b overflow-x-auto bg-slate-50">
            <button onClick={() => setActiveTab('LIST')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'LIST' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <History className="h-4 w-4" /> Riwayat Transaksi
            </button>
            {isWalikelas && (
                <button onClick={() => setActiveTab('VERIFY')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'VERIFY' ? 'border-orange-500 text-orange-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    <CheckCircle2 className="h-4 w-4" /> Verifikasi Masuk 
                    {pendingTransactions.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingTransactions.length}</span>}
                </button>
            )}
            <button onClick={() => setActiveTab('INPUT_IN')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'INPUT_IN' ? 'border-emerald-500 text-emerald-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <ArrowUpCircle className="h-4 w-4" /> Input Pemasukan
            </button>
            <button onClick={() => setActiveTab('INPUT_OUT')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'INPUT_OUT' ? 'border-rose-500 text-rose-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <ArrowDownCircle className="h-4 w-4" /> Input Pengeluaran
            </button>
         </div>

         <div className="p-6">
            
            {/* TAB: RIWAYAT (APPROVED/REJECTED ONLY) */}
            {activeTab === 'LIST' && (
               <div className="overflow-x-auto">
                  {transactions.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 italic">Belum ada riwayat transaksi yang disetujui/ditolak.</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b text-slate-600">
                            <tr>
                                <th className="px-4 py-3 font-bold">Tanggal</th>
                                <th className="px-4 py-3 font-bold">Keterangan</th>
                                <th className="px-4 py-3 font-bold text-center">Tipe</th>
                                <th className="px-4 py-3 text-right font-bold">Jumlah</th>
                                <th className="px-4 py-3 text-center font-bold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {transactions.map(tr => (
                                <tr key={tr.id} className="hover:bg-slate-50 group">
                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(tr.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="font-bold text-slate-800">{tr.description}</p>
                                            <div className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                                                <span>Input: {tr.recordedBy}</span>
                                                {tr.verifiedBy && <span>• ACC: {tr.verifiedBy}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${tr.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {tr.type === 'IN' ? 'Masuk' : 'Keluar'}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${tr.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {tr.type === 'IN' ? '+' : '-'} {tr.amount.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center justify-center gap-1 w-fit mx-auto ${tr.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {tr.status === 'APPROVED' ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                                            {tr.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  )}
               </div>
            )}

            {/* TAB: VERIFIKASI (WALIKELAS ONLY) */}
            {activeTab === 'VERIFY' && isWalikelas && (
                <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-orange-800 text-sm flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-bold">Konfirmasi Transaksi Siswa</p>
                            <p>Transaksi di bawah ini diinput oleh siswa (Bendahara). Silakan verifikasi (ACC) agar masuk ke saldo, atau Tolak jika salah.</p>
                        </div>
                    </div>

                    {pendingTransactions.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Tidak ada transaksi yang menunggu persetujuan.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {pendingTransactions.map(tr => (
                                <div key={tr.id} className="bg-white border border-orange-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${tr.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {tr.type === 'IN' ? 'Pemasukan' : 'Pengeluaran'}
                                            </span>
                                            <span className="text-xs text-slate-500">{new Date(tr.date).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-lg">{tr.description}</h4>
                                        <p className="text-xs text-slate-500 mt-1">Diinput oleh: <b>{tr.recordedBy}</b></p>
                                    </div>
                                    
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <span className={`text-xl font-black ${tr.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            Rp {tr.amount.toLocaleString('id-ID')}
                                        </span>
                                        {tr.recipient && <span className="text-xs text-slate-500">Penerima: {tr.recipient}</span>}
                                    </div>

                                    <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
                                        <button onClick={() => handleVerification(tr.id, true)} className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-transform active:scale-95">
                                            <Check className="h-4 w-4" /> ACC
                                        </button>
                                        <button onClick={() => handleVerification(tr.id, false)} className="flex items-center gap-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-sm transition-transform active:scale-95">
                                            <X className="h-4 w-4" /> Tolak
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: INPUT FORM */}
            {(activeTab === 'INPUT_IN' || activeTab === 'INPUT_OUT') && (
               <form onSubmit={(e) => handleInputSubmit(e, activeTab === 'INPUT_IN' ? 'IN' : 'OUT')} className="max-w-lg mx-auto space-y-5 animate-fade-in">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6">
                      <h3 className="font-bold text-indigo-900 text-sm mb-1">{activeTab === 'INPUT_IN' ? 'Catat Pemasukan Kas' : 'Catat Pengeluaran Kas'}</h3>
                      <p className="text-xs text-indigo-700">
                          {isWalikelas 
                            ? "Data akan langsung berstatus APPROVED dan masuk ke saldo." 
                            : "Data akan berstatus PENDING dan menunggu persetujuan Wali Kelas."}
                      </p>
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tanggal</label>
                      <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium" />
                  </div>
                  
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nominal (Rp)</label>
                      <input type="number" required min="1" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} className="w-full border-2 border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-lg" placeholder="0" />
                  </div>
                  
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Keterangan</label>
                      <textarea required value={desc} onChange={e => setDesc(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder={activeTab === 'INPUT_IN' ? "Contoh: Uang Kas Mingguan" : "Contoh: Beli Spidol & Penghapus"} rows={3} />
                  </div>
                  
                  {activeTab === 'INPUT_OUT' && (
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Penerima Dana</label>
                          <input type="text" required value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Nama Toko / Orang" />
                      </div>
                  )}

                  <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-xl font-bold text-white shadow-xl shadow-indigo-100 transition-transform active:scale-95 flex items-center justify-center gap-2 ${activeTab === 'INPUT_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                      <Save className="h-5 w-5" /> {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                  </button>
               </form>
            )}
         </div>
      </div>
    </div>
  );
};

export default PoeIbu;
