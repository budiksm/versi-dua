
import { 
  Student, ClassGroup, MasterCategory, MasterIncidentType, IncidentRecord, CoachingRule, 
  IncidentTypeCategory, Teacher, Role, CounselingSession, StudentSanction, 
  CashflowRecord, ActivityLog, BkCounselingStatus, SanctionLevel, RedemptionStatus, CashflowStatus
} from '../types';

import { db, connectToFirebase, isConfigMissing } from '../firebaseConfig';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- PENYIMPANAN SEMENTARA DI RAM ---
let _teachers: Teacher[] = [];
let _students: Student[] = [];
let _classes: ClassGroup[] = [];
let _records: IncidentRecord[] = [];
let _categories: MasterCategory[] = [];
let _incidents: MasterIncidentType[] = [];
let _rules: CoachingRule[] = [];
let _counseling: CounselingSession[] = [];
let _sanctions: StudentSanction[] = [];
let _cashflow: CashflowRecord[] = [];
let _activityLogs: ActivityLog[] = [];

// --- STATUS SINKRONISASI ---
export type SyncState = 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR' | 'OFFLINE' | 'LOADING_INITIAL';
let currentSyncState: SyncState = 'IDLE';
let lastSyncTime: Date | null = null;
let lastError: string | null = null;
let isInitialLoadComplete = false; 

let syncListeners: ((state: SyncState, time: Date | null, error: string | null) => void)[] = [];
let dataChangeListeners: (() => void)[] = [];

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

// --- FUNGSI UTAMA: KIRIM KE GOOGLE CLOUD (ANTI-GIMIK) ---
const pushToCloud = async (collectionName: string, data: any): Promise<void> => {
  // Jika data awal belum selesai di-download, dilarang menulis (mencegah data terhapus)
  if (!isInitialLoadComplete) {
      console.error(`[BLOCK] Gagal simpan ${collectionName}. Data belum sinkron.`);
      throw new Error("Sistem sedang memuat data...");
  }

  if (!db) {
      notifyListeners('ERROR', "Koneksi terputus.");
      throw new Error("Koneksi internet bermasalah.");
  }
  
  notifyListeners('SYNCING');
  try {
    const cleanData = JSON.parse(JSON.stringify(data)); 
    // PERINTAH AWAIT: Tunggu sampai Google Cloud menjawab 'OK'
    await setDoc(doc(db, "school_data", collectionName), { data: cleanData });
    notifyListeners('SAVED');
    console.log(`[OK] ${collectionName} tersimpan di Cloud.`);
  } catch (error: any) {
    console.error(`[ERROR] Gagal simpan ke Cloud:`, error);
    notifyListeners('ERROR', "Gagal simpan ke Cloud.");
    throw error; 
  }
};

export const DataService = {
  subscribeToDataChanges: (callback: () => void) => {
    dataChangeListeners.push(callback);
    return () => { dataChangeListeners = dataChangeListeners.filter(cb => cb !== callback); };
  },

  subscribeToSync: (callback: (state: SyncState, time: Date | null, error: string | null) => void) => {
    syncListeners.push(callback);
    callback(currentSyncState, lastSyncTime, lastError);
    return () => { syncListeners = syncListeners.filter(l => l !== callback); };
  },

  // --- INISIALISASI AWAL (DOWNLOAD SEMUA DATA SEKOLAH) ---
  initializeData: async (): Promise<boolean> => {
    if (isConfigMissing) return false;
    notifyListeners('LOADING_INITIAL');
    
    const isConnected = await connectToFirebase();
    if (!isConnected) return false;

    return new Promise((resolve) => {
        const collections = [
            'classes', 'students', 'categories', 'incidentTypes', 
            'rules', 'records', 'teachers', 'counseling', 'sanctions',
            'cashflow', 'activity_logs'
        ];
        
        let receivedCollections = new Set();

        collections.forEach(colName => {
            onSnapshot(doc(db, "school_data", colName), (docSnapshot) => {
                const cloudData = docSnapshot.exists() ? (docSnapshot.data().data || []) : [];
                
                switch(colName) {
                    case 'teachers': _teachers = cloudData; break;
                    case 'students': _students = cloudData; break;
                    case 'classes': _classes = cloudData; break;
                    case 'records': _records = cloudData; break;
                    case 'categories': _categories = cloudData; break;
                    case 'incidentTypes': _incidents = cloudData; break;
                    case 'rules': _rules = cloudData; break;
                    case 'counseling': _counseling = cloudData; break;
                    case 'sanctions': _sanctions = cloudData; break;
                    case 'cashflow': _cashflow = cloudData; break;
                    case 'activity_logs': _activityLogs = cloudData; break;
                }

                receivedCollections.add(colName);
                notifyDataChange();

                if (receivedCollections.size === collections.length && !isInitialLoadComplete) {
                    isInitialLoadComplete = true; 
                    notifyListeners('SAVED');
                    resolve(true);
                }
            }, (err) => {
                notifyListeners('ERROR', "Koneksi Cloud bermasalah.");
            });
        });

        // Batas waktu tunggu 20 detik
        setTimeout(() => {
            if (!isInitialLoadComplete) {
                isInitialLoadComplete = true; 
                resolve(true);
            }
        }, 20000);
    });
  },

  // --- FUNGSI AMBIL DATA ---
  getClasses: () => _classes,
  getStudents: () => _students,
  getCategories: () => _categories,
  getIncidentTypes: () => _incidents,
  getRules: () => _rules,
  getRecords: () => _records,
  getCounselingSessions: () => _counseling,
  getSanctions: () => _sanctions,
  getCashflows: () => _cashflow,
  getActivityLogs: () => _activityLogs,
  getTeachers: () => _teachers,

  // --- FUNGSI SIMPAN DATA (WAJIB TUNGGU KONFIRMASI) ---
  saveClasses: async (data: ClassGroup[]) => { _classes = data; await pushToCloud('classes', data); notifyDataChange(); },
  saveStudents: async (data: Student[]) => { _students = data; await pushToCloud('students', data); notifyDataChange(); },
  saveCategories: async (data: MasterCategory[]) => { _categories = data; await pushToCloud('categories', data); notifyDataChange(); },
  saveIncidentTypes: async (data: MasterIncidentType[]) => { _incidents = data; await pushToCloud('incidentTypes', data); notifyDataChange(); },
  saveRules: async (data: CoachingRule[]) => { _rules = data; await pushToCloud('rules', data); notifyDataChange(); },
  saveRecords: async (data: IncidentRecord[]) => { _records = data; await pushToCloud('records', data); notifyDataChange(); },
  saveTeachers: async (data: Teacher[]) => { _teachers = data; await pushToCloud('teachers', data); notifyDataChange(); },
  saveSanctions: async (data: StudentSanction[]) => { _sanctions = data; await pushToCloud('sanctions', data); notifyDataChange(); },
  saveCashflows: async (data: CashflowRecord[]) => { _cashflow = data; await pushToCloud('cashflow', data); notifyDataChange(); },
  saveActivityLogs: async (data: ActivityLog[]) => { _activityLogs = data; await pushToCloud('activity_logs', data); notifyDataChange(); },

  saveCounselingSessions: async (data: CounselingSession[]) => { 
      _counseling = data;
      await pushToCloud('counseling', data); 
      notifyDataChange();
  },

  // --- SISTEM LOGIN ---
  login: async (username: string, password: string): Promise<Teacher | null> => {
    if (!isInitialLoadComplete) return null;

    let user = _teachers.find(t => t.username === username && t.password === password);
    
    // Login Admin Darurat jika cloud kosong
    if (!user && username === 'admin' && password === '123') {
        const anyAdminExists = _teachers.some(t => t.roles.includes(Role.ADMIN));
        if (!anyAdminExists) {
            const superAdmin: Teacher = {
                id: 'super_admin_001',
                name: 'Super Administrator',
                nip: '000000',
                roles: [Role.ADMIN, Role.TEACHER, Role.BK, Role.KESISWAAN, Role.WALIKELAS],
                username: 'admin',
                password: '123',
                mustChangePassword: true,
                lastActiveAt: new Date().toISOString()
            };
            await DataService.saveTeachers([..._teachers, superAdmin]);
            user = superAdmin;
        }
    }

    if (user) {
      localStorage.setItem('session_user_id', user.id); 
      await DataService.updateHeartbeat(user.id);
      return user;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem('session_user_id');
  },

  getCurrentUser: (): Teacher | null => {
    if (!isInitialLoadComplete) return null;
    const storedId = localStorage.getItem('session_user_id');
    return _teachers.find(t => t.id === storedId) || null;
  },

  updatePassword: async (userId: string, newPass: string) => {
    if (!isInitialLoadComplete) return;
    const updatedTeachers = _teachers.map(t => t.id === userId ? { ...t, password: newPass, mustChangePassword: false } : t);
    await DataService.saveTeachers(updatedTeachers);
  },

  updateHeartbeat: async (userId: string) => {
    if (!isInitialLoadComplete) return;
    const now = new Date().toISOString();
    const updatedTeachers = _teachers.map(t => {
      if (t.id === userId) {
        const last = t.lastActiveAt ? new Date(t.lastActiveAt).getTime() : 0;
        if (new Date().getTime() - last > 60000) return { ...t, lastActiveAt: now };
      }
      return t;
    });
    if (JSON.stringify(updatedTeachers) !== JSON.stringify(_teachers)) {
        await DataService.saveTeachers(updatedTeachers);
    }
  },

  // --- HITUNG POIN SISWA ---
  calculateStudentPoints: (studentId: string, records: IncidentRecord[], incidents: MasterIncidentType[]) => {
    const studentRecords = records.filter(r => r.studentId === studentId);
    let grossViolationPoints = 0;
    let achievementPoints = 0;
    let violationCount = 0;
    let achievementCount = 0;
    let redemptionCount = 0;

    studentRecords.forEach(record => {
      const isEffective = record.status === 'APPROVED' || !record.status;
      if (isEffective) {
        if (record.typeSnapshot === IncidentTypeCategory.VIOLATION) {
          grossViolationPoints += (record.pointSnapshot || 0);
          violationCount++;
        } else if (record.typeSnapshot === IncidentTypeCategory.REDEMPTION) {
          redemptionCount++;
        } else if (record.typeSnapshot === IncidentTypeCategory.ACHIEVEMENT) {
          achievementPoints += (record.pointSnapshot || 0);
          achievementCount++;
        }
      }
    });
    return { effectiveViolationScore: grossViolationPoints, grossViolationPoints, achievementPoints, violationCount, achievementCount, redemptionCount };
  },

  getCoachingStatus: (violationScore: number, rules: CoachingRule[]) => {
    const rule = rules.find(r => violationScore >= r.minPoints && violationScore <= r.maxPoints);
    return rule || { id: 'unknown', minPoints: 0, maxPoints: 0, statusLabel: 'Normal', color: 'bg-emerald-100 text-emerald-800' };
  },

  evaluateAndApplySanction: async (studentId: string): Promise<SanctionLevel | null> => {
    const stats = DataService.calculateStudentPoints(studentId, _records, _incidents);
    const score = stats.effectiveViolationScore;
    const studentSanctions = _sanctions.filter(s => s.studentId === studentId && s.redemptionStatus !== RedemptionStatus.COMPLETED);
    
    let newLevel: SanctionLevel | null = null;
    if (score >= 160 && !studentSanctions.some(s => s.level === SanctionLevel.SP3)) newLevel = SanctionLevel.SP3;
    else if (score >= 120 && !studentSanctions.some(s => s.level === SanctionLevel.SP2)) newLevel = SanctionLevel.SP2;
    else if (score >= 80 && !studentSanctions.some(s => s.level === SanctionLevel.SP1)) newLevel = SanctionLevel.SP1;

    if (newLevel) {
        const newSanction: StudentSanction = {
            id: `san_auto_${Date.now()}`,
            studentId, level: newLevel, assignedBy: 'SYSTEM', assignedDate: new Date().toISOString(),
            notes: `Otomatis skor ${score}`, redemptionStatus: RedemptionStatus.NONE
        };
        await DataService.saveSanctions([..._sanctions, newSanction]);
        return newLevel;
    }
    return null;
  },

  resolveIncident: async (recordId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', reason?: string) => {
    const updatedRecords = _records.map(r => {
      if (r.id === recordId) {
        return { ...r, status, rejectionReason: reason, bkStatus: (status === 'APPROVED' && r.pointSnapshot >= 40) ? 'REQUIRED' : (r.bkStatus || 'NONE') };
      }
      return r;
    });
    await DataService.saveRecords(updatedRecords);
  },

  getClassBalance: (classId: string) => {
    const classFlows = _cashflow.filter(f => f.classId === classId && f.status === 'APPROVED');
    let totalIn = 0, totalOut = 0;
    classFlows.forEach(f => f.type === 'IN' ? totalIn += f.amount : totalOut += f.amount);
    return { balance: totalIn - totalOut, totalIn, totalOut, transactionCount: classFlows.length };
  },

  verifyCashflow: async (recordId: string, verifierName: string, isRejected = false) => {
    const updatedFlows = _cashflow.map(f => f.id === recordId ? { ...f, status: (isRejected ? 'REJECTED' : 'APPROVED') as CashflowStatus, verifiedBy: verifierName, verifiedDate: new Date().toISOString() } : f);
    await DataService.saveCashflows(updatedFlows);
  },

  voidCashflow: async (recordId: string, user: Teacher) => {
    const updatedFlows = _cashflow.map(f => f.id === recordId ? { ...f, status: 'CORRECTED' as CashflowStatus, description: f.description + ` [KOREKSI: ${user.name}]` } : f);
    await DataService.saveCashflows(updatedFlows);
  },

  cleanupOrphanData: async () => {
    const validStudentIds = new Set(_students.map(s => s.id));
    const validRecords = _records.filter(r => validStudentIds.has(r.studentId));
    if (_records.length !== validRecords.length) await DataService.saveRecords(validRecords);
    return { deletedRecords: _records.length - validRecords.length };
  }
};
