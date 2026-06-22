import React, { useState, useEffect, useRef } from "react";
import { 
  User, Stage, Station, JobOrder, Lot, TrackingCard, ActiveSession, DefectCategory, DefectItem
} from "../types.ts";
import { 
  getStages, getJobOrders, getLots, getTrackingCards, saveTrackingCards,
  getDefectCategories, logAuditAction 
} from "../data.ts";
import { 
  Play, ArrowRight, CornerRightDown, CheckCircle, AlertOctagon, RefreshCw, 
  Trash2, Plus, LogOut, Check, X, Award, Target, BookOpen, Clock, Scan
} from "lucide-react";

interface ProductionPanelProps {
  currentUser: User;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
}

export function ProductionPanel({ currentUser, onToast }: ProductionPanelProps) {
  // Tabs: "start" | "active" | "tasks" | "performance" | "guide"
  const [activeTab, setActiveTab] = useState<"start" | "active" | "tasks" | "performance" | "guide">("start");

  // Datasets
  const [stages, setStages] = useState<Stage[]>([]);
  const [jobs, setJobs] = useState<JobOrder[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [defectCategories, setDefectCategories] = useState<DefectCategory[]>([]);
  const [cards, setCards] = useState<TrackingCard[]>([]);

  // Active work Session from localStorage
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  // Guided Start Work steps (1, 2, or 3)
  const [setupStep, setSetupStep] = useState(1);
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedLot, setSelectedLot] = useState("");
  const [plannedComponents, setPlannedComponents] = useState(250);
  const [workNotes, setWorkNotes] = useState("");
  const [showOccupiedConfirm, setShowOccupiedConfirm] = useState(false);
  const [occupiedOperatorName, setOccupiedOperatorName] = useState("");

  // Scanner state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [currentScannedCard, setCurrentScannedCard] = useState<TrackingCard | null>(null);
  
  // Submission form state
  const [componentsIn, setComponentsIn] = useState(250);
  const [componentsProcessed, setComponentsProcessed] = useState(250);
  const [passCount, setPassCount] = useState(250);
  const [rejectCount, setRejectCount] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<"Pass" | "Reject" | "Rework" | "">("");
  const [remarks, setRemarks] = useState("");
  const [defectReason, setDefectReason] = useState("");
  const [customDefects, setCustomDefects] = useState<DefectItem[]>([]);

  // Timer reference for elapsed session counter
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  
  // Flying animation tick
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);

  // Load datasets on mount
  useEffect(() => {
    setStages(getStages());
    setJobs(getJobOrders().filter(j => j.status !== "Completed" && j.status !== "Cancelled"));
    setLots(getLots().filter(l => l.status !== "Completed"));
    setDefectCategories(getDefectCategories());
    setCards(getTrackingCards());
    
    // Read session from localStorage
    const saved = localStorage.getItem("traceiq_active_session");
    if (saved) {
      const sessObj = JSON.parse(saved) as ActiveSession;
      // If user matched current operator, restore session directly
      if (sessObj.userId === currentUser.id) {
        setActiveSession(sessObj);
        setActiveTab("active");
      }
    }
  }, []);

  // Sync pass/reject with components processed
  useEffect(() => {
    if (submissionResult === "Pass") {
      setPassCount(componentsProcessed);
      setRejectCount(0);
      setCustomDefects([]);
    } else {
      const calculatedRejects = Math.max(0, componentsProcessed - passCount);
      setRejectCount(calculatedRejects);
    }
  }, [componentsProcessed, passCount, submissionResult]);

  // Handle active countdown / elapsed timer
  useEffect(() => {
    if (activeSession) {
      tickRef.current = setInterval(() => {
        const start = new Date(activeSession.startTime).getTime();
        const diff = Date.now() - start;
        const hrs = String(Math.floor(diff / 3600000)).padStart(2, "0");
        const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
        const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
        setElapsedTime(`${hrs}:${mins}:${secs}`);
      }, 1000);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      setElapsedTime("00:00:00");
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [activeSession]);

  // Set default stage and station on load
  useEffect(() => {
    if (setupStep === 1 && currentUser.assignedStage) {
      setSelectedStage(currentUser.assignedStage);
    }
  }, [setupStep, currentUser]);

  useEffect(() => {
    if (setupStep === 2 && currentUser.assignedStation) {
      const stations = stages.find(s => s.name === selectedStage)?.stations || [];
      if (stations.some(st => st.id === currentUser.assignedStation)) {
        setSelectedStation(currentUser.assignedStation);
      }
    }
  }, [setupStep, selectedStage]);

  // Step 1: Click Stage Card
  const handleSelectStage = (stageName: string) => {
    setSelectedStage(stageName);
    setSelectedStation("");
  };

  // Step 2: Click Station Card
  const handleSelectStation = (station: Station) => {
    if (station.status === "Occupied") {
      setOccupiedOperatorName(station.currentOperator || "Another Operator");
      setSelectedStation(station.id);
      setShowOccupiedConfirm(true);
    } else {
      setSelectedStation(station.id);
    }
  };

  // Start active work loop
  const handleStartWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStage || !selectedStation || !selectedJob || !selectedLot) {
      onToast("Please allocate Job Order and Lot before commencing work.", "error");
      return;
    }

    const newSess: ActiveSession = {
      userId: currentUser.id,
      stage: selectedStage,
      station: selectedStation,
      jobOrder: selectedJob,
      lotNumber: selectedLot,
      shift: currentUser.shift,
      startTime: new Date().toISOString(),
      cardsSubmitted: 0,
      totalPass: 0,
      totalReject: 0,
      totalRework: 0
    };

    localStorage.setItem("traceiq_active_session", JSON.stringify(newSess));
    setActiveSession(newSess);
    logAuditAction(currentUser.username, currentUser.role, "CREATE", "Production Shift", `Began scanning at station ${selectedStation} for Lot ${selectedLot}`);
    onToast("Shift session setup. Redirecting to active console...", "success");
    setActiveTab("active");
  };

  // Exit work session
  const handleEndWorkSession = () => {
    if (!activeSession) return;
    const confirmEnd = window.confirm(`End your current production session?\nProcessed: ${activeSession.cardsSubmitted} cards.`);
    if (confirmEnd) {
      logAuditAction(currentUser.username, currentUser.role, "UPDATE", "Production Shift", `Ended scanning at station ${activeSession.station}. Submitted ${activeSession.cardsSubmitted} cards.`);
      onToast("Work session successfully signed off.", "info");
      localStorage.removeItem("traceiq_active_session");
      setActiveSession(null);
      setActiveTab("start");
      setSetupStep(1);
    }
  };

  // Input barcode submit trigger
  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    const queryId = barcodeInput.trim().toUpperCase();
    
    // Search database card
    // TRK-2025-0001 format
    const matchedCard = cards.find(c => c.id === queryId);
    
    if (matchedCard) {
      // Load card values to submission forms
      setCurrentScannedCard(matchedCard);
      setComponentsIn(matchedCard.componentsProcessed);
      setComponentsProcessed(matchedCard.componentsProcessed);
      setPassCount(matchedCard.componentsProcessed);
      setRejectCount(0);
      setSubmissionResult("Pass");
      setRemarks(matchedCard.remarks || "");
      setCustomDefects([]);
      setDefectReason("");
      onToast(`Trace card ${queryId} loaded. Submit stage outputs below.`, "success");
    } else {
      // Simulate creating a new TRK card for current lot if operator inputs new code
      const idCode = queryId.startsWith("TRK-") ? queryId : "TRK-2025-" + String(cards.length + 1).padStart(4, "0");
      const simulatedNewCard: TrackingCard = {
        id: idCode,
        jobId: activeSession?.jobOrder || "JOB-2025-001",
        lotId: activeSession?.lotNumber || "LOT-2025-A001",
        operatorName: currentUser.fullName,
        prevStage: "None (First Stage)",
        prevStation: "None",
        currentStage: activeSession?.stage || "PCB Assembly",
        currentStation: activeSession?.station || "PCB-ST01",
        nextStage: "AOI Inspection",
        nextStation: "AOI-ST01",
        componentsIn: 250,
        componentsProcessed: 250,
        passQty: 250,
        rejectQty: 0,
        reworkQty: 0,
        defects: [],
        status: "Pass",
        timestamp: new Date().toLocaleTimeString().slice(0, 5)
      };
      
      setCurrentScannedCard(simulatedNewCard);
      setComponentsIn(0);
      setComponentsProcessed(250);
      setPassCount(250);
      setRejectCount(0);
      setSubmissionResult("Pass");
      setRemarks("");
      setCustomDefects([]);
      setDefectReason("");
      onToast(`New card ${idCode} generated dynamically. Fill metrics.`, "info");
    }
  };

  // Defect lists adder
  const handleAddDefectLine = () => {
    const firstCat = defectCategories[0];
    const newDef: DefectItem = {
      categoryCode: firstCat.code,
      categoryName: firstCat.name,
      count: 1,
      description: ""
    };
    setCustomDefects([...customDefects, newDef]);
  };

  const handleRemoveDefectLine = (index: number) => {
    setCustomDefects(customDefects.filter((_, i) => i !== index));
  };

  const handleDefectChange = (index: number, field: keyof DefectItem, value: any) => {
    const updated = customDefects.map((def, i) => {
      if (i === index) {
        if (field === "categoryCode") {
          const matchedCat = defectCategories.find(c => c.code === value);
          return { ...def, categoryCode: value, categoryName: matchedCat?.name || "" };
        }
        return { ...def, [field]: value };
      }
      return def;
    });
    setCustomDefects(updated);
  };

  const defectSum = customDefects.reduce((sum, d) => sum + d.count, 0);

  // Submit tracking yield card to DB
  const handleFinalCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentScannedCard || !activeSession) return;

    if (!submissionResult) {
      onToast("Please choose yield action (Pass / Reject / Rework)", "error");
      return;
    }

    if (submissionResult !== "Pass") {
      // Validate defect counts match rejectCount
      if (defectSum !== rejectCount) {
        onToast(`Defect counts mismatch. Assigned ${defectSum} of ${rejectCount} failures.`, "error");
        return;
      }
      if (!defectReason) {
        onToast("Provide defect resolution reasoning log.", "error");
        return;
      }
    }

    // Prev stage values
    const nextList = [...stages];
    const currentIdx = stages.findIndex(s => s.name === activeSession.stage);
    const prevStageName = currentIdx > 0 ? stages[currentIdx - 1].name : "None (First Stage)";
    const nextStageName = currentIdx < stages.length - 1 ? stages[currentIdx + 1].name : "None (Final Stage)";

    const nextStationId = currentIdx < stages.length - 1 ? stages[currentIdx + 1].stations[0].id : "None";

    const updatedCard: TrackingCard = {
      ...currentScannedCard,
      operatorName: currentUser.fullName,
      currentStage: activeSession.stage,
      currentStation: activeSession.station,
      prevStage: prevStageName,
      prevStation: currentScannedCard.currentStation || "None",
      nextStage: nextStageName,
      nextStation: nextStationId,
      componentsIn: componentsIn,
      componentsProcessed: componentsProcessed,
      passQty: passCount,
      rejectQty: rejectCount,
      reworkQty: submissionResult === 'Rework' ? rejectCount : 0,
      defects: customDefects,
      status: submissionResult,
      reason: defectReason || undefined,
      remarks: remarks || undefined,
      timestamp: new Date().toLocaleTimeString().slice(0, 5)
    };

    // Save tracking list
    const updatedCards = [updatedCard, ...cards.filter(c => c.id !== updatedCard.id)];
    saveTrackingCards(updatedCards);
    setCards(updatedCards);

    // Save active session increment counters
    const nextSessionObj: ActiveSession = {
      ...activeSession,
      cardsSubmitted: activeSession.cardsSubmitted + 1,
      totalPass: activeSession.totalPass + (submissionResult === "Pass" ? 1 : 0),
      totalReject: activeSession.totalReject + (submissionResult === "Reject" ? 1 : 0),
      totalRework: activeSession.totalRework + (submissionResult === "Rework" ? 1 : 0)
    };
    localStorage.setItem("traceiq_active_session", JSON.stringify(nextSessionObj));
    setActiveSession(nextSessionObj);

    // Fly in success checks animations
    setShowSuccessCheck(true);
    setTimeout(() => {
      setShowSuccessCheck(false);
    }, 1500);

    onToast(`Card ${updatedCard.id} recorded with status: ${submissionResult}`, "success");
    
    // Reset scanner inputs
    setBarcodeInput("");
    setCurrentScannedCard(null);
  };

  return (
    <div className="space-y-6 select-none font-sans">
      {/* Dynamic Success Check Animation Hover */}
      {showSuccessCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none pointer-events-none">
          <div className="bg-[#131720] border border-green-500 rounded-2xl p-8 flex flex-col items-center space-y-4 animate-bounce">
            <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center">
              <CheckCircle size={48} className="animate-pulse" />
            </div>
            <div className="text-lg font-bold text-green-400">YIELD SUBMITTED</div>
            <p className="text-xs text-[#7a8aaa]">Barcode synchronized with production database successfully</p>
          </div>
        </div>
      )}

      {/* Mini Tabs */}
      <div className="flex border-b border-[#252d3d] overflow-x-auto space-x-1">
        {activeSession ? (
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'active' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
            }`}
          >
            Active Console ({activeSession.station})
          </button>
        ) : (
          <button
            onClick={() => setActiveTab("start")}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'start' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
            }`}
          >
            Start Work Wizard
          </button>
        )}
        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'tasks' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          My Station Tasks
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'performance' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          My Performance Streaks
        </button>
        <button
          onClick={() => setActiveTab("guide")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'guide' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#7a8aaa] hover:text-[#e2e8f4]'
          }`}
        >
          Quality Instructions Guide
        </button>
      </div>

      {/* START WORK GUIDED WIZARD FLOW */}
      {activeTab === "start" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-[#252d3d] pb-4">
            <div>
              <h2 className="text-md font-bold text-[#e2e8f4]">Step {setupStep} of 3 — Setup Workspace Parameters</h2>
              <p className="text-xs text-[#7a8aaa] mt-1">Configure your physical stage and station coordinates before scanning barcodes.</p>
            </div>
          </div>

          {/* STEP 1: SELECT STAGE */}
          {setupStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#7a8aaa] uppercase">Production Stage Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {stages.map((stg) => {
                  const isDefaultObj = currentUser.assignedStage === stg.name;
                  const chosenObj = selectedStage === stg.name;
                  return (
                    <div
                      key={stg.id}
                      onClick={() => handleSelectStage(stg.name)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between min-h-[110px] ${
                        chosenObj 
                          ? "bg-blue-600 border-blue-500 text-white" 
                          : "bg-[#1a2030] border-[#252d3d] text-[#e2e8f4] hover:bg-[#252d3d]/60"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[9px] font-bold opacity-75">STAGE 0{stg.id}</span>
                        {isDefaultObj && (
                          <span className="bg-blue-900 border border-blue-500/30 text-blue-200 text-[8px] font-bold uppercase px-2 py-0.5 rounded">
                            Your Default
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs mt-3">{stg.name}</div>
                      <div className="text-[10px] opacity-85 mt-2 font-mono">
                        Available: {stg.stations.filter(s => s.status !== 'Idle').length} stations
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => {
                    if (!selectedStage) {
                      onToast("Choose active stage.", "error");
                      return;
                    }
                    setSetupStep(2);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs px-5 py-2 rounded-lg cursor-pointer"
                >
                  Proceed to Station Selector
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE STATION */}
          {setupStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#7a8aaa] uppercase">Choose Active Station at {selectedStage}</h3>
                <button onClick={() => setSetupStep(1)} className="text-blue-400 hover:underline text-xs cursor-pointer">← Back to selection</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stages.find(s => s.name === selectedStage)?.stations.map((station) => {
                  const defaultSt = currentUser.assignedStation === station.id;
                  const activeSt = selectedStation === station.id;
                  return (
                    <div
                      key={station.id}
                      onClick={() => handleSelectStation(station)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        activeSt 
                          ? "bg-blue-600 border-blue-500 text-white" 
                          : "bg-[#1a2030] border-[#252d3d] text-[#e2e8f4] hover:bg-[#252d3d]/60"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-xs">{station.id}</span>
                        <div className="flex items-center space-x-1.5">
                          {defaultSt && (
                            <span className="bg-purple-900 border border-purple-500/20 text-purple-200 text-[8px] font-bold uppercase px-2 py-0.5 rounded">
                              DEFAULT
                            </span>
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            station.status === 'Available' ? 'bg-green-400' :
                            station.status === 'Occupied' ? 'bg-amber-400 animate-pulse' :
                            'bg-slate-500'
                          }`}></span>
                        </div>
                      </div>
                      <div className="font-bold text-xs mt-3">{station.name}</div>
                      <div className="text-[11px] mt-4 opacity-75 font-mono">
                        Status: {station.status}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Occupied warnings */}
              {showOccupiedConfirm && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 animate-shake mt-4">
                  <span>
                    Warning: Station {selectedStation} is currently locked by <strong className="underline">{occupiedOperatorName}</strong>. Ready to override registration?
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowOccupiedConfirm(false)}
                      className="bg-amber-600 text-white font-bold p-1 px-3 rounded text-[10px] cursor-pointer"
                    >
                      Confirm Allocate
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStation("");
                        setShowOccupiedConfirm(false);
                      }}
                      className="bg-[#252d3d] text-[#e2e8f4] p-1 px-3 rounded text-[10px] cursor-pointer"
                    >
                      Select Different Node
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-[#252d3d] mt-6">
                <button
                  onClick={() => setSetupStep(1)}
                  className="bg-[#252d3d] hover:bg-[#2e3a50] text-[#e2e8f4] text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (!selectedStation) {
                      onToast("Select active station.", "error");
                      return;
                    }
                    setSetupStep(3);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs px-5 py-2 rounded-lg cursor-pointer"
                >
                  Allocate Lot Job Order
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ALLOCATE JOB AND LOT */}
          {setupStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#7a8aaa] uppercase">Define Active Lot Target Batch</h3>
                <button onClick={() => setSetupStep(2)} className="text-blue-400 hover:underline text-xs cursor-pointer">← Back to selection</button>
              </div>

              <form onSubmit={handleStartWorkSubmit} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-[#7a8aaa] text-xs font-bold mb-1.5 uppercase">Job Order ID*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                    required
                    value={selectedJob}
                    onChange={(e) => {
                      setSelectedJob(e.target.value);
                      setSelectedLot("");
                    }}
                  >
                    <option value="">-- Click to allocate Job --</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{j.id} ({j.product} for {j.customer})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#7a8aaa] text-xs font-bold mb-1.5 uppercase">Subset Lot Number*</label>
                  <select
                    className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                    required
                    value={selectedLot}
                    onChange={(e) => setSelectedLot(e.target.value)}
                    disabled={!selectedJob}
                  >
                    <option value="">-- Click to allocate Lot --</option>
                    {lots.filter(l => l.jobId === selectedJob).map(l => (
                      <option key={l.id} value={l.id}>{l.id} ({l.qty} units)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#7a8aaa] text-xs font-bold mb-1.5 uppercase">Shift Group Code</label>
                    <div className="bg-[#1a2030] border border-[#252d3d]/50 p-2 text-xs font-mono text-center text-[#e2e8f4] rounded-lg">
                      Shift Group {currentUser.shift}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#7a8aaa] text-xs font-bold mb-1.5 uppercase">Target Components</label>
                    <input
                      type="number"
                      className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] rounded-lg p-2 text-xs focus:outline-none font-mono focus:border-blue-500"
                      value={plannedComponents}
                      onChange={(e) => setPlannedComponents(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#7a8aaa] text-xs font-bold mb-1.5 uppercase">Daily Operator Session Notes</label>
                  <textarea
                    placeholder="Provide any raw notes or batch descriptions (optional)..."
                    className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] rounded-lg p-2 text-xs focus:outline-none h-16 resize-none focus:border-blue-500"
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex justify-between space-x-2 border-t border-[#252d3d] mt-6">
                  <button
                    type="button"
                    onClick={() => setSetupStep(2)}
                    className="bg-[#252d3d] text-[#e2e8f4] px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-2 rounded-lg cursor-pointer flex-grow text-center"
                  >
                    Start Work Shift Loop
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE WORKSTATION CONSOLE */}
      {activeTab === "active" && activeSession && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            
            {/* SESSION BANNER */}
            <div className="bg-[#11131a] rounded-xl border border-[#252d3d] p-3 flex flex-wrap items-center justify-between text-xs gap-3 font-mono">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  {activeSession.stage}
                </span>
                <ArrowRight size={14} className="text-[#7a8aaa]" />
                <span className="bg-purple-900 border border-purple-500/20 text-purple-200 text-[10px] font-bold px-2 py-0.5 rounded">
                  {activeSession.station}
                </span>
                <ArrowRight size={14} className="text-[#7a8aaa]" />
                <span className="bg-slate-800 text-[#e2e8f4] text-[10px] font-bold px-2 py-0.5 rounded">
                  {activeSession.jobOrder}
                </span>
                <span className="text-[#ea580c] text-[10px] font-bold bg-[#ea580c]/10 border border-[#ea580c]/20 px-2 py-0.5 rounded">
                  Lot: {activeSession.lotNumber}
                </span>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5 text-blue-400">
                  <Clock size={14} />
                  <span className="font-bold">{elapsedTime}</span>
                </div>
                <button
                  onClick={handleEndWorkSession}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold px-2.5 py-1 text-[10px] font-sans rounded-md flex items-center space-x-1 cursor-pointer"
                >
                  <LogOut size={12} />
                  <span>Sigoff Shift</span>
                </button>
              </div>
            </div>

            {/* THREE COLUMN STATION FLOW TRAIL PANE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#131720]/70 border-l-2 border-[#252d3d] p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#7a8aaa]">Previous Node Source</div>
                  <div className="text-xs font-semibold text-[#e2e8f4] mt-1.5 flex items-center space-x-1.5">
                    <Play size={12} className="text-[#7a8aaa]" />
                    <span>Inbound Stage Input</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#7a8aaa] italic mt-3">Initial batch area validation passes directly.</p>
              </div>

              <div className="bg-[#131720] border-2 border-blue-500/40 glow-blue p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute right-0 top-0 bg-blue-500/10 text-blue-400 text-[8px] font-bold tracking-widest px-2.1.5 uppercase rounded-bl">
                  ACTIVE SCANNER
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-blue-400">Current Node Location</div>
                  <div className="text-md font-bold text-[#e2e8f4] mt-1">{activeSession.stage}</div>
                  <div className="text-xs font-mono text-[#7a8aaa] mt-0.5">{activeSession.station}</div>
                </div>
                <div className="flex items-center space-x-1 mt-4 text-[10px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping"></span>
                  <span className="font-bold tracking-wider uppercase">Listening scanner...</span>
                </div>
              </div>

              <div className="bg-[#131720]/70 border-r-2 border-[#252d3d] p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#7a8aaa]">Next Outbound Terminal</div>
                  <div className="text-xs font-semibold text-[#e2e8f4] mt-1.5 flex items-center space-x-1.5">
                    <span>AOI Inspection Scan</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#7a8aaa] italic mt-3">Target: AOI-ST01 scanner routing node.</p>
              </div>
            </div>

            {/* BARCODE SCANNER PANE */}
            <div className="bg-[#131720] border border-[#252d3d] p-6 rounded-2xl space-y-4">
              <form onSubmit={handleBarcodeScanSubmit} className="space-y-2">
                <label className="block text-xs font-bold text-[#7a8aaa] uppercase tracking-wider flex items-center space-x-1.5">
                  <Scan size={14} className="text-blue-400" />
                  <span>Scan Barcode Terminal</span>
                </label>
                
                <div className="relative">
                  <input
                    type="text"
                    className="w-full bg-[#161b26] border-2 border-[#252d3d] focus:border-blue-500 rounded-xl px-5 py-3.5 pl-11 font-mono text-[#e2e8f4] placeholder-[#7a8aaa] focus:outline-none text-sm font-bold shadow-inner"
                    placeholder="Scan product barcode or enter TRK-2025-0004 & press Enter (Simulate Scanner)..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                  />
                  <div className="absolute left-4 top-[32%] text-[#7a8aaa]">
                    ★
                  </div>
                </div>
                <p className="text-[10px] text-[#7a8aaa] italic">
                  Quick Testing: Enter <strong className="text-blue-400 font-mono">TRK-2025-0001</strong> or <strong className="text-blue-400 font-mono">TRK-2025-0004</strong> or try a new code to start tracking!
                </p>
              </form>

              {/* ACTIVE SUBMISSION FORM */}
              {currentScannedCard && (
                <form onSubmit={handleFinalCardSubmit} className="border-t border-[#252d3d] pt-6 space-y-5 animate-slide-up text-xs">
                  <div className="bg-[#1a2030] p-3 rounded-lg flex flex-wrap gap-4 text-xs font-mono justify-between items-center border border-[#252d3d]/50">
                    <div>Barcode: <strong className="text-blue-400">{currentScannedCard.id}</strong></div>
                    <div>Source: <strong className="text-[#e2e8f4]">{currentScannedCard.lotId}</strong></div>
                    <div>Original Stage: <strong className="text-[#e2e8f4]">{currentScannedCard.currentStage}</strong></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[#7a8aaa] text-[10px] font-bold uppercase mb-1">Components In</label>
                      <input
                        type="number"
                        className="w-full bg-[#1a2030] border border-[#252d3d] text-xs p-2 rounded text-[#e2e8f4] font-mono text-center"
                        value={componentsIn}
                        onChange={(e) => setComponentsIn(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-[#7a8aaa] text-[10px] font-bold uppercase mb-1">Processed</label>
                      <input
                        type="number"
                        className="w-full bg-[#1a2030] border border-[#252d3d] text-xs p-2 rounded text-[#e2e8f4] font-mono text-center"
                        value={componentsProcessed}
                        onChange={(e) => setComponentsProcessed(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-[#7a8aaa] text-[10px] font-bold uppercase mb-1">Pass Count</label>
                      <input
                        type="number"
                        className="w-full bg-[#1a2030] border border-[#252d3d] text-xs p-2 rounded text-green-400 font-mono text-center"
                        value={passCount}
                        onChange={(e) => setPassCount(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-[#7a8aaa] text-[10px] font-bold uppercase mb-1">Reject Yield</label>
                      <div className="bg-[#1a2030]/60 border border-[#252d3d] text-xs p-2 text-red-400 font-bold font-mono text-center rounded">
                        {rejectCount} REJ
                      </div>
                    </div>
                  </div>

                  {/* Toggle Pass / Reject / Rework */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setSubmissionResult("Pass")}
                      className={`p-3 rounded-xl border-2 font-bold cursor-pointer transition-all flex items-center justify-center space-x-2 ${
                        submissionResult === "Pass" 
                          ? "bg-green-600/10 border-green-500 text-green-400 font-bold" 
                          : "bg-[#1a2030] border-[#252d3d] text-[#7a8aaa] hover:bg-[#252d3d]/50"
                      }`}
                    >
                      <CheckCircle size={16} />
                      <span>PASS BATCH</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubmissionResult("Reject")}
                      className={`p-3 rounded-xl border-2 font-bold cursor-pointer transition-all flex items-center justify-center space-x-2 ${
                        submissionResult === "Reject" 
                          ? "bg-red-500/10 border-red-500 text-red-500 font-bold" 
                          : "bg-[#1a2030] border-[#252d3d] text-[#7a8aaa] hover:bg-[#252d3d]/50"
                      }`}
                    >
                      <AlertOctagon size={16} />
                      <span>REJECT BATCH</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubmissionResult("Rework")}
                      className={`p-3 rounded-xl border-2 font-bold cursor-pointer transition-all flex items-center justify-center space-x-2 ${
                        submissionResult === "Rework" 
                          ? "bg-purple-500/10 border-purple-500 text-purple-400 font-bold" 
                          : "bg-[#1a2030] border-[#252d3d] text-[#7a8aaa] hover:bg-[#252d3d]/50"
                      }`}
                    >
                      <RefreshCw size={16} />
                      <span>REWORK NEEDED</span>
                    </button>
                  </div>

                  {/* DEFECT ASSIGNER (IF REJECT OR REWORK) */}
                  {(submissionResult === "Reject" || submissionResult === "Rework") && (
                    <div className="p-4 bg-[#1a2030] border border-[#252d3d] rounded-xl space-y-4">
                      <div className="flex justify-between items-center border-b border-[#252d3d] pb-2">
                        <span className="font-bold text-xs text-[#e2e8f4]">Defect Details Specifications</span>
                        <div className="flex items-center space-x-3 text-xs font-mono">
                          <span className={`${defectSum === rejectCount ? 'text-green-400' : 'text-red-400 font-bold animate-pulse'}`}>
                            Defects classified: {defectSum} of {rejectCount}
                          </span>
                          <button
                            type="button"
                            onClick={handleAddDefectLine}
                            className="text-blue-400 hover:text-blue-300 flex items-center font-bold font-sans cursor-pointer"
                          >
                            <Plus size={14} /> Add Code
                          </button>
                        </div>
                      </div>

                      {customDefects.map((def, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-center">
                          <div className="flex-grow min-w-[200px]">
                            <label className="block text-[#7a8aaa] text-[9px] font-bold uppercase mb-1">Defect Category*</label>
                            <select
                              className="w-full bg-[#131720] border border-[#252d3d] p-1.5 text-xs text-[#e2e8f4] rounded focus:ring-0 rounded"
                              value={def.categoryCode}
                              onChange={(e) => handleDefectChange(idx, "categoryCode", e.target.value)}
                            >
                              {defectCategories.map(cat => (
                                <option key={cat.code} value={cat.code}>
                                  [{cat.code}] {cat.name} ({cat.severity})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="block text-[#7a8aaa] text-[9px] font-bold uppercase mb-1">Count*</label>
                            <input
                              type="number"
                              className="w-full bg-[#131720] font-mono border border-[#252d3d] p-1.5 text-xs text-center rounded text-[#e2e8f4]"
                              value={def.count}
                              onChange={(e) => handleDefectChange(idx, "count", parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="flex-grow">
                            <label className="block text-[#7a8aaa] text-[9px] font-bold uppercase mb-1">Description</label>
                            <input
                              type="text"
                              className="w-full bg-[#131720] border border-[#252d3d] p-1.5 text-xs rounded text-[#e2e8f4]"
                              value={def.description}
                              placeholder="Describe location..."
                              onChange={(e) => handleDefectChange(idx, "description", e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDefectLine(idx)}
                            className="p-1 text-red-400 hover:bg-[#131720] rounded border border-red-500/10 cursor-pointer h-8 h-8 flex items-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      <div>
                        <label className="block text-[#7a8aaa] text-[10px] font-bold uppercase mb-1">Failure Reason Description (Required)*</label>
                        <textarea
                          placeholder="Provide brief explanation why this card block is flagged as defective..."
                          required
                          className="w-full bg-[#131720] border border-[#252d3d] text-[#e2e8f4] rounded-lg p-2 resize-none h-16"
                          value={defectReason}
                          onChange={(e) => setDefectReason(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[#7a8aaa] text-[10px] uppercase font-semibold mb-1">Remarks</label>
                    <textarea
                      placeholder="Comment any work deviations or specifics here..."
                      className="w-full bg-[#1a2030] border border-[#252d3d] text-[#e2e8f4] rounded-lg p-2 text-xs resize-none focus:outline-none h-14"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>

                  <div className="flex space-x-2 justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => setCurrentScannedCard(null)}
                      className="bg-[#252d3d] text-[#e2e8f4] px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Discard Scanner
                    </button>
                    <button
                      type="submit"
                      className="bg-green-600 hover:bg-green-500 font-bold text-white px-6 py-2 rounded-lg cursor-pointer text-center"
                    >
                      Commit Unit Yield
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR LISTS - TODAY SESSION SUM */}
          <div className="space-y-6 lg:col-span-1">
            <div className="bg-[#131720] border border-[#252d3d] rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase text-[#7a8aaa] border-b border-[#252d3d] pb-2">Shift Session Summary</h3>
              
              <div className="grid grid-cols-2 gap-3 font-mono text-center">
                <div className="bg-[#1a2030] p-3 rounded-xl border border-[#252d3d]/50">
                  <div className="text-[9px] text-[#7a8aaa] font-sans">CARDS SUBMITTED</div>
                  <div className="text-xl font-bold text-[#e2e8f4]">{activeSession.cardsSubmitted}</div>
                </div>
                <div className="bg-[#1a2030] p-3 rounded-xl border border-[#252d3d]/50">
                  <div className="text-[9px] text-[#ea580c] font-sans">REJECTED DEFECTS</div>
                  <div className="text-xl font-bold text-red-400">{activeSession.totalReject}</div>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#252d3d] pt-3 text-xs">
                <div className="flex justify-between items-center text-[#7a8aaa]">
                  <span>OK Passes:</span>
                  <span className="font-bold font-mono text-green-400">{activeSession.totalPass} cards</span>
                </div>
                <div className="flex justify-between items-center text-[#7a8aaa]">
                  <span>Rework Demands:</span>
                  <span className="font-bold font-mono text-purple-400">{activeSession.totalRework} cards</span>
                </div>
                <div className="flex justify-between items-center text-[#7a8aaa]">
                  <span>Average Quality Yield:</span>
                  <span className="font-bold font-mono text-blue-400">
                    {activeSession.cardsSubmitted > 0 ? (100 - (activeSession.totalReject / activeSession.cardsSubmitted) * 100).toFixed(0) : "100"}% Rate
                  </span>
                </div>
              </div>
            </div>

            {/* RECENT SUBMISSIONS BY ME */}
            <div className="bg-[#131720] border border-[#252d3d] rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase text-[#7a8aaa]">Recent Yield Log submissions</h3>
              <div className="divide-y divide-[#252d3d]/60 max-h-56 overflow-y-auto">
                {cards.filter(c => c.operatorName === currentUser.fullName).slice(0, 5).map(c => (
                  <div key={c.id} className="py-2.5 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-mono text-blue-400 font-bold">{c.id}</div>
                      <div className="text-[10px] text-[#7a8aaa]">{c.currentStation} • {c.timestamp}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.status === "Pass" ? "bg-green-500/10 text-green-400" :
                      c.status === "Reject" ? "bg-red-500/10 text-red-400" :
                      "bg-purple-500/10 text-purple-400"
                    }`}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPERATOR STATION TASKS LISTINGS */}
      {activeTab === "tasks" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-2xl p-6 space-y-4">
          <div className="border-b border-[#252d3d] pb-3">
            <h3 className="text-sm font-bold text-[#e2e8f4]">My Workspace Tasks</h3>
            <p className="text-xs text-[#7a8aaa] mt-1">Pending batch runs currently allocated under your designated shift.</p>
          </div>

          <div className="space-y-3">
            {lots.slice(0, 3).map((lot) => (
              <div key={lot.id} className="p-4 bg-[#1a2030] border border-[#252d3d] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-blue-400">{lot.id}</span>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Allocation Pending</span>
                  </div>
                  <div className="text-xs text-[#7a8aaa]">Job Origin Ref: <strong>{lot.jobId}</strong> ({lot.qty} base boards)</div>
                </div>

                {!activeSession && (
                  <button
                    onClick={() => {
                      const matchedJob = jobs.find(j=>j.id===lot.jobId);
                      setSelectedStage(currentUser.assignedStage || "PCB Assembly");
                      setSelectedStation(currentUser.assignedStation || "PCB-ST01");
                      setSelectedJob(lot.jobId);
                      setSelectedLot(lot.id);
                      setSetupStep(3);
                      setActiveTab("start");
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs p-2 rounded-lg cursor-pointer"
                  >
                    Load Task into Wizard
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OPERATOR PERSONAL PERFORMANCE & STREAKS (Gamification) */}
      {activeTab === "performance" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-2xl flex flex-col items-center justify-center space-y-3 text-center">
            <div className="w-14 h-14 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center">
              <Award size={28} />
            </div>
            <div className="text-md font-bold text-[#e2e8f4]">Perfect Batch Champion</div>
            <p className="text-xs text-[#7a8aaa]">Completed 3 consecutive tracking cards with 100% component yield accuracy.</p>
            <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] px-2 py-0.5 roundedfont-bold">UNLOCKED</span>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-2xl flex flex-col items-center justify-center space-y-3 text-center">
            <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center">
              <Target size={28} />
            </div>
            <div className="text-md font-bold text-[#e2e8f4]">Throughput Master</div>
            <p className="text-xs text-[#7a8aaa]">Reached planned component target processing criteria in Shift allocation shifts.</p>
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] px-2 py-0.5 roundedfont-bold">UNLOCKED</span>
          </div>

          <div className="bg-[#131720] border border-[#252d3d] p-5 rounded-2xl flex flex-col items-center justify-center space-y-3 text-center opacity-60">
            <div className="w-14 h-14 bg-[#7a8aaa]/10 text-[#7a8aaa] rounded-full flex items-center justify-center">
              <BookOpen size={28} />
            </div>
            <div className="text-md font-bold text-[#e2e8f4]">Rapid Response Auditor</div>
            <p className="text-xs text-[#7a8aaa]">Clear and resolve 5 rework tasks routed from QC station checkers list.</p>
            <span className="bg-slate-700 text-[#7a8aaa] text-[9px] px-2 py-0.5 roundedfont-bold">LOCKED</span>
          </div>
        </div>
      )}

      {/* QUALITY REFERENCE MANUALS GUIDE */}
      {activeTab === "guide" && (
        <div className="bg-[#131720] border border-[#252d3d] rounded-2xl p-6 space-y-5">
          <div className="border-b border-[#252d3d] pb-3">
            <h3 className="text-sm font-bold text-[#e2e8f4]">Inspection Node Checkpoints Reference Manual</h3>
            <p className="text-xs text-[#7a8aaa] mt-1">Operational standards and definitions of common anomalies.</p>
          </div>

          <div className="space-y-3.5 text-xs text-[#7a8aaa]">
            <div className="bg-[#1a2030] p-4 rounded-xl space-y-2 border border-[#252d3d]/60">
              <h4 className="font-bold text-xs text-[#e2e8f4]">SMT Soldering checkpoints</h4>
              <p>Insure reflow oven temperature presets comply with lead-free profile parameters. Scan for bridging under magnification on IC pins.</p>
            </div>
            
            <div className="bg-[#1a2030] p-4 rounded-xl space-y-2 border border-[#252d3d]/60">
              <h4 className="font-bold text-xs text-[#e2e8f4]">Assembly Pad alignment standards</h4>
              <p>All component orientations must conform identically to fiducial parameters. Reject cards demonstrating components off-pad by &gt; 15%.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
