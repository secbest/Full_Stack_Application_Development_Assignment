import React, { useState, useRef } from "react";
import {
  Bell,
  FileText,
  Briefcase,
  User,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  X,
} from "lucide-react";
import { SidebarItem } from "./shared";

// ─── Field Crew types & data ──────────────────────────────────────────────────

type JobStatus = "Confirmed" | "In Progress" | "Completed";
type DateFilter = "Today" | "Tomorrow" | "This Week";

interface Job {
  ref: string;
  client: string;
  serviceType: string;
  transferType: string;
  date: string;
  time: string;
  pickup: string;
  destination: string;
  status: JobStatus;
  dateGroup: DateFilter;
}

const JOBS: Job[] = [
  {
    ref: "BKG-2026-00004",
    client: "Tan Tock Seng Hospital",
    serviceType: "MTS",
    transferType: "One-Way Hospital Transfer",
    date: "14 Jun 2026",
    time: "08:00",
    pickup: "TTSH",
    destination: "SGH A&E",
    status: "In Progress",
    dateGroup: "Today",
  },
  {
    ref: "BKG-2026-00008",
    client: "Changi General Hospital",
    serviceType: "EAS",
    transferType: "Critical · ICU Transfer",
    date: "5 Jul 2026",
    time: "14:30",
    pickup: "CGH",
    destination: "SGH A&E",
    status: "Confirmed",
    dateGroup: "Today",
  },
  {
    ref: "BKG-2026-00003",
    client: "TTSH",
    serviceType: "EAS",
    transferType: "One-Way Hospital Transfer",
    date: "13 Jun 2026",
    time: "10:00",
    pickup: "TTSH",
    destination: "NUH Ward 5",
    status: "Completed",
    dateGroup: "Today",
  },
  {
    ref: "BKG-2026-00012",
    client: "Gleneagles Hospital",
    serviceType: "MTS",
    transferType: "One-Way Hospital Transfer",
    date: "6 Jul 2026",
    time: "09:30",
    pickup: "Gleneagles",
    destination: "Raffles Hospital",
    status: "Confirmed",
    dateGroup: "Tomorrow",
  },
  {
    ref: "BKG-2026-00013",
    client: "Mount Elizabeth",
    serviceType: "EAS",
    transferType: "One-Way Hospital Transfer",
    date: "7 Jul 2026",
    time: "11:00",
    pickup: "Mount Elizabeth",
    destination: "SGH A&E",
    status: "Confirmed",
    dateGroup: "This Week",
  },
  {
    ref: "BKG-2026-00014",
    client: "NUH",
    serviceType: "MTS",
    transferType: "One-Way Hospital Transfer",
    date: "8 Jul 2026",
    time: "14:00",
    pickup: "NUH",
    destination: "Changi General Hospital",
    status: "Confirmed",
    dateGroup: "This Week",
  },
];

const STATUS_ACCENT: Record<JobStatus, string> = {
  "Confirmed":   "#3B82F6",
  "In Progress": "#F59E0B",
  "Completed":   "#22C55E",
};
const STATUS_BADGE: Record<JobStatus, { bg: string; color: string }> = {
  "Confirmed":   { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
  "In Progress": { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
  "Completed":   { bg: "rgba(34,197,94,0.12)",   color: "#22C55E" },
};

// ─── Field Crew Sidebar ───────────────────────────────────────────────────────

type FieldPage = "jobs" | "memos" | "profile";

function FieldSidebar({ activePage, onNav, onLogout }: {
  activePage: FieldPage;
  onNav: (p: FieldPage) => void;
  onLogout: () => void;
}) {
  const items: { id: FieldPage; icon: React.ReactNode; label: string }[] = [
    { id: "jobs",    icon: <Briefcase size={16} />,  label: "My Jobs"  },
    { id: "memos",   icon: <FileText size={16} />,   label: "My Memos" },
    { id: "profile", icon: <User size={16} />,       label: "Profile"  },
  ];
  return (
    <aside style={{ width: 240, flexShrink: 0, background: "#1E293B", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>EFAR</span>
      </div>
      <nav style={{ flex: 1, paddingTop: 12 }}>
        {items.map(({ id, icon, label }) => (
          <SidebarItem key={id} icon={icon} label={label} active={activePage === id} onClick={() => onNav(id)} />
        ))}
      </nav>
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={onLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 6, border: "none", background: "transparent", color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s, color 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#FCA5A5"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}>
          <LogOut size={16} /> Log Out
        </button>
      </div>
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#0F172A", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#FFFFFF", flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>RK</div>
        <div style={{ overflow: "hidden" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Ravi Kumar</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Field Crew</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onStartJob, onCompleteMemo }: {
  job: Job;
  onStartJob: (ref: string) => void;
  onCompleteMemo: (ref: string) => void;
}) {
  const accent = STATUS_ACCENT[job.status];
  const badge = STATUS_BADGE[job.status];

  return (
    <div style={{
      background: "#FFFFFF",
      borderRadius: 12,
      border: "1px solid #E2E8F0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      display: "flex",
      overflow: "hidden",
      transition: "box-shadow 0.15s",
    }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
    >
      {/* Accent bar */}
      <div style={{ width: 4, background: accent, flexShrink: 0 }} />

      {/* Card body */}
      <div style={{ flex: 1, padding: "18px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>

        {/* Left: job details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Ref */}
          <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginBottom: 4, letterSpacing: "0.02em" }}>{job.ref}</p>

          {/* Client */}
          <p style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 6, lineHeight: 1.3 }}>{job.client}</p>

          {/* Service + transfer type */}
          <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>
            {job.serviceType} · {job.transferType}
          </p>

          {/* Date/time + route */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
              <Clock size={12} color="#94A3B8" />
              {job.date}, {job.time}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
              <MapPin size={12} color="#94A3B8" />
              {job.pickup} → {job.destination}
            </span>
          </div>
        </div>

        {/* Right: status badge + action */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
          {/* Status badge */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
            {job.status === "Completed" && <CheckCircle2 size={11} strokeWidth={2.5} />}
            {job.status === "In Progress" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: badge.color, display: "inline-block", animation: "pulse 1.6s ease-in-out infinite" }} />}
            {job.status}
          </span>

          {/* Action area */}
          {job.status === "Confirmed" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
              <button
                onClick={() => onStartJob(job.ref)}
                style={{ height: 40, padding: "0 16px", borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "background 0.12s", minWidth: 160 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E293B")}>
                Start Job &amp; Create Memo
              </button>
              <p style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'Inter', sans-serif", textAlign: "right" }}>This will mark the job as In Progress.</p>
            </div>
          )}

          {job.status === "In Progress" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
              <button
                onClick={() => onCompleteMemo(job.ref)}
                style={{ height: 40, padding: "0 16px", borderRadius: 8, background: "#F59E0B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "background 0.12s", minWidth: 160 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#D97706")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F59E0B")}>
                Complete Memo
              </button>
              <p style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'Inter', sans-serif", textAlign: "right" }}>Job started — submit your field memo when done.</p>
            </div>
          )}

          {job.status === "Completed" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#22C55E", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
              <CheckCircle2 size={16} strokeWidth={2.5} />
              Memo Submitted
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Jobs Screen ───────────────────────────────────────────────────────────

function MyJobsScreen({ onStartJob, onCompleteMemo }: {
  onStartJob: (ref: string) => void;
  onCompleteMemo: (ref: string) => void;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("Today");
  const [jobStatuses, setJobStatuses] = useState<Record<string, JobStatus>>({});

  const resolvedStatus = (job: Job): JobStatus => jobStatuses[job.ref] ?? job.status;

  const visibleJobs = JOBS.filter((j) => j.dateGroup === dateFilter);

  const handleStart = (ref: string) => {
    setJobStatuses((prev) => ({ ...prev, [ref]: "In Progress" }));
    onStartJob(ref);
  };

  const handleComplete = (ref: string) => {
    onCompleteMemo(ref);
  };

  return (
    <div>
      {/* Date filter tabs */}
      <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 8, padding: 4, width: "fit-content", marginBottom: 24 }}>
        {(["Today", "Tomorrow", "This Week"] as DateFilter[]).map((tab) => (
          <button key={tab} onClick={() => setDateFilter(tab)}
            style={{ padding: "7px 18px", borderRadius: 6, border: dateFilter === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: dateFilter === tab ? "#FFFFFF" : "transparent", color: dateFilter === tab ? "#1E293B" : "#64748B", fontSize: 13, fontWeight: dateFilter === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.12s", whiteSpace: "nowrap" }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Job list or empty state */}
      {visibleJobs.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 32px", gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <CheckSquare size={36} color="#CBD5E1" strokeWidth={1.5} />
            <div style={{ position: "absolute", bottom: -4, right: -4, width: 24, height: 24, borderRadius: "50%", background: "#DCFCE7", border: "2px solid #FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={14} color="#22C55E" strokeWidth={2.5} />
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1E293B", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>No jobs for {dateFilter.toLowerCase()}</p>
            <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, maxWidth: 340 }}>
              No jobs assigned for today. Check <strong style={{ color: "#1E293B" }}>"This Week"</strong> for upcoming assignments.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibleJobs.map((job) => (
            <JobCard
              key={job.ref}
              job={{ ...job, status: resolvedStatus(job) }}
              onStartJob={handleStart}
              onCompleteMemo={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Wizard Progress Bar ──────────────────────────────────────────────────────

const WIZARD_STEPS = ["Job Details", "Service & Charges", "Signature", "Stamp & Submit"];

function WizardProgressBar({ currentStep }: { currentStep: number }) {
  const pct = (currentStep / WIZARD_STEPS.length) * 100;
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Step labels + nodes */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        {WIZARD_STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          const isFuture = stepNum > currentStep;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < WIZARD_STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: isDone ? "#22C55E" : isActive ? "#1E293B" : "#E2E8F0",
                  transition: "background 0.2s",
                }}>
                  {isDone
                    ? <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                    : <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#FFFFFF" : "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{stepNum}</span>
                  }
                </div>
                <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isFuture ? "#94A3B8" : "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                  {label}
                </span>
              </div>
              {i < WIZARD_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: isDone ? "#22C55E" : "#E2E8F0", margin: "0 8px", marginBottom: 20, transition: "background 0.3s" }} />
              )}
            </div>
          );
        })}
      </div>
      {/* Progress bar track */}
      <div style={{ height: 3, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#1E293B", borderRadius: 99, transition: "width 0.35s ease" }} />
      </div>
    </div>
  );
}

// ─── Wizard shared styles ─────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 14, fontWeight: 500, color: "#1E293B",
  marginBottom: 6, fontFamily: "'Inter', sans-serif",
};
const helperTextStyle: React.CSSProperties = {
  fontSize: 12, color: "#64748B", marginTop: 6, lineHeight: 1.5, fontFamily: "'Inter', sans-serif",
};

// ─── Wizard Step 1: Job Details ───────────────────────────────────────────────

interface WizardField {
  startTime: string;
  endTime: string;
  patientName: string;
  patientNric: string;
  overtimeHours: number;
  evacuationFloors: number;
}

function WizardStep1({ bookingRef, onNext, onCancel }: {
  bookingRef: string;
  onNext: (fields: WizardField) => void;
  onCancel: () => void;
}) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientNric, setPatientNric] = useState("");
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [evacuationFloors, setEvacuationFloors] = useState(0);

  const [stFocused, setStFocused] = useState(false);
  const [etFocused, setEtFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [nricFocused, setNricFocused] = useState(false);
  const [otFocused, setOtFocused] = useState(false);
  const [efFocused, setEfFocused] = useState(false);

  const canProceed = startTime.trim() !== "" && endTime.trim() !== "" && patientName.trim() !== "";

  const inputBase = (focused: boolean): React.CSSProperties => ({
    width: "100%", height: 44, padding: "0 14px", borderRadius: 8,
    border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`,
    background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none",
    fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Scrollable form area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>
        <WizardProgressBar currentStep={1} />

        {/* Pre-filled booking summary */}
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "14px 16px", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span style={{ fontSize: 12, color: "#3B82F6", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
              Pre-filled from booking {bookingRef}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
            {[
              ["Client",      "Changi General Hospital"],
              ["Date",        "5 Jul 2026"],
              ["Pickup",      "CGH, 2 Simei Street 3"],
              ["Destination", "SGH A&E, Outram Road"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", minWidth: 72, flexShrink: 0 }}>{label}:</span>
                <span style={{ fontSize: 12, color: "#1E293B", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editable fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Start / End time row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={fieldLabelStyle} htmlFor="w-start">
                Job Start Time <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input id="w-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                onFocus={() => setStFocused(true)} onBlur={() => setStFocused(false)}
                placeholder="08:00" style={inputBase(stFocused)} />
            </div>
            <div>
              <label style={fieldLabelStyle} htmlFor="w-end">
                Job End Time <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input id="w-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                onFocus={() => setEtFocused(true)} onBlur={() => setEtFocused(false)}
                placeholder="09:30" style={inputBase(etFocused)} />
            </div>
          </div>

          {/* Patient Name */}
          <div>
            <label style={fieldLabelStyle} htmlFor="w-patient">
              Patient Name <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input id="w-patient" type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)}
              onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)}
              placeholder="Full legal name of patient" style={inputBase(nameFocused)} />
          </div>

          {/* Patient NRIC */}
          <div>
            <label style={fieldLabelStyle} htmlFor="w-nric">
              Patient NRIC / FIN <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
            </label>
            <input id="w-nric" type="text" value={patientNric} onChange={(e) => setPatientNric(e.target.value)}
              onFocus={() => setNricFocused(true)} onBlur={() => setNricFocused(false)}
              placeholder="S1234567A (if provided)" style={inputBase(nricFocused)} />
          </div>

          {/* Overtime / Floors row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={fieldLabelStyle} htmlFor="w-ot">Overtime Hours</label>
              <input id="w-ot" type="number" min={0} value={overtimeHours}
                onChange={(e) => setOvertimeHours(Math.max(0, Number(e.target.value)))}
                onFocus={() => setOtFocused(true)} onBlur={() => setOtFocused(false)}
                style={{ ...inputBase(otFocused), padding: "0 14px" }} />
              <p style={helperTextStyle}>Enter 0 if no overtime occurred.</p>
            </div>
            <div>
              <label style={fieldLabelStyle} htmlFor="w-floors">Evacuation Floors</label>
              <input id="w-floors" type="number" min={0} value={evacuationFloors}
                onChange={(e) => setEvacuationFloors(Math.max(0, Number(e.target.value)))}
                onFocus={() => setEfFocused(true)} onBlur={() => setEfFocused(false)}
                style={{ ...inputBase(efFocused), padding: "0 14px" }} />
              <p style={helperTextStyle}>Number of floors evacuated (for documentation). Enter 0 if none.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ height: 64, borderTop: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", flexShrink: 0, marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32 }}>
        <button onClick={onCancel}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s, color 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}>
          Cancel
        </button>
        <button onClick={() => canProceed && onNext({ startTime, endTime, patientName, patientNric, overtimeHours, evacuationFloors })}
          disabled={!canProceed}
          style={{ height: 40, padding: "0 20px", borderRadius: 8, background: canProceed ? "#1E293B" : "#CBD5E1", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: canProceed ? "pointer" : "not-allowed", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
          onMouseEnter={(e) => { if (canProceed) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
          onMouseLeave={(e) => { if (canProceed) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
          Next: Service &amp; Charges <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", flexShrink: 0,
        background: value ? "#1E293B" : "#E2E8F0",
        position: "relative", transition: "background 0.2s",
        padding: 0,
      }}
      aria-checked={value}
      role="switch"
    >
      <span style={{
        position: "absolute", top: 3, left: value ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

// ─── Surcharge row ────────────────────────────────────────────────────────────

function SurchargeRow({ label, value, onChange, children }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: value ? "#1E293B" : "#94A3B8", fontWeight: 500, fontFamily: "'Inter', sans-serif", minWidth: 24, textAlign: "right" }}>{value ? "YES" : "NO"}</span>
          <Toggle value={value} onChange={onChange} />
        </div>
      </div>
      {value && children && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// ─── Amber info chip ──────────────────────────────────────────────────────────

function AmberChip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)" }}>
      <AlertTriangle size={13} color="#F59E0B" strokeWidth={2.5} />
      <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{children}</span>
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function WizardCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{title}</h3>
      </div>
      <div style={{ padding: "8px 24px 20px" }}>{children}</div>
    </div>
  );
}

// ─── Wizard Step 2: Service & Charges ────────────────────────────────────────

interface Step2Field {
  serviceType: string;
  transferType: string;
  officeHours: boolean;
  hasInconvenienceFee: boolean;
  oxygenUsed: boolean;
  oxygenLitres: number;
  disposablesUsed: boolean;
  resuscitation: boolean;
  suction: boolean;
  jurongIsland: boolean;
  waitingTime: number;
  patientWeight: string;
}

function WizardStep2({ onBack, onNext }: {
  onBack: () => void;
  onNext: (fields: Step2Field) => void;
}) {
  const [serviceType, setServiceType] = useState("");
  const [transferType, setTransferType] = useState("");
  const [officeHours, setOfficeHours] = useState(true);
  const [hasInconvenienceFee, setHasInconvenienceFee] = useState(false);
  const [oxygenUsed, setOxygenUsed] = useState(false);
  const [oxygenLitres, setOxygenLitres] = useState(0);
  const [disposablesUsed, setDisposablesUsed] = useState(false);
  const [resuscitation, setResuscitation] = useState(false);
  const [suction, setSuction] = useState(false);
  const [jurongIsland, setJurongIsland] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const [patientWeight, setPatientWeight] = useState("");

  const [stFocused, setStFocused] = useState(false);
  const [ttFocused, setTtFocused] = useState(false);
  const [oxFocused, setOxFocused] = useState(false);
  const [wtFocused, setWtFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const canProceed = serviceType !== "" && transferType !== "";

  const selectBase = (focused: boolean): React.CSSProperties => ({
    width: "100%", height: 44, paddingLeft: 12, paddingRight: 32, borderRadius: 8,
    border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF",
    fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif",
    appearance: "none", cursor: "pointer", boxSizing: "border-box", transition: "border-color 0.15s",
  });

  const numBase = (focused: boolean): React.CSSProperties => ({
    width: "100%", height: 44, padding: "0 14px", borderRadius: 8,
    border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF",
    fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box", transition: "border-color 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        <WizardProgressBar currentStep={2} />

        {/* Section 1 */}
        <WizardCard title="Service Classification">
          <div style={{ paddingTop: 12 }}>
            {/* Service Type + Transfer Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={fieldLabelStyle} htmlFor="s2-stype">
                  Service Type <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <select id="s2-stype" value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                    onFocus={() => setStFocused(true)} onBlur={() => setStFocused(false)}
                    style={{ ...selectBase(stFocused), color: serviceType ? "#1E293B" : "#94A3B8" }}>
                    <option value="" disabled>Select service type…</option>
                    {["EAS", "MTS", "Event Standby", "Workplace Standby"].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                </div>
              </div>
              <div>
                <label style={fieldLabelStyle} htmlFor="s2-ttype">
                  Transfer Type <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <select id="s2-ttype" value={transferType} onChange={(e) => setTransferType(e.target.value)}
                    onFocus={() => setTtFocused(true)} onBlur={() => setTtFocused(false)}
                    style={{ ...selectBase(ttFocused), color: transferType ? "#1E293B" : "#94A3B8" }}>
                    <option value="" disabled>Select transfer type…</option>
                    {[
                      "One-Way Hospital Transfer",
                      "Two-Way Hospital Transfer",
                      "COVID-19 Case Transport",
                      "IMH/Psychiatric Transfer",
                      "Airport (No Tarmac)",
                      "Airport (With Tarmac)",
                      "SG-JB Ground Transfer",
                      "Air Evacuation",
                    ].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                </div>
              </div>
            </div>

            {/* Office hours toggle */}
            <div style={{ paddingTop: 4, borderTop: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 8px" }}>
                <div>
                  <p style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 3 }}>
                    Was this job during office hours?
                  </p>
                  <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
                    Office hours: Monday to Friday, 08:30–17:30.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: officeHours ? "#1E293B" : "#94A3B8", fontWeight: 500, fontFamily: "'Inter', sans-serif", minWidth: 24, textAlign: "right" }}>
                    {officeHours ? "YES" : "NO"}
                  </span>
                  <Toggle value={officeHours} onChange={setOfficeHours} />
                </div>
              </div>
            </div>
          </div>
        </WizardCard>

        {/* Section 2 */}
        <WizardCard title="Surcharges & Special Conditions">
          <div>
            {/* 2-col toggle grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              {/* Left column */}
              <div>
                <SurchargeRow label="Were stairs or elevator access required?" value={hasInconvenienceFee} onChange={setHasInconvenienceFee}>
                  <AmberChip>A flat $50 inconvenience fee will be applied.</AmberChip>
                </SurchargeRow>
                <SurchargeRow label="Disposables used?" value={disposablesUsed} onChange={setDisposablesUsed} />
                <SurchargeRow label="Suction performed?" value={suction} onChange={setSuction} />
              </div>

              {/* Right column */}
              <div>
                <SurchargeRow label="Oxygen used?" value={oxygenUsed} onChange={setOxygenUsed}>
                  <div>
                    <label style={{ ...fieldLabelStyle, fontSize: 13 }} htmlFor="s2-ox">Litres used</label>
                    <input id="s2-ox" type="number" min={0} value={oxygenLitres}
                      onChange={(e) => setOxygenLitres(Math.max(0, Number(e.target.value)))}
                      onFocus={() => setOxFocused(true)} onBlur={() => setOxFocused(false)}
                      style={{ ...numBase(oxFocused), height: 38, marginBottom: 6 }} />
                    <p style={helperTextStyle}>First 10L: $50 flat. Each additional litre: $1.</p>
                  </div>
                </SurchargeRow>
                <SurchargeRow label="Resuscitation performed?" value={resuscitation} onChange={setResuscitation}>
                  <AmberChip>$320 surcharge will be applied.</AmberChip>
                </SurchargeRow>
                <SurchargeRow label="Jurong Island job?" value={jurongIsland} onChange={setJurongIsland}>
                  <AmberChip>A Jurong Island access surcharge will be applied.</AmberChip>
                </SurchargeRow>
              </div>
            </div>

            {/* Full-width number fields */}
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 16, marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={fieldLabelStyle} htmlFor="s2-wait">Waiting Time (minutes)</label>
                <input id="s2-wait" type="number" min={0} value={waitingTime}
                  onChange={(e) => setWaitingTime(Math.max(0, Number(e.target.value)))}
                  onFocus={() => setWtFocused(true)} onBlur={() => setWtFocused(false)}
                  style={numBase(wtFocused)} />
                <p style={helperTextStyle}>Waiting time is charged per 30-minute block.</p>
              </div>
              <div>
                <label style={fieldLabelStyle} htmlFor="s2-weight">
                  Patient Weight (kg) <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
                </label>
                <input id="s2-weight" type="number" min={0} value={patientWeight}
                  onChange={(e) => setPatientWeight(e.target.value)}
                  onFocus={() => setPwFocused(true)} onBlur={() => setPwFocused(false)}
                  placeholder="e.g. 85"
                  style={{ ...numBase(pwFocused) }} />
                <p style={helperTextStyle}>Required if patient weight may exceed 90 kg. Used to determine heavy lifting surcharge.</p>
              </div>
            </div>
          </div>
        </WizardCard>
      </div>

      {/* Footer */}
      <div style={{ height: 64, borderTop: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32 }}>
        <button onClick={onBack}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.12s, color 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <button onClick={() => canProceed && onNext({ serviceType, transferType, officeHours, hasInconvenienceFee, oxygenUsed, oxygenLitres, disposablesUsed, resuscitation, suction, jurongIsland, waitingTime, patientWeight })}
          disabled={!canProceed}
          style={{ height: 40, padding: "0 20px", borderRadius: 8, background: canProceed ? "#1E293B" : "#CBD5E1", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: canProceed ? "pointer" : "not-allowed", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
          onMouseEnter={(e) => { if (canProceed) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
          onMouseLeave={(e) => { if (canProceed) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
          Next: Signature <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Wizard Step 3: Signature ────────────────────────────────────────────────

interface Step3Field {
  signerName: string;
  signerRole: string;
  hasSig: boolean;
  waiverReason: string;
}

function WizardStep3({ onBack, onNext }: {
  onBack: () => void;
  onNext: (fields: Step3Field) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");

  const [nameFocused, setNameFocused] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);
  const [waiverFocused, setWaiverFocused] = useState(false);

  const canProceed = signerName.trim() !== "" && (hasSig || (waiverOpen && waiverReason.trim() !== ""));

  // Canvas drawing helpers
  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
    setDrawing(true);
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#1E293B"; ctx.lineWidth = 2; ctx.lineCap = "round";
    const { x, y } = getPos(e);
    ctx.lineTo(x, y); ctx.stroke();
    if (!hasSig) setHasSig(true);
  }
  function endDraw() { setDrawing(false); }
  function clearSig() {
    const canvas = canvasRef.current!;
    canvasRef.current!.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  const inputBase = (focused: boolean): React.CSSProperties => ({
    width: "100%", height: 44, padding: "0 14px", borderRadius: 8,
    border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF",
    fontSize: 14, color: "#1E293B", outline: "none",
    fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        <WizardProgressBar currentStep={3} />

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "55% 45%", gap: 20, alignItems: "start" }}>

          {/* ── LEFT: Handover Signature ── */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Capture Handover Signature</h3>
              <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Ask the patient or client representative to sign in the box below.</p>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Canvas */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={220}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  style={{
                    width: "100%", height: 220, borderRadius: 8,
                    border: `2px dashed ${hasSig ? "#CBD5E1" : "#E2E8F0"}`,
                    cursor: "crosshair", display: "block",
                    background: "#FAFAFA", touchAction: "none",
                  }}
                />
                {!hasSig && (
                  <span style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: 16, color: "#CBD5E1", fontFamily: "'Inter', sans-serif",
                    pointerEvents: "none", userSelect: "none",
                  }}>
                    Sign here
                  </span>
                )}
              </div>

              {/* Clear button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                <button onClick={clearSig} disabled={!hasSig}
                  style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: hasSig ? "#64748B" : "#CBD5E1", fontSize: 12, fontWeight: 500, cursor: hasSig ? "pointer" : "default", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s" }}
                  onMouseEnter={(e) => { if (hasSig) (e.currentTarget as HTMLButtonElement).style.borderColor = "#94A3B8"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; }}>
                  Clear Signature
                </button>
              </div>

              {/* Signer name */}
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabelStyle} htmlFor="sig-name">
                  Signer's Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input id="sig-name" type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                  onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)}
                  placeholder="Full name of person signing"
                  style={inputBase(nameFocused)} />
              </div>

              {/* Signer role */}
              <div style={{ marginBottom: 20 }}>
                <label style={fieldLabelStyle} htmlFor="sig-role">
                  Signer's Role / Relationship <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
                </label>
                <input id="sig-role" type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)}
                  onFocus={() => setRoleFocused(true)} onBlur={() => setRoleFocused(false)}
                  placeholder="e.g. Patient, Hospital Coordinator, Family Member"
                  style={inputBase(roleFocused)} />
              </div>

              {/* Waiver section */}
              <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${waiverOpen ? "rgba(245,158,11,0.3)" : "#E2E8F0"}`, background: waiverOpen ? "#FFFBEB" : "#FAFAFA", transition: "background 0.2s, border-color 0.2s" }}>
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Patient unable to sign?</span>
                  <button onClick={() => setWaiverOpen((v) => !v)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}>
                    {waiverOpen ? "Cancel" : "Waive signature"}
                  </button>
                </div>

                {waiverOpen && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(245,158,11,0.2)" }}>
                    {/* Amber warning */}
                    <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: 14, marginTop: 12 }}>
                      <AlertTriangle size={15} color="#F59E0B" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: "#92400E", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                        Waiving signature is only permitted when the patient is medically unable to sign. This is recorded for compliance audit.
                      </p>
                    </div>
                    <label style={{ ...fieldLabelStyle, fontSize: 13 }} htmlFor="sig-waiver">
                      Reason for waiver <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <textarea id="sig-waiver" value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)}
                      onFocus={() => setWaiverFocused(true)} onBlur={() => setWaiverFocused(false)}
                      placeholder="e.g. Patient unconscious — ICU transfer, no conscious representative available."
                      rows={3}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${waiverFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Signature Preview ── */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", position: "sticky", top: 0 }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Preview</h3>
            </div>
            <div style={{ padding: "20px 24px" }}>
              {/* Preview box */}
              <div style={{ width: "100%", height: 180, borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, overflow: "hidden", position: "relative" }}>
                {hasSig ? (
                  <canvas
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    ref={(el) => {
                      if (!el || !canvasRef.current) return;
                      const ctx = el.getContext("2d")!;
                      el.width = el.offsetWidth * 2;
                      el.height = el.offsetHeight * 2;
                      ctx.scale(2, 2);
                      ctx.clearRect(0, 0, el.width, el.height);
                      ctx.drawImage(canvasRef.current, 0, 0, el.offsetWidth, el.offsetHeight);
                    }}
                  />
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </div>
                    <p style={{ fontSize: 13, color: "#CBD5E1", fontFamily: "'Inter', sans-serif" }}>Signature will appear here</p>
                  </div>
                )}
              </div>

              {/* Status badge */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                {hasSig || (waiverOpen && waiverReason.trim()) ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 6, background: "rgba(34,197,94,0.12)", color: "#22C55E", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                    <CheckCircle2 size={14} strokeWidth={2.5} /> Ready to submit
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 6, background: "#F1F5F9", color: "#94A3B8", fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                    Signature required
                  </span>
                )}
              </div>

              {/* Signer details recap */}
              {(signerName || signerRole) && (
                <div style={{ padding: "12px 14px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  {signerName && (
                    <div style={{ marginBottom: signerRole ? 6 : 0 }}>
                      <p style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>Signer</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{signerName}</p>
                    </div>
                  )}
                  {signerRole && (
                    <div>
                      <p style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>Role</p>
                      <p style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{signerRole}</p>
                    </div>
                  )}
                </div>
              )}

              {waiverOpen && waiverReason.trim() && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#FFFBEB", border: "1px solid rgba(245,158,11,0.3)" }}>
                  <p style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Waiver Reason</p>
                  <p style={{ fontSize: 12, color: "#92400E", fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>{waiverReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ height: 64, borderTop: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32 }}>
        <button onClick={onBack}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.12s, color 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>
        <button onClick={() => canProceed && onNext({ signerName, signerRole, hasSig, waiverReason })}
          disabled={!canProceed}
          style={{ height: 40, padding: "0 20px", borderRadius: 8, background: canProceed ? "#1E293B" : "#CBD5E1", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: canProceed ? "pointer" : "not-allowed", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
          onMouseEnter={(e) => { if (canProceed) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
          onMouseLeave={(e) => { if (canProceed) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
          Next: Stamp &amp; Submit <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Wizard Step 4: Stamp & Submit ───────────────────────────────────────────

function WizardStep4({ onBack, onSubmit }: {
  onBack: () => void;
  onSubmit: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stampFile, setStampFile] = useState<string | null>(null);
  const [stampLegible, setStampLegible] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Static mock summary values (from earlier steps)
  const summary = {
    booking: "BKG-2026-00008",
    date: "5 Jul 2026",
    time: "08:00–09:30",
    patient: "John Tan",
    destination: "SGH A&E",
    service: "EAS",
    transfer: "One-Way Hospital Transfer",
    officeHours: true,
    surcharges: ["Oxygen (12L)", "Inconvenience Fee", "Waiting Time (30 min)"],
    signerName: "Ahmad Rahman",
    hasSig: true,
  };

  const stampUploaded = stampFile !== null;
  const canSubmit = true; // all required fields from prior steps are complete

  function handleFileChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setStampFile(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }

  function handleSubmitClick() {
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); onSubmit(); }, 1000);
  }

  // Summary row component
  const SummaryRow = ({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) => (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8", fontFamily: "'Inter', sans-serif", minWidth: 100, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <div style={{ flex: 1, fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1.5, display: "flex", alignItems: "center", gap: 6 }}>
        {value}
        {ok === true && <CheckCircle2 size={14} color="#22C55E" strokeWidth={2.5} style={{ flexShrink: 0 }} />}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        <WizardProgressBar currentStep={4} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

          {/* ── LEFT: Hospital Stamp ── */}
          <WizardCard title="Hospital Stamp (Optional)">
            <div style={{ paddingTop: 8 }}>
              <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, marginBottom: 18 }}>
                Some hospitals require a stamp on the service record. Upload a photo or scan of the stamped document if applicable.
              </p>

              {!stampFile ? (
                /* Upload zone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    width: "100%", height: 160, borderRadius: 8,
                    border: `2px dashed ${dragOver ? "#3B82F6" : "#E2E8F0"}`,
                    background: dragOver ? "#EFF6FF" : "#FAFAFA",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 10, cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                    boxSizing: "border-box",
                  }}
                  onMouseEnter={(e) => { if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = "#94A3B8"; }}
                  onMouseLeave={(e) => { if (!dragOver) (e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0"; }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Click to upload or drag and drop</p>
                    <p style={{ fontSize: 12, color: "#CBD5E1", fontFamily: "'Inter', sans-serif" }}>PNG, JPG or PDF · Maximum 10 MB</p>
                  </div>
                </div>
              ) : (
                /* Uploaded state */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img src={stampFile} alt="Stamp preview" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #E2E8F0", display: "block" }} />
                      <button onClick={() => { setStampFile(null); setStampLegible(false); }}
                        style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "#EF4444", border: "2px solid #FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, lineHeight: 0 }}>
                        <X size={11} color="#FFFFFF" strokeWidth={3} />
                      </button>
                    </div>
                    <div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#22C55E", fontWeight: 500, fontFamily: "'Inter', sans-serif", background: "rgba(34,197,94,0.10)", padding: "3px 10px", borderRadius: 6 }}>
                        <CheckCircle2 size={12} strokeWidth={2.5} /> Uploaded
                      </span>
                      <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6, fontFamily: "'Inter', sans-serif" }}>Click × to remove and re-upload.</p>
                    </div>
                  </div>

                  {/* Legibility toggle */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Is the stamp clearly legible?</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: stampLegible ? "#1E293B" : "#94A3B8", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{stampLegible ? "YES" : "NO"}</span>
                      <Toggle value={stampLegible} onChange={setStampLegible} />
                    </div>
                  </div>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: "none" }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
            </div>
          </WizardCard>

          {/* ── RIGHT: Memo Summary ── */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", position: "sticky", top: 0 }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Review Before Submitting</h3>
            </div>
            <div style={{ padding: "4px 24px 20px" }}>
              <SummaryRow label="Booking" value={<><span style={{ fontWeight: 500 }}>{summary.booking}</span> · {summary.date}, {summary.time}</>} />
              <SummaryRow label="Patient" value={<>{summary.patient} → <span style={{ color: "#3B82F6" }}>{summary.destination}</span></>} />
              <SummaryRow label="Service" value={`${summary.service} · ${summary.transfer} · ${summary.officeHours ? "Office Hours" : "After Hours"}`} />
              <SummaryRow label="Surcharges" value={
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {summary.surcharges.map((s) => (
                    <span key={s} style={{ fontSize: 12, background: "#F1F5F9", color: "#64748B", padding: "2px 8px", borderRadius: 4, fontFamily: "'Inter', sans-serif" }}>{s}</span>
                  ))}
                </div>
              } />
              <SummaryRow
                label="Signature"
                ok={summary.hasSig}
                value={
                  <span>
                    <span style={{ color: "#22C55E", fontWeight: 500 }}>Captured</span>
                    <span style={{ color: "#64748B" }}> · Signer: {summary.signerName}</span>
                  </span>
                }
              />
              <SummaryRow
                label="Stamp"
                ok={stampUploaded || undefined}
                value={
                  stampUploaded
                    ? <span style={{ color: "#22C55E", fontWeight: 500 }}>Uploaded</span>
                    : <span style={{ color: "#94A3B8" }}>Not uploaded</span>
                }
              />

              {/* Completeness indicator */}
              <div style={{ marginTop: 16 }}>
                {canSubmit ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                    <CheckCircle2 size={15} color="#22C55E" strokeWidth={2.5} />
                    <span style={{ fontSize: 13, color: "#15803D", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>All required fields complete. Ready to submit.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    <AlertTriangle size={15} color="#EF4444" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Incomplete fields:</p>
                      <p style={{ fontSize: 12, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>Signature required</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{ height: 64, borderTop: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32 }}>
        <button onClick={onBack}
          style={{ height: 44, padding: "0 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.12s, color 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}>
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>

        {/* Submit button with tooltip */}
        <div style={{ position: "relative" }}
          onMouseEnter={() => { if (!canSubmit) setShowTooltip(true); }}
          onMouseLeave={() => setShowTooltip(false)}>
          {showTooltip && !canSubmit && (
            <div style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: 220, padding: "8px 12px", borderRadius: 8, background: "#1E293B", color: "#FFFFFF", fontSize: 12, fontFamily: "'Inter', sans-serif", lineHeight: 1.5, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.18)", whiteSpace: "normal" }}>
              Complete all required fields before submitting.
              <div style={{ position: "absolute", top: "100%", right: 20, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #1E293B" }} />
            </div>
          )}
          <button onClick={handleSubmitClick} disabled={!canSubmit || submitting}
            style={{ width: 160, height: 44, borderRadius: 8, background: !canSubmit ? "#CBD5E1" : submitting ? "#334155" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: !canSubmit || submitting ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s" }}
            onMouseEnter={(e) => { if (canSubmit && !submitting) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
            onMouseLeave={(e) => { if (canSubmit && !submitting) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
            {submitting
              ? <><svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Submitting…</>
              : "Submit Memo"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Memo Submitted Screen (Step 6) ──────────────────────────────────────────

function MemoSubmittedScreen({ onBackToJobs, onViewMemos }: {
  onBackToJobs: () => void;
  onViewMemos: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "48px 40px", maxWidth: 560, width: "100%", textAlign: "center" }}>

        {/* Check circle */}
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle2 size={32} color="#FFFFFF" strokeWidth={2.5} />
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Memo Submitted!</h2>
        <p style={{ fontSize: 16, color: "#64748B", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>Reference: MEMO-2026-00006</p>
        <p style={{ fontSize: 14, color: "#64748B", marginBottom: 24, fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
          The AR team has been notified and will review your memo shortly.
        </p>

        {/* Divider */}
        <div style={{ height: 1, background: "#E2E8F0", marginBottom: 24 }} />

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={onBackToJobs}
            style={{ width: "100%", height: 44, borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E293B")}>
            Back to My Jobs
          </button>
          <button onClick={onViewMemos}
            style={{ width: "100%", height: 44, borderRadius: 8, background: "#FFFFFF", color: "#1E293B", border: "1px solid #E2E8F0", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s, background 0.12s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"; }}>
            View My Memos
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Memo History Screen (Step 7) ────────────────────────────────────────────

type MemoStatus = "Submitted" | "Reviewed" | "Returned";
type MemoStatusFilter = "All" | MemoStatus;

interface MemoRecord {
  id: string;
  bookingRef: string;
  client: string;
  serviceType: string;
  jobDate: string;
  submittedAt: string;
  status: MemoStatus;
  returnNote?: string;
}

const MEMOS: MemoRecord[] = [
  { id: "MEMO-2026-00006", bookingRef: "BKG-2026-00008", client: "CGH", serviceType: "EAS", jobDate: "5 Jul 2026", submittedAt: "5 Jul 2026, 09:45", status: "Submitted" },
  { id: "MEMO-2026-00004", bookingRef: "BKG-2026-00004", client: "TTSH", serviceType: "MTS", jobDate: "14 Jun 2026", submittedAt: "14 Jun 2026, 09:31", status: "Reviewed" },
  { id: "MEMO-2026-00002", bookingRef: "BKG-2026-00002", client: "TTSH", serviceType: "EAS", jobDate: "11 Jun 2026", submittedAt: "11 Jun 2026, 10:15", status: "Returned",
    returnNote: "Oxygen litres field left blank — please resubmit with the correct O₂ volume used during transfer. Contact AR team if unsure." },
];

const MEMO_STATUS_STYLE: Record<MemoStatus, { bg: string; color: string }> = {
  Submitted: { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
  Reviewed:  { bg: "rgba(34,197,94,0.12)",   color: "#22C55E" },
  Returned:  { bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
};

function MemoExpandedRow({ memo }: { memo: MemoRecord }) {
  return (
    <tr>
      <td colSpan={8} style={{ padding: 0, background: memo.status === "Returned" ? "#FEF9F9" : "#F8FAFC" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0" }}>

          {/* Correction Required banner */}
          {memo.status === "Returned" && memo.returnNote && (
            <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.30)", marginBottom: 20 }}>
              <AlertTriangle size={16} color="#F59E0B" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E", fontFamily: "'Inter', sans-serif", marginBottom: 3 }}>Correction Required</p>
                <p style={{ fontSize: 13, color: "#78350F", fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>{memo.returnNote}</p>
              </div>
            </div>
          )}

          {/* Three-column summary grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 32px" }}>
            {/* Job Info */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>Job Info</p>
              {[
                ["Booking Ref", memo.bookingRef],
                ["Client", memo.client],
                ["Service Type", memo.serviceType],
                ["Job Date", memo.jobDate],
                ["Start Time", "08:00"],
                ["End Time", "09:30"],
                ["Patient Name", "John Tan"],
                ["Patient NRIC", "S7XXXXXX A"],
                ["Pickup", "CGH, 2 Simei St 3"],
                ["Destination", "SGH A&E"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", minWidth: 96, flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Charges */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>Service &amp; Charges</p>
              {[
                ["Transfer Type", "One-Way Hospital"],
                ["Office Hours", "Yes"],
                ["Oxygen Used", "Yes — 12L"],
                ["Inconvenience", "Yes"],
                ["Waiting Time", "30 min"],
                ["Resuscitation", "No"],
                ["Suction", "No"],
                ["Jurong Island", "No"],
                ["Patient Weight", "72 kg"],
                ["Overtime Hrs", "0"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", minWidth: 96, flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Signature + Stamp */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontFamily: "'Inter', sans-serif" }}>Signature &amp; Stamp</p>
              <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>Handover Signature</p>
              <div style={{ width: "100%", height: 72, borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "#CBD5E1", fontFamily: "'Inter', sans-serif" }}>Signature captured</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>Signer: </span>
                <span style={{ fontSize: 12, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Ahmad Rahman · Patient</span>
              </div>
              <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 6, marginTop: 12, fontFamily: "'Inter', sans-serif" }}>Hospital Stamp</p>
              <div style={{ width: "100%", height: 60, borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: "#CBD5E1", fontFamily: "'Inter', sans-serif" }}>Not uploaded</span>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function MemoHistoryScreen() {
  const [statusFilter, setStatusFilter] = useState<MemoStatusFilter>("All");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFromFocused, setDateFromFocused] = useState(false);
  const [dateToFocused, setDateToFocused] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = MEMOS.filter((m) => {
    if (statusFilter !== "All" && m.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (q && !m.id.toLowerCase().includes(q) && !m.client.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
          {(["All", "Submitted", "Reviewed", "Returned"] as MemoStatusFilter[]).map((tab) => (
            <button key={tab} onClick={() => setStatusFilter(tab)}
              style={{ padding: "6px 12px", borderRadius: 6, border: statusFilter === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: statusFilter === tab ? "#FFFFFF" : "transparent", color: statusFilter === tab ? "#1E293B" : "#64748B", fontSize: 13, fontWeight: statusFilter === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.12s", whiteSpace: "nowrap" }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <Calendar size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              onFocus={() => setDateFromFocused(true)} onBlur={() => setDateFromFocused(false)}
              style={{ height: 38, paddingLeft: 30, paddingRight: 10, borderRadius: 8, border: `1px solid ${dateFromFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: dateFrom ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 140, boxSizing: "border-box" }} />
          </div>
          <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>to</span>
          <div style={{ position: "relative" }}>
            <Calendar size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              onFocus={() => setDateToFocused(true)} onBlur={() => setDateToFocused(false)}
              style={{ height: 38, paddingLeft: 30, paddingRight: 10, borderRadius: 8, border: `1px solid ${dateToFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: dateTo ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 140, boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by memo ID or client…"
            style={{ width: "100%", height: 38, paddingLeft: 34, paddingRight: 14, borderRadius: 8, border: `1px solid ${searchFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Memo ID", "Booking Ref", "Client", "Service Type", "Job Date", "Submitted At", "Status", "Action"].map((col) => (
                  <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No memos match the current filters.</td></tr>
              ) : filtered.map((memo, i) => {
                const isExpanded = expandedId === memo.id;
                const isReturned = memo.status === "Returned";
                const baseBg = isReturned ? "#FEF2F2" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                const hoverBg = isReturned ? "#FEE2E2" : "#F1F5F9";
                const { bg, color } = MEMO_STATUS_STYLE[memo.status];
                return (
                  <React.Fragment key={memo.id}>
                    <tr
                      style={{ borderBottom: isExpanded ? "none" : "1px solid #E2E8F0", background: isExpanded ? "#F8FAFC" : baseBg, height: 48 }}
                      onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = hoverBg; }}
                      onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = isExpanded ? "#F8FAFC" : baseBg; }}>
                      <td style={memoTd}><span style={{ fontSize: 13, fontWeight: 500, color: "#1E293B", letterSpacing: "0.02em", fontFamily: "'Inter', sans-serif" }}>{memo.id}</span></td>
                      <td style={memoTd}><span style={memoCell}>{memo.bookingRef}</span></td>
                      <td style={memoTd}><span style={memoCell}>{memo.client}</span></td>
                      <td style={memoTd}><span style={memoCell}>{memo.serviceType}</span></td>
                      <td style={memoTd}><span style={memoCell}>{memo.jobDate}</span></td>
                      <td style={memoTd}><span style={memoCell}>{memo.submittedAt}</span></td>
                      <td style={memoTd}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, background: bg, color, fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                          {memo.status === "Returned" && <AlertTriangle size={11} strokeWidth={2.5} />}
                          {memo.status === "Reviewed" && <CheckCircle2 size={11} strokeWidth={2.5} />}
                          {memo.status}
                        </span>
                      </td>
                      <td style={memoTd}>
                        <button onClick={() => setExpandedId(isExpanded ? null : memo.id)}
                          style={{ height: 32, padding: "0 14px", borderRadius: 6, background: isExpanded ? "#F1F5F9" : "#1E293B", color: isExpanded ? "#1E293B" : "#FFFFFF", border: isExpanded ? "1px solid #E2E8F0" : "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.12s", display: "flex", alignItems: "center", gap: 5 }}>
                          {isExpanded ? "Close" : "View"}
                          <ChevronDown size={13} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && <MemoExpandedRow memo={memo} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Showing 1–{filtered.length} of {filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button disabled style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", opacity: 0.4 }}><ChevronLeft size={14} color="#64748B" /></button>
            <button style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #1E293B", background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>1</span></button>
            <button disabled style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", opacity: 0.4 }}><ChevronRight size={14} color="#64748B" /></button>
          </div>
        </div>
      </div>
    </>
  );
}

const memoTd: React.CSSProperties = { padding: "0 16px", verticalAlign: "middle", whiteSpace: "nowrap" };
const memoCell: React.CSSProperties = { fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" };

// ─── Field App Shell ──────────────────────────────────────────────────────────

export function FieldApp({ onLogout }: { onLogout: () => void }) {
  const [activePage, setActivePage] = useState<FieldPage>("jobs");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardBookingRef, setWizardBookingRef] = useState("BKG-2026-00008");
  const [wizardSubmitted, setWizardSubmitted] = useState(false);
  const [, setWizardData] = useState<Partial<WizardField & Step2Field & Step3Field>>({});

  const openWizard = (ref: string) => {
    setWizardBookingRef(ref);
    setWizardStep(1);
    setWizardData({});
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardSubmitted(false);
    setWizardStep(1);
  };

  const headerTitle = wizardOpen && wizardSubmitted
    ? "Memo Submitted"
    : wizardOpen
    ? `Create Memo — ${wizardBookingRef}`
    : activePage === "jobs" ? "My Jobs"
    : activePage === "memos" ? "My Memos"
    : "Profile";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter', sans-serif", background: "#F8FAFC" }}>
      <FieldSidebar activePage={wizardOpen ? "jobs" : activePage} onNav={(p) => { closeWizard(); setActivePage(p); }} onLogout={onLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 64, background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {wizardOpen && (
              <button onClick={closeWizard}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
                <ArrowLeft size={16} /> My Jobs
              </button>
            )}
            {wizardOpen && <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>}
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>{headerTitle}</h1>
          </div>
          <div style={{ position: "relative", lineHeight: 0 }}>
            <Bell size={20} color="#64748B" style={{ cursor: "pointer" }} />
            <span style={{ position: "absolute", top: -5, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#EF4444", color: "#FFFFFF", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>1</span>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: wizardOpen ? "hidden" : "auto", padding: 32, display: "flex", flexDirection: "column" }}>
          {wizardOpen ? (
            <>
              {wizardStep === 1 && (
                <WizardStep1
                  bookingRef={wizardBookingRef}
                  onNext={(fields) => { setWizardData(fields); setWizardStep(2); }}
                  onCancel={closeWizard}
                />
              )}
              {wizardStep === 2 && (
                <WizardStep2
                  onBack={() => setWizardStep(1)}
                  onNext={(fields) => { setWizardData((p) => ({ ...p, ...fields })); setWizardStep(3); }}
                />
              )}
              {wizardStep === 3 && (
                <WizardStep3
                  onBack={() => setWizardStep(2)}
                  onNext={(fields) => { setWizardData((p) => ({ ...p, ...fields })); setWizardStep(4); }}
                />
              )}
              {wizardStep === 4 && !wizardSubmitted && (
                <WizardStep4
                  onBack={() => setWizardStep(3)}
                  onSubmit={() => setWizardSubmitted(true)}
                />
              )}
              {wizardStep === 4 && wizardSubmitted && (
                <MemoSubmittedScreen
                  onBackToJobs={closeWizard}
                  onViewMemos={() => { closeWizard(); setActivePage("memos"); }}
                />
              )}
            </>
          ) : (
            <>
              {activePage === "jobs" && (
                <MyJobsScreen
                  onStartJob={(ref) => openWizard(ref)}
                  onCompleteMemo={(ref) => openWizard(ref)}
                />
              )}
              {activePage === "memos" && <MemoHistoryScreen />}
              {activePage === "profile" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", color: "#94A3B8", fontSize: 14 }}>Profile — coming soon</div>
              )}
            </>
          )}
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        input[type="number"]::-webkit-inner-spin-button { opacity: 0.5; }
        input[type="time"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        textarea::placeholder, input::placeholder { color: #94A3B8; }
      `}</style>
    </div>
  );
}
