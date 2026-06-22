export type Role = "Admin" | "Manager" | "Production" | "PPC" | "QC";

export interface User {
  id: string; // EMP001 etc.
  fullName: string;
  username: string;
  passwordHash: string; // Plaintext for demo
  role: Role;
  shift: "A" | "B" | "C";
  assignedStage?: string;
  assignedStation?: string;
  contact?: string;
  joinDate: string;
  status: "Active" | "Inactive";
  createdBy?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface ActiveSession {
  userId: string;
  stage: string;
  station: string;
  jobOrder: string;
  lotNumber: string;
  shift: "A" | "B" | "C";
  startTime: string;
  cardsSubmitted: number;
  totalPass: number;
  totalReject: number;
  totalRework: number;
}

export interface Station {
  id: string;
  name: string;
  status: "Available" | "Occupied" | "Idle";
  currentOperator?: string;
}

export interface Stage {
  id: string; // 1, 2, 3, 4, 5
  name: string;
  stations: Station[];
}

export interface JobOrder {
  id: string; // JOB-2025-001
  product: string;
  customer: string;
  qty: number;
  priority: "High" | "Medium" | "Low" | "Critical";
  dueDate: string;
  status: "Pending" | "In Progress" | "Flagged" | "Completed" | "Cancelled";
  line?: string;
  notes?: string;
}

export interface Lot {
  id: string; // LOT-2025-A001
  jobId: string;
  qty: number;
  status: "Pending" | "In Progress" | "Flagged" | "Completed";
  currentStage?: string;
  currentStation?: string;
  passQty: number;
  rejectQty: number;
}

export interface DefectItem {
  categoryCode: string; // DEF-01
  categoryName: string;
  count: number;
  description?: string;
}

export interface TrackingCard {
  id: string; // TRK-2025-0001
  jobId: string;
  lotId: string;
  operatorName: string;
  prevStage: string;
  prevStation: string;
  currentStage: string;
  currentStation: string;
  nextStage: string;
  nextStation: string;
  componentsIn: number;
  componentsProcessed: number;
  passQty: number;
  rejectQty: number;
  reworkQty: number;
  defects: DefectItem[];
  status: "Pass" | "Reject" | "Rework" | "In Progress" | "Pending";
  timestamp: string; // Time: "09:14" or "12:30", full ISO string formatted inside
  reason?: string;
  remarks?: string;
}

export interface DefectCategory {
  code: string; // DEF-01
  name: string;
  stageGroup: string; // "Soldering", "Assembly", etc.
  severity: "Low" | "Medium" | "High" | "Critical";
  count: number;
}

export interface Alert {
  id: string; // ALERT-001
  level: "Low" | "Medium" | "High" | "Critical";
  message: string;
  barcodeId?: string;
  jobId?: string;
  lotId?: string;
  stage?: string;
  station?: string;
  time: string;
  acknowledged: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  role: Role;
  action: string;
  module: string;
  details: string;
}

export interface StageTarget {
  stageId: string;
  stageName: string;
  shift: "A" | "B" | "C";
  target: number;
  actual: number;
  stations: {
    stationId: string;
    stationName: string;
    target: number;
    actual: number;
  }[];
}
