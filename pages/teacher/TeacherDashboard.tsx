import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Teacher } from '../../types';
import { 
  Users, 
  ShieldAlert, 
  Award, 
  Clock, 
  UserCheck, 
  ArrowRight,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Role } from '../../types';

const TeacherDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalViolations: 0,
    totalAchievements: 0,
    pendingIncidents: 0
  });
  const [recentIncidents, setRecentIncidents] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<Teacher | null>(null);

  useEffect(() => {
    const user = DataService.getCurrentUser();
    setCurrentUser(user);
    loadDashboardData();

    const unsubscribe = DataService.subscribeToDataChanges(() => {
        loadDashboardData();
    });
    return () => unsubscribe();
  }, []);

  const loadDashboardData = () => {
    const students = DataService.getStudents();
    const records = DataService.getRecords();
    const incidents = DataService.getIncidentTypes();
    const classes = DataService.getClasses();

    // Stats
    const totalStudents = students.length;
    const violations = records.filter(r => r.typeSnapshot === 'VIOLATION');
    const achievements = records.filter(r => r.typeSnapshot === 'ACHIEVEMENT');
    const pending = records.filter(r => r.status === 'PENDING');

    setStats({
      totalStudents,
      totalViolations: violations.length,
      totalAchievements: achievements.length,
      pendingIncidents: pending.length
    });

    // Recent Activity
    const sortedRecords = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
    
    const recentWithDetails = sortedRecords.map(r => {
      const student = students.find(s => s.id === r.studentId);
      const incidentType = incidents.find(i => i.id === r.incidentTypeId);
      const cls = classes.find(c => c.id === student?.classId);
      
      return {
        ...r,
        studentName: student?.name || 'Unknown',
        className: cls?.name || '-',
        incidentName: incidentType?.name || 'Unknown',
        points: r.pointSnapshot
      };
    });

    setRecentIncidents(recentWithDetails);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Guru</h1>
          <p className="text-slate-500">Selamat datang kembali, {currentUser?.name || 'Guru'}.</p>
        </div>
        <div className="text-right hidden sm:block">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal Hari Ini</p>
           <p className="text-lg font-bold text-slate-700">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
           <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="h-8 w-8" />
           </div>
           <div>
              <p className="text-slate-500 text-sm font-medium">Total Siswa</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.totalStudents}</h3>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
           <div className="p-4 bg-red-50 text-red-600 rounded-xl">
              <ShieldAlert className="h-8 w-8" />
           </div>
           <div>
              <p className="text-slate-500 text-sm font-medium">Pelanggaran</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.totalViolations}</h3>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
           <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
              <Award className="h-8 w-8" />
           </div>
           <div>
              <p className="text-slate-500 text-sm font-medium">Penghargaan</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.totalAchievements}</h3>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
           <div className="p-4 bg-yellow-50 text-yellow-600 rounded-xl">
              <Clock className="h-8 w-8" />
           </div>
           <div>
              <p className="text-slate-500 text-sm font-medium">Menunggu</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.pendingIncidents}</h3>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /> Aktivitas Terbaru</h3>
               <Link to="/teacher/kesiswaan/logs" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">Lihat Semua <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="divide-y divide-slate-100">
               {recentIncidents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 italic">Belum ada aktivitas tercatat.</div>
               ) : (
                  recentIncidents.map((inc, idx) => (
                     <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${inc.typeSnapshot === 'VIOLATION' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                        <div className="flex-1">
                           <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-800 text-sm">{inc.studentName} <span className="text-slate-400 font-normal">({inc.className})</span></h4>
                              <span className="text-xs text-slate-400">{new Date(inc.date).toLocaleDateString()}</span>
                           </div>
                           <p className="text-sm text-slate-600 mt-1">{inc.incidentName}</p>
                           <p className="text-xs text-slate-400 mt-1">Oleh: {inc.recordedBy}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${inc.typeSnapshot === 'VIOLATION' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                           {inc.typeSnapshot === 'VIOLATION' ? '+' : ''}{inc.points} Poin
                        </span>
                     </div>
                  ))
               )}
            </div>
         </div>

         <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-lg p-6 text-white">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><UserCheck className="h-5 w-5" /> Akses Cepat</h3>
            <div className="space-y-3">
               <Link to="/teacher/classes" className="block w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-medium text-sm border border-white/10 backdrop-blur-sm">
                  📂 Data Kelas & Siswa
               </Link>
               {currentUser?.roles.includes(Role.WALIKELAS) && (
                  <Link to="/teacher/poe-ibu" className="block w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-medium text-sm border border-white/10 backdrop-blur-sm">
                     💰 Kas Poe Ibu (Wali Kelas)
                  </Link>
               )}
               {currentUser?.roles.includes(Role.KESISWAAN) && (
                  <Link to="/teacher/kesiswaan/monitoring" className="block w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-medium text-sm border border-white/10 backdrop-blur-sm">
                     ⚖️ Monitoring Pelanggaran
                  </Link>
               )}
               {currentUser?.roles.includes(Role.BK) && (
                  <Link to="/teacher/bk/active" className="block w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-medium text-sm border border-white/10 backdrop-blur-sm">
                     🤝 Konseling Aktif
                  </Link>
               )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10">
               <p className="text-xs text-indigo-200">
                  Tip: Gunakan menu sidebar untuk navigasi lengkap sesuai hak akses Anda.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
