
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

// --- INITIAL MOCK DATA (Fallback if DB is empty) ---
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
const INITIAL_RULES: CoachingRule[] = [
  { id: 'r1', minPoints: 0, maxPoints: 19, statusLabel: 'Normal', color: 'bg-green-100 text-green-800' },
  { id: 'r2', minPoints: 20, maxPoints: 9999, statusLabel: 'Perlu Pembinaan', color: 'bg-red-100 text-red-800' },
];

// Helper for LocalStorage
const loadFromStorage = <T,>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : initial;
};

const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Helper for Firestore Sync (Fire and Forget)
const syncToCloud = async (collectionName: string, data: any) => {
  if (!db) return; // Skip if no firebase config
  try {
    // We store the entire array as a single document for simplicity in this MVP
    // In a massive scale app, you would store each item as a doc.
    await setDoc(doc(db, "school_data", collectionName), { data: data });
  } catch (error) {
    console.error(`Gagal upload ${collectionName} ke cloud:`, error);
  }
};

export const DataService = {
  // --- INITIALIZATION ---
  // This function must be called when App starts
  initializeData: async (): Promise<boolean> => {
    if (!db) return false; // Offline mode

    try {
      const collections = [
        'classes', 'students', 'categories', 'incidentTypes', 
        'rules', 'records', 'teachers', 'counseling', 'sanctions'
      ];

      // Download all collections parallelly
      const promises = collections.map(col => getDoc(doc(db, "school_data", col)));
      const snapshots = await Promise.all(promises);

      let hasData = false;

      snapshots.forEach((snap, index) => {
        const colName = collections[index];
        if (snap.exists()) {
          const remoteData = snap.data().data;
          // Overwrite local storage with cloud data
          saveToStorage(colName, remoteData);
          hasData = true;
        }
      });

      return hasData;
    } catch (e) {
      console.error("Gagal sinkronisasi data awal:", e);
      return false;
    }
  },

  // --- GETTERS (Read from LocalStorage for speed) ---
  getClasses: () => loadFromStorage<ClassGroup[]>('classes', INITIAL_CLASSES),
  getStudents: () => loadFromStorage<Student[]>('students', INITIAL_STUDENTS),
  getCategories: () => loadFromStorage<MasterCategory[]>('categories', INITIAL_CATEGORIES),
  getIncidentTypes: () => loadFromStorage<MasterIncidentType[]>('incidentTypes', INITIAL_INCIDENTS),
  getRules: () => loadFromStorage<CoachingRule[]>('rules', INITIAL_RULES),
  // FIX: Explicitly type these empty arrays so TS knows what they contain
  getRecords: () => loadFromStorage<IncidentRecord[]>('records', []),
  getCounselingSessions: () => loadFromStorage<CounselingSession[]>('counseling', []),
  getSanctions: () => loadFromStorage<StudentSanction[]>('sanctions', []),

  getTeachers: (): Teacher[] => {
    let teachers = loadFromStorage<Teacher[]>('teachers', INITIAL_TEACHERS);
    // Migration helper (same as before)
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

  // --- SETTERS (Write to LocalStorage AND Cloud) ---
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
    
    // Default fallback logic preserved
    if (!user) {
        const defaultAdmin = INITIAL_TEACHERS.find(t => t.roles.includes(Role.ADMIN));
        if (defaultAdmin && username === defaultAdmin.username && password === defaultAdmin.password) {
            const existingAdminIndex = teachers.findIndex(t => t.roles.includes(Role.ADMIN));
            if (existingAdminIndex === -1) {
                const newTeachers = [...teachers, defaultAdmin];
                DataService.saveTeachers(newTeachers); // Syncs to cloud
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
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        return updatedUser;
      }
      return t;
    });
    DataService.saveTeachers(updatedTeachers); // Syncs to cloud
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
