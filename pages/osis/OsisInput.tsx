
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Student, Role, MasterIncidentType, IncidentRecord, IncidentTypeCategory, ClassGroup } from '../../types';
import { Search, Clock, Save, CheckCircle2, User, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OsisInput: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [lateIncidents, setLateIncidents] = useState<MasterIncidentType[]>([]);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user || (!user.roles.includes(Role.OSIS) && !user.roles.includes(Role.ADMIN))) {
      navigate('/');
      return;
    }
    setCurrentUser(user);
    loadData();
  }, [navigate]);

  const loadData = () => {
    setStudents(DataService.getStudents());
    setClasses(DataService.getClasses());
    const incidents = DataService.getIncidentTypes();
    
    // Filter hanya kejadian "Terlambat"
    const lateTypes = incidents.filter(i => 
      i.name.toLowerCase().includes('terlambat') && i.type === IncidentTypeCategory.VIOLATION
    );
    setLateIncidents(lateTypes);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term.length > 2) {
      const results = students.filter(s => 
        s.name.toLowerCase().includes(term.toLowerCase()) || 
        s.nis.includes(term)
      );
      setSearchResults(results.slice(0, 5)); // Limit 5 results
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedIncidentId(null);
  };

  const handleSubmit = () => {
    if (!selectedStudent || !selectedIncidentId || !currentUser) return;
    
    setIsSubmitting(true);
    
    const incidentDef = lateIncidents.find(i => i.id === selectedIncidentId);
    if (!incidentDef) return;

    const newRecord: IncidentRecord = {
        id: `rec_osis_${Date.now()}`,
        studentId: selectedStudent.id,
        incidentTypeId: selectedIncidentId,
        date: new Date().toISOString(),
        notes: "Dicatat oleh Petugas Gerbang (OSIS)",
        recordedBy: currentUser.name,
        pointSnapshot: incidentDef.points,
        typeSnapshot: IncidentTypeCategory.VIOLATION,
        status: 'PENDING' // WAJIB PENDING
    };

    const allRecords = DataService.getRecords();
    DataService.saveRecords([...allRecords, newRecord]);

    setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMsg(`Laporan keterlambatan ${selectedStudent.name} berhasil dikirim.`);
        setSelectedStudent(null);
        setSelectedIncidentId(null);
        setTimeout(() => setSuccessMsg(''), 3000);
    }, 800);
  };

  const studentClass = selectedStudent ? classes.find(c => c.id === selectedStudent.classId)?.name : '';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
       <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Clock className="h-6 w-6 text-indigo-600" />
             Input Keterlambatan
          </h1>
          <p className="text-slate-500">
             Halo, <b>{currentUser?.name}</b>. Silakan catat siswa yang datang terlambat.
          </p>
       </div>

       {successMsg && (
          <div className="bg-emerald-100 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3 animate-fade-in shadow-sm">
             <CheckCircle2 className="h-6 w-6 shrink-0" />
             <span className="font-bold">{successMsg}</span>
          </div>
       )}

       {/* CARD 1: CARI SISWA */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-2">Cari Siswa Terlambat</label>
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
             <input 
               type="text" 
               className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
               placeholder="Ketik Nama atau NIS siswa..."
               value={searchTerm}
               onChange={handleSearch}
               autoFocus
             />
             {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-20">
                   {searchResults.map(s => {
                      const cName = classes.find(c => c.id === s.classId)?.name || '';
                      return (
                        <button 
                          key={s.id}
                          onClick={() => handleSelectStudent(s)}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 flex justify-between items-center border-b border-slate-50 last:border-0"
                        >
                           <div>
                              <p className="font-bold text-slate-800">{s.name}</p>
                              <p className="text-xs text-slate-500">{s.nis} • {cName}</p>
                           </div>
                           <ChevronRight className="h-4 w-4 text-slate-300" />
                        </button>
                      )
                   })}
                </div>
             )}
          </div>
       </div>

       {/* CARD 2: FORM DETAIL (Muncul setelah siswa dipilih) */}
       {selectedStudent && (
          <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-fade-in">
             <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                      <User className="h-5 w-5" />
                   </div>
                   <div>
                      <p className="font-bold text-slate-800">{selectedStudent.name}</p>
                      <p className="text-xs text-slate-500">{selectedStudent.nis} • {studentClass}</p>
                   </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-xs font-bold text-slate-400 hover:text-red-500">
                   Ganti
                </button>
             </div>

             <div className="p-6 space-y-4">
                <p className="text-sm font-bold text-slate-700">Pilih Jenis Keterlambatan:</p>
                <div className="grid grid-cols-1 gap-3">
                   {lateIncidents.map(inc => (
                      <label 
                        key={inc.id}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                           selectedIncidentId === inc.id 
                           ? 'border-indigo-600 bg-indigo-50' 
                           : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                         <div className="flex items-center gap-3">
                            <input 
                              type="radio" 
                              name="late_type" 
                              className="w-5 h-5 text-indigo-600"
                              checked={selectedIncidentId === inc.id}
                              onChange={() => setSelectedIncidentId(inc.id)}
                            />
                            <span className={`font-medium ${selectedIncidentId === inc.id ? 'text-indigo-900' : 'text-slate-600'}`}>
                               {inc.name}
                            </span>
                         </div>
                         <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                            {inc.points} Poin
                         </span>
                      </label>
                   ))}
                   {lateIncidents.length === 0 && (
                      <p className="text-red-500 text-sm italic">Tidak ada data pelanggaran 'Terlambat' di sistem.</p>
                   )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                   <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-800 mb-4 flex items-start gap-2">
                      <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>
                         Laporan ini akan berstatus <b>PENDING</b>. Poin baru akan masuk setelah disetujui oleh Wali Kelas ybs.
                      </p>
                   </div>

                   <button 
                     onClick={handleSubmit}
                     disabled={isSubmitting || !selectedIncidentId}
                     className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-transform active:scale-95"
                   >
                      {isSubmitting ? 'Mengirim...' : 'Kirim Laporan'} <Save className="h-5 w-5" />
                   </button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

export default OsisInput;
