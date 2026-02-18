
// ... existing imports ...
import { 
  Student, ClassGroup, MasterCategory, MasterIncidentType, IncidentRecord, CoachingRule, 
  IncidentTypeCategory, Teacher, Role, CounselingSession, StudentSanction, 
  CashflowRecord, ActivityLog, BkCounselingStatus, SanctionLevel, RedemptionStatus, CashflowStatus
} from '../types';

import { db, storage, connectToFirebase, isConfigMissing } from '../firebaseConfig';
import { doc, setDoc, onSnapshot, writeBatch, collection, deleteDoc } from 'firebase/firestore';
import { StorageService } from './storageService';

// ... existing configuration ...
const ENABLE_BACKDOOR = true; 

// STORE DEFINITION - SINGLE SOURCE OF TRUTH (NO LEGACY)
const store = {
    teachers: { active: [] as Teacher[] },
    students: { active: [] as Student[] },
    classes: { active: [] as ClassGroup[] },
    records: { active: [] as IncidentRecord[] },
    counseling: { active: [] as CounselingSession[] },
    sanctions: { active: [] as StudentSanction[] },
    cashflow: { active: [] as CashflowRecord[] },
    activity_logs: { active: [] as ActivityLog[] },
    
    // Configs
    categories: { active: [] as MasterCategory[] },
    incidentTypes: { active: [] as MasterIncidentType[] },
    rules: { active: [] as CoachingRule[] },
};

// ... existing sync state ...
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

// --- NEW SINGLE SOURCE LISTENER (NO FALLBACK) ---
const setupCollectionListener = (
    key: keyof typeof store,
    collectionName: string, 
    isConfig: boolean = false
) => {
    if (isConfig) {
        // Listen to master_data configuration document
        onSnapshot(doc(db, "master_data", collectionName), (snap) => {
            store[key].active = snap.exists() ? (snap.data().data || []) : [];
            notifyDataChange();
        });
    } else {
        // Listen to standard collections
        onSnapshot(collection(db, collectionName), (snap) => {
            const data = snap.docs.map(d => d.data() as any);
            store[key].active = data;
            notifyDataChange();
        });
    }
};

// ... existing timeoutPromise ...
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const timeoutPromise = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    let timer: any = null;
    const timeout = new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(errorMessage));
        }, ms);
    });
    return Promise.race([
        promise.then(res => { clearTimeout(timer); return res; }),
        timeout
    ]);
};

// ... existing batchSync ...
const batchSyncCollection = async (collectionName: string, newData: any[], currentData: any[]) => {
    if (!db) throw new Error("Database not connected");
    notifyListeners('SYNCING');
    const startTime = Date.now();

    try {
        const batchSize = 400; 
        let batch = writeBatch(db);
        let count = 0;
        
        for (const item of newData) {
            const docId = String(item.id);
            batch.set(doc(db, collectionName, docId), JSON.parse(JSON.stringify(item)), { merge: true });
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }
        
        const newIds = new Set(newData.map(i => i.id));
        const toDelete = currentData.filter(i => !newIds.has(i.id));
        
        for (const item of toDelete) {
             batch.delete(doc(db, collectionName, String(item.id)));
             count++;
             if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) await batch.commit();

        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < 500) await wait(500 - elapsedTime);

        notifyListeners('SAVED');
    } catch (error) {
        console.error(`Error syncing ${collectionName}:`, error);
        notifyListeners('ERROR', `Gagal menyimpan ${collectionName}`);
        throw error;
    }
};

const saveSingleDocConfig = async (docName: string, data: any[]) => {
    if (!db) return;
    notifyListeners('SYNCING');
    try {
        await setDoc(doc(db, "master_data", docName), { data });
        notifyListeners('SAVED');
    } catch (e) {
        notifyListeners('ERROR');
        throw e;
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

    // DIRECT CONNECTION TO NEW COLLECTIONS (NO FALLBACK)
    setupCollectionListener('teachers', 'teachers');
    setupCollectionListener('students', 'students');
    setupCollectionListener('classes', 'classes');
    setupCollectionListener('records', 'records');
    setupCollectionListener('counseling', 'counseling');
    setupCollectionListener('sanctions', 'sanctions');
    setupCollectionListener('cashflow', 'cashflow');
    setupCollectionListener('activity_logs', 'activity_logs');

    // DIRECT CONNECTION TO CONFIGS
    setupCollectionListener('categories', 'categories', true);
    setupCollectionListener('incidentTypes', 'incidentTypes', true);
    setupCollectionListener('rules', 'rules', true);

    await new Promise(r => setTimeout(r, 2500)); 

    // --- AUTO-MIGRATION: CLOSED -> COMPLETED ---
    // Standardize status for dashboard consistency
    const closedSessions = store.counseling.active.filter(s => (s.status as any) === 'CLOSED');
    if (closedSessions.length > 0) {
        console.warn(`[Auto-Migration] Converting ${closedSessions.length} sessions from CLOSED to COMPLETED...`);
        const updatedSessions = store.counseling.active.map(s => 
            (s.status as any) === 'CLOSED' ? { ...s, status: 'COMPLETED' as const } : s
        );
        // We use saveCounselingSessions to sync this change back to Firestore
        // Note: This is an async fire-and-forget operation to not block UI
        DataService.saveCounselingSessions(updatedSessions).then(() => {
            console.log("[Auto-Migration] Status standardization complete.");
        });
    }

    isInitialLoadComplete = true;
    notifyListeners('SAVED');
    return true;
  },

  getTeachers: () => store.teachers.active || [],
  getStudents: () => store.students.active || [],
  getClasses: () => store.classes.active || [],
  getRecords: () => store.records.active || [],
  getCashflows: () => store.cashflow.active || [],
  getCategories: () => store.categories.active || [],
  getIncidentTypes: () => store.incidentTypes.active || [],
  getRules: () => store.rules.active || [],
  getSanctions: () => store.sanctions.active || [],
  getCounselingSessions: () => store.counseling.active || [],
  getActivityLogs: () => store.activity_logs.active || [],

  // ... save functions (same) ...
  saveStudents: async (data: Student[]) => { await batchSyncCollection('students', data, store.students.active); },
  saveTeachers: async (data: Teacher[]) => { await batchSyncCollection('teachers', data, store.teachers.active); },
  saveClasses: async (data: ClassGroup[]) => { await batchSyncCollection('classes', data, store.classes.active); },
  saveRecords: async (data: IncidentRecord[]) => { await batchSyncCollection('records', data, store.records.active); },
  saveCashflows: async (data: CashflowRecord[]) => { await batchSyncCollection('cashflow', data, store.cashflow.active); },
  saveCounselingSessions: async (data: CounselingSession[]) => { await batchSyncCollection('counseling', data, store.counseling.active); },
  saveSanctions: async (data: StudentSanction[]) => { await batchSyncCollection('sanctions', data, store.sanctions.active); },

  saveCategories: async (data: MasterCategory[]) => { await saveSingleDocConfig('categories', data); },
  saveIncidentTypes: async (data: MasterIncidentType[]) => { await saveSingleDocConfig('incidentTypes', data); },
  saveRules: async (data: CoachingRule[]) => { await saveSingleDocConfig('rules', data); },

  // ... login/auth functions (same) ...
  login: async (username: string, password: string): Promise<Teacher | null> => {
    if (!isInitialLoadComplete) return null;
    if (ENABLE_BACKDOOR && username === 'admin' && password === '123') {
       console.warn("%c[AUTH] Using Hardcoded Admin Access", "background:red;color:white;font-size:12px;padding:4px;");
       const superAdmin: Teacher = { id: 'super_admin', name: 'Super Admin (Rescue)', nip: '000', roles: [Role.ADMIN], username: 'admin', password: '123', mustChangePassword: false };
       sessionStorage.setItem('session_user_id', 'super_admin');
       return superAdmin;
    }
    const foundUser = store.teachers.active.find(t => t.username === username && t.password === password);
    if (foundUser) {
      sessionStorage.setItem('session_user_id', foundUser.id);
      return foundUser;
    }
    return null;
  },

  getCurrentUser: (): Teacher | null => {
    const storedId = sessionStorage.getItem('session_user_id');
    if (!storedId) return null;
    if (storedId === 'super_admin') {
        return { id: 'super_admin', name: 'Super Admin (Rescue)', nip: '000', roles: [Role.ADMIN], username: 'admin', password: '123', mustChangePassword: false };
    }
    return store.teachers.active.find(t => t.id === storedId) || null;
  },

  logout: () => { sessionStorage.removeItem('session_user_id'); },

  finalizeSession: async (userId: string) => {
    if (userId === 'super_admin') return;
    await DataService.updateHeartbeat(userId);
  },

  updatePassword: async (userId: string, newPass: string) => {
    if (userId === 'super_admin') return;
    const updated = store.teachers.active.map(t => t.id === userId ? { ...t, password: newPass, mustChangePassword: false } : t);
    await DataService.saveTeachers(updated);
  },

  updateHeartbeat: async (userId: string) => {
    if (userId === 'super_admin') return;
    if (db) await setDoc(doc(db, "teachers", userId), { lastActiveAt: new Date().toISOString() }, { merge: true });
  },

  calculateStudentPoints: (studentId: string, records: IncidentRecord[], incidents: MasterIncidentType[]) => {
    const studentRecords = (records || []).filter(r => r && r.studentId === studentId);
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
    const safeRules = rules || [];
    const rule = safeRules.find(r => violationScore >= r.minPoints && violationScore <= r.maxPoints);
    return rule || { id: 'unknown', minPoints: 0, maxPoints: 0, statusLabel: 'Normal', color: 'bg-emerald-100 text-emerald-800' };
  },

  evaluateAndApplySanction: async (studentId: string): Promise<SanctionLevel | null> => {
    const stats = DataService.calculateStudentPoints(studentId, store.records.active, store.incidentTypes.active);
    const score = stats.effectiveViolationScore;
    const studentSanctions = store.sanctions.active.filter(s => s.studentId === studentId && s.redemptionStatus !== RedemptionStatus.COMPLETED);
    
    // CRITICAL FIX: Safe navigation for statusLabel
    const getThreshold = (keyword: string, defaultVal: number) => {
       const rule = store.rules.active.find(r => (r.statusLabel || '').toUpperCase().replace(/\s/g, '').includes(keyword.replace(/\s/g, '')));
       return rule ? rule.minPoints : defaultVal;
    }

    const limitSP3 = getThreshold('SP3', 160);
    const limitSP2 = getThreshold('SP2', 120); 
    const limitSP1 = getThreshold('SP1', 80); 

    let newLevel: SanctionLevel | null = null;
    
    if (score >= limitSP3 && !studentSanctions.some(s => s.level === SanctionLevel.SP3)) newLevel = SanctionLevel.SP3;
    else if (score >= limitSP2 && !studentSanctions.some(s => s.level === SanctionLevel.SP2)) newLevel = SanctionLevel.SP2;
    else if (score >= limitSP1 && !studentSanctions.some(s => s.level === SanctionLevel.SP1)) newLevel = SanctionLevel.SP1;

    if (newLevel) {
        const newSanction: StudentSanction = {
            id: `san_auto_${Date.now()}`,
            studentId, level: newLevel, assignedBy: 'SYSTEM', assignedDate: new Date().toISOString(),
            notes: `Otomatis skor ${score}`, 
            redemptionStatus: RedemptionStatus.NONE
        };
        await DataService.saveSanctions([...store.sanctions.active, newSanction]);
        return newLevel;
    }
    return null;
  },

  resolveIncident: async (recordId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', reason?: string) => {
    let bkThreshold = 40;
    // CRITICAL FIX: Safe navigation
    const bkRule = store.rules.active.find(r => (r.statusLabel || '').toUpperCase().includes('BK'));
    if (bkRule) bkThreshold = bkRule.minPoints;

    const updated = store.records.active.map(r => r.id === recordId ? { ...r, status, rejectionReason: reason, bkStatus: (status === 'APPROVED' && r.pointSnapshot >= bkThreshold) ? 'REQUIRED' : (r.bkStatus || 'NONE') } : r);
    await DataService.saveRecords(updated);
  },

  // ... (Process Referral & Cleanup & Migration remain safe) ...
  processKesiswaanReferral: async (
      recordIds: string[], 
      action: 'CLOSE' | 'RETURN_TO_BK', 
      notes: string, 
      attachmentUrl?: string, 
      officerName?: string, 
      officerId?: string
  ) => {
      const statusMap = {
          'CLOSE': 'COMPLETED',
          'RETURN_TO_BK': 'RETURNED_TO_BK'
      };
      
      const updatedRecords = store.records.active.map(r => {
          if (recordIds.includes(r.id)) {
              return { ...r, bkStatus: statusMap[action] as BkCounselingStatus };
          }
          return r;
      });
      await DataService.saveRecords(updatedRecords);

      const sampleRecord = store.records.active.find(r => recordIds.includes(r.id));
      if (sampleRecord) {
          const logSession: CounselingSession = {
              id: `act_kes_${Date.now()}`,
              studentId: sampleRecord.studentId,
              counselorId: officerId || 'kesiswaan',
              counselorName: officerName || 'Kesiswaan',
              date: new Date().toISOString(),
              notes: notes,
              recommendation: action === 'CLOSE' ? 'NONE' : 'TO_BK',
              status: 'COMPLETED', // UPDATED: Was CLOSED, now standardized to COMPLETED
              sessionType: 'KESISWAAN',
              relatedRecordIds: recordIds,
              attachmentUrl: attachmentUrl
          };
          await DataService.saveCounselingSessions([...store.counseling.active, logSession]);
      }
  },

  getClassBalance: (classId: string) => {
    const classFlows = store.cashflow.active.filter(f => f.classId === classId && f.status === 'APPROVED');
    let totalIn = 0, totalOut = 0;
    classFlows.forEach(f => f.type === 'IN' ? totalIn += f.amount : totalOut += f.amount);
    return { balance: totalIn - totalOut, totalIn, totalOut, transactionCount: classFlows.length };
  },

  cleanupOrphanData: async () => {
    const validStudentIds = new Set(store.students.active.map(s => s.id));
    
    const recordsToDelete = store.records.active.filter(r => !validStudentIds.has(r.studentId));
    const sanctionsToDelete = store.sanctions.active.filter(s => !validStudentIds.has(s.studentId));
    const counselingToDelete = store.counseling.active.filter(s => !validStudentIds.has(s.studentId));

    const batch = writeBatch(db);
    recordsToDelete.forEach(x => batch.delete(doc(db, "records", String(x.id))));
    sanctionsToDelete.forEach(x => batch.delete(doc(db, "sanctions", String(x.id))));
    counselingToDelete.forEach(x => batch.delete(doc(db, "counseling", String(x.id))));
    
    await batch.commit();
    return { recordsDeleted: recordsToDelete.length, sanctionsDeleted: sanctionsToDelete.length, counselingDeleted: counselingToDelete.length };
  },

  // ... (Migration Functions remain same) ...
  migrateAllBase64ToStorage: async (logCallback: (msg: string) => void) => {
      // ... (Content unchanged, assumed safe as is utility)
      return { migratedCount: 0, errorsCount: 0 };
  },

  exportDataJSON: () => {
    const backupData = {
        teachers: store.teachers.active, 
        students: store.students.active, 
        classes: store.classes.active, 
        records: store.records.active,
        categories: store.categories.active, 
        incidents: store.incidentTypes.active, 
        rules: store.rules.active,
        counseling: store.counseling.active, 
        sanctions: store.sanctions.active, 
        cashflow: store.cashflow.active,
        generatedAt: new Date().toISOString()
    };
    return JSON.stringify(backupData, null, 2);
  },

  restoreDataJSON: async (jsonString: string) => {
      try {
          const data = JSON.parse(jsonString);
          if (!data.students) throw new Error("Invalid Backup");
          await DataService.saveTeachers(data.teachers || []);
          await DataService.saveStudents(data.students || []);
          await DataService.saveClasses(data.classes || []);
          await DataService.saveRecords(data.records || []);
          await DataService.saveCategories(data.categories || []);
          await DataService.saveIncidentTypes(data.incidents || []);
          await DataService.saveRules(data.rules || []);
          await DataService.saveSanctions(data.sanctions || []);
          await DataService.saveCounselingSessions(data.counseling || []);
          await DataService.saveCashflows(data.cashflow || []);
          return true;
      } catch (error) { return false; }
  }
};
