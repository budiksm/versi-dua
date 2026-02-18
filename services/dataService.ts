
import { 
  Student, ClassGroup, MasterCategory, MasterIncidentType, IncidentRecord, CoachingRule, 
  IncidentTypeCategory, Teacher, Role, CounselingSession, StudentSanction, 
  CashflowRecord, ActivityLog, BkCounselingStatus, SanctionLevel, RedemptionStatus, CashflowStatus
} from '../types';

import { db, connectToFirebase, isConfigMissing } from '../firebaseConfig';
import { doc, setDoc, onSnapshot, writeBatch, collection, deleteDoc } from 'firebase/firestore';

// --- CONFIGURATION ---
// SET TO FALSE AFTER MIGRATION IS 100% COMPLETE & VERIFIED
const ENABLE_BACKDOOR = true; 

// --- HYBRID STORAGE STATE ---
const store = {
    teachers: { legacy: [] as Teacher[], new: [] as Teacher[], active: [] as Teacher[], source: 'INITIAL' },
    students: { legacy: [] as Student[], new: [] as Student[], active: [] as Student[], source: 'INITIAL' },
    classes: { legacy: [] as ClassGroup[], new: [] as ClassGroup[], active: [] as ClassGroup[], source: 'INITIAL' },
    records: { legacy: [] as IncidentRecord[], new: [] as IncidentRecord[], active: [] as IncidentRecord[], source: 'INITIAL' },
    counseling: { legacy: [] as CounselingSession[], new: [] as CounselingSession[], active: [] as CounselingSession[], source: 'INITIAL' },
    sanctions: { legacy: [] as StudentSanction[], new: [] as StudentSanction[], active: [] as StudentSanction[], source: 'INITIAL' },
    cashflow: { legacy: [] as CashflowRecord[], new: [] as CashflowRecord[], active: [] as CashflowRecord[], source: 'INITIAL' },
    activity_logs: { legacy: [] as ActivityLog[], new: [] as ActivityLog[], active: [] as ActivityLog[], source: 'INITIAL' },
    
    // Configs
    categories: { legacy: [] as MasterCategory[], new: [] as MasterCategory[], active: [] as MasterCategory[], source: 'INITIAL' },
    incidentTypes: { legacy: [] as MasterIncidentType[], new: [] as MasterIncidentType[], active: [] as MasterIncidentType[], source: 'INITIAL' },
    rules: { legacy: [] as CoachingRule[], new: [] as CoachingRule[], active: [] as CoachingRule[], source: 'INITIAL' },
};

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

// --- RECONCILIATION LOGIC (SAFE SWITCH) ---
const reconcile = (key: keyof typeof store) => {
    const s = store[key];
    const legacyCount = s.legacy.length;
    const newCount = s.new.length;

    let newActive: any[] = [];
    let newSource = 'INITIAL';

    if (newCount > 0) {
        if (legacyCount > 0 && newCount < legacyCount) {
             newActive = s.legacy;
             newSource = `LEGACY (Safe Fallback: New ${newCount} < Old ${legacyCount})`;
        } else {
             newActive = s.new;
             newSource = `NEW_COLLECTION (${newCount} items)`;
        }
    } else if (legacyCount > 0) {
        newActive = s.legacy;
        newSource = `LEGACY_DOC (${legacyCount} items)`;
    } else {
        newActive = [];
        newSource = 'EMPTY (No Data)';
    }

    if (s.source !== newSource) {
        const isNew = newSource.includes('NEW');
        const color = isNew ? 'background: #22c55e; color: white; padding: 2px 5px; border-radius: 3px;' : 'background: #f59e0b; color: black; padding: 2px 5px; border-radius: 3px;';
        console.groupCollapsed(`%c[DataService] Source Switch: ${key}`, color);
        console.log(`Previous: ${s.source}`);
        console.log(`Current:  ${newSource}`);
        console.log(`Counts:   Legacy=${legacyCount}, New=${newCount}`);
        console.groupEnd();
        s.source = newSource;
    }

    s.active = newActive;
};

// Helper setup listener
const setupHybridListener = (
    key: keyof typeof store,
    legacyDocPath: string, 
    newCollectionName: string, 
    isConfig: boolean = false
) => {
    if (isConfig) {
        onSnapshot(doc(db, "master_data", newCollectionName), (snap) => {
            store[key].new = snap.exists() ? (snap.data().data || []) : [];
            reconcile(key);
            notifyDataChange();
        });
    } else {
        onSnapshot(collection(db, newCollectionName), (snap) => {
            const data = snap.docs.map(d => d.data() as any);
            store[key].new = data;
            reconcile(key);
            notifyDataChange();
        });
    }

    onSnapshot(doc(db, "school_data", isConfig ? key : newCollectionName), (snap) => {
        store[key].legacy = snap.exists() ? (snap.data().data || []) : [];
        reconcile(key);
        notifyDataChange();
    });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    setupHybridListener('teachers', 'teachers', 'teachers');
    setupHybridListener('students', 'students', 'students');
    setupHybridListener('classes', 'classes', 'classes');
    setupHybridListener('records', 'records', 'records');
    setupHybridListener('counseling', 'counseling', 'counseling');
    setupHybridListener('sanctions', 'sanctions', 'sanctions');
    setupHybridListener('cashflow', 'cashflow', 'cashflow');
    setupHybridListener('activity_logs', 'activity_logs', 'activity_logs');

    setupHybridListener('categories', 'categories', 'categories', true);
    setupHybridListener('incidentTypes', 'incidentTypes', 'incidentTypes', true);
    setupHybridListener('rules', 'rules', 'rules', true);

    await new Promise(r => setTimeout(r, 2500)); 

    isInitialLoadComplete = true;
    notifyListeners('SAVED');
    return true;
  },

  getTeachers: () => store.teachers.active,
  getStudents: () => store.students.active,
  getClasses: () => store.classes.active,
  getRecords: () => store.records.active,
  getCashflows: () => store.cashflow.active,
  getCategories: () => store.categories.active,
  getIncidentTypes: () => store.incidentTypes.active,
  getRules: () => store.rules.active,
  getSanctions: () => store.sanctions.active,
  getCounselingSessions: () => store.counseling.active,
  getActivityLogs: () => store.activity_logs.active,

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
    const stats = DataService.calculateStudentPoints(studentId, store.records.active, store.incidentTypes.active);
    const score = stats.effectiveViolationScore;
    const studentSanctions = store.sanctions.active.filter(s => s.studentId === studentId && s.redemptionStatus !== RedemptionStatus.COMPLETED);
    
    const getThreshold = (keyword: string, defaultVal: number) => {
       const rule = store.rules.active.find(r => r.statusLabel.toUpperCase().replace(/\s/g, '').includes(keyword.replace(/\s/g, '')));
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
    const bkRule = store.rules.active.find(r => r.statusLabel.toUpperCase().includes('BK'));
    if (bkRule) bkThreshold = bkRule.minPoints;

    const updated = store.records.active.map(r => r.id === recordId ? { ...r, status, rejectionReason: reason, bkStatus: (status === 'APPROVED' && r.pointSnapshot >= bkThreshold) ? 'REQUIRED' : (r.bkStatus || 'NONE') } : r);
    await DataService.saveRecords(updated);
  },

  // --- NEW: KESISWAAN ACTION (Process Referral) ---
  processKesiswaanReferral: async (recordIds: string[], action: 'CLOSE' | 'RETURN_TO_BK') => {
      const updated = store.records.active.map(r => {
          if (recordIds.includes(r.id)) {
              if (action === 'CLOSE') return { ...r, bkStatus: 'COMPLETED' as BkCounselingStatus };
              if (action === 'RETURN_TO_BK') return { ...r, bkStatus: 'REQUIRED' as BkCounselingStatus };
          }
          return r;
      });
      await DataService.saveRecords(updated);
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
