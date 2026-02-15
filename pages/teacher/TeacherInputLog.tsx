
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Role, IncidentRecord, IncidentTypeCategory, IncidentStatus } from '../../types';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface LogEntry {
  id: string;
  date: string;
  reporterName: string;
  studentName: string;
  className: string;
  incidentName: string;
  categoryName: string;
  points: number;
  type: IncidentTypeCategory;
  status: IncidentStatus;
  notes: string;
  homeroomName: string; // The verifier
  isAutoVerified: boolean;
}

const TeacherInputLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | IncidentTypeCategory>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

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
    const records = DataService.getRecords();
    const students = DataService.getStudents();
    const classes = DataService.getClasses();
    const teachers = DataService.getTeachers();
    const incidents = DataService.getIncidentTypes();
    const categories = DataService.getCategories();

    const processedLogs: LogEntry[] = records.map(record => {
      const student = students.find(s => s.id === record.studentId);
      const studentClass = classes.find(c => c.id === student?.classId);
      const homeroom = teachers.find(t => t.id === studentClass?.homeroomTeacherId);
      const incident = incidents.find(i => i.id === record.incidentTypeId);
      const category = categories.find(c => c.id === incident?.categoryId);

      // Determine verification status details
      // Note: DataService doesnt explicitly store verifier ID in record yet,
      // but logically it is the Homeroom teacher if approved/rejected.
      const isAutoVerified = record.recordedBy === homeroom?.name; 
      
      return {
        id: record.id,
        date: record.date,
        reporterName: record.recordedBy,
        studentName: student?.name || 'Unknown Student',
        className: studentClass?.name || 'Unknown Class',
        incidentName: incident?.name || 'Unknown Incident',
        categoryName: category?.name || '-',
        points: record.pointSnapshot,
        type: record.typeSnapshot,
        status: record.status || 'APPROVED', // Default to approved for legacy
        notes: record.notes,
        homeroomName: homeroom?.name || 'Belum Ada Wali Kelas',
        isAutoVerified
      };
    });

    // Sort by date desc (newest first)
    processedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLogs(processedLogs);
    setFilteredLogs(processedLogs);
  };

  useEffect(() => {
    let result = logs;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.reporterName.toLowerCase().includes(lower) || 
        log.studentName.toLowerCase().includes(lower) ||
        log.incidentName.toLowerCase().includes(lower)
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter(log => log.status === statusFilter);
    }

    if (typeFilter !== 'ALL') {
      result = result.filter(log => log.type === typeFilter);
    }

    setFilteredLogs(result);
    setCurrentPage(1); // Reset page on filter
  }, [searchTerm, statusFilter, typeFilter, logs]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // --- Helpers for Display ---

  const getStatusBadge = (log: LogEntry) => {
    if (log.status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
          <Clock className="h-3 w-3" /> Menunggu Verifikasi
        </span>
      );
    }
    if (log.status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
          <XCircle className="h-3 w-3" /> Ditolak
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
        <CheckCircle2 className="h-3 w-3" /> Disetujui
      </span>
    );
  };

  const getVerificationText = (log: LogEntry) => {
    if (log.status === 'PENDING') {
      return <span className="text-slate-400 italic text-xs">Menunggu: {log.homeroomName}</span>;
    }
    if (log.status === 'REJECTED') {
      return <span className="text-red-600 font-medium text-xs">Ditolak oleh: {log.homeroomName}</span>;
    }
    // Approved
    if (log.isAutoVerified) {
        return <span className="text-slate-500 text-xs">Otomatis (Input oleh Wali Kelas)</span>;
    }
    return <span className="text-green-600 font-medium text-xs">Verifikasi oleh: {log.homeroomName}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-600" />
            Log Aktivitas Input Guru
          </h1>
          <p className="text-slate-500">
            Riwayat lengkap pencatatan kejadian oleh seluruh guru mata pelajaran dan wali kelas.
          </p>
        </div>
      </div>

      {/* STATS SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
               <FileText className="h-6 w-6" />
            </div>
            <div>
               <p className="text-xs text-slate-500 font-bold uppercase">Total Laporan</p>
               <p className="text-2xl font-bold text-slate-800">{logs.length}</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-50 text-yellow-600">
               <Clock className="h-6 w-6" />
            </div>
            <div>
               <p className="text-xs text-slate-500 font-bold uppercase">Menunggu Verifikasi</p>
               <p className="text-2xl font-bold text-slate-800">{logs.filter(l => l.status === 'PENDING').length}</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-50 text-red-600">
               <XCircle className="h-6 w-6" />
            </div>
            <div>
               <p className="text-xs text-slate-500 font-bold uppercase">Laporan Ditolak</p>
               <p className="text-2xl font-bold text-slate-800">{logs.filter(l => l.status === 'REJECTED').length}</p>
            </div>
         </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
         <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari Guru, Siswa, atau Kejadian..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
         <div className="flex gap-2">
            <div className="relative">
               <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <select 
                 className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value as any)}
               >
                 <option value="ALL">Semua Status</option>
                 <option value="APPROVED">Disetujui</option>
                 <option value="PENDING">Pending</option>
                 <option value="REJECTED">Ditolak</option>
               </select>
            </div>
            <select 
               className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
               value={typeFilter}
               onChange={(e) => setTypeFilter(e.target.value as any)}
            >
               <option value="ALL">Semua Tipe</option>
               <option value="VIOLATION">Pelanggaran</option>
               <option value="ACHIEVEMENT">Penghargaan</option>
               <option value="REDEMPTION">Penebusan</option>
            </select>
         </div>
      </div>

      {/* LOG TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 border-b border-slate-100 text-slate-600">
                  <tr>
                     <th className="px-6 py-4 font-semibold">Waktu Input</th>
                     <th className="px-6 py-4 font-semibold">Pelapor (Guru)</th>
                     <th className="px-6 py-4 font-semibold">Siswa & Kelas</th>
                     <th className="px-6 py-4 font-semibold">Kejadian & Poin</th>
                     <th className="px-6 py-4 font-semibold">Status & Verifikasi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                           <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                           Tidak ada data log yang ditemukan.
                        </td>
                     </tr>
                  ) : (
                     paginatedLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                              <div className="flex items-center gap-2">
                                 <Calendar className="h-4 w-4 text-slate-400" />
                                 <div className="flex flex-col">
                                    <span className="font-medium text-slate-700">{new Date(log.date).toLocaleDateString()}</span>
                                    <span className="text-xs">{new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                 <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                    {log.reporterName.charAt(0)}
                                 </div>
                                 <span className="font-medium text-slate-800">{log.reporterName}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{log.studentName}</div>
                              <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit mt-1">
                                 {log.className}
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="font-medium text-slate-800">{log.incidentName}</div>
                              <div className="flex items-center gap-2 mt-1">
                                 <span className="text-xs text-slate-500">{log.categoryName}</span>
                                 <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                    log.type === 'VIOLATION' ? 'bg-red-100 text-red-600' : 
                                    log.type === 'ACHIEVEMENT' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                 }`}>
                                    {log.type === 'VIOLATION' ? '+' : ''}{log.points} Poin
                                 </span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                 {getStatusBadge(log)}
                                 {getVerificationText(log)}
                              </div>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>

         {/* PAGINATION FOOTER */}
         {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
               <span className="text-xs text-slate-500">
                  Halaman {currentPage} dari {totalPages}
               </span>
               <div className="flex gap-2">
                  <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                     <ChevronLeft className="h-5 w-5 text-slate-600" />
                  </button>
                  <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                     <ChevronRight className="h-5 w-5 text-slate-600" />
                  </button>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default TeacherInputLog;
