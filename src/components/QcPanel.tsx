import React, { useState, useEffect } from "react";
import { 
  User, Stage, JobOrder, Lot, TrackingCard, DefectCategory, Alert
} from "../types.ts";
import { 
  getTrackingCards, saveTrackingCards, getDefectCategories, saveDefectCategories, 
  getJobOrders, getLots, getAlerts, saveAlerts, logAuditAction 
} from "../data.ts";
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ReferenceLine, LineChart
} from "recharts";
import { 
  Activity, AlertTriangle, RefreshCcw, CheckCircle, Search, Filter, 
  FileSpreadsheet, Clipboard, Layout, Plus, Trash2, Edit2, ShieldAlert
} from "lucide-react";

interface QcPanelProps {
  currentUser: User;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
}

export function QcPanel({ currentUser, onToast }: QcPanelProps) {
  // Tabs: "overview" | "categories" | "flagged" | "rework" | "reports"
  const [activeTab, setActiveTab] = useState<"overview" | "categories" | "flagged" | "rework" | "reports">("overview");

  // States
  const [cards, setCards] = useState<TrackingCard[]>([]);
  const [categories, setCategories] = useState<DefectCategory[]>([]);
  
  // Flagged list states
  const [selectedCardForReview, setSelectedCardForReview] = useState<TrackingCard | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState("Approved");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Filters
  const [flaggedFilter, setFlaggedFilter] = useState("All");
  const [categorySearch, setCategorySearch] = useState("");

  // Create Defect Category Form
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    code: "",
    name: "",
    stageGroup: "Soldering",
    severity: "High" as "Low" | "Medium" | "High" | "Critical"
  });

  // Load datasets
  useEffect(() => {
    setCards(getTrackingCards());
    setCategories(getDefectCategories());
  }, [activeTab]);

  // Statistics
  const totalCards = cards.length;
  const cardsRejected = cards.filter(c => c.status === "Reject").length;
  const reworkCount = cards.filter(c => c.status === "Rework").length;
  const passedUnits = cards.reduce((sum, c) => sum + c.passQty, 0);
  const rejectCount = cards.reduce((sum, c) => sum + c.rejectQty, 0);
  const rejectRate = passedUnits > 0 ? ((rejectCount / (passedUnits + rejectCount)) * 100).toFixed(1) : "0.0";

  // Recharts Pareto data: defect totals sorted descending and calculating cumulative %
  const sortedDefects = categories.map(cat => {
    // Sum counts from existing cards
    const actualCardCount = cards.reduce((sum, card) => {
      const match = card.defects.find(d => d.categoryCode === cat.code);
      return sum + (match ? match.count : 0);
    }, 0);
    return {
      name: cat.name,
      code: cat.code,
      count: actualCardCount || cat.count
    };
  }).sort((a, b) => b.count - a.count);

  const totalDefectSum = sortedDefects.reduce((sum, d) => sum + d.count, 0);
  
  let tempSum = 0;
  const paretoData = sortedDefects.map(d => {
    tempSum += d.count;
    const cumulativePercent = totalDefectSum > 0 ? Math.round((tempSum / totalDefectSum) * 100) : 0;
    return {
      name: d.name,
      Count: d.count,
      "Cumulative %": cumulativePercent
    };
  });

  // SPC mock charts lines
  const spcChartData = [
    { hour: "08:00", value: 1.2 },
    { hour: "09:00", value: 1.8 },
    { hour: "10:00", value: 2.5 },
    { hour: "11:00", value: 3.1 },
    { hour: "12:00", value: 4.8 }, // outlier
    { hour: "13:00", value: 2.1 },
    { hour: "14:00", value: 1.5 }
  ];

  const handleResolveFlagged = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardForReview) return;

    const nextStatus = resolutionStatus === "Approved" ? "Pass" 
                       : resolutionStatus === "Send to Rework" ? "Rework" 
                       : "Reject";

    const updated = cards.map(c => {
      if (c.id === selectedCardForReview.id) {
        return {
          ...c,
          status: nextStatus as any,
          remarks: resolutionNotes ? `${c.remarks || ""} [QC Resolution: ${resolutionNotes}]` : c.remarks
        };
      }
      return c;
    });

    saveTrackingCards(updated);
    setCards(updated);

    logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Quality Check", `Resolved quality audit flag on ${selectedCardForReview.id} to '${nextStatus}'`);
    onToast(`Quality card ${selectedCardForReview.id} has been resolution set to: ${nextStatus}.`, "success");
    setSelectedCardForReview(null);
    setResolutionNotes("");
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.code || !categoryForm.name) {
      onToast("Code and Name are required.", "error");
      return;
    }

    if (categories.some(c => c.code === categoryForm.code)) {
      onToast(`Defect code '${categoryForm.code}' is already registered.`, "error");
      return;
    }

    const newCat: DefectCategory = {
      code: categoryForm.code,
      name: categoryForm.name,
      stageGroup: categoryForm.stageGroup,
      severity: categoryForm.severity,
      count: 0
    };

    const updated = [...categories, newCat];
    saveDefectCategories(updated);
    setCategories(updated);
    onToast(`Defect category [${newCat.code}] saved!`, "success");
    setShowAddCategoryModal(false);
    setCategoryForm({ code: "", name: "", stageGroup: "Soldering", severity: "High" });
  };

  const handleDeleteCategory = (code: string) => {
    const ok = window.confirm(`Confirm deleting defect category: [${code}]?`);
    if (ok) {
      const updated = categories.filter(c => c.code !== code);
      saveDefectCategories(updated);
      setCategories(updated);
      onToast("Defect category purged.", "info");
    }
  };

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* Mini tabs */}
      <div className="flex border-b border-[#252d3d] overflow-x-auto space-x-1">
        {[
          { id: "overview", label: "Defect Analysis" },
          { id: "categories", label: "Anomaly Registry" },
          { id: "flagged", label: "Flag Audit Queue" },
          { id: "rework", label: "Rework Tracker" },
          { id: "reports", label: "Quality Reports (SPC/Pareto)" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-all ${
              activeTab === t.id ? "border-blue-500 text-blue-400" : "border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* DEFECT ANALYSIS VIEW (OVERVIEW) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4 flex justify-between items-center bg-radial">
              <div>
                <div className="text-[#7a8aaa] text-[10px] font-bold uppercase">Total Failures Found</div>
                <div className="text-2xl font-bold font-mono text-[#e2e8f4] mt-1">{totalDefectSum}</div>
              </div>
              <div className="text-red-400/20 bg-red-500/10 p-2.5 rounded-lg">
                <ShieldAlert size={20} />
              </div>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-[#7a8aaa] text-[10px] font-bold uppercase">Average Defect rate</div>
                <div className="text-2xl font-bold font-mono text-amber-500 mt-1">{rejectRate}%</div>
              </div>
              <div className="text-amber-500/20 bg-amber-500/10 p-2.5 rounded-lg">
                <Activity size={20} />
              </div>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-[#a78bfa] text-[10px] font-bold uppercase">Flagged Rejected</div>
                <div className="text-2xl font-bold font-mono text-[#a78bfa] mt-1">{cardsRejected} Cards</div>
              </div>
              <div className="text-purple-400/20 bg-purple-500/10 p-2.5 rounded-lg">
                <AlertTriangle size={20} />
              </div>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="text-green-400 text-[10px] font-bold uppercase">Active Rework loops</div>
                <div className="text-2xl font-bold font-mono text-green-400 mt-1">{reworkCount} Cards</div>
              </div>
              <div className="text-green-400/20 bg-green-500/10 p-2.5 rounded-lg">
                <RefreshCcw size={20} />
              </div>
            </div>
          </div>

          {/* PARETO INSIGHT CHART */}
          <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl">
            <h3 className="text-xs font-bold uppercase text-[#e2e8f4] mb-4">QC Pareto Analysis (Defect Count & Cumulative %)</h3>
            <div className="h-64 font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252d3d" />
                  <XAxis dataKey="name" stroke="#7a8aaa" />
                  <YAxis yAxisId="left" stroke="#7a8aaa" label={{ value: "Count", angle: -90, position: "insideLeft" }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#7a8aaa" label={{ value: "Cumulative %", angle: 90, position: "insideRight" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#131720", borderColor: "#252d3d", color: "#e2e8f4" }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Count" fill="#ef4444" name="Defect Volume" />
                  <Line yAxisId="right" type="monotone" dataKey="Cumulative %" stroke="#3b82f6" strokeWidth={2.5} name="Cumulative Contribution" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-[#7a8aaa] italic mt-3 text-center">
              *The Pareto principle states that roughly 80% of consequences come from 20% of causes. Address focus groups immediately.
            </p>
          </div>
        </div>
      )}

      {/* ANOMALY CATEGORIES REGISTRY KEY */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-grow max-w-sm">
              <Search className="absolute left-3 top-2.5 text-[#7a8aaa]" size={14} />
              <input
                type="text"
                placeholder="Search defcode or description..."
                className="w-full bg-[#131720] border border-[#252d3d] rounded-lg pl-8 pr-3 py-1 text-xs text-[#e2e8f4]"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowAddCategoryModal(true)}
              className="bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs px-4 py-1.5 rounded-lg select-none cursor-pointer"
            >
              Add Defect Type
            </button>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#1a2030] border-b border-[#252d3d] text-[#7a8aaa] uppercase text-[9px] font-bold">
                <tr>
                  <th className="p-3">Defect Code</th>
                  <th className="p-3">Defect Description</th>
                  <th className="p-3">Stage Category</th>
                  <th className="p-3">Risk Level</th>
                  <th className="p-3">Assigned Incidents</th>
                  <th className="p-3 text-right"> purge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252d3d]">
                {categories.filter(c=>c.name.toLowerCase().includes(categorySearch.toLowerCase()) || c.code.toLowerCase().includes(categorySearch.toLowerCase())).map(cat => (
                  <tr key={cat.code} className="hover:bg-[#1a2030]/65 text-xs">
                    <td className="p-3 font-mono text-red-400 font-bold">{cat.code}</td>
                    <td className="p-3 font-semibold text-[#e2e8f4]">{cat.name}</td>
                    <td className="p-3 text-[#7a8aaa]">{cat.stageGroup}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        cat.severity === 'Critical' ? 'bg-red-500/10 text-red-500 animate-pulse' :
                        cat.severity === 'High' ? 'bg-red-500/5 text-red-400' :
                        'bg-slate-700 text-[#7a8aaa]'
                      }`}>{cat.severity}</span>
                    </td>
                    <td className="p-3 font-mono">{cat.count} flags</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteCategory(cat.code)}
                        className="p-1 hover:bg-[#1a2030] rounded text-red-400 cursor-pointer"
                        title="Delete defect category code"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FLAG AUDIT QUEUE REVIEW */}
      {activeTab === "flagged" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-bold uppercase text-[#7a8aaa]">Incidents Needing Audit Resolution</h3>
              <select
                className="bg-[#131720] border border-[#252d3d] text-xs px-2.5 py-1 text-[#e2e8f4] rounded"
                value={flaggedFilter}
                onChange={(e) => setFlaggedFilter(e.target.value)}
              >
                <option value="All">All statuses</option>
                <option value="Reject">Reject Only</option>
                <option value="Rework">Rework Only</option>
              </select>
            </div>

            <div className="bg-[#131720] border border-[#252d3d] rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#1a2030] text-[#7a8aaa] uppercase text-[9px] font-bold border-b border-[#252d3d]">
                  <tr>
                    <th className="p-3">Barcode</th>
                    <th className="p-3">Station Origin</th>
                    <th className="p-3">Defects found</th>
                    <th className="p-3">Risk</th>
                    <th className="p-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252d3d]">
                  {cards.filter(c => (flaggedFilter === 'All' ? (c.status === 'Reject' || c.status === 'Rework') : c.status === flaggedFilter)).map(c => (
                    <tr key={c.id} className="hover:bg-[#1a2030]/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-red-400">{c.id}</td>
                      <td className="p-3">
                        <div className="text-[#e2e8f4]">{c.currentStage}</div>
                        <div className="text-[10px] text-[#7a8aaa] font-mono">{c.currentStation}</div>
                      </td>
                      <td className="p-3 font-semibold text-[#e2e8f4]">
                        {c.defects.map(d=>`${d.categoryName} x${d.count}`).join(", ") || "Visual anomaly"}
                      </td>
                      <td className="p-3 font-mono text-red-400 font-bold">{c.rejectQty} components</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedCardForReview(c)}
                          className="bg-blue-600 hover:bg-blue-500 font-bold text-white text-[10px] p-1.5 px-3 rounded cursor-pointer"
                        >
                          Resolve Card
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT SIDEBAR / DRAWER RESOLUTION CARD */}
          <div className="lg:col-span-1">
            {selectedCardForReview ? (
              <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-2xl space-y-5 text-xs">
                <div className="flex justify-between items-center border-b border-[#252d3d] pb-2">
                  <span className="font-bold text-xs text-[#e2e8f4]">Incident Review: {selectedCardForReview.id}</span>
                  <button onClick={() => setSelectedCardForReview(null)} className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer">✕</button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[#7a8aaa] block text-[10px] uppercase">Incident Source Coordinates</span>
                    <p className="font-semibold text-[#e2e8f4]">{selectedCardForReview.currentStage} ({selectedCardForReview.currentStation})</p>
                    <p className="text-[#7a8aaa] text-[10px] italic">Operator: {selectedCardForReview.operatorName}</p>
                  </div>

                  {selectedCardForReview.reason && (
                    <div className="p-3 bg-[#1a2030] text-red-400 border border-red-500/10 rounded-lg italic">
                      Operator Logged reason: "{selectedCardForReview.reason}"
                    </div>
                  )}

                  {/* Resolution choices */}
                  <form onSubmit={handleResolveFlagged} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-[#7a8aaa] font-bold text-[10px] uppercase mb-1.5">Action resolution Disposition*</label>
                      <select
                        className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] p-2 rounded focus:ring-0"
                        value={resolutionStatus}
                        onChange={(e) => setResolutionStatus(e.target.value)}
                      >
                        <option value="Approved">Approve Batch (Standard Yield Release)</option>
                        <option value="Send to Rework">Approve for Rework Loop</option>
                        <option value="Scrap">Confirm Scrap / Purge Defective Units</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#7a8aaa] font-bold text-[10px] uppercase mb-1.5 font-bold">Audit resolution comment log*</label>
                      <textarea
                        required
                        placeholder="Provide details of testing inspection findings..."
                        className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] p-2 rounded h-20 resize-none font-sans"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-green-600 hover:bg-green-500 text-white font-bold p-2.5 rounded-lg cursor-pointer text-center"
                    >
                      Apply QC Signoff
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-[#131720]/50 border border-dashed border-[#252d3d] p-8 rounded-2xl text-center text-[#7a8aaa] py-20">
                <Activity size={24} className="mx-auto mb-2 opacity-40 animate-pulse" />
                <span>Select any flagged barcode card on left to apply inspectors resolutions.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REWORK LOOP TRACKER */}
      {activeTab === "rework" && (
        <div className="bg-[#131720] border border-[#252d3d] p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-[#e2e8f4] border-b border-[#252d3d] pb-2">Active Rework Loops Queue</h3>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#1a2030] text-[#7a8aaa] font-bold uppercase text-[9px]">
                  <th className="p-3">Barcode</th>
                  <th className="p-3">Inbound Station</th>
                  <th className="p-3">Target Defect Category</th>
                  <th className="p-3">Hold Count</th>
                  <th className="p-3">Yield Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252d3d]">
                {cards.filter(c=>c.status === 'Rework').map(c => (
                  <tr key={c.id}>
                    <td className="p-3 font-mono font-bold text-purple-400">{c.id}</td>
                    <td className="p-3 text-[#e2e8f4]">{c.currentStage} ({c.currentStation})</td>
                    <td className="p-3 font-semibold text-[#e2e8f4]">
                      {c.defects.map(d=>d.categoryName).join(", ") || "Soldering bridgework"}
                    </td>
                    <td className="p-3 font-mono font-bold text-red-400">{c.rejectQty} units</td>
                    <td className="p-3">
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                        ROUTED FOR REWORK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QC REPORTS SPC LINES CHART VIEW */}
      {activeTab === "reports" && (
        <div className="bg-[#131720] border border-[#252d3d] p-6 rounded-2xl space-y-6">
          <div className="border-b border-[#252d3d] pb-3 flex justify-between items-center bg-transparent">
            <div>
              <h3 className="text-sm font-bold text-[#e2e8f4]">Statistical Process Control Yield (SPC Chart)</h3>
              <p className="text-xs text-[#7a8aaa] mt-1">Real-time daily percent deviations displaying UCL / LCL upper and lower tolerance lines.</p>
            </div>
            
            <button
              onClick={() => onToast("Process capability data metrics printed.", "success")}
              className="bg-[#1a2030] border border-[#252d3d] hover:bg-[#252d3d] text-[#e2e8f4] font-semibold text-xs py-1.5 px-3.5 rounded cursor-pointer"
            >
              Print Calibration Sheet
            </button>
          </div>

          <div className="h-64 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spcChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d3d" />
                <XAxis dataKey="hour" stroke="#7a8aaa" />
                <YAxis stroke="#7a8aaa" domain={[0, 6]} />
                <Tooltip contentStyle={{ backgroundColor: "#131720", borderColor: "#252d3d", color: "#e2e8f4" }} />
                
                {/* Horizontal bound thresholds values lines */}
                <ReferenceLine y={4.5} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "UCL (Upper Control limit)", position: "insideTopRight", fill: "#ef4444" }} />
                <ReferenceLine y={1.0} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "LCL (Lower Control limit)", position: "insideBottomRight", fill: "#22c55e" }} />
                
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Incident Standard deviation" activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* MODAL: ADD DEFECT TYPE */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c10]/85 backdrop-blur-xs select-none">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1a2030] px-4 py-3 border-b border-[#252d3d] flex items-center justify-between">
              <span className="font-bold text-xs text-[#e2e8f4]">Register Defect Category Code</span>
              <button onClick={() => setShowAddCategoryModal(false)} className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleAddCategory} className="p-4 space-y-3.5 text-xs font-sans">
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Code (Unique e.g. DEF-07)*</label>
                <input
                  type="text" required placeholder="DEF-07"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs font-mono"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({...categoryForm, code: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1">Anomalous Name / Description*</label>
                <input
                  type="text" required placeholder="Pin Oxide Layer Fault"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs text-[#e2e8f4]"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Manufacturing Stage Group*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs text-[#e2e8f4]"
                    value={categoryForm.stageGroup}
                    onChange={(e) => setCategoryForm({...categoryForm, stageGroup: e.target.value})}
                  >
                    <option value="Soldering">SMT Soldering</option>
                    <option value="Assembly">PCB Assembly</option>
                    <option value="Testing">Final Testing</option>
                    <option value="Cosmetic">Cosmetic Check</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1">Risk Severity*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs text-[#e2e8f4]"
                    value={categoryForm.severity}
                    onChange={(e) => setCategoryForm({...categoryForm, severity: e.target.value as any})}
                  >
                    <option value="Low">Low Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="High">High Risk</option>
                    <option value="Critical">Critical Risk</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button type="button" onClick={() => setShowAddCategoryModal(false)} className="bg-[#252d3d] text-[#e2e8f4] px-4 py-1.5 rounded cursor-pointer">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-1.5 rounded cursor-pointer">Register Code</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
