
import { 
  Student, 
  ClassGroup, 
  MasterCategory, 
  MasterIncidentType, 
  IncidentRecord, 
  CoachingRule,
  IncidentTypeCategory, 
  Teacher, 
  Role, 
  CounselingSession, 
  StudentSanction, 
  RedemptionStatus,
  SanctionLevel,
  IncidentStatus,
  CashflowRecord,
  CashflowStatus,
  ActivityLog
} from '../types';

import { db, connectToFirebase } from '../firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// --- SYNC STATUS MANAGEMENT ---
export type SyncState = 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR';
let currentSyncState: SyncState = 'IDLE';
let lastSyncTime: Date | null = null;
let lastError: string | null = null;
let syncListeners: ((state: SyncState, time: Date | null, error: string | null) => void)[] = [];

// --- DATA CHANGE LISTENERS (REALTIME) ---
let dataChangeListeners: (() => void)[] = [];

// Flag to ensure we don't overwrite cloud data with mock data during init
let isInitializedFromCloud = false;

const notifyListeners = (state: SyncState, errorMsg: string | null = null) => {
  currentSyncState = state;
  lastError = errorMsg;
  if (state === 'SAVED') {
    lastSyncTime = new Date();
    lastError = null;
  }
  syncListeners.forEach(l => l(state, lastSyncTime, lastError));
};

const notifyDataChange = () => {
  dataChangeListeners.forEach(cb => cb());
};

// --- INITIAL MOCK DATA ---
const INITIAL_TEACHERS: Teacher[] = [
  { id: 'admin1', name: 'Administrator', nip: '000000', roles: [Role.ADMIN], username: 'admin', password: '123', mustChangePassword: false },
  { id: 't1', name: 'Budi Raharjo, S.Pd', nip: '19800101', roles: [Role.TEACHER, Role.WALIKELAS], username: 'budi', password: '123', mustChangePassword: false },
  // MOCK BENDAHARA (SISWA)
  { id: 's_bendahara', name: 'Siti Aminah (Bendahara)', nip: '1001', roles: [Role.STUDENT], username: 'siti', password: '123', mustChangePassword: false, assignedClassId: 'c1' },
  // MOCK OSIS (PETUGAS GERBANG)
  { id: 'osis_gate', name: 'Petugas OSIS (Gerbang)', nip: 'OSIS001', roles: [Role.OSIS], username: 'osis', password: '123', mustChangePassword: false },
];
const INITIAL_CLASSES: ClassGroup[] = [{ id: 'c1', name: 'X IPA 1', level: 10, homeroomTeacherId: 't1' }];
const INITIAL_STUDENTS: Student[] = [{ id: 's1', name: 'Contoh Siswa', nis: '1001', classId: 'c1', gender: 'L', status: 'ACTIVE' }];
const INITIAL_CATEGORIES: MasterCategory[] = [
  { id: 'cat1', name: 'Kedisiplinan', targetType: IncidentTypeCategory.VIOLATION },
  { id: 'cat5', name: 'Prestasi', targetType: IncidentTypeCategory.ACHIEVEMENT },
  { id: 'cat6', name: 'Penebusan', targetType: IncidentTypeCategory.REDEMPTION },
];
const INITIAL_INCIDENTS: MasterIncidentType[] = [
  { id: 'inc1', name: 'Terlambat', categoryId: 'cat1', type: IncidentTypeCategory.VIOLATION, points: 3, severity: 'LOW', isActive: true },
  { id: 'inc2', name: 'Terlambat Berulang (>3 kali)', categoryId: 'cat1', type: IncidentTypeCategory.VIOLATION, points: 8, severity: 'MEDIUM', isActive: true },
  // JENIS PELANGGARAN KHUSUS INPUT SISWA/PERWAKILAN KELAS
  { id: 'inc_alpha', name: 'Tidak masuk tanpa keterangan', categoryId: 'cat1', type: IncidentTypeCategory.VIOLATION, points: 10, severity: 'MEDIUM', isActive: true },
  { id: 'inc_bolos_jam', name: 'Membolos satu jam pelajaran', categoryId: 'cat1', type: IncidentTypeCategory.VIOLATION, points: 5, severity: 'LOW', isActive: true },
  { id: 'inc_bolos_hari', name: 'Membolos seharian', categoryId: 'cat1', type: IncidentTypeCategory.VIOLATION, points: 20, severity: 'HIGH', isActive: true },
  { id: 'inc_skip_event', name: 'Tidak mengikuti kegiatan wajib sekolah', categoryId: 'cat1', type: IncidentTypeCategory.VIOLATION, points: 5, severity: 'LOW', isActive: true },
];

// REVISI ATURAN POIN (HIRARKI UPDATE SP3 & DO)
const INITIAL_RULES: CoachingRule[] = [
  { id: 'r1', minPoints: 0, maxPoints: 19, statusLabel: 'Normal', color: 'bg-green-100 text-green-800' },
  { id: 'r2', minPoints: 20, maxPoints: 39, statusLabel: 'Pembinaan Wali Kelas', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'r3', minPoints: 40, maxPoints: 79, statusLabel: 'Pembinaan BK + Ortu', color: 'bg-orange-100 text-orange-800' },
  { id: 'r4', minPoints: 80, maxPoints: 119, statusLabel: 'SP 1', color: 'bg-red-100 text-red-800' },
  { id: 'r5', minPoints: 120, maxPoints: 159, statusLabel: 'SP 2', color: 'bg-red-200 text-red-900' },
  { id: 'r6', minPoints: 160, maxPoints: 200, statusLabel: 'SP 3 (Perjanjian Terakhir)', color: 'bg-red-600 text-white' },
  { id: 'r7', minPoints: 201, maxPoints: 9999, statusLabel: 'DO (Dikembalikan ke Ortu)', color: 'bg-slate-900 text-white border-2 border-red-500' },
];

// Helper for LocalStorage
const loadFromStorage = <T,>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : initial;
};

const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Helper for Firestore Sync
const syncToCloud = async (collectionName: string, data: any) => {
  if (!db) return; 
  
  // SAFETY CHECK: Jangan sync jika kita belum pernah load dari cloud
  // Ini mencegah Mock Data menimpa Real Data saat browser di-reset.
  if (!isInitializedFromCloud) {
      console.warn(`[Cloud] Sync blocked for ${collectionName}. Data not yet loaded from cloud.`);
      return;
  }
  
  notifyListeners('SYNCING');
  try {
    const cleanData = JSON.parse(JSON.stringify(data)); 
    await setDoc(doc(db, "school_data", collectionName), { data: cleanData });
    notifyListeners('SAVED');
    console.log(`[Cloud] Synced ${collectionName} successfully.`);
  } catch (error: any) {
    console.error(`[Cloud] Failed to sync ${collectionName}:`, error);
    
    let errorMsg = error.message || "Unknown error";
    if (error.code === 'permission-denied') {
        errorMsg = "IZIN DITOLAK. Cek Rules & Anonymous Auth.";
    } else if (error.code === 'resource-exhausted') {
        errorMsg = "Dokumen terlalu besar (>1MB).";
    } else if (error.code === 'unavailable') {
        errorMsg = "Koneksi ke server Firestore gagal (Offline).";
    }
    
    notifyListeners('ERROR', errorMsg);
  }
};

export const DataService = {
  // --- REALTIME SUBSCRIPTION ---
  subscribeToDataChanges: (callback: () => void) => {
    dataChangeListeners.push(callback);
    return () => { dataChangeListeners = dataChangeListeners.filter(cb => cb !== callback); };
  },

  startRealtimeListeners: () => {
    if (!db) return;
    const collections = [
        'classes', 'students', 'categories', 'incidentTypes', 
        'rules', 'records', 'teachers', 'counseling', 'sanctions',
        'cashflow', 'activity_logs'
    ];

    console.log("📡 Starting Real-time Listeners...");

    collections.forEach(colName => {
        onSnapshot(doc(db, "school_data", colName), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data().data;
                
                // Cek apakah data berbeda dengan localstorage untuk menghindari loop/refresh berlebih
                const currentLocal = localStorage.getItem(colName);
                const stringifiedData = JSON.stringify(data);
                
                if (currentLocal !== stringifiedData) {
                    console.log(`🔄 [Realtime] New data received for: ${colName}`);
                    saveToStorage(colName, data);
                    notifyDataChange(); // Beritahu komponen React untuk re-render
                }
                
                // Mark as initialized once we get data
                isInitializedFromCloud = true;
            } else {
                console.log(`⚠️ [Realtime] Collection ${colName} is empty on server.`);
                // If document doesn't exist on server, we might be starting fresh or wiped.
                // In this case, we allow local data to take precedence after a short delay
                if (!isInitializedFromCloud) isInitializedFromCloud = true; 
            }
        }, (error) => {
            console.error(`Error listening to ${colName}:`, error);
        });
    });
  },

  // --- SYNC SUBSCRIPTION ---
  subscribeToSync: (callback: (state: SyncState, time: Date | null, error: string | null) => void) => {
    syncListeners.push(callback);
    callback(currentSyncState, lastSyncTime, lastError);
    return () => { syncListeners = syncListeners.filter(l => l !== callback); };
  },

  // --- INITIALIZATION ---
  initializeData: async (): Promise<boolean> => {
    if (!db) {
        console.warn("DB not initialized, running offline.");
        return false;
    }

    const isAuthSuccess = await connectToFirebase();
    if (!isAuthSuccess) {
       notifyListeners('ERROR', "Gagal Login Sistem (Anonymous Auth Failed)");
       return false;
    }

    // FORCE PULL: Tarik data sekali di awal untuk memastikan LocalStorage sinkron
    // sebelum UI dirender sepenuhnya.
    const collections = [
        'teachers', 'students', 'classes', 'records', 'counseling', 
        'sanctions', 'categories', 'incidentTypes', 'rules', 'cashflow'
    ];

    console.log("⬇️ [Init] Force pulling data from Cloud...");
    try {
        await Promise.all(collections.map(async (col) => {
            const snap = await getDoc(doc(db, "school_data", col));
            if (snap.exists()) {
                const remoteData = snap.data().data;
                if (remoteData) {
                    saveToStorage(col, remoteData);
                }
            }
        }));
        console.log("✅ [Init] Data synchronized.");
        isInitializedFromCloud = true; // Izinkan sync kembali
    } catch (e) {
        console.error("❌ [Init] Failed to pull initial data:", e);
    }

    // Start Listeners immediately after auth
    DataService.startRealtimeListeners();

    return true; 
  },

  // --- GETTERS ---
  getClasses: () => loadFromStorage<ClassGroup[]>('classes', INITIAL_CLASSES),
  getStudents: () => loadFromStorage<Student[]>('students', INITIAL_STUDENTS),
  getCategories: () => loadFromStorage<MasterCategory[]>('categories', INITIAL_CATEGORIES),
  getIncidentTypes: () => loadFromStorage<MasterIncidentType[]>('incidentTypes', INITIAL_INCIDENTS),
  getRules: () => loadFromStorage<CoachingRule[]>('rules', INITIAL_RULES),
  getRecords: () => loadFromStorage<IncidentRecord[]>('records', []),
  getCounselingSessions: () => loadFromStorage<CounselingSession[]>('counseling', []),
  getSanctions: () => loadFromStorage<StudentSanction[]>('sanctions', []),
  getCashflows: () => loadFromStorage<CashflowRecord[]>('cashflow', []),
  getActivityLogs: () => loadFromStorage<ActivityLog[]>('activity_logs', []),

  getTeachers: (): Teacher[] => {
    let teachers = loadFromStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    let needsUpdate = false;
    const migrated = teachers.map((t: any) => {
      let updated = false;
      if (!t.roles && t.role) { t.roles = [t.role]; updated = true; }
      if (t.mustChangePassword === undefined) { t.mustChangePassword = false; updated = true; }
      if (updated) needsUpdate = true;
      return t;
    });
    
    if (needsUpdate) {
      // FIX: HANYA SIMPAN KE LOCAL, JANGAN SYNC KE CLOUD DULU
      // Ini mencegah overwrite data cloud dengan mock data saat migrasi struktur
      saveToStorage('teachers', migrated);
      // syncToCloud('teachers', migrated); // <--- REMOVED DANGEROUS SYNC
    }
    return migrated;
  },

  // --- SETTERS ---
  saveClasses: (data: ClassGroup[]) => { saveToStorage('classes', data); syncToCloud('classes', data); },
  saveStudents: (data: Student[]) => { saveToStorage('students', data); syncToCloud('students', data); },
  saveCategories: (data: MasterCategory[]) => { saveToStorage('categories', data); syncToCloud('categories', data); },
  saveIncidentTypes: (data: MasterIncidentType[]) => { saveToStorage('incidentTypes', data); syncToCloud('incidentTypes', data); },
  saveRules: (data: CoachingRule[]) => { saveToStorage('rules', data); syncToCloud('rules', data); },
  saveRecords: (data: IncidentRecord[]) => { saveToStorage('records', data); syncToCloud('records', data); },
  saveTeachers: (data: Teacher[]) => { saveToStorage('teachers', data); syncToCloud('teachers', data); },
  saveCounselingSessions: (data: CounselingSession[]) => { saveToStorage('counseling', data); syncToCloud('counseling', data); },
  saveSanctions: (data: StudentSanction[]) => { saveToStorage('sanctions', data); syncToCloud('sanctions', data); },
  saveCashflows: (data: CashflowRecord[]) => { saveToStorage('cashflow', data); syncToCloud('cashflow', data); },
  saveActivityLogs: (data: ActivityLog[]) => { saveToStorage('activity_logs', data); syncToCloud('activity_logs', data); },

  // --- ACTIVITY LOGGING & HEARTBEAT ---
  logActivity: (user: Teacher, action: 'LOGIN' | 'LOGOUT' | 'SYNC') => {
    const logs = DataService.getActivityLogs();
    const newLog: ActivityLog = {
      id: `log_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      role: user.roles.join(', '),
      action,
      timestamp: new Date().toISOString(),
      deviceInfo: navigator.userAgent
    };
    // Keep only last 500 logs to prevent bloat
    const updatedLogs = [newLog, ...logs].slice(0, 500);
    DataService.saveActivityLogs(updatedLogs);
  },

  updateHeartbeat: (userId: string) => {
    const teachers = DataService.getTeachers();
    const now = new Date().toISOString();
    let changed = false;
    
    const updatedTeachers = teachers.map(t => {
      if (t.id === userId) {
        // Only update if last active was > 1 min ago to reduce writes
        const last = t.lastActiveAt ? new Date(t.lastActiveAt).getTime() : 0;
        if (new Date().getTime() - last > 60000) {
           changed = true;
           return { ...t, lastActiveAt: now };
        }
      }
      return t;
    });

    if (changed) {
      DataService.saveTeachers(updatedTeachers);
    }
  },

  // --- CASHFLOW HELPER ---
  getClassBalance: (classId: string) => {
    const flows = DataService.getCashflows();
    const classFlows = flows.filter(f => f.classId === classId && f.status === 'APPROVED');
    
    let totalIn = 0;
    let totalOut = 0;

    classFlows.forEach(f => {
       if (f.type === 'IN') totalIn += f.amount;
       if (f.type === 'OUT') totalOut += f.amount;
    });

    return {
        balance: totalIn - totalOut,
        totalIn,
        totalOut,
        transactionCount: classFlows.length
    };
  },

  verifyCashflow: (recordId: string, verifierName: string, isRejected = false) => {
    const flows = DataService.getCashflows();
    const updatedFlows = flows.map(f => {
        if (f.id === recordId) {
            return {
                ...f,
                status: isRejected ? 'REJECTED' : 'APPROVED',
                verifiedBy: verifierName,
                verifiedDate: new Date().toISOString()
            } as CashflowRecord;
        }
        return f;
    });
    DataService.saveCashflows(updatedFlows);
  },

  voidCashflow: (recordId: string, user: Teacher) => {
    const flows = DataService.getCashflows();
    const updatedFlows = flows.map(f => {
        if (f.id === recordId) {
             return {
                 ...f,
                 status: 'CORRECTED',
                 description: f.description + ` [DIKOREKSI oleh ${user.name}]`
             } as CashflowRecord;
        }
        return f;
    });
    DataService.saveCashflows(updatedFlows);
  },

  // --- AUTH LOGIC (Aplikasi) ---
  login: (username: string, password: string): Teacher | null => {
    const teachers = DataService.getTeachers(); 
    let user = teachers.find(t => t.username === username && t.password === password);
    
    if (!user) {
        const defaultAdmin = INITIAL_TEACHERS.find(t => t.roles.includes(Role.ADMIN));
        if (defaultAdmin && username === defaultAdmin.username && password === defaultAdmin.password) {
            const existingAdminIndex = teachers.findIndex(t => t.roles.includes(Role.ADMIN));
            if (existingAdminIndex === -1) {
                const newTeachers = [...teachers, defaultAdmin];
                // HANYA LOCAL SAVE SAAT LOGIN ADMIN DEFAULT, JANGAN SYNC
                saveToStorage('teachers', newTeachers);
            }
            user = defaultAdmin;
        }
    }

    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      // CATAT LOG LOGIN
      DataService.logActivity(user, 'LOGIN');
      // UPDATE ONLINE STATUS SEGERA
      DataService.updateHeartbeat(user.id);
      return user;
    }
    return null;
  },

  logout: () => {
    const user = DataService.getCurrentUser();
    if(user) DataService.logActivity(user, 'LOGOUT');
    localStorage.removeItem('currentUser');
  },

  getCurrentUser: (): Teacher | null => {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  },

  updatePassword: (userId: string, newPass: string) => {
    const teachers = DataService.getTeachers();
    const updatedTeachers = teachers.map(t => {
      if (t.id === userId) {
        const updatedUser = { ...t, password: newPass, mustChangePassword: false };
        const currentUser = DataService.getCurrentUser();
        if (currentUser && currentUser.id === userId) {
             localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
        return updatedUser;
      }
      return t;
    });
    DataService.saveTeachers(updatedTeachers);
  },

  calculateStudentPoints: (studentId: string, records: IncidentRecord[], incidents: MasterIncidentType[]) => {
    const studentRecords = records.filter(r => r.studentId === studentId);
    let grossViolationPoints = 0;
    let achievementPoints = 0;
    let violationCount = 0;
    let achievementCount = 0;
    let redemptionCount = 0;

    const now = new Date().getTime();
    const AUTO_ACCEPT_MS = 2 * 24 * 60 * 60 * 1000; // 48 Hours

    studentRecords.forEach(record => {
      const recordTime = new Date(record.date).getTime();
      const isAutoAccepted = (record.status === 'PENDING') && ((now - recordTime) > AUTO_ACCEPT_MS);
      
      const effectiveStatus = record.status || 'APPROVED';
      const isEffective = effectiveStatus === 'APPROVED' || isAutoAccepted;

      if (isEffective) {
        if (record.typeSnapshot === IncidentTypeCategory.VIOLATION) {
          grossViolationPoints += record.pointSnapshot;
          violationCount++;
        } else if (record.typeSnapshot === IncidentTypeCategory.REDEMPTION) {
          redemptionCount++;
        } else if (record.typeSnapshot === IncidentTypeCategory.ACHIEVEMENT) {
          achievementPoints += record.pointSnapshot;
          achievementCount++;
        }
      }
    });

    let effectiveViolationScore = grossViolationPoints;
    return { effectiveViolationScore, grossViolationPoints, achievementPoints, violationCount, achievementCount, redemptionCount };
  },

  getCoachingStatus: (violationScore: number, rules: CoachingRule[]) => {
    const rule = rules.find(r => violationScore >= r.minPoints && violationScore <= r.maxPoints);
    return rule || { id: 'unknown', minPoints: 0, maxPoints: 0, statusLabel: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  },

  evaluateAndApplySanction: (studentId: string): SanctionLevel | null => {
    const records = DataService.getRecords();
    const incidents = DataService.getIncidentTypes();
    const sanctions = DataService.getSanctions();
    const stats = DataService.calculateStudentPoints(studentId, records, incidents);
    const score = stats.effectiveViolationScore;

    const studentSanctions = sanctions.filter(s => s.studentId === studentId && s.redemptionStatus !== RedemptionStatus.COMPLETED);
    
    const hasSP1 = studentSanctions.some(s => s.level === SanctionLevel.SP1);
    const hasSP2 = studentSanctions.some(s => s.level === SanctionLevel.SP2);
    const hasSP3 = studentSanctions.some(s => s.level === SanctionLevel.SP3);
    const hasDO = studentSanctions.some(s => s.level === SanctionLevel.DROP_OUT);

    let newLevel: SanctionLevel | null = null;

    if (score >= 160) {
       if (!hasSP3 && !hasDO) newLevel = SanctionLevel.SP3;
    }
    else if (score >= 120) {
        if (!hasSP2 && !hasSP3 && !hasDO) newLevel = SanctionLevel.SP2;
    }
    else if (score >= 80) {
        if (!hasSP1 && !hasSP2 && !hasSP3 && !hasDO) newLevel = SanctionLevel.SP1;
    }

    if (newLevel) {
        const newSanction: StudentSanction = {
            id: `san_auto_${Date.now()}`,
            studentId: studentId,
            level: newLevel,
            assignedBy: 'SYSTEM (Otomatis)',
            assignedDate: new Date().toISOString(),
            notes: `Sanksi otomatis sistem karena poin mencapai skor ${score}.`,
            redemptionStatus: RedemptionStatus.NONE, // Belum ada tugas penebusan
            isRedeemed: false
        };
        
        DataService.saveSanctions([...sanctions, newSanction]);
        return newLevel;
    }

    return null;
  },

  resolveIncident: (recordId: string, status: IncidentStatus, reason?: string) => {
    const allRecords = DataService.getRecords();
    const updatedRecords = allRecords.map(r => {
      if (r.id === recordId) {
        return { 
          ...r, 
          status: status,
          rejectionReason: status === 'REJECTED' ? reason : undefined
        };
      }
      return r;
    });
    DataService.saveRecords(updatedRecords);
  },

  cleanupOrphanData: () => {
    const students = DataService.getStudents();
    const validStudentIds = new Set(students.map(s => s.id));

    const records = DataService.getRecords();
    const counselings = DataService.getCounselingSessions();
    const sanctions = DataService.getSanctions();

    const validRecords = records.filter(r => validStudentIds.has(r.studentId));
    const validCounselings = counselings.filter(c => validStudentIds.has(c.studentId));
    const validSanctions = sanctions.filter(s => validStudentIds.has(s.studentId));

    if (records.length !== validRecords.length) DataService.saveRecords(validRecords);
    if (counselings.length !== validCounselings.length) DataService.saveCounselingSessions(validCounselings);
    if (sanctions.length !== validSanctions.length) DataService.saveSanctions(validSanctions);

    return {
        deletedRecords: records.length - validRecords.length,
        deletedCounselings: counselings.length - validCounselings.length,
        deletedSanctions: sanctions.length - validSanctions.length
    };
  }
};
