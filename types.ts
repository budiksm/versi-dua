
export enum Role {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER', // Guru Mapel
  BK = 'BK',
  KESISWAAN = 'KESISWAAN',
  WALIKELAS = 'WALIKELAS',
  STUDENT = 'STUDENT', // Bendahara Kelas
  OSIS = 'OSIS', // Petugas Gerbang (Pencatat Keterlambatan)
}

export enum IncidentTypeCategory {
  VIOLATION = 'VIOLATION',
  ACHIEVEMENT = 'ACHIEVEMENT',
  REDEMPTION = 'REDEMPTION', // Penebusan Poin
}

export interface Teacher {
  id: string;
  name: string;
  nip: string; // Bisa NIS untuk siswa
  roles: Role[]; 
  username?: string; 
  password?: string;
  mustChangePassword?: boolean; // Flag to force password change
  assignedClassId?: string; // Khusus Role STUDENT agar tahu kelas mana
  lastActiveAt?: string; // Timestamp terakhir online
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  role: string;
  action: 'LOGIN' | 'LOGOUT' | 'SYNC';
  timestamp: string;
  deviceInfo?: string; // Optional: Browser/OS info
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "X IPA 1"
  level: number; // e.g. 10
  homeroomTeacherId?: string; // Link to Teacher
}

export interface Student {
  id: string;
  name: string;
  nis: string;
  classId: string;
  gender: 'L' | 'P';
  birthPlace?: string;
  birthDate?: string; // YYYY-MM-DD
  address?: string;
  parentPhone?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'MOVED';
}

export interface MasterCategory {
  id: string;
  name: string; 
  targetType: IncidentTypeCategory; 
}

export interface MasterIncidentType {
  id: string;
  name: string; 
  categoryId: string;
  type: IncidentTypeCategory;
  points: number; 
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isActive: boolean;
}

export type IncidentStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

// UPDATED: Added 'MONITORING' for routine checks
export type BkCounselingStatus = 'NONE' | 'REQUIRED' | 'COMPLETED' | 'REFERRED' | 'RETURNED_TO_BK' | 'REFERRED_TO_KESISWAAN' | 'MONITORING'; 

export interface IncidentRecord {
  id: string;
  studentId: string;
  incidentTypeId: string;
  date: string; // ISO String
  notes: string;
  proofImage?: string; 
  recordedBy: string; 
  pointSnapshot: number; 
  typeSnapshot: IncidentTypeCategory;
  
  // Approval Logic
  status?: IncidentStatus; 
  rejectionReason?: string;

  // BK Logic (New)
  bkStatus?: BkCounselingStatus;
  nextEvaluationDate?: string; // NEW: For Routine Monitoring Target
}

export interface CoachingRule {
  id: string;
  minPoints: number;
  maxPoints: number;
  statusLabel: string; 
  color: string; 
}

export interface CounselingSession {
  id: string;
  studentId: string;
  counselorId: string;
  counselorName: string;
  date: string;
  notes: string; 
  // Added ROUTINE_MONITORING
  recommendation: 'NONE' | 'PARENT_CALL' | 'TO_KESISWAAN' | 'SUSPENSION_REVIEW' | 'TO_BK' | 'ROUTINE_MONITORING' | 'COMPLETED';
  status: 'OPEN' | 'COMPLETED'; // CHANGED: Standardized from CLOSED to COMPLETED
  sessionType?: 'BK' | 'HOMEROOM' | 'KESISWAAN'; 
  relatedRecordIds?: string[]; 
  attachmentUrl?: string; 
}

export enum SanctionLevel {
  SP1 = 'SP1',
  SP2 = 'SP2',
  SP3 = 'SP3',
  SKORSING = 'SKORSING',
  DROP_OUT = 'DROP_OUT'
}

export enum RedemptionStatus {
  NONE = 'NONE',         
  ASSIGNED = 'ASSIGNED', 
  IN_PROGRESS = 'IN_PROGRESS', 
  COMPLETED = 'COMPLETED' 
}

export interface StudentSanction {
  id: string;
  studentId: string;
  level: SanctionLevel; 
  assignedBy: string; 
  assignedDate: string;
  notes: string; 
  
  redemptionStatus: RedemptionStatus;
  redemptionTask?: string; 
  redemptionDate?: string; 
  isRedeemed?: boolean; 
}

// --- POE IBU (CASHFLOW) TYPES ---
export type CashflowType = 'IN' | 'OUT';
export type CashflowStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTED';

export interface CashflowRecord {
  id: string;
  classId: string;
  type: CashflowType;
  amount: number;
  date: string;
  description: string;
  recipient?: string; 
  
  recordedBy: string; 
  recordedById: string;
  recordedByRole: Role;
  
  status: CashflowStatus;
  
  verifiedBy?: string; 
  verifiedDate?: string;
  
  isCorrection?: boolean; 
  originalRecordId?: string; 
}
