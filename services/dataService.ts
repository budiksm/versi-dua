
import { 
  Student, ClassGroup, MasterCategory, MasterIncidentType, IncidentRecord, CoachingRule, 
  IncidentTypeCategory, Teacher, Role, CounselingSession, StudentSanction, 
  CashflowRecord, ActivityLog, BkCounselingStatus, SanctionLevel, RedemptionStatus, CashflowStatus
} from '../types';

import { db, connectToFirebase, isConfigMissing } from '../firebaseConfig';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- STATE MEMORI (RUNTIME CACHE) ---
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

// --- SYNC ENGINE STATE ---
export type SyncState = 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR' | 'OFFLINE' | 'LOADING_INITIAL';
let currentSyncState: SyncState = 'IDLE';
let lastSyncTime: Date | null = null;
let lastError: string | null = null;
let isInitialLoadComplete = false; // KUNCI PENGAMAN: TRUE JIKA DATA CLOUD SUDAH MASUK

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

// --- CORE: PUSH TO CLOUD (DENGAN PENGAMAN OVERWRITE) ---
const pushToCloud = async (collectionName: string, data: any) => {
  // PENCEGAHAN FATAL: Jangan pernah kirim data jika loading awal belum selesai
  if (!isInitialLoadComplete) {
      console.warn(`[Sync Blocked] Percobaan overwrite ${collectionName} dibatalkan karena data Cloud belum selesai dimuat.`);
      return; 
  }

  if (!db) {
      notifyListeners('ERROR', "Tidak terhubung ke Database.");
      return; 
  }
  
  notifyListeners('SYNCING');
  try {
    const cleanData = JSON.parse(JSON.stringify(data)); 
    await setDoc(doc(db, "school_data", collectionName), { data: cleanData });
    notifyListeners('SAVED');
  } catch (error: any) {
    console.error(`[Cloud Error] ${collectionName}:`, error);
    notifyListeners('ERROR', "Gagal menyimpan ke Cloud.");
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

  // --- INITIALIZATION (MENUNGGU DATA CLOUD) ---
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

                // Hanya buka kunci jika SEMUA koleksi sudah merespon (sekalipun datanya [] kosong)
                if (receivedCollections.size === collections.length && !isInitialLoadComplete) {
                    isInitialLoadComplete = true; // BUKA KUNCI PENGAMAN
                    console.log("✅ [Sync] 100% Cloud Data Loaded.");
                    notifyListeners('SAVED');
                    resolve(true);
                }
            }, (err) => {
                console.error("Snapshot Error:", err);
                notifyListeners('ERROR', "Terputus dari server");
            });
        });

        // Timeout 15 detik untuk internet lambat
        setTimeout(() => {
            if (!isInitialLoadComplete) {
                console.warn("⚠️ [Sync] Koneksi lambat, mencoba melanjutkan...");
                isInitialLoadComplete = true; 
                resolve(true);
            }
        }, 15000);
    });
  },

  // --- GETTERS ---
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

  // --- SETTERS (DILINDUNGI LOCK) ---
  saveClasses: (data: ClassGroup[]) => { if(!isInitialLoadComplete) return; _classes = data; pushToCloud('classes', data); notifyDataChange(); },
  saveStudents: (data: Student[]) => { if(!isInitialLoadComplete) return; _students = data; pushToCloud('students', data); notifyDataChange(); },
  saveCategories: (data: MasterCategory[]) => { if(!isInitialLoadComplete) return; _categories = data; pushToCloud('categories', data); notifyDataChange(); },
  saveIncidentTypes: (data: MasterIncidentType[]) => { if(!isInitialLoadComplete) return; _incidents = data; pushToCloud('incidentTypes', data); notifyDataChange(); },
  saveRules: (data: CoachingRule[]) => { if(!isInitialLoadComplete) return; _rules = data; pushToCloud('rules', data); notifyDataChange(); },
  saveRecords: (data: IncidentRecord[]) => { if(!isInitialLoadComplete) return; _records = data; pushToCloud('records', data); notifyDataChange(); },
  saveTeachers: (data: Teacher[]) => { if(!isInitialLoadComplete) return; _teachers = data; pushToCloud('teachers', data); notifyDataChange(); },
  saveSanctions: (data: StudentSanction[]) => { if(!isInitialLoadComplete) return; _sanctions = data; pushToCloud('sanctions', data); notifyDataChange(); },
  saveCashflows: (data: CashflowRecord[]) => { if(!isInitialLoadComplete) return; _cashflow = data; pushToCloud('cashflow', data); notifyDataChange(); },
  saveActivityLogs: (data: ActivityLog[]) => { if(!isInitialLoadComplete) return; _activityLogs = data; pushToCloud('activity_logs', data); notifyDataChange(); },

  saveCounselingSessions: (data: CounselingSession[]) => { 
      if(!isInitialLoadComplete) return;
      _counseling = data;
      pushToCloud('counseling', data); 
      notifyDataChange();
  },

  // --- AUTHENTICATION ---
  login: (username: string, password: string): Teacher | null => {
    if (!isInitialLoadComplete) return null;

    let user = _teachers.find(t => t.username === username && t.password === password);
    
    // EMERGENCY ADMIN: Hanya dibuat jika DATABASE BENAR-BENAR KOSONG di Cloud
    if (!user && username === 'admin' && password === '123') {
        const anyAdminExists = _teachers.some(t => t.username === 'admin' || t.roles.includes(Role.ADMIN));
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
            DataService.saveTeachers([..._teachers, superAdmin]);
            user = superAdmin;
        }
    }

    if (user) {
      localStorage.setItem('session_user_id', user.id); 
      DataService.updateHeartbeat(user.id);
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

  updatePassword: (userId: string, newPass: string) => {
    if (!isInitialLoadComplete) return;
    const updatedTeachers = _teachers.map(t => t.id === userId ? { ...t, password: newPass, mustChangePassword: false } : t);
    DataService.saveTeachers(updatedTeachers);
  },

  updateHeartbeat: (userId: string) => {
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
        DataService.saveTeachers(updatedTeachers);
    }
  },

  // --- HELPERS (POINT CALCULATION) ---
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

  evaluateAndApplySanction: (studentId: string): SanctionLevel | null => {
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
        DataService.saveSanctions([..._sanctions, newSanction]);
        return newLevel;
    }
    return null;
  },

  resolveIncident: (recordId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', reason?: string) => {
    const updatedRecords = _records.map(r => {
      if (r.id === recordId) {
        return { ...r, status, rejectionReason: reason, bkStatus: (status === 'APPROVED' && r.pointSnapshot >= 40) ? 'REQUIRED' : (r.bkStatus || 'NONE') };
      }
      return r;
    });
    DataService.saveRecords(updatedRecords);
  },

  getClassBalance: (classId: string) => {
    const classFlows = _cashflow.filter(f => f.classId === classId && f.status === 'APPROVED');
    let totalIn = 0, totalOut = 0;
    classFlows.forEach(f => f.type === 'IN' ? totalIn += f.amount : totalOut += f.amount);
    return { balance: totalIn - totalOut, totalIn, totalOut, transactionCount: classFlows.length };
  },

  verifyCashflow: (recordId: string, verifierName: string, isRejected = false) => {
    const updatedFlows = _cashflow.map(f => f.id === recordId ? { ...f, status: (isRejected ? 'REJECTED' : 'APPROVED') as CashflowStatus, verifiedBy: verifierName, verifiedDate: new Date().toISOString() } : f);
    DataService.saveCashflows(updatedFlows);
  },

  voidCashflow: (recordId: string, user: Teacher) => {
    const updatedFlows = _cashflow.map(f => f.id === recordId ? { ...f, status: 'CORRECTED' as CashflowStatus, description: f.description + ` [KOREKSI: ${user.name}]` } : f);
    DataService.saveCashflows(updatedFlows);
  },

  cleanupOrphanData: () => {
    const validStudentIds = new Set(_students.map(s => s.id));
    const validRecords = _records.filter(r => validStudentIds.has(r.studentId));
    if (_records.length !== validRecords.length) DataService.saveRecords(validRecords);
    return { deletedRecords: _records.length - validRecords.length };
  }
};
