
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

// --- IN-MEMORY STATE (Runtime Only) ---
// Data ini akan hilang saat refresh, dan DIPAKSA ambil ulang dari Cloud.
// Ini menjamin user selalu melihat data terbaru.
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

// --- DATA SEEDING (Hanya Manual Trigger via Admin, TIDAK OTOMATIS) ---
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

  // --- INITIALIZATION (STRICT CLOUD FETCH) ---
  initializeData: async (): Promise<boolean> => {
    console.log("☁️ [Init] Menghubungkan ke Infrastruktur Cloud...");
    
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
                data = snap.data().data || [];
                console.log(`✅ [Cloud] Loaded ${colName}: ${data.length} items`);
            } else {
                console.log(`ℹ️ [Cloud] ${colName} kosong atau belum dibuat.`);
            }

            // Assign to memory ONLY (No localStorage backup)
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
        });

        // 4. Safe Seeding (ONLY IF REALLY EMPTY & NO ADMIN)
        // Kita hanya seed Admin jika tabel guru benar-benar kosong di Cloud.
        if (_teachers.length === 0) {
            console.log("✨ [Init] Database kosong. Membuat Admin Default di Cloud...");
            _teachers = [SEED_DATA.admin];
            await syncToCloud('teachers', _teachers);
            
            // Seed basic rules & categories if empty
            if (_categories.length === 0) {
               _categories = SEED_DATA.categories;
               await syncToCloud('categories', _categories);
            }
            if (_rules.length === 0) {
               _rules = SEED_DATA.rules;
               await syncToCloud('rules', _rules);
            }
        }

        // 5. Start Realtime Listeners
        DataService.startRealtimeListeners();
        
        return true;

    } catch (e) {
        console.error("❌ [Init] Fatal Cloud Error:", e);
        notifyListeners('ERROR', "Koneksi Cloud Gagal.");
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
                
                // Compare with current memory to detect external changes
                // Note: We skip complex diffing for performance, just update memory & notify UI
                let shouldUpdate = false;
                
                switch(colName) {
                    case 'teachers': if(JSON.stringify(_teachers) !== JSON.stringify(cloudData)) { _teachers = cloudData; shouldUpdate = true; } break;
                    case 'students': if(JSON.stringify(_students) !== JSON.stringify(cloudData)) { _students = cloudData; shouldUpdate = true; } break;
                    case 'classes': if(JSON.stringify(_classes) !== JSON.stringify(cloudData)) { _classes = cloudData; shouldUpdate = true; } break;
                    case 'records': if(JSON.stringify(_records) !== JSON.stringify(cloudData)) { _records = cloudData; shouldUpdate = true; } break;
                    case 'categories': if(JSON.stringify(_categories) !== JSON.stringify(cloudData)) { _categories = cloudData; shouldUpdate = true; } break;
                    case 'incidentTypes': if(JSON.stringify(_incidents) !== JSON.stringify(cloudData)) { _incidents = cloudData; shouldUpdate = true; } break;
                    case 'rules': if(JSON.stringify(_rules) !== JSON.stringify(cloudData)) { _rules = cloudData; shouldUpdate = true; } break;
                    case 'counseling': if(JSON.stringify(_counseling) !== JSON.stringify(cloudData)) { _counseling = cloudData; shouldUpdate = true; } break;
                    case 'sanctions': if(JSON.stringify(_sanctions) !== JSON.stringify(cloudData)) { _sanctions = cloudData; shouldUpdate = true; } break;
                    case 'cashflow': if(JSON.stringify(_cashflow) !== JSON.stringify(cloudData)) { _cashflow = cloudData; shouldUpdate = true; } break;
                    case 'activity_logs': if(JSON.stringify(_activityLogs) !== JSON.stringify(cloudData)) { _activityLogs = cloudData; shouldUpdate = true; } break;
                }

                if (shouldUpdate) {
                    console.log(`🔄 [Realtime] Update diterima dari Cloud: ${colName}`);
                    notifyDataChange();
                }
            }
        });
    });
  },

  // --- GETTERS (Memory Access - Fast UI) ---
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

  // --- SETTERS (Update Memory -> Push to Cloud) ---
  // Kita menghapus 'saveToStorage' (LocalStorage) dari semua setter.
  // Data hanya disimpan di Memory (untuk UI instan) dan Cloud (untuk persistensi).
  
  saveClasses: (data: ClassGroup[]) => { _classes = data; syncToCloud('classes', data); notifyDataChange(); },
  saveStudents: (data: Student[]) => { _students = data; syncToCloud('students', data); notifyDataChange(); },
  saveCategories: (data: MasterCategory[]) => { _categories = data; syncToCloud('categories', data); notifyDataChange(); },
  saveIncidentTypes: (data: MasterIncidentType[]) => { _incidents = data; syncToCloud('incidentTypes', data); notifyDataChange(); },
  saveRules: (data: CoachingRule[]) => { _rules = data; syncToCloud('rules', data); notifyDataChange(); },
  saveRecords: (data: IncidentRecord[]) => { _records = data; syncToCloud('records', data); notifyDataChange(); },
  saveTeachers: (data: Teacher[]) => { _teachers = data; syncToCloud('teachers', data); notifyDataChange(); },
  saveSanctions: (data: StudentSanction[]) => { _sanctions = data; syncToCloud('sanctions', data); notifyDataChange(); },
  saveCashflows: (data: CashflowRecord[]) => { _cashflow = data; syncToCloud('cashflow', data); notifyDataChange(); },
  saveActivityLogs: (data: ActivityLog[]) => { _activityLogs = data; syncToCloud('activity_logs', data); notifyDataChange(); },

  saveCounselingSessions: (data: CounselingSession[]) => { 
      _counseling = data;
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
                  // Panggil setter internal untuk trigger sync records juga
                  _records = updatedRecords;
                  syncToCloud('records', updatedRecords);
              }
          }
      }
      notifyDataChange();
  },

  // --- LOGIC LAINNYA ---
  
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
    const updatedLogs = [newLog, ...logs].slice(0, 500); // Keep last 500 logs
    DataService.saveActivityLogs(updatedLogs);
  },

  updateHeartbeat: (userId: string) => {
    const teachers = _teachers;
    const now = new Date().toISOString();
    let changed = false;
    
    const updatedTeachers = teachers.map(t => {
      if (t.id === userId) {
        const last = t.lastActiveAt ? new Date(t.lastActiveAt).getTime() : 0;
        // Update only if > 1 min has passed to save bandwidth
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

  // --- AUTHENTICATION ---
  // Session tetap menggunakan localStorage agar user tidak perlu login ulang tiap refresh.
  // Tapi data User-nya (Role, Nama, dll) akan divalidasi ulang dengan data terbaru dari Cloud (_teachers).

  login: (username: string, password: string): Teacher | null => {
    // Cek kredensial dari data memory (yang sudah di-fetch dari Cloud)
    const teachers = _teachers; 
    let user = teachers.find(t => t.username === username && t.password === password);
    
    if (user) {
      // Simpan session token sederhana
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
        if (!stored) return null;
        
        const sessionUser = JSON.parse(stored);
        
        // RE-VALIDATE WITH LATEST CLOUD DATA
        // Jika data guru berubah di cloud (misal role diganti admin), session harus ikut berubah.
        const freshUser = _teachers.find(t => t.id === sessionUser.id);
        
        if (freshUser) {
            return freshUser; // Return yang paling update
        } else {
            return sessionUser; // Fallback jika belum sync
        }
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

  // --- CALCULATION HELPERS (PURE FUNCTIONS) ---
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
