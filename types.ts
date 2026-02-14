
export enum Role {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER', // Guru Mapel
  BK = 'BK',
  KESISWAAN = 'KESISWAAN',
  WALIKELAS = 'WALIKELAS',
}

export enum IncidentTypeCategory {
  VIOLATION = 'VIOLATION',
  ACHIEVEMENT = 'ACHIEVEMENT',
  REDEMPTION = 'REDEMPTION', // Penebusan Poin
}

export interface Teacher {
  id: string;
  name: string;
  nip: string;
  roles: Role[]; 
  username?: string; 
  password?: string;
  mustChangePassword?: boolean; // Flag to force password change
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
  recommendation: 'NONE' | 'PARENT_CALL' | 'TO_KESISWAAN' | 'SUSPENSION_REVIEW';
  status: 'OPEN' | 'CLOSED';
}

export enum SanctionLevel {
  SP1 = 'SP1',
  SP2 = 'SP2',
  SP3 = 'SP3',
  SKORSING = 'SKORSING',
  DROP_OUT = 'DROP_OUT'
}

export enum RedemptionStatus {
  NONE = 'NONE',         // Belum ada tugas penebusan / belum dikerjakan
  ASSIGNED = 'ASSIGNED', // Tugas diberikan
  IN_PROGRESS = 'IN_PROGRESS', // Sedang dikerjakan
  COMPLETED = 'COMPLETED' // Selesai
}

export interface StudentSanction {
  id: string;
  studentId: string;
  level: SanctionLevel; 
  assignedBy: string; 
  assignedDate: string;
  notes: string; // Alasan SP
  
  // Redemption Logic
  redemptionStatus: RedemptionStatus;
  redemptionTask?: string; // e.g. "Membersihkan Perpustakaan selama 3 hari"
  redemptionDate?: string; // Tanggal selesai
  isRedeemed?: boolean; // Backward compatibility
}
