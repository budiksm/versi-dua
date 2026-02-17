
import { 
  Student, ClassGroup, MasterCategory, MasterIncidentType, IncidentRecord, CoachingRule, 
  IncidentTypeCategory, Teacher, Role, CounselingSession, StudentSanction, 
  CashflowRecord, ActivityLog, BkCounselingStatus, SanctionLevel, RedemptionStatus
} from '../types';

import { db, connectToFirebase, isConfigMissing } from '../firebaseConfig';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- STATE MEMORI (Hanya Runtime Cache) ---
// Data ini diisi OTOMATIS oleh Realtime Listener Firestore.
// Tidak ada load/save manual ke localStorage.
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
export type SyncState = 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR' | 'OFFLINE';
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

// --- CORE: PUSH TO CLOUD ---
// Fungsi ini langsung menembak Firestore. Jika gagal (offline), Firestore SDK
// akan mengantrekannya otomatis, tapi kita menganggapnya 'PENDING'.
const pushToCloud = async (collectionName: string, data: any) => {
  if (!db) {
      notifyListeners('ERROR', "Tidak terhubung ke Database Cloud.");
      return; 
  }
  
  notifyListeners('SYNCING');
  try {
    // Kita menyimpan seluruh array sebagai satu dokumen 'data' untuk kesederhanaan
    // Dalam skala enterprise besar, ini harusnya sub-collection, tapi untuk sekolah
    // dengan < 2000 siswa, metode ini jauh lebih cepat dan hemat biaya read.
    const cleanData = JSON.parse(JSON.stringify(data)); 
    await setDoc(doc(db, "school_data", collectionName), { data: cleanData });
    
    notifyListeners('SAVED');
  } catch (error: any) {
    console.error(`[Cloud Error] ${collectionName}:`, error);
    notifyListeners('ERROR', "Gagal menyimpan ke Cloud. Periksa koneksi.");
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

  // --- INITIALIZATION ---
  initializeData: async (): Promise<boolean> => {
    if (isConfigMissing) {
        console.error("❌ Config Firebase Hilang.");
        return false;
    }

    console.log("☁️ [Init] Menghubungkan ke Cloud Firestore...");
    const isConnected = await connectToFirebase();
    
    if (!isConnected) {
        notifyListeners('ERROR', "Gagal koneksi ke server.");
        return false;
    }

    // Aktifkan Realtime Listeners
    // Ini adalah JANTUNG aplikasi. Data di UI akan selalu sama dengan Cloud.
    DataService.startRealtimeListeners();
    return true;
  },

  startRealtimeListeners: () => {
    if (!db) return;
    const collections = [
        'classes', 'students', 'categories', 'incidentTypes', 
        'rules', 'records', 'teachers', 'counseling', 'sanctions',
        'cashflow', 'activity_logs'
    ];

    let loadedCount = 0;

    collections.forEach(colName => {
        onSnapshot(doc(db, "school_data", colName), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const cloudData = docSnapshot.data().data || [];
                
                // Update Memori Lokal (Cache Runtime)
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
                notifyDataChange();
                
                // Indikator visual sync pertama kali
                loadedCount++;
                if (loadedCount === collections.length) notifyListeners('SAVED');
            } else {
                // Dokumen belum ada di cloud (Fresh Install), biarkan array kosong
                // Nanti akan terisi saat user melakukan input
            }
        }, (error) => {
            console.error(`Listener Error (${colName}):`, error);
            notifyListeners('ERROR', "Terputus dari Cloud.");
        });
    });
  },

  // --- GETTERS (Read from Memory Cache) ---
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

  // --- SETTERS (Write to Cloud) ---
  // Kita update memory dulu (Optimistic UI) lalu push ke cloud
  
  saveClasses: (data: ClassGroup[]) => { _classes = data; pushToCloud('classes', data); notifyDataChange(); },
  saveStudents: (data: Student[]) => { _students = data; pushToCloud('students', data); notifyDataChange(); },
  saveCategories: (data: MasterCategory[]) => { _categories = data; pushToCloud('categories', data); notifyDataChange(); },
  saveIncidentTypes: (data: MasterIncidentType[]) => { _incidents = data; pushToCloud('incidentTypes', data); notifyDataChange(); },
  saveRules: (data: CoachingRule[]) => { _rules = data; pushToCloud('rules', data); notifyDataChange(); },
  saveRecords: (data: IncidentRecord[]) => { _records = data; pushToCloud('records', data); notifyDataChange(); },
  saveTeachers: (data: Teacher[]) => { _teachers = data; pushToCloud('teachers', data); notifyDataChange(); },
  saveSanctions: (data: StudentSanction[]) => { _sanctions = data; pushToCloud('sanctions', data); notifyDataChange(); },
  saveCashflows: (data: CashflowRecord[]) => { _cashflow = data; pushToCloud('cashflow', data); notifyDataChange(); },
  saveActivityLogs: (data: ActivityLog[]) => { _activityLogs = data; pushToCloud('activity_logs', data); notifyDataChange(); },

  saveCounselingSessions: (data: CounselingSession[]) => { 
      _counseling = data;
      pushToCloud('counseling', data); 
      
      // Update status record terkait secara otomatis jika konseling selesai
      if (data.length > 0) {
          const latestSession = data[data.length - 1]; 
          if (latestSession && latestSession.relatedRecordIds && latestSession.relatedRecordIds.length > 0) {
              const allRecords = [..._records];
              let recordsChanged = false;
              const relatedIds = latestSession.relatedRecordIds;
              
              const updatedRecords = allRecords.map(r => {
                  if (relatedIds.includes(r.id)) {
                      let newStatus = r.bkStatus;
                      // Logic status update
                      if (latestSession.sessionType === 'BK') {
                          if (r.bkStatus !== 'COMPLETED') newStatus = 'COMPLETED';
                      } 
                      else if (latestSession.sessionType === 'HOMEROOM') {
                          if (latestSession.recommendation === 'TO_BK') newStatus = 'REQUIRED';
                          else if (latestSession.recommendation === 'NONE') newStatus = 'COMPLETED';
                      }
                      
                      if (newStatus !== r.bkStatus) {
                          recordsChanged = true;
                          return { ...r, bkStatus: newStatus as BkCounselingStatus };
                      }
                  }
                  return r;
              });
              
              if (recordsChanged) {
                  _records = updatedRecords;
                  pushToCloud('records', updatedRecords);
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
    // Keep logs manageable in single doc (max 1000)
    const updatedLogs = [newLog, ...logs].slice(0, 1000); 
    DataService.saveActivityLogs(updatedLogs);
  },

  updateHeartbeat: (userId: string) => {
    const teachers = _teachers;
    const now = new Date().toISOString();
    let changed = false;
    
    const updatedTeachers = teachers.map(t => {
      if (t.id === userId) {
        const last = t.lastActiveAt ? new Date(t.lastActiveAt).getTime() : 0;
        if (new Date().getTime() - last > 60000) { // Update tiap 1 menit
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
  // Login tetap memerlukan validasi terhadap data Cloud (_teachers).
  // localStorage hanya menyimpan sesi ID agar tidak perlu login ulang saat refresh.

  login: (username: string, password: string): Teacher | null => {
    const teachers = _teachers; 
    let user = teachers.find(t => t.username === username && t.password === password);
    
    if (user) {
      localStorage.setItem('session_user_id', user.id); // Hanya simpan ID
      DataService.logActivity(user, 'LOGIN');
      DataService.updateHeartbeat(user.id);
      return user;
    }
    return null;
  },

  logout: () => {
    const user = DataService.getCurrentUser();
    if(user) DataService.logActivity(user, 'LOGOUT');
    localStorage.removeItem('session_user_id');
  },

  getCurrentUser: (): Teacher | null => {
    try {
        const storedId = localStorage.getItem('session_user_id');
        if (!storedId) return null;
        
        // Cari user segar dari data cloud
        const freshUser = _teachers.find(t => t.id === storedId);
        return freshUser || null;
    } catch(e) { return null; }
  },

  updatePassword: (userId: string, newPass: string) => {
    const teachers = _teachers;
    const updatedTeachers = teachers.map(t => {
      if (t.id === userId) {
        return { ...t, password: newPass, mustChangePassword: false };
      }
      return t;
    });
    DataService.saveTeachers(updatedTeachers);
  },

  // --- HELPERS (Sama seperti sebelumnya) ---
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

    if (score >= 160 && !hasSP3 && !hasDO) newLevel = SanctionLevel.SP3;
    else if (score >= 120 && !hasSP2 && !hasSP3 && !hasDO) newLevel = SanctionLevel.SP2;
    else if (score >= 80 && !hasSP1 && !hasSP2 && !hasSP3 && !hasDO) newLevel = SanctionLevel.SP1;

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

  resolveIncident: (recordId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', reason?: string) => {
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
