
import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { Database, Play, Loader2, AlertTriangle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { DataService } from '../../services/dataService';

const MigrationTool: React.FC = () => {
  const [status, setStatus] = useState<string>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const addLog = (msg: string) => setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const migrateCollection = async (legacyDocName: string, targetColName: string) => {
    addLog(`--- Memulai Migrasi: ${legacyDocName} -> ${targetColName} ---`);
    
    try {
        const legacyRef = doc(db, "school_data", legacyDocName);
        const legacySnap = await getDoc(legacyRef);
        
        if (!legacySnap.exists()) {
            addLog(`❌ Dokumen legacy '${legacyDocName}' tidak ditemukan. Skip.`);
            return;
        }

        const dataArray = legacySnap.data().data || [];
        addLog(`📦 Ditemukan ${dataArray.length} item di legacy.`);

        if (dataArray.length === 0) return;

        const CHUNK_SIZE = 400;
        const chunks = [];
        
        for (let i = 0; i < dataArray.length; i += CHUNK_SIZE) {
            chunks.push(dataArray.slice(i, i + CHUNK_SIZE));
        }

        addLog(`🔄 Memproses ${chunks.length} batch...`);

        let totalProcessed = 0;
        for (let i = 0; i < chunks.length; i++) {
            const batch = writeBatch(db);
            const chunk = chunks[i];

            chunk.forEach((item: any) => {
                const docId = item.id || item['id']; 
                if (!docId) { console.warn("Item tanpa ID:", item); return; }
                const itemRef = doc(db, targetColName, String(docId));
                batch.set(itemRef, item, { merge: true });
            });

            await batch.commit();
            totalProcessed += chunk.length;
            setProgress(prev => prev + (100 / (chunks.length * 6))); 
            addLog(`✅ Batch ${i + 1}/${chunks.length} berhasil (${chunk.length} items).`);
        }

        addLog(`🎉 Selesai memigrasi ${targetColName}. Total: ${totalProcessed}`);

    } catch (error: any) {
        addLog(`❌ ERROR pada ${legacyDocName}: ${error.message}`);
        console.error(error);
    }
  };

  const migrateConfigs = async () => {
      addLog(`--- Memindahkan Config ke master_data ---`);
      const configs = ['categories', 'incidentTypes', 'rules'];
      const batch = writeBatch(db);
      let count = 0;

      for (const conf of configs) {
          const legacyRef = doc(db, "school_data", conf);
          const snap = await getDoc(legacyRef);
          if (snap.exists()) {
              const data = snap.data().data || [];
              const targetRef = doc(db, "master_data", conf);
              batch.set(targetRef, { data: data });
              addLog(`📄 Config '${conf}' disiapkan (${data.length} items).`);
              count++;
          }
      }
      
      if (count > 0) {
          await batch.commit();
          addLog(`✅ Config berhasil disimpan ke collection 'master_data'.`);
      }
  };

  const runMigration = async () => {
    if (!confirm("PERINGATAN: Pastikan tidak ada user lain yang sedang menginput data. Lanjutkan?")) return;
    setStatus('RUNNING'); setLogs([]); setProgress(0);
    try {
        await migrateCollection('students', 'students');
        await migrateCollection('teachers', 'teachers');
        await migrateCollection('classes', 'classes');
        await migrateCollection('records', 'records');
        await migrateCollection('counseling', 'counseling');
        await migrateCollection('sanctions', 'sanctions');
        await migrateCollection('cashflow', 'cashflow');
        await migrateCollection('activity_logs', 'activity_logs');
        await migrateConfigs();
        setProgress(100); 
        setStatus('COMPLETED');
        addLog("🏁 --- MIGRASI DB SELESAI --- 🏁");
    } catch (e: any) {
        addLog(`❌ Migration Error: ${e.message}`);
        setStatus('ERROR');
    }
  };

  const runStorageMigration = async () => {
      if (!confirm("Jalankan migrasi gambar Base64 ke Firebase Storage? Proses ini mungkin memakan waktu.")) return;
      setStatus('RUNNING'); setLogs([]); setProgress(0);
      addLog("🚀 Memulai Migrasi Storage...");
      
      try {
          const result = await DataService.migrateAllBase64ToStorage((msg) => addLog(msg));
          addLog(`🏁 Migrasi Storage Selesai! Berhasil: ${result.migratedCount}, Gagal: ${result.errorsCount}`);
          setStatus('COMPLETED');
          setProgress(100);
      } catch (e: any) {
          addLog(`❌ Fatal Error: ${e.message}`);
          setStatus('ERROR');
      } finally {
          // Ensure status is updated even if unknown error occurs
          if (status === 'RUNNING') setStatus('ERROR');
      }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="h-6 w-6 text-indigo-600" />
            Migration Tool Suite
        </h1>
        <p className="text-slate-500 mt-2">
            Pilih jenis migrasi yang ingin dijalankan. <br/>
            <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs mt-2 inline-block">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Backup data JSON sebelum memulai!
            </span>
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
            <button 
                onClick={runMigration} 
                disabled={status === 'RUNNING'}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
                {status === 'RUNNING' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                1. Migrasi Struktur DB
            </button>

            <button 
                onClick={runStorageMigration} 
                disabled={status === 'RUNNING'}
                className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
                {status === 'RUNNING' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                2. Migrasi Base64 ke Storage
            </button>
        </div>
      </div>

      <div className="bg-slate-900 text-green-400 p-6 rounded-xl font-mono text-xs md:text-sm h-96 overflow-y-auto shadow-inner border border-slate-800">
        {logs.length === 0 ? (
            <p className="text-slate-500 italic">Menunggu perintah...</p>
        ) : (
            logs.map((log, idx) => <div key={idx} className="mb-1 border-b border-slate-800 pb-1 last:border-0 font-mono">{log}</div>)
        )}
        {status === 'COMPLETED' && (
            <div className="mt-4 p-3 bg-green-900/30 text-green-300 border border-green-800 rounded text-center font-bold flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5" /> PROSES SELESAI
            </div>
        )}
        {status === 'ERROR' && (
            <div className="mt-4 p-3 bg-red-900/30 text-red-300 border border-red-800 rounded text-center font-bold flex items-center justify-center gap-2">
                <AlertTriangle className="h-5 w-5" /> TERJADI ERROR
            </div>
        )}
      </div>
    </div>
  );
};

export default MigrationTool;
