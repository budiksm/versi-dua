
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { CashflowRecord, CashflowType, Role, Teacher } from '../../types';
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
  Loader2
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

  const [activeTab, setActiveTab] = useState<'LIST' | 'INPUT_IN' | 'INPUT_OUT' | 'VERIFY'>('LIST');
  const [amount, setAmount] = useState<number>(0);
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipient, setRecipient] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false); // PENGUNCI LAYAR
  const [successMsg, setSuccessMsg] = useState('');

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
    const classFlows = DataService.getCashflows().filter(f => f.classId === currentClassId);
    const stats = DataService.getClassBalance(currentClassId);
    setBalance(stats.balance);
    setTotalIn(stats.totalIn);
    setTotalOut(stats.totalOut);
    setTransactions(classFlows.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setPendingCount(classFlows.filter(f => f.status === 'PENDING').length);
  };

  const handleInputSubmit = async (e: React.FormEvent, type: CashflowType) => {
    e.preventDefault();
    if (!currentClassId || !currentUser) return;

    setIsSubmitting(true);
    try {
        const isWalikelas = currentUser.roles.includes(Role.WALIKELAS);
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
          status: isWalikelas ? 'APPROVED' : 'PENDING'
        };

        await DataService.saveCashflows([...DataService.getCashflows(), newRecord]);
        
        setSuccessMsg('Tersimpan di Cloud!');
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

  if (!currentClassId) return <div className="p-8 text-center"><Ban className="h-12 w-12 mx-auto mb-4" /><h2>Akses Ditolak. Hubungi Admin untuk penugasan kelas.</h2></div>;

  return (
    <div className="space-y-6 pb-12 relative">
      
      {/* LOADING OVERLAY ANTI-GIMIK */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-slate-800 animate-bounce-slow">
                <Cloud className="h-16 w-16 text-emerald-600 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold">Sinkronisasi Kas...</h3>
                <p className="text-sm text-slate-500 mt-2">Menunggu konfirmasi server Google.</p>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-emerald-600 animate-progress-indeterminate"></div>
                </div>
            </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="h-6 w-6 text-indigo-600" />Kas "Poe Ibu" - {className}</h1><p className="text-slate-500 text-sm mt-1">Transparansi keuangan kelas berbasis Cloud.</p></div>
        <div className="bg-white px-6 py-3 rounded-xl border-2 border-indigo-100 text-right"><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Saldo Saat Ini</p><p className="text-3xl font-black text-indigo-600">Rp {balance.toLocaleString('id-ID')}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4"><ArrowUpCircle className="h-8 w-8 text-emerald-600" /><div><p className="text-xs font-bold text-emerald-800">Total Masuk</p><p className="text-xl font-bold text-emerald-700">Rp {totalIn.toLocaleString('id-ID')}</p></div></div>
         <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4"><ArrowDownCircle className="h-8 w-8 text-rose-600" /><div><p className="text-xs font-bold text-rose-800">Total Keluar</p><p className="text-xl font-bold text-rose-700">Rp {totalOut.toLocaleString('id-ID')}</p></div></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="flex border-b overflow-x-auto bg-slate-50">
            <button onClick={() => setActiveTab('LIST')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'LIST' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500'}`}><History className="h-4 w-4 inline mr-2" /> Riwayat</button>
            <button onClick={() => setActiveTab('INPUT_IN')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'INPUT_IN' ? 'border-emerald-500 text-emerald-600 bg-white' : 'border-transparent text-slate-500'}`}><ArrowUpCircle className="h-4 w-4 inline mr-2" /> Pemasukan</button>
            <button onClick={() => setActiveTab('INPUT_OUT')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'INPUT_OUT' ? 'border-rose-500 text-rose-600 bg-white' : 'border-transparent text-slate-500'}`}><ArrowDownCircle className="h-4 w-4 inline mr-2" /> Pengeluaran</button>
         </div>

         <div className="p-6">
            {activeTab === 'LIST' && (
               <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3 font-bold">Tanggal</th><th className="px-4 py-3 font-bold">Keterangan</th><th className="px-4 py-3 text-right font-bold">Jumlah</th><th className="px-4 py-3 text-center font-bold">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{transactions.map(tr => (<tr key={tr.id} className={`hover:bg-slate-50 ${tr.status === 'CORRECTED' ? 'opacity-40' : ''}`}><td className="px-4 py-3 text-slate-500">{new Date(tr.date).toLocaleDateString()}</td><td className="px-4 py-3"><div><p className="font-bold text-slate-800">{tr.description}</p><p className="text-[10px] text-slate-400">Oleh: {tr.recordedBy}</p></div></td><td className={`px-4 py-3 text-right font-black ${tr.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{tr.type === 'IN' ? '+' : '-'} {tr.amount.toLocaleString('id-ID')}</td><td className="px-4 py-3 text-center"><span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${tr.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{tr.status}</span></td></tr>))}</tbody></table>
               </div>
            )}
            {(activeTab === 'INPUT_IN' || activeTab === 'INPUT_OUT') && (
               <form onSubmit={(e) => handleInputSubmit(e, activeTab === 'INPUT_IN' ? 'IN' : 'OUT')} className="max-w-lg mx-auto space-y-4">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Tanggal Transaksi</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full border p-3 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Jumlah Uang (Rp)</label><input type="number" required min="1" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} className="w-full border p-3 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: 10000" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Keterangan Transaksi</label><textarea required value={desc} onChange={e => setDesc(e.target.value)} className="w-full border p-3 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: Bayar kas minggu ke-1" /></div>
                  {activeTab === 'INPUT_OUT' && <div className="space-y-1"><label className="text-xs font-bold text-slate-500">Penerima Dana</label><input type="text" required value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full border p-3 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: Pak Budi (Foto copy)" /></div>}
                  <button type="submit" className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${activeTab === 'INPUT_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}><Save className="h-5 w-5 inline mr-2" /> Simpan ke Cloud</button>
               </form>
            )}
         </div>
      </div>
    </div>
  );
};

export default PoeIbu;
