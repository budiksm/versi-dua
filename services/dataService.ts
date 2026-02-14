
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
  RedemptionStatus 
} from '../types';

import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// --- SYNC STATUS MANAGEMENT ---
export type SyncState = 'IDLE' | 'SYNCING' | 'SAVED' | 'ERROR';
let currentSyncState: SyncState = 'IDLE';
let lastSyncTime: Date | null = null;
let lastError: string | null = null;
// Update listener signature to include error message
let syncListeners: ((state: SyncState, time: Date | null, error: string | null) => void)[] = [];

const notifyListeners = (state: SyncState, errorMsg: string | null = null) => {
  currentSyncState = state;
  lastError = errorMsg;
  if (state === 'SAVED') {
    lastSyncTime = new Date();
    lastError = null;
  }
  syncListeners.forEach(l => l(state, lastSyncTime, lastError));
};

// --- INITIAL MOCK DATA ---
const INITIAL_TEACHERS: Teacher[] = [
  { id: 'admin1', name: 'Administrator', nip: '000000', roles: [Role.ADMIN], username: 'admin', password: '123', mustChangePassword: false },
  { id: 't1', name: 'Budi Raharjo, S.Pd', nip: '19800101', roles: [Role.TEACHER, Role.WALIKELAS], username: 'budi', password: '123', mustChangePassword: false },
];
const INITIAL_CLASSES: ClassGroup[] = [{ id: 'c1', name: 'X IPA 1', level: 10, homeroomTeacherId: 't1' }];
const INITIAL_STUDENTS: Student[] = [{ id: 's1', name: 'Contoh Siswa', nis: '1001', classId: 'c1', gender: 'L', status: 'ACTIVE' }];
const INITIAL_CATEGORIES: MasterCategory[] = [
  { id: 'cat1', name: 'Kedisiplinan', targetType: IncidentTypeCategory.VIOLATION },
  { id: 'cat5', name: 'Prestasi', targetType: IncidentTypeCategory.ACHIEVEMENT },
  { id: 'cat6', name: 'Penebusan', targetType: IncidentTypeCategory.REDEMPTION },
];
const INITIAL_INCIDENTS: MasterIncidentType[] = [
  { id: 'inc1', name: 'Terlambat', categoryId: 'cat1', type: IncidentTypeCategory.VIOLATION, points: 5, severity: 'LOW', isActive: true },
];

// UPDATED RULES SESUAI REQUEST
const INITIAL_RULES: CoachingRule[] = [
  { id: 'r1', minPoints: 0, maxPoints: 19, statusLabel: 'Normal', color: 'bg-green-100 text-green-800' },
  { id: 'r2', minPoints: 20, maxPoints: 39, statusLabel: 'Pembinaan Wali Kelas', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'r3', minPoints: 40, maxPoints: 79, statusLabel: 'Pembinaan BK + Ortu', color: 'bg-orange-100 text-orange-800' },
  { id: 'r4', minPoints: 80, maxPoints: 119, statusLabel: 'SP 1', color: 'bg-red-100 text-red-800' },
  { id: 'r5', minPoints: 120, maxPoints: 159, statusLabel: 'SP 2', color: 'bg-red-200 text-red-900' },
  { id: 'r6', minPoints: 160, maxPoints: 9999, statusLabel: 'SP 3', color: 'bg-red-600 text-white' },
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
  
  notifyListeners('SYNCING');
  try {
    // Basic check for undefined in array which Firestore hates
    const cleanData = JSON.parse(JSON.stringify(data)); 
    
    await setDoc(doc(db, "school_data", collectionName), { data: cleanData });
    notifyListeners('SAVED');
    console.log(`[Cloud] Synced ${collectionName} successfully.`);
  } catch (error: any) {
    console.error(`[Cloud] Failed to sync ${collectionName}:`, error);
    
    let errorMsg = error.message || "Unknown error";
    
    // Translate common errors
    if (error.code === 'permission-denied') {
        errorMsg = "IZIN DITOLAK (Permission Denied). Cek Tab 'Rules' di Console Firebase Anda.";
    } else if (error.code === 'resource-exhausted') {
        errorMsg = "Dokumen terlalu besar (>1MB).";
    } else if (error.code === 'unavailable') {
        errorMsg = "Koneksi ke server Firestore gagal (Offline).";
    } else if (error.code === 'invalid-argument') {
        errorMsg = "Format data tidak valid (Invalid Argument).";
    }
    
    notifyListeners('ERROR', errorMsg);
  }
};

export const DataService = {
  // --- SYNC SUBSCRIPTION ---
  subscribeToSync: (callback: (state: SyncState, time: Date | null, error: string | null) => void) => {
    syncListeners.push(callback);
    callback(currentSyncState, lastSyncTime, lastError); // Initial call
    return () => { syncListeners = syncListeners.filter(l => l !== callback); };
  },

  // --- INITIALIZATION ---
  initializeData: async (): Promise<boolean> => {
    if (!db) {
        console.warn("DB not initialized, running offline.");
        return false;
    }

    try {
      const collections = [
        'classes', 'students', 'categories', 'incidentTypes', 
        'rules', 'records', 'teachers', 'counseling', 'sanctions'
      ];

      notifyListeners('SYNCING');
      
      const promises = collections.map(col => getDoc(doc(db, "school_data", col)));
      const snapshots = await Promise.all(promises);

      let hasData = false;

      snapshots.forEach((snap, index) => {
        const colName = collections[index];
        if (snap.exists()) {
          const remoteData = snap.data().data;
          saveToStorage(colName, remoteData);
          hasData = true;
        }
      });
      
      notifyListeners('SAVED');
      return hasData;
    } catch (e: any) {
      console.error("Gagal sinkronisasi data awal:", e);
      let msg = e.message;
      if(e.code === 'permission-denied') msg = "Izin Baca Ditolak. Cek Rules.";
      notifyListeners('ERROR', msg);
      return false;
    }
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
      saveToStorage('teachers', migrated);
      syncToCloud('teachers', migrated);
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

  // --- AUTH ---
  login: (username: string, password: string): Teacher | null => {
    const teachers = DataService.getTeachers(); 
    let user = teachers.find(t => t.username === username && t.password === password);
    
    if (!user) {
        const defaultAdmin = INITIAL_TEACHERS.find(t => t.roles.includes(Role.ADMIN));
        if (defaultAdmin && username === defaultAdmin.username && password === defaultAdmin.password) {
            const existingAdminIndex = teachers.findIndex(t => t.roles.includes(Role.ADMIN));
            if (existingAdminIndex === -1) {
                const newTeachers = [...teachers, defaultAdmin];
                DataService.saveTeachers(newTeachers); 
            }
            user = defaultAdmin;
        }
    }

    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: () => {
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

    studentRecords.forEach(record => {
      if (record.typeSnapshot === IncidentTypeCategory.VIOLATION) {
        grossViolationPoints += record.pointSnapshot;
        violationCount++;
      } else if (record.typeSnapshot === IncidentTypeCategory.REDEMPTION) {
        redemptionCount++;
      } else if (record.typeSnapshot === IncidentTypeCategory.ACHIEVEMENT) {
        achievementPoints += record.pointSnapshot;
        achievementCount++;
      }
    });

    let effectiveViolationScore = grossViolationPoints;
    return { effectiveViolationScore, grossViolationPoints, achievementPoints, violationCount, achievementCount, redemptionCount };
  },

  getCoachingStatus: (violationScore: number, rules: CoachingRule[]) => {
    const rule = rules.find(r => violationScore >= r.minPoints && violationScore <= r.maxPoints);
    return rule || { id: 'unknown', minPoints: 0, maxPoints: 0, statusLabel: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  }
};
