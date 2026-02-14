
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Student, ClassGroup, CoachingRule, StudentSanction, IncidentRecord, MasterIncidentType, Role } from '../../types';
import { Search, ArrowUpRight, ShieldAlert, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type SortKey = 'name' | 'violation' | 'achievement' | 'status' | 'sanction';
type SortDirection = 'asc' | 'desc';

const KesiswaanMonitoring: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  const [sanctions, setSanctions] = useState<StudentSanction[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSanction, setSelectedSanction] = useState('ALL');
  const [pointFilter, setPointFilter] = useState('ALL'); // ALL, CRITICAL (>=80), RISK (20-79), SAFE (0-19)

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'violation', // Default sort by violation points
    direction: 'desc' // Highest points first
  });

  const navigate = useNavigate();

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user?.roles.includes(Role.KESISWAAN)) {
      navigate('/teacher/dashboard');
      return;
    }

    setStudents(DataService.getStudents());
    setClasses(DataService.getClasses());
    setRules(DataService.getRules());
    setRecords(DataService.getRecords());
    setIncidents(DataService.getIncidentTypes());
    setSanctions(DataService.getSanctions());
  }, []);

  const getStudentInfo = (studentId: string) => {
    const stats = DataService.calculateStudentPoints(studentId, records, incidents);
    const status = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
    const activeSanction = sanctions.find(s => s.studentId === studentId && !s.isRedeemed);
    return { ...stats, statusLabel: status.statusLabel, statusColor: status.color, activeSanction };
  };

  // --- SORTING HELPERS ---

  // Weight map for Status Severity (Higher number = More severe)
  const getStatusWeight = (label: string): number => {
    const l = label.toLowerCase();
    if (l.includes('sp 3')) return 6;
    if (l.includes('sp 2')) return 5;
    if (l.includes('sp 1')) return 4;
    if (l.includes('bk')) return 3;
    if (l.includes('wali kelas')) return 2;
    if (l.includes('normal')) return 1;
    return 0;
  };

  // Weight map for Sanction Severity
  const getSanctionWeight = (level?: string): number => {
    if (!level) return 0;
    if (level === 'DROP_OUT') return 5;
    if (level === 'SKORSING') return 4;
    if (level === 'SP3') return 3;
    if (level === 'SP2') return 2;
    if (level === 'SP1') return 1;
    return 0;
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- FILTER & SORT LOGIC ---

  const filteredStudents = students.filter(s => {
    const info = getStudentInfo(s.id);
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.nis.includes(searchTerm);
    const matchesClass = selectedClass === 'ALL' || s.classId === selectedClass;
    const matchesSanction = selectedSanction === 'ALL' || (info.activeSanction?.level === selectedSanction);
    
    let matchesPoints = true;
    // Updated ranges based on new rules
    // Critical: >= 80 (SP1 starts)
    if (pointFilter === 'CRITICAL') matchesPoints = info.effectiveViolationScore >= 80;
    // Risk: 20 - 79 (Wali Kelas & BK)
    else if (pointFilter === 'RISK') matchesPoints = info.effectiveViolationScore >= 20 && info.effectiveViolationScore <= 79;
    // Safe: 0 - 19
    else if (pointFilter === 'SAFE') matchesPoints = info.effectiveViolationScore <= 19;

    return matchesSearch && matchesClass && matchesSanction && matchesPoints;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const infoA = getStudentInfo(a.id);
    const infoB = getStudentInfo(b.id);
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    switch (sortConfig.key) {
      case 'name':
        return a.name.localeCompare(b.name) * direction;
      
      case 'violation':
        return (infoA.effectiveViolationScore - infoB.effectiveViolationScore) * direction;
      
      case 'achievement':
        return (infoA.achievementPoints - infoB.achievementPoints) * direction;
      
      case 'status':
        return (getStatusWeight(infoA.statusLabel) - getStatusWeight(infoB.statusLabel)) * direction;
      
      case 'sanction':
        const sanctionA = getSanctionWeight(infoA.activeSanction?.level);
        const sanctionB = getSanctionWeight(infoB.activeSanction?.level);
        return (sanctionA - sanctionB) * direction;
        
      default:
        return 0;
    }
  });

  // Helper component for Sort Header
  const SortableHeader = ({ label, sortKey, align = 'left' }: { label: string, sortKey: SortKey, align?: string }) => (
    <th 
      className={`px-6 py-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors select-none text-${align}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className={`flex items-center gap-2 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label}
        <div className="flex flex-col">
           {sortConfig.key === sortKey ? (
             sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600" /> : <ChevronDown className="h-3 w-3 text-indigo-600" />
           ) : (
             <ArrowUpDown className="h-3 w-3 text-slate-300" />
           )}
        </div>
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Monitoring Seluruh Siswa</h1>
        <p className="text-slate-500">Pantau perkembangan poin dan sanksi siswa secara global.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Nama / NIS..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select 
          className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="ALL">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select 
          className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          value={selectedSanction}
          onChange={(e) => setSelectedSanction(e.target.value)}
        >
          <option value="ALL">Semua Status Sanksi</option>
          <option value="SP1">Siswa SP 1</option>
          <option value="SP2">Siswa SP 2</option>
          <option value="SP3">Siswa SP 3</option>
        </select>

        <select 
          className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          value={pointFilter}
          onChange={(e) => setPointFilter(e.target.value)}
        >
          <option value="ALL">Semua Skor Poin</option>
          <option value="CRITICAL">Poin Kritis (≥ 80)</option>
          <option value="RISK">Poin Perlu Perhatian (20-79)</option>
          <option value="SAFE">Poin Aman (0-19)</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <SortableHeader label="Siswa & Kelas" sortKey="name" />
                <SortableHeader label="Pelanggaran" sortKey="violation" align="center" />
                <SortableHeader label="Penghargaan" sortKey="achievement" align="center" />
                <SortableHeader label="Status Pembinaan" sortKey="status" />
                <SortableHeader label="Sanksi Aktif" sortKey="sanction" />
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedStudents.map(student => {
                const info = getStudentInfo(student.id);
                const className = classes.find(c => c.id === student.classId)?.name || '-';
                
                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{student.name}</div>
                      <div className="text-xs text-slate-500">NIS: {student.nis} • {className}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${info.effectiveViolationScore >= 20 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {info.effectiveViolationScore}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                          {info.achievementPoints}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${info.statusColor}`}>
                         {info.statusLabel}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       {info.activeSanction ? (
                         <span className="flex items-center gap-1.5 font-bold text-red-600">
                            <ShieldAlert className="h-4 w-4" /> {info.activeSanction.level}
                         </span>
                       ) : (
                         <span className="text-slate-400 italic text-xs">Tidak Ada</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Link 
                        to={`/teacher/student/${student.id}`}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg inline-flex items-center"
                       >
                         Detail <ArrowUpRight className="h-4 w-4 ml-1" />
                       </Link>
                    </td>
                  </tr>
                )
              })}
              {sortedStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                    Tidak ada siswa yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KesiswaanMonitoring;
