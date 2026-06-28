import React, { useState, useRef } from "react";
import {
  Bell,
  ClipboardList,
  BookOpen,
  Settings,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  Calendar,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntakeStatusFilter = "All" | "Pending" | "Confirmed" | "Rejected";
export type BookingStatusFilter = "All" | "Confirmed" | "In Progress" | "Completed" | "Invoiced";
export type View = "queue" | "detail" | "booking-list" | "booking-detail" | "booking-created";

export interface Intake {
  ref: string;
  name: string;
  org: string;
  serviceType: string;
  tier: string;
  date: string;
  queueMinutes: number;
  status: "Pending" | "Confirmed" | "Rejected";
}

export interface Booking {
  ref: string;
  client: string;
  serviceType: string;
  tier: string;
  scheduledDate: string;
  crew: string;
  status: "Confirmed" | "In Progress" | "Completed" | "Invoiced";
  memo: "—" | "Missing" | "Submitted";
  riskRow?: boolean;
}

export interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

// ─── Static data ─────────────────────────────────────────────────────────────

export const INTAKES: Intake[] = [
  { ref: "EFAR-2026-00007", name: "John Tan", org: "Changi General Hospital", serviceType: "EAS", tier: "Advanced", date: "5 Jul 2026", queueMinutes: 72, status: "Pending" },
  { ref: "EFAR-2026-00006", name: "Mary Lim", org: "—", serviceType: "MTS", tier: "Basic", date: "4 Jul 2026", queueMinutes: 220, status: "Pending" },
  { ref: "EFAR-2026-00005", name: "David Ng", org: "Mount Elizabeth Hospital", serviceType: "Event Medical Standby", tier: "Basic", date: "3 Jul 2026", queueMinutes: 18, status: "Confirmed" },
  { ref: "EFAR-2026-00004", name: "Priya Nair", org: "NUH", serviceType: "MTS", tier: "Critical", date: "3 Jul 2026", queueMinutes: 55, status: "Confirmed" },
  { ref: "EFAR-2026-00003", name: "Kevin Chia", org: "Workplace Safety Pte Ltd", serviceType: "Workplace Medical Standby", tier: "Basic", date: "2 Jul 2026", queueMinutes: 310, status: "Rejected" },
];

export const BOOKINGS: Booking[] = [
  { ref: "BKG-2026-00008", client: "Changi General Hospital",  serviceType: "EAS", tier: "Critical",  scheduledDate: "5 Jul 2026",  crew: "Ravi Kumar", status: "Confirmed",   memo: "—"         },
  { ref: "BKG-2026-00007", client: "National University Hospital", serviceType: "MTS", tier: "Basic", scheduledDate: "3 Jul 2026",  crew: "Ahmad Faris", status: "In Progress", memo: "—"         },
  { ref: "BKG-2026-00006", client: "Parkway Shenton",          serviceType: "Event Medical Standby", tier: "Basic", scheduledDate: "2 Jul 2026",  crew: "Siti Rahimah", status: "Confirmed",   memo: "—"         },
  { ref: "BKG-2026-00005", client: "Raffles Medical Group",    serviceType: "MTS", tier: "Advanced", scheduledDate: "1 Jul 2026",  crew: "Jason Teo",   status: "In Progress", memo: "—"         },
  { ref: "BKG-2026-00004", client: "Tan Tock Seng Hospital",   serviceType: "MTS", tier: "Basic",    scheduledDate: "14 Jun 2026", crew: "—",           status: "Completed",   memo: "Missing", riskRow: true },
  { ref: "BKG-2026-00003", client: "TTSH",                     serviceType: "EAS", tier: "Advanced", scheduledDate: "13 Jun 2026", crew: "Ahmad",       status: "Invoiced",    memo: "Submitted"  },
  { ref: "BKG-2026-00002", client: "Singapore General Hospital", serviceType: "EAS", tier: "Critical", scheduledDate: "10 Jun 2026", crew: "Ravi Kumar", status: "Invoiced",   memo: "Submitted"  },
  { ref: "BKG-2026-00001", client: "KK Women's & Children's Hospital", serviceType: "MTS", tier: "Basic", scheduledDate: "8 Jun 2026", crew: "Siti Rahimah", status: "Invoiced", memo: "Submitted" },
  { ref: "BKG-2026-00009", client: "Mount Alvernia Hospital",  serviceType: "Workplace Medical Standby", tier: "Basic", scheduledDate: "20 Jun 2026", crew: "Jason Teo", status: "Completed", memo: "Missing", riskRow: true },
  { ref: "BKG-2026-00010", client: "Gleneagles Hospital",      serviceType: "EAS", tier: "Advanced", scheduledDate: "18 Jun 2026", crew: "Ravi Kumar", status: "Completed",   memo: "Submitted"  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatQueue(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}
export function queueColor(m: number) {
  if (m > 240) return "#EF4444";
  if (m > 120) return "#F59E0B";
  return "#64748B";
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ width: 320, padding: "14px 16px", borderRadius: 8, background: "#1E293B", border: `1px solid ${t.type === "success" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`, boxShadow: "0 4px 16px rgba(0,0,0,0.22)", display: "flex", alignItems: "flex-start", gap: 10, pointerEvents: "all", animation: "slideUp 0.2s ease", fontFamily: "'Inter', sans-serif" }}>
          {t.type === "success" ? <CheckCircle2 size={16} color="#22C55E" style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />}
          <span style={{ fontSize: 13, color: "#FFFFFF", flex: 1, lineHeight: 1.5 }}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", lineHeight: 0, padding: 0, flexShrink: 0 }}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const add = (type: Toast["type"], message: string) => {
    const id = ++counter.current;
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  };
  const dismiss = (id: number) => setToasts((p) => p.filter((t) => t.id !== id));
  return { toasts, add, dismiss };
}

// ─── Shared badges ────────────────────────────────────────────────────────────

export function IntakeStatusBadge({ status }: { status: Intake["status"] }) {
  const map = { Pending: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" }, Confirmed: { bg: "rgba(34,197,94,0.12)", color: "#22C55E" }, Rejected: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" } };
  const { bg, color } = map[status];
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6, background: bg, color, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{status}</span>;
}

export function BookingStatusBadge({ status }: { status: Booking["status"] }) {
  const map: Record<string, { bg: string; color: string }> = {
    "Confirmed":   { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
    "In Progress": { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
    "Completed":   { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
    "Invoiced":    { bg: "rgba(34,197,94,0.12)",   color: "#22C55E" },
  };
  const { bg, color } = map[status] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, background: bg, color, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>
      {status === "Completed" && <AlertTriangle size={11} strokeWidth={2.5} />}
      {status}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { bg: string; color: string }> = { Basic: { bg: "rgba(59,130,246,0.10)", color: "#3B82F6" }, Advanced: { bg: "rgba(245,158,11,0.10)", color: "#F59E0B" }, Critical: { bg: "rgba(239,68,68,0.10)", color: "#EF4444" } };
  const { bg, color } = map[tier] ?? { bg: "#F1F5F9", color: "#64748B" };
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6, background: bg, color, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{tier}</span>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

export function StatCard({ label, value, color, warning, leftBorder }: { label: string; value: string; color: string; warning?: boolean; leftBorder?: string }) {
  return (
    <div style={{ flex: 1, background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", borderLeft: leftBorder ? `3px solid ${leftBorder}` : "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
        {warning && <AlertTriangle size={16} color={color} strokeWidth={2.5} style={{ marginTop: 2 }} />}
      </div>
      <span style={{ fontSize: 12, color: "#64748B", marginTop: 6, fontWeight: 500, letterSpacing: "0.02em", fontFamily: "'Inter', sans-serif" }}>{label}</span>
    </div>
  );
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────

export function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", border: "none", borderLeft: active ? "3px solid #FFFFFF" : "3px solid transparent", background: active ? "rgba(255,255,255,0.15)" : hov ? "rgba(255,255,255,0.07)" : "transparent", color: active ? "#FFFFFF" : "rgba(255,255,255,0.70)", fontSize: 14, fontWeight: active ? 500 : 400, cursor: "pointer", textAlign: "left", transition: "background 0.12s, color 0.12s", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}>
      <span style={{ lineHeight: 0, flexShrink: 0 }}>{icon}</span>{label}
    </button>
  );
}

// ─── Sidebar shell ────────────────────────────────────────────────────────────

export function Sidebar({ activePage, onNav, onLogout }: { activePage: string; onNav: (p: "queue" | "bookings" | "settings") => void; onLogout: () => void }) {
  return (
    <aside style={{ width: 240, flexShrink: 0, background: "#1E293B", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>EFAR</span>
      </div>
      <nav style={{ flex: 1, paddingTop: 12 }}>
        <SidebarItem icon={<ClipboardList size={16} />} label="Intake Queue" active={activePage === "queue"} onClick={() => onNav("queue")} />
        <SidebarItem icon={<BookOpen size={16} />} label="Bookings" active={activePage === "bookings"} onClick={() => onNav("bookings")} />
        <SidebarItem icon={<Settings size={16} />} label="Settings" active={activePage === "settings"} onClick={() => onNav("settings")} />
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
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#0F172A", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#FFFFFF", flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>CW</div>
        <div style={{ overflow: "hidden" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Camilla Wong</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Quotations Specialist</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

export function FieldRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: last ? "none" : "1px solid #E2E8F0" }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>{label}</p>
      <div style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

export function FormLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return <label htmlFor={htmlFor} style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#1E293B", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>{children}</label>;
}

export function StyledSelect({ id, value, onChange, options, required }: { id: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} required={required}
        style={{ width: "100%", height: 40, paddingLeft: 12, paddingRight: 32, borderRadius: 8, border: `1px solid ${f ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer", boxSizing: "border-box" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
    </div>
  );
}

export function StyledDate({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [f, setF] = useState(false);
  return <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
    style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: `1px solid ${f ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: value ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />;
}

export function StyledTime({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [f, setF] = useState(false);
  const times: string[] = [];
  for (let h = 8; h <= 22; h++) { times.push(`${String(h).padStart(2, "0")}:00`); if (h < 22) times.push(`${String(h).padStart(2, "0")}:30`); }
  return (
    <div style={{ position: "relative" }}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{ width: "100%", height: 40, paddingLeft: 12, paddingRight: 32, borderRadius: 8, border: `1px solid ${f ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer", boxSizing: "border-box" }}>
        {times.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
    </div>
  );
}

export function StyledTextarea({ id, value, onChange, placeholder, required, rows = 3 }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; rows?: number }) {
  const [f, setF] = useState(false);
  return <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} placeholder={placeholder} required={required} rows={rows}
    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${f ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />;
}

// ─── Shared table styles ──────────────────────────────────────────────────────

export const tdStyle: React.CSSProperties = { padding: "0 16px", verticalAlign: "middle", whiteSpace: "nowrap" };
export const cellText: React.CSSProperties = { fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" };

// ─── Booking List Screen ──────────────────────────────────────────────────────

export function BookingList({ onView }: { onView: (ref: string) => void }) {
  const [statusTab, setStatusTab] = useState<BookingStatusFilter>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [dateFromFocused, setDateFromFocused] = useState(false);
  const [dateToFocused, setDateToFocused] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = BOOKINGS.filter((b) => {
    if (statusTab !== "All" && b.status !== statusTab) return false;
    if (serviceFilter && b.serviceType !== serviceFilter) return false;
    const q = search.toLowerCase();
    if (q && !b.ref.toLowerCase().includes(q) && !b.client.toLowerCase().includes(q) && !b.crew.toLowerCase().includes(q)) return false;
    return true;
  });

  const totalPages = Math.ceil(25 / PER_PAGE); // simulate 25 total
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = { Confirmed: 8, "In Progress": 2, Completed: 3, Invoiced: 12 };

  return (
    <>
      {/* Stat cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard label="Confirmed"                   value={String(counts.Confirmed)}   color="#3B82F6" />
        <StatCard label="In Progress"                 value={String(counts["In Progress"])} color="#F59E0B" />
        <StatCard label="Completed (Memo Pending)"    value={String(counts.Completed)}   color="#EF4444" warning leftBorder="#EF4444" />
        <StatCard label="Invoiced"                    value={String(counts.Invoiced)}    color="#22C55E" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
          {(["All", "Confirmed", "In Progress", "Completed", "Invoiced"] as BookingStatusFilter[]).map((tab) => (
            <button key={tab} onClick={() => { setStatusTab(tab); setPage(1); }}
              style={{ padding: "6px 12px", borderRadius: 6, border: statusTab === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: statusTab === tab ? "#FFFFFF" : "transparent", color: statusTab === tab ? "#1E293B" : "#64748B", fontSize: 13, fontWeight: statusTab === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "all 0.12s" }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <Calendar size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} onFocus={() => setDateFromFocused(true)} onBlur={() => setDateFromFocused(false)} placeholder="From"
              style={{ height: 38, paddingLeft: 30, paddingRight: 10, borderRadius: 8, border: `1px solid ${dateFromFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: dateFrom ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 140, boxSizing: "border-box" }} />
          </div>
          <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>to</span>
          <div style={{ position: "relative" }}>
            <Calendar size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} onFocus={() => setDateToFocused(true)} onBlur={() => setDateToFocused(false)} placeholder="To"
              style={{ height: 38, paddingLeft: 30, paddingRight: 10, borderRadius: 8, border: `1px solid ${dateToFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: dateTo ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 140, boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Service type */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select value={serviceFilter} onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
            style={{ height: 38, paddingLeft: 12, paddingRight: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: serviceFilter ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" }}>
            <option value="">Service Type</option>
            <option>EAS</option><option>MTS</option><option>Event Medical Standby</option><option>Workplace Medical Standby</option>
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by reference, client, or crew name…"
            style={{ width: "100%", height: 38, paddingLeft: 34, paddingRight: 14, borderRadius: 8, border: `1px solid ${searchFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Booking Ref", "Client", "Service Type", "Tier", "Scheduled Date", "Assigned Crew", "Status", "Memo", "Action"].map((col) => (
                  <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No bookings match the current filters.</td></tr>
              ) : pageRows.map((row, i) => {
                const baseRowBg = row.riskRow ? "#FEF2F2" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                const hoverBg = row.riskRow ? "#FEE2E2" : "#F1F5F9";
                return (
                  <tr key={row.ref}
                    style={{ borderBottom: i < pageRows.length - 1 ? "1px solid #E2E8F0" : "none", background: baseRowBg, height: 48 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = hoverBg)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = baseRowBg)}
                  >
                    <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 500, color: "#1E293B", letterSpacing: "0.02em", fontFamily: "'Inter', sans-serif" }}>{row.ref}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 200 }}><span style={{ ...cellText, overflow: "hidden", textOverflow: "ellipsis", display: "block", whiteSpace: "nowrap" }}>{row.client}</span></td>
                    <td style={tdStyle}><span style={cellText}>{row.serviceType}</span></td>
                    <td style={tdStyle}><TierBadge tier={row.tier} /></td>
                    <td style={tdStyle}><span style={cellText}>{row.scheduledDate}</span></td>
                    <td style={tdStyle}><span style={{ ...cellText, color: row.crew === "—" ? "#94A3B8" : "#1E293B" }}>{row.crew}</span></td>
                    <td style={tdStyle}><BookingStatusBadge status={row.status} /></td>
                    <td style={tdStyle}>
                      {row.memo === "Missing" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>
                          <AlertTriangle size={13} strokeWidth={2.5} /> Missing
                        </span>
                      ) : row.memo === "Submitted" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "#22C55E", fontFamily: "'Inter', sans-serif" }}>
                          <CheckCircle2 size={13} /> Submitted
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => onView(row.ref)}
                        style={{ height: 32, padding: "0 14px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "background 0.12s" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E293B")}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, 25)} of 25 results
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>
              <ChevronLeft size={14} color="#64748B" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                style={{ width: 30, height: 30, borderRadius: 6, border: page === p ? "1px solid #1E293B" : "1px solid #E2E8F0", background: page === p ? "#1E293B" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ fontSize: 12, color: page === p ? "#FFFFFF" : "#64748B", fontFamily: "'Inter', sans-serif" }}>{p}</span>
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}>
              <ChevronRight size={14} color="#64748B" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Booking Detail (Step 6) ──────────────────────────────────────────────────

const TIMELINE_STEPS: Array<{ label: Booking["status"]; ts: string | null }> = [
  { label: "Confirmed",   ts: "22 Jun 2026, 11:00 AM" },
  { label: "In Progress", ts: null },
  { label: "Completed",   ts: null },
  { label: "Invoiced",    ts: null },
];

export const STATUS_ORDER: Booking["status"][] = ["Confirmed", "In Progress", "Completed", "Invoiced"];

export const CREW_OPTIONS = ["Ravi Kumar", "Ahmad Salleh", "Wei Jian"];

export function BookingDetail({ bookingRef, onBack, onViewIntake }: {
  bookingRef: string;
  onBack: () => void;
  onViewIntake?: (ref: string) => void;
}) {
  const booking = BOOKINGS.find((b) => b.ref === bookingRef);
  const [assignedCrew, setAssignedCrew] = useState(
    booking?.crew && booking.crew !== "—" ? booking.crew : ""
  );
  const [crewDraft, setCrewDraft] = useState("");
  const [savingCrew, setSavingCrew] = useState(false);
  const [crewSaved, setCrewSaved] = useState(!!assignedCrew);
  const [reassigning, setReassigning] = useState(false);

  if (!booking) return (
    <div>
      <button onClick={onBack} style={backBtnStyle} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
        <ArrowLeft size={15} /> Bookings
      </button>
      <p style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>Booking not found.</p>
    </div>
  );

  const statusIdx = STATUS_ORDER.indexOf(booking.status);

  const handleSaveCrew = () => {
    if (!crewDraft) return;
    setSavingCrew(true);
    setTimeout(() => { setAssignedCrew(crewDraft); setCrewSaved(true); setReassigning(false); setSavingCrew(false); }, 700);
  };

  // Left column fields
  const detailRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Booking Ref",    value: <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{booking.ref}</span> },
    { label: "Created",        value: "22 Jun 2026, 11:00 AM by Camilla Wong" },
    { label: "Linked Intake",  value: (
        <button onClick={() => onViewIntake?.("EFAR-2026-00007")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, color: "#3B82F6", fontFamily: "'Inter', sans-serif", textDecoration: "underline", textUnderlineOffset: 3 }}>
          EFAR-2026-00007
        </button>
      )
    },
    { label: "Client",         value: booking.client },
    { label: "Service Type",   value: "EAS (Emergency Ambulance Services)" },
    { label: "Service Tier",   value: (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <TierBadge tier={booking.tier} />
          <span style={{ fontSize: 12, color: "#F59E0B", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={12} strokeWidth={2.5} /> Adjusted from: Advanced
          </span>
        </div>
      )
    },
    { label: "Scheduled",      value: "5 Jul 2026, 14:30" },
    { label: "Pickup",         value: "Changi General Hospital, 2 Simei Street 3, Singapore 529889" },
    { label: "Destination",    value: "Singapore General Hospital, Outram Road, Singapore 169608" },
    { label: "Internal Notes", value: (
        <span style={{ fontSize: 14, color: "#64748B", fontStyle: "italic", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
          "Upgraded to Critical — ICU transfer confirmed with doctor."
        </span>
      )
    },
  ];

  return (
    <div>
      {/* Content */}
      <div style={{ display: "grid", gridTemplateColumns: "40% 30% 30%", gap: 20, alignItems: "start" }}>

        {/* ── LEFT: Booking Details ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Booking Details</h2>
          </div>
          <div style={{ padding: "0 24px" }}>
            {detailRows.map(({ label, value }, i) => (
              <FieldRow key={label} label={label} value={value} last={i === detailRows.length - 1} />
            ))}
          </div>
        </div>

        {/* ── MIDDLE: Status Timeline ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Status Timeline</h2>
          </div>
          <div style={{ padding: "24px" }}>
            {STATUS_ORDER.map((step, i) => {
              const isDone = STATUS_ORDER.indexOf(step) < statusIdx;
              const isActive = step === booking.status;
              const isFuture = STATUS_ORDER.indexOf(step) > statusIdx;
              const ts = TIMELINE_STEPS[i].ts;
              const isLast = i === STATUS_ORDER.length - 1;

              return (
                <div key={step} style={{ display: "flex", gap: 14 }}>
                  {/* Spine */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    {/* Node */}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isDone ? "#22C55E" : isActive ? "#1E293B" : "#F1F5F9",
                      border: isFuture ? "2px solid #E2E8F0" : "none",
                      transition: "background 0.2s",
                    }}>
                      {isDone && <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />}
                      {isActive && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFFFFF" }} />}
                    </div>
                    {/* Connector line */}
                    {!isLast && (
                      <div style={{ width: 2, flex: 1, minHeight: 32, background: isDone ? "#22C55E" : "#E2E8F0", margin: "4px 0" }} />
                    )}
                  </div>

                  {/* Label + timestamp */}
                  <div style={{ paddingBottom: isLast ? 0 : 24, paddingTop: 3 }}>
                    <p style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, color: isFuture ? "#CBD5E1" : "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>
                      {step}
                    </p>
                    {(isDone || isActive) && ts && (
                      <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{ts}</p>
                    )}
                    {isActive && !ts && (
                      <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>In progress</p>
                    )}
                    {isFuture && (
                      <p style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>Pending</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Actions & Links ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Actions &amp; Links</h2>
          </div>
          <div style={{ padding: "20px 24px" }}>

            {/* Crew Assignment */}
            <p style={sectionLabelStyle}>Crew Assignment</p>

            {crewSaved && !reassigning ? (
              /* Crew assigned state */
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>Assigned Crew</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#3B82F6", fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>
                      {assignedCrew.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{assignedCrew}</span>
                  </div>
                  <button onClick={() => { setReassigning(true); setCrewDraft(assignedCrew); }}
                    style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s, color 0.12s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}>
                    Reassign
                  </button>
                </div>
              </div>
            ) : (
              /* No crew / reassign state */
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>Assigned Crew</p>
                {!crewSaved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <AlertTriangle size={13} color="#F59E0B" strokeWidth={2.5} />
                    <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>No crew assigned</span>
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ position: "relative" }}>
                    <select value={crewDraft} onChange={(e) => setCrewDraft(e.target.value)}
                      style={{ width: "100%", height: 40, paddingLeft: 12, paddingRight: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 14, color: crewDraft ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer", boxSizing: "border-box" }}>
                      <option value="">Select crew member</option>
                      {CREW_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSaveCrew} disabled={!crewDraft || savingCrew}
                    style={{ flex: 1, height: 40, borderRadius: 8, background: !crewDraft || savingCrew ? "#94A3B8" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: !crewDraft || savingCrew ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s" }}
                    onMouseEnter={(e) => { if (crewDraft && !savingCrew) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
                    onMouseLeave={(e) => { if (crewDraft && !savingCrew) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
                    {savingCrew ? <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Saving…</> : "Save Assignment"}
                  </button>
                  {reassigning && (
                    <button onClick={() => setReassigning(false)}
                      style={{ height: 40, padding: "0 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: "#E2E8F0", margin: "4px 0 20px" }} />

            {/* Linked Records */}
            <p style={sectionLabelStyle}>Linked Records</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Service Memo */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>Service Memo</p>
                <span style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif", fontStyle: "italic" }}>Not yet submitted</span>
              </div>

              {/* Invoice */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#64748B", marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>Invoice</p>
                <span style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif", fontStyle: "italic" }}>Not yet generated</span>
              </div>
            </div>

            {/* Audit note */}
            <div style={{ marginTop: 24, padding: "10px 12px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <p style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
                All changes are logged with your name and timestamp for audit purposes.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Booking Detail shared styles ─────────────────────────────────────────────

export const backBtnStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0, marginBottom: 24, transition: "color 0.12s" };
export const cardStyle: React.CSSProperties = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" };
export const cardHeaderStyle: React.CSSProperties = { padding: "18px 24px", borderBottom: "1px solid #E2E8F0" };
export const cardTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" };
export const sectionLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, fontFamily: "'Inter', sans-serif" };

// ─── Intake Detail ────────────────────────────────────────────────────────────

export function IntakeDetail({ intake, onBack, onConfirmed, onRejected, addToast }: { intake: Intake; onBack: () => void; onConfirmed: (ref: string) => void; onRejected: () => void; addToast: (t: Toast["type"], m: string) => void }) {
  const [tier, setTier] = useState(intake.tier);
  const [schedDate, setSchedDate] = useState("2026-07-05");
  const [schedTime, setSchedTime] = useState("14:30");
  const [internalNotes, setInternalNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => { const bkg = "BKG-2026-00008"; addToast("success", `Booking ${bkg} created successfully`); setTimeout(() => { setConfirming(false); onConfirmed(bkg); }, 300); }, 900);
  };
  const handleReject = () => {
    setRejecting(true);
    setTimeout(() => { addToast("error", `Submission ${intake.ref} rejected`); setTimeout(() => { setRejecting(false); onRejected(); }, 300); }, 700);
  };

  const detailFields: [string, React.ReactNode][] = [
    ["Reference", intake.ref], ["Submitted", "22 Jun 2026, 10:15 AM"], ["Customer Name", intake.name], ["Organisation", intake.org === "—" ? "—" : intake.org],
    ["Email", "john.tan@cgh.com.sg"], ["Phone", "91234567"], ["Service Type", "EAS (Emergency Ambulance Services)"], ["Service Tier", <TierBadge key="t" tier={intake.tier} />],
    ["Preferred Date", "5 Jul 2026"], ["Preferred Time", "14:30"], ["Pickup Location", "Changi General Hospital, 2 Simei Street 3, Singapore 529889"],
    ["Destination", "Singapore General Hospital, Outram Road, Singapore 169608"],
    ["Additional Notes", <span key="n" style={{ color: "#64748B", fontStyle: "italic" }}>"Patient requires oxygen support during transfer."</span>],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 20, alignItems: "start" }}>
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0" }}><h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Submission Details</h2></div>
        <div style={{ padding: "0 24px" }}>{detailFields.map(([l, v], i) => <FieldRow key={String(l)} label={String(l)} value={v} last={i === detailFields.length - 1} />)}</div>
      </div>
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0" }}><h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Take Action</h2></div>
        <div style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>Confirm Booking</p>
          <div style={{ marginBottom: 16 }}>
            <FormLabel htmlFor="action-tier">Service Tier</FormLabel>
            <StyledSelect id="action-tier" value={tier} onChange={setTier} options={["Basic", "Advanced", "Critical"]} />
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 6, lineHeight: 1.5, fontFamily: "'Inter', sans-serif" }}>Adjust if the described situation warrants a different tier. The original selection is preserved for audit.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div><FormLabel htmlFor="action-date">Scheduled Date</FormLabel><StyledDate id="action-date" value={schedDate} onChange={setSchedDate} /></div>
            <div><FormLabel htmlFor="action-time">Scheduled Time</FormLabel><StyledTime id="action-time" value={schedTime} onChange={setSchedTime} /></div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <FormLabel htmlFor="action-notes">Internal Notes <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span></FormLabel>
            <StyledTextarea id="action-notes" value={internalNotes} onChange={setInternalNotes} placeholder="Notes e.g. tier adjustment reason, access instructions…" rows={3} />
          </div>
          <button onClick={handleConfirm} disabled={confirming}
            style={{ width: "100%", height: 44, borderRadius: 8, background: confirming ? "#334155" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: confirming ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}
            onMouseEnter={(e) => { if (!confirming) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
            onMouseLeave={(e) => { if (!confirming) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
            {confirming ? <><svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Confirming…</> : "Confirm Booking"}
          </button>
          <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
            <span style={{ padding: "0 12px", fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", background: "#FFFFFF" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>Reject Submission</p>
          <div style={{ marginBottom: 16 }}>
            <FormLabel htmlFor="action-reject">Rejection Reason <span style={{ color: "#EF4444" }}>*</span></FormLabel>
            <StyledTextarea id="action-reject" value={rejectReason} onChange={setRejectReason} placeholder="Enter reason for rejection e.g. location is outside our service area" rows={3} />
          </div>
          <button onClick={handleReject} disabled={!rejectReason.trim() || rejecting}
            style={{ width: "100%", height: 44, borderRadius: 8, background: !rejectReason.trim() || rejecting ? "#FCA5A5" : "#EF4444", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: !rejectReason.trim() || rejecting ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}
            onMouseEnter={(e) => { if (rejectReason.trim() && !rejecting) (e.currentTarget as HTMLButtonElement).style.background = "#DC2626"; }}
            onMouseLeave={(e) => { if (rejectReason.trim() && !rejecting) (e.currentTarget as HTMLButtonElement).style.background = "#EF4444"; }}>
            {rejecting ? <><svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Rejecting…</> : "Reject Submission"}
          </button>
          <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>Actions are logged with your name and timestamp. Rejections can be reopened within 24 hours if no booking has been created.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Xero Sync Status ─────────────────────────────────────────────────────────

type SyncEntityType = "AR Invoice" | "AP Invoice" | "Bank Feed";
type SyncStatus = "Failed" | "Synced" | "Pending";
type SyncFilter = "All" | "AR Invoices" | "AP Invoices" | "Bank Feed" | "Failed";

interface SyncRecord {
  id: string;
  entityType: SyncEntityType;
  reference: string;
  xeroId: string;
  attempts: number;
  lastError: string;
  syncedAt: string;
  status: SyncStatus;
}

const SYNC_DATA: SyncRecord[] = [
  { id: "s1", entityType: "AR Invoice", reference: "INV-005",      xeroId: "",             attempts: 2, lastError: "Contact code not found in Xero",    syncedAt: "", status: "Failed"  },
  { id: "s2", entityType: "AP Invoice", reference: "FD-2026-0421", xeroId: "",             attempts: 1, lastError: "Unrecognised account code: 4200",    syncedAt: "", status: "Failed"  },
  { id: "s3", entityType: "AP Invoice", reference: "AR-2026-099",  xeroId: "",             attempts: 3, lastError: "Authentication token expired",        syncedAt: "", status: "Failed"  },
  { id: "s4", entityType: "AR Invoice", reference: "INV-004",      xeroId: "INV-XR-0041", attempts: 1, lastError: "",                                    syncedAt: "14 Jun 2026, 09:45", status: "Synced" },
  { id: "s5", entityType: "Bank Feed",  reference: "FEED-0022",    xeroId: "",             attempts: 1, lastError: "",                                    syncedAt: "22 Jun 2026, 10:30", status: "Synced" },
  { id: "s6", entityType: "AR Invoice", reference: "INV-003",      xeroId: "",             attempts: 1, lastError: "",                                    syncedAt: "", status: "Pending" },
  { id: "s7", entityType: "AP Invoice", reference: "MSC-0388",     xeroId: "",             attempts: 1, lastError: "",                                    syncedAt: "", status: "Pending" },
];

export function XeroSyncStatus({ onReconnect }: { onReconnect?: () => void }) {
  const [filter, setFilter] = useState<SyncFilter>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  const [syncStatuses, setSyncStatuses] = useState<Record<string, SyncStatus>>({});
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});

  const statusOf = (r: SyncRecord): SyncStatus => syncStatuses[r.id] ?? r.status;
  const errorOf = (r: SyncRecord): string => syncErrors[r.id] !== undefined ? syncErrors[r.id] : r.lastError;

  function handleRetry(r: SyncRecord) {
    setRetryingIds((p) => ({ ...p, [r.id]: true }));
    setTimeout(() => {
      setRetryingIds((p) => ({ ...p, [r.id]: false }));
      if (Math.random() > 0.4) {
        setSyncStatuses((p) => ({ ...p, [r.id]: "Synced" }));
        setSyncErrors((p) => ({ ...p, [r.id]: "" }));
      } else {
        setSyncErrors((p) => ({ ...p, [r.id]: "Retry failed — check Xero connection" }));
      }
    }, 1400);
  }

  const filtered = SYNC_DATA.filter((r) => {
    const s = statusOf(r);
    if (filter === "AR Invoices" && r.entityType !== "AR Invoice") return false;
    if (filter === "AP Invoices" && r.entityType !== "AP Invoice") return false;
    if (filter === "Bank Feed" && r.entityType !== "Bank Feed") return false;
    if (filter === "Failed" && s !== "Failed") return false;
    return true;
  });

  const failedCount = SYNC_DATA.filter((r) => statusOf(r) === "Failed").length;
  const pendingCount = SYNC_DATA.filter((r) => statusOf(r) === "Pending").length;
  const syncedCount = SYNC_DATA.filter((r) => statusOf(r) === "Synced").length;
  const hasMaxRetry = filtered.some((r) => r.attempts >= 3 && statusOf(r) === "Failed");

  const thS: React.CSSProperties = { padding: "11px 16px", textAlign: "left" as const, fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.05em", whiteSpace: "nowrap" as const, fontFamily: "'Inter', sans-serif" };
  const tdS: React.CSSProperties = { padding: "0 16px", verticalAlign: "middle", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {[
          { label: "Successful", value: syncedCount + 23, color: "#22C55E" },
          { label: "Pending",    value: pendingCount,     color: "#F59E0B" },
          { label: "Failed",     value: failedCount,      color: "#EF4444" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "20px 24px" }}>
            <p style={{ fontSize: 12, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Failure banner */}
      {failedCount > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color="#F59E0B" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: "#92400E", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
              <strong>{failedCount} sync{failedCount !== 1 ? "s" : ""} failed.</strong> A shared root cause may exist. Reconnecting to Xero may resolve token-related failures.
            </p>
          </div>
          {onReconnect && (
            <button onClick={onReconnect}
              style={{ height: 34, padding: "0 14px", borderRadius: 6, border: "1px solid rgba(245,158,11,0.5)", background: "#FFFFFF", color: "#92400E", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
              Reconnect Xero
            </button>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
          {(["All", "AR Invoices", "AP Invoices", "Bank Feed", "Failed"] as SyncFilter[]).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)}
              style={{ padding: "5px 11px", borderRadius: 6, border: filter === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: filter === tab ? "#FFFFFF" : "transparent", color: filter === tab ? "#1E293B" : "#64748B", fontSize: 12, fontWeight: filter === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "all 0.12s" }}>
              {tab}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[
            { val: dateFrom, set: setDateFrom, focus: dfFocus, setFocus: setDfFocus },
            { val: dateTo,   set: setDateTo,   focus: dtFocus, setFocus: setDtFocus },
          ].map((f, i) => (
            <React.Fragment key={i}>
              {i === 1 && <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>to</span>}
              <div style={{ position: "relative" }}>
                <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                <input type="date" value={f.val} onChange={(e) => f.set(e.target.value)} onFocus={() => f.setFocus(true)} onBlur={() => f.setFocus(false)}
                  style={{ height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${f.focus ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: f.val ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Entity Type", "Reference", "Xero Record ID", "Attempts", "Last Error", "Synced At", "Action"].map((col) => (
                  <th key={col} style={thS}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No records match the current filters.</td></tr>
              ) : filtered.map((r, i) => {
                const s = statusOf(r);
                const err = errorOf(r);
                const isMaxRetry = r.attempts >= 3 && s === "Failed";
                const isFailed = s === "Failed";
                const baseBg = isMaxRetry ? "#FEF2F2" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                const hoverBg = isMaxRetry ? "#FEE2E2" : "#F1F5F9";
                const isRetrying = retryingIds[r.id];

                return (
                  <React.Fragment key={r.id}>
                    <tr style={{ borderBottom: "1px solid #E2E8F0", background: baseBg, height: 52 }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = hoverBg)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = baseBg)}>
                      <td style={tdS}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 5, fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif",
                          background: r.entityType === "AR Invoice" ? "rgba(59,130,246,0.10)" : r.entityType === "AP Invoice" ? "rgba(245,158,11,0.10)" : "rgba(100,116,139,0.10)",
                          color: r.entityType === "AR Invoice" ? "#3B82F6" : r.entityType === "AP Invoice" ? "#F59E0B" : "#64748B",
                        }}>{r.entityType}</span>
                      </td>
                      <td style={tdS}><span style={{ fontWeight: 500 }}>{r.reference}</span></td>
                      <td style={tdS}>
                        <span style={{ color: r.xeroId ? "#3B82F6" : "#94A3B8", fontStyle: r.xeroId ? "normal" : "normal" }}>{r.xeroId || "—"}</span>
                      </td>
                      <td style={{ ...tdS, textAlign: "center" as const }}>
                        <span style={{ fontSize: 13, color: r.attempts >= 3 ? "#EF4444" : "#64748B", fontWeight: r.attempts >= 3 ? 600 : 400 }}>{r.attempts}</span>
                      </td>
                      <td style={{ ...tdS, maxWidth: 220 }}>
                        {err ? (
                          <span style={{ fontSize: 13, color: "#EF4444", fontFamily: "'Inter', sans-serif", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={err}>{err}</span>
                        ) : <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={tdS}>
                        <span style={{ fontSize: 13, color: r.syncedAt ? "#22C55E" : "#94A3B8" }}>{r.syncedAt || "—"}</span>
                      </td>
                      <td style={tdS}>
                        {s === "Synced" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#22C55E", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                            <CheckCircle2 size={14} strokeWidth={2.5} /> Synced
                          </span>
                        ) : isMaxRetry ? (
                          <button disabled
                            style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#94A3B8", fontSize: 12, fontWeight: 500, cursor: "not-allowed", fontFamily: "'Inter', sans-serif" }}>
                            Contact Support
                          </button>
                        ) : isFailed || s === "Pending" ? (
                          isRetrying ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 6, background: "#F1F5F9", fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="#CBD5E1" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" /></svg>
                              Retrying…
                            </div>
                          ) : (
                            <button onClick={() => handleRetry(r)}
                              style={{ height: 30, padding: "0 12px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s" }}
                              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"}
                              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"}>
                              Retry
                            </button>
                          )
                        ) : <span style={{ color: "#94A3B8", fontSize: 13 }}>—</span>}
                      </td>
                    </tr>
                    {/* Max retry warning row */}
                    {isMaxRetry && (
                      <tr style={{ background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
                        <td colSpan={7} style={{ padding: "8px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <AlertTriangle size={13} color="#F59E0B" strokeWidth={2.5} />
                            <span style={{ fontSize: 12, color: "#92400E", fontFamily: "'Inter', sans-serif" }}>
                              Maximum retries reached. This likely requires a Xero configuration fix — contact your Xero administrator.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Showing {filtered.length} of {SYNC_DATA.length} records</span>
        </div>
      </div>
    </div>
  );
}
