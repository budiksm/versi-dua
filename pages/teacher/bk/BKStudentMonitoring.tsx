
import React, { useEffect, useState } from 'react';
import { DataService } from '../../../services/dataService';
import { Student, ClassGroup, CoachingRule, IncidentRecord, MasterIncidentType, Role } from '../../../types';
import { Search, ArrowUpRight, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type SortKey = 'name' | 'violation' | 'status';
type SortDirection = 'asc' | 'desc';

const BKStudentMonitoring: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [rules, setRules] = useState<CoachingRule[]>([]);
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [incidents, setIncidents] = useState<MasterIncidentType[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [pointFilter, setPointFilter] = useState('ALL');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'violation', // Default sort by violation points
    direction: 'desc' // Highest points first
  });

  const navigate = useNavigate();

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user?.roles.includes(Role.BK)) {
      navigate('/teacher/dashboard');
      return;
    }

    setStudents(DataService.getStudents());
    setClasses(DataService.getClasses());
    setRules(DataService.getRules());
    setRecords(DataService.getRecords());
    setIncidents(DataService.getIncidentTypes());
  }, []);

  const getStudentInfo = (studentId: string) => {
    const stats = DataService.calculateStudentPoints(studentId, records, incidents);
    const status = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
    return { ...stats, statusLabel: status.statusLabel, statusColor: status.color };
  };

  // --- SORTING HELPERS ---
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
    
    let matchesPoints = true;
    if (pointFilter === 'HIGH') matchesPoints = info.effectiveViolationScore >= 40;
    else if (pointFilter === 'MEDIUM') matchesPoints = info.effectiveViolationScore >= 20 && info.effectiveViolationScore < 40;
    else if (pointFilter === 'LOW') matchesPoints = info.effectiveViolationScore < 20;

    return matchesSearch && matchesClass && matchesPoints;
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
      case 'status':
        return infoA.statusLabel.localeCompare(infoB.statusLabel) * direction;
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Monitoring Seluruh Siswa (BK)</h1>
        <p className="text-slate-500">Pantau poin seluruh siswa untuk deteksi dini masalah.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari Nama / NIS..."
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
          value={pointFilter}
          onChange={(e) => setPointFilter(e.target.value)}
        >
          <option value="ALL">Semua Tingkat Poin</option>
          <option value="HIGH">Risiko Tinggi (≥ 40)</option>
          <option value="MEDIUM">Perlu Perhatian (20-39)</option>
          <option value="LOW">Aman (&lt; 20)</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <SortableHeader label="Siswa & Kelas" sortKey="name" />
                <SortableHeader label="Poin Pelanggaran" sortKey="violation" align="center" />
                <SortableHeader label="Status" sortKey="status" />
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
                       <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${info.effectiveViolationScore >= 40 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {info.effectiveViolationScore}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${info.statusColor}`}>
                         {info.statusLabel}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Link 
                        to={`/teacher/student/${student.id}`}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg inline-flex items-center text-xs font-bold"
                       >
                         Lihat Profil <ArrowUpRight className="h-4 w-4 ml-1" />
                       </Link>
                    </td>
                  </tr>
                )
              })}
              {sortedStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
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

export default BKStudentMonitoring;
