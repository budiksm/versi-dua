import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { Student, ClassGroup, CoachingRule } from '../../types';
import { Search, ArrowLeft, AlertCircle } from 'lucide-react';

const StudentList: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [classInfo, setClassInfo] = useState<ClassGroup | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [rules, setRules] = useState<CoachingRule[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    const allStudents = DataService.getStudents();
    const allClasses = DataService.getClasses();
    setRules(DataService.getRules());
    setRecords(DataService.getRecords());
    setIncidents(DataService.getIncidentTypes());

    setClassInfo(allClasses.find((c: any) => c.id === classId) || null);
    setStudents(allStudents.filter((s: any) => s.classId === classId));
  }, [classId]);

  const getStudentStatus = (studentId: string) => {
    const stats = DataService.calculateStudentPoints(studentId, records, incidents);
    const status = DataService.getCoachingStatus(stats.effectiveViolationScore, rules);
    return { ...stats, statusLabel: status.statusLabel, statusColor: status.color };
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    student.nis.includes(searchTerm)
  );

  if (!classInfo) return <div>Kelas tidak ditemukan</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/teacher/classes" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kelas {classInfo.name}</h1>
          <p className="text-slate-500">{students.length} Siswa Terdaftar</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Cari nama atau NIS siswa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Nama Siswa</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-center">Poin Pelanggaran</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-center">Poin Penghargaan</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Status Pembinaan</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => {
                const info = getStudentStatus(student.id);
                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{student.name}</div>
                      <div className="text-xs text-slate-500">NIS: {student.nis}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${info.effectiveViolationScore > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {info.effectiveViolationScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${info.achievementPoints > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {info.achievementPoints}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${info.statusColor}`}>
                        {info.effectiveViolationScore > 20 && <AlertCircle className="h-3 w-3" />}
                        {info.statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/teacher/student/${student.id}`}
                        className="inline-flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-sm font-medium"
                      >
                        Buka Profil
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada siswa ditemukan.
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

export default StudentList;