import React, { useState } from 'react';
import { Calendar, Download, CheckCircle2, AlertTriangle, XCircle, FileBarChart } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const REPORT_TABS = [
  { id: "revenue", label: "Revenue" },
  { id: "billing", label: "Billing Cycle" },
  { id: "leakage", label: "Leakage History" },
  { id: "vendor",  label: "Vendor Expenditure" },
];

const CLIENT_BARS = [
  { client: "Tan Tock Seng Hospital", short: "TTSH",      amount: 22400, opacity: 1.0 },
  { client: "Changi General Hospital",short: "CGH",       amount: 18350, opacity: 0.8 },
  { client: "ABC Corporation",        short: "ABC Corp",  amount: 9100,  opacity: 0.6 },
  { client: "SingHealth Group",       short: "SingHealth",amount: 4360,  opacity: 0.4 },
];

const SERVICE_DONUT = [
  { label: "Emergency Ambulance Services (EAS)", value: 38940, color: "#1E293B" },
  { label: "Medical Transport Service (MTS)",    value: 10820, color: "#3B82F6" },
  { label: "Event Standby",                      value: 3100,  color: "#F59E0B" },
  { label: "Workplace Standby",                  value: 1350,  color: "#22C55E" },
];

const REPORT_INVOICES = [
  { id: "INV-004", bkg: "BKG-004", client: "TTSH",    svc: "Medical Transport Service", amount: 1200.00, syncedAt: "14 Jun 2026" },
  { id: "INV-003", bkg: "BKG-003", client: "TTSH",    svc: "Emergency Ambulance Services", amount: 1570.00, syncedAt: "13 Jun 2026" },
  { id: "INV-001", bkg: "BKG-001", client: "TTSH",    svc: "Emergency Ambulance Services", amount: 850.00,  syncedAt: "10 Jun 2026" },
  { id: "INV-009", bkg: "BKG-009", client: "CGH",     svc: "Emergency Ambulance Services", amount: 2100.00, syncedAt: "9 Jun 2026"  },
  { id: "INV-010", bkg: "BKG-010", client: "CGH",     svc: "Medical Transport Service", amount: 980.00,  syncedAt: "8 Jun 2026"  },
  { id: "INV-011", bkg: "BKG-011", client: "ABC Corp", svc: "Emergency Ambulance Services", amount: 3100.00, syncedAt: "7 Jun 2026"  },
  { id: "INV-012", bkg: "BKG-012", client: "ABC Corp", svc: "Workplace Standby", amount: 1350.00, syncedAt: "5 Jun 2026" },
  { id: "INV-013", bkg: "BKG-013", client: "SingHealth", svc: "Emergency Ambulance Services", amount: 2180.00, syncedAt: "3 Jun 2026" },
  { id: "INV-014", bkg: "BKG-014", client: "SingHealth", svc: "Medical Transport Service", amount: 2180.00, syncedAt: "2 Jun 2026" },
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
  { bkg: "BKG-004", client: "TTSH",          completedAt: "14 Jun 2026", daysUntilMemo: 0.4, crew: "—",          resolution: "Memo Submitted" },
  { bkg: "BKG-007", client: "CGH",           completedAt: "20 Jun 2026", daysUntilMemo: 2.1, crew: "Ahmad",      resolution: "Memo Submitted" },
  { bkg: "BKG-009", client: "Mount Alvernia",completedAt: "20 Jun 2026", daysUntilMemo: 4.3, crew: "Jason Teo",  resolution: "Still Missing" },
  { bkg: "BKG-011", client: "TTSH",          completedAt: "25 Jun 2026", daysUntilMemo: 1.2, crew: "Ravi Kumar", resolution: "Dismissed" },
];

// Billing status badge: derived from the leak's resolution/days, distinct from the
// per-row "Resolution" column (what happened to the leak) below.
const BILLING_STATUS_CONFIG = {
  missing:  { label: "Missing", bg: "rgba(239,68,68,0.15)",  color: "#991B1B", Icon: XCircle },
  late:     { label: "Late",    bg: "rgba(245,158,11,0.15)", color: "#92400E", Icon: AlertTriangle },
  on_time:  { label: "On Time", bg: "rgba(34,197,94,0.15)",  color: "#166534", Icon: null },
};

function getBillingStatus(row) {
  if (row.resolution === "Still Missing") return "missing";
  if (row.daysUntilMemo >= 2) return "late";
  return "on_time";
}

function BillingStatusBadge({ status }) {
  const { label, bg, color, Icon } = BILLING_STATUS_CONFIG[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: bg, color, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {label}
    </span>
  );
}

function getReportTableData(reportTab) {
  if (reportTab === "revenue") {
    return {
      title: "Revenue Report",
      headers: ["Invoice ID", "Booking Ref", "Client", "Service Type", "Total Amount", "Status", "Synced At"],
      rows: REPORT_INVOICES.map((inv) => [inv.id, inv.bkg, inv.client, inv.svc, `$${inv.amount.toFixed(2)}`, "Synced", inv.syncedAt]),
    };
  }
  if (reportTab === "billing") {
    return {
      title: "Billing Cycle Report",
      headers: ["Booking Ref", "Job Date", "Memo Submitted", "Invoice Approved", "Synced At", "Total Days"],
      rows: BILLING_ROWS.map((r) => [r.bkg, r.jobDate, r.memoAt, r.invAt, r.syncAt, `${r.days}d`]),
    };
  }
  if (reportTab === "leakage") {
    return {
      title: "Leakage History Report",
      headers: ["Booking Ref", "Client", "Completion Date", "Days Until Memo", "Billing Status", "Crew Member", "Resolution"],
      rows: LEAKAGE_ROWS.map((r) => [r.bkg, r.client, r.completedAt, `${r.daysUntilMemo}d`, BILLING_STATUS_CONFIG[getBillingStatus(r)].label, r.crew, r.resolution]),
    };
  }
  return null;
}

function escapeCsvCell(val) {
  const str = String(val ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function escapeHtml(val) {
  return String(val ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function exportReportCSV(reportTab, period) {
  const data = getReportTableData(reportTab);
  if (!data) {
    alert("No data available to export for this report yet.");
    return;
  }
  const lines = [data.headers.map(escapeCsvCell).join(","), ...data.rows.map((row) => row.map(escapeCsvCell).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.title.replace(/\s+/g, "_")}_${period.replace(/\s+/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportReportPDF(reportTab, period) {
  const data = getReportTableData(reportTab);
  if (!data) {
    alert("No data available to export for this report yet.");
    return;
  }
  const headerHtml = data.headers.map((h) => `<th style="padding:6px 10px;border:1px solid #E2E8F0;background:#F1F5F9;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B;">${escapeHtml(h)}</th>`).join("");
  const rowsHtml = data.rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:6px 10px;border:1px solid #E2E8F0;font-size:12px;color:#1E293B;">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html><head><title>${escapeHtml(data.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #1E293B; padding: 24px; margin: 0; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p.meta { font-size: 12px; color: #64748B; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; }
      @media print { body { padding: 12px; } }
    </style></head>
    <body>
      <h1>EFAR - ${escapeHtml(data.title)}</h1>
      <p class="meta">Period: ${escapeHtml(period)}</p>
      <table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
      <script>window.onload = function () { window.print(); };</script>
    </body></html>`;

  try {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    if (!printWindow) {
      URL.revokeObjectURL(url);
      alert("Your browser blocked the PDF preview pop-up. Please allow pop-ups for this site and try again.");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    console.error("Export PDF failed:", err);
    alert("Could not open the PDF preview. Check the browser console for details.");
  }
}

function PeriodBar({ period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo, reportTab }) {
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);
  const exportDisabled = !getReportTableData(reportTab);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 16px", flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>Period:</span>
      <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
        {["This Month", "Last Month", "This Quarter", "This Year", "Custom"].map((p) => (
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
        <button disabled={exportDisabled} onClick={() => exportReportCSV(reportTab, period)}
          style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#1E293B", fontSize: 13, fontWeight: 500, cursor: exportDisabled ? "not-allowed" : "pointer", opacity: exportDisabled ? 0.5 : 1, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
          onMouseEnter={(e) => { if (!exportDisabled) e.currentTarget.style.borderColor = "#1E293B"; }}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E2E8F0"}>
          <Download size={13} /> Export CSV
        </button>
        <button disabled={exportDisabled} onClick={() => exportReportPDF(reportTab, period)}
          style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: exportDisabled ? "not-allowed" : "pointer", opacity: exportDisabled ? 0.5 : 1, fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 6, transition: "background 0.12s" }}
          onMouseEnter={(e) => { if (!exportDisabled) e.currentTarget.style.background = "#0F172A"; }}
          onMouseLeave={(e) => e.currentTarget.style.background = "#1E293B"}>
          <Download size={13} /> Export PDF
        </button>
      </div>
    </div>
  );
}

function ReportRevenue() {
  const [activeClientIdx, setActiveClientIdx] = useState(null);
  const [invPage, setInvPage] = useState(1);
  const PER_PAGE = 10;
  const totalRevenue = SERVICE_DONUT.reduce((s, d) => s + d.value, 0);

  const filteredInvoices = activeClientIdx !== null
    ? REPORT_INVOICES.filter((inv) => inv.client === CLIENT_BARS[activeClientIdx].short || (CLIENT_BARS[activeClientIdx].short === "TTSH" && inv.client === "TTSH"))
    : REPORT_INVOICES;

  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const thS = { padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" };

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
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(() => {
                const maxAmt = Math.max(...CLIENT_BARS.map((c) => c.amount));
                return CLIENT_BARS.map((entry, i) => {
                  const isActive = activeClientIdx === i;
                  const isDimmed = activeClientIdx !== null && !isActive;
                  const pct = (entry.amount / maxAmt) * 100;
                  return (
                    <div key={i} onClick={() => setActiveClientIdx(activeClientIdx === i ? null : i)}
                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <span style={{ width: 80, fontSize: 12, color: isDimmed ? "#CBD5E1" : "#64748B", fontFamily: "'Inter', sans-serif", textAlign: "right", flexShrink: 0, transition: "color 0.15s" }}>{entry.short}</span>
                      <div style={{ flex: 1, background: "#F1F5F9", borderRadius: 6, height: 28, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: isDimmed ? "rgba(30,41,59,0.15)" : isActive ? "#1E293B" : `rgba(30,41,59,${entry.opacity})`, transition: "background 0.15s, width 0.3s" }} />
                      </div>
                      <span style={{ width: 70, fontSize: 12, fontWeight: 600, color: isDimmed ? "#CBD5E1" : "#1E293B", fontFamily: "'Inter', sans-serif", flexShrink: 0, transition: "color 0.15s" }}>${(entry.amount / 1000).toFixed(1)}k</span>
                    </div>
                  );
                });
              })()}
            </div>
            <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginTop: 14, textAlign: "center" }}>Click a bar to filter the invoice table below</p>
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
                  <Pie data={SERVICE_DONUT} cx="50%" cy="50%" innerRadius={55} outerRadius={84} paddingAngle={3} dataKey="value" nameKey="label" isAnimationActive={false}>
                    {SERVICE_DONUT.map((entry, i) => <Cell key={`donut-cell-${i}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name]} contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, color: "#1E293B", fontSize: 13, fontFamily: "'Inter', sans-serif", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} itemStyle={{ color: "#1E293B" }} labelStyle={{ color: "#64748B" }} />
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
            Showing {Math.min((invPage - 1) * PER_PAGE + 1, filteredInvoices.length)}–{Math.min(invPage * PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length} invoices · <strong>Total: $54,210.00</strong>
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
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
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
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{col}</th>
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
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.jobDate}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.memoAt}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.invAt}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.syncAt}</td>
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
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const resStyle = (r) => r === "Memo Submitted" ? { bg: "rgba(34,197,94,0.10)", color: "#22C55E" } : r === "Dismissed" ? { bg: "rgba(100,116,139,0.10)", color: "#64748B" } : { bg: "rgba(239,68,68,0.10)", color: "#EF4444" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardBase, padding: "18px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <AlertTriangle size={22} color="#EF4444" strokeWidth={2} />
        <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
          <strong style={{ color: "#1E293B" }}>This quarter: 3 jobs billed late, 1 job never billed.</strong> See the Billing Status column for each booking's status.
        </p>
      </div>
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Booking Ref", "Client", "Completion Date", "Days Until Memo", "Billing Status", "Crew Member", "Resolution"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEAKAGE_ROWS.map((row, i) => {
              const { bg: rBg, color: rColor } = resStyle(row.resolution);
              return (
                <tr key={row.bkg}
                  style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: "transparent", transition: "background 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.bkg}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.client}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.completedAt}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.daysUntilMemo >= 3 ? "#EF4444" : row.daysUntilMemo >= 1.5 ? "#F59E0B" : "#22C55E", fontFamily: "'Inter', sans-serif" }}>{row.daysUntilMemo}d</span>
                  </td>
                  <td style={{ padding: "0 16px" }}>
                    <BillingStatusBadge status={getBillingStatus(row)} />
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.crew}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: rBg, color: rColor, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.resolution}</span>
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

function ExpenseSummary() {
  return (
    <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontFamily: "'Inter', sans-serif" }}>
      Vendor Expenditure functionality not yet implemented.
    </div>
  );
}

export default function ReportsScreen() {
  const [reportTab, setReportTab] = useState("revenue");
  const [period, setPeriod] = useState("This Quarter");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 32, background: "#F8FAFC", minHeight: "100%" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <FileBarChart size={20} color="#64748B" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Reports</h1>
      </div>

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
      <PeriodBar period={period} setPeriod={setPeriod} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} reportTab={reportTab} />

      {/* Tab content */}
      {reportTab === "revenue" && <ReportRevenue />}
      {reportTab === "billing" && <ReportBillingCycle />}
      {reportTab === "leakage" && <ReportLeakage />}
      {reportTab === "vendor" && <ExpenseSummary />}
    </div>
  );
}