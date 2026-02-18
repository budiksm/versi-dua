
import React from 'react';
import { Database, AlertTriangle, ShieldAlert } from 'lucide-react';

const MigrationTool: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
        <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
            Migrasi Sistem Dijeda (Paused)
        </h1>
        <p className="text-slate-500 max-w-lg mx-auto mb-6">
            Fitur migrasi storage dan database dinonaktifkan sementara untuk menjaga stabilitas sistem dan menunggu aktivasi billing cloud. 
            Silakan fokus pada penggunaan fitur inti aplikasi.
        </p>
        
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left max-w-lg mx-auto">
            <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Status Sistem:
            </h3>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                <li>Input Data Guru/Siswa: <b>Aktif</b></li>
                <li>Dashboard Monitoring: <b>Aktif</b></li>
                <li>Upload Media (Baru): <b>Tertunda (Billing)</b></li>
                <li>Migrasi Legacy: <b>Nonaktif</b></li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default MigrationTool;
