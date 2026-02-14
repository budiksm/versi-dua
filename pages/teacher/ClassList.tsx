import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataService } from '../../services/dataService';
import { ClassGroup, Student } from '../../types';
import { Users, ChevronRight, Search, Filter, User, GraduationCap, X } from 'lucide-react';

const ClassList: React.FC = () => {
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  
  // States for Search & Filter
  const [selectedLevel, setSelectedLevel] = useState<number | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const cls = DataService.getClasses();
    const std = DataService.getStudents();
    
    // Calculate student counts per class
    const counts: Record<string, number> = {};
    cls.forEach(c => {
      counts[c.id] = std.filter((s: any) => s.classId === c.id).length;
    });

    setAllClasses(cls.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
    setAllStudents(std);
    setStudentCounts(counts);
  }, []);

  // Filter Logic
  const filteredClasses = allClasses.filter(c => 
    selectedLevel === 'ALL' ? true : c.level === selectedLevel
  );

  const searchedStudents = searchTerm.trim() === '' ? [] : allStudents.filter(s => {
    const studentClass = allClasses.find(c => c.id === s.classId);
    const matchesLevel = selectedLevel === 'ALL' ? true : studentClass?.level === selectedLevel;
    const matchesName = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLevel && matchesName;
  });

  const isSearching = searchTerm.trim() !== '';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Daftar Kelas & Siswa</h1>
          <p className="text-slate-500">Gunakan filter tingkat untuk mencari siswa lebih cepat.</p>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Pilih Tingkat:</span>
           {[ 'ALL', 10, 11, 12 ].map((level) => (
             <button
                key={level}
                onClick={() => setSelectedLevel(level as any)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  selectedLevel === level 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
             >
                {level === 'ALL' ? 'Semua' : `Kelas ${level}`}
             </button>
           ))}
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          </div>
          <input 
            type="text"
            placeholder={selectedLevel === 'ALL' ? "Cari nama siswa di semua tingkat..." : `Cari nama siswa di Tingkat ${selectedLevel}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-700 font-medium"
          />
          {isSearching && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-red-500"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* RESULTS AREA */}
      <div className="mt-8">
        {isSearching ? (
          /* SEARCH RESULTS VIEW */
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <User className="h-5 w-5 text-indigo-600" />
                   Hasil Pencarian Siswa
                   <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">{searchedStudents.length}</span>
                </h2>
             </div>
             
             {searchedStudents.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {searchedStudents.map(student => {
                   const studentClass = allClasses.find(c => c.id === student.classId);
                   return (
                     <Link 
                       key={student.id}
                       to={`/teacher/student/${student.id}`}
                       className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group"
                     >
                       <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <User className="h-6 w-6" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{student.name}</p>
                          <p className="text-xs text-slate-500 truncate">NIS: {student.nis} • {studentClass?.name || '-'}</p>
                       </div>
                       <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600" />
                     </Link>
                   );
                 })}
               </div>
             ) : (
               <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center bg-slate-50 rounded-full mb-4">
                    <Search className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">Tidak ada siswa bernama "{searchTerm}" di tingkat ini.</p>
                  <button onClick={() => setSearchTerm('')} className="mt-2 text-indigo-600 text-sm font-bold hover:underline">Lihat Semua Kelas</button>
               </div>
             )}
          </div>
        ) : (
          /* CLASS GRID VIEW (Original but level-filtered) */
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <GraduationCap className="h-5 w-5 text-indigo-600" />
               Daftar Kelas {selectedLevel !== 'ALL' && `Tingkat ${selectedLevel}`}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((cls) => (
                <Link 
                  key={cls.id} 
                  to={`/teacher/classes/${cls.id}`}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  {/* Decorative background badge */}
                  <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 bg-indigo-50 rounded-full opacity-50 group-hover:bg-indigo-600 transition-colors duration-300"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-white transition-colors">
                        <Users className="h-6 w-6" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full uppercase tracking-tighter">
                        {studentCounts[cls.id] || 0} Siswa
                      </span>
                    </div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Tingkat {cls.level}</p>
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{cls.name}</h3>
                    <div className="mt-6 flex items-center text-sm text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      Kelola Kelas <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {filteredClasses.length === 0 && (
              <div className="p-12 text-center text-slate-500 italic bg-slate-50 rounded-2xl border border-slate-200">
                Belum ada data kelas untuk tingkat ini.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassList;