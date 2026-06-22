import React, { useState, useEffect } from "react";
import { 
  User, Role, Stage, JobOrder, AuditLog, Station
} from "../types.ts";
import { 
  getUsers, saveUsers, getStages, saveStages, 
  getAuditLogs, saveAuditLogs, logAuditAction 
} from "../data.ts";
import { 
  Search, Filter, Plus, Edit2, Key, Power, Shield, Settings, 
  ListTodo, Users, AlertCircle, CheckCircle, HelpCircle, Save, 
  Download, Eye, EyeOff, Trash2, ArrowUpDown, ArrowRight
} from "lucide-react";

interface AdminPanelProps {
  currentUser: User;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
  onLoginAs: (user: User) => void;
}

export function AdminPanel({ currentUser, onToast, onLoginAs }: AdminPanelProps) {
  // Tabs: "overview" | "users" | "permissions" | "settings" | "audit"
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "permissions" | "settings" | "audit">("overview");

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [shiftFilter, setShiftFilter] = useState<string>("All");

  // Form states
  const [formData, setFormData] = useState({
    id: "",
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "Production" as Role,
    shift: "A" as "A" | "B" | "C",
    assignedStage: "",
    assignedStation: "",
    contact: "",
    joinDate: new Date().toISOString().split("T")[0],
    status: "Active" as "Active" | "Inactive"
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  // Settings states
  const [defectThreshold, setDefectThreshold] = useState("3.5");
  const [defaultLotSize, setDefaultLotSize] = useState("250");
  const [barcodePrefix, setBarcodePrefix] = useState("TRK");
  const [shiftTimes, setShiftTimes] = useState({
    A: "06:00 - 14:00",
    B: "14:00 - 22:00",
    C: "22:00 - 06:00"
  });

  // Permissions matrices state
  const [roleAccess, setRoleAccess] = useState([
    { role: "Admin", panels: { "Overview": true, "User Management": true, "Scan and Submit": true, "Job Orders": true, "Reports": true, "System Settings": true, "Audit Log": true, "Defect Management": true, "Rework": true } },
    { role: "Manager", panels: { "Overview": true, "User Management": true, "Scan and Submit": false, "Job Orders": true, "Reports": true, "System Settings": false, "Audit Log": false, "Defect Management": true, "Rework": true } },
    { role: "Production", panels: { "Overview": false, "User Management": false, "Scan and Submit": true, "Job Orders": false, "Reports": false, "System Settings": false, "Audit Log": false, "Defect Management": false, "Rework": false } },
    { role: "PPC", panels: { "Overview": true, "User Management": false, "Scan and Submit": false, "Job Orders": true, "Reports": true, "System Settings": false, "Audit Log": false, "Defect Management": false, "Rework": false } },
    { role: "QC", panels: { "Overview": true, "User Management": false, "Scan and Submit": false, "Job Orders": false, "Reports": true, "System Settings": false, "Audit Log": false, "Defect Management": true, "Rework": true } }
  ]);

  // Load datasets on mount/tab change
  useEffect(() => {
    setUsers(getUsers());
    setStages(getStages());
    setAuditLogs(getAuditLogs());
  }, [activeTab]);

  // Sync username suggestion on Full Name change
  useEffect(() => {
    if (activeTab === "users" && showAddModal && formData.fullName) {
      const parts = formData.fullName.trim().toLowerCase().split(/\s+/);
      if (parts.length > 0) {
        const first = parts[0];
        const last = parts[parts.length - 1] || "";
        const suggested = last ? `${first}.${last}` : first;
        // Check uniqueness locally
        const exists = users.some(u => u.username === suggested);
        setFormData(prev => ({
          ...prev,
          username: suggested
        }));
      }
    }
  }, [formData.fullName, showAddModal, activeTab]);

  // Filter stations based on selected stage
  const selectedStageObj = stages.find(s => s.name === formData.assignedStage);
  const stationsAvailable = selectedStageObj ? selectedStageObj.stations : [];

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.username) {
      onToast("Please complete all required fields.", "error");
      return;
    }

    // Username unique check (only for creation or if customized)
    const usernameTaken = users.some(u => u.username === formData.username);
    if (usernameTaken) {
      onToast(`Username '${formData.username}' is already in use.`, "error");
      return;
    }

    if (formData.password.length < 8) {
      onToast("Password must be at least 8 characters long.", "error");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      onToast("Passwords do not match.", "error");
      return;
    }

    const nextId = "EMP" + String(users.length + 1).padStart(3, "0");
    const newUser: User = {
      id: nextId,
      fullName: formData.fullName,
      username: formData.username,
      passwordHash: formData.password, // Plain text for mock authentication flow
      role: formData.role,
      shift: formData.shift,
      assignedStage: formData.role === "Production" ? formData.assignedStage : undefined,
      assignedStation: formData.role === "Production" ? formData.assignedStation : undefined,
      contact: formData.contact,
      joinDate: formData.joinDate,
      status: "Active",
      createdAt: new Date().toISOString(),
      createdBy: currentUser.username
    };

    const updated = [newUser, ...users];
    saveUsers(updated);
    setUsers(updated);
    logAuditAction(currentUser.username, currentUser.role, "CREATE", "Users", `Created user ${newUser.username} (${newUser.role})`);
    onToast(`User '${newUser.username}' created successfully!`, "success");
    setShowAddModal(false);
    resetForm();
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const updatedUsers = users.map(u => {
      if (u.id === selectedUser.id) {
        return {
          ...u,
          fullName: formData.fullName,
          role: formData.role,
          shift: formData.shift,
          assignedStage: formData.role === "Production" ? formData.assignedStage : undefined,
          assignedStation: formData.role === "Production" ? formData.assignedStation : undefined,
          contact: formData.contact,
          joinDate: formData.joinDate,
          status: formData.status
        };
      }
      return u;
    });

    saveUsers(updatedUsers);
    setUsers(updatedUsers);
    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Users", `Updated profile attributes for ${selectedUser.username}`);
    onToast(`User profile updated successfully.`, "success");
    setShowEditModal(false);
    setSelectedUser(null);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (passwordForm.newPassword.length < 8) {
      onToast("Password must be at least 8 characters.", "error");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      onToast("Passwords do not match.", "error");
      return;
    }

    const updated = users.map(u => {
      if (u.id === selectedUser.id) {
        return { ...u, passwordHash: passwordForm.newPassword };
      }
      return u;
    });

    saveUsers(updated);
    setUsers(updated);
    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Users", `Reset credentials for user: ${selectedUser.username}`);
    onToast(`Password successfully reset for ${selectedUser.fullName}.`, "success");
    setShowPasswordModal(false);
    setPasswordForm({ newPassword: "", confirmPassword: "" });
  };

  const toggleUserStatus = (target: User) => {
    const updatedStatus = target.status === "Active" ? "Inactive" : "Active";
    const updated = users.map(u => {
      if (u.id === target.id) {
        return { ...u, status: updatedStatus };
      }
      return u;
    });
    saveUsers(updated);
    setUsers(updated);
    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Users", `Changed status of ${target.username} to ${updatedStatus}`);
    onToast(`User '${target.username}' is now ${updatedStatus}.`, "success");
  };

  const handleSavePermissionMatrix = () => {
    onToast("Role access levels successfully saved to database configuration.", "success");
    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Permissions", "Modified system role privilege mapping definitions");
  };

  const resetForm = () => {
    setFormData({
      id: "",
      fullName: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "Production",
      shift: "A",
      assignedStage: "",
      assignedStation: "",
      contact: "",
      joinDate: new Date().toISOString().split("T")[0],
      status: "Active"
    });
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = u.fullName.toLowerCase().includes(query) || 
                          u.username.toLowerCase().includes(query) || 
                          u.id.toLowerCase().includes(query);
    const matchesRole = roleFilter === "All" || u.role === roleFilter;
    const matchesStatus = statusFilter === "All" || u.status === statusFilter;
    const matchesShift = shiftFilter === "All" || u.shift === shiftFilter;
    return matchesSearch && matchesRole && matchesStatus && matchesShift;
  });

  // Export audit logs to pseudo-CSV file
  const exportLogsToCsv = () => {
    const headers = "ID,Timestamp,Username,Role,Action,Module,Details\n";
    const rows = auditLogs.map(log => 
      `"${log.id}","${log.timestamp}","${log.username}","${log.role}","${log.action}","${log.module}","${log.details.replace(/"/g, '""')}"`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `TraceIQ_AuditLog_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    
    logAuditAction(currentUser.username, currentUser.role, "EXPORT", "Audit Log", "Exported database audit logs to raw spreadsheet");
    onToast("Audit log exported successfully!", "info");
  };

  return (
    <div id="admin-panel" className="space-y-6">
      {/* Mini tabs */}
      <div className="flex border-b border-[#252d3d] overflow-x-auto select-none space-x-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'users' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          User Management
        </button>
        <button
          onClick={() => setActiveTab("permissions")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'permissions' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          Role & Access Control
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          System Configuration
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'audit' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          Audit Logs Database
        </button>
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5 flex items-center space-x-4">
              <div className="p-3.5 bg-blue-500/10 rounded-lg text-blue-400">
                <Users size={24} />
              </div>
              <div>
                <div className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider">Total Users Registered</div>
                <div className="text-3xl font-bold font-mono tracking-tight mt-1 text-[#e2e8f4]">
                  {users.length}
                </div>
              </div>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5 flex items-center space-x-4">
              <div className="p-3.5 bg-green-500/10 rounded-lg text-green-400">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider">Active Operators</div>
                <div className="text-3xl font-bold font-mono tracking-tight mt-1 text-[#e2e8f4]">
                  {users.filter(u => u.status === 'Active' && u.role === 'Production').length}
                </div>
              </div>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5 flex items-center space-x-4">
              <div className="p-3.5 bg-amber-500/10 rounded-lg text-amber-400">
                <AlertCircle size={24} />
              </div>
              <div>
                <div className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider">Audit Log Count</div>
                <div className="text-3xl font-bold font-mono tracking-tight mt-1 text-[#e2e8f4]">
                  {auditLogs.length}
                </div>
              </div>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5 flex items-center space-x-4">
              <div className="p-3.5 bg-teal-500/10 rounded-lg text-teal-400">
                <Shield size={24} />
              </div>
              <div>
                <div className="text-[#7a8aaa] text-xs font-semibold uppercase tracking-wider">System Security Health</div>
                <div className="text-3xl font-bold font-sans tracking-tight mt-1 text-[#e2e8f4]">
                  100%
                </div>
              </div>
            </div>
          </div>

          {/* Quick buttons */}
          <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5">
            <h3 className="text-md font-semibold text-[#e2e8f4] mb-4">Instance Speed Actions</h3>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => { resetForm(); setShowAddModal(true); setActiveTab("users"); }}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                <Plus size={16} />
                <span>Register New User Account</span>
              </button>
              <button 
                onClick={() => setActiveTab("settings")}
                className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-[#e2e8f4] font-medium text-xs px-4 py-2 rounded-lg cursor-pointer border border-[#252d3d]"
              >
                <Settings size={16} />
                <span>Manage Stages Grid</span>
              </button>
              <button 
                onClick={exportLogsToCsv}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-800 to-indigo-800 hover:from-purple-700 hover:to-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-lg cursor-pointer"
              >
                <Download size={16} />
                <span>Export Audit CSV File</span>
              </button>
            </div>
          </div>

          {/* Activity feed */}
          <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5">
            <h3 className="text-md font-semibold text-[#e2e8f4] mb-4">Recent Security & Operations Activity (Last 10 Actions)</h3>
            <div className="divide-y divide-[#252d3d] max-h-96 overflow-y-auto pr-2">
              {auditLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between text-xs space-y-1 md:space-y-0">
                  <div className="flex items-start md:items-center space-x-3">
                    <span className={`px-2 py-0.5 font-bold rounded text-[10px] ${
                      log.action === "CREATE" ? "bg-green-500/10 text-green-400" :
                      log.action === "UPDATE" ? "bg-amber-500/10 text-amber-400" :
                      log.action === "DELETE" ? "bg-red-500/10 text-red-500" :
                      log.action === "EXPORT" ? "bg-purple-500/10 text-purple-400" :
                      "bg-blue-500/10 text-blue-400"
                    }`}>
                      {log.action}
                    </span>
                    <div>
                      <span className="text-[#7a8aaa] font-semibold">{log.module}: </span>
                      <span className="text-[#e2e8f4] font-medium">{log.details}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 pl-8 md:pl-0 font-mono text-[#7a8aaa]">
                    <span>@{log.username} ({log.role})</span>
                    <span>•</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 flex-grow max-w-4xl">
              {/* Search */}
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-2.5 text-[#7a8aaa]" size={16} />
                <input
                  type="text"
                  placeholder="Search user by ID, username or name..."
                  className="w-full pl-9 pr-4 py-2 bg-[#1a2030] border border-[#252d3d] rounded-lg text-sm text-[#e2e8f4] focus:outline-none focus:border-blue-500 placeholder-[#7a8aaa]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Role Filter */}
              <div className="flex items-center space-x-1.5 min-w-[130px]">
                <Filter size={14} className="text-[#7a8aaa]" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] text-xs rounded-lg p-2 focus:outline-none focus:border-blue-500 h-[38px] w-full"
                >
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Production">Production</option>
                  <option value="PPC">PPC</option>
                  <option value="QC">QC</option>
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] text-xs rounded-lg p-2 focus:outline-none focus:border-blue-500 h-[38px] min-w-[110px]"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              {/* Shift Filter */}
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] text-xs rounded-lg p-2 focus:outline-none focus:border-blue-500 h-[38px] min-w-[100px]"
              >
                <option value="All">All Shifts</option>
                <option value="A">Shift A</option>
                <option value="B">Shift B</option>
                <option value="C">Shift C</option>
              </select>
            </div>

            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2 rounded-lg cursor-pointer h-[38px] select-none whitespace-nowrap"
            >
              <Plus size={16} />
              <span>Register User</span>
            </button>
          </div>

          {/* User grid/table */}
          <div className="bg-[#131720] border border-[#252d3d] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1a2030] border-b border-[#252d3d] text-xs text-[#7a8aaa] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Details</th>
                    <th className="px-5 py-3.5">Employee ID</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Shift / Allocation</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252d3d]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[#7a8aaa]">
                        No user account found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#1a2030]/50 transition-colors">
                        <td className="px-5 py-3.5 flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-blue-900/40 text-blue-300 border border-blue-500/20 flex items-center justify-center font-bold text-xs">
                            {user.fullName.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <div className="font-semibold text-[#e2e8f4]">{user.fullName}</div>
                            <div className="text-xs text-[#7a8aaa] font-mono">@{user.username}</div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs">{user.id}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            user.role === "Admin" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            user.role === "Manager" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            user.role === "QC" ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" :
                            user.role === "PPC" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                            "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#7a8aaa]">
                          <div>Shift: <strong className="text-[#e2e8f4] font-mono">{user.shift}</strong></div>
                          {user.role === "Production" && user.assignedStage && (
                            <div className="text-[11px] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]">
                              {user.assignedStage} ({user.assignedStation})
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium space-x-1 ${
                            user.status === "Active" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                            <span>{user.status}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1">
                          {/* Test View As Button */}
                          {user.status === "Active" && user.id !== currentUser.id && (
                            <button
                              onClick={() => {
                                onLoginAs(user);
                                onToast(`Started simulation as @${user.username}`, "info");
                              }}
                              className="p-1 text-teal-400 hover:bg-[#1a2030] rounded cursor-pointer"
                              title="Mock View As this user"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setFormData({
                                id: user.id,
                                fullName: user.fullName,
                                username: user.username,
                                password: "",
                                confirmPassword: "",
                                role: user.role,
                                shift: user.shift,
                                assignedStage: user.assignedStage || "",
                                assignedStation: user.assignedStation || "",
                                contact: user.contact || "",
                                joinDate: user.joinDate,
                                status: user.status
                              });
                              setShowEditModal(true);
                            }}
                            className="p-1 text-blue-400 hover:bg-[#1a2030] rounded cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowPasswordModal(true);
                            }}
                            className="p-1 text-[#f59e0b] hover:bg-[#1a2030] rounded cursor-pointer"
                            title="Reset Credentials"
                          >
                            <Key size={14} />
                          </button>
                          {user.id !== currentUser.id && (
                            <button
                              onClick={() => toggleUserStatus(user)}
                              className={`p-1 rounded cursor-pointer ${
                                user.status === 'Active' ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                              }`}
                              title={user.status === 'Active' ? 'Deactivate User' : 'Reactivate User'}
                            >
                              <Power size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Access Permission Grid tab */}
      {activeTab === "permissions" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-6 space-y-4">
          <div className="border-b border-[#252d3d] pb-4">
            <div className="text-lg font-bold text-[#e2e8f4]">Role Authorization Matrix</div>
            <p className="text-xs text-[#7a8aaa] mt-1">
              Configure system privileges and platform panel mappings globally for each workspace role.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="bg-[#1a2030] border-b border-[#252d3d] text-[#7a8aaa]">
                  <th className="px-4 py-3 font-semibold uppercase">Platform Role</th>
                  {Object.keys(roleAccess[0].panels).map(panel => (
                    <th key={panel} className="px-3 py-3 font-semibold uppercase text-center">{panel}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252d3d]">
                {roleAccess.map((entry, rIdx) => (
                  <tr key={entry.role} className="hover:bg-[#1a2030]/30">
                    <td className="px-4 py-3 font-bold text-[#e2e8f4]">{entry.role}</td>
                    {Object.entries(entry.panels).map(([panel, allowed]) => (
                      <td key={panel} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allowed}
                          disabled={entry.role === "Admin"}
                          onChange={() => {
                            if (entry.role === "Admin") return;
                            const next = [...roleAccess];
                            next[rIdx].panels[panel as keyof typeof entry.panels] = !allowed;
                            setRoleAccess(next);
                          }}
                          className="w-4 h-4 bg-[#1a2030] focus:ring-0 text-blue-500 border-[#252d3d] rounded accent-blue-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSavePermissionMatrix}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-5 py-2.5 rounded-lg cursor-pointer transition-all"
            >
              <Save size={14} />
              <span>Save Privilege Schemes</span>
            </button>
          </div>
        </div>
      )}

      {/* System Settings Tab */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Rules */}
          <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-6 space-y-5">
            <div className="border-b border-[#252d3d] pb-3">
              <h3 className="text-md font-bold text-[#e2e8f4]">TraceIQ Rule Controls</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#7a8aaa] mb-1.5">Defect Tolerability Threshold (% of Card Components)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.1"
                    className="bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-sm font-mono text-blue-400 focus:outline-none focus:border-blue-500"
                    value={defectThreshold}
                    onChange={(e) => setDefectThreshold(e.target.value)}
                  />
                  <span className="text-[#e2e8f4] text-xs font-semibold">% Yield Trigger</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7a8aaa] mb-1.5">Auto-Generating Default Lot Size</label>
                <input
                  type="number"
                  className="bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-sm font-mono text-blue-400 focus:outline-none focus:border-blue-500"
                  value={defaultLotSize}
                  onChange={(e) => setDefaultLotSize(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7a8aaa] mb-1.5">Database Scanner Barcode Prefix</label>
                <input
                  type="text"
                  className="bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-sm font-mono text-blue-400 focus:outline-none focus:border-blue-500"
                  value={barcodePrefix}
                  onChange={(e) => setBarcodePrefix(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7a8aaa] mb-1.5">Shift Working Hours (UTC)</label>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#7a8aaa]">Shift A:</span>
                    <input
                      type="text"
                      className="bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] px-2 py-1 rounded w-36 text-center"
                      value={shiftTimes.A}
                      onChange={(e) => setShiftTimes({...shiftTimes, A: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#7a8aaa]">Shift B:</span>
                    <input
                      type="text"
                      className="bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] px-2 py-1 rounded w-36 text-center"
                      value={shiftTimes.B}
                      onChange={(e) => setShiftTimes({...shiftTimes, B: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#7a8aaa]">Shift C:</span>
                    <input
                      type="text"
                      className="bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] px-2 py-1 rounded w-36 text-center"
                      value={shiftTimes.C}
                      onChange={(e) => setShiftTimes({...shiftTimes, C: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  onToast("System parameters updated successfully.", "success");
                  logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Settings", "Modified application system rules configuration");
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2 rounded-lg cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>

          {/* Grid Management */}
          <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-6 space-y-4">
            <div className="border-b border-[#252d3d] pb-3">
              <h3 className="text-md font-bold text-[#e2e8f4]">Stage & Station Configuration</h3>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {stages.map((stage) => (
                <div key={stage.id} className="bg-[#1a2030] border border-[#252d3d] rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center bg-[#0c0f14]/50 px-2 py-1.5 rounded">
                    <span className="font-bold text-xs font-mono text-blue-400">STAGE {stage.id}</span>
                    <span className="text-[#e2e8f4] font-semibold text-xs">{stage.name}</span>
                  </div>
                  <div className="space-y-1 pl-2">
                    {stage.stations.map(station => (
                      <div key={station.id} className="flex justify-between items-center text-xs">
                        <span className="font-mono text-[11px] text-[#7a8aaa]">{station.id}</span>
                        <span className="text-[#e2e8f4] text-[11px]">{station.name}</span>
                        <span className={`text-[10px] scale-90 rounded px-1.5 font-bold ${
                          station.status === 'Available' ? 'bg-green-500/10 text-green-400' :
                          station.status === 'Occupied' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-slate-700/30 text-[#7a8aaa]'
                        }`}>{station.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <p className="text-[11px] text-[#7a8aaa] text-center italic">
                Stage additions and Station routing updates can be synchronized live throughout operational sessions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-md font-semibold text-[#e2e8f4]">Comprehensive Action History Logs</div>
            <button
              onClick={exportLogsToCsv}
              className="inline-flex items-center space-x-1.5 bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] hover:bg-[#252d3d] text-xs px-3.5 py-2 rounded-lg cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV Spreadsheet</span>
            </button>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] rounded-xl overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans">
                <thead className="bg-[#1a2030] border-b border-[#252d3d] text-[#7a8aaa] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User Profile</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252d3d] font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1a2030]/30">
                      <td className="px-4 py-3 font-mono text-[11px] text-[#7a8aaa] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-[#e2e8f4]">
                        @{log.username} <span className="text-[10px] text-[#7a8aaa] italic">({log.role})</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-400">{log.module}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action === "CREATE" ? "bg-green-500/10 text-green-400" :
                          log.action === "UPDATE" ? "bg-amber-500/10 text-amber-400" :
                          log.action === "DELETE" ? "bg-red-500/10 text-red-500" :
                          log.action === "EXPORT" ? "bg-purple-500/10 text-purple-400" :
                          "bg-blue-500/10 text-blue-400"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#7a8aaa] font-sans text-xs">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - Add User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c10]/80 backdrop-blur-xs select-none">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1a2030] px-5 py-4 border-b border-[#252d3d] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#e2e8f4]">Register Workspace User</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Full Name*</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    placeholder="e.g. John Doe"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Username* (Unique)</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] font-mono focus:outline-none focus:border-blue-500"
                    placeholder="john.doe"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Role Type*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as Role})}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Production">Production (Operator)</option>
                    <option value="PPC">PPC (Planning)</option>
                    <option value="QC">QC (Quality)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Active Shift*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    value={formData.shift}
                    onChange={(e) => setFormData({...formData, shift: e.target.value as any})}
                  >
                    <option value="A">Shift A</option>
                    <option value="B">Shift B</option>
                    <option value="C">Shift C</option>
                  </select>
                </div>
              </div>

              {formData.role === "Production" && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-[#11131a] rounded border border-[#252d3d]">
                  <div>
                    <label className="block text-[#7a8aaa] font-bold mb-1">Assigned Stage*</label>
                    <select
                      required
                      className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                      value={formData.assignedStage}
                      onChange={(e) => setFormData({...formData, assignedStage: e.target.value, assignedStation: ""})}
                    >
                      <option value="">-- Choose Stage --</option>
                      {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#7a8aaa] font-bold mb-1">Assigned Station*</label>
                    <select
                      required
                      className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-1.5 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                      value={formData.assignedStation}
                      onChange={(e) => setFormData({...formData, assignedStation: e.target.value})}
                      disabled={!formData.assignedStage}
                    >
                      <option value="">-- Choose Station --</option>
                      {stationsAvailable.map(st => <option key={st.id} value={st.id}>{st.id} ({st.name})</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Temporary Password*</label>
                  <input
                    type="password"
                    required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    placeholder="Min 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Confirm Password*</label>
                  <input
                    type="password"
                    required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Contact Number</label>
                  <input
                    type="text"
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    placeholder="+91 xxxxx xxxxx"
                    value={formData.contact}
                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Join Date*</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500 font-mono"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-[#252d3d] hover:bg-[#2e3a50] text-[#e2e8f4] px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg cursor-pointer font-bold"
                >
                  Save User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - Edit User */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c10]/80 backdrop-blur-xs select-none">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1a2030] px-5 py-4 border-b border-[#252d3d] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#e2e8f4]">Edit User Profile: @{selectedUser.username}</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleEditUser} className="p-5 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Full Name*</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Role Type*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as Role})}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Production">Production (Operator)</option>
                    <option value="PPC">PPC (Planning)</option>
                    <option value="QC">QC (Quality)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Active Shift*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    value={formData.shift}
                    onChange={(e) => setFormData({...formData, shift: e.target.value as any})}
                  >
                    <option value="A">Shift A</option>
                    <option value="B">Shift B</option>
                    <option value="C">Shift C</option>
                  </select>
                </div>
              </div>

              {formData.role === "Production" && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-[#11131a] rounded border border-[#252d3d]">
                  <div>
                    <label className="block text-[#7a8aaa] font-bold mb-1">Assigned Stage*</label>
                    <select
                      required
                      className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                      value={formData.assignedStage}
                      onChange={(e) => setFormData({...formData, assignedStage: e.target.value, assignedStation: ""})}
                    >
                      <option value="">-- Choose Stage --</option>
                      {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#7a8aaa] font-bold mb-1">Assigned Station*</label>
                    <select
                      required
                      className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-1.5 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                      value={formData.assignedStation}
                      onChange={(e) => setFormData({...formData, assignedStation: e.target.value})}
                      disabled={!formData.assignedStage}
                    >
                      <option value="">-- Choose Station --</option>
                      {stationsAvailable.map(st => <option key={st.id} value={st.id}>{st.id} ({st.name})</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Contact Number</label>
                  <input
                    type="text"
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                    value={formData.contact}
                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Join Date*</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] font-mono focus:outline-none focus:border-blue-500"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Status</label>
                <select
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-[#252d3d] hover:bg-[#2e3a50] text-[#e2e8f4] px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg cursor-pointer font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - Reset Password */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c10]/80 backdrop-blur-xs select-none">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1a2030] px-5 py-4 border-b border-[#252d3d] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#e2e8f4]">Reset Security Key</h3>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs font-sans">
              <p className="text-[#7a8aaa]">
                Apply a temporary password for user <strong className="text-blue-400">@{selectedUser.username}</strong> ({selectedUser.fullName}).
              </p>
              
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">New Password (Min 8 Chars)*</label>
                <input
                  type="password"
                  required
                  placeholder="********"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500 font-mono"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Confirm New Password*</label>
                <input
                  type="password"
                  required
                  placeholder="********"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg px-3 py-2 text-[#e2e8f4] focus:outline-none focus:border-blue-500 font-mono"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                />
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="bg-[#252d3d] hover:bg-[#2e3a50] text-[#e2e8f4] px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg cursor-pointer font-bold"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
