
import { 
  Student, ClassGroup, MasterCategory, MasterIncidentType, IncidentRecord, CoachingRule, 
  IncidentTypeCategory, Teacher, Role, CounselingSession, StudentSanction, 
  CashflowRecord, ActivityLog, BkCounselingStatus, SanctionLevel, RedemptionStatus, CashflowStatus
} from '../types';

import { db, connectToFirebase, isConfigMissing } from '../firebaseConfig';
import { doc, setDoc, onSnapshot, getDoc, writeBatch, collection, deleteDoc, query } from 'firebase/firestore';

// --- RAM STORAGE (CACHE) ---
// Frontend membaca ini secara sync agar UI cepat
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- BATCH HELPER (The Core of Facade) ---
// Membandingkan Array Baru (dari UI) dengan Array Lama (di RAM)
// untuk menentukan mana yang Create/Update/Delete di Firestore Collection.
const batchSyncCollection = async (collectionName: string, newData: any[], currentData: any[]) => {
    if (!db) throw new Error("Database not connected");
    notifyListeners('SYNCING');
    const startTime = Date.now();

    try {
        const batchSize = 400; // Safe limit (Firestore max 500)
        let operations: Promise<void>[] = [];
        
        const newIds = new Set(newData.map(item => item.id));
        const currentIds = new Set(currentData.map(item => item.id));

        // 1. Identify Deletions
        const toDelete = currentData.filter(item => !newIds.has(item.id));
        
        // 2. Identify Writes (Create/Update)
        // Note: For true optimization, we could deep-compare objects, 
        // but for safety in this migration, we Upsert all existing in newData.
        const toUpsert = newData; 

        // Execute in chunks
        let batch = writeBatch(db);
        let count = 0;

        // Process Deletes
        for (const item of toDelete) {
            batch.delete(doc(db, collectionName, item.id));
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        // Process Upserts
        for (const item of toUpsert) {
            // Clean undefined values
            const cleanItem = JSON.parse(JSON.stringify(item));
            batch.set(doc(db, collectionName, item.id), cleanItem, { merge: true });
            count++;
            if (count >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) await batch.commit();

        // Artificial delay for UX perception
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < 500) await wait(500 - elapsedTime);

        notifyListeners('SAVED');
    } catch (error) {
        console.error(`Error syncing ${collectionName}:`, error);
        notifyListeners('ERROR', `Gagal menyimpan ${collectionName}`);
        throw error;
    }
};

// Helper khusus untuk Configs (masih single doc)
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

    // --- MAPPING COLLECTION ---
    // Key: Nama Collection di Firestore
    // Setter: Fungsi update variabel RAM
    const collectionMap = {
        'students': (data: any[]) => { _students = data; },
        'teachers': (data: any[]) => { _teachers = data; },
        'classes': (data: any[]) => { _classes = data; },
        'records': (data: any[]) => { _records = data; },
        'counseling': (data: any[]) => { _counseling = data; },
        'sanctions': (data: any[]) => { _sanctions = data; },
        'cashflow': (data: any[]) => { _cashflow = data; },
        'activity_logs': (data: any[]) => { _activityLogs = data; },
    };

    const configMap = {
        'categories': (data: any[]) => { _categories = data; },
        'incidentTypes': (data: any[]) => { _incidents = data; },
        'rules': (data: any[]) => { _rules = data; },
    };

    const promises: Promise<void>[] = [];

    // 1. Listen to Collections
    Object.entries(collectionMap).forEach(([colName, setter]) => {
        promises.push(new Promise((resolve) => {
            onSnapshot(collection(db, colName), (querySnapshot) => {
                const data: any[] = [];
                querySnapshot.forEach((doc) => {
                    data.push(doc.data());
                });
                setter(data);
                notifyDataChange();
                resolve();
            }, (error) => {
                console.error(`Error loading ${colName}:`, error);
                resolve(); // Resolve anyway to not block app
            });
        }));
    });

    // 2. Listen to Master Data Configs (Single Docs)
    Object.entries(configMap).forEach(([docName, setter]) => {
        promises.push(new Promise((resolve) => {
            onSnapshot(doc(db, "master_data", docName), (docSnap) => {
                if (docSnap.exists()) {
                    setter(docSnap.data().data || []);
                } else {
                    setter([]);
                }
                notifyDataChange();
                resolve();
            });
        }));
    });

    // Wait for initial data (timeout 15s)
    await Promise.race([
        Promise.all(promises),
        new Promise(r => setTimeout(r, 15000))
    ]);

    isInitialLoadComplete = true;
    notifyListeners('SAVED');
    return true;
  },

  // --- GETTERS (Tetap mengembalikan Array) ---
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

  // --- SETTERS (Menggunakan Batch Sync Logic) ---
  
  saveStudents: async (data: Student[]) => { 
      await batchSyncCollection('students', data, _students); 
      _students = data; notifyDataChange(); 
  },
  
  saveTeachers: async (data: Teacher[]) => { 
      await batchSyncCollection('teachers', data, _teachers); 
      _teachers = data; notifyDataChange(); 
  },
  
  saveClasses: async (data: ClassGroup[]) => { 
      await batchSyncCollection('classes', data, _classes); 
      _classes = data; notifyDataChange(); 
  },
  
  saveRecords: async (data: IncidentRecord[]) => { 
      await batchSyncCollection('records', data, _records); 
      _records = data; notifyDataChange(); 
  },
  
  saveCashflows: async (data: CashflowRecord[]) => { 
      await batchSyncCollection('cashflow', data, _cashflow); 
      _cashflow = data; notifyDataChange(); 
  },
  
  saveCounselingSessions: async (data: CounselingSession[]) => { 
      await batchSyncCollection('counseling', data, _counseling); 
      _counseling = data; notifyDataChange(); 
  },
  
  saveSanctions: async (data: StudentSanction[]) => { 
      await batchSyncCollection('sanctions', data, _sanctions); 
      _sanctions = data; notifyDataChange(); 
  },

  // --- CONFIG SAVERS (Single Doc) ---
  saveCategories: async (data: MasterCategory[]) => { 
      await saveSingleDocConfig('categories', data); 
      _categories = data; notifyDataChange(); 
  },
  
  saveIncidentTypes: async (data: MasterIncidentType[]) => { 
      await saveSingleDocConfig('incidentTypes', data); 
      _incidents = data; notifyDataChange(); 
  },
  
  saveRules: async (data: CoachingRule[]) => { 
      await saveSingleDocConfig('rules', data); 
      _rules = data; notifyDataChange(); 
  },

  // --- BUSINESS LOGIC (Unchanged) ---

  login: async (username: string, password: string): Promise<Teacher | null> => {
    if (!isInitialLoadComplete) return null;
    const foundUser = _teachers.find(t => t.username === username && t.password === password);
    if (foundUser) {
      sessionStorage.setItem('session_user_id', foundUser.id);
      return foundUser;
    }
    // Super Admin Fallback
    if (username === 'admin' && password === '123' && _teachers.length === 0) {
       const superAdmin: Teacher = { id: 'super_admin', name: 'Admin', nip: '000', roles: [Role.ADMIN], username: 'admin', password: '123', mustChangePassword: false };
       return superAdmin;
    }
    return null;
  },

  getCurrentUser: (): Teacher | null => {
    const storedId = sessionStorage.getItem('session_user_id');
    return _teachers.find(t => t.id === storedId) || null;
  },

  logout: () => { sessionStorage.removeItem('session_user_id'); },

  finalizeSession: async (userId: string) => {
    await DataService.updateHeartbeat(userId);
  },

  updatePassword: async (userId: string, newPass: string) => {
    const updated = _teachers.map(t => t.id === userId ? { ...t, password: newPass, mustChangePassword: false } : t);
    await DataService.saveTeachers(updated);
  },

  updateHeartbeat: async (userId: string) => {
    // Optimistic Update
    const user = _teachers.find(t => t.id === userId);
    if (user) {
        const now = new Date().toISOString();
        const updatedUser = { ...user, lastActiveAt: now };
        // Direct update to DB for heartbeat to avoid full array sync overhead
        if (db) await setDoc(doc(db, "teachers", userId), { lastActiveAt: now }, { merge: true });
    }
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
    
    const getThreshold = (keyword: string, defaultVal: number) => {
       const rule = _rules.find(r => r.statusLabel.toUpperCase().replace(/\s/g, '').includes(keyword.replace(/\s/g, '')));
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
        await DataService.saveSanctions([..._sanctions, newSanction]);
        return newLevel;
    }
    return null;
  },

  resolveIncident: async (recordId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', reason?: string) => {
    let bkThreshold = 40;
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
    // Cleanup implementation is complex with collections.
    // For now, simpler implementation:
    const validStudentIds = new Set(_students.map(s => s.id));
    
    const recordsToDelete = _records.filter(r => !validStudentIds.has(r.studentId));
    const sanctionsToDelete = _sanctions.filter(s => !validStudentIds.has(s.studentId));
    const counselingToDelete = _counseling.filter(s => !validStudentIds.has(s.studentId));

    const batch = writeBatch(db);
    recordsToDelete.forEach(x => batch.delete(doc(db, "records", x.id)));
    sanctionsToDelete.forEach(x => batch.delete(doc(db, "sanctions", x.id)));
    counselingToDelete.forEach(x => batch.delete(doc(db, "counseling", x.id)));
    
    await batch.commit();
    return { recordsDeleted: recordsToDelete.length, sanctionsDeleted: sanctionsToDelete.length, counselingDeleted: counselingToDelete.length };
  },

  exportDataJSON: () => {
    const backupData = {
        teachers: _teachers, students: _students, classes: _classes, records: _records,
        categories: _categories, incidents: _incidents, rules: _rules,
        counseling: _counseling, sanctions: _sanctions, cashflow: _cashflow,
        generatedAt: new Date().toISOString()
    };
    return JSON.stringify(backupData, null, 2);
  },

  restoreDataJSON: async (jsonString: string) => {
      try {
          const data = JSON.parse(jsonString);
          if (!data.students) throw new Error("Invalid Backup");
          // Restore using the new save methods (Batch Sync)
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
