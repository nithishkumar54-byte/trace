import React, { useState, useEffect } from "react";
import { User } from "./types";
import { getUsers, saveUsers, logAuditAction, initializeSupabase } from "./data";
import { AdminPanel } from "./components/AdminPanel";
import { ManagerPanel } from "./components/ManagerPanel";
import { ProductionPanel } from "./components/ProductionPanel";
import { PpcPanel } from "./components/PpcPanel";
import { QcPanel } from "./components/QcPanel";
import { Cpu, LogOut, ChevronLeft, ChevronRight, Key, Activity } from "lucide-react";

type ToastType = "success" | "error" | "info";
type AppView = "loading" | "setup" | "login" | "portal";

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewingAsUser, setViewingAsUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>("loading");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Login form
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginErrorShake, setLoginErrorShake] = useState(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState("");
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  // Setup form
  const [setupForm, setSetupForm] = useState({
    fullName: "",
    username: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    contact: "",
  });
  const [passwordStrength, setPasswordStrength] = useState({
    text: "Weak",
    color: "bg-red-500 w-1/4",
  });

  // Profile dropdown
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [changePassForm, setChangePassForm] = useState({
    currPass: "",
    newPass: "",
    confirmPass: "",
  });

  // ── Toast helper ──────────────────────────────────────────────
  const triggerToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Init: load from Supabase ──────────────────────────────────
  useEffect(() => {
    initializeSupabase()
      .then(() => {
        const loaded = getUsers();
        setUsers(loaded);
        if (loaded.length === 0) {
          setCurrentView("setup");
          return;
        }
        const saved = localStorage.getItem("traceiq_session_user");
        if (saved) {
          const u = JSON.parse(saved) as User;
          const found = loaded.find(
            (x) => x.username === u.username && x.status === "Active"
          );
          if (found) {
            setCurrentUser(found);
            setCurrentView("portal");
            return;
          }
        }
        setCurrentView("login");
      })
      .catch((err) => {
        console.error("Supabase init failed:", err);
        triggerToast("Failed to connect to database. Check your .env file.", "error");
        setCurrentView("login");
      });
  }, []);

  // ── Clock ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTimeStr(new Date().toLocaleString()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Password strength ─────────────────────────────────────────
  useEffect(() => {
    const p = setupForm.password;
    if (!p) {
      setPasswordStrength({ text: "Too Short", color: "bg-red-500/20 w-0" });
    } else if (p.length < 6) {
      setPasswordStrength({ text: "Weak", color: "bg-red-500 w-1/4" });
    } else if (p.length < 10) {
      setPasswordStrength({ text: "Medium", color: "bg-yellow-500 w-2/4" });
    } else if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) {
      setPasswordStrength({ text: "Strong", color: "bg-green-500 w-full" });
    } else {
      setPasswordStrength({ text: "Good", color: "bg-blue-500 w-3/4" });
    }
  }, [setupForm.password]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleSuperAdminCreated = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupForm.fullName || !setupForm.username || !setupForm.password) {
      triggerToast("Complete all required fields", "error");
      return;
    }
    if (setupForm.password.length < 8) {
      triggerToast("Password must be at least 8 characters.", "error");
      return;
    }
    if (setupForm.password !== setupForm.confirmPassword) {
      triggerToast("Passwords do not match.", "error");
      return;
    }
    const admin: User = {
      id: "EMP012",
      fullName: setupForm.fullName,
      username: setupForm.username,
      passwordHash: setupForm.password,
      role: "Admin",
      shift: "A",
      status: "Active",
      contact: setupForm.contact,
      joinDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };
    const next = [admin];
    saveUsers(next);
    setUsers(next);
    setCurrentUser(admin);
    localStorage.setItem("traceiq_session_user", JSON.stringify(admin));
    logAuditAction(admin.username, "Admin", "CREATE", "System", "Super Admin created.");
    triggerToast("Super Admin registered. Welcome to TraceIQ!", "success");
    setCurrentView("portal");
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMsg("");
    setLoginErrorShake(false);
    const match = users.find(
      (u) => u.username === loginUsername && u.status === "Active"
    );
    if (match && match.passwordHash === loginPassword) {
      setCurrentUser(match);
      localStorage.setItem("traceiq_session_user", JSON.stringify(match));
      logAuditAction(match.username, match.role, "LOGIN", "System", "User logged in.");
      triggerToast(`Authenticated as @${match.username}`, "success");
      setCurrentView("portal");
    } else {
      setLoginErrorMsg("Invalid username or password");
      setLoginErrorShake(true);
      triggerToast("Access Denied: Invalid credentials.", "error");
    }
  };

  const handleUserLogout = () => {
    if (currentUser) {
      logAuditAction(currentUser.username, currentUser.role, "LOGIN", "System", "User signed out.");
    }
    setCurrentUser(null);
    setViewingAsUser(null);
    localStorage.removeItem("traceiq_session_user");
    setLoginUsername("");
    setLoginPassword("");
    setCurrentView("login");
    triggerToast("Session logged out.", "info");
  };

  const handleSelfPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (changePassForm.currPass !== currentUser.passwordHash) {
      triggerToast("Incorrect current password.", "error");
      return;
    }
    if (changePassForm.newPass.length < 8) {
      triggerToast("Password must be at least 8 characters.", "error");
      return;
    }
    if (changePassForm.newPass !== changePassForm.confirmPass) {
      triggerToast("Passwords do not match.", "error");
      return;
    }
    const updated = users.map((u) =>
      u.id === currentUser.id ? { ...u, passwordHash: changePassForm.newPass } : u
    );
    saveUsers(updated);
    setUsers(updated);
    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Profile", "Password changed.");
    triggerToast("Password updated!", "success");
    setShowChangePassModal(false);
    setChangePassForm({ currPass: "", newPass: "", confirmPass: "" });
  };

  const renderWorkspace = () => {
    const active = viewingAsUser || currentUser;
    if (!active) return <div>No user — please login.</div>;
    switch (active.role) {
      case "Admin":
        return (
          <AdminPanel
            currentUser={active}
            onToast={triggerToast}
            onLoginAs={(u) => setViewingAsUser(u)}
          />
        );
      case "Manager":
        return <ManagerPanel currentUser={active} onToast={triggerToast} />;
      case "Production":
        return <ProductionPanel currentUser={active} onToast={triggerToast} />;
      case "PPC":
        return <PpcPanel currentUser={active} onToast={triggerToast} />;
      case "QC":
        return <QcPanel currentUser={active} onToast={triggerToast} />;
      default:
        return <div>Invalid role. Contact supervisor.</div>;
    }
  };

  const demoAccounts = [
    { label: "Admin", color: "text-red-400", u: "admin", p: "admin123" },
    { label: "Manager", color: "text-amber-400", u: "manager", p: "mgr123" },
    { label: "Operator 1", color: "text-blue-400", u: "prod1", p: "prod123" },
    { label: "Operator 2", color: "text-blue-400", u: "prod2", p: "prod123" },
    { label: "PPC", color: "text-purple-400", u: "ppc1", p: "ppc123" },
    { label: "QC", color: "text-teal-400", u: "qc1", p: "qa123" },
  ];

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#0c0f14] text-[#e2e8f4] select-none text-sm relative">

      {/* TOAST */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 pr-1">
          <div
            className={`p-4 rounded-xl border flex items-center space-x-3 shadow-2xl ${
              toast.type === "success"
                ? "bg-green-500/10 border-green-500 text-green-400"
                : toast.type === "error"
                ? "bg-red-500/10 border-red-500 text-red-400"
                : "bg-blue-500/10 border-blue-500 text-blue-400"
            }`}
          >
            <span className="font-bold">★</span>
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* VIEW-AS BANNER */}
      {viewingAsUser && (
        <div className="bg-yellow-500 text-slate-950 px-4 py-2 text-xs font-bold text-center flex items-center justify-center space-x-3 z-30">
          <span>
            ⚠️ Simulating as{" "}
            <strong className="underline font-mono">
              @{viewingAsUser.username} ({viewingAsUser.fullName})
            </strong>
          </span>
          <button
            onClick={() => setViewingAsUser(null)}
            className="bg-slate-950 text-white text-[10px] font-bold px-3 py-1 rounded hover:opacity-80 cursor-pointer"
          >
            Exit Simulation
          </button>
        </div>
      )}

      {/* ── LOADING ── */}
      {currentView === "loading" && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Cpu className="animate-spin text-blue-500 mx-auto" size={40} />
            <p className="text-[#7a8aaa] text-sm font-mono">
              Connecting to TraceIQ database...
            </p>
          </div>
        </div>
      )}

      {/* ── SETUP ── */}
      {currentView === "setup" && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-[#131720] border border-[#252d3d] max-w-md w-full rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center space-x-1.5 text-blue-500 font-bold text-xl">
                <Cpu className="animate-pulse" size={26} />
                <span className="text-white tracking-tight">TraceIQ Setup</span>
              </div>
              <p className="text-[#7a8aaa] text-xs">
                Create your Super Admin account to initialize the system.
              </p>
            </div>

            <form onSubmit={handleSuperAdminCreated} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Santhosh Balu"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2.5 text-xs text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                  value={setupForm.fullName}
                  onChange={(e) =>
                    setSetupForm({ ...setupForm, fullName: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">
                  Username * (unique)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. santhosh.balu"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2.5 text-xs font-mono text-[#e2e8f4] focus:outline-none focus:border-blue-500"
                  value={setupForm.username}
                  onChange={(e) =>
                    setSetupForm({ ...setupForm, username: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 chars"
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2.5 text-xs font-mono"
                    value={setupForm.password}
                    onChange={(e) =>
                      setSetupForm({ ...setupForm, password: e.target.value })
                    }
                  />
                  <div className="text-[10px] text-[#7a8aaa] mt-1">
                    Strength:{" "}
                    <strong className="text-[#e2e8f4]">
                      {passwordStrength.text}
                    </strong>
                  </div>
                  <div className="w-full h-1 bg-[#252d3d] rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">
                    Confirm *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Match password"
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2.5 text-xs font-mono"
                    value={setupForm.confirmPassword}
                    onChange={(e) =>
                      setSetupForm({
                        ...setupForm,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">
                  Factory / Company Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. TraceIQ Systems Ltd"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2.5 text-xs text-[#e2e8f4]"
                  value={setupForm.companyName}
                  onChange={(e) =>
                    setSetupForm({ ...setupForm, companyName: e.target.value })
                  }
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-3 rounded-lg cursor-pointer transition-colors text-xs"
              >
                Create Super Admin &amp; Launch Portal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── LOGIN ── */}
      {currentView === "login" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#07090d]">
          <div className="max-w-md w-full space-y-4">
            <div
              className={`bg-[#131720] border border-[#252d3d] rounded-2xl p-7 space-y-5 shadow-2xl transition-all ${
                loginErrorShake ? "border-red-500/40" : ""
              }`}
            >
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center space-x-1.5 font-bold text-xl">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[#e2e8f4] tracking-wider uppercase">
                    TraceIQ Login
                  </span>
                </div>
                <p className="text-[#7a8aaa] text-xs">
                  Production Traceability &amp; Yield System
                </p>
              </div>

              {loginErrorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center rounded-lg font-semibold">
                  {loginErrorMsg}
                </div>
              )}

              <form onSubmit={handleUserLogin} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1.5 uppercase tracking-wider">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter username"
                    className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] focus:border-blue-500 rounded-lg p-2.5 text-xs font-mono focus:outline-none"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1.5 items-center">
                    <label className="block text-[#7a8aaa] font-bold uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#7a8aaa] hover:text-[#e2e8f4] text-[10px] cursor-pointer"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter password"
                    className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] focus:border-blue-500 rounded-lg p-2.5 text-xs font-mono focus:outline-none"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-colors"
                >
                  Confirm Authentication
                </button>
              </form>

              <div className="border-t border-[#252d3d]/60 pt-3 text-xs">
                <button
                  onClick={() => setShowDemoLogins(!showDemoLogins)}
                  className="w-full text-center text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer"
                >
                  {showDemoLogins ? "Hide Demo Accounts" : "Show Demo Accounts"}
                </button>

                {showDemoLogins && (
                  <div className="mt-3 grid grid-cols-2 gap-2 bg-[#0a0c10] p-3 rounded-lg font-mono text-[10px] text-[#7a8aaa]">
                    {demoAccounts.map((d) => (
                      <div
                        key={d.u}
                        className="p-1 px-2 border border-[#252d3d]/40 rounded cursor-pointer hover:bg-[#131720]"
                        onClick={() => {
                          setLoginUsername(d.u);
                          setLoginPassword(d.p);
                        }}
                      >
                        <strong className={d.color}>{d.label}:</strong>{" "}
                        {d.u} / {d.p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-[#7a8aaa] text-center italic">
              TraceIQ Secure Terminal. Unauthorized access prohibited.
            </p>
          </div>
        </div>
      )}

      {/* ── PORTAL ── */}
      {currentView === "portal" && currentUser && (
        <div className="flex flex-1 overflow-hidden h-screen">
          {/* Sidebar */}
          <div
            className={`bg-[#0F172A] border-r border-[#1e293b] flex flex-col justify-between transition-all duration-300 ${
              sidebarCollapsed ? "w-16" : "w-64"
            }`}
          >
            <div className="space-y-6">
              <div className="h-16 flex items-center justify-between px-4 border-b border-[#1e293b]">
                {!sidebarCollapsed ? (
                  <div className="flex items-center space-x-2.5 font-bold">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm">
                      IQ
                    </div>
                    <span className="text-white text-sm uppercase tracking-widest">
                      TraceIQ
                    </span>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-extrabold text-xs mx-auto">
                    IQ
                  </div>
                )}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1 hover:bg-[#1e293b] rounded text-slate-400 hover:text-white cursor-pointer"
                >
                  {sidebarCollapsed ? (
                    <ChevronRight size={16} />
                  ) : (
                    <ChevronLeft size={16} />
                  )}
                </button>
              </div>

              <div className="px-2 space-y-1">
                {!sidebarCollapsed && (
                  <div className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-4">
                    Main Panel
                  </div>
                )}
                <button className="w-full text-left px-3.5 py-3 rounded-lg flex items-center space-x-3 text-xs font-semibold bg-[#1e293b] text-white border-l-4 border-blue-500">
                  <Activity size={16} className="text-blue-400" />
                  {!sidebarCollapsed && <span>Dashboard Console</span>}
                </button>
              </div>
            </div>

            <div className="p-3 border-t border-[#1e293b] h-20 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser.fullName?.[0] ?? "?"}
                </div>
                {!sidebarCollapsed && (
                  <div className="truncate">
                    <div className="font-semibold text-white truncate text-xs">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-mono">
                      {currentUser.role}
                    </div>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <button
                  onClick={handleUserLogout}
                  className="p-1.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="h-16 bg-[#131720] border-b border-[#252d3d] px-6 flex items-center justify-between flex-shrink-0 z-20">
              <div className="flex items-center space-x-2.5">
                <h1 className="text-sm font-bold text-[#e2e8f4] uppercase">
                  {viewingAsUser
                    ? `Audit: ${viewingAsUser.role} Portal`
                    : `${currentUser.role} Portal`}
                </h1>
                <span className="text-[#252d3d]">/</span>
                <span className="bg-blue-500/5 border border-blue-500/10 rounded-full px-3 py-0.5 text-[10px] uppercase font-mono font-bold text-[#7a8aaa]">
                  Shift {currentUser.shift}
                </span>
              </div>

              <div className="flex items-center space-x-4">
                <span className="hidden sm:block font-mono text-xs text-[#7a8aaa] bg-[#1a2030] px-3.5 py-1.5 rounded-lg border border-[#252d3d]/60">
                  {timeStr || "—"}
                </span>

                <div className="relative">
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="w-7 h-7 rounded-full bg-blue-900/60 border border-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xs uppercase cursor-pointer"
                  >
                    {currentUser.fullName?.[0] ?? "?"}
                  </button>

                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2.5 w-48 bg-[#131720] border border-[#2e3a50] rounded-xl shadow-2xl py-1.5 z-40 text-xs">
                      <div className="px-3.5 py-2 border-b border-[#252d3d] text-xs text-[#7a8aaa] truncate">
                        Signed in as{" "}
                        <strong className="text-[#e2e8f4]">
                          @{currentUser.username}
                        </strong>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          setShowChangePassModal(true);
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-[#1a2030] text-[#e2e8f4] flex items-center space-x-2 cursor-pointer"
                      >
                        <Key size={12} />
                        <span>Update Password</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          handleUserLogout();
                        }}
                        className="w-full text-left px-3.5 py-2 hover:bg-red-500/10 text-red-400 flex items-center space-x-2 cursor-pointer"
                      >
                        <LogOut size={12} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]">
              {renderWorkspace()}
            </main>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {showChangePassModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-xs w-full shadow-2xl overflow-hidden">
            <div className="bg-[#1a2030] px-4 py-3 border-b border-[#252d3d] flex items-center justify-between">
              <span className="font-bold text-xs text-[#e2e8f4]">
                Update Password
              </span>
              <button
                onClick={() => setShowChangePassModal(false)}
                className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSelfPasswordChange}
              className="p-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs font-mono text-[#e2e8f4]"
                  value={changePassForm.currPass}
                  onChange={(e) =>
                    setChangePassForm({
                      ...changePassForm,
                      currPass: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">
                  New Password * (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs font-mono text-[#e2e8f4]"
                  value={changePassForm.newPass}
                  onChange={(e) =>
                    setChangePassForm({
                      ...changePassForm,
                      newPass: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs font-mono text-[#e2e8f4]"
                  value={changePassForm.confirmPass}
                  onChange={(e) =>
                    setChangePassForm({
                      ...changePassForm,
                      confirmPass: e.target.value,
                    })
                  }
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button
                  type="button"
                  onClick={() => setShowChangePassModal(false)}
                  className="bg-[#252d3d] text-[#e2e8f4] px-4 py-1.5 rounded cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white font-bold px-4 py-1.5 rounded cursor-pointer text-xs"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
