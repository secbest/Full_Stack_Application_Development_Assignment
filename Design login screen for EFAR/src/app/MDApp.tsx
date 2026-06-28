import React, { useState } from "react";
import {
  Bell, LayoutDashboard, FileBarChart, LogOut,
  AlertTriangle, CheckCircle2, RefreshCw, Calendar,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine, DotProps,
} from "recharts";
import { Download } from "lucide-react";
import { SidebarItem } from "./shared";

// ─── Types & Data ──────────────────────────────────────────────────────────────

type MDPage = "dashboard" | "reports";
type DashTab = "fleet" | "expense";
type DateFilter = "Today" | "This Week" | "This Month" | "Custom";

const BOOKING_DATA: Record<DateFilter, { label: string; value: number; color: string }[]> = {
  "Today": [
    { label: "Confirmed",   value: 5,  color: "#3B82F6" },
    { label: "In Progress", value: 2,  color: "#F59E0B" },
    { label: "Completed",   value: 4,  color: "#9333EA" },
    { label: "Invoiced",    value: 2,  color: "#22C55E" },
  ],
  "This Week": [
    { label: "Confirmed",   value: 18, color: "#3B82F6" },
    { label: "In Progress", value: 5,  color: "#F59E0B" },
    { label: "Completed",   value: 24, color: "#9333EA" },
    { label: "Invoiced",    value: 14, color: "#22C55E" },
  ],
  "This Month": [
    { label: "Confirmed",   value: 44, color: "#3B82F6" },
    { label: "In Progress", value: 8,  color: "#F59E0B" },
    { label: "Completed",   value: 62, color: "#9333EA" },
    { label: "Invoiced",    value: 41, color: "#22C55E" },
  ],
  "Custom": [
    { label: "Confirmed",   value: 12, color: "#3B82F6" },
    { label: "In Progress", value: 3,  color: "#F59E0B" },
    { label: "Completed",   value: 18, color: "#9333EA" },
    { label: "Invoiced",    value: 9,  color: "#22C55E" },
  ],
};

const LEAKAGE_ALERTS = [
  { ref: "BKG-004", client: "TTSH", crew: "Ravi Kumar", hoursAgo: 6.5, urgent: true  },
  { ref: "BKG-007", client: "CGH",  crew: "Ahmad",      hoursAgo: 2.1, urgent: false },
  { ref: "BKG-009", client: "Mount Alvernia", crew: "Jason Teo", hoursAgo: 1.2, urgent: false },
];

// ─── MD Sidebar ───────────────────────────────────────────────────────────────

function MDSidebar({ activePage, onNav, onLogout }: {
  activePage: MDPage;
  onNav: (p: MDPage) => void;
  onLogout: () => void;
}) {
  return (
    <aside style={{ width: 240, flexShrink: 0, background: "#1E293B", display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>EFAR</span>
      </div>
      <nav style={{ flex: 1, paddingTop: 12 }}>
        <SidebarItem icon={<LayoutDashboard size={16} />} label="Dashboard" active={activePage === "dashboard"} onClick={() => onNav("dashboard")} />
        <SidebarItem icon={<FileBarChart size={16} />} label="Reports" active={activePage === "reports"} onClick={() => onNav("reports")} />
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
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#0F172A", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#FFFFFF", flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>DT</div>
        <div style={{ overflow: "hidden" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Doris Tan</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Managing Director</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Custom Doughnut Label ────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[] }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div style={{ background: "#1E293B", color: "#FFFFFF", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: p.color, marginRight: 6 }} />
      {name}: <strong>{value}</strong>
    </div>
  );
}

// ─── Fleet Overview Tab ───────────────────────────────────────────────────────

function FleetOverview() {
  const [chartFilter, setChartFilter] = useState<DateFilter>("Today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const data = BOOKING_DATA[chartFilter];
  const total = data.reduce((s, d) => s + d.value, 0);

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  const cardBase: React.CSSProperties = {
    background: "#FFFFFF", borderRadius: 12,
    border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Date range + refresh — top right of content */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: -8 }}>
        {[
          { val: dateFrom, set: setDateFrom, focus: dfFocus, setFocus: setDfFocus },
          { val: dateTo,   set: setDateTo,   focus: dtFocus, setFocus: setDtFocus },
        ].map((f, i) => (
          <React.Fragment key={i}>
            {i === 1 && <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", alignSelf: "center" }}>to</span>}
            <div style={{ position: "relative" }}>
              <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
              <input type="date" value={f.val} onChange={(e) => f.set(e.target.value)}
                onFocus={() => f.setFocus(true)} onBlur={() => f.setFocus(false)}
                style={{ height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${f.focus ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: f.val ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
            </div>
          </React.Fragment>
        ))}
        <button onClick={refresh}
          style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
          <RefreshCw size={15} color="#64748B" style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Row 1: KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>

        {/* Total Bookings */}
        <div style={{ ...cardBase, padding: "20px 22px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Bookings Today</p>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1, display: "block", marginBottom: 8 }}>13</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>5 Confirmed · 2 In Progress · 4 Completed · 2 Invoiced</p>
        </div>

        {/* Active Jobs */}
        <div style={{ ...cardBase, padding: "20px 22px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Jobs (Now)</p>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#F59E0B", fontFamily: "'Inter', sans-serif", lineHeight: 1, display: "block", marginBottom: 8 }}>2</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Jobs currently In Progress.</p>
        </div>

        {/* Memos Pending */}
        <div style={{ ...cardBase, padding: "20px 22px", borderLeft: "3px solid #EF4444" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Memos Pending Submission</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#EF4444", fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>3</span>
            <AlertTriangle size={20} color="#EF4444" strokeWidth={2} />
          </div>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Revenue leakage risk.</p>
        </div>

        {/* Invoices Synced */}
        <div style={{ ...cardBase, padding: "20px 22px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Invoices Synced This Month</p>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#22C55E", fontFamily: "'Inter', sans-serif", lineHeight: 1, display: "block", marginBottom: 8 }}>14</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Successfully pushed to Xero.</p>
        </div>
      </div>

      {/* Row 2: Chart + Leakage */}
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%", gap: 16 }}>

        {/* Booking Status Distribution */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>Booking Status Distribution</h2>
            <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
              {chartFilter === "Today" ? "Today" : chartFilter === "This Week" ? "Last 7 days" : chartFilter === "This Month" ? "Last 30 days" : "Custom range"}
            </p>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {/* Doughnut chart */}
            <div style={{ height: 220, marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                  >
                    {data.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 20 }}>
              {data.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{d.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{d.value}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Date filter tabs */}
            <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 4 }}>
              {(["Today", "This Week", "This Month", "Custom"] as DateFilter[]).map((tab) => (
                <button key={tab} onClick={() => setChartFilter(tab)}
                  style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: chartFilter === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: chartFilter === tab ? "#FFFFFF" : "transparent", color: chartFilter === tab ? "#1E293B" : "#64748B", fontSize: 12, fontWeight: chartFilter === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.12s", whiteSpace: "nowrap" }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue Leakage Alerts */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden", borderLeft: "4px solid #EF4444" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} color="#EF4444" strokeWidth={2.5} />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>Jobs Without Memo</h2>
          </div>

          {LEAKAGE_ALERTS.length === 0 ? (
            <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color="#22C55E" strokeWidth={2.5} />
              <span style={{ fontSize: 14, color: "#22C55E", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>All completed jobs have memos ✓</span>
            </div>
          ) : (
            <>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {LEAKAGE_ALERTS.map((a, i) => (
                  <div key={a.ref} style={{ padding: "12px 20px", borderBottom: i < LEAKAGE_ALERTS.length - 1 ? "1px solid #FEF2F2" : "none", background: i % 2 === 0 ? "#FFFAFA" : "#FFFFFF" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{a.ref}</span>
                          <span style={{ fontSize: 12, color: "#94A3B8" }}>·</span>
                          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{a.client}</span>
                          <span style={{ fontSize: 12, color: "#94A3B8" }}>·</span>
                          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{a.crew}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: a.urgent ? "#EF4444" : "#F59E0B", fontFamily: "'Inter', sans-serif" }}>
                          {a.hoursAgo}h {a.urgent ? "overdue" : "since completion"}
                        </span>
                      </div>
                      <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2, whiteSpace: "nowrap", flexShrink: 0 }}>
                        View Booking →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", background: "#FAFAFA" }}>
                <p style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                  Source: booking data. Doris has read-only access.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Expense Summary Tab ─────────────────────────────────────────────────────

const VENDOR_BARS = [
  { vendor: "Fuels Direct",       short: "Fuels Direct",  amount: 18320, opacity: 1.0  },
  { vendor: "AutoRepair SG",      short: "AutoRepair SG", amount: 7850,  opacity: 0.70 },
  { vendor: "Medical Supplies Co",short: "Med Supplies",  amount: 3780,  opacity: 0.50 },
  { vendor: "Others",             short: "Others",        amount: 1290,  opacity: 0.30 },
];

const VENDOR_INVOICES: Record<string, { invNo: string; date: string; amount: number; rebate: number }[]> = {
  "Fuels Direct": [
    { invNo: "FD-2026-0421", date: "18 Jun", amount: 4320, rebate: 43.20 },
    { invNo: "FD-2026-0410", date: "2 Jun",  amount: 3900, rebate: 39.00 },
    { invNo: "FD-2026-0401", date: "15 May", amount: 4100, rebate: 41.00 },
    { invNo: "FD-2026-0388", date: "1 May",  amount: 6000, rebate: 60.00 },
  ],
  "AutoRepair SG": [
    { invNo: "AR-2026-099",  date: "15 Jun", amount: 1850, rebate: 18.50 },
    { invNo: "AR-2026-088",  date: "2 Jun",  amount: 6000, rebate: 60.00 },
  ],
  "Medical Supplies Co": [
    { invNo: "MSC-0388", date: "10 Jun", amount: 780,  rebate: 7.80 },
    { invNo: "MSC-0374", date: "1 Jun",  amount: 3000, rebate: 30.00 },
  ],
  "Others": [
    { invNo: "OTH-0041", date: "18 Jun", amount: 1290, rebate: 12.90 },
  ],
};

const MONTHLY_SPEND = [
  { month: "Jan", amount: 18200 },
  { month: "Feb", amount: 21400 },
  { month: "Mar", amount: 19800 },
  { month: "Apr", amount: 23100 },
  { month: "May", amount: 26500 },
  { month: "Jun", amount: 31240 },
  { month: "Jul", amount: null  },
  { month: "Aug", amount: null  },
  { month: "Sep", amount: null  },
  { month: "Oct", amount: null  },
  { month: "Nov", amount: null  },
  { month: "Dec", amount: null  },
];

const CURRENT_MONTH = "Jun";

function CustomBarTooltip({ active, payload }: { active?: boolean; payload?: { payload: { vendor: string; amount: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { vendor, amount } = payload[0].payload;
  return (
    <div style={{ background: "#1E293B", color: "#FFFFFF", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{vendor}</p>
      <p>${amount.toLocaleString("en-SG")}</p>
    </div>
  );
}

function CustomLineTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length || payload[0]?.value == null) return null;
  return (
    <div style={{ background: "#1E293B", color: "#FFFFFF", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label} 2026</p>
      <p>${payload[0].value.toLocaleString("en-SG")}</p>
    </div>
  );
}

function ExpenseSummary() {
  const [selectedVendor, setSelectedVendor] = useState("Fuels Direct");
  const [vendorFilter, setVendorFilter] = useState("All Vendors");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);
  const [activeBarIdx, setActiveBarIdx] = useState(0);

  const invoices = VENDOR_INVOICES[selectedVendor] ?? [];
  const cardBase: React.CSSProperties = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };

  const splitData = MONTHLY_SPEND.map((d) => ({
    month: d.month,
    actual: d.amount != null ? d.amount : undefined,
    forecast: d.amount == null ? 30000 : undefined,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Row 1: KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Vendor Expenditure</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1, display: "block", marginBottom: 6 }}>$31,240.00</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Across 4 active vendors this month.</p>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Rebates Applied</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#22C55E", fontFamily: "'Inter', sans-serif", lineHeight: 1, display: "block", marginBottom: 6 }}>$312.40</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>1% rebate across 4 vendors.</p>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Net Payable After Rebates</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", lineHeight: 1, display: "block", marginBottom: 6 }}>$30,927.60</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Verified and approved for payment.</p>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
            style={{ height: 38, paddingLeft: 12, paddingRight: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" }}>
            <option>All Vendors</option>
            {VENDOR_BARS.map((v) => <option key={v.vendor}>{v.vendor}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9" /></svg>
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
                  style={{ height: 38, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${f.focus ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: f.val ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
              </div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6, transition: "border-color 0.12s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>

      {/* Row 2: Bar chart + Invoice list */}
      <div style={{ display: "grid", gridTemplateColumns: "55% 45%", gap: 16 }}>

        {/* Expenditure by Vendor */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Vendor Breakdown</h2>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={VENDOR_BARS} margin={{ top: 4, right: 4, bottom: 4, left: 8 }}
                  onClick={(d) => { if (d?.activePayload?.[0]) { const idx = VENDOR_BARS.findIndex((v) => v.vendor === d.activePayload![0].payload.vendor); setActiveBarIdx(idx); setSelectedVendor(d.activePayload![0].payload.vendor); } }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="short" tick={{ fontSize: 12, fontFamily: "'Inter', sans-serif", fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fontFamily: "'Inter', sans-serif", fill: "#94A3B8" }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(30,41,59,0.04)" }} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} cursor="pointer">
                    {VENDOR_BARS.map((entry, i) => (
                      <Cell key={entry.vendor}
                        fill={`rgba(30,41,59,${i === activeBarIdx ? 1 : entry.opacity})`}
                        stroke={i === activeBarIdx ? "#1E293B" : "none"}
                        strokeWidth={i === activeBarIdx ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginTop: 8, textAlign: "center" }}>Click a bar to see invoices for that vendor</p>
          </div>
        </div>

        {/* Vendor Invoice List */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>
              {selectedVendor} — Invoices
            </h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  {["Invoice No.", "Date", "Amount", "Rebate", "Net", "Status"].map((col) => (
                    <th key={col} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.invNo} style={{ borderBottom: i < invoices.length - 1 ? "1px solid #F1F5F9" : "none", height: 44, background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                    <td style={{ padding: "0 14px", fontSize: 12, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{inv.invNo}</td>
                    <td style={{ padding: "0 14px", fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{inv.date}</td>
                    <td style={{ padding: "0 14px", fontSize: 12, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>${inv.amount.toLocaleString()}</td>
                    <td style={{ padding: "0 14px", fontSize: 12, color: "#22C55E", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>${inv.rebate.toFixed(2)}</td>
                    <td style={{ padding: "0 14px", fontSize: 12, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>${(inv.amount - inv.rebate).toFixed(2)}</td>
                    <td style={{ padding: "0 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "rgba(34,197,94,0.10)", color: "#22C55E", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                        <CheckCircle2 size={10} strokeWidth={2.5} /> Synced
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0" }}>
            <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2, display: "block", marginBottom: 6 }}>
              View All Invoices →
            </button>
            <p style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>
              Doris has read-only access. AP actions require Chloe's login.
            </p>
          </div>
        </div>
      </div>

      {/* Row 3: Spend Trend Line Chart */}
      <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Vendor Spend by Month — FY2026</h2>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={splitData} margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: "'Inter', sans-serif", fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fontFamily: "'Inter', sans-serif", fill: "#94A3B8" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<CustomLineTooltip />} />
                <ReferenceLine x={CURRENT_MONTH} stroke="#E2E8F0" strokeDasharray="4 2" label={{ value: "Now", position: "top", fontSize: 11, fill: "#94A3B8", fontFamily: "'Inter', sans-serif" }} />
                {/* Solid line for actual months */}
                <Line
                  dataKey="actual"
                  stroke="#1E293B"
                  strokeWidth={2.5}
                  dot={(props: DotProps & { cx?: number; cy?: number; payload?: { month: string } }) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null) return <g key={`dot-a-empty`} />;
                    const isCurrent = payload?.month === CURRENT_MONTH;
                    return (
                      <circle key={`dot-a-${cx}`} cx={cx} cy={cy} r={isCurrent ? 5 : 3.5}
                        fill={isCurrent ? "#1E293B" : "#FFFFFF"} stroke="#1E293B" strokeWidth={2} />
                    );
                  }}
                  connectNulls={false}
                  name="Actual"
                />
                {/* Dashed line for forecast months */}
                <Line
                  dataKey="forecast"
                  stroke="#CBD5E1"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls={false}
                  name="Forecast"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 20, height: 2.5, background: "#1E293B", borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Actual spend</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 20, height: 2, background: "#CBD5E1", borderRadius: 2, borderTop: "2px dashed #CBD5E1", boxSizing: "border-box" }} />
              <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Forecast</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // keep placeholder fallback to satisfy linter — unreachable
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>
      Expense Summary — coming soon
    </div>
  );
}

// ─── MD App ───────────────────────────────────────────────────────────────────

// ─── Reports Screen ───────────────────────────────────────────────────────────

type ReportTab = "revenue" | "billing" | "leakage" | "vendor";
type Period = "This Month" | "Last Month" | "This Quarter" | "This Year" | "Custom";

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "billing", label: "Billing Cycle" },
  { id: "leakage", label: "Leakage History" },
  { id: "vendor",  label: "Vendor Expenditure" },
];

const CLIENT_BARS = [
  { client: "Tan Tock Seng Hospital", short: "TTSH",    amount: 22400, opacity: 1.0 },
  { client: "Changi General Hospital",short: "CGH",     amount: 18350, opacity: 0.8 },
  { client: "ABC Corporation",        short: "ABC Corp", amount: 9100,  opacity: 0.6 },
  { client: "SingHealth Group",       short: "SingHealth",amount: 4360, opacity: 0.4 },
];

const SERVICE_DONUT = [
  { label: "EAS",               value: 38940, color: "#1E293B" },
  { label: "MTS",               value: 10820, color: "#3B82F6" },
  { label: "Event Standby",     value: 3100,  color: "#F59E0B" },
  { label: "Workplace Standby", value: 1350,  color: "#22C55E" },
];

const REPORT_INVOICES = [
  { id: "INV-004", bkg: "BKG-004", client: "TTSH",    svc: "MTS", amount: 1200.00, syncedAt: "14 Jun 2026" },
  { id: "INV-003", bkg: "BKG-003", client: "TTSH",    svc: "EAS", amount: 1570.00, syncedAt: "13 Jun 2026" },
  { id: "INV-001", bkg: "BKG-001", client: "TTSH",    svc: "EAS", amount: 850.00,  syncedAt: "10 Jun 2026" },
  { id: "INV-009", bkg: "BKG-009", client: "CGH",     svc: "EAS", amount: 2100.00, syncedAt: "9 Jun 2026"  },
  { id: "INV-010", bkg: "BKG-010", client: "CGH",     svc: "MTS", amount: 980.00,  syncedAt: "8 Jun 2026"  },
  { id: "INV-011", bkg: "BKG-011", client: "ABC Corp", svc: "EAS", amount: 3100.00, syncedAt: "7 Jun 2026"  },
  { id: "INV-012", bkg: "BKG-012", client: "ABC Corp", svc: "Workplace Standby", amount: 1350.00, syncedAt: "5 Jun 2026" },
  { id: "INV-013", bkg: "BKG-013", client: "SingHealth", svc: "EAS", amount: 2180.00, syncedAt: "3 Jun 2026" },
  { id: "INV-014", bkg: "BKG-014", client: "SingHealth", svc: "MTS", amount: 2180.00, syncedAt: "2 Jun 2026" },
  { id: "INV-015", bkg: "BKG-015", client: "TTSH",    svc: "Event Standby", amount: 3100.00, syncedAt: "1 Jun 2026" },
];

const BILLING_ROWS = [
  { bkg: "BKG-008", jobDate: "5 Jul 2026",  memoAt: "5 Jul 2026",  invAt: "6 Jul 2026",  syncAt: "6 Jul 2026",  days: 1 },
  { bkg: "BKG-007", jobDate: "3 Jul 2026",  memoAt: "3 Jul 2026",  invAt: "4 Jul 2026",  syncAt: "4 Jul 2026",  days: 1 },
  { bkg: "BKG-006", jobDate: "2 Jul 2026",  memoAt: "3 Jul 2026",  invAt: "4 Jul 2026",  syncAt: "5 Jul 2026",  days: 3 },
  { bkg: "BKG-005", jobDate: "1 Jul 2026",  memoAt: "4 Jul 2026",  invAt: "5 Jul 2026",  syncAt: "6 Jul 2026",  days: 5 },
  { bkg: "BKG-004", jobDate: "14 Jun 2026", memoAt: "14 Jun 2026", invAt: "15 Jun 2026", syncAt: "15 Jun 2026", days: 1 },
];

const LEAKAGE_ROWS = [
  { bkg: "BKG-004", client: "TTSH",          completedAt: "14 Jun 2026", daysUntilMemo: 0.4, crew: "—",           resolution: "Memo Submitted" as const },
  { bkg: "BKG-007", client: "CGH",           completedAt: "20 Jun 2026", daysUntilMemo: 2.1, crew: "Ahmad",       resolution: "Memo Submitted" as const },
  { bkg: "BKG-009", client: "Mount Alvernia",completedAt: "20 Jun 2026", daysUntilMemo: 4.3, crew: "Jason Teo",   resolution: "Still Missing"  as const },
  { bkg: "BKG-011", client: "TTSH",          completedAt: "25 Jun 2026", daysUntilMemo: 1.2, crew: "Ravi Kumar",  resolution: "Dismissed"      as const },
];

function PeriodBar({ period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo }: {
  period: Period; setPeriod: (p: Period) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
}) {
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 16px", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>Period:</span>
      <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
        {(["This Month", "Last Month", "This Quarter", "This Year", "Custom"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: "5px 11px", borderRadius: 6, border: period === p ? "1px solid #E2E8F0" : "1px solid transparent", background: period === p ? "#FFFFFF" : "transparent", color: period === p ? "#1E293B" : "#64748B", fontSize: 12, fontWeight: period === p ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "all 0.12s" }}>
            {p}
          </button>
        ))}
      </div>
      {period === "Custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[
            { val: dateFrom, set: setDateFrom, focus: dfFocus, setFocus: setDfFocus },
            { val: dateTo,   set: setDateTo,   focus: dtFocus, setFocus: setDtFocus },
          ].map((f, i) => (
            <React.Fragment key={i}>
              {i === 1 && <span style={{ fontSize: 12, color: "#94A3B8" }}>to</span>}
              <div style={{ position: "relative" }}>
                <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                <input type="date" value={f.val} onChange={(e) => f.set(e.target.value)} onFocus={() => f.setFocus(true)} onBlur={() => f.setFocus(false)}
                  style={{ height: 34, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${f.focus ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: f.val ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 128, boxSizing: "border-box" }} />
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
          <Download size={13} /> Export CSV
        </button>
        <button style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6, transition: "background 0.12s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"}>
          <Download size={13} /> Export PDF
        </button>
      </div>
    </div>
  );
}

function ReportRevenue() {
  const [activeClientIdx, setActiveClientIdx] = useState<number | null>(null);
  const [invPage, setInvPage] = useState(1);
  const PER_PAGE = 10;
  const totalRevenue = SERVICE_DONUT.reduce((s, d) => s + d.value, 0);

  const filteredInvoices = activeClientIdx !== null
    ? REPORT_INVOICES.filter((inv) => inv.client === CLIENT_BARS[activeClientIdx].short || CLIENT_BARS[activeClientIdx].short === "TTSH" && inv.client === "TTSH")
    : REPORT_INVOICES;

  const cardBase: React.CSSProperties = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const thS: React.CSSProperties = { padding: "11px 16px", textAlign: "left" as const, fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.05em", whiteSpace: "nowrap" as const, fontFamily: "'Inter', sans-serif" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Row 1: KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Revenue (This Quarter)</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 4 }}>$54,210.00</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", marginBottom: 6 }}>Across 38 invoices.</p>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 5, background: "rgba(34,197,94,0.10)", color: "#22C55E", fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>↑ +8% vs last quarter</span>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Average Invoice Value</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 4 }}>$1,426.58</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Based on synced invoices only.</p>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Largest Client This Period</p>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 4, lineHeight: 1.2 }}>Tan Tock Seng Hospital</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>$22,400.00 · 14 invoices</p>
        </div>
      </div>

      {/* Row 2: Bar + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 16 }}>

        {/* Revenue by Client */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Revenue by Client</h2>
            {activeClientIdx !== null && (
              <button onClick={() => setActiveClientIdx(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", textDecoration: "underline" }}>
                Clear filter
              </button>
            )}
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CLIENT_BARS} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                  onClick={(d) => {
                    if (d?.activePayload?.[0]) {
                      const idx = CLIENT_BARS.findIndex((c) => c.client === d.activePayload![0].payload.client);
                      setActiveClientIdx(activeClientIdx === idx ? null : idx);
                    }
                  }}>
                  <CartesianGrid horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fontFamily: "'Inter', sans-serif", fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="short" width={80} tick={{ fontSize: 12, fontFamily: "'Inter', sans-serif", fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ background: "#1E293B", border: "none", borderRadius: 8, color: "#FFF", fontSize: 13, fontFamily: "'Inter', sans-serif" }} />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]} cursor="pointer">
                    {CLIENT_BARS.map((entry, i) => {
                      const isActive = activeClientIdx === i;
                      const isDimmed = activeClientIdx !== null && !isActive;
                      return <Cell key={entry.client} fill={`rgba(30,41,59,${isDimmed ? 0.2 : isActive ? 1 : entry.opacity})`} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginTop: 6, textAlign: "center" }}>Click a bar to filter the invoice table below</p>
          </div>
        </div>

        {/* Revenue by Service Type */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Revenue by Service Type</h2>
          </div>
          <div style={{ padding: "16px 24px" }}>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={SERVICE_DONUT} cx="50%" cy="50%" innerRadius={55} outerRadius={84} paddingAngle={3} dataKey="value" nameKey="label">
                    {SERVICE_DONUT.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, ""]} contentStyle={{ background: "#1E293B", border: "none", borderRadius: 8, color: "#FFF", fontSize: 13, fontFamily: "'Inter', sans-serif" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {SERVICE_DONUT.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{d.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>${d.value.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{Math.round((d.value / totalRevenue) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Invoice Breakdown table */}
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Invoice Breakdown</h2>
          <span style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", fontFamily: "'Inter', sans-serif" }}>Read-only. Invoice actions require Sarah's login.</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Invoice ID", "Booking Ref", "Client", "Service Type", "Total Amount", "Status", "Synced At"].map((col) => (
                  <th key={col} style={thS}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.slice((invPage - 1) * PER_PAGE, invPage * PER_PAGE).map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < Math.min(filteredInvoices.length, PER_PAGE) - 1 ? "1px solid #F1F5F9" : "none", height: 48, background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                  <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{inv.id}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{inv.bkg}</td>
                  <td style={{ padding: "0 16px", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{inv.client}</td>
                  <td style={{ padding: "0 16px", fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{inv.svc}</td>
                  <td style={{ padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>${inv.amount.toFixed(2)}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "rgba(34,197,94,0.12)", color: "#22C55E", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                      <CheckCircle2 size={11} strokeWidth={2.5} /> Synced ✓
                    </span>
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{inv.syncedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
            Showing {Math.min((invPage - 1) * PER_PAGE + 1, filteredInvoices.length)}–{Math.min(invPage * PER_PAGE, filteredInvoices.length)} of 38 invoices · <strong>Total: $54,210.00</strong>
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button disabled={invPage === 1} onClick={() => setInvPage((p) => p - 1)}
              style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: invPage === 1 ? "not-allowed" : "pointer", opacity: invPage === 1 ? 0.4 : 1 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #1E293B", background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "#FFF", fontFamily: "'Inter', sans-serif" }}>{invPage}</span>
            </button>
            <button style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setInvPage((p) => p + 1)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportBillingCycle() {
  const cardBase: React.CSSProperties = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardBase, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <div>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Average Billing Cycle</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>1.8 days</span>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>Average days from job completion to Xero sync this quarter. Rows marked in amber exceeded 3 days.</p>
      </div>
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Booking Ref", "Job Date", "Memo Submitted", "Invoice Approved", "Synced At", "Total Days"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left" as const, fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" as const }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BILLING_ROWS.map((row, i) => {
              const isLate = row.days > 3;
              const bg = isLate ? "rgba(245,158,11,0.07)" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
              return (
                <tr key={row.bkg} style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: bg }}>
                  <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.bkg}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const }}>{row.jobDate}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const }}>{row.memoAt}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const }}>{row.invAt}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const }}>{row.syncAt}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isLate ? "#F59E0B" : "#22C55E", fontFamily: "'Inter', sans-serif" }}>{row.days}d</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportLeakage() {
  const cardBase: React.CSSProperties = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const resStyle = (r: string) => r === "Memo Submitted" ? { bg: "rgba(34,197,94,0.10)", color: "#22C55E" } : r === "Dismissed" ? { bg: "rgba(100,116,139,0.10)", color: "#64748B" } : { bg: "rgba(239,68,68,0.10)", color: "#EF4444" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardBase, padding: "18px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <AlertTriangle size={22} color="#EF4444" strokeWidth={2} />
        <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
          <strong style={{ color: "#1E293B" }}>This quarter: 3 jobs billed late, 1 job never billed.</strong> Late rows are amber-tinted; missing rows are red-tinted.
        </p>
      </div>
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Booking Ref", "Client", "Completion Date", "Days Until Memo", "Crew Member", "Resolution"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left" as const, fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" as const }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEAKAGE_ROWS.map((row, i) => {
              const isMissing = row.resolution === "Still Missing";
              const isLate = row.daysUntilMemo >= 2;
              const bg = isMissing ? "#FEF2F2" : isLate ? "rgba(245,158,11,0.06)" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
              const { bg: rBg, color: rColor } = resStyle(row.resolution);
              return (
                <tr key={row.bkg} style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: bg }}>
                  <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.bkg}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.client}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" as const }}>{row.completedAt}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.daysUntilMemo >= 3 ? "#EF4444" : row.daysUntilMemo >= 1.5 ? "#F59E0B" : "#22C55E", fontFamily: "'Inter', sans-serif" }}>{row.daysUntilMemo}d</span>
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.crew}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: rBg, color: rColor, fontFamily: "'Inter', sans-serif', whiteSpace: 'nowrap" }}>{row.resolution}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsScreen() {
  const [reportTab, setReportTab] = useState<ReportTab>("revenue");
  const [period, setPeriod] = useState<Period>("This Quarter");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Report type tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E2E8F0", marginBottom: 20 }}>
        {REPORT_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setReportTab(tab.id)}
            style={{ padding: "12px 20px", background: "none", border: "none", borderBottom: reportTab === tab.id ? "2px solid #1E293B" : "2px solid transparent", color: reportTab === tab.id ? "#1E293B" : "#64748B", fontSize: 14, fontWeight: reportTab === tab.id ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", marginBottom: -1, transition: "color 0.12s", whiteSpace: "nowrap" }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period bar */}
      <PeriodBar period={period} setPeriod={setPeriod} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />

      {/* Tab content */}
      {reportTab === "revenue" && <ReportRevenue />}
      {reportTab === "billing" && <ReportBillingCycle />}
      {reportTab === "leakage" && <ReportLeakage />}
      {reportTab === "vendor" && <ExpenseSummary />}
    </div>
  );
}

export default function MDApp({ onLogout }: { onLogout: () => void }) {
  const [activePage, setActivePage] = useState<MDPage>("dashboard");
  const [activeTab, setActiveTab] = useState<DashTab>("fleet");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter', sans-serif", background: "#F8FAFC" }}>
      <MDSidebar activePage={activePage} onNav={setActivePage} onLogout={onLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top header */}
        <header style={{ height: 64, background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>
            {activePage === "dashboard" ? "Executive Dashboard" : "Reports"}
          </h1>
          <div style={{ position: "relative", lineHeight: 0 }}>
            <Bell size={20} color="#64748B" style={{ cursor: "pointer" }} />
          </div>
        </header>

        {/* Secondary tab bar — always visible on dashboard */}
        {activePage === "dashboard" && (
          <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "0 32px", display: "flex", gap: 0, flexShrink: 0 }}>
            {([
              { id: "fleet",   label: "Fleet Overview"  },
              { id: "expense", label: "Expense Summary"  },
            ] as { id: DashTab; label: string }[]).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "12px 20px",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid #1E293B" : "2px solid transparent",
                  color: activeTab === tab.id ? "#1E293B" : "#64748B",
                  fontSize: 14,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  marginBottom: -1,
                  transition: "color 0.12s",
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {activePage === "dashboard" && activeTab === "fleet"   && <FleetOverview />}
          {activePage === "dashboard" && activeTab === "expense" && <ExpenseSummary />}
          {activePage === "reports" && <ReportsScreen />}
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
      `}</style>
    </div>
  );
}
