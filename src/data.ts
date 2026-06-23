import { supabase } from "./lib/supabase";
import { User, Stage, JobOrder, Lot, TrackingCard, DefectCategory, Alert, AuditLog, StageTarget, Role } from "./types";

// ── In-Memory Caches ──────────────────────────────────────────
let cachedUsers: User[] = [];
let cachedStages: Stage[] = [];
let cachedJobOrders: JobOrder[] = [];
let cachedLots: Lot[] = [];
let cachedTrackingCards: TrackingCard[] = [];
let cachedDefectCategories: DefectCategory[] = [];
let cachedAlerts: Alert[] = [];
let cachedTargets: StageTarget[] = [];
let cachedAuditLogs: AuditLog[] = [];

// ── Default Mock Data Definitions ──────────────────────────────
const DEFAULT_USERS: User[] = [
  {
    id: "EMP001",
    fullName: "System Admin",
    username: "admin",
    passwordHash: "admin123",
    role: "Admin",
    shift: "A",
    status: "Active",
    joinDate: "2026-01-01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "EMP002",
    fullName: "Production Manager",
    username: "manager",
    passwordHash: "mgr123",
    role: "Manager",
    shift: "A",
    status: "Active",
    joinDate: "2026-01-01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "EMP003",
    fullName: "Operator One",
    username: "prod1",
    passwordHash: "prod123",
    role: "Production",
    shift: "A",
    assignedStage: "PCB Assembly",
    assignedStation: "PCB-ST01",
    status: "Active",
    joinDate: "2026-01-01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "EMP004",
    fullName: "Operator Two",
    username: "prod2",
    passwordHash: "prod123",
    role: "Production",
    shift: "B",
    assignedStage: "PCB Assembly",
    assignedStation: "PCB-ST02",
    status: "Active",
    joinDate: "2026-01-01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "EMP005",
    fullName: "PPC Planner",
    username: "ppc1",
    passwordHash: "ppc123",
    role: "PPC",
    shift: "A",
    status: "Active",
    joinDate: "2026-01-01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "EMP006",
    fullName: "QC Inspector",
    username: "qc1",
    passwordHash: "qa123",
    role: "QC",
    shift: "A",
    status: "Active",
    joinDate: "2026-01-01",
    createdAt: new Date().toISOString(),
  }
];

const DEFAULT_STAGES: Stage[] = [
  {
    id: "1",
    name: "PCB Assembly",
    stations: [
      { id: "PCB-ST01", name: "PCB Assembly Station 1", status: "Available" },
      { id: "PCB-ST02", name: "PCB Assembly Station 2", status: "Available" },
      { id: "PCB-ST03", name: "PCB Assembly Station 3", status: "Idle" }
    ]
  },
  {
    id: "2",
    name: "Soldering",
    stations: [
      { id: "SLD-ST01", name: "Reflow Soldering Line 1", status: "Available" },
      { id: "SLD-ST02", name: "Wave Soldering Line 2", status: "Available" }
    ]
  },
  {
    id: "3",
    name: "AOI Inspection",
    stations: [
      { id: "AOI-ST01", name: "Automated Optical Inspection 1", status: "Available" },
      { id: "AOI-ST02", name: "Automated Optical Inspection 2", status: "Available" }
    ]
  },
  {
    id: "4",
    name: "Functional Test",
    stations: [
      { id: "FNT-ST01", name: "FCT Testing Station 1", status: "Available" },
      { id: "FNT-ST02", name: "FCT Testing Station 2", status: "Available" }
    ]
  },
  {
    id: "5",
    name: "Final Packing",
    stations: [
      { id: "PCK-ST01", name: "Packaging & Labeling Station", status: "Available" }
    ]
  }
];

const DEFAULT_JOB_ORDERS: JobOrder[] = [
  {
    id: "JOB-2025-001",
    product: "Smart Controller V2",
    customer: "Tesla Inc.",
    qty: 1500,
    priority: "High",
    dueDate: "2026-07-15",
    status: "In Progress"
  },
  {
    id: "JOB-2025-002",
    product: "IoT Gateway Pro",
    customer: "Siemens AG",
    qty: 800,
    priority: "Medium",
    dueDate: "2026-07-20",
    status: "Pending"
  },
  {
    id: "JOB-2025-003",
    product: "Display Panel Module",
    customer: "Samsung Electronics",
    qty: 2000,
    priority: "Critical",
    dueDate: "2026-06-30",
    status: "Flagged"
  },
  {
    id: "JOB-2025-004",
    product: "Power Adapter 45W",
    customer: "Apple Inc.",
    qty: 5000,
    priority: "Low",
    dueDate: "2026-08-01",
    status: "Completed"
  }
];

const DEFAULT_LOTS: Lot[] = [
  {
    id: "LOT-2025-A001",
    jobId: "JOB-2025-001",
    qty: 250,
    status: "In Progress",
    currentStage: "PCB Assembly",
    currentStation: "PCB-ST01",
    passQty: 240,
    rejectQty: 10
  },
  {
    id: "LOT-2025-A002",
    jobId: "JOB-2025-001",
    qty: 250,
    status: "Pending",
    currentStage: "PCB Assembly",
    currentStation: "PCB-ST02",
    passQty: 0,
    rejectQty: 0
  },
  {
    id: "LOT-2025-B001",
    jobId: "JOB-2025-003",
    qty: 500,
    status: "Flagged",
    currentStage: "AOI Inspection",
    currentStation: "AOI-ST01",
    passQty: 450,
    rejectQty: 50
  }
];

const DEFAULT_DEFECT_CATEGORIES: DefectCategory[] = [
  { code: "DEF-01", name: "Solder Bridge", stageGroup: "Soldering", severity: "High", count: 15 },
  { code: "DEF-02", name: "Missing Component", stageGroup: "PCB Assembly", severity: "High", count: 8 },
  { code: "DEF-03", name: "Misaligned Part", stageGroup: "PCB Assembly", severity: "Medium", count: 12 },
  { code: "DEF-04", name: "Cold Joint", stageGroup: "Soldering", severity: "Critical", count: 25 },
  { code: "DEF-05", name: "Scratched Housing", stageGroup: "Final Packing", severity: "Low", count: 5 }
];

const DEFAULT_TRACKING_CARDS: TrackingCard[] = [
  {
    id: "TRK-2025-0001",
    jobId: "JOB-2025-001",
    lotId: "LOT-2025-A001",
    operatorName: "Operator One",
    prevStage: "None",
    prevStation: "None",
    currentStage: "PCB Assembly",
    currentStation: "PCB-ST01",
    nextStage: "Soldering",
    nextStation: "SLD-ST01",
    componentsIn: 250,
    componentsProcessed: 250,
    passQty: 248,
    rejectQty: 2,
    reworkQty: 0,
    defects: [{ categoryCode: "DEF-02", categoryName: "Missing Component", count: 2, description: "Two caps missing" }],
    status: "Pass",
    timestamp: "09:15"
  },
  {
    id: "TRK-2025-0002",
    jobId: "JOB-2025-001",
    lotId: "LOT-2025-A001",
    operatorName: "Operator One",
    prevStage: "PCB Assembly",
    prevStation: "PCB-ST01",
    currentStage: "Soldering",
    currentStation: "SLD-ST01",
    nextStage: "AOI Inspection",
    nextStation: "AOI-ST01",
    componentsIn: 248,
    componentsProcessed: 248,
    passQty: 240,
    rejectQty: 8,
    reworkQty: 5,
    defects: [{ categoryCode: "DEF-01", categoryName: "Solder Bridge", count: 8, description: "Bridges on MCU pins" }],
    status: "Rework",
    timestamp: "10:30"
  },
  {
    id: "TRK-2025-0003",
    jobId: "JOB-2025-003",
    lotId: "LOT-2025-B001",
    operatorName: "Operator Two",
    prevStage: "None",
    prevStation: "None",
    currentStage: "PCB Assembly",
    currentStation: "PCB-ST02",
    nextStage: "Soldering",
    nextStation: "SLD-ST02",
    componentsIn: 500,
    componentsProcessed: 500,
    passQty: 480,
    rejectQty: 20,
    reworkQty: 0,
    defects: [{ categoryCode: "DEF-03", categoryName: "Misaligned Part", count: 20, description: "Resistor array rotated" }],
    status: "Pass",
    timestamp: "11:00"
  }
];

const DEFAULT_ALERTS: Alert[] = [
  {
    id: "ALERT-001",
    level: "High",
    message: "High reject rate detected at Soldering stage SLD-ST01",
    barcodeId: "TRK-2025-0002",
    jobId: "JOB-2025-001",
    lotId: "LOT-2025-A001",
    stage: "Soldering",
    station: "SLD-ST01",
    time: "10:32",
    acknowledged: false
  },
  {
    id: "ALERT-002",
    level: "Medium",
    message: "Station PCB-ST03 has been idle for more than 2 hours",
    station: "PCB-ST03",
    time: "11:45",
    acknowledged: false
  }
];

const DEFAULT_STAGE_TARGETS: StageTarget[] = [];
const shifts: ("A" | "B" | "C")[] = ["A", "B", "C"];
const stageNames = ["PCB Assembly", "Soldering", "AOI Inspection", "Functional Test", "Final Packing"];
stageNames.forEach((name, idx) => {
  const stageId = String(idx + 1);
  shifts.forEach(shift => {
    DEFAULT_STAGE_TARGETS.push({
      stageId,
      stageName: name,
      shift,
      target: shift === "A" ? 1000 : 800,
      actual: shift === "A" && stageId === "1" ? 498 : 0,
      stations: DEFAULT_STAGES[idx].stations.map(st => ({
        stationId: st.id,
        stationName: st.name,
        target: shift === "A" ? 500 : 400,
        actual: shift === "A" && st.id === "PCB-ST01" ? 250 : (shift === "A" && st.id === "PCB-ST02" ? 248 : 0)
      }))
    });
  });
});

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: "LOG-0001",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    username: "admin",
    role: "Admin",
    action: "LOGIN",
    module: "System",
    details: "Administrator logged in to console."
  },
  {
    id: "LOG-0002",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    username: "prod1",
    role: "Production",
    action: "CREATE",
    module: "Production Shift",
    details: "Began scanning at station PCB-ST01 for Lot LOT-2025-A001"
  }
];

// Load defaults into cache on start as a backup
function loadDefaults() {
  cachedUsers = [...DEFAULT_USERS];
  cachedStages = [...DEFAULT_STAGES];
  cachedJobOrders = [...DEFAULT_JOB_ORDERS];
  cachedLots = [...DEFAULT_LOTS];
  cachedTrackingCards = [...DEFAULT_TRACKING_CARDS];
  cachedDefectCategories = [...DEFAULT_DEFECT_CATEGORIES];
  cachedAlerts = [...DEFAULT_ALERTS];
  cachedTargets = [...DEFAULT_STAGE_TARGETS];
  cachedAuditLogs = [...DEFAULT_AUDIT_LOGS];
}
loadDefaults();

// ── Local Storage Fallback Helpers ─────────────────────────────
const LS_PREFIX = "traceiq_fallback_";
function loadFromLocalStorage() {
  console.log("Loading datasets from localStorage fallback...");
  try {
    const users = localStorage.getItem(LS_PREFIX + "users");
    const stages = localStorage.getItem(LS_PREFIX + "stages");
    const jobOrders = localStorage.getItem(LS_PREFIX + "job_orders");
    const lots = localStorage.getItem(LS_PREFIX + "lots");
    const trackingCards = localStorage.getItem(LS_PREFIX + "tracking_cards");
    const defectCategories = localStorage.getItem(LS_PREFIX + "defect_categories");
    const alerts = localStorage.getItem(LS_PREFIX + "alerts");
    const targets = localStorage.getItem(LS_PREFIX + "targets");
    const auditLogs = localStorage.getItem(LS_PREFIX + "audit_logs");

    if (users) cachedUsers = JSON.parse(users);
    if (stages) cachedStages = JSON.parse(stages);
    if (jobOrders) cachedJobOrders = JSON.parse(jobOrders);
    if (lots) cachedLots = JSON.parse(lots);
    if (trackingCards) cachedTrackingCards = JSON.parse(trackingCards);
    if (defectCategories) cachedDefectCategories = JSON.parse(defectCategories);
    if (alerts) cachedAlerts = JSON.parse(alerts);
    if (targets) cachedTargets = JSON.parse(targets);
    if (auditLogs) cachedAuditLogs = JSON.parse(auditLogs);
  } catch (err) {
    console.error("Local storage load failed:", err);
  }
}

function saveToLocalStorage(key: string, data: any) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
  } catch (err) {
    console.error(`Local storage save for ${key} failed:`, err);
  }
}

// ── Database Seeder ────────────────────────────────────────────
async function seedDefaultData(): Promise<void> {
  if (!supabase) return;
  console.log("Database tables are empty. Seeding defaults...");
  try {
    await Promise.all([
      supabase.from("users").upsert(DEFAULT_USERS),
      supabase.from("stages").upsert(DEFAULT_STAGES),
      supabase.from("job_orders").upsert(DEFAULT_JOB_ORDERS),
      supabase.from("lots").upsert(DEFAULT_LOTS),
      supabase.from("tracking_cards").upsert(DEFAULT_TRACKING_CARDS),
      supabase.from("defect_categories").upsert(DEFAULT_DEFECT_CATEGORIES),
      supabase.from("alerts").upsert(DEFAULT_ALERTS),
      supabase.from("stage_targets").upsert(DEFAULT_STAGE_TARGETS),
      supabase.from("audit_logs").upsert(DEFAULT_AUDIT_LOGS)
    ]);
    console.log("Seeding completed successfully.");
  } catch (err) {
    console.error("Seeding database failed:", err);
  }
}

// ── Initialize Supabase Connection ─────────────────────────────
export async function initializeSupabase(): Promise<void> {
  if (!supabase) {
    console.warn("Using local cache fallback: Supabase client is not configured.");
    loadFromLocalStorage();
    return;
  }

  try {
    console.log("Retrieving live dashboard telemetry from Supabase...");
    const [
      { data: users, error: errUsers },
      { data: stages, error: errStages },
      { data: jobOrders, error: errJobOrders },
      { data: lots, error: errLots },
      { data: trackingCards, error: errTrackingCards },
      { data: defectCategories, error: errDefectCategories },
      { data: alerts, error: errAlerts },
      { data: targets, error: errTargets },
      { data: auditLogs, error: errAuditLogs }
    ] = await Promise.all([
      supabase.from("users").select("*"),
      supabase.from("stages").select("*"),
      supabase.from("job_orders").select("*"),
      supabase.from("lots").select("*"),
      supabase.from("tracking_cards").select("*"),
      supabase.from("defect_categories").select("*"),
      supabase.from("alerts").select("*"),
      supabase.from("stage_targets").select("*"),
      supabase.from("audit_logs").select("*").order("timestamp", { ascending: false })
    ]);

    // Check if table schemas exist. If not, trigger error logic.
    if (errUsers || errStages || errJobOrders || errLots || errTrackingCards || errDefectCategories || errAlerts || errTargets || errAuditLogs) {
      console.warn("Supabase fetch error. Tables may not exist yet or are unconfigured. Seeding fallback...", {
        errUsers, errStages, errJobOrders, errLots, errTrackingCards, errDefectCategories, errAlerts, errTargets, errAuditLogs
      });
      loadFromLocalStorage();
      return;
    }

    // Seed if users is completely empty
    if (!users || users.length === 0) {
      await seedDefaultData();
      loadDefaults();
      return;
    }

    // Save outputs to in-memory caches (map snake_case → camelCase)
    cachedUsers = (users ?? []).map(mapUser);
    cachedStages = (stages ?? []).map(mapStage);
    cachedJobOrders = (jobOrders ?? []).map(mapJobOrder);
    cachedLots = (lots ?? []).map(mapLot);
    cachedTrackingCards = (trackingCards ?? []).map(mapCard);
    cachedDefectCategories = (defectCategories ?? []).map(mapDefectCategory);
    cachedAlerts = (alerts ?? []).map(mapAlert);
    cachedTargets = targets ?? [];
    cachedAuditLogs = auditLogs ?? [];

    console.log("TraceIQ telemetry cache refreshed from database.");
  } catch (error) {
    console.error("Supabase sync failed. Booting off local storage fallback.", error);
    loadFromLocalStorage();
  }
}

// ── GETTERS (Synchronous UI Accessors) ──────────────────────────
export function getUsers() { return cachedUsers; }
export function getStages() { return cachedStages; }
export function getJobOrders() { return cachedJobOrders; }
export function getLots() { return cachedLots; }
export function getTrackingCards() { return cachedTrackingCards; }
export function getDefectCategories() { return cachedDefectCategories; }
export function getAlerts() { return cachedAlerts; }
export function getTargets() { return cachedTargets; }
export function getAuditLogs() { return cachedAuditLogs; }

// ── SETTERS (Cache-first Sync and Background DB Updates) ─────────
export function saveUsers(users: User[]) {
  cachedUsers = users;
  saveToLocalStorage("users", users);
  if (supabase) {
    supabase.from("users").upsert(users).then(({ error }) => {
      if (error) console.error("Database save failed for users:", error);
    });
  }
}

export function saveStages(stages: Stage[]) {
  cachedStages = stages;
  saveToLocalStorage("stages", stages);
  if (supabase) {
    supabase.from("stages").upsert(stages).then(({ error }) => {
      if (error) console.error("Database save failed for stages:", error);
    });
  }
}

export function saveJobOrders(jobs: JobOrder[]) {
  cachedJobOrders = jobs;
  saveToLocalStorage("job_orders", jobs);
  if (supabase) {
    supabase.from("job_orders").upsert(jobs).then(({ error }) => {
      if (error) console.error("Database save failed for job orders:", error);
    });
  }
}

export function saveLots(lots: Lot[]) {
  cachedLots = lots;
  saveToLocalStorage("lots", lots);
  if (supabase) {
    supabase.from("lots").upsert(lots).then(({ error }) => {
      if (error) console.error("Database save failed for lots:", error);
    });
  }
}

export function saveTrackingCards(cards: TrackingCard[]) {
  cachedTrackingCards = cards;
  saveToLocalStorage("tracking_cards", cards);
  if (supabase) {
    supabase.from("tracking_cards").upsert(cards).then(({ error }) => {
      if (error) console.error("Database save failed for tracking cards:", error);
    });
  }
}

export function saveDefectCategories(cats: DefectCategory[]) {
  cachedDefectCategories = cats;
  saveToLocalStorage("defect_categories", cats);
  if (supabase) {
    supabase.from("defect_categories").upsert(cats).then(({ error }) => {
      if (error) console.error("Database save failed for defect categories:", error);
    });
  }
}

export function saveAlerts(alerts: Alert[]) {
  cachedAlerts = alerts;
  saveToLocalStorage("alerts", alerts);
  if (supabase) {
    supabase.from("alerts").upsert(alerts).then(({ error }) => {
      if (error) console.error("Database save failed for alerts:", error);
    });
  }
}

export function saveTargets(targets: StageTarget[]) {
  cachedTargets = targets;
  saveToLocalStorage("targets", targets);
  if (supabase) {
    supabase.from("stage_targets").upsert(targets).then(({ error }) => {
      if (error) console.error("Database save failed for stage targets:", error);
    });
  }
}

export function saveAuditLogs(logs: AuditLog[]) {
  cachedAuditLogs = logs;
  saveToLocalStorage("audit_logs", logs);
  if (supabase) {
    supabase.from("audit_logs").upsert(logs).then(({ error }) => {
      if (error) console.error("Database save failed for audit logs:", error);
    });
  }
}

// Helper function to create audit logging traces
export function logAuditAction(
  username: string,
  role: Role,
  action: string,
  module: string,
  details: string
) {
  const nextId = "LOG-" + String(cachedAuditLogs.length + 1).padStart(4, "0");
  const newLog: AuditLog = {
    id: nextId,
    timestamp: new Date().toISOString(),
    username,
    role,
    action,
    module,
    details
  };
  cachedAuditLogs = [newLog, ...cachedAuditLogs];
  saveAuditLogs(cachedAuditLogs);
}
