
import { 
  Student, ClassGroup, MasterCategory, MasterIncidentType, IncidentRecord, CoachingRule, 
  IncidentTypeCategory, Teacher, Role, CounselingSession, StudentSanction, 
  CashflowRecord, ActivityLog, BkCounselingStatus, SanctionLevel, RedemptionStatus, CashflowStatus
} from '../types';

import { db, connectToFirebase, isConfigMissing } from '../firebaseConfig';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';

// --- RAM STORAGE ---
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

// --- SYNC STATUS ---
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

// Helper untuk memberikan jeda minimal (mencegah klik terlalu cepat)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const pushToCloud = async (collectionName: string, data: any): Promise<void> => {
  if (!isInitialLoadComplete) {
      console.warn("Mencoba menyimpan sebelum inisialisasi selesai. Dibatalkan.");
      return;
  }
  if (!db) throw new Error("Koneksi Cloud terputus.");
  
  notifyListeners('SYNCING');
  const startTime = Date.now();
  
  try {
    const cleanData = JSON.parse(JSON.stringify(data)); 
    // Menunggu respon asli dari server Google
    await setDoc(doc(db, "school_data", collectionName), { 
        data: cleanData,
        lastUpdated: new Date().toISOString()
    });

    // FORCE WAIT: Jika proses sangat cepat (misal 100ms), paksa tunggu sampai total 2 detik
    // agar data benar-benar stabil di tunnel koneksi.
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < 2000) {
        await wait(2000 - elapsedTime);
    }

    notifyListeners('SAVED');
  } catch (error: any) {
    notifyListeners('ERROR', "Gagal Sinkronisasi Cloud.");
    console.error("Firebase push error:", error);
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

  isReady: () => isInitialLoadComplete,

  initializeData: async (): Promise<boolean> => {
    if (isConfigMissing) return false;
    notifyListeners('LOADING_INITIAL');
    
    const isConnected = await connectToFirebase();
    if (!isConnected) return false;

    const collections = [
        'classes', 'students', 'categories', 'incidentTypes', 
        'rules', 'records', 'teachers', 'counseling', 'sanctions',
        'cashflow', 'activity_logs'
    ];

    const loadedCols = new Set<string>();

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            if (!isInitialLoadComplete) {
                isInitialLoadComplete = true;
                notifyListeners('SAVED');
                resolve(true);
            }
        }, 15000); 

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

                loadedCols.add(colName);
                notifyDataChange();

                if (loadedCols.size === collections.length && !isInitialLoadComplete) {
                    clearTimeout(timeout);
                    isInitialLoadComplete = true;
                    notifyListeners('SAVED');
                    resolve(true);
                }
            }, (err) => {
                console.error("Sync Error for", colName, err);
                loadedCols.add(colName); 
            });
        });
    });
  },

  getTeachers: () => _teachers,
  getStudents: () => _students,
  getClasses: () => _classes,
  getRecords: () => _records,
  getCashflows: () => _cashflow,
  getCategories: () => _categories,
  getIncidentTypes: () => _incidents,
  getRules: () => _rules,
  getSanctions: () => _sanctions,
  getCounselingSessions: () => _counseling,
  getActivityLogs: () => _activityLogs,

  saveTeachers: async (data: Teacher[]) => { _teachers = data; await pushToCloud('teachers', data); notifyDataChange(); },
  saveStudents: async (data: Student[]) => { _students = data; await pushToCloud('students', data); notifyDataChange(); },
  saveClasses: async (data: ClassGroup[]) => { _classes = data; await pushToCloud('classes', data); notifyDataChange(); },
  saveRecords: async (data: IncidentRecord[]) => { _records = data; await pushToCloud('records', data); notifyDataChange(); },
  saveCashflows: async (data: CashflowRecord[]) => { _cashflow = data; await pushToCloud('cashflow', data); notifyDataChange(); },
  saveCategories: async (data: MasterCategory[]) => { _categories = data; await pushToCloud('categories', data); notifyDataChange(); },
  saveIncidentTypes: async (data: MasterIncidentType[]) => { _incidents = data; await pushToCloud('incidentTypes', data); notifyDataChange(); },
  saveRules: async (data: CoachingRule[]) => { _rules = data; await pushToCloud('rules', data); notifyDataChange(); },
  saveSanctions: async (data: StudentSanction[]) => { _sanctions = data; await pushToCloud('sanctions', data); notifyDataChange(); },
  saveCounselingSessions: async (data: CounselingSession[]) => { _counseling = data; await pushToCloud('counseling', data); notifyDataChange(); },

  login: async (username: string, password: string): Promise<Teacher | null> => {
    if (!isInitialLoadComplete) return null;

    const foundUser = _teachers.find(t => t.username === username && t.password === password);
    let user: Teacher | null = foundUser || null;
    
    if (!user && username === 'admin' && password === '123' && _teachers.length === 0) {
        const superAdmin: Teacher = {
            id: 'super_admin_001',
            name: 'Super Administrator',
            nip: '000000',
            roles: [Role.ADMIN, Role.TEACHER, Role.BK, Role.KESISWAAN, Role.WALIKELAS],
            username: 'admin',
            password: '123',
            mustChangePassword: false,
            lastActiveAt: new Date().toISOString()
        };
        const cloudRef = doc(db, "school_data", "teachers");
        const cloudSnap = await getDoc(cloudRef);
        if (!cloudSnap.exists()) {
            await setDoc(cloudRef, { data: [superAdmin] });
            _teachers = [superAdmin];
            user = superAdmin;
        } else {
            _teachers = cloudSnap.data().data || [];
            const retryFound = _teachers.find(t => t.username === username && t.password === password);
            user = retryFound || null;
        }
    }

    if (user) {
      sessionStorage.setItem('session_user_id', user.id); 
      return user;
    }
    return null;
  },

  getCurrentUser: (): Teacher | null => {
    const storedId = sessionStorage.getItem('session_user_id');
    return _teachers.find(t => t.id === storedId) || null;
  },

  logout: () => {
    sessionStorage.removeItem('session_user_id');
  },

  updatePassword: async (userId: string, newPass: string) => {
    const updated = _teachers.map(t => t.id === userId ? { ...t, password: newPass, mustChangePassword: false } : t);
    await DataService.saveTeachers(updated);
  },

  updateHeartbeat: async (userId: string) => {
    const now = new Date().toISOString();
    const updated = _teachers.map(t => t.id === userId ? { ...t, lastActiveAt: now } : t);
    setDoc(doc(db, "school_data", "teachers"), { data: updated });
  },

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
    
    // --- LOGIKA DINAMIS BERDASARKAN RULES ---
    // Mencari aturan yang mengandung kata "SP 1", "SP 2", "SP 3" di labelnya
    const getThreshold = (keyword: string, defaultVal: number) => {
       const rule = _rules.find(r => r.statusLabel.toUpperCase().replace(/\s/g, '').includes(keyword.replace(/\s/g, '')));
       return rule ? rule.minPoints : defaultVal;
    }

    const limitSP3 = getThreshold('SP3', 160); // Default 160 jika rule tidak ditemukan
    const limitSP2 = getThreshold('SP2', 120); // Default 120
    const limitSP1 = getThreshold('SP1', 80);  // Default 80

    let newLevel: SanctionLevel | null = null;
    
    // Evaluasi dari yang terberat
    if (score >= limitSP3 && !studentSanctions.some(s => s.level === SanctionLevel.SP3)) {
       newLevel = SanctionLevel.SP3;
    } else if (score >= limitSP2 && !studentSanctions.some(s => s.level === SanctionLevel.SP2)) {
       newLevel = SanctionLevel.SP2;
    } else if (score >= limitSP1 && !studentSanctions.some(s => s.level === SanctionLevel.SP1)) {
       newLevel = SanctionLevel.SP1;
    }

    if (newLevel) {
        const newSanction: StudentSanction = {
            id: `san_auto_${Date.now()}`,
            studentId, level: newLevel, assignedBy: 'SYSTEM', assignedDate: new Date().toISOString(),
            notes: `Otomatis skor ${score} (Melewati batas ${newLevel})`, 
            redemptionStatus: RedemptionStatus.NONE
        };
        await DataService.saveSanctions([..._sanctions, newSanction]);
        return newLevel;
    }
    return null;
  },

  resolveIncident: async (recordId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', reason?: string) => {
    // Logic BK Trigger juga perlu dinamis (default 40)
    let bkThreshold = 40;
    // Cari rule yang mengandung "BK" jika ada, untuk menentukan batas minimal konseling
    const bkRule = _rules.find(r => r.statusLabel.toUpperCase().includes('BK'));
    if (bkRule) bkThreshold = bkRule.minPoints;

    const updated = _records.map(r => r.id === recordId ? { ...r, status, rejectionReason: reason, bkStatus: (status === 'APPROVED' && r.pointSnapshot >= bkThreshold) ? 'REQUIRED' : (r.bkStatus || 'NONE') } : r);
    await DataService.saveRecords(updated);
  },

  getClassBalance: (classId: string) => {
    const classFlows = _cashflow.filter(f => f.classId === classId && f.status === 'APPROVED');
    let totalIn = 0, totalOut = 0;
    classFlows.forEach(f => f.type === 'IN' ? totalIn += f.amount : totalOut += f.amount);
    return { balance: totalIn - totalOut, totalIn, totalOut, transactionCount: classFlows.length };
  },

  cleanupOrphanData: async () => {
    const validStudentIds = new Set(_students.map(s => s.id));
    const validRecords = _records.filter(r => validStudentIds.has(r.studentId));
    if (_records.length !== validRecords.length) await DataService.saveRecords(validRecords);
    return { deletedRecords: _records.length - validRecords.length };
  }
};
    