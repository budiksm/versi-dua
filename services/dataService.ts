
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
  ActivityLog, 
  BkCounselingStatus 
} from '../types';

import { db, connectToFirebase } from '../firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// --- IN-MEMORY CACHE (Single Source of Truth saat Runtime) ---
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

// --- SYNC STATUS MANAGEMENT ---
export type SyncState = 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR';
let currentSyncState: SyncState = 'IDLE';
let lastSyncTime: Date | null = null;
let lastError: string | null = null;
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

// --- DATA SEEDING (Hanya jika Cloud Kosong Melompong) ---
const SEED_DATA = {
    categories: [
        { id: 'cat1', name: 'Kedisiplinan', targetType: IncidentTypeCategory.VIOLATION },
        { id: 'cat5', name: 'Prestasi', targetType: IncidentTypeCategory.ACHIEVEMENT },
        { id: 'cat6', name: 'Penebusan', targetType: IncidentTypeCategory.REDEMPTION },
    ],
    rules: [
        { id: 'r1', minPoints: 0, maxPoints: 19, statusLabel: 'Normal', color: 'bg-green-100 text-green-800' },
        { id: 'r2', minPoints: 20, maxPoints: 39, statusLabel: 'Pembinaan Wali Kelas', color: 'bg-yellow-100 text-yellow-800' },
        { id: 'r3', minPoints: 40, maxPoints: 79, statusLabel: 'Pembinaan BK + Ortu', color: 'bg-orange-100 text-orange-800' },
        { id: 'r4', minPoints: 80, maxPoints: 119, statusLabel: 'SP 1', color: 'bg-red-100 text-red-800' },
        { id: 'r5', minPoints: 120, maxPoints: 159, statusLabel: 'SP 2', color: 'bg-red-200 text-red-900' },
        { id: 'r6', minPoints: 160, maxPoints: 200, statusLabel: 'SP 3 (Perjanjian Terakhir)', color: 'bg-red-600 text-white' },
        { id: 'r7', minPoints: 201, maxPoints: 9999, statusLabel: 'DO (Dikembalikan ke Ortu)', color: 'bg-slate-900 text-white border-2 border-red-500' },
    ],
    admin: { id: 'admin1', name: 'Administrator', nip: '000000', roles: [Role.ADMIN], username: 'admin', password: '123', mustChangePassword: false }
};

// --- STORAGE HELPER (Hanya untuk Backup/Cache) ---
const saveToStorage = (key: string, data: any) => {
  try {
      localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
      // Ignore quota errors
  }
};

const loadFromStorage = (key: string) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
    } catch(e) {
        return [];
    }
};

// --- FIRESTORE SYNC HELPER ---
const syncToCloud = async (collectionName: string, data: any) => {
  if (!db) return; 
  
  notifyListeners('SYNCING');
  try {
    const cleanData = JSON.parse(JSON.stringify(data)); // Remove undefined
    await setDoc(doc(db, "school_data", collectionName), { data: cleanData });
    notifyListeners('SAVED');
  } catch (error: any) {
    console.error(`[Cloud] Failed to sync ${collectionName}:`, error);
    notifyListeners('ERROR', error.message || "Gagal simpan ke cloud");
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

  // --- STRICT CLOUD INITIALIZATION ---
  initializeData: async (): Promise<boolean> => {
    console.log("🚀 [Init] Memulai inisialisasi CLOUD FIRST STRICT...");
    
    if (!db) {
        console.warn("⚠️ Database belum dikonfigurasi.");
        return false;
    }

    // 1. Connect Auth (Wajib Tunggu)
    const isAuth = await connectToFirebase();
    if (!isAuth) {
        notifyListeners('ERROR', "Gagal Autentikasi Cloud.");
        return false;
    }

    // 2. Fetch All Data (Parallel)
    const collections = [
        'teachers', 'students', 'classes', 'records', 'counseling', 
        'sanctions', 'categories', 'incidentTypes', 'rules', 'cashflow', 'activity_logs'
    ];

    try {
        const promises = collections.map(col => getDoc(doc(db, "school_data", col)));
        const snapshots = await Promise.all(promises);

        // 3. Process Data into Memory
        snapshots.forEach((snap, index) => {
            const colName = collections[index];
            let data: any[] = [];

            if (snap.exists()) {
                // DATA CLOUD DITEMUKAN - GUNAKAN INI
                data = snap.data().data || [];
                console.log(`✅ [Cloud] Loaded ${colName}: ${data.length} items`);
            } else {
                // DATA CLOUD TIDAK ADA (Baru pertama kali run atau terhapus)
                console.warn(`⚠️ [Cloud] Kosong untuk ${colName}. Mencoba cache lokal...`);
                // Coba ambil dari cache lokal HANYA jika cloud kosong
                const local = loadFromStorage(colName);
                if (local && local.length > 0) {
                    data = local;
                    console.log(`♻️ [Cache] Restore ${colName} dari lokal dan upload ke cloud.`);
                    syncToCloud(colName, data); // Self-healing
                }
            }

            // Assign to memory
            switch(colName) {
                case 'teachers': _teachers = data; break;
                case 'students': _students = data; break;
                case 'classes': _classes = data; break;
                case 'records': _records = data; break;
                case 'categories': _categories = data; break;
                case 'incidentTypes': _incidents = data; break;
                case 'rules': _rules = data; break;
                case 'counseling': _counseling = data; break;
                case 'sanctions': _sanctions = data; break;
                case 'cashflow': _cashflow = data; break;
                case 'activity_logs': _activityLogs = data; break;
            }
            
            // Selalu update cache lokal agar sinkron
            saveToStorage(colName, data);
        });

        // 4. Safe Seeding (Hanya jika benar-benar kosong di semua level)
        if (_categories.length === 0) {
            _categories = SEED_DATA.categories;
            syncToCloud('categories', _categories);
        }
        if (_rules.length === 0) {
            _rules = SEED_DATA.rules;
            syncToCloud('rules', _rules);
        }
        if (_teachers.length === 0) {
            _teachers = [SEED_DATA.admin];
            syncToCloud('teachers', _teachers);
            console.log("✨ [Init] Admin default dibuat.");
        }

        // 5. Start Realtime Listeners (Agar update dari device lain masuk)
        DataService.startRealtimeListeners();
        
        return true;

    } catch (e) {
        console.error("❌ [Init] Fatal Error:", e);
        notifyListeners('ERROR', "Koneksi Gagal. Cek internet Anda.");
        return false;
    }
  },

  startRealtimeListeners: () => {
    if (!db) return;
    const collections = [
        'classes', 'students', 'categories', 'incidentTypes', 
        'rules', 'records', 'teachers', 'counseling', 'sanctions',
        'cashflow', 'activity_logs'
    ];

    collections.forEach(colName => {
        onSnapshot(doc(db, "school_data", colName), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const cloudData = docSnapshot.data().data;
                const localDataStr = localStorage.getItem(colName);
                
                // Hanya update jika berbeda, mencegah loop render
                if (JSON.stringify(cloudData) !== localDataStr) {
                    console.log(`🔄 [Realtime] Update masuk: ${colName}`);
                    
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

                    saveToStorage(colName, cloudData);
                    notifyDataChange();
                }
            }
        });
    });
  },

  // --- GETTERS (Memory Access - Cepat) ---
  getClasses: () => _classes || [],
  getStudents: () => _students || [],
  getCategories: () => _categories || [],
  getIncidentTypes: () => _incidents || [],
  getRules: () => _rules || [],
  getRecords: () => _records || [],
  getCounselingSessions: () => _counseling || [],
  getSanctions: () => _sanctions || [],
  getCashflows: () => _cashflow || [],
  getActivityLogs: () => _activityLogs || [],
  getTeachers: () => _teachers || [],

  // --- SETTERS (Update Memory -> Local -> Cloud) ---
  saveClasses: (data: ClassGroup[]) => { _classes = data; saveToStorage('classes', data); syncToCloud('classes', data); notifyDataChange(); },
  saveStudents: (data: Student[]) => { _students = data; saveToStorage('students', data); syncToCloud('students', data); notifyDataChange(); },
  saveCategories: (data: MasterCategory[]) => { _categories = data; saveToStorage('categories', data); syncToCloud('categories', data); notifyDataChange(); },
  saveIncidentTypes: (data: MasterIncidentType[]) => { _incidents = data; saveToStorage('incidentTypes', data); syncToCloud('incidentTypes', data); notifyDataChange(); },
  saveRules: (data: CoachingRule[]) => { _rules = data; saveToStorage('rules', data); syncToCloud('rules', data); notifyDataChange(); },
  saveRecords: (data: IncidentRecord[]) => { _records = data; saveToStorage('records', data); syncToCloud('records', data); notifyDataChange(); },
  saveTeachers: (data: Teacher[]) => { _teachers = data; saveToStorage('teachers', data); syncToCloud('teachers', data); notifyDataChange(); },
  saveSanctions: (data: StudentSanction[]) => { _sanctions = data; saveToStorage('sanctions', data); syncToCloud('sanctions', data); notifyDataChange(); },
  saveCashflows: (data: CashflowRecord[]) => { _cashflow = data; saveToStorage('cashflow', data); syncToCloud('cashflow', data); notifyDataChange(); },
  saveActivityLogs: (data: ActivityLog[]) => { _activityLogs = data; saveToStorage('activity_logs', data); syncToCloud('activity_logs', data); notifyDataChange(); },

  saveCounselingSessions: (data: CounselingSession[]) => { 
      _counseling = data;
      saveToStorage('counseling', data); 
      syncToCloud('counseling', data); 
      
      // SIDE EFFECT: Update status record jika diperlukan
      if (data.length > 0) {
          const latestSession = data[data.length - 1]; 
          if (latestSession && latestSession.relatedRecordIds && latestSession.relatedRecordIds.length > 0) {
              const allRecords = [..._records];
              let recordsChanged = false;
              const relatedIds = latestSession.relatedRecordIds;
              
              const updatedRecords = allRecords.map(r => {
                  if (relatedIds.includes(r.id)) {
                      if (latestSession.sessionType === 'BK') {
                          if (r.bkStatus !== 'COMPLETED') {
                              recordsChanged = true;
                              return { ...r, bkStatus: 'COMPLETED' as BkCounselingStatus };
                          }
                      } 
                      else if (latestSession.sessionType === 'HOMEROOM') {
                          if (latestSession.recommendation === 'TO_BK') {
                              if (r.bkStatus !== 'REQUIRED') {
                                  recordsChanged = true;
                                  return { ...r, bkStatus: 'REQUIRED' as BkCounselingStatus };
                              }
                          }
                          else if (latestSession.recommendation === 'NONE') {
                              if (r.bkStatus !== 'COMPLETED') {
                                  recordsChanged = true;
                                  return { ...r, bkStatus: 'COMPLETED' as BkCounselingStatus };
                              }
                          }
                      }
                  }
                  return r;
              });
              
              if (recordsChanged) {
                  DataService.saveRecords(updatedRecords);
              }
          }
      }
      notifyDataChange();
  },

  // ... (Sisa fungsi logika seperti logActivity, login, calculateStudentPoints, dll SAMA PERSIS dengan sebelumnya)
  
  logActivity: (user: Teacher, action: 'LOGIN' | 'LOGOUT' | 'SYNC') => {
    const logs = _activityLogs;
    const newLog: ActivityLog = {
      id: `log_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      role: user.roles.join(', '),
      action,
      timestamp: new Date().toISOString(),
      deviceInfo: navigator.userAgent
    };
    const updatedLogs = [newLog, ...logs].slice(0, 500);
    DataService.saveActivityLogs(updatedLogs);
  },

  updateHeartbeat: (userId: string) => {
    const teachers = _teachers;
    const now = new Date().toISOString();
    let changed = false;
    
    const updatedTeachers = teachers.map(t => {
      if (t.id === userId) {
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

  getClassBalance: (classId: string) => {
    const flows = _cashflow;
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
    const flows = _cashflow;
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
    const flows = _cashflow;
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

  login: (username: string, password: string): Teacher | null => {
    const teachers = _teachers; 
    let user = teachers.find(t => t.username === username && t.password === password);
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      DataService.logActivity(user, 'LOGIN');
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
    try {
        const stored = localStorage.getItem('currentUser');
        return stored ? JSON.parse(stored) : null;
    } catch(e) { return null; }
  },

  updatePassword: (userId: string, newPass: string) => {
    const teachers = _teachers;
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
    const validRecords = Array.isArray(records) ? records : [];
    const studentRecords = validRecords.filter(r => r.studentId === studentId);
    let grossViolationPoints = 0;
    let achievementPoints = 0;
    let violationCount = 0;
    let achievementCount = 0;
    let redemptionCount = 0;

    const now = new Date().getTime();
    const AUTO_ACCEPT_MS = 2 * 24 * 60 * 60 * 1000;

    studentRecords.forEach(record => {
      const recordTime = record.date ? new Date(record.date).getTime() : 0;
      const isAutoAccepted = (record.status === 'PENDING') && ((now - recordTime) > AUTO_ACCEPT_MS);
      const effectiveStatus = record.status || 'APPROVED';
      const isEffective = effectiveStatus === 'APPROVED' || isAutoAccepted;

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
    const validRules = Array.isArray(rules) ? rules : [];
    const rule = validRules.find(r => violationScore >= r.minPoints && violationScore <= r.maxPoints);
    return rule || { id: 'unknown', minPoints: 0, maxPoints: 0, statusLabel: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  },

  evaluateAndApplySanction: (studentId: string): SanctionLevel | null => {
    const records = _records;
    const incidents = _incidents;
    const sanctions = _sanctions;
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
            redemptionStatus: RedemptionStatus.NONE,
            isRedeemed: false
        };
        DataService.saveSanctions([...sanctions, newSanction]);
        return newLevel;
    }
    return null;
  },

  resolveIncident: (recordId: string, status: IncidentStatus, reason?: string) => {
    const allRecords = _records;
    const updatedRecords = allRecords.map(r => {
      if (r.id === recordId) {
        let bkStatus: BkCounselingStatus = r.bkStatus || 'NONE';
        if (status === 'APPROVED') {
            if (r.pointSnapshot >= 40 && r.typeSnapshot === IncidentTypeCategory.VIOLATION) {
                bkStatus = 'REQUIRED';
            }
        }
        return { 
          ...r, 
          status: status,
          rejectionReason: status === 'REJECTED' ? reason : undefined,
          bkStatus: bkStatus 
        };
      }
      return r;
    });
    DataService.saveRecords(updatedRecords);
  },

  cleanupOrphanData: () => {
    const students = _students;
    const validStudentIds = new Set(students.map(s => s.id));
    const records = _records;
    const counselings = _counseling;
    const sanctions = _sanctions;

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
