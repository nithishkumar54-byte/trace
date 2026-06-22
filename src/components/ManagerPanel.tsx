import React, { useState, useEffect } from "react";
import { 
  User, Stage, JobOrder, Lot, TrackingCard, Alert, StageTarget
} from "../types.ts";
import { 
  getUsers, saveUsers, getStages, getJobOrders, getLots, saveLots,
  getTrackingCards, getAlerts, saveAlerts, getTargets, saveTargets, logAuditAction 
} from "../data.ts";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { 
  Award, Bell, BarChart2, ShieldAlert, Calendar, CheckSquare, 
  ChevronsRight, FileText, Clipboard, Search, Filter, Play, ArrowRight,
  TrendingDown, Info, Shield, Plus, Key, Power, Edit2
} from "lucide-react";

interface ManagerPanelProps {
  currentUser: User;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
}

type ManagerTab = "overview" | "explorer" | "jobs" | "targets" | "alerts" | "performance" | "reports" | "users";
type ManagedRole = "Production" | "QC";
type Shift = "A" | "B" | "C";

export function ManagerPanel({ currentUser, onToast }: ManagerPanelProps) {
  // Tabs: "overview" | "explorer" | "jobs" | "targets" | "alerts" | "performance" | "reports" | "users"
  const [activeTab, setActiveTab] = useState<ManagerTab>("overview");

  // State
  const [cards, setCards] = useState<TrackingCard[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [jobs, setJobs] = useState<JobOrder[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [targets, setTargets] = useState<StageTarget[]>([]);

  // Explorer active stage
  const [activeExplorerStageId, setActiveExplorerStageId] = useState("1");

  // Targets active shift
  const [activeShiftTab, setActiveShiftTab] = useState<"A" | "B" | "C">("A");

  // User management limits (Manager only sees Production & QC)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPassResetModal, setShowPassResetModal] = useState(false);
  const [tmpPassword, setTmpPassword] = useState("");
  const [confirmTmpPassword, setConfirmTmpPassword] = useState("");
  const [userFormData, setUserFormData] = useState({
    fullName: "",
    username: "",
    role: "Production" as ManagedRole,
    shift: "A" as Shift,
    assignedStage: "",
    assignedStation: "",
    contact: "",
    joinDate: new Date().toISOString().split("T")[0]
  });

  // Load all tracking models
  useEffect(() => {
    setCards(getTrackingCards());
    setUsers(getUsers());
    setStages(getStages());
    setJobs(getJobOrders());
    setLots(getLots());
    setAlerts(getAlerts());
    setTargets(getTargets());
  }, [activeTab]);

  // Calculations for Stat Cards
  const totalComponents = cards.reduce((sum, c) => sum + c.componentsProcessed, 0);
  const totalPass = cards.reduce((sum, c) => sum + c.passQty, 0);
  const totalReject = cards.reduce((sum, c) => sum + c.rejectQty, 0);
  const totalRework = cards.reduce((sum, c) => sum + c.reworkQty, 0);
  const rejectRate = totalComponents > 0 ? ((totalReject / totalComponents) * 100).toFixed(1) : "0.0";

  // Chart data: Components per stage
  const componentStageData = stages.map(stage => {
    const stageCards = cards.filter(c => c.currentStage === stage.name);
    return {
      name: stage.name.split(" ")[0] + "..",
      fullName: stage.name,
      Pass: stageCards.reduce((sum, c) => sum + c.passQty, 0),
      Reject: stageCards.reduce((sum, c) => sum + c.rejectQty, 0)
    };
  });

  // Chart data: Ratios Pass / Reject / In Progress / Rework
  const statusPieData = [
    { name: "Pass", value: cards.filter(c => c.status === "Pass").length, color: "#22c55e" },
    { name: "Reject", value: cards.filter(c => c.status === "Reject").length, color: "#ef4444" },
    { name: "In Progress", value: cards.filter(c => c.status === "In Progress" || c.status === "Pending").length, color: "#f59e0b" },
    { name: "Rework", value: cards.filter(c => c.status === "Rework").length, color: "#a78bfa" }
  ];

  // Pipeline navigation info
  const activeExplStageObj = stages.find(s => s.id === activeExplorerStageId) || stages[0];
  const activeStageCards = cards.filter(c => c.currentStage === activeExplStageObj?.name);
  const stageComponents = activeStageCards.reduce((sum, c) => sum + c.componentsProcessed, 0);
  const stagePass = activeStageCards.reduce((sum, c) => sum + c.passQty, 0);
  const stageReject = activeStageCards.reduce((sum, c) => sum + c.rejectQty, 0);

  // Operator leaderboard stats calculations
  const operatorStats = users.filter(u => u.role === "Production").map(op => {
    const opCards = cards.filter(c => c.operatorName === op.fullName);
    const opProcessed = opCards.reduce((sum, c) => sum + c.componentsProcessed, 0);
    const opPass = opCards.reduce((sum, c) => sum + c.passQty, 0);
    const opReject = opCards.reduce((sum, c) => sum + c.rejectQty, 0);
    const opRejectRate = opProcessed > 0 ? (opReject / opProcessed) * 100 : 0;
    
    let perfBadge = "Outstanding";
    if (opRejectRate > 5) perfBadge = "Needs Guidance";
    else if (opRejectRate > 2) perfBadge = "Average Yield";

    return {
      name: op.fullName,
      id: op.id,
      cardsCount: opCards.length,
      processed: opProcessed,
      pass: opPass,
      reject: opReject,
      rate: opRejectRate.toFixed(1),
      badge: perfBadge
    };
  }).sort((a,b) => b.processed - a.processed);

  // Acknowledge alert
  const handleAckAlert = (alertId: string) => {
    const updated = alerts.map(a => {
      if (a.id === alertId) return { ...a, acknowledged: true };
      return a;
    });
    saveAlerts(updated);
    setAlerts(updated);
    onToast("Alert acknowledged and transferred to log archival.", "success");
  };

  // Target values handler
  const handleTargetChange = (stageId: string, val: string) => {
    const updated = targets.map(t => {
      if (t.stageId === stageId && t.shift === activeShiftTab) {
        return { ...t, target: parseInt(val) || 0 };
      }
      return t;
    });
    setTargets(updated);
  };

  const saveTargetConfigs = () => {
    saveTargets(targets);
    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Manager Overview", `Updated Shift ${activeShiftTab} target yields`);
    onToast(`Yield targets saved for Shift ${activeShiftTab}!`, "success");
  };

  // Limited user actions
  const filteredLimitUsers = users.filter(u => u.role === "Production" || u.role === "QC");

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.fullName || !userFormData.username) {
      onToast("Provide full credentials", "error");
      return;
    }

    if (users.some(u => u.username === userFormData.username)) {
      onToast(`Username '${userFormData.username}' already exists.`, "error");
      return;
    }

    const nextId = "EMP" + String(users.length + 1).padStart(3, "0");
    const newUser: User = {
      id: nextId,
      fullName: userFormData.fullName,
      username: userFormData.username,
      passwordHash: "prod123", // default temp passwd
      role: userFormData.role,
      shift: userFormData.shift,
      assignedStage: userFormData.role === "Production" ? userFormData.assignedStage : undefined,
      assignedStation: userFormData.role === "Production" ? userFormData.assignedStation : undefined,
      contact: userFormData.contact,
      joinDate: userFormData.joinDate,
      status: "Active",
      createdAt: new Date().toISOString()
    };

    const updated = [newUser, ...users];
    saveUsers(updated);
    setUsers(updated);
    logAuditAction(currentUser.username, currentUser.role, "CREATE", "User Administration", `Created ${newUser.role} Employee: @${newUser.username}`);
    onToast(`Account @${newUser.username} registered (Password: prod123).`, "success");
    setShowAddUserModal(false);
    setUserFormData({
      fullName: "",
      username: "",
      role: "Production",
      shift: "A",
      assignedStage: "",
      assignedStation: "",
      contact: "",
      joinDate: new Date().toISOString().split("T")[0]
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (tmpPassword.length < 8) {
      onToast("Passwords must be at least 8 chars.", "error");
      return;
    }
    if (tmpPassword !== confirmTmpPassword) {
      onToast("Passwords must match.", "error");
      return;
    }

    const updated = users.map(u => {
      if (u.id === selectedUser.id) return { ...u, passwordHash: tmpPassword };
      return u;
    });
    saveUsers(updated);
    setUsers(updated);
    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "User Administration", `Reset passkey for @${selectedUser.username}`);
    onToast(`Password reset for @${selectedUser.username}!`, "success");
    setShowPassResetModal(false);
    setSelectedUser(null);
    setTmpPassword("");
    setConfirmTmpPassword("");
  };

  const toggleStatusM = (t: User) => {
    const nextStatus = t.status === "Active" ? "Inactive" : "Active";
    const updated = users.map(u => {
      if (u.id === t.id) return { ...u, status: nextStatus };
      return u;
    });
    saveUsers(updated);
    setUsers(updated);
    onToast(`User status modified to ${nextStatus}.`, "success");
  };

  // Suggest username on manager screen
  useEffect(() => {
    if (showAddUserModal && userFormData.fullName) {
      const parts = userFormData.fullName.trim().split(/\s+/);
      const suggested = parts.length > 1 ? `${parts[0].toLowerCase()}.${parts[parts.length - 1].toLowerCase()}` : parts[0].toLowerCase();
      setUserFormData(prev => ({ ...prev, username: suggested }));
    }
  }, [userFormData.fullName, showAddUserModal]);

  return (
    <div className="space-y-6 select-none">
      {/* Tab Navigation */}
      <div className="flex border-b border-[#252d3d] overflow-x-auto space-x-1">
        {([
          { id: "overview", label: "Overview Summary" },
          { id: "explorer", label: "Stage Explorer" },
          { id: "jobs", label: "Job Orders & Lots" },
          { id: "targets", label: "Shift Targets" },
          { id: "alerts", label: "System Alerts" },
          { id: "performance", label: "Operator performance" },
          { id: "reports", label: "QA & Production Reports" },
          { id: "users", label: "Staff Directory" }
        ] satisfies { id: ManagerTab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-all ${
              activeTab === t.id 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW SUMMARY VIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4">
              <div className="text-[#7a8aaa] text-[11px] font-bold uppercase">Total Cards</div>
              <div className="text-2xl font-bold font-mono text-[#e2e8f4] mt-1">{cards.length}</div>
            </div>
            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4">
              <div className="text-green-400 text-[11px] font-bold uppercase">Passed Units</div>
              <div className="text-2xl font-bold font-mono text-green-400 mt-1">{totalPass}</div>
            </div>
            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4">
              <div className="text-red-400 text-[11px] font-bold uppercase">Rejected Flags</div>
              <div className="text-2xl font-bold font-mono text-focus text-red-400 mt-1">{totalReject}</div>
            </div>
            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4">
              <div className="text-purple-400 text-[11px] font-bold uppercase">In Rework</div>
              <div className="text-2xl font-bold font-mono text-purple-400 mt-1">{totalRework}</div>
            </div>
            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4">
              <div className="text-blue-400 text-[11px] font-bold uppercase">Processed Comp.</div>
              <div className="text-2xl font-bold font-mono text-[#e2e8f4] mt-1">{totalComponents}</div>
            </div>
            <div className={`bg-[#131720] border rounded-xl p-4 transition-all ${
              parseFloat(rejectRate) > 4 ? "border-red-500/30" : "border-[#252d3d]"
            }`}>
              <div className="text-[#a78bfa] text-[11px] font-bold uppercase">Quality Reject %</div>
              <div className={`text-2xl font-bold font-mono mt-1 ${
                parseFloat(rejectRate) > 4 ? "text-red-400 animate-pulse" : "text-green-400"
              }`}>{rejectRate}%</div>
            </div>
          </div>

          {/* CHARTS GRAPH */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl lg:col-span-2">
              <h3 className="text-xs font-bold uppercase text-[#e2e8f4] mb-4">Total Component Processing Volumes per Stage (Recharts)</h3>
              <div className="h-64 text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={componentStageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252d3d" />
                    <XAxis dataKey="name" stroke="#7a8aaa" />
                    <YAxis stroke="#7a8aaa" />
                    <Tooltip contentStyle={{ backgroundColor: "#131720", borderColor: "#252d3d", color: "#e2e8f4" }} />
                    <Legend />
                    <Bar dataKey="Pass" fill="#3b82f6" stackId="a" name="Yield OK" />
                    <Bar dataKey="Reject" fill="#ef4444" stackId="a" name="Defective" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl">
              <h3 className="text-xs font-bold uppercase text-[#e2e8f4] mb-4">Tracking Balance Ratio</h3>
              <div className="h-64 flex flex-col justify-center items-center">
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#131720', borderColor: '#252d3d' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-3 text-[10px] w-full mt-2 border-t border-[#252d3d] pt-3 px-4">
                  {statusPieData.map(d => (
                    <div key={d.name} className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                      <span className="text-[#7a8aaa]">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* TABLE LOGS */}
          <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5">
            <h3 className="text-xs font-bold uppercase text-[#e2e8f4] mb-4">Live Operation Logistics Cards Registry</h3>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#1a2030] text-[#7a8aaa] border-b border-[#252d3d] font-bold uppercase text-[10px]">
                    <th className="p-3">Barcode</th>
                    <th className="p-3">Job / Lot No</th>
                    <th className="p-3">Stage / Station Allocation</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Qty Processed</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252d3d]">
                  {cards.slice(0, 10).map(c => (
                    <tr key={c.id} className="hover:bg-[#1d2433]/40 transition-colors">
                      <td className="p-3 font-mono text-blue-400 font-bold">{c.id}</td>
                      <td className="p-3">
                        <div className="font-semibold text-[#e2e8f4]">{c.jobId}</div>
                        <div className="text-[10px] text-[#7a8aaa] font-mono">{c.lotId}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-[#e2e8f4]">{c.currentStage}</div>
                        <div className="text-[10px] text-[#7a8aaa] font-mono">{c.currentStation}</div>
                      </td>
                      <td className="p-3 text-[#e2e8f4]">{c.operatorName}</td>
                      <td className="p-3 font-mono">
                        <span className="text-green-400">{c.passQty} OK</span> / <span className="text-red-400">{c.rejectQty} REJ</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === "Pass" ? "bg-green-500/10 text-green-400" :
                          c.status === "Reject" ? "bg-red-500/10 text-red-400" :
                          c.status === "Rework" ? "bg-purple-500/10 text-purple-400" :
                          "bg-amber-500/10 text-amber-500"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[#7a8aaa]">{c.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STAGE EXPLORER TAB */}
      {activeTab === "explorer" && (
        <div className="space-y-6">
          {/* Timeline pipeline connector blocks */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 border-b border-[#252d3d] pb-6">
            {stages.map((stage, idx) => {
              const active = stage.id === activeExplorerStageId;
              const waiting = cards.filter(c => c.currentStage === stage.name).length;
              return (
                <div 
                  key={stage.id}
                  onClick={() => setActiveExplorerStageId(stage.id)}
                  className={`relative p-3.5 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between ${
                    active ? "bg-blue-600 border-blue-500 text-white" : "bg-[#131720] border-[#252d3d] text-[#e2e8f4] hover:bg-[#1a2030]"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] font-bold tracking-widest uppercase opacity-70">Stage {stage.id}</span>
                    <span className={`w-2 h-2 rounded-full ${active ? "bg-white animate-pulse" : "bg-green-400"}`}></span>
                  </div>
                  <div className="font-semibold text-xs mt-2">{stage.name}</div>
                  <div className="flex justify-between items-center text-[11px] mt-4 opacity-80 font-mono">
                    <span>Active: {stage.stations.length} STs</span>
                    <span>Hold: {waiting} Cards</span>
                  </div>
                  {idx < 4 && (
                    <div className="hidden md:block absolute -right-2 top-[42%] translate-x-1/2 z-10 text-blue-500">
                      <ChevronsRight size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ACTIVE PIPELINE BOARD */}
          {activeExplStageObj && (
            <div className="space-y-6">
              <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#e2e8f4]">Inspection Node: {activeExplStageObj.name}</h3>
                  <div className="text-[11px] text-[#7a8aaa] flex items-center space-x-1.5 mt-2">
                    <span>Primary Router Path: </span>
                    <strong className="text-blue-400">INPUT AREA</strong>
                    <span>→</span>
                    <span className="underline">{activeExplStageObj.name}</span>
                    <span>→</span>
                    <strong className="text-purple-400">DISPATCH OUTPUTS</strong>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center font-mono">
                  <div className="bg-[#1a2030] px-3 py-1.5 rounded border border-[#252d3d]">
                    <div className="text-[#7a8aaa] text-[9px] uppercase font-sans">Active Cards</div>
                    <div className="text-sm font-bold text-[#e2e8f4]">{activeStageCards.length}</div>
                  </div>
                  <div className="bg-[#1a2030] px-3 py-1.5 rounded border border-[#252d3d]">
                    <div className="text-[#7a8aaa] text-[9px] uppercase font-sans">Parts Processed</div>
                    <div className="text-sm font-bold text-[#e2e8f4]">{stageComponents}</div>
                  </div>
                  <div className="bg-[#1a2030] px-3 py-1.5 rounded border border-[#252d3d]">
                    <div className="text-green-400 text-[9px] uppercase font-sans">Passed</div>
                    <div className="text-sm font-bold text-green-400">{stagePass}</div>
                  </div>
                  <div className="bg-[#1a2030] px-3 py-1.5 rounded border border-[#252d3d]">
                    <div className="text-red-400 text-[9px] uppercase font-sans">Failed</div>
                    <div className="text-sm font-bold text-red-400">{stageReject}</div>
                  </div>
                </div>
              </div>

              {/* STATIONS BREAKDOWN */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl space-y-3 lg:col-span-1">
                  <h4 className="text-xs font-bold uppercase text-[#7a8aaa] border-b border-[#252d3d] pb-2">Active Station Loads</h4>
                  <div className="space-y-2">
                    {activeExplStageObj.stations.map(st => {
                      const stCards = activeStageCards.filter(c => c.currentStation === st.id);
                      const passCount = stCards.reduce((sum,c) => sum+c.passQty,0);
                      const rejCount = stCards.reduce((sum,c) => sum+c.rejectQty,0);
                      return (
                        <div key={st.id} className="bg-[#1a2030] border border-[#252d3d] rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-xs font-bold text-blue-400">{st.id}</span>
                            <span className={`text-[9px] px-1.5 rounded font-bold uppercase ${
                              st.status === "Available" ? "bg-green-500/10 text-green-400" :
                              st.status === "Occupied" ? "bg-amber-500/10 text-amber-400" :
                              "bg-slate-700/30 text-[#7a8aaa]"
                            }`}>{st.status}</span>
                          </div>
                          <div className="text-[#e2e8f4] text-xs font-semibold mt-1">{st.name}</div>
                          {st.currentOperator && (
                            <div className="text-[10px] text-[#7a8aaa] mt-1.5 italic">Staff: {st.currentOperator}</div>
                          )}
                          <div className="border-t border-[#252d3d] pt-2 mt-2 flex justify-between font-mono text-[10px] text-[#7a8aaa]">
                            <span>Logs: {stCards.length}</span>
                            <span>Yield: {passCount} OK / {rejCount} REJ</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl lg:col-span-2">
                  <h4 className="text-xs font-bold uppercase text-[#7a8aaa] border-b border-[#252d3d] pb-2 mb-3">Operator Efficiency Board for this Node</h4>
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[#7a8aaa] font-bold bg-[#1a2030] uppercase text-[9px]">
                          <th className="p-2.5">Operator</th>
                          <th className="p-2.5">Cards Processed</th>
                          <th className="p-2.5">Fail Count</th>
                          <th className="p-2.5">Yield Accuracy %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#252d3d]">
                        {operatorStats.slice(0, 5).map(op => (
                          <tr key={op.id} className="hover:bg-[#1a2030]/50 text-xs">
                            <td className="p-2.5 font-semibold text-[#e2e8f4]">{op.name}</td>
                            <td className="p-2.5 font-mono">{op.processed} components</td>
                            <td className="p-2.5 text-red-400 font-mono">{op.reject} failures</td>
                            <td className="p-2.5 font-mono text-green-400 font-bold">{100 - parseFloat(op.rate)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* JOB ORDERS & LOTS TAB */}
      {activeTab === "jobs" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl lg:col-span-1 space-y-4">
            <h3 className="text-xs font-bold uppercase text-[#7a8aaa] border-b border-[#252d3d] pb-2">Trackable Job Batches</h3>
            <div className="space-y-3">
              {jobs.map(job => (
                <div key={job.id} className="bg-[#1a2030] border border-[#252d3d] rounded-lg p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-blue-400">{job.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      job.priority === 'High' ? 'bg-red-500/10 text-red-400' :
                      job.priority === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>{job.priority} Priority</span>
                  </div>
                  <div className="font-bold text-sm text-[#e2e8f4]">{job.product}</div>
                  <div className="text-[10px] text-[#7a8aaa]">Client: <strong className="text-[#e2e8f4]">{job.customer}</strong></div>
                  
                  {/* Progress block */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-[#7a8aaa]">
                      <span>Completion:</span>
                      <span className="font-mono text-[#e2e8f4]">Quantity target: {job.qty} units</span>
                    </div>
                    <div className="w-full h-1 bg-[#252d3d] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: job.status === 'Completed' ? '100%' : '65%' }}></div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1">
                    <span className="text-[#7a8aaa] font-mono">Due: {job.dueDate}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      job.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                      job.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400' :
                      job.status === 'Flagged' ? 'bg-red-500/10 text-red-500 animate-pulse' :
                      'bg-slate-800 text-[#7a8aaa]'
                    }`}>{job.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold uppercase text-[#7a8aaa] border-b border-[#252d3d] pb-2">Operational Sub-Lots Traceability</h3>
            <div className="space-y-4">
              {lots.map(lot => {
                const job = jobs.find(j => j.id === lot.jobId);
                const lotCards = cards.filter(c => c.lotId === lot.id);
                const percentDone = lot.status === "Completed" ? 100 : Math.min(Math.round(((lot.passQty) / lot.qty) * 100), 100);
                return (
                  <div key={lot.id} className="bg-[#1a2030] border border-[#252d3d] rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-[#252d3d]/40 pb-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-purple-400">{lot.id}</span>
                        <span className="text-xs text-[#7a8aaa] mx-2">•</span>
                        <span className="text-xs text-[#e2e8f4]">{job?.product}</span>
                      </div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        lot.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                        lot.status === 'Flagged' ? 'bg-red-500/10 text-red-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>{lot.status}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-[#7a8aaa] text-[10px]">Job Identifier</div>
                        <div className="text-[#e2e8f4] font-semibold">{lot.jobId}</div>
                      </div>
                      <div>
                        <div className="text-[#7a8aaa] text-[10px]">Lot Size</div>
                        <div className="text-[#e2e8f4] font-semibold">{lot.qty} units</div>
                      </div>
                      <div>
                        <div className="text-[#7a8aaa] text-[10px]">Yield Success</div>
                        <div className="text-[#e2e8f4] font-semibold font-mono text-green-400">{lot.passQty} Passed</div>
                      </div>
                      <div>
                        <div className="text-[#7a8aaa] text-[10px]">Yield Defect</div>
                        <div className="text-[#e2e8f4] font-semibold font-mono text-red-400">{lot.rejectQty} Rejected</div>
                      </div>
                    </div>

                    {/* Progress tracking */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[#7a8aaa] font-mono">
                        <span>Lot Progress completion:</span>
                        <span>{percentDone}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#252d3d] rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${percentDone}%` }}></div>
                      </div>
                    </div>

                    {/* Cards associated with this lot */}
                    <div className="pt-2">
                      <div className="text-[10px] font-bold uppercase text-[#7a8aaa] mb-1.5 mb-1">Lot Routing Audit Cards History</div>
                      <div className="flex flex-wrap gap-1.5">
                        {lotCards.map(c => (
                          <span 
                            key={c.id} 
                            className={`px-2 py-1 rounded text-[10px] font-mono border ${
                              c.status === "Pass" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                              c.status === "Reject" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                              "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {c.id} ({c.currentStation})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SHIFT TARGETS TAB */}
      {activeTab === "targets" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#252d3d] pb-4 gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#e2e8f4]">Yield Targets & Allocation</h3>
              <p className="text-xs text-[#7a8aaa] mt-1">Define actual and prospective target counts per Shift scheduling cycle.</p>
            </div>
            
            <div className="flex space-x-1 bg-[#1a2030] p-1 rounded-lg border border-[#252d3d]">
              {(["A", "B", "C"] as const).map(shift => (
                <button
                  key={shift}
                  onClick={() => setActiveShiftTab(shift)}
                  className={`px-3 py-1.5 text-xs font-mono font-bold rounded cursor-pointer transition-all ${
                    activeShiftTab === shift ? "bg-blue-600 text-white" : "text-[#7a8aaa] hover:text-[#e2e8f4]"
                  }`}
                >
                  Shift {shift}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targets.filter(t => t.shift === activeShiftTab).map((stageT) => {
              const currentProgress = stageT.target > 0 ? Math.round((stageT.actual / stageT.target) * 100) : 0;
              return (
                <div key={stageT.stageId} className="bg-[#1a2030] border border-[#252d3d] p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs font-mono text-blue-400">STAGE {stageT.stageId}</span>
                    <span className="text-xs text-[#e2e8f4] font-semibold">{stageT.stageName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[#7a8aaa] text-[10px] font-bold mb-1 uppercase">Target Components</label>
                      <input
                        type="number"
                        className="w-full bg-[#131720] border border-[#252d3d] text-[#e2e8f4] text-xs font-mono rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                        value={stageT.target}
                        onChange={(e) => handleTargetChange(stageT.stageId, e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-[#7a8aaa] text-[10px] font-bold mb-1 uppercase">Actual Output</div>
                      <div className="bg-[#131720]/80 border border-[#252d3d]/50 rounded px-2.5 py-1.5 font-mono text-[#e2e8f4] text-xs">
                        {stageT.actual} components
                      </div>
                    </div>
                  </div>

                  {/* Progress tracker bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-[#7a8aaa] font-mono">
                      <span>Total Yield Efficiency:</span>
                      <span>{currentProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#131720] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        currentProgress >= 90 ? "bg-green-500" :
                        currentProgress >= 70 ? "bg-amber-500" :
                        "bg-red-500 animate-pulse"
                      }`} style={{ width: `${currentProgress}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-[#252d3d]/60">
            <button
              onClick={saveTargetConfigs}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-lg cursor-pointer transition-colors"
            >
              Save Targets
            </button>
          </div>
        </div>
      )}

      {/* SYSTEM ALERTS TAB */}
      {activeTab === "alerts" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-6 space-y-4">
          <div className="border-b border-[#252d3d] pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-[#e2e8f4]">Live Incident Alerts</h3>
              <p className="text-xs text-[#7a8aaa] mt-1">Real-time alerts triggered by process rejections and delays.</p>
            </div>
            <span className="bg-red-500/10 text-red-400 border border-red-500/20 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
              {alerts.filter(a => !a.acknowledged).length} Open
            </span>
          </div>

          <div className="space-y-3">
            {alerts.filter(a => !a.acknowledged).map((alert) => (
              <div 
                key={alert.id} 
                className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between md:items-center gap-3 transition-colors ${
                  alert.level === 'High' || alert.level === 'Critical' 
                    ? 'bg-red-500/5 border-red-500/20' 
                    : alert.level === 'Medium' ? 'bg-amber-500/5 border-amber-500/20' 
                    : 'bg-blue-500/5 border-blue-500/10'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                      alert.level === 'High' || alert.level === 'Critical' ? 'bg-red-500/10 text-red-400' :
                      alert.level === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {alert.level}
                    </span>
                    <span className="text-[#e2e8f4] text-xs font-semibold">{alert.message}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#7a8aaa] font-mono">
                    {alert.barcodeId && <span>Card: <strong className="text-blue-400">{alert.barcodeId}</strong></span>}
                    {alert.lotId && <span>Lot: <strong>{alert.lotId}</strong></span>}
                    {alert.station && <span>Station: <strong>{alert.station}</strong></span>}
                    <span>•</span>
                    <span>Received at {alert.time}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleAckAlert(alert.id)}
                  className="bg-[#1a2030] hover:bg-[#252d3d] border border-[#252d3d] text-[#e2e8f4] font-medium text-xs px-3.5 py-1.5 rounded-lg cursor-pointer"
                >
                  Acknowledge
                </button>
              </div>
            ))}

            {alerts.filter(a => !a.acknowledged).length === 0 && (
              <div className="text-center text-[#7a8aaa] py-8 text-xs italic">
                All production lines are operating at 100% efficiency. No open incidents.
              </div>
            )}
          </div>
        </div>
      )}

      {/* OPERATOR PERFORMANCE LEADERBOARD */}
      {activeTab === "performance" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#252d3d] pb-3">
            <h3 className="text-sm font-bold text-[#e2e8f4]">Staff Efficiency Rankings</h3>
            <p className="text-xs text-[#7a8aaa] mt-1">High-throughput tracking dashboard sorted by component yield output.</p>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#1a2030] text-[#7a8aaa] border-b border-[#252d3d] font-bold uppercase text-[9px]">
                  <th className="p-3">Rank</th>
                  <th className="p-3">Operator Name</th>
                  <th className="p-3">ID</th>
                  <th className="p-3">Assigned Cards</th>
                  <th className="p-3">Total Processed</th>
                  <th className="p-3">Success Rate %</th>
                  <th className="p-3">Result Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252d3d]">
                {operatorStats.map((op, idx) => (
                  <tr key={op.id} className="hover:bg-[#1a2030]/50">
                    <td className="p-3 font-mono font-bold text-blue-500">#{idx + 1}</td>
                    <td className="p-3 font-semibold text-[#e2e8f4]">{op.name}</td>
                    <td className="p-3 font-mono text-[#7a8aaa]">{op.id}</td>
                    <td className="p-3 font-mono">{op.cardsCount} cards</td>
                    <td className="p-3 font-mono">{op.processed} components</td>
                    <td className="p-3 font-mono text-green-400 font-bold">{op.rate === "0.0" ? "100" : (100 - parseFloat(op.rate)).toFixed(1)}%</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        op.badge === "Outstanding" ? "bg-green-500/10 text-green-400" :
                        op.badge === "Average Yield" ? "bg-amber-500/10 text-amber-500" :
                        "bg-red-500/10 text-red-500"
                      }`}>
                        {op.badge}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QA & PRODUCTION REPORTS TAB */}
      {activeTab === "reports" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-6 space-y-5">
          <div className="border-b border-[#252d3d] pb-3">
            <h3 className="text-sm font-bold text-[#e2e8f4]">TraceIQ Output PDF/CSV Generation</h3>
            <p className="text-xs text-[#7a8aaa] mt-1">Export comprehensive line productivity logs to file arrays.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[#1a2030] border border-[#252d3d] p-4 rounded-xl space-y-3">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 w-10 h-10 flex items-center justify-center">
                <FileText size={20} />
              </div>
              <h4 className="font-bold text-xs text-[#e2e8f4]">Hourly Shift Yield Report</h4>
              <p className="text-[11px] text-[#7a8aaa]">Output throughput, components processed, and quality percentage counts.</p>
              <button
                onClick={() => onToast("Shift Summary Report requested. File generation in progress...", "info")}
                className="w-full bg-[#131720] hover:bg-[#252d3d] border border-[#252d3d] text-[#e2e8f4] text-xs py-2 rounded-lg cursor-pointer"
              >
                Download PDF Array
              </button>
            </div>

            <div className="bg-[#1a2030] border border-[#252d3d] p-4 rounded-xl space-y-3">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 w-10 h-10 flex items-center justify-center">
                <Clipboard size={20} />
              </div>
              <h4 className="font-bold text-xs text-[#e2e8f4]">Defects Pareto Statistics</h4>
              <p className="text-[11px] text-[#7a8aaa]">Analyze core defects, misalignment metrics, and test-stage shorts listings.</p>
              <button
                onClick={() => onToast("Custom Pareto Defects CSV generation started.", "info")}
                className="w-full bg-[#131720] hover:bg-[#252d3d] border border-[#252d3d] text-[#e2e8f4] text-xs py-2 rounded-lg cursor-pointer"
              >
                Export CSV Spreadsheet
              </button>
            </div>

            <div className="bg-[#1a2030] border border-[#252d3d] p-4 rounded-xl space-y-3">
              <div className="p-2 bg-green-500/10 rounded-lg text-green-400 w-10 h-10 flex items-center justify-center">
                <CheckSquare size={20} />
              </div>
              <h4 className="font-bold text-xs text-[#e2e8f4]">Operator Audit log Records</h4>
              <p className="text-[11px] text-[#7a8aaa]">Review complete history logs of submissions of operator roles directly.</p>
              <button
                onClick={() => onToast("Individual Operator Ledger downloaded successfully.", "success")}
                className="w-full bg-[#131720] hover:bg-[#252d3d] border border-[#252d3d] text-[#e2e8f4] text-xs py-2 rounded-lg cursor-pointer"
              >
                Print PDF Report List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF DIRECTORY TAB (Manager View) */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-[#7a8aaa]">Operators & Quality Inspector Directory</h3>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg cursor-pointer"
            >
              Add Staff Member
            </button>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#1a2030] text-[#7a8aaa] border-b border-[#252d3d] uppercase text-[9px]">
                <tr>
                  <th className="p-3">Staff Details</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Shift Working</th>
                  <th className="p-3">Active Status</th>
                  <th className="p-3 text-right">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252d3d]">
                {filteredLimitUsers.map(user => (
                  <tr key={user.id} className="hover:bg-[#1a2030]/30 transition-colors">
                    <td className="p-3 flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-blue-950 text-blue-300 border border-blue-500/20 flex items-center justify-center font-bold text-xs">
                        {user.fullName.split(" ").map(n=>n[0]).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-[#e2e8f4]">{user.fullName}</div>
                        <div className="text-[10px] text-[#7a8aaa] font-mono">@{user.username}</div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[#e2e8f4]">{user.id}</td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        user.role === 'QC' ? 'bg-teal-500/10 text-teal-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>{user.role}</span>
                    </td>
                    <td className="p-3 font-mono">Shift {user.shift}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        user.status === "Active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                      }`}>{user.status}</span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowPassResetModal(true);
                        }}
                        className="p-1 hover:bg-[#1a2030] rounded text-[#f59e0b] cursor-pointer"
                        title="Reset Passkey"
                      >
                        <Key size={14} />
                      </button>
                      <button
                        onClick={() => toggleStatusM(user)}
                        className={`p-1 rounded cursor-pointer ${
                          user.status === "Active" ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"
                        }`}
                        title="Toggle Status"
                      >
                        <Power size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAFF */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c10]/85 backdrop-blur-xs select-none">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1a2030] px-4 py-3 border-b border-[#252d3d] flex items-center justify-between">
              <span className="font-bold text-xs text-[#e2e8f4]">Register Production / QC Staff</span>
              <button onClick={() => setShowAddUserModal(false)} className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer">x</button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-4 space-y-3.5 text-xs font-sans">
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Full Name*</label>
                <input
                  type="text" required placeholder="Name Surname"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                  value={userFormData.fullName}
                  onChange={(e) => setUserFormData({...userFormData, fullName: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Username* (Auto-Suggested)</label>
                <input
                  type="text" required
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4] font-mono focus:outline-none focus:border-blue-500"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({...userFormData, username: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">System Role*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({...userFormData, role: e.target.value as ManagedRole})}
                  >
                    <option value="Production">Production Operator</option>
                    <option value="QC">Quality Control</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Shift Group*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    value={userFormData.shift}
                    onChange={(e) => setUserFormData({...userFormData, shift: e.target.value as Shift})}
                  >
                    <option value="A">Shift A</option>
                    <option value="B">Shift B</option>
                    <option value="C">Shift C</option>
                  </select>
                </div>
              </div>

              {userFormData.role === "Production" && (
                <div className="grid grid-cols-2 gap-2 bg-[#11131a] p-2.5 rounded border border-[#252d3d]">
                  <div>
                    <label className="block text-[#7a8aaa] text-[10px] uppercase font-bold mb-0.5">Assigned Stage*</label>
                    <select
                      required
                      className="w-full bg-[#1a2030] border border-[#252d3d] rounded p-1 text-[11px] text-[#e2e8f4]"
                      value={userFormData.assignedStage}
                      onChange={(e) => setUserFormData({...userFormData, assignedStage: e.target.value, assignedStation: ""})}
                    >
                      <option value="">-- Choose Stage --</option>
                      {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#7a8aaa] text-[10px] uppercase font-bold mb-0.5">Station ID*</label>
                    <select
                      required
                      className="w-full bg-[#1a2030] border border-[#252d3d] rounded p-1 text-[11px] text-[#e2e8f4]"
                      value={userFormData.assignedStation}
                      onChange={(e) => setUserFormData({...userFormData, assignedStation: e.target.value})}
                      disabled={!userFormData.assignedStage}
                    >
                      <option value="">-- Choose Station --</option>
                      {stages.find(s=>s.name === userFormData.assignedStage)?.stations.map(st => (
                        <option key={st.id} value={st.id}>{st.id}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button type="button" onClick={() => setShowAddUserModal(false)} className="bg-[#252d3d] text-[#e2e8f4] px-3.5 py-1.5 rounded cursor-pointer">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-1.5 rounded cursor-pointer">Register Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESET PASSKEY */}
      {showPassResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c10]/85 backdrop-blur-xs select-none">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-xs w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1a2030] px-4 py-3 border-b border-[#252d3d] flex items-center justify-between">
              <span className="font-bold text-xs text-[#e2e8f4]">Reset passkey for @{selectedUser.username}</span>
              <button onClick={() => setShowPassResetModal(false)} className="text-[#7a8aaa] cursor-pointer">x</button>
            </div>
            
            <form onSubmit={handleResetPassword} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Temporary Security Key*</label>
                <input
                  type="password" required placeholder="Min 8 characters"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4] font-mono"
                  value={tmpPassword}
                  onChange={(e) => setTmpPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Confirm Temporary Key*</label>
                <input
                  type="password" required placeholder="Match key"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4] font-mono"
                  value={confirmTmpPassword}
                  onChange={(e) => setConfirmTmpPassword(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button type="button" onClick={() => setShowPassResetModal(false)} className="bg-[#252d3d] text-[#e2e8f4] px-3.5 py-1.5 rounded cursor-pointer">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-1.5 rounded cursor-pointer">Apply Reset</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
