
import React, { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { Student, Role, MasterIncidentType, IncidentRecord, IncidentTypeCategory, ClassGroup } from '../../types';
import { Search, Clock, Save, CheckCircle2, User, ChevronRight, X, ShieldAlert, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'SEARCH' | 'LIST';

const StudentInput: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [myClass, setMyClass] = useState<ClassGroup | null>(null);
  const [allowedIncidents, setAllowedIncidents] = useState<MasterIncidentType[]>([]);
  
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('SEARCH');
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  
  // Form State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const user = DataService.getCurrentUser();
    if (!user || (!user.roles.includes(Role.STUDENT) && !user.roles.includes(Role.ADMIN))) {
      navigate('/');
      return;
    }
    setCurrentUser(user);
    
    // Check assigned class
    if (user.roles.includes(Role.STUDENT) && !user.assignedClassId) {
        alert("Akun Anda belum dihubungkan ke kelas manapun. Hubungi Admin.");
        navigate('/teacher/poe-ibu');
        return;
    }

    loadData(user);
  }, [navigate]);

  const loadData = (user: any) => {
    const allStudents = DataService.getStudents();
    const allClasses = DataService.getClasses();
    const incidents = DataService.getIncidentTypes();
    
    // 1. Filter students: Only my class
    const myClassId = user.assignedClassId;
    const myClassData = allClasses.find(c => c.id === myClassId) || null;
    setMyClass(myClassData);

    const classStudents = allStudents.filter(s => s.classId === myClassId);
    classStudents.sort((a,b) => a.name.localeCompare(b.name));
    setStudents(classStudents);

    // 2. Filter incidents: Specific list for Student Representative
    const targetIncidents = [
        'Tidak masuk tanpa keterangan',
        'Membolos satu jam pelajaran',
        'Membolos seharian',
        'Tidak mengikuti kegiatan wajib sekolah'
    ];

    const filteredIncidents = incidents.filter(i => 
      targetIncidents.some(target => i.name.toLowerCase().includes(target.toLowerCase())) && 
      i.type === IncidentTypeCategory.VIOLATION
    );
    setAllowedIncidents(filteredIncidents);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (term) {
      const lowerTerm = term.toLowerCase();
      const results = students.filter(s => 
        s.name.toLowerCase().includes(lowerTerm) || 
        s.nis.includes(term)
      );
      setSearchResults(results.slice(0, 8)); 
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
    
    const incidentDef = allowedIncidents.find(i => i.id === selectedIncidentId);
    if (!incidentDef) return;

    const newRecord: IncidentRecord = {
        id: `rec_stud_${Date.now()}`,
        studentId: selectedStudent.id,
        incidentTypeId: selectedIncidentId,
        date: new Date().toISOString(),
        notes: "Dicatat oleh Perwakilan Kelas (Siswa)",
        recordedBy: currentUser.name,
        pointSnapshot: incidentDef.points,
        typeSnapshot: IncidentTypeCategory.VIOLATION,
        status: 'PENDING' // WAJIB PENDING
    };

    const allRecords = DataService.getRecords();
    DataService.saveRecords([...allRecords, newRecord]);

    setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMsg(`Laporan ${incidentDef.name} untuk ${selectedStudent.name} berhasil dikirim.`);
        setSelectedStudent(null);
        setSelectedIncidentId(null);
        setViewMode('SEARCH'); 
        setTimeout(() => setSuccessMsg(''), 3000);
    }, 800);
  };

  if (!myClass) {
      return <div className="p-8 text-center text-slate-500">Memuat data kelas...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-fade-in">
       <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <ShieldAlert className="h-6 w-6 text-indigo-600" />
             Lapor Pelanggaran Kelas
          </h1>
          <p className="text-slate-500">
             Kelas: <b>{myClass.name}</b>. Catat teman yang melanggar aturan kedisiplinan.
          </p>
       </div>

       {successMsg && (
          <div className="bg-emerald-100 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3 animate-fade-in shadow-sm">
             <CheckCircle2 className="h-6 w-6 shrink-0" />
             <span className="font-bold">{successMsg}</span>
          </div>
       )}

       {/* --- MODE SELECTION --- */}
       {!selectedStudent && (
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-100">
               <button 
                 onClick={() => setViewMode('SEARCH')}
                 className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${viewMode === 'SEARCH' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
               >
                  <Search className="h-4 w-4" /> Cari Teman
               </button>
               <button 
                 onClick={() => setViewMode('LIST')}
                 className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${viewMode === 'LIST' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
               >
                  <Users className="h-4 w-4" /> Daftar Siswa ({students.length})
               </button>
            </div>

            <div className="p-6">
               {/* VIEW 1: SEARCH */}
               {viewMode === 'SEARCH' && (
                  <div className="relative">
                     <label className="block text-sm font-bold text-slate-700 mb-2">Cari Nama</label>
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input 
                           type="text" 
                           className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                           placeholder="Ketik nama teman..."
                           value={searchTerm}
                           onChange={handleSearch}
                           autoFocus
                        />
                        {searchTerm && (
                           <button 
                             onClick={() => { setSearchTerm(''); setSearchResults([]); }}
                             className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                           >
                              <X className="h-5 w-5" />
                           </button>
                        )}
                     </div>

                     {/* Search Results */}
                     {searchResults.length > 0 ? (
                        <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
                           {searchResults.map(s => (
                              <button 
                                 key={s.id}
                                 onClick={() => handleSelectStudent(s)}
                                 className="w-full text-left px-4 py-3 bg-white hover:bg-indigo-50 flex justify-between items-center border-b border-slate-100 last:border-0 transition-colors"
                              >
                                 <div>
                                    <p className="font-bold text-slate-800">{s.name}</p>
                                    <p className="text-xs text-slate-500">{s.nis}</p>
                                 </div>
                                 <ChevronRight className="h-4 w-4 text-slate-300" />
                              </button>
                           ))}
                        </div>
                     ) : searchTerm && (
                        <div className="mt-4 text-center text-slate-500 text-sm py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                           Tidak ditemukan siswa dengan kata kunci "{searchTerm}".
                        </div>
                     )}
                  </div>
               )}

               {/* VIEW 2: LIST */}
               {viewMode === 'LIST' && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                     {students.map(s => (
                        <button 
                           key={s.id}
                           onClick={() => handleSelectStudent(s)}
                           className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left group transition-all"
                        >
                           <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:text-indigo-600">
                              <User className="h-4 w-4" />
                           </div>
                           <div className="flex-1">
                              <p className="font-bold text-slate-800 text-sm">{s.name}</p>
                              <p className="text-xs text-slate-500">{s.nis}</p>
                           </div>
                           <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600" />
                        </button>
                     ))}
                     {students.length === 0 && (
                        <p className="text-center text-slate-500 italic py-4">Belum ada siswa di kelas ini.</p>
                     )}
                  </div>
               )}
            </div>
         </div>
       )}

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
                      <p className="text-xs text-slate-500">{selectedStudent.nis}</p>
                   </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1">
                   <X className="h-4 w-4" /> Batal
                </button>
             </div>

             <div className="p-6 space-y-4">
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-sm text-orange-800 flex items-start gap-2">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <p className="text-xs">
                        Anda hanya diperbolehkan melaporkan pelanggaran berikut. 
                        Laporan palsu akan dikenakan sanksi.
                    </p>
                </div>

                <p className="text-sm font-bold text-slate-700">Pilih Jenis Pelanggaran:</p>
                <div className="grid grid-cols-1 gap-3">
                   {allowedIncidents.map(inc => (
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
                              name="violation_type" 
                              className="w-5 h-5 text-indigo-600"
                              checked={selectedIncidentId === inc.id}
                              onChange={() => setSelectedIncidentId(inc.id)}
                            />
                            <span className={`font-medium text-sm ${selectedIncidentId === inc.id ? 'text-indigo-900' : 'text-slate-600'}`}>
                               {inc.name}
                            </span>
                         </div>
                         <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-500 whitespace-nowrap">
                            {inc.points} Poin
                         </span>
                      </label>
                   ))}
                   {allowedIncidents.length === 0 && (
                      <p className="text-red-500 text-sm italic">Konfigurasi jenis pelanggaran belum tersedia.</p>
                   )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                   <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-800 mb-4 flex items-start gap-2">
                      <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>
                         Laporan ini akan berstatus <b>PENDING</b>. Poin baru akan masuk setelah disetujui oleh Wali Kelas.
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

export default StudentInput;
