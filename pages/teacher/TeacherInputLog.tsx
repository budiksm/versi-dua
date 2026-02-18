
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Role, IncidentRecord, IncidentTypeCategory, IncidentStatus, CounselingSession, StudentSanction } from '../../types';
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
  ChevronRight,
  X,
  Link as LinkIcon,
  HeartHandshake,
  Gavel,
  Paperclip
} from 'lucide-react';

// --- INTERFACE TIMELINE ---
interface StoryStep {
  id: string;
  date: string;
  type: 'INCIDENT' | 'APPROVAL' | 'COUNSELING_WALAS' | 'COUNSELING_BK' | 'SANCTION';
  title: string;
  actor: string;
  description: string;
  statusLabel?: string;
  statusColor?: string;
  attachmentUrl?: string;
  scoreImpact?: number;
}

interface LogEntry {
  id: string;
  date: string;
  reporterName: string;
  studentId: string; // Added for context lookup
  studentName: string;
  className: string;
  incidentName: string;
  categoryName: string;
  points: number;
  type: IncidentTypeCategory;
  status: IncidentStatus;
  notes: string;
  homeroomName: string; 
  isAutoVerified: boolean;
  proofImage?: string; // Added for detail
}

const TeacherInputLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  
  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [storyLine, setStoryLine] = useState<StoryStep[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

      const isAutoVerified = record.recordedBy === homeroom?.name; 
      
      return {
        id: record.id,
        date: record.date,
        reporterName: record.recordedBy,
        studentId: record.studentId,
        studentName: student?.name || 'Unknown Student',
        className: studentClass?.name || 'Unknown Class',
        incidentName: incident?.name || 'Unknown Incident',
        categoryName: category?.name || '-',
        points: record.pointSnapshot,
        type: record.typeSnapshot,
        status: record.status || 'APPROVED',
        notes: record.notes,
        homeroomName: homeroom?.name || 'Belum Ada Wali Kelas',
        isAutoVerified,
        proofImage: record.proofImage
      };
    });

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
    setCurrentPage(1); 
  }, [searchTerm, statusFilter, typeFilter, logs]);

  // --- LOGIC DETAIL MODAL (TIMELINE) ---
  const handleOpenDetail = (log: LogEntry) => {
      const allRecords = DataService.getRecords();
      const allCounseling = DataService.getCounselingSessions();
      const allSanctions = DataService.getSanctions();
      const currentRecord = allRecords.find(r => r.id === log.id);

      if (!currentRecord) return;

      const story: StoryStep[] = [];

      // 1. INCIDENT NODE
      story.push({
          id: log.id,
          date: log.date,
          type: 'INCIDENT',
          title: `Laporan: ${log.incidentName}`,
          actor: log.reporterName,
          description: log.notes,
          statusLabel: log.status === 'PENDING' ? 'Menunggu' : log.status === 'APPROVED' ? 'Disetujui' : 'Ditolak',
          statusColor: log.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : log.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
          attachmentUrl: log.proofImage,
          scoreImpact: log.points
      });

      // 2. APPROVAL NODE
      if (log.status === 'APPROVED' && !log.isAutoVerified) {
          story.push({
              id: `${log.id}_approve`,
              date: log.date, // Simplification, usually slightly after
              type: 'APPROVAL',
              title: 'Verifikasi Wali Kelas',
              actor: log.homeroomName,
              description: 'Laporan dinyatakan valid dan poin dicatat.',
              statusLabel: 'Valid',
              statusColor: 'bg-green-100 text-green-700'
          });
      } else if (log.status === 'REJECTED') {
          story.push({
              id: `${log.id}_reject`,
              date: log.date,
              type: 'APPROVAL',
              title: 'Penolakan Laporan',
              actor: log.homeroomName,
              description: currentRecord.rejectionReason || 'Ditolak tanpa alasan spesifik.',
              statusLabel: 'Ditolak',
              statusColor: 'bg-red-100 text-red-700'
          });
      }

      // 3. COUNSELING NODES (Find sessions linking to this record)
      const relatedSessions = allCounseling.filter(s => s.relatedRecordIds?.includes(log.id));
      relatedSessions.forEach(sess => {
          story.push({
              id: sess.id,
              date: sess.date,
              type: sess.sessionType === 'BK' ? 'COUNSELING_BK' : 'COUNSELING_WALAS',
              title: sess.sessionType === 'BK' ? 'Tindak Lanjut BK' : 'Pembinaan Wali Kelas',
              actor: sess.counselorName,
              description: sess.notes,
              statusLabel: sess.status === 'COMPLETED' ? 'Selesai' : 'Berjalan',
              statusColor: 'bg-blue-100 text-blue-700'
          });
      });

      story.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setStoryLine(story);
      setDetailModalOpen(true);
  };

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (log: LogEntry) => {
    if (log.status === 'PENDING') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200"><Clock className="h-3 w-3" /> Menunggu Verifikasi</span>;
    if (log.status === 'REJECTED') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200"><XCircle className="h-3 w-3" /> Ditolak</span>;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200"><CheckCircle2 className="h-3 w-3" /> Disetujui</span>;
  };

  const getVerificationText = (log: LogEntry) => {
    if (log.status === 'PENDING') return <span className="text-slate-400 italic text-xs">Menunggu: {log.homeroomName}</span>;
    if (log.status === 'REJECTED') return <span className="text-red-600 font-medium text-xs">Ditolak oleh: {log.homeroomName}</span>;
    if (log.isAutoVerified) return <span className="text-slate-500 text-xs">Otomatis (Input oleh Wali Kelas)</span>;
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
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600"><FileText className="h-6 w-6" /></div>
            <div><p className="text-xs text-slate-500 font-bold uppercase">Total Laporan</p><p className="text-2xl font-bold text-slate-800">{logs.length}</p></div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-50 text-yellow-600"><Clock className="h-6 w-6" /></div>
            <div><p className="text-xs text-slate-500 font-bold uppercase">Menunggu Verifikasi</p><p className="text-2xl font-bold text-slate-800">{logs.filter(l => l.status === 'PENDING').length}</p></div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-50 text-red-600"><XCircle className="h-6 w-6" /></div>
            <div><p className="text-xs text-slate-500 font-bold uppercase">Laporan Ditolak</p><p className="text-2xl font-bold text-slate-800">{logs.filter(l => l.status === 'REJECTED').length}</p></div>
         </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
         <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Cari Guru, Siswa, atau Kejadian..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>
         <div className="flex gap-2">
            <div className="relative">
               <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <select className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                 <option value="ALL">Semua Status</option>
                 <option value="APPROVED">Disetujui</option>
                 <option value="PENDING">Pending</option>
                 <option value="REJECTED">Ditolak</option>
               </select>
            </div>
            <select className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
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
                     <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500"><FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />Tidak ada data log yang ditemukan.</td></tr>
                  ) : (
                     paginatedLogs.map((log) => (
                        <tr key={log.id} onClick={() => handleOpenDetail(log)} className="hover:bg-indigo-50 transition-colors cursor-pointer group">
                           <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" /><div className="flex flex-col"><span className="font-medium text-slate-700">{new Date(log.date).toLocaleDateString()}</span><span className="text-xs">{new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div></div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">{log.reporterName.charAt(0)}</div><span className="font-medium text-slate-800">{log.reporterName}</span></div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{log.studentName}</div><div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit mt-1">{log.className}</div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="font-medium text-slate-800">{log.incidentName}</div>
                              <div className="flex items-center gap-2 mt-1"><span className="text-xs text-slate-500">{log.categoryName}</span><span className={`text-xs font-bold px-1.5 py-0.5 rounded ${log.type === 'VIOLATION' ? 'bg-red-100 text-red-600' : log.type === 'ACHIEVEMENT' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>{log.type === 'VIOLATION' ? '+' : ''}{log.points} Poin</span></div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">{getStatusBadge(log)}{getVerificationText(log)}</div>
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
               <span className="text-xs text-slate-500">Halaman {currentPage} dari {totalPages}</span>
               <div className="flex gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-5 w-5 text-slate-600" /></button><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-5 w-5 text-slate-600" /></button></div>
            </div>
         )}
      </div>

      {/* DETAIL MODAL */}
      {detailModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
                        <h2 className="font-bold text-lg flex items-center gap-2"><LinkIcon className="h-5 w-5 text-indigo-400" /> Detail & Riwayat Penanganan</h2>
                        <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="h-6 w-6" /></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        <div className="space-y-0 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 z-0"></div>

                            {storyLine.map((step, idx) => (
                                <div key={step.id} className="relative z-10 flex gap-4 mb-8 last:mb-0 group">
                                    {/* Timeline Node */}
                                    <div className={`w-12 h-12 rounded-full border-4 border-slate-50 flex items-center justify-center shrink-0 shadow-sm
                                        ${step.type === 'INCIDENT' ? 'bg-white text-slate-600' : 
                                          step.type === 'APPROVAL' ? 'bg-green-100 text-green-600' :
                                          step.type === 'COUNSELING_WALAS' ? 'bg-orange-100 text-orange-600' :
                                          step.type === 'COUNSELING_BK' ? 'bg-blue-100 text-blue-600' :
                                          'bg-red-600 text-white'}
                                    `}>
                                        {step.type === 'INCIDENT' && <FileText className="h-5 w-5" />}
                                        {step.type === 'APPROVAL' && <CheckCircle2 className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_WALAS' && <User className="h-5 w-5" />}
                                        {step.type === 'COUNSELING_BK' && <HeartHandshake className="h-5 w-5" />}
                                        {step.type === 'SANCTION' && <Gavel className="h-5 w-5" />}
                                    </div>

                                    {/* Content Card */}
                                    <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">{step.title}</h4>
                                                <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                    {new Date(step.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {new Date(step.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                            {step.statusLabel && (
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${step.statusColor || 'bg-slate-100 text-slate-600'}`}>
                                                    {step.statusLabel}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100">
                                            <span className="font-semibold">Oleh:</span> {step.actor}
                                            {step.scoreImpact && <span className="ml-2 font-bold text-red-600">(Bobot: {step.scoreImpact} Poin)</span>}
                                        </div>

                                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                            "{step.description || '-'}"
                                        </p>

                                        {/* ATTACHMENT PAPERCLIP */}
                                        {step.attachmentUrl && (
                                            <div className="mt-3 flex justify-end">
                                                <button 
                                                    onClick={() => setPreviewImage(step.attachmentUrl || null)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors border border-slate-200"
                                                >
                                                    <Paperclip className="h-3 w-3" /> Lampiran Bukti
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-4 border-t border-slate-200 flex justify-end"><button onClick={() => setDetailModalOpen(false)} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm">Tutup</button></div>
                </div>
            </div>
      )}

      {/* LIGHTBOX */}
      {previewImage && (
            <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300"><X className="h-8 w-8" /></button>
                <img src={previewImage} alt="Preview Bukti" className="max-w-full max-h-[90vh] rounded shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            </div>
      )}
    </div>
  );
};

export default TeacherInputLog;
