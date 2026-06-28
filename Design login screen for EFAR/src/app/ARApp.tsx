import React, { useState, useRef } from "react";
import {
  Bell, ClipboardList, BookOpen, Settings, Search, ChevronDown, ChevronLeft, ChevronRight,
  LogOut, ArrowLeft, CheckCircle2, XCircle, X, AlertTriangle, Calendar,
  LayoutDashboard, FileText, RefreshCw, ExternalLink,
} from "lucide-react";
import { SidebarItem, Toast, ToastContainer, useToasts, FieldRow, XeroSyncStatus } from "./shared";

// ─── AR Specialist types & data ───────────────────────────────────────────────

type ARPage = "dashboard" | "memo-review" | "invoices" | "pricing-contracts" | "xero-sync";
type ContractStatus = "Active" | "Expired";
type ContractFilter = "All Contracts" | "Active" | "Expired";

interface PricingContract {
  id: string;
  name: string;
  client: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: ContractStatus;
  rateCount: number;
}

const CONTRACTS: PricingContract[] = [
  { id: "c1", name: "TTSH - FY2026 Service Agreement",    client: "Tan Tock Seng Hospital", effectiveFrom: "1 Jan 2026", effectiveTo: "31 Dec 2026", status: "Active",  rateCount: 14 },
  { id: "c2", name: "ABC Corp - Event & Workplace 2026",  client: "ABC Corporation",         effectiveFrom: "1 Jun 2026", effectiveTo: "31 Dec 2026", status: "Active",  rateCount: 3  },
  { id: "c3", name: "SingHealth - FY2025 Agreement",      client: "SingHealth Group",        effectiveFrom: "1 Jan 2025", effectiveTo: "31 Dec 2025", status: "Expired", rateCount: 0  },
];

// ─── AR Sidebar ───────────────────────────────────────────────────────────────

function ARSidebar({ activePage, onNav, onLogout }: {
  activePage: ARPage;
  onNav: (p: ARPage) => void;
  onLogout: () => void;
}) {
  const items: { id: ARPage; icon: React.ReactNode; label: string }[] = [
    { id: "dashboard",          icon: <LayoutDashboard size={16} />, label: "AR Dashboard" },
    { id: "memo-review",        icon: <FileText size={16} />,        label: "Memo Review" },
    { id: "invoices",           icon: <BookOpen size={16} />,        label: "Invoices" },
    { id: "pricing-contracts",  icon: <ClipboardList size={16} />,   label: "Pricing Contracts" },
    { id: "xero-sync",          icon: <RefreshCw size={16} />,       label: "Xero Sync" },
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
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#0F172A", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#FFFFFF", flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>SL</div>
        <div style={{ overflow: "hidden" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Sarah Lim</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>AR Specialist</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Pricing Contracts List ───────────────────────────────────────────────────

function PricingContractsList({ onView, onNew }: {
  onView: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<ContractFilter>("All Contracts");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const filtered = CONTRACTS.filter((c) => {
    if (filter === "Active" && c.status !== "Active") return false;
    if (filter === "Expired" && c.status !== "Expired") return false;
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !c.client.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
          {(["All Contracts", "Active", "Expired"] as ContractFilter[]).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)}
              style={{ padding: "6px 14px", borderRadius: 6, border: filter === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: filter === tab ? "#FFFFFF" : "transparent", color: filter === tab ? "#1E293B" : "#64748B", fontSize: 13, fontWeight: filter === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.12s", whiteSpace: "nowrap" }}>
              {tab}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", width: 280 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by client or contract name…"
            style={{ width: "100%", height: 38, paddingLeft: 34, paddingRight: 14, borderRadius: 8, border: `1px solid ${searchFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Contract Name", "Client", "Effective From", "Effective To", "Status", "Rates", "Action"].map((col) => (
                  <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No contracts match the current filters.</td></tr>
              ) : filtered.map((c, i) => {
                const isExpired = c.status === "Expired";
                const baseBg = i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                const cellOpacity = isExpired ? 0.5 : 1;
                return (
                  <tr key={c.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid #E2E8F0" : "none", background: baseBg, height: 52 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#F1F5F9")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = baseBg)}>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", opacity: cellOpacity }}>{c.name}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", opacity: cellOpacity, whiteSpace: "nowrap" }}>{c.client}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", opacity: cellOpacity, whiteSpace: "nowrap" }}>{c.effectiveFrom}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", opacity: cellOpacity, whiteSpace: "nowrap" }}>{c.effectiveTo}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                        fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
                        background: isExpired ? "rgba(100,116,139,0.12)" : "rgba(34,197,94,0.12)",
                        color: isExpired ? "#64748B" : "#22C55E",
                      }}>
                        {!isExpired && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />}
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", opacity: cellOpacity }}>
                        {c.rateCount > 0 ? `${c.rateCount} rates` : <span style={{ color: "#94A3B8" }}>—</span>}
                      </span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <button onClick={() => onView(c.id)}
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
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Showing {filtered.length} of {CONTRACTS.length} contracts</span>
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

// ─── Pricing Contract Detail ─────────────────────────────────────────────────

interface PricingRate {
  id: string;
  serviceType: string;
  transferType: string;
  timeOfDay: string;
  baseAmount: number;
}

interface SurchargeSchedule {
  oxygenBase: number;
  oxygenPerLitre: number;
  inconvenience: number;
  disposables: number;
  resuscitation: number;
  suction: number;
  waitingTime: number;
  heavyLiftingMin: number;
  heavyLiftingMax: number;
  jurongMin: number;
  jurongMax: number;
  cancellation: string;
}

const INITIAL_RATES: PricingRate[] = [
  { id: "r1", serviceType: "EAS", transferType: "One-Way Hospital Transfer", timeOfDay: "Office Hours",     baseAmount: 850  },
  { id: "r2", serviceType: "EAS", transferType: "One-Way Hospital Transfer", timeOfDay: "Non-Office Hours", baseAmount: 950  },
  { id: "r3", serviceType: "EAS", transferType: "COVID-19 Case Transport",   timeOfDay: "All Hours",        baseAmount: 1200 },
  { id: "r4", serviceType: "MTS", transferType: "Airport (With Tarmac)",     timeOfDay: "All Hours",        baseAmount: 1050 },
  { id: "r5", serviceType: "MTS", transferType: "One-Way Hospital Transfer", timeOfDay: "Office Hours",     baseAmount: 620  },
  { id: "r6", serviceType: "MTS", transferType: "IMH/Psychiatric Transfer",  timeOfDay: "All Hours",        baseAmount: 780  },
];

const INITIAL_SURCHARGES: SurchargeSchedule = {
  oxygenBase: 50, oxygenPerLitre: 1, inconvenience: 50, disposables: 20,
  resuscitation: 320, suction: 50, waitingTime: 30,
  heavyLiftingMin: 50, heavyLiftingMax: 150, jurongMin: 150, jurongMax: 200,
  cancellation: "100%",
};

const SERVICE_TYPES_AR = ["EAS", "MTS", "Event Standby", "Workplace Standby"];
const TRANSFER_TYPES_AR = [
  "One-Way Hospital Transfer", "Two-Way Hospital Transfer", "COVID-19 Case Transport",
  "IMH/Psychiatric Transfer", "Airport (No Tarmac)", "Airport (With Tarmac)",
  "SG-JB Ground Transfer", "Air Evacuation",
];
const TIME_OF_DAY_OPTIONS = ["Office Hours", "Non-Office Hours", "All Hours"];

function PricingContractDetail({ contract, onEdit, onBack }: {
  contract: PricingContract;
  onEdit: () => void;
  onBack: () => void;
}) {
  const [rates, setRates] = useState<PricingRate[]>(INITIAL_RATES);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PricingRate>>({});
  const [addingRate, setAddingRate] = useState(false);
  const [newRate, setNewRate] = useState({ serviceType: "", transferType: "", timeOfDay: "", baseAmount: "" });

  const [surcharges, setSurcharges] = useState<SurchargeSchedule>(INITIAL_SURCHARGES);
  const [editingSurcharges, setEditingSurcharges] = useState(false);
  const [surchargeDraft, setSurchargeDraft] = useState<SurchargeSchedule>(INITIAL_SURCHARGES);

  const [deactivating, setDeactivating] = useState(false);
  const [status, setStatus] = useState<ContractStatus>(contract.status);

  // ── Rate actions ──────────────────────────────────────────────────────────

  function confirmDelete(id: string) {
    setRates((prev) => prev.filter((r) => r.id !== id));
    setDeletingId(null);
  }

  function startEdit(rate: PricingRate) {
    setEditingId(rate.id);
    setEditDraft({ ...rate });
    setDeletingId(null);
  }

  function saveEdit() {
    setRates((prev) => prev.map((r) => r.id === editingId ? { ...r, ...editDraft } as PricingRate : r));
    setEditingId(null);
  }

  function saveNewRate() {
    if (!newRate.serviceType || !newRate.transferType || !newRate.timeOfDay || !newRate.baseAmount) return;
    setRates((prev) => [...prev, {
      id: "r" + Date.now(),
      serviceType: newRate.serviceType,
      transferType: newRate.transferType,
      timeOfDay: newRate.timeOfDay,
      baseAmount: Number(newRate.baseAmount),
    }]);
    setNewRate({ serviceType: "", transferType: "", timeOfDay: "", baseAmount: "" });
    setAddingRate(false);
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" };
  const tdBase: React.CSSProperties = { padding: "0 14px", verticalAlign: "middle", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" };

  function inlineSelect(value: string, onChange: (v: string) => void, options: string[], placeholder: string) {
    return (
      <div style={{ position: "relative" }}>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          style={{ height: 34, paddingLeft: 10, paddingRight: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: value ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer", width: "100%" }}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
      </div>
    );
  }

  function inlineInput(value: string | number, onChange: (v: string) => void, type = "text", placeholder = "") {
    const [focused, setFocused] = useState(false);
    return (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{ height: 34, width: "100%", padding: "0 10px", borderRadius: 6, border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />
    );
  }

  const surchargeRows: Array<{ label: string; key: keyof SurchargeSchedule; prefix?: string; suffix?: string }> = [
    { label: "Oxygen Base",               key: "oxygenBase",       prefix: "$" },
    { label: "Oxygen Per Litre (>10L)",   key: "oxygenPerLitre",   prefix: "$" },
    { label: "Inconvenience Fee",          key: "inconvenience",    prefix: "$" },
    { label: "Disposables Base",           key: "disposables",      prefix: "$" },
    { label: "Resuscitation",              key: "resuscitation",    prefix: "$" },
    { label: "Suction",                    key: "suction",          prefix: "$" },
    { label: "Waiting Time (per 30 min)", key: "waitingTime",      prefix: "$" },
    { label: "Heavy Lifting (min)",        key: "heavyLiftingMin",  prefix: "$" },
    { label: "Heavy Lifting (max)",        key: "heavyLiftingMax",  prefix: "$" },
    { label: "Jurong Island (min)",        key: "jurongMin",        prefix: "$" },
    { label: "Jurong Island (max)",        key: "jurongMax",        prefix: "$" },
    { label: "Cancellation",               key: "cancellation" },
  ];

  return (
    <div>
      {/* Info bar */}
      <div style={{ margin: "-32px -32px 24px", padding: "10px 32px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 32, flexWrap: "wrap" }}>
        {[
          ["Client", "Tan Tock Seng Hospital"],
          ["Effective", "1 Jan 2026 – 31 Dec 2026"],
          ["Created by", "Sarah Lim"],
          ["Created", "15 Dec 2025"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{label}:</span>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{value}</span>
          </div>
        ))}
        {status === "Active" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={onEdit}
              style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
              Edit Contract
            </button>
            <button onClick={() => { setDeactivating(true); setTimeout(() => { setStatus("Expired"); setDeactivating(false); }, 700); }}
              disabled={deactivating}
              style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid #EF4444", background: "#FFFFFF", color: "#EF4444", fontSize: 12, fontWeight: 500, cursor: deactivating ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"}>
              {deactivating ? "Deactivating…" : "Deactivate"}
            </button>
          </div>
        )}
        {status === "Expired" && (
          <div style={{ marginLeft: "auto" }}>
            <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", fontStyle: "italic" }}>This contract is expired and read-only.</span>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "65% 35%", gap: 20, alignItems: "start" }}>

        {/* ── LEFT: Pricing Rates ── */}
        <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Pricing Rates</h2>
            {status === "Active" && (
              <button onClick={() => { setAddingRate(true); setEditingId(null); setDeletingId(null); }}
                style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
                onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
                + Add Rate
              </button>
            )}
          </div>

          {rates.length === 0 && !addingRate ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
              No rates added yet. Click "+ Add Rate" to begin.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Service Type", "Transfer Type", "Time of Day", "Base Amount", "Action"].map((col) => (
                      <th key={col} style={thStyle}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate, i) => (
                    <React.Fragment key={rate.id}>
                      {/* Main row */}
                      <tr style={{ borderBottom: "1px solid #E2E8F0", height: 48, background: editingId === rate.id ? "#EFF6FF" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                        {editingId === rate.id ? (
                          <>
                            <td style={{ ...tdBase, padding: "6px 10px", minWidth: 120 }}>{inlineSelect(editDraft.serviceType ?? "", (v) => setEditDraft((p) => ({ ...p, serviceType: v })), SERVICE_TYPES_AR, "Type")}</td>
                            <td style={{ ...tdBase, padding: "6px 10px", minWidth: 180 }}>{inlineSelect(editDraft.transferType ?? "", (v) => setEditDraft((p) => ({ ...p, transferType: v })), TRANSFER_TYPES_AR, "Transfer")}</td>
                            <td style={{ ...tdBase, padding: "6px 10px", minWidth: 130 }}>{inlineSelect(editDraft.timeOfDay ?? "", (v) => setEditDraft((p) => ({ ...p, timeOfDay: v })), TIME_OF_DAY_OPTIONS, "Time")}</td>
                            <td style={{ ...tdBase, padding: "6px 10px", minWidth: 110 }}>{inlineInput(editDraft.baseAmount ?? "", (v) => setEditDraft((p) => ({ ...p, baseAmount: Number(v) })), "number", "0.00")}</td>
                            <td style={{ ...tdBase, padding: "6px 10px", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={saveEdit} style={{ height: 30, padding: "0 12px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Save</button>
                                <button onClick={() => setEditingId(null)} style={{ height: 30, padding: "0 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...tdBase, whiteSpace: "nowrap" }}>{rate.serviceType}</td>
                            <td style={tdBase}>{rate.transferType}</td>
                            <td style={{ ...tdBase, whiteSpace: "nowrap" }}>{rate.timeOfDay}</td>
                            <td style={{ ...tdBase, whiteSpace: "nowrap", fontWeight: 500 }}>${rate.baseAmount.toFixed(2)}</td>
                            <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                              {status === "Active" && (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button onClick={() => startEdit(rate)}
                                    style={{ height: 28, padding: "0 10px", borderRadius: 5, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
                                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>Edit</button>
                                  <button onClick={() => setDeletingId(deletingId === rate.id ? null : rate.id)}
                                    style={{ height: 28, padding: "0 10px", borderRadius: 5, border: "1px solid rgba(239,68,68,0.4)", background: "#FFFFFF", color: "#EF4444", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"}
                                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"}>Delete</button>
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>

                      {/* Delete confirmation strip */}
                      {deletingId === rate.id && (
                        <tr style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
                          <td colSpan={5} style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                              <span style={{ fontSize: 13, color: "#EF4444", fontFamily: "'Inter', sans-serif", flex: 1 }}>
                                Delete this rate? Active invoices matched against it cannot be re-matched.
                              </span>
                              <button onClick={() => confirmDelete(rate.id)}
                                style={{ height: 30, padding: "0 14px", borderRadius: 6, background: "#EF4444", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                                Confirm Delete
                              </button>
                              <button onClick={() => setDeletingId(null)}
                                style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Add Rate inline row */}
                  {addingRate && (
                    <tr style={{ background: "#F0FDF4", borderBottom: "1px solid #BBF7D0" }}>
                      <td style={{ ...tdBase, padding: "8px 10px", minWidth: 120 }}>{inlineSelect(newRate.serviceType, (v) => setNewRate((p) => ({ ...p, serviceType: v })), SERVICE_TYPES_AR, "Type")}</td>
                      <td style={{ ...tdBase, padding: "8px 10px", minWidth: 180 }}>{inlineSelect(newRate.transferType, (v) => setNewRate((p) => ({ ...p, transferType: v })), TRANSFER_TYPES_AR, "Transfer")}</td>
                      <td style={{ ...tdBase, padding: "8px 10px", minWidth: 130 }}>{inlineSelect(newRate.timeOfDay, (v) => setNewRate((p) => ({ ...p, timeOfDay: v })), TIME_OF_DAY_OPTIONS, "Time")}</td>
                      <td style={{ ...tdBase, padding: "8px 10px", minWidth: 110 }}>{inlineInput(newRate.baseAmount, (v) => setNewRate((p) => ({ ...p, baseAmount: v })), "number", "0.00")}</td>
                      <td style={{ ...tdBase, padding: "8px 10px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={saveNewRate}
                            style={{ height: 30, padding: "0 12px", borderRadius: 6, background: "#22C55E", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Save</button>
                          <button onClick={() => { setAddingRate(false); setNewRate({ serviceType: "", transferType: "", timeOfDay: "", baseAmount: "" }); }}
                            style={{ height: 30, padding: "0 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RIGHT: Surcharge Schedule ── */}
        <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Surcharges</h2>
            {status === "Active" && !editingSurcharges && (
              <button onClick={() => { setEditingSurcharges(true); setSurchargeDraft({ ...surcharges }); }}
                style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
                onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
                Edit Surcharges
              </button>
            )}
          </div>

          <div style={{ padding: "4px 0" }}>
            {surchargeRows.map(({ label, key, prefix }, idx) => {
              const value = surcharges[key];
              const draftValue = surchargeDraft[key];
              const isLast = idx === surchargeRows.length - 1;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: isLast ? "none" : "1px solid #F1F5F9" }}>
                  <span style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{label}</span>
                  {editingSurcharges && key !== "cancellation" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {prefix && <span style={{ fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>$</span>}
                      <input type="number" min={0} value={draftValue as number}
                        onChange={(e) => setSurchargeDraft((p) => ({ ...p, [key]: Number(e.target.value) }))}
                        style={{ width: 80, height: 32, padding: "0 8px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", textAlign: "right" }}
                        onFocus={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#3B82F6"}
                        onBlur={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#E2E8F0"} />
                    </div>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>
                      {key === "cancellation" ? value : `${prefix ?? ""}${(value as number).toFixed(2)}`}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Edit surcharges footer */}
            {editingSurcharges && (
              <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", gap: 8 }}>
                <button onClick={() => { setSurcharges({ ...surchargeDraft }); setEditingSurcharges(false); }}
                  style={{ flex: 1, height: 38, borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"}>
                  Save Changes
                </button>
                <button onClick={() => setEditingSurcharges(false)}
                  style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Create / Edit Contract Form ─────────────────────────────────────────────

const CLIENT_OPTIONS = [
  "Tan Tock Seng Hospital",
  "Changi General Hospital",
  "ABC Corporation",
  "SingHealth Group",
  "Mount Elizabeth Hospital",
  "Gleneagles Hospital",
];

interface NewClientModal {
  open: boolean;
  name: string;
  code: string;
}

interface DraftRate {
  id: string;
  serviceType: string;
  transferType: string;
  timeOfDay: string;
  baseAmount: string;
}

function ContractForm({
  editingContract,
  onSave,
  onCancel,
  addToast,
}: {
  editingContract?: PricingContract;
  onSave: (id: string) => void;
  onCancel: () => void;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const isEditing = !!editingContract;

  // Contract details state
  const [name, setName] = useState(editingContract?.name ?? "");
  const [client, setClient] = useState(editingContract?.client ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(isEditing ? "2026-01-01" : "");
  const [effectiveTo, setEffectiveTo] = useState(isEditing ? "2026-12-31" : "");
  const [notes, setNotes] = useState("");

  // Focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [clientFocused, setClientFocused] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);

  // Rate table state
  const [rates, setRates] = useState<DraftRate[]>(
    isEditing ? [
      { id: "1", serviceType: "EAS", transferType: "One-Way Hospital Transfer", timeOfDay: "Office Hours", baseAmount: "850" },
      { id: "2", serviceType: "EAS", transferType: "One-Way Hospital Transfer", timeOfDay: "Non-Office Hours", baseAmount: "950" },
    ] : []
  );
  const [rateForm, setRateForm] = useState({ serviceType: "", transferType: "", timeOfDay: "", baseAmount: "" });
  const [rateFormVisible, setRateFormVisible] = useState(true);

  // New client modal
  const [modal, setModal] = useState<NewClientModal>({ open: false, name: "", code: "" });
  const [customClients, setCustomClients] = useState<string[]>([]);

  // Saving
  const [saving, setSaving] = useState(false);

  const allClients = [...CLIENT_OPTIONS, ...customClients];
  const today = new Date().toISOString().split("T")[0];
  const isExpiredContract = effectiveTo && effectiveTo < today;
  const canSave = name.trim() && client.trim() && effectiveFrom && effectiveTo;

  function addRate() {
    if (!rateForm.serviceType || !rateForm.transferType || !rateForm.timeOfDay || !rateForm.baseAmount) return;
    setRates((p) => [...p, { id: Date.now().toString(), ...rateForm }]);
    setRateForm({ serviceType: "", transferType: "", timeOfDay: "", baseAmount: "" });
  }

  function removeRate(id: string) { setRates((p) => p.filter((r) => r.id !== id)); }

  function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      addToast("success", isEditing ? "Contract updated successfully." : "Contract created successfully.");
      onSave("c1"); // navigate to first contract detail as placeholder
    }, 900);
  }

  function handleAddClient() {
    if (!modal.name.trim()) return;
    setCustomClients((p) => [...p, modal.name.trim()]);
    setClient(modal.name.trim());
    setModal({ open: false, name: "", code: "" });
  }

  const inputBase = (focused: boolean): React.CSSProperties => ({
    width: "100%", height: 44, padding: "0 14px", borderRadius: 8,
    border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF",
    fontSize: 14, color: "#1E293B", outline: "none",
    fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box",
  });

  const selectBase = (focused: boolean, hasValue: boolean): React.CSSProperties => ({
    width: "100%", height: 44, paddingLeft: 14, paddingRight: 36, borderRadius: 8,
    border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF",
    fontSize: 14, color: hasValue ? "#1E293B" : "#94A3B8", outline: "none",
    fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer",
    transition: "border-color 0.15s", boxSizing: "border-box",
  });

  const formLabel: React.CSSProperties = { display: "block", fontSize: 14, fontWeight: 500, color: "#1E293B", marginBottom: 6, fontFamily: "'Inter', sans-serif" };

  function SmallSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
    return (
      <div style={{ position: "relative" }}>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", height: 38, paddingLeft: 10, paddingRight: 28, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: value ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" }}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        <div style={{ maxWidth: 720 }}>

          {/* Card 1: Contract Details */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Contract Details</h2>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Contract Name */}
              <div>
                <label style={formLabel} htmlFor="cf-name">Contract Name <span style={{ color: "#EF4444" }}>*</span></label>
                <input id="cf-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                  onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)}
                  placeholder="e.g. TTSH - FY2027 Service Agreement"
                  style={inputBase(nameFocused)} />
              </div>

              {/* Client */}
              <div>
                <label style={formLabel} htmlFor="cf-client">Client <span style={{ color: "#EF4444" }}>*</span></label>
                <div style={{ position: "relative" }}>
                  <select id="cf-client" value={client} onChange={(e) => { if (e.target.value === "__new__") { setModal({ open: true, name: "", code: "" }); } else { setClient(e.target.value); } }}
                    onFocus={() => setClientFocused(true)} onBlur={() => setClientFocused(false)}
                    style={selectBase(clientFocused, !!client)}>
                    <option value="">Select a client…</option>
                    {allClients.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__new__">+ New client…</option>
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                </div>
              </div>

              {/* Date range */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={formLabel} htmlFor="cf-from">Effective From <span style={{ color: "#EF4444" }}>*</span></label>
                  <input id="cf-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}
                    onFocus={() => setFromFocused(true)} onBlur={() => setFromFocused(false)}
                    style={{ ...inputBase(fromFocused), color: effectiveFrom ? "#1E293B" : "#94A3B8" }} />
                </div>
                <div>
                  <label style={formLabel} htmlFor="cf-to">Effective To <span style={{ color: "#EF4444" }}>*</span></label>
                  <input id="cf-to" type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)}
                    onFocus={() => setToFocused(true)} onBlur={() => setToFocused(false)}
                    style={{ ...inputBase(toFocused), color: effectiveTo ? "#1E293B" : "#94A3B8" }} />
                  {isExpiredContract && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "7px 10px", borderRadius: 6, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                      <AlertTriangle size={13} color="#F59E0B" strokeWidth={2.5} />
                      <span style={{ fontSize: 12, color: "#F59E0B", fontFamily: "'Inter', sans-serif" }}>This contract will be created as Expired.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label style={formLabel} htmlFor="cf-notes">
                  Internal Notes <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
                </label>
                <textarea id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                  onFocus={() => setNotesFocused(true)} onBlur={() => setNotesFocused(false)}
                  placeholder="Notes about this contract e.g. negotiated terms, renewal history"
                  rows={3}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${notesFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
              </div>
            </div>
          </div>

          {/* Card 2: Initial Pricing Rates */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Initial Pricing Rates</h2>
              <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>You can add rates now or later from the contract detail screen.</p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Service Type", "Transfer Type", "Time of Day", "Base Amount (SGD)", ""].map((col) => (
                      <th key={col} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Existing draft rates */}
                  {rates.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "28px 14px", textAlign: "center", fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>
                        No rates added yet.
                      </td>
                    </tr>
                  ) : rates.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #E2E8F0", height: 46, background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                      <td style={{ padding: "0 14px", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{r.serviceType}</td>
                      <td style={{ padding: "0 14px", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{r.transferType}</td>
                      <td style={{ padding: "0 14px", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{r.timeOfDay}</td>
                      <td style={{ padding: "0 14px", fontSize: 14, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>${Number(r.baseAmount).toFixed(2)}</td>
                      <td style={{ padding: "0 14px", textAlign: "right" }}>
                        <button onClick={() => removeRate(r.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#EF4444", fontFamily: "'Inter', sans-serif", fontWeight: 500, padding: "4px 2px", textDecoration: "underline", textUnderlineOffset: 2 }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Add rate form row */}
                  <tr style={{ background: "#F0FDF4", borderTop: rates.length > 0 ? "1px solid #E2E8F0" : "none" }}>
                    <td style={{ padding: "10px 10px 10px 14px", minWidth: 130 }}>
                      <SmallSelect value={rateForm.serviceType} onChange={(v) => setRateForm((p) => ({ ...p, serviceType: v }))} options={SERVICE_TYPES_AR} placeholder="Type" />
                    </td>
                    <td style={{ padding: "10px", minWidth: 200 }}>
                      <SmallSelect value={rateForm.transferType} onChange={(v) => setRateForm((p) => ({ ...p, transferType: v }))} options={TRANSFER_TYPES_AR} placeholder="Transfer type" />
                    </td>
                    <td style={{ padding: "10px", minWidth: 150 }}>
                      <SmallSelect value={rateForm.timeOfDay} onChange={(v) => setRateForm((p) => ({ ...p, timeOfDay: v }))} options={TIME_OF_DAY_OPTIONS} placeholder="Time of day" />
                    </td>
                    <td style={{ padding: "10px", minWidth: 130 }}>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94A3B8", pointerEvents: "none" }}>$</span>
                        <input type="number" min={0} value={rateForm.baseAmount} onChange={(e) => setRateForm((p) => ({ ...p, baseAmount: e.target.value }))}
                          placeholder="0.00"
                          style={{ width: "100%", height: 38, paddingLeft: 22, paddingRight: 10, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
                          onFocus={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#3B82F6"}
                          onBlur={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#E2E8F0"} />
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px 10px 6px" }}>
                      <button onClick={addRate}
                        disabled={!rateForm.serviceType || !rateForm.transferType || !rateForm.timeOfDay || !rateForm.baseAmount}
                        style={{ height: 38, padding: "0 16px", borderRadius: 6, background: (!rateForm.serviceType || !rateForm.transferType || !rateForm.timeOfDay || !rateForm.baseAmount) ? "#CBD5E1" : "#22C55E", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: (!rateForm.serviceType || !rateForm.transferType || !rateForm.timeOfDay || !rateForm.baseAmount) ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "background 0.12s" }}
                        onMouseEnter={(e) => { if (rateForm.serviceType && rateForm.transferType && rateForm.timeOfDay && rateForm.baseAmount) (e.currentTarget as HTMLButtonElement).style.background = "#16A34A"; }}
                        onMouseLeave={(e) => { if (rateForm.serviceType && rateForm.transferType && rateForm.timeOfDay && rateForm.baseAmount) (e.currentTarget as HTMLButtonElement).style.background = "#22C55E"; }}>
                        Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky footer */}
      <div style={{ position: "absolute", bottom: 0, left: 240, right: 0, height: 64, borderTop: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", zIndex: 10 }}>
        <button onClick={onCancel}
          style={{ height: 44, padding: "0 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s, color 0.12s" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={!canSave || saving}
          style={{ height: 44, padding: "0 24px", borderRadius: 8, background: !canSave || saving ? "#CBD5E1" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: !canSave || saving ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
          onMouseEnter={(e) => { if (canSave && !saving) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
          onMouseLeave={(e) => { if (canSave && !saving) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
          {saving ? (
            <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Saving…</>
          ) : (isEditing ? "Save Changes" : "Save Contract")}
        </button>
      </div>

      {/* New Client Modal */}
      {modal.open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal({ open: false, name: "", code: "" }); }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", padding: "28px 28px 24px", width: 400, fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B" }}>New Client</h3>
              <button onClick={() => setModal({ open: false, name: "", code: "" })} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", lineHeight: 0, padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ ...formLabel, fontSize: 13 }} htmlFor="modal-client-name">Client Name <span style={{ color: "#EF4444" }}>*</span></label>
                <input id="modal-client-name" type="text" value={modal.name} onChange={(e) => setModal((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. National University Hospital"
                  style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
                  onFocus={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#3B82F6"}
                  onBlur={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#E2E8F0"} />
              </div>
              <div>
                <label style={{ ...formLabel, fontSize: 13 }} htmlFor="modal-client-code">Client Code <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
                <input id="modal-client-code" type="text" value={modal.code} onChange={(e) => setModal((p) => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. NUH"
                  style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
                  onFocus={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#3B82F6"}
                  onBlur={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#E2E8F0"} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal({ open: false, name: "", code: "" })}
                style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleAddClient} disabled={!modal.name.trim()}
                style={{ flex: 1, height: 40, borderRadius: 8, background: modal.name.trim() ? "#1E293B" : "#CBD5E1", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: modal.name.trim() ? "pointer" : "not-allowed", fontFamily: "'Inter', sans-serif' " }}>
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Memo Review Queue ───────────────────────────────────────────────────────

interface MemoQueueItem {
  id: string;
  bookingRef: string;
  client: string;
  serviceType: string;
  transferType: string;
  jobDate: string;
  submittedAt: string;
  submittedHoursAgo: number;
}

const MEMO_QUEUE: MemoQueueItem[] = [
  { id: "MEMO-0006", bookingRef: "BKG-2026-00006", client: "TTSH",  serviceType: "EAS", transferType: "One-Way Hospital", jobDate: "20 Jun 2026", submittedAt: "3h ago",  submittedHoursAgo: 3  },
  { id: "MEMO-0007", bookingRef: "BKG-2026-00007", client: "CGH",   serviceType: "MTS", transferType: "Airport (Tarmac)", jobDate: "21 Jun 2026", submittedAt: "1h ago",  submittedHoursAgo: 1  },
  { id: "MEMO-0005", bookingRef: "BKG-2026-00005", client: "TTSH",  serviceType: "EAS", transferType: "COVID-19 Case",   jobDate: "18 Jun 2026", submittedAt: "10h ago", submittedHoursAgo: 10 },
];

function MemoReviewQueue({ onReview }: { onReview: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [serviceFilter, setServiceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFromFocused, setDateFromFocused] = useState(false);
  const [dateToFocused, setDateToFocused] = useState(false);

  const filtered = MEMO_QUEUE.filter((m) => {
    if (serviceFilter && m.serviceType !== serviceFilter) return false;
    const q = search.toLowerCase();
    if (q && !m.id.toLowerCase().includes(q) && !m.bookingRef.toLowerCase().includes(q) && !m.client.toLowerCase().includes(q)) return false;
    return true;
  });

  const overdueCount = MEMO_QUEUE.filter((m) => m.submittedHoursAgo >= 8).length;

  return (
    <>
      {/* Sub-count line */}
      <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", marginBottom: 20, marginTop: -16 }}>
        {MEMO_QUEUE.length} memos awaiting review
        {overdueCount > 0 && (
          <span style={{ marginLeft: 10, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#EF4444", fontWeight: 500, background: "rgba(239,68,68,0.08)", padding: "2px 10px", borderRadius: 6 }}>
            <AlertTriangle size={12} strokeWidth={2.5} /> {overdueCount} overdue (&gt;8h)
          </span>
        )}
      </p>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
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

        {/* Service type filter */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}
            style={{ height: 38, paddingLeft: 12, paddingRight: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: serviceFilter ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" }}>
            <option value="">Service Type</option>
            {["EAS", "MTS", "Event Standby", "Workplace Standby"].map((o) => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search by memo ID, booking ref, or client…"
            style={{ width: "100%", height: 38, paddingLeft: 34, paddingRight: 14, borderRadius: 8, border: `1px solid ${searchFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Memo ID", "Booking Ref", "Client", "Service Type", "Transfer Type", "Job Date", "Submitted At", "Status", "Action"].map((col) => (
                  <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No memos match the current filters.</td></tr>
              ) : filtered.map((m, i) => {
                const isOverdue = m.submittedHoursAgo >= 8;
                const baseBg = isOverdue ? "#FEF2F2" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                const hoverBg = isOverdue ? "#FEE2E2" : "#F1F5F9";
                return (
                  <tr key={m.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid #E2E8F0" : "none", background: baseBg, height: 52 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = hoverBg)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = baseBg)}>
                    <td style={arTd}><span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", letterSpacing: "0.02em", fontFamily: "'Inter', sans-serif" }}>{m.id}</span></td>
                    <td style={arTd}><span style={arCell}>{m.bookingRef}</span></td>
                    <td style={arTd}><span style={arCell}>{m.client}</span></td>
                    <td style={arTd}><span style={arCell}>{m.serviceType}</span></td>
                    <td style={arTd}><span style={arCell}>{m.transferType}</span></td>
                    <td style={arTd}><span style={arCell}>{m.jobDate}</span></td>
                    <td style={arTd}>
                      <span style={{ fontSize: 13, fontWeight: isOverdue ? 600 : 400, color: isOverdue ? "#EF4444" : "#64748B", fontFamily: "'Inter', sans-serif', display: 'flex', alignItems: 'center', gap: 5" }}>
                        {isOverdue && <AlertTriangle size={12} strokeWidth={2.5} style={{ display: "inline", marginRight: 4 }} />}
                        {m.submittedAt}
                      </span>
                    </td>
                    <td style={arTd}>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6, background: "rgba(59,130,246,0.12)", color: "#3B82F6", fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                        Submitted
                      </span>
                    </td>
                    <td style={arTd}>
                      <button onClick={() => onReview(m.id)}
                        style={{ height: 32, padding: "0 14px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E293B")}>
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Showing {filtered.length} of {MEMO_QUEUE.length} memos</span>
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

const arTd: React.CSSProperties = { padding: "0 16px", verticalAlign: "middle", whiteSpace: "nowrap" };
const arCell: React.CSSProperties = { fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" };

// ─── Memo Review Detail ──────────────────────────────────────────────────────

function MemoReviewDetail({
  memoId,
  onApprove,
  onReturn,
}: {
  memoId: string;
  onApprove: () => void;
  onReturn: () => void;
}) {
  const [correctionNote, setCorrectionNote] = useState("");
  const [noteFocused, setNoteFocused] = useState(false);
  const [approving, setApproving] = useState(false);
  const [returning, setReturning] = useState(false);
  const [sigEnlarged, setSigEnlarged] = useState(false);

  const canReturn = correctionNote.trim() !== "";

  function handleApprove() {
    setApproving(true);
    setTimeout(() => { setApproving(false); onApprove(); }, 900);
  }
  function handleReturn() {
    if (!canReturn) return;
    setReturning(true);
    setTimeout(() => { setReturning(false); onReturn(); }, 700);
  }

  // Shared field row
  function FieldRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", padding: "11px 0", borderBottom: last ? "none" : "1px solid #F1F5F9" }}>
        <span style={{ fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif", minWidth: 160, flexShrink: 0, paddingTop: 1 }}>{label}</span>
        <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>{value}</span>
      </div>
    );
  }

  function YesNo({ yes, note }: { yes: boolean; note?: string }) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: yes ? "#22C55E" : "#94A3B8", fontFamily: "'Inter', sans-serif" }}>
          {yes ? "Yes" : "No"}
          {yes && note && <span style={{ fontSize: 14, fontWeight: 400, color: "#64748B" }}> ({note})</span>}
        </span>
      </span>
    );
  }

  function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 10 }}>{children}</h3>
        <div style={{ height: 1, background: "#E2E8F0", marginBottom: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 20, alignItems: "start" }}>

      {/* ── LEFT: Memo Details ── */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>

        {/* Section 1: Job Information */}
        <div style={{ padding: "20px 24px 16px" }}>
          <SectionHeader>Job Information</SectionHeader>
          {[
            ["Patient Name",        "John Tan"],
            ["Hospital Destination","SGH A&E"],
            ["Job Start",           "14 Jun 2026, 08:00"],
            ["Job End",             "14 Jun 2026, 09:30"],
            ["Overtime Hours",      "0"],
            ["Evacuation Floors",   <span>2 <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>(documentation only)</span></span>],
          ].map(([l, v], i, a) => <FieldRow key={String(l)} label={String(l)} value={v} last={i === a.length - 1} />)}
        </div>

        {/* Section 2: Pricing Engine Fields */}
        <div style={{ margin: "0 16px 20px", borderRadius: 10, border: "1px solid #BFDBFE", borderLeft: "4px solid #3B82F6", overflow: "hidden" }}>
          {/* Header with chip */}
          <div style={{ padding: "14px 20px 10px", background: "#F0F9FF", borderBottom: "1px solid #BFDBFE" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Pricing Engine Fields</h3>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#3B82F6", background: "rgba(59,130,246,0.12)", padding: "3px 10px", borderRadius: 12, fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em" }}>
                These fields generate the invoice
              </span>
            </div>
          </div>
          <div style={{ padding: "0 20px", background: "#FAFEFF" }}>
            {[
              ["Service Type",     "EAS"],
              ["Transfer Type",    "One-Way Hospital Transfer"],
              ["Office Hours",     <YesNo yes={true} />],
              ["Oxygen Used",      <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>12L <span style={{ fontSize: 12, color: "#64748B" }}>(base 10L + 2L overage)</span></span>],
              ["Inconvenience Fee",<YesNo yes={true} note="$50" />],
              ["Disposables",      <YesNo yes={false} />],
              ["Resuscitation",    <YesNo yes={false} />],
              ["Suction",          <YesNo yes={false} />],
              ["Waiting Time",     <span style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>0 min</span>],
              ["Patient Weight",   <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>72 kg <span style={{ fontSize: 12, color: "#94A3B8" }}>(no heavy lifting surcharge)</span></span>],
              ["Jurong Island",    <YesNo yes={false} />],
            ].map(([l, v], i, a) => <FieldRow key={String(l)} label={String(l)} value={v} last={i === a.length - 1} />)}
          </div>
        </div>

        {/* Section 3: Attachments */}
        <div style={{ padding: "0 24px 20px" }}>
          <SectionHeader>Attachments</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Signature */}
            <div>
              <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginBottom: 8, fontWeight: 500 }}>Handover Signature</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setSigEnlarged(true)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }}>
                  <div style={{ width: 80, height: 60, borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.12s" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "#3B82F6"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0"}>
                    <svg width="32" height="20" viewBox="0 0 32 20" fill="none"><path d="M4 16 Q8 4 12 10 Q16 16 20 8 Q24 2 28 12" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" fill="none" /></svg>
                  </div>
                </button>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>Ahmad Rahman</p>
                  <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Signed · 14 Jun 2026, 09:31</p>
                </div>
              </div>
            </div>
            {/* Stamp */}
            <div>
              <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginBottom: 8, fontWeight: 500 }}>Hospital Stamp</p>
              <span style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif", fontStyle: "italic" }}>Not uploaded</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Actions ── */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", position: "sticky", top: 0 }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #E2E8F0" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Actions</h2>
        </div>
        <div style={{ padding: "20px 24px" }}>

          {/* Approve */}
          <button onClick={handleApprove} disabled={approving}
            style={{ width: "100%", height: 48, borderRadius: 8, background: approving ? "#334155" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: approving ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s", marginBottom: 10 }}
            onMouseEnter={(e) => { if (!approving) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
            onMouseLeave={(e) => { if (!approving) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
            {approving
              ? <><svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Generating Invoice…</>
              : <>
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  Approve &amp; Match Invoice
                </>
            }
          </button>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
            Approving triggers the automated pricing match. You will be redirected to the generated invoice for review.
          </p>

          {/* Divider */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
            <span style={{ padding: "0 12px", fontSize: 11, color: "#94A3B8", background: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>or return for correction</span>
            <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
          </div>

          {/* Return */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>
              Correction Note <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <textarea value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)}
              onFocus={() => setNoteFocused(true)} onBlur={() => setNoteFocused(false)}
              placeholder="Describe what the crew needs to correct before resubmitting…"
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${noteFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, transition: "border-color 0.15s" }} />
          </div>

          <button onClick={handleReturn} disabled={!canReturn || returning}
            style={{ width: "100%", height: 44, borderRadius: 8, background: !canReturn || returning ? "#FCA5A5" : "#EF4444", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: !canReturn || returning ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s", marginBottom: 20 }}
            onMouseEnter={(e) => { if (canReturn && !returning) (e.currentTarget as HTMLButtonElement).style.background = "#DC2626"; }}
            onMouseLeave={(e) => { if (canReturn && !returning) (e.currentTarget as HTMLButtonElement).style.background = "#EF4444"; }}>
            {returning
              ? <><svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Returning…</>
              : <>
                  <ArrowLeft size={15} />
                  Return Memo to Crew
                </>
            }
          </button>

          {/* Audit note */}
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <p style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
              This action is logged with your name and timestamp. The crew member will be notified of the correction request.
            </p>
          </div>
        </div>
      </div>

      {/* Signature enlarged modal */}
      {sigEnlarged && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSigEnlarged(false)}>
          <div style={{ background: "#FFFFFF", borderRadius: 16, padding: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.3)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 320, height: 180, borderRadius: 12, border: "2px solid #E2E8F0", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width="200" height="100" viewBox="0 0 200 100" fill="none">
                <path d="M20 80 Q40 20 60 50 Q80 80 100 40 Q120 10 140 60 Q160 80 180 50" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", marginBottom: 16 }}>Signed by Ahmad Rahman · 14 Jun 2026, 09:31</p>
            <button onClick={() => setSigEnlarged(false)} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice List ────────────────────────────────────────────────────────────

type InvoiceStatus = "Matched" | "Adjusted" | "Approved" | "Synced" | "Failed" | "Unmatched";
type InvoiceFilter = "All" | InvoiceStatus;

interface Invoice {
  id: string;
  bookingRef: string;
  client: string;
  serviceType: string;
  subtotal: number;
  status: InvoiceStatus;
  xeroId: string;
}

const INVOICE_DATA: Invoice[] = [
  { id: "INV-001", bookingRef: "BKG-001", client: "TTSH",       serviceType: "EAS", subtotal: 850,  status: "Matched",   xeroId: "" },
  { id: "INV-002", bookingRef: "BKG-002", client: "TTSH",       serviceType: "EAS", subtotal: 1080, status: "Adjusted",  xeroId: "" },
  { id: "INV-003", bookingRef: "BKG-003", client: "TTSH",       serviceType: "EAS", subtotal: 1570, status: "Approved",  xeroId: "" },
  { id: "INV-004", bookingRef: "BKG-004", client: "TTSH",       serviceType: "MTS", subtotal: 1200, status: "Synced",    xeroId: "INV-XR-0041" },
  { id: "INV-005", bookingRef: "BKG-005", client: "TTSH",       serviceType: "EAS", subtotal: 850,  status: "Failed",    xeroId: "" },
  { id: "INV-006", bookingRef: "BKG-006", client: "SingHealth", serviceType: "EAS", subtotal: 0,    status: "Unmatched", xeroId: "" },
];

const INV_STATUS_STYLE: Record<InvoiceStatus, { bg: string; color: string; rowBg?: string }> = {
  Matched:   { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
  Adjusted:  { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
  Approved:  { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
  Synced:    { bg: "rgba(34,197,94,0.12)",   color: "#22C55E" },
  Failed:    { bg: "rgba(239,68,68,0.12)",   color: "#EF4444", rowBg: "#FEF2F2" },
  Unmatched: { bg: "rgba(100,116,139,0.12)", color: "#64748B", rowBg: "#F8FAFC" },
};

const INV_COUNTS = {
  Matched: 3, Adjusted: 1, Approved: 1, Synced: 4, Failed: 1, Unmatched: 1,
};

function InvoiceList({ onView, onBatchApprove }: {
  onView: (id: string) => void;
  onBatchApprove: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<InvoiceFilter>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFromFocused, setDateFromFocused] = useState(false);
  const [dateToFocused, setDateToFocused] = useState(false);
  const [clientFilter, setClientFilter] = useState("");
  const [syncingIds, setSyncingIds] = useState<Record<string, boolean>>({});
  const [invoiceStatuses, setInvoiceStatuses] = useState<Record<string, InvoiceStatus>>({});

  const statusOf = (inv: Invoice): InvoiceStatus => invoiceStatuses[inv.id] ?? inv.status;

  const filtered = INVOICE_DATA.filter((inv) => {
    const s = statusOf(inv);
    if (statusFilter !== "All" && s !== statusFilter) return false;
    if (clientFilter && inv.client !== clientFilter) return false;
    return true;
  });

  function triggerSync(id: string, isRetry: boolean) {
    setSyncingIds((p) => ({ ...p, [id]: true }));
    setTimeout(() => {
      setSyncingIds((p) => ({ ...p, [id]: false }));
      setInvoiceStatuses((p) => ({ ...p, [id]: "Synced" }));
    }, 1600);
  }

  const clients = [...new Set(INVOICE_DATA.map((i) => i.client))];

  const statCards: Array<{ label: string; key: keyof typeof INV_COUNTS; color: string }> = [
    { label: "Matched",       key: "Matched",   color: "#3B82F6" },
    { label: "Adjusted",      key: "Adjusted",  color: "#3B82F6" },
    { label: "Approved",      key: "Approved",  color: "#F59E0B" },
    { label: "Synced to Xero",key: "Synced",    color: "#22C55E" },
    { label: "Failed",        key: "Failed",    color: "#EF4444" },
    { label: "Unmatched",     key: "Unmatched", color: "#64748B" },
  ];

  return (
    <>
      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {statCards.map(({ label, key, color }) => (
          <div key={key}
            onClick={() => setStatusFilter(statusFilter === key ? "All" : key as InvoiceFilter)}
            style={{ flex: 1, background: "#FFFFFF", borderRadius: 12, border: `1px solid ${statusFilter === key ? color : "#E2E8F0"}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "16px 18px", cursor: "pointer", transition: "border-color 0.15s", minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>{INV_COUNTS[key]}</div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
          {(["All", "Matched", "Adjusted", "Approved", "Synced", "Failed", "Unmatched"] as InvoiceFilter[]).map((tab) => (
            <button key={tab} onClick={() => setStatusFilter(tab)}
              style={{ padding: "5px 11px", borderRadius: 6, border: statusFilter === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: statusFilter === tab ? "#FFFFFF" : "transparent", color: statusFilter === tab ? "#1E293B" : "#64748B", fontSize: 12, fontWeight: statusFilter === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.12s", whiteSpace: "nowrap" }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} onFocus={() => setDateFromFocused(true)} onBlur={() => setDateFromFocused(false)}
              style={{ height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${dateFromFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: dateFrom ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
          </div>
          <span style={{ fontSize: 12, color: "#94A3B8" }}>to</span>
          <div style={{ position: "relative" }}>
            <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} onFocus={() => setDateToFocused(true)} onBlur={() => setDateToFocused(false)}
              style={{ height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${dateToFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: dateTo ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Client filter */}
        <div style={{ position: "relative" }}>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
            style={{ height: 36, paddingLeft: 10, paddingRight: 28, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 12, color: clientFilter ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" }}>
            <option value="">All Clients</option>
            {clients.map((c) => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Invoice ID", "Booking Ref", "Client", "Service Type", "Subtotal", "Status", "Xero ID", "Action"].map((col) => (
                  <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No invoices match the current filters.</td></tr>
              ) : filtered.map((inv, i) => {
                const s = statusOf(inv);
                const { bg, color, rowBg } = INV_STATUS_STYLE[s];
                const baseBg = rowBg ?? (i % 2 === 1 ? "#F8FAFC" : "#FFFFFF");
                const hoverBg = s === "Failed" ? "#FEE2E2" : s === "Unmatched" ? "#F1F5F9" : "#F1F5F9";
                const isSyncing = syncingIds[inv.id];

                return (
                  <tr key={inv.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid #E2E8F0" : "none", background: baseBg, height: 52 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = hoverBg)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = baseBg)}>
                    <td style={arTd}><span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", letterSpacing: "0.02em", fontFamily: "'Inter', sans-serif" }}>{inv.id}</span></td>
                    <td style={arTd}><span style={arCell}>{inv.bookingRef}</span></td>
                    <td style={arTd}><span style={arCell}>{inv.client}</span></td>
                    <td style={arTd}><span style={arCell}>{inv.serviceType}</span></td>
                    <td style={arTd}><span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif' " }}>{inv.subtotal > 0 ? `$${inv.subtotal.toFixed(2)}` : <span style={{ color: "#94A3B8" }}>$0.00</span>}</span></td>
                    <td style={arTd}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, background: bg, color, fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                        {s === "Synced" && <CheckCircle2 size={11} strokeWidth={2.5} />}
                        {s === "Failed" && <XCircle size={11} strokeWidth={2.5} />}
                        {s === "Unmatched" && <AlertTriangle size={11} strokeWidth={2.5} />}
                        {s}
                      </span>
                    </td>
                    <td style={arTd}>
                      <span style={{ fontSize: 13, color: s === "Synced" && inv.xeroId ? "#3B82F6" : "#94A3B8", fontFamily: "'Inter', sans-serif" }}>
                        {inv.xeroId || "—"}
                      </span>
                    </td>
                    <td style={arTd}>
                      {isSyncing ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", borderRadius: 6, background: "#F1F5F9", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="#CBD5E1" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" /></svg>
                          Syncing…
                        </div>
                      ) : s === "Approved" ? (
                        <button onClick={() => triggerSync(inv.id, false)}
                          style={{ height: 32, padding: "0 12px", borderRadius: 6, background: "#22C55E", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}
                          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#16A34A"}
                          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#22C55E"}>
                          Sync to Xero
                        </button>
                      ) : s === "Failed" ? (
                        <button onClick={() => triggerSync(inv.id, true)}
                          style={{ height: 32, padding: "0 12px", borderRadius: 6, background: "#EF4444", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}
                          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#DC2626"}
                          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#EF4444"}>
                          Retry Sync
                        </button>
                      ) : (
                        <button onClick={() => onView(inv.id)}
                          style={{ height: 32, padding: "0 14px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s" }}
                          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"}
                          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"}>
                          {s === "Synced" ? "View" : "Review"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Showing {filtered.length} of {INVOICE_DATA.length} invoices</span>
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

// ─── Batch Approve Modal ──────────────────────────────────────────────────────

function BatchApproveModal({ onClose, onApprove }: { onClose: () => void; onApprove: (ids: string[]) => void }) {
  const eligible = INVOICE_DATA.filter((inv) => inv.status === "Matched" || inv.status === "Adjusted");
  const [selected, setSelected] = useState<Set<string>>(new Set(eligible.map((i) => i.id)));
  const [approving, setApproving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleApprove() {
    setApproving(true);
    setTimeout(() => { setApproving(false); onApprove([...selected]); }, 900);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: 480, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B" }}>Batch Approve Invoices</h3>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>Select invoices to approve in one action.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", lineHeight: 0 }}><X size={18} /></button>
        </div>

        {/* Invoice list */}
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {eligible.map((inv, i) => (
            <label key={inv.id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 24px", borderBottom: i < eligible.length - 1 ? "1px solid #F1F5F9" : "none", cursor: "pointer", background: selected.has(inv.id) ? "#F0F9FF" : "#FFFFFF", transition: "background 0.1s" }}>
              <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)}
                style={{ width: 16, height: 16, accentColor: "#1E293B", cursor: "pointer", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>{inv.id}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>${inv.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: "#64748B" }}>{inv.bookingRef}</span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>·</span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>{inv.client}</span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>·</span>
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 4, background: "rgba(59,130,246,0.12)", color: "#3B82F6", fontSize: 11, fontWeight: 500 }}>{inv.status}</span>
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>{selected.size} of {eligible.length} selected</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
            <button onClick={handleApprove} disabled={selected.size === 0 || approving}
              style={{ height: 40, padding: "0 20px", borderRadius: 8, background: selected.size === 0 || approving ? "#94A3B8" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: selected.size === 0 || approving ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
              {approving ? <><svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Approving…</> : `Approve ${selected.size}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Detail ──────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  type: "Auto" | "Manual";
}

const INITIAL_LINE_ITEMS: LineItem[] = [
  { id: "li1", description: "EAS - One-Way Hospital Transfer (Non-Office Hours)", qty: 1, unitPrice: 950,  type: "Auto" },
  { id: "li2", description: "Oxygen - Base charge (first 10L)",                   qty: 1, unitPrice: 50,   type: "Auto" },
  { id: "li3", description: "Oxygen - Additional (5L @ $1/L)",                    qty: 5, unitPrice: 1,    type: "Auto" },
  { id: "li4", description: "Inconvenience Fee (stair/elevator access)",           qty: 1, unitPrice: 50,   type: "Auto" },
  { id: "li5", description: "Hospital Administration Fee",                         qty: 1, unitPrice: 25,   type: "Manual" },
];

type InvoiceDetailStatus = "Adjusted" | "Matched" | "Approved" | "Synced" | "Failed";

function InvoiceDetail({
  invoiceId,
  onRejectMatch,
  addToast,
}: {
  invoiceId: string;
  onRejectMatch: () => void;
  addToast: (type: Toast["type"], msg: string) => void;
}) {
  const [lineItems, setLineItems] = useState<LineItem[]>(INITIAL_LINE_ITEMS);
  const [status, setStatus] = useState<InvoiceDetailStatus>("Adjusted");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<LineItem>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [newItem, setNewItem] = useState({ description: "", qty: "1", unitPrice: "" });
  const [newFocus, setNewFocus] = useState({ desc: false, qty: false, price: false });
  const [approving, setApproving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [xeroId, setXeroId] = useState("");

  const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);

  function saveEdit() {
    setLineItems((p) => p.map((li) => li.id === editingId ? { ...li, ...editDraft } as LineItem : li));
    setEditingId(null);
  }

  function confirmDelete(id: string) {
    setLineItems((p) => p.filter((li) => li.id !== id));
    setDeletingId(null);
  }

  function saveNewItem() {
    if (!newItem.description || !newItem.unitPrice) return;
    setLineItems((p) => [...p, { id: "li" + Date.now(), description: newItem.description, qty: Number(newItem.qty) || 1, unitPrice: Number(newItem.unitPrice), type: "Manual" }]);
    setNewItem({ description: "", qty: "1", unitPrice: "" });
    setAddingRow(false);
    setStatus("Adjusted");
  }

  function handleApprove() {
    setApproving(true);
    setTimeout(() => { setApproving(false); setStatus("Approved"); addToast("success", "Invoice approved and ready to sync."); }, 900);
  }

  function handleSync() {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setStatus("Synced"); setXeroId("INV-XR-0052"); addToast("success", "Invoice synced to Xero successfully."); }, 1600);
  }

  const thS: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontFamily: "'Inter', sans-serif" };
  const tdS: React.CSSProperties = { padding: "0 14px", verticalAlign: "middle", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" };

  function EditableCell({ value, onChange, type = "text" }: { value: string | number; onChange: (v: string) => void; type?: string }) {
    const [f, setF] = useState(false);
    return (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 6, border: `1px solid ${f ? "#3B82F6" : "#E2E8F0"}`, fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />
    );
  }

  function NewItemCell({ value, onChange, placeholder, type = "text", focused, onFocus, onBlur }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string; focused: boolean; onFocus: () => void; onBlur: () => void }) {
    return (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} onFocus={onFocus} onBlur={onBlur}
        style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 6, border: `1px solid ${focused ? "#3B82F6" : "#E2E8F0"}`, fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", background: "#FFFFFF", boxSizing: "border-box" }} />
    );
  }

  // Top-right action buttons
  const actionButtons = (() => {
    if (status === "Synced") return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 6, background: "rgba(34,197,94,0.12)", color: "#22C55E", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          <CheckCircle2 size={14} strokeWidth={2.5} /> Synced to Xero ✓
        </span>
        <span style={{ fontSize: 13, color: "#3B82F6", fontFamily: "'Inter', sans-serif" }}>{xeroId}</span>
      </div>
    );
    if (status === "Approved") return (
      <button onClick={handleSync} disabled={syncing}
        style={{ height: 40, padding: "0 18px", borderRadius: 8, background: syncing ? "#15803D" : "#22C55E", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
        onMouseEnter={(e) => { if (!syncing) (e.currentTarget as HTMLButtonElement).style.background = "#16A34A"; }}
        onMouseLeave={(e) => { if (!syncing) (e.currentTarget as HTMLButtonElement).style.background = "#22C55E"; }}>
        {syncing ? <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Syncing…</> : <>Sync to Xero</>}
      </button>
    );
    if (status === "Failed") return (
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSync}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, background: "#F59E0B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
          Retry Sync
        </button>
        <button onClick={() => setRejectModal(true)}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #EF4444", background: "#FFFFFF", color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
          Reject Match
        </button>
      </div>
    );
    // Matched or Adjusted
    return (
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleApprove} disabled={approving}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, background: approving ? "#334155" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: approving ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}
          onMouseEnter={(e) => { if (!approving) (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"; }}
          onMouseLeave={(e) => { if (!approving) (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"; }}>
          {approving ? <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Approving…</> : "Approve Invoice"}
        </button>
        <button onClick={() => setRejectModal(true)}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #EF4444", background: "#FFFFFF", color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"}>
          Reject Match
        </button>
      </div>
    );
  })();

  const statusStyle = {
    Matched:  { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
    Adjusted: { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
    Approved: { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
    Synced:   { bg: "rgba(34,197,94,0.12)",   color: "#22C55E" },
    Failed:   { bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
  }[status];

  return (
    <>
      {/* Approved info bar */}
      {status === "Approved" && (
        <div style={{ margin: "-32px -32px 20px", padding: "10px 32px", background: "rgba(34,197,94,0.08)", borderBottom: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={15} color="#22C55E" strokeWidth={2.5} />
          <span style={{ fontSize: 13, color: "#15803D", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>Invoice approved — ready to sync to Xero.</span>
        </div>
      )}

      {/* Action buttons exposed to header — rendered here for layout */}
      <div style={{ display: "none" }} data-invoice-actions>{JSON.stringify({ status })}</div>

      <div style={{ display: "grid", gridTemplateColumns: "65% 35%", gap: 20, alignItems: "start" }}>

        {/* ── LEFT: Line Items ── */}
        <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Line Items</h2>
            {status !== "Synced" && (
              <button onClick={() => { setAddingRow(true); setEditingId(null); setDeletingId(null); }}
                style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "border-color 0.12s" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
                onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
                + Add Adjustment
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Description", "Qty", "Unit Price", "Amount", "Type", "Actions"].map((col) => (
                    <th key={col} style={{ ...thS, textAlign: col === "Amount" || col === "Unit Price" || col === "Qty" ? "right" : "left" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => {
                  const isEditing = editingId === li.id;
                  const isDeleting = deletingId === li.id;
                  const amount = li.qty * li.unitPrice;
                  const rowBg = isEditing ? "#EFF6FF" : li.type === "Manual" ? "rgba(245,158,11,0.04)" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                  return (
                    <React.Fragment key={li.id}>
                      <tr style={{ borderBottom: "1px solid #E2E8F0", background: rowBg, height: 48 }}>
                        {isEditing ? (
                          <>
                            <td style={{ ...tdS, padding: "6px 10px", minWidth: 240 }}><EditableCell value={editDraft.description ?? li.description} onChange={(v) => setEditDraft((p) => ({ ...p, description: v }))} /></td>
                            <td style={{ ...tdS, padding: "6px 10px", minWidth: 60 }}><EditableCell value={editDraft.qty ?? li.qty} onChange={(v) => setEditDraft((p) => ({ ...p, qty: Number(v) }))} type="number" /></td>
                            <td style={{ ...tdS, padding: "6px 10px", minWidth: 90 }}><EditableCell value={editDraft.unitPrice ?? li.unitPrice} onChange={(v) => setEditDraft((p) => ({ ...p, unitPrice: Number(v) }))} type="number" /></td>
                            <td style={{ ...tdS, textAlign: "right", padding: "6px 10px" }}>
                              <span style={{ fontSize: 13, color: "#64748B" }}>${((editDraft.qty ?? li.qty) * (editDraft.unitPrice ?? li.unitPrice)).toFixed(2)}</span>
                            </td>
                            <td style={{ ...tdS, padding: "6px 10px" }}></td>
                            <td style={{ ...tdS, padding: "6px 10px", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={saveEdit} style={{ height: 30, padding: "0 12px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Save</button>
                                <button onClick={() => setEditingId(null)} style={{ height: 30, padding: "0 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...tdS, maxWidth: 280 }}>
                              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{li.description}</span>
                            </td>
                            <td style={{ ...tdS, textAlign: "right" }}>{li.qty}</td>
                            <td style={{ ...tdS, textAlign: "right" }}>${li.unitPrice.toFixed(2)}</td>
                            <td style={{ ...tdS, textAlign: "right", fontWeight: 500 }}>${amount.toFixed(2)}</td>
                            <td style={{ ...tdS }}>
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", background: li.type === "Manual" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.10)", color: li.type === "Manual" ? "#F59E0B" : "#3B82F6" }}>
                                {li.type}
                              </span>
                            </td>
                            <td style={{ ...tdS, whiteSpace: "nowrap" }}>
                              {status !== "Synced" && (
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <button onClick={() => { setEditingId(li.id); setEditDraft({ ...li }); setDeletingId(null); }}
                                    title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", lineHeight: 0, padding: 4, borderRadius: 4, transition: "color 0.12s, background 0.12s" }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748B"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                  </button>
                                  {li.type === "Manual" && (
                                    <button onClick={() => setDeletingId(deletingId === li.id ? null : li.id)}
                                      title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", lineHeight: 0, padding: 4, borderRadius: 4, transition: "background 0.12s" }}
                                      onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"}
                                      onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                      {/* Delete confirmation */}
                      {isDeleting && !isEditing && (
                        <tr style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA" }}>
                          <td colSpan={6} style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontSize: 13, color: "#EF4444", fontFamily: "'Inter', sans-serif", flex: 1 }}>Remove this adjustment line?</span>
                              <button onClick={() => confirmDelete(li.id)} style={{ height: 28, padding: "0 12px", borderRadius: 6, background: "#EF4444", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Confirm Remove</button>
                              <button onClick={() => setDeletingId(null)} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Add adjustment row */}
                {addingRow && (
                  <tr style={{ background: "#FFFBEB", borderTop: "1px solid #FDE68A" }}>
                    <td style={{ ...tdS, padding: "8px 10px", minWidth: 240 }}>
                      <NewItemCell value={newItem.description} onChange={(v) => setNewItem((p) => ({ ...p, description: v }))} placeholder="Description" focused={newFocus.desc} onFocus={() => setNewFocus((p) => ({ ...p, desc: true }))} onBlur={() => setNewFocus((p) => ({ ...p, desc: false }))} />
                    </td>
                    <td style={{ ...tdS, padding: "8px 8px", minWidth: 60 }}>
                      <NewItemCell value={newItem.qty} onChange={(v) => setNewItem((p) => ({ ...p, qty: v }))} placeholder="1" type="number" focused={newFocus.qty} onFocus={() => setNewFocus((p) => ({ ...p, qty: true }))} onBlur={() => setNewFocus((p) => ({ ...p, qty: false }))} />
                    </td>
                    <td style={{ ...tdS, padding: "8px 8px", minWidth: 90 }}>
                      <NewItemCell value={newItem.unitPrice} onChange={(v) => setNewItem((p) => ({ ...p, unitPrice: v }))} placeholder="0.00" type="number" focused={newFocus.price} onFocus={() => setNewFocus((p) => ({ ...p, price: true }))} onBlur={() => setNewFocus((p) => ({ ...p, price: false }))} />
                    </td>
                    <td style={{ ...tdS, textAlign: "right", padding: "8px 10px" }}>
                      <span style={{ fontSize: 13, color: "#94A3B8" }}>${((Number(newItem.qty) || 0) * (Number(newItem.unitPrice) || 0)).toFixed(2)}</span>
                    </td>
                    <td style={{ ...tdS, padding: "8px 8px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", background: "rgba(245,158,11,0.12)", padding: "2px 9px", borderRadius: 5, fontFamily: "'Inter', sans-serif" }}>Manual</span>
                    </td>
                    <td style={{ ...tdS, padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={saveNewItem}
                          disabled={!newItem.description || !newItem.unitPrice}
                          style={{ height: 30, padding: "0 12px", borderRadius: 6, background: newItem.description && newItem.unitPrice ? "#22C55E" : "#CBD5E1", color: "#FFFFFF", border: "none", fontSize: 12, fontWeight: 600, cursor: newItem.description && newItem.unitPrice ? "pointer" : "not-allowed", fontFamily: "'Inter', sans-serif" }}>
                          Add
                        </button>
                        <button onClick={() => { setAddingRow(false); setNewItem({ description: "", qty: "1", unitPrice: "" }); }}
                          style={{ height: 30, padding: "0 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Totals row */}
                <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                  <td colSpan={3} style={{ padding: "12px 14px" }} />
                  <td colSpan={3} style={{ padding: "12px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <span style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Subtotal: <strong style={{ color: "#1E293B" }}>${subtotal.toFixed(2)}</strong></span>
                      <span style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Tax: <strong style={{ color: "#1E293B" }}>$0.00</strong></span>
                      <div style={{ height: 1, background: "#E2E8F0", width: 180, margin: "4px 0" }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Total: ${subtotal.toFixed(2)}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT: Invoice Summary ── */}
        <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden", position: "sticky", top: 0 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Invoice Summary</h2>
          </div>
          <div style={{ padding: "4px 0" }}>
            {[
              ["Client",         "Tan Tock Seng Hospital"],
              ["Contract",       <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, color: "#3B82F6", fontFamily: "'Inter', sans-serif", textDecoration: "underline", textUnderlineOffset: 3 }}>TTSH - FY2026 Service Agreement</button>],
              ["Memo Ref",       <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, color: "#3B82F6", fontFamily: "'Inter', sans-serif", textDecoration: "underline", textUnderlineOffset: 3 }}>MEMO-0002</button>],
              ["Booking Ref",    <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 14, color: "#3B82F6", fontFamily: "'Inter', sans-serif", textDecoration: "underline", textUnderlineOffset: 3 }}>BKG-2026-00002</button>],
              ["Invoice Status", <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: statusStyle.bg, color: statusStyle.color, fontFamily: "'Inter', sans-serif" }}>{status}</span>],
              ["Created",        "11 Jun 2026"],
            ].map(([label, value], i, arr) => (
              <div key={String(label)} style={{ display: "flex", alignItems: "flex-start", padding: "11px 20px", borderBottom: i < arr.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", minWidth: 100, flexShrink: 0, paddingTop: 2 }}>{label}</span>
                <div style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{value}</div>
              </div>
            ))}
            <div style={{ padding: "12px 20px", background: "rgba(245,158,11,0.06)", borderTop: "1px solid rgba(245,158,11,0.2)", margin: "4px 0 0" }}>
              <p style={{ fontSize: 12, color: "#78350F", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                Manual adjustment items are amber-highlighted and logged for audit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Match Modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setRejectModal(false); }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: 440, padding: "28px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(239,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={20} color="#EF4444" strokeWidth={2} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", marginBottom: 8 }}>Reject Invoice Match?</h3>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>
                  This will delete the invoice and return the memo to the review queue. The pricing match cannot be recovered.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setRejectModal(false)}
                style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                Cancel
              </button>
              <button onClick={() => { setRejectModal(false); onRejectMatch(); }}
                style={{ height: 40, padding: "0 18px", borderRadius: 8, background: "#EF4444", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── AR Dashboard ────────────────────────────────────────────────────────────

const INVOICE_STATUS_BREAKDOWN = [
  { status: "Matched",   color: "#3B82F6", count: 3,  total: 2730  },
  { status: "Adjusted",  color: "#93C5FD", count: 1,  total: 1080  },
  { status: "Approved",  color: "#F59E0B", count: 1,  total: 1570  },
  { status: "Synced",    color: "#22C55E", count: 8,  total: 9820  },
  { status: "Failed",    color: "#EF4444", count: 1,  total: 850   },
  { status: "Unmatched", color: "#94A3B8", count: 1,  total: 0     },
];

const LEAKAGE_ALERTS = [
  { ref: "BKG-2026-00004", client: "TTSH", date: "14 Jun", crew: "Ravi Kumar", hoursAgo: 6.5, urgent: true },
  { ref: "BKG-2026-00007", client: "CGH",  date: "20 Jun", crew: "Ahmad",      hoursAgo: 2.1, urgent: false },
  { ref: "BKG-2026-00009", client: "Mount Alvernia", date: "20 Jun", crew: "Jason Teo", hoursAgo: 1.2, urgent: false },
];

const BANK_FEED = [
  { date: "21 Jun", description: "Payment from TTSH", amount: 850.00, type: "Credit" },
  { date: "20 Jun", description: "Payment from CGH",  amount: 1200.00, type: "Credit" },
  { date: "19 Jun", description: "Payment from SingHealth", amount: 2150.00, type: "Credit" },
];

function ARDashboard({ onViewBooking }: { onViewBooking: () => void }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFromFocused, setDateFromFocused] = useState(false);
  const [dateToFocused, setDateToFocused] = useState(false);
  const [pulling, setPulling] = useState(false);
  const leakageRef = React.useRef<HTMLDivElement>(null);

  const totalInvoiced = INVOICE_STATUS_BREAKDOWN.reduce((s, r) => s + r.total, 0);
  const totalSegments = INVOICE_STATUS_BREAKDOWN.reduce((s, r) => s + r.count, 0);

  function handlePull() {
    setPulling(true);
    setTimeout(() => setPulling(false), 1200);
  }

  function scrollToLeakage() {
    leakageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cardBase: React.CSSProperties = {
    background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "20px 24px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Date range + refresh */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: -8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} onFocus={() => setDateFromFocused(true)} onBlur={() => setDateFromFocused(false)}
              style={{ height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${dateFromFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: dateFrom ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
          </div>
          <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>to</span>
          <div style={{ position: "relative" }}>
            <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} onFocus={() => setDateToFocused(true)} onBlur={() => setDateToFocused(false)}
              style={{ height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${dateToFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: dateTo ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
          </div>
        </div>
        <button onClick={handlePull}
          style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "border-color 0.12s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
          <RefreshCw size={15} color="#64748B" style={{ animation: pulling ? "spin 0.8s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Row 1 — Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* Total Invoiced */}
        <div style={cardBase}>
          <p style={{ fontSize: 12, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Invoiced This Month</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>$18,350.00</span>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, background: "rgba(34,197,94,0.10)", color: "#22C55E", fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
            ↑ +12% vs last month
          </span>
        </div>

        {/* Synced to Xero */}
        <div style={cardBase}>
          <p style={{ fontSize: 12, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Synced to Xero</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#22C55E", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em", display: "block", marginBottom: 8 }}>14 invoices</span>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>This month · all successful</span>
        </div>

        {/* Revenue Leakage */}
        <div
          onClick={scrollToLeakage}
          style={{ ...cardBase, borderLeft: "3px solid #EF4444", cursor: "pointer", transition: "box-shadow 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(239,68,68,0.12)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"}>
          <p style={{ fontSize: 12, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenue Leakage Risk</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#EF4444", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>3 bookings</span>
            <AlertTriangle size={20} color="#EF4444" strokeWidth={2} />
          </div>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", marginBottom: 8, lineHeight: 1.5 }}>Completed jobs with no memo submitted.</p>
          <button onClick={(e) => { e.stopPropagation(); scrollToLeakage(); }}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#EF4444", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2 }}>
            View Alerts →
          </button>
        </div>
      </div>

      {/* Row 2 — Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 16 }}>

        {/* Invoice Status Breakdown */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Invoice Status</h2>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {/* Stacked bar */}
            <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 20, gap: 2 }}>
              {INVOICE_STATUS_BREAKDOWN.map((seg) => {
                const pct = (seg.count / totalSegments) * 100;
                return (
                  <div key={seg.status}
                    title={`${seg.status}: ${seg.count}`}
                    style={{ flex: pct, background: seg.color, minWidth: pct > 0 ? 4 : 0, transition: "flex 0.3s", borderRadius: 2, cursor: "default" }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
              {INVOICE_STATUS_BREAKDOWN.map((seg) => (
                <div key={seg.status} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: seg.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{seg.status}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{seg.count}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>
                    {seg.total > 0 ? `$${seg.total.toLocaleString("en-SG", { minimumFractionDigits: 2 })}` : "—"}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Total: <strong style={{ color: "#1E293B", fontSize: 15 }}>${totalInvoiced.toLocaleString("en-SG", { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        </div>

        {/* Revenue Leakage Alerts */}
        <div ref={leakageRef} style={{ ...cardBase, padding: 0, overflow: "hidden", borderLeft: "4px solid #EF4444" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} color="#EF4444" strokeWidth={2.5} />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>Jobs Without Memo</h2>
          </div>

          {LEAKAGE_ALERTS.length === 0 ? (
            <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color="#22C55E" strokeWidth={2.5} />
              <span style={{ fontSize: 14, color: "#22C55E", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>No revenue leakage detected ✓</span>
            </div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {LEAKAGE_ALERTS.map((alert, i) => (
                <div key={alert.ref} style={{ padding: "12px 20px", borderBottom: i < LEAKAGE_ALERTS.length - 1 ? "1px solid #FEF2F2" : "none", background: i % 2 === 0 ? "#FFFAFA" : "#FFFFFF" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{alert.ref}</span>
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>·</span>
                        <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{alert.client}</span>
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>·</span>
                        <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{alert.date}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{alert.crew}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: alert.urgent ? "#EF4444" : "#F59E0B", fontFamily: "'Inter', sans-serif" }}>
                          {alert.hoursAgo}h since completion
                        </span>
                      </div>
                    </div>
                    <button onClick={onViewBooking}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2, whiteSpace: "nowrap", flexShrink: 0 }}>
                      View Booking
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ padding: "10px 20px", borderTop: "1px solid #E2E8F0", textAlign: "right" }}>
                <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2 }}>
                  View All →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Xero Bank Feed */}
      <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>Xero Bank Feed</h2>
            <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Last synced: 22 Jun 2026, 10:30 AM</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2, padding: 0 }}>
              View Full Sync Log →
            </button>
            <button onClick={handlePull}
              style={{ height: 34, padding: "0 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6, transition: "border-color 0.12s" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
              <RefreshCw size={13} color="#64748B" style={{ animation: pulling ? "spin 0.8s linear infinite" : "none" }} />
              Pull Latest
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Date", "Description", "Amount", "Type"].map((col) => (
                  <th key={col} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BANK_FEED.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < BANK_FEED.length - 1 ? "1px solid #F1F5F9" : "none", height: 46, background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                  <td style={{ padding: "0 20px", fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.date}</td>
                  <td style={{ padding: "0 20px", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.description}</td>
                  <td style={{ padding: "0 20px", fontSize: 14, fontWeight: 600, color: "#22C55E", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>${row.amount.toFixed(2)}</td>
                  <td style={{ padding: "0 20px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 5, fontSize: 12, fontWeight: 500, background: "rgba(34,197,94,0.10)", color: "#22C55E", fontFamily: "'Inter', sans-serif" }}>
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ─── AR App Shell ─────────────────────────────────────────────────────────────

function ARApp({ onLogout }: { onLogout: () => void }) {
  const [activePage, setActivePage] = useState<ARPage>("pricing-contracts");
  const [contractView, setContractView] = useState<"list" | "detail" | "create">("list");
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [memoReviewView, setMemoReviewView] = useState<"queue" | "detail">("queue");
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [invoiceView, setInvoiceView] = useState<"list" | "detail">("list");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [batchApproveOpen, setBatchApproveOpen] = useState(false);
  const { toasts: arToasts, add: addARToast, dismiss: dismissARToast } = useToasts();

  const pageTitles: Record<ARPage, string> = {
    dashboard: "AR Dashboard",
    "memo-review": "Memo Review Queue",
    invoices: "Invoices",
    "pricing-contracts": "Pricing Contracts",
    "xero-sync": "Xero Sync",
  };

  const headerRight = activePage === "pricing-contracts" && contractView === "list" ? (
    <button onClick={() => setContractView("create")}
      style={{ height: 40, padding: "0 18px", borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.12s" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E293B")}>
      + New Contract
    </button>
  ) : activePage === "invoices" && invoiceView === "detail" ? null
  : activePage === "invoices" && invoiceView === "list" ? (
    <button onClick={() => setBatchApproveOpen(true)}
      style={{ height: 40, padding: "0 18px", borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.12s" }}
      onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"}
      onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"}>
      Batch Approve
    </button>
  ) : activePage === "memo-review" && memoReviewView === "detail" && selectedMemoId ? (
    <span style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
      {(() => {
        const m = MEMO_QUEUE.find((q) => q.id === selectedMemoId);
        return m ? `Booking: ${m.bookingRef} · ${m.client} · ${m.jobDate}` : "";
      })()}
    </span>
  ) : null;

  const headerLeft = (() => {
    if (activePage === "pricing-contracts" && contractView === "detail") {
      const contract = CONTRACTS.find((c) => c.id === selectedContractId);
      const shortName = contract?.name.split(" - ")[0] + " - " + contract?.name.split(" - ")[1]?.split(" ")[0] + (contract?.name.split(" - ")[1]?.split(" ")[1] ? " " + contract?.name.split(" - ")[1]?.split(" ")[1] : "");
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setContractView("list")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0, transition: "color 0.12s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
            <ArrowLeft size={16} /> Pricing Contracts
          </button>
          <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>
            {contract ? (contract.name.length > 30 ? contract.name.split(" - ").slice(0, 2).join(" - ") : contract.name) : "Contract Detail"}
          </h1>
          {contract && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif", background: contract.status === "Active" ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)", color: contract.status === "Active" ? "#22C55E" : "#64748B" }}>
              {contract.status === "Active" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />}
              {contract.status}
            </span>
          )}
        </div>
      );
    }
    if (activePage === "pricing-contracts" && contractView === "create") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setContractView("list")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0, transition: "color 0.12s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
            <ArrowLeft size={16} /> Pricing Contracts
          </button>
          <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>New Contract</h1>
        </div>
      );
    }
    if (activePage === "invoices" && invoiceView === "detail") {
      const inv = INVOICE_DATA.find((i) => i.id === selectedInvoiceId);
      const s: InvoiceStatus = (inv?.status ?? "Matched") as InvoiceStatus;
      const { bg, color } = INV_STATUS_STYLE[s] ?? { bg: "#F1F5F9", color: "#64748B" };
      return (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setInvoiceView("list")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0, transition: "color 0.12s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
              <ArrowLeft size={16} /> Invoices
            </button>
            <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>{selectedInvoiceId}</h1>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: bg, color, fontFamily: "'Inter', sans-serif" }}>{s}</span>
          </div>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", marginTop: 4 }}>
            Booking: {inv?.bookingRef} · {inv?.client} · 11 Jun 2026
          </p>
        </div>
      );
    }
    if (activePage === "memo-review" && memoReviewView === "detail") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setMemoReviewView("queue")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0, transition: "color 0.12s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
            <ArrowLeft size={16} /> Memo Review Queue
          </button>
          <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>{selectedMemoId}</h1>
        </div>
      );
    }
    return <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>{pageTitles[activePage]}</h1>;
  })();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter', sans-serif", background: "#F8FAFC" }}>
      <ARSidebar activePage={activePage} onNav={(p) => { setActivePage(p); setContractView("list"); setMemoReviewView("queue"); setInvoiceView("list"); }} onLogout={onLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 64, background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0 }}>
          {headerLeft}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {headerRight}
            <div style={{ position: "relative", lineHeight: 0 }}>
              <Bell size={20} color="#64748B" style={{ cursor: "pointer" }} />
              <span style={{ position: "absolute", top: -5, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#EF4444", color: "#FFFFFF", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>4</span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: contractView === "create" ? "hidden" : "auto", padding: 32, position: "relative", display: "flex", flexDirection: "column" }}>
          {activePage === "pricing-contracts" && contractView === "list" && (
            <PricingContractsList
              onView={(id) => { setSelectedContractId(id); setContractView("detail"); }}
              onNew={() => setContractView("create")}
            />
          )}
          {activePage === "pricing-contracts" && contractView === "detail" && selectedContractId && (
            <PricingContractDetail
              contract={CONTRACTS.find((c) => c.id === selectedContractId)!}
              onEdit={() => setContractView("create")}
              onBack={() => setContractView("list")}
            />
          )}
          {activePage === "pricing-contracts" && contractView === "create" && (
            <ContractForm
              editingContract={selectedContractId ? CONTRACTS.find((c) => c.id === selectedContractId) : undefined}
              onSave={(id) => { setSelectedContractId(id); setContractView("detail"); }}
              onCancel={() => setContractView(selectedContractId ? "detail" : "list")}
              addToast={addARToast}
            />
          )}
          {activePage === "memo-review" && memoReviewView === "queue" && (
            <MemoReviewQueue onReview={(id) => { setSelectedMemoId(id); setMemoReviewView("detail"); }} />
          )}
          {activePage === "memo-review" && memoReviewView === "detail" && selectedMemoId && (
            <MemoReviewDetail
              memoId={selectedMemoId}
              onApprove={() => {
                addARToast("success", "Invoice generated and ready for review.");
                setMemoReviewView("queue");
              }}
              onReturn={() => {
                addARToast("success", `Memo returned to crew with correction note.`);
                setMemoReviewView("queue");
              }}
            />
          )}
          {activePage === "invoices" && invoiceView === "list" && (
            <InvoiceList
              onView={(id) => { setSelectedInvoiceId(id); setInvoiceView("detail"); }}
              onBatchApprove={() => setBatchApproveOpen(true)}
            />
          )}
          {activePage === "invoices" && invoiceView === "detail" && selectedInvoiceId && (
            <InvoiceDetail
              invoiceId={selectedInvoiceId}
              onRejectMatch={() => { setInvoiceView("list"); setActivePage("memo-review"); setMemoReviewView("queue"); addARToast("success", "Invoice rejected. Memo returned to review queue."); }}
              addToast={addARToast}
            />
          )}
          {activePage === "xero-sync" && (
            <XeroSyncStatus onReconnect={() => setActivePage("pricing-contracts")} />
          )}
          {activePage === "dashboard" && (
            <ARDashboard onViewBooking={() => { /* cross-wave nav placeholder */ }} />
          )}
          {activePage !== "pricing-contracts" && activePage !== "memo-review" && activePage !== "invoices" && activePage !== "dashboard" && activePage !== "xero-sync" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", color: "#94A3B8", fontSize: 14 }}>{pageTitles[activePage]} — coming soon</div>
          )}
          {batchApproveOpen && (
            <BatchApproveModal
              onClose={() => setBatchApproveOpen(false)}
              onApprove={(ids) => {
                setBatchApproveOpen(false);
                addARToast("success", `${ids.length} invoice${ids.length !== 1 ? "s" : ""} approved.`);
              }}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={arToasts} dismiss={dismissARToast} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        select option { color: #1E293B; }
        textarea::placeholder, input::placeholder { color: #94A3B8; }
      `}</style>
    </div>
  );
}
export default ARApp;
