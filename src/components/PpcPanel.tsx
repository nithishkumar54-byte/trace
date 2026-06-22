import React, { useState, useEffect } from "react";
import { 
  User, Stage, JobOrder, Lot, TrackingCard
} from "../types.ts";
import { 
  getJobOrders, saveJobOrders, getLots, saveLots, getTrackingCards, logAuditAction 
} from "../data.ts";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { 
  Calendar, Layers, Cpu, TrendingUp, AlertTriangle, Plus, Trash2, Search, 
  Filter, CheckCircle, ChevronDown, ChevronRight, ListTodo, ShieldCheck
} from "lucide-react";

interface PpcPanelProps {
  currentUser: User;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
}

export function PpcPanel({ currentUser, onToast }: PpcPanelProps) {
  // Tabs: "schedule" | "jobs" | "lots" | "capacity" | "forecast"
  const [activeTab, setActiveTab] = useState<"schedule" | "jobs" | "lots" | "capacity" | "forecast">("schedule");

  // States
  const [jobs, setJobs] = useState<JobOrder[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [cards, setCards] = useState<TrackingCard[]>([]);

  // Search/Filters
  const [jobSearch, setJobSearch] = useState("");
  const [lotSearch, setLotSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");

  // Accordion active keys
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectedLotForTrace, setSelectedLotForTrace] = useState<string | null>(null);

  // New Job Order Form
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    product: "",
    customer: "",
    qty: 500,
    lotSize: 250,
    dueDate: new Date().toISOString().split("T")[0],
    priority: "High" as "High" | "Medium" | "Low" | "Critical",
    line: "Line 1",
    notes: ""
  });

  // Capacity load mock numbers
  const capacityData = [
    { stage: "PCB Assembly", currentLoad: 68, maxCapacity: 100, color: "text-green-400" },
    { stage: "SMT Soldering", currentLoad: 85, maxCapacity: 100, color: "text-amber-400" },
    { stage: "AOI Inspection", currentLoad: 92, maxCapacity: 100, color: "text-red-400 font-bold" },
    { stage: "Final Testing", currentLoad: 50, maxCapacity: 100, color: "text-green-400" },
    { stage: "Packing", currentLoad: 40, maxCapacity: 100, color: "text-green-400" }
  ];

  // Forecast trends line data
  const forecastTrendsData = [
    { date: "Jun 10", Projected: 450, Actual: 430 },
    { date: "Jun 11", Projected: 480, Actual: 470 },
    { date: "Jun 12", Projected: 500, Actual: 540 },
    { date: "Jun 13", Projected: 550, Actual: 520 },
    { date: "Jun 14", Projected: 600, Actual: 580 },
    { date: "Jun 15", Projected: 580, Actual: 610 },
    { date: "Jun 16", Projected: 650, Actual: 640 },
    { date: "Jun 17", Projected: 700, Actual: 680 },
    { date: "Jun 18", Projected: 730, Actual: 710 }
  ];

  // Load datasets
  useEffect(() => {
    setJobs(getJobOrders());
    setLots(getLots());
    setCards(getTrackingCards());
  }, [activeTab]);

  // Form submit handler
  const handleCreateJobOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobForm.product || !jobForm.customer) {
      onToast("Must specify product and client.", "error");
      return;
    }

    const nextJobId = "JOB-2025-" + String(jobs.length + 1).padStart(3, "0");
    const newJob: JobOrder = {
      id: nextJobId,
      product: jobForm.product,
      customer: jobForm.customer,
      qty: jobForm.qty,
      priority: jobForm.priority,
      dueDate: jobForm.dueDate,
      status: "In Progress",
      line: jobForm.line,
      notes: jobForm.notes
    };

    // Auto-generate lots based on size splits
    const totalQty = jobForm.qty;
    const lotCount = Math.ceil(totalQty / jobForm.lotSize);
    const newLotsCreated: Lot[] = [];

    for (let i = 0; i < lotCount; i++) {
      const charCode = String.fromCharCode(65 + i); // A, B, C etc.
      const lotId = `LOT-2025-${charCode}${String(lots.length + 1 + i).padStart(3, "0")}`;
      const sizeInput = (i === lotCount - 1) ? (totalQty - (i * jobForm.lotSize)) : jobForm.lotSize;
      
      newLotsCreated.push({
        id: lotId,
        jobId: nextJobId,
        qty: sizeInput,
        status: "Pending",
        passQty: 0,
        rejectQty: 0,
        currentStage: "PCB Assembly"
      });
    }

    const updatedJobs = [...jobs, newJob];
    const updatedLots = [...lots, ...newLotsCreated];

    saveJobOrders(updatedJobs);
    saveLots(updatedLots);
    setJobs(updatedJobs);
    setLots(updatedLots);

    logAuditAction(currentUser.username, currentUser.role, "CREATE", "Job Allocation", `Pre-scheduled job order ${nextJobId} with ${lotCount} sub-lots.`);
    onToast(`Job ${nextJobId} initialized with ${lotCount} sub-lots!`, "success");
    setShowAddJobModal(false);
    
    // reset form
    setJobForm({
      product: "",
      customer: "",
      qty: 500,
      lotSize: 250,
      dueDate: new Date().toISOString().split("T")[0],
      priority: "High",
      line: "Line 1",
      notes: ""
    });
  };

  const handleCancelJob = (jobId: string) => {
    const confirmCancel = window.confirm(`Are you sure you want to cancel Job ${jobId}?`);
    if (confirmCancel) {
      const updated = jobs.map(j => {
        if (j.id === jobId) return { ...j, status: "Cancelled" as const };
        return j;
      });
      saveJobOrders(updated);
      setJobs(updated);
      logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Job Allocation", `Cancelled Job Order: ${jobId}`);
      onToast(`Job ${jobId} status flagged canceled.`, "info");
    }
  };

  // Helper calculation
  const getLotsForJob = (jobId: string) => lots.filter(l => l.jobId === jobId);

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* Navigation tabs */}
      <div className="flex border-b border-[#252d3d] overflow-x-auto space-x-1">
        {[
          { id: "schedule", label: "Production Schedule" },
          { id: "jobs", label: "Job Order Management" },
          { id: "lots", label: "Complete traceability Log" },
          { id: "capacity", label: "Shop Capacity Views" },
          { id: "forecast", label: "Performance Forecast" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-all ${
              activeTab === t.id ? "border-blue-500 text-blue-400" : "border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SCHEDULE WEEKLY CALENDAR GRID VIEW */}
      {activeTab === "schedule" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-[#131720] border border-[#252d3d] rounded-xl p-4">
            <div>
              <h3 className="text-xs font-bold uppercase text-[#e2e8f4]">Master Lines Calendar</h3>
              <p className="text-[10px] text-[#7a8aaa]">Grid scheduling allocation across operational micro-lines (A, B, C shifts).</p>
            </div>
            
            <button
              onClick={() => setShowAddJobModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-1.5 rounded-lg flex items-center space-x-1 select-none cursor-pointer"
            >
              <Plus size={14} />
              <span>Schedule Run</span>
            </button>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-4 overflow-hidden overflow-x-auto">
            <div className="min-w-[800px] space-y-3">
              <div className="grid grid-cols-8 gap-2.5 text-center text-[10px] font-bold text-[#7a8aaa] uppercase font-mono tracking-widest pb-2 border-b border-[#252d3d]/50">
                <div>Manufacturing Line</div>
                <div>Monday</div>
                <div>Tuesday</div>
                <div>Wednesday</div>
                <div>Thursday</div>
                <div>Friday</div>
                <div>Saturday</div>
                <div>Sunday</div>
              </div>

              {[
                { line: "Line 1 (PCB Pre)", blocks: jobs.filter(j => j.line === "Line 1" && j.status !== "Cancelled") },
                { line: "Line 2 (SMT Solder)", blocks: jobs.filter(j => j.line === "Line 2" && j.status !== "Cancelled") },
                { line: "Line 3 (Final Test)", blocks: jobs.filter(j => (j.line === "Line 3" || !j.line) && j.status !== "Cancelled") }
              ].map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-8 gap-2.5 min-h-[75px] items-center">
                  <div className="text-xs font-bold text-[#e2e8f4] truncate bg-[#1a2030] p-3 text-center rounded border border-[#252d3d]">
                    {row.line}
                  </div>
                  {Array.from({ length: 7 }).map((_, colIdx) => {
                    const block = row.blocks[colIdx % row.blocks.length];
                    return (
                      <div key={colIdx} className="h-full">
                        {block ? (
                          <div className={`p-2.5 rounded text-left border h-full flex flex-col justify-between cursor-pointer hover:scale-103 transition-transform ${
                            block.priority === "High" ? "bg-red-500/5 border-red-500/20 text-red-400" :
                            block.priority === "Medium" ? "bg-amber-500/5 border-amber-500/20 text-amber-500" :
                            "bg-blue-500/5 border-blue-500/15 text-blue-400"
                          }`}>
                            <div className="font-mono text-[9px] font-bold">{block.id}</div>
                            <div className="font-semibold text-[10px] text-[#e2e8f4] truncate max-w-[80px] mt-1">{block.product}</div>
                            <div className="text-[8px] text-[#7a8aaa] font-mono mt-1">Goal: {block.qty} Pcs</div>
                          </div>
                        ) : (
                          <div className="h-full border border-dashed border-[#252d3d]/40 rounded hover:border-[#252d3d] transition-colors flex items-center justify-center text-[9px] text-[#7a8aaa]">
                            Available
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* JOB ORDER LIST TABLE */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-grow max-w-sm">
              <Search className="absolute left-3 top-2 text-[#7a8aaa]" size={14} />
              <input
                type="text"
                placeholder="Find jobs by customer name, product ID..."
                className="w-full bg-[#131720] border border-[#252d3d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#e2e8f4]"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowAddJobModal(true)}
              className="bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs px-4 py-1.5 rounded-lg select-none cursor-pointer"
            >
              Add Job Block
            </button>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#1a2030] text-[#7a8aaa] uppercase text-[9px] border-b border-[#252d3d]">
                <tr>
                  <th className="p-3">Job ID</th>
                  <th className="p-3">Product Description</th>
                  <th className="p-3">Customer Entity</th>
                  <th className="p-3 font-mono">Qty</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252d3d]">
                {jobs.filter(j => j.product.toLowerCase().includes(jobSearch.toLowerCase()) || j.customer.toLowerCase().includes(jobSearch.toLowerCase())).map(job => (
                  <React.Fragment key={job.id}>
                    <tr className="hover:bg-[#1a2030]/50">
                      <td className="p-3 font-mono font-bold text-blue-400">
                        <button 
                          onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                          className="hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          {expandedJobId === job.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span>{job.id}</span>
                        </button>
                      </td>
                      <td className="p-3 text-[#e2e8f4] font-semibold">{job.product}</td>
                      <td className="p-3 text-xs text-[#7a8aaa]">{job.customer}</td>
                      <td className="p-3 font-mono font-bold text-[#e2e8f4]">{job.qty} pcs</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          job.priority === 'High' ? 'bg-red-500/10 text-red-400' : 'bg-slate-700 text-[#7a8aaa]'
                        }`}>{job.priority} Priority</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          job.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                          job.status === 'Cancelled' ? 'bg-slate-700 text-[#7a8aaa]' :
                          'bg-blue-500/10 text-blue-400 animate-pulse'
                        }`}>{job.status}</span>
                      </td>
                      <td className="p-3 text-right">
                        {job.status !== "Cancelled" && job.status !== "Completed" && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="p-1 text-red-400 hover:bg-[#1c2433] rounded cursor-pointer"
                            title="Cancel job"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* EXPAND SUB-LOTS FOR DEEPER AUDITING ACCORDION */}
                    {expandedJobId === job.id && (
                      <tr>
                        <td colSpan={7} className="p-4 bg-[#11141c]/60">
                          <div className="space-y-2 border-l-2 border-blue-500 pl-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#7a8aaa]">Assigned Sub-Lot Arrays</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                              {getLotsForJob(job.id).map(lot => (
                                <div key={lot.id} className="bg-[#1a2030] p-2.5 rounded border border-[#252d3d] flex justify-between items-center font-mono">
                                  <div>
                                    <span className="text-purple-400 font-bold">{lot.id}</span>
                                    <span className="text-[#7a8aaa] block text-[9px] font-sans">Size: {lot.qty} Pcs</span>
                                  </div>
                                  <span className={`px-1.5 rounded text-[9px] ${
                                    lot.status === 'Completed' ? 'text-green-400' : 'text-blue-400'
                                  }`}>{lot.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOT MANAGEMENT COMPREHENSIVE TRACEBILITY LOG */}
      {activeTab === "lots" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LOT SELECTOR ROW COLUMN */}
            <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl space-y-3 lg:col-span-1">
              <h3 className="text-xs font-bold uppercase text-[#7a8aaa] border-b border-[#252d3d] pb-2">Active Factory Lots</h3>
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                {lots.map(lot => {
                  const job = jobs.find(j=>j.id===lot.jobId);
                  const isCurSelected = selectedLotForTrace === lot.id;
                  return (
                    <div
                      key={lot.id}
                      onClick={() => setSelectedLotForTrace(lot.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                        isCurSelected ? "bg-purple-900/20 border-purple-500" : "bg-[#1a2030] border-[#252d3d] hover:bg-[#252d3d]/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs font-mono text-purple-400">{lot.id}</span>
                        <span className={`text-[9px] px-1.5 rounded font-mono font-bold ${
                          lot.status === 'Completed' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>{lot.status}</span>
                      </div>
                      <div className="text-xs font-medium text-[#e2e8f4] mt-1.5">{job?.product}</div>
                      <div className="text-[10px] text-[#7a8aaa] mt-1 font-mono">Lot size: {lot.qty} Pcs</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BARCODE TRACE PIPELINE MAP */}
            <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-xl lg:col-span-2 space-y-4">
              <h3 className="text-xs font-bold uppercase text-[#7a8aaa] border-b border-[#252d3d] pb-2">Lot Barcode Tracking History Trace (Full Flow)</h3>
              
              {selectedLotForTrace ? (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1 text-xs">
                  <div className="flex justify-between items-center bg-[#1a2030] p-3 rounded border border-[#252d3d]">
                    <span className="font-bold text-xs uppercase text-[#e2e8f4]">Trace Audit Ledger: {selectedLotForTrace}</span>
                    <span className="text-[10px] font-mono text-blue-400">TOTAL: {cards.filter(c=>c.lotId === selectedLotForTrace).length} cards verified</span>
                  </div>

                  <div className="space-y-2">
                    {cards.filter(c => c.lotId === selectedLotForTrace).map((card) => (
                      <div key={card.id} className="p-3 bg-[#161a24] border border-[#252d3d] rounded-lg">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-mono font-bold text-blue-400 text-sm">{card.id}</span>
                          <span className="font-semibold text-[10px] text-[#7a8aaa] font-mono">{card.timestamp}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
                          <div className="space-y-1">
                            <div>Stage Node: <strong className="text-blue-400">{card.currentStage}</strong> ({card.currentStation})</div>
                            <div>Operator: <strong className="text-blue-200">{card.operatorName || "N/A"}</strong></div>
                          </div>
                          <div className="space-y-1 justify-self-end text-right">
                            <span className={`inline-block px-1.5 rounded-[3px] font-bold ${
                              card.status === 'Pass' ? 'bg-green-500/10 text-green-400' :
                              card.status === 'Reject' ? 'bg-red-500/10 text-red-400' :
                              'bg-purple-500/10 text-purple-400'
                            }`}>{card.status} Yield</span>
                            <div className="font-mono text-[10px] text-[#7a8aaa] mt-1">Processed: {card.componentsProcessed} component nodes</div>
                          </div>
                        </div>

                        {card.reason && (
                          <div className="mt-2.5 p-2 bg-[#1b212f] border border-red-500/10 text-red-400 rounded text-[11px] italic">
                            Reason: {card.reason}
                          </div>
                        )}
                      </div>
                    ))}

                    {cards.filter(c => c.lotId === selectedLotForTrace).length === 0 && (
                      <div className="text-center text-[#7a8aaa] py-8 text-xs italic">
                        No operators have scanned active barcode tracking cards for lot {selectedLotForTrace} yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-[#7a8aaa] py-16 text-xs flex flex-col items-center justify-center space-y-2">
                  <Cpu size={32} className="text-[#252d3d] animate-pulse" />
                  <span>Click an active factory Lot on the left to review operational tracking history maps.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CAPACITY VIEWS TAB */}
      {activeTab === "capacity" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-6 space-y-5">
          <div className="border-b border-[#252d3d] pb-3">
            <h3 className="text-sm font-bold text-[#e2e8f4]">Shop Floor Line Capacity Utilization</h3>
            <p className="text-xs text-[#7a8aaa] mt-1">Live throughput capacity across core stages.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {capacityData.map((cap) => {
              const utilPercent = Math.round((cap.currentLoad / cap.maxCapacity) * 100);
              return (
                <div key={cap.stage} className="bg-[#1a2030] p-4 rounded-xl border border-[#252d3d] space-y-3">
                  <div className="font-semibold text-xs text-[#e2e8f4]">{cap.stage}</div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[#7a8aaa]">Utilization:</span>
                    <strong className={cap.color}>{utilPercent}% Load</strong>
                  </div>
                  <div className="w-full h-1.5 bg-[#131720] rounded-full overflow-hidden">
                    <div className={`h-full ${
                      utilPercent > 90 ? "bg-red-500" :
                      utilPercent > 70 ? "bg-amber-500" :
                      "bg-green-500"
                    }`} style={{ width: `${utilPercent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RECHARTS VALUE PROJECTED FORECAST TAB */}
      {activeTab === "forecast" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-xl p-5 space-y-5">
          <div className="border-b border-[#252d3d] pb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase text-[#e2e8f4]">Projected vs. Actual Daily Work volumes</h3>
            <span className="text-green-400 text-[10px] font-mono border border-green-500/20 px-2 py-0.5 rounded font-bold uppercase bg-green-500/5">
              Accuracy OK
            </span>
          </div>

          <div className="h-64 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastTrendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d3d" />
                <XAxis dataKey="date" stroke="#7a8aaa" />
                <YAxis stroke="#7a8aaa" />
                <Tooltip contentStyle={{ backgroundColor: "#131720", borderColor: "#252d3d", color: "#e2e8f4" }} />
                <Line type="monotone" dataKey="Projected" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="Actual" stroke="#f59e0b" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SCHEDULE ACTION REGISTER JOB POPUP */}
      {showAddJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0c10]/85 backdrop-blur-xs select-none">
          <div className="bg-[#131720] border border-[#2e3a50] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1a2030] px-4 py-3 border-b border-[#252d3d] flex items-center justify-between">
              <span className="font-bold text-xs text-[#e2e8f4]">Create Job Order Block</span>
              <button onClick={() => setShowAddJobModal(false)} className="text-[#7a8aaa] hover:text-[#e2e8f4] cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleCreateJobOrder} className="p-4 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1 uppercase">Target Product/Model Code*</label>
                <input
                  type="text" required placeholder="e.g. Model X-Z1"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs focus:ring-0 text-[#e2e8f4]"
                  value={jobForm.product}
                  onChange={(e) => setJobForm({...jobForm, product: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1 uppercase">Client Company Entity*</label>
                <input
                  type="text" required placeholder="e.g. Acme Micro"
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs focus:ring-0 text-[#e2e8f4]"
                  value={jobForm.customer}
                  onChange={(e) => setJobForm({...jobForm, customer: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-sans">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1 uppercase">Job Goal Qty*</label>
                  <input
                    type="number" required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs focus:ring-0 text-amber-400 font-mono"
                    value={jobForm.qty}
                    onChange={(e) => setJobForm({...jobForm, qty: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1 uppercase">Sub-Lot Range Splits*</label>
                  <input
                    type="number" required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs focus:ring-0 text-purple-400 font-mono"
                    value={jobForm.lotSize}
                    onChange={(e) => setJobForm({...jobForm, lotSize: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1 uppercase">Due Date*</label>
                  <input
                    type="date" required
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-xs text-[#e2e8f4] font-mono"
                    value={jobForm.dueDate}
                    onChange={(e) => setJobForm({...jobForm, dueDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[#7a8aaa] font-bold mb-1 uppercase">Manufacturing Line</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4]"
                    value={jobForm.line}
                    onChange={(e) => setJobForm({...jobForm, line: e.target.value})}
                  >
                    <option value="Line 1">Manufacturing Line 1</option>
                    <option value="Line 2">Manufacturing Line 2</option>
                    <option value="Line 3">Manufacturing Line 3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#7a8aaa] font-bold mb-1 uppercase">Batch Priority*</label>
                <select
                  className="w-full bg-[#1a2030] border border-[#252d3d] rounded-lg p-2 text-[#e2e8f4] font-bold"
                  value={jobForm.priority}
                  onChange={(e) => setJobForm({...jobForm, priority: e.target.value as any})}
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                  <option value="Critical">Critical Priority</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-[#252d3d]">
                <button type="button" onClick={() => setShowAddJobModal(false)} className="bg-[#252d3d] text-[#e2e8f4] px-4 py-1.5 rounded cursor-pointer">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-1.5 rounded cursor-pointer">Plan Job Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
