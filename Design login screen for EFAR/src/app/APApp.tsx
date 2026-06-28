import React, { useState } from "react";
import { Bell, Settings, LayoutDashboard, FileText, RefreshCw, Cloud, ExternalLink, X, AlertTriangle, CheckCircle2, Upload, Calendar, LogOut, XCircle } from "lucide-react";
import { SidebarItem, ToastContainer, useToasts, XeroSyncStatus } from "./shared";

// ─── AP Sidebar ───────────────────────────────────────────────────────────────

type APPage = "dashboard" | "vendor-invoices" | "xero-sync" | "settings";

function APSidebar({ activePage, onNav, onLogout }: {
  activePage: APPage;
  onNav: (p: APPage) => void;
  onLogout: () => void;
}) {
  const items: { id: APPage; icon: React.ReactNode; label: string }[] = [
    { id: "dashboard",        icon: <LayoutDashboard size={16} />, label: "AP Dashboard" },
    { id: "vendor-invoices",  icon: <FileText size={16} />,        label: "Vendor Invoices" },
    { id: "xero-sync",        icon: <RefreshCw size={16} />,       label: "Xero Sync" },
    { id: "settings",         icon: <Settings size={16} />,        label: "Settings" },
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
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#0F172A", border: "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#FFFFFF", flexShrink: 0, fontFamily: "'Inter', sans-serif" }}>CT</div>
        <div style={{ overflow: "hidden" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>Chloe Tan</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Inter', sans-serif" }}>AP Specialist</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Xero Settings Screen ─────────────────────────────────────────────────────

function XeroSettingsScreen({ onViewSyncLog }: { onViewSyncLog: () => void }) {
  const [connected, setConnected] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "integrations">("integrations");
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleDisconnect = () => {
    setDisconnecting(true);
    setTimeout(() => { setConnected(false); setDisconnecting(false); }, 800);
  };
  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => { setConnected(true); setConnecting(false); }, 1200);
  };

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Secondary nav tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #E2E8F0" }}>
        {(["general", "integrations"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px", background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid #1E293B" : "2px solid transparent",
              color: activeTab === tab ? "#1E293B" : "#64748B", fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
              cursor: "pointer", fontFamily: "'Inter', sans-serif", marginBottom: -1, transition: "color 0.12s",
              textTransform: "capitalize",
            }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "32px 28px" }}>
          <p style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>General settings — coming soon.</p>
        </div>
      )}

      {activeTab === "integrations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Card 1 — Xero Connection */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Card header */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 10 }}>
              {/* Xero-flavoured icon */}
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "#13B5EA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.5px" }}>X</span>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Xero Connection</h2>
            </div>

            <div style={{ padding: "24px 28px" }}>
              {connected ? (
                <>
                  {/* Connection status row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
                    <div>
                      <p style={{ fontSize: 14, color: "#64748B", marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Connection Status</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 6, background: "rgba(34,197,94,0.12)", color: "#22C55E", fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
                          Connected
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#64748B", marginTop: 6, fontFamily: "'Inter', sans-serif" }}>EFAR Pte Ltd</p>
                    </div>
                    <button onClick={handleDisconnect} disabled={disconnecting}
                      style={{ height: 34, padding: "0 14px", borderRadius: 8, border: "1px solid #EF4444", background: "#FFFFFF", color: "#EF4444", fontSize: 13, fontWeight: 500, cursor: disconnecting ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s", flexShrink: 0 }}
                      onMouseEnter={(e) => { if (!disconnecting) { (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"; }}}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"; }}>
                      {disconnecting ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </div>

                  {/* Detail fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      {
                        label: "Xero Organisation",
                        value: <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>EFAR Pte Ltd</span>,
                      },
                      {
                        label: "Connected Since",
                        value: <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>1 Jan 2026, 09:00 AM</span>,
                      },
                      {
                        label: "Token Expires",
                        value: (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, color: "#F59E0B", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>22 Jul 2026</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#F59E0B", fontFamily: "'Inter', sans-serif" }}>
                              <AlertTriangle size={12} strokeWidth={2.5} />
                              Token expiring soon — reconnect to refresh.
                            </span>
                          </div>
                        ),
                      },
                    ].map(({ label, value }, i, arr) => (
                      <div key={label} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 0", borderBottom: i < arr.length - 1 ? "1px solid #E2E8F0" : "none" }}>
                        <span style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", minWidth: 180 }}>{label}</span>
                        <div style={{ flex: 1, textAlign: "right" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* Not connected state */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 8px" }}>
                  {/* Cloud illustration */}
                  <div style={{ width: 80, height: 80, borderRadius: 16, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, position: "relative" }}>
                    <Cloud size={36} color="#CBD5E1" strokeWidth={1.5} />
                    <div style={{ position: "absolute", bottom: 16, right: 16, width: 22, height: 22, borderRadius: "50%", background: "#FEF2F2", border: "2px solid #FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={12} color="#EF4444" strokeWidth={3} />
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: "#64748B", marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>No Xero account connected</p>
                  <button onClick={handleConnect} disabled={connecting}
                    style={{ width: "100%", maxWidth: 320, height: 44, borderRadius: 8, background: connecting ? "#334155" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: connecting ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12, transition: "background 0.15s" }}>
                    {connecting ? (
                      <><svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Redirecting to Xero…</>
                    ) : (
                      <>
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: "#13B5EA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.5px" }}>X</span>
                        </div>
                        Connect to Xero
                      </>
                    )}
                  </button>
                  <p style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                    You will be redirected to Xero to authorise the connection.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2 — Sync Status Overview */}
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "18px 28px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>Sync Status Overview</h2>
                <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Last 7 days</p>
              </div>
            </div>

            <div style={{ padding: "20px 28px" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                {[
                  { label: "Successful Syncs", value: "14", color: "#22C55E", bg: "rgba(34,197,94,0.08)" },
                  { label: "Failed Syncs",      value: "1",  color: "#EF4444", bg: "rgba(239,68,68,0.08)" },
                  { label: "Pending",           value: "2",  color: "#F59E0B", bg: "rgba(245,158,11,0.08)" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: bg, border: `1px solid ${color}22` }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: "'Inter', sans-serif" }}>{value}</span>
                    <span style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{label}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={onViewSyncLog}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}>
                  View Full Sync Log <ExternalLink size={13} />
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── AP App Shell ─────────────────────────────────────────────────────────────

// ─── AP Dashboard ────────────────────────────────────────────────────────────

const RECENT_ACTIVITY = [
  { vendor: "Fuels Direct",       inv: "FD-2026-0421",  event: "Uploaded & extracted",               time: "22 Jun, 10:10 AM", status: "Pending Review", lowConf: false },
  { vendor: "AutoRepair SG",      inv: "AR-2026-099",   event: "Low confidence OCR — review required", time: "21 Jun, 3:45 PM",  status: "Pending Review", lowConf: true  },
  { vendor: "Medical Supplies Co",inv: "MSC-0388",      event: "Approved by Chloe Tan",               time: "10 Jun, 2:30 PM",  status: "Approved",       lowConf: false },
  { vendor: "CleanPro Services",  inv: "CP-2026-114",   event: "Synced to Xero",                      time: "8 Jun, 9:15 AM",   status: "Synced",         lowConf: false },
  { vendor: "TechParts Hub",      inv: "TP-2026-302",   event: "Uploaded & extracted",                time: "5 Jun, 4:00 PM",   status: "Pending Review", lowConf: false },
];

const STATUS_CHIP: Record<string, { bg: string; color: string }> = {
  "Pending Review": { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  "Approved":       { bg: "rgba(34,197,94,0.12)",  color: "#22C55E" },
  "Synced":         { bg: "rgba(34,197,94,0.12)",  color: "#22C55E" },
  "Rejected":       { bg: "rgba(239,68,68,0.12)",  color: "#EF4444" },
};

function APDashboard({ onNav }: { onNav: (p: APPage) => void }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);

  const cardBase: React.CSSProperties = {
    background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  const statCards = [
    { label: "Pending Review",           value: "3",  color: "#F59E0B", sub: "Vendor invoices awaiting your review." },
    { label: "Low Confidence OCR",       value: "1",  color: "#EF4444", sub: "AI extraction below 80% — manual check required.", warn: true, redBorder: true },
    { label: "Synced to Xero This Month",value: "12", color: "#22C55E", sub: "Successfully pushed this month." },
    { label: "Failed Syncs",             value: "1",  color: "#EF4444", sub: "Requires manual retry or correction." },
  ];

  function ghostBtn(label: string, color: string, onClick: () => void) {
    return (
      <button onClick={onClick}
        style={{ width: "100%", height: 44, borderRadius: 8, border: `1px solid ${color === "#F59E0B" ? "rgba(245,158,11,0.5)" : "#E2E8F0"}`, background: color === "#F59E0B" ? "rgba(245,158,11,0.06)" : "#FFFFFF", color: color === "#F59E0B" ? "#B45309" : "#1E293B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "border-color 0.12s, background 0.12s" }}
        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = color === "#F59E0B" ? "#F59E0B" : "#1E293B"; }}
        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = color === "#F59E0B" ? "rgba(245,158,11,0.5)" : "#E2E8F0"; }}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Date range */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: -8 }}>
        {[
          { val: dateFrom, set: setDateFrom, focus: dfFocus, setFocus: setDfFocus },
          { val: dateTo,   set: setDateTo,   focus: dtFocus, setFocus: setDtFocus },
        ].map((f, i) => (
          <div key={i} style={{ position: "relative" }}>
            <Calendar size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input type="date" value={f.val} onChange={(e) => f.set(e.target.value)} onFocus={() => f.setFocus(true)} onBlur={() => f.setFocus(false)}
              style={{ height: 36, paddingLeft: 28, paddingRight: 8, borderRadius: 8, border: `1px solid ${f.focus ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 12, color: f.val ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", width: 130, boxSizing: "border-box" }} />
          </div>
        ))}
      </div>

      {/* Row 1: Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
        {statCards.map(({ label, value, color, sub, warn, redBorder }) => (
          <div key={label} style={{ ...cardBase, padding: "18px 20px", borderLeft: redBorder ? "3px solid #EF4444" : "1px solid #E2E8F0" }}>
            <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>{value}</span>
              {warn && <AlertTriangle size={18} color={color} strokeWidth={2} />}
            </div>
            <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Activity + Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "60% 40%", gap: 16 }}>

        {/* Recent Activity */}
        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Recent Activity</h2>
          </div>
          <div>
            {RECENT_ACTIVITY.map((item, i) => {
              const chip = STATUS_CHIP[item.status] ?? { bg: "#F1F5F9", color: "#64748B" };
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "13px 24px", borderBottom: i < RECENT_ACTIVITY.length - 1 ? "1px solid #F1F5F9" : "none", gap: 12, background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{item.vendor}</span>
                      <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{item.inv}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {item.lowConf && <AlertTriangle size={13} color="#EF4444" strokeWidth={2.5} />}
                      <span style={{ fontSize: 14, color: item.lowConf ? "#EF4444" : "#64748B", fontFamily: "'Inter', sans-serif" }}>{item.event}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: chip.bg, color: chip.color, fontFamily: "'Inter', sans-serif" }}>
                      {item.status === "Approved" && <CheckCircle2 size={10} strokeWidth={2.5} />}
                      {item.lowConf && <AlertTriangle size={10} strokeWidth={2.5} />}
                      {item.status}
                    </span>
                    <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{item.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "12px 24px", borderTop: "1px solid #E2E8F0", textAlign: "right" }}>
            <button onClick={() => onNav("vendor-invoices")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3B82F6", fontFamily: "'Inter', sans-serif", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 2 }}>
              View All Invoices →
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Quick Actions</h2>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Upload primary button */}
            <button onClick={() => onNav("vendor-invoices")}
              style={{ width: "100%", height: 44, borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.12s" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"}
              onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"}>
              <Upload size={16} /> Upload Vendor Invoice
            </button>

            {ghostBtn("Review Low Confidence Invoices", "#F59E0B", () => onNav("vendor-invoices"))}
            {ghostBtn("View Xero Sync Status", "#E2E8F0", () => onNav("xero-sync"))}

            {/* Divider */}
            <div style={{ height: 1, background: "#E2E8F0", margin: "4px 0" }} />

            {/* Summary blurb */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                <strong style={{ color: "#1E293B" }}>1 invoice</strong> needs urgent attention — OCR confidence below threshold.
              </p>
              <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", marginTop: 4, lineHeight: 1.6 }}>
                <strong style={{ color: "#1E293B" }}>3 invoices</strong> are pending your review before Xero sync.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vendor Invoice List ─────────────────────────────────────────────────────

type VendorInvStatus = "Pending Review" | "Low Confidence" | "Approved" | "Rejected" | "Synced" | "Failed";
type VendorInvFilter = "All" | VendorInvStatus;

interface VendorInvoice {
  id: string;
  vendor: string;
  invNo: string;
  date: string;
  total: number;
  confidence: number;
  status: VendorInvStatus;
  lowConf: boolean;
}

const VENDOR_INVOICES: VendorInvoice[] = [
  { id: "vi1", vendor: "Fuels Direct",        invNo: "FD-2026-0421", date: "18 Jun 2026", total: 4320, confidence: 95, status: "Pending Review", lowConf: false },
  { id: "vi2", vendor: "AutoRepair SG",        invNo: "AR-2026-099",  date: "15 Jun 2026", total: 1850, confidence: 62, status: "Pending Review", lowConf: true  },
  { id: "vi3", vendor: "Medical Supplies Co",  invNo: "MSC-0388",     date: "10 Jun 2026", total: 780,  confidence: 88, status: "Approved",       lowConf: false },
  { id: "vi4", vendor: "Fuels Direct",         invNo: "FD-2026-0410", date: "2 Jun 2026",  total: 3900, confidence: 91, status: "Synced",         lowConf: false },
];

const INV_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "Pending Review": { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
  "Low Confidence": { bg: "rgba(239,68,68,0.12)",  color: "#EF4444" },
  "Approved":       { bg: "rgba(34,197,94,0.12)",  color: "#22C55E" },
  "Rejected":       { bg: "rgba(239,68,68,0.12)",  color: "#EF4444" },
  "Synced":         { bg: "rgba(34,197,94,0.12)",  color: "#22C55E" },
  "Failed":         { bg: "rgba(239,68,68,0.12)",  color: "#EF4444" },
};

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (id: string) => void }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorFocused, setVendorFocused] = useState(false);
  const [uploading, setUploading] = useState(false);

  function handleFile(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return;
    setFileName(f.name);
  }

  function handleUpload() {
    if (!fileName) return;
    setUploading(true);
    setTimeout(() => { setUploading(false); onUploaded("vi_new"); }, 1200);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: 480, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B" }}>Upload Vendor Invoice PDF</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", lineHeight: 0, padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ height: 140, borderRadius: 8, border: `2px dashed ${dragOver ? "#3B82F6" : fileName ? "#22C55E" : "#E2E8F0"}`, background: dragOver ? "#EFF6FF" : fileName ? "#F0FDF4" : "#FAFAFA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", transition: "border-color 0.15s, background 0.15s", boxSizing: "border-box" }}
            onMouseEnter={(e) => { if (!fileName) (e.currentTarget as HTMLDivElement).style.borderColor = "#94A3B8"; }}
            onMouseLeave={(e) => { if (!fileName) (e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0"; }}>
            {fileName ? (
              <>
                <CheckCircle2 size={28} color="#22C55E" strokeWidth={2} />
                <p style={{ fontSize: 14, color: "#22C55E", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{fileName}</p>
                <p style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>Click to replace</p>
              </>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p style={{ fontSize: 14, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>Drag and drop PDF here or click to browse</p>
                <p style={{ fontSize: 12, color: "#CBD5E1", fontFamily: "'Inter', sans-serif" }}>PDF only · Maximum 10 MB</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />

          {/* Vendor name */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#1E293B", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>
              Vendor Name <span style={{ fontSize: 12, fontWeight: 400, color: "#94A3B8" }}>(optional)</span>
            </label>
            <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)}
              onFocus={() => setVendorFocused(true)} onBlur={() => setVendorFocused(false)}
              placeholder="Auto-detected from PDF if left blank"
              style={{ width: "100%", height: 44, padding: "0 14px", borderRadius: 8, border: `1px solid ${vendorFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />
          </div>

          {/* Helper */}
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
            Our AI will extract invoice details. You will be redirected to review the results.
          </p>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, height: 44, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
              Cancel
            </button>
            <button onClick={handleUpload} disabled={!fileName || uploading}
              style={{ flex: 1, height: 44, borderRadius: 8, background: !fileName || uploading ? "#CBD5E1" : "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: !fileName || uploading ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {uploading ? <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Extracting…</> : "Upload & Extract"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AP Invoice Review ────────────────────────────────────────────────────────

interface APLineItem { id: string; description: string; qty: number; unitPrice: number; }

const INITIAL_LINE_ITEMS_AP: APLineItem[] = [
  { id: "a1", description: "Diesel Fuel (500L)",  qty: 500, unitPrice: 2.20  },
  { id: "a2", description: "Petrol (900L)",        qty: 900, unitPrice: 2.80  },
  { id: "a3", description: "Delivery Charge",      qty: 1,   unitPrice: 700.00 },
];

function APInvoiceReview({ invoiceId, readOnly, onApprove, onReject }: {
  invoiceId: string;
  readOnly: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const inv = VENDOR_INVOICES.find((i) => i.id === invoiceId) ?? VENDOR_INVOICES[0];
  const [vendorName, setVendorName] = useState(inv.vendor);
  const [invNo, setInvNo] = useState(inv.invNo);
  const [invDate, setInvDate] = useState("2026-06-18");
  const [extractedTotal, setExtractedTotal] = useState(inv.total);
  const [rebateRate, setRebateRate] = useState(1.00);
  const [lineItems, setLineItems] = useState<APLineItem[]>(INITIAL_LINE_ITEMS_AP);
  const [editingLI, setEditingLI] = useState<string | null>(null);
  const [liDraft, setLiDraft] = useState<Partial<APLineItem>>({});
  const [rejectModal, setRejectModal] = useState(false);

  const [vFocus, setVFocus] = useState(false);
  const [iFocus, setIFocus] = useState(false);
  const [dFocus, setDFocus] = useState(false);
  const [tFocus, setTFocus] = useState(false);
  const [rFocus, setRFocus] = useState(false);

  const rebateAmt = (extractedTotal * rebateRate) / 100;
  const verifiedTotal = extractedTotal - rebateAmt;
  const confidence = inv.confidence;
  const isLowConf = confidence < 80;
  const confColor = confidence >= 80 ? "#22C55E" : confidence >= 60 ? "#F59E0B" : "#EF4444";
  const confBg = confidence >= 80 ? "rgba(34,197,94,0.12)" : confidence >= 60 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";
  const subtotal = lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);

  const inputBase = (focused: boolean, warn = false): React.CSSProperties => ({
    width: "100%", height: 40, padding: "0 12px", borderRadius: 8,
    border: `1px solid ${focused ? "#3B82F6" : warn ? "rgba(245,158,11,0.5)" : "#E2E8F0"}`,
    background: warn ? "rgba(245,158,11,0.04)" : "#FFFFFF", fontSize: 14, color: "#1E293B",
    outline: "none", fontFamily: "'Inter', sans-serif", transition: "border-color 0.15s", boxSizing: "border-box",
  });
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 500, color: "#64748B", marginBottom: 5, fontFamily: "'Inter', sans-serif" };
  const thS: React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontFamily: "'Inter', sans-serif" };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* ── LEFT: PDF viewer ── */}
        <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Source Document</h2>
          </div>
          <div style={{ padding: "20px" }}>
            <div style={{ height: 520, borderRadius: 8, background: "#F1F5F9", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>PDF Preview</p>
                <p style={{ fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif", marginTop: 4 }}>{inv.vendor} · {inv.invNo} · {inv.date}</p>
              </div>
              <p style={{ fontSize: 12, color: "#CBD5E1", fontFamily: "'Inter', sans-serif" }}>Renders actual PDF in production</p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#1E293B"}
                onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"}>
                Open Full Screen ↗
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Extracted Data ── */}
        <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>AI-Extracted Data</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: confBg, color: confColor, fontFamily: "'Inter', sans-serif" }}>
              Extraction Confidence: {confidence}%
            </span>
          </div>

          <div style={{ padding: "16px 20px", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>

            {/* Low confidence banner */}
            {isLowConf && (
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.30)", marginBottom: 16 }}>
                <AlertTriangle size={15} color="#F59E0B" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#92400E", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                  Low confidence detected — all fields are highlighted for careful review.
                </p>
              </div>
            )}

            {/* Fields grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Vendor Name</label>
                <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} onFocus={() => setVFocus(true)} onBlur={() => setVFocus(false)} disabled={readOnly} style={inputBase(vFocus, isLowConf)} />
              </div>
              <div>
                <label style={labelStyle}>Invoice Number</label>
                <input value={invNo} onChange={(e) => setInvNo(e.target.value)} onFocus={() => setIFocus(true)} onBlur={() => setIFocus(false)} disabled={readOnly} style={inputBase(iFocus, isLowConf)} />
              </div>
              <div>
                <label style={labelStyle}>Invoice Date</label>
                <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} onFocus={() => setDFocus(true)} onBlur={() => setDFocus(false)} disabled={readOnly} style={{ ...inputBase(dFocus, isLowConf), color: invDate ? "#1E293B" : "#94A3B8" }} />
              </div>
              <div>
                <label style={labelStyle}>Extracted Total</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94A3B8", pointerEvents: "none" }}>$</span>
                  <input type="number" value={extractedTotal} onChange={(e) => setExtractedTotal(Number(e.target.value))} onFocus={() => setTFocus(true)} onBlur={() => setTFocus(false)} disabled={readOnly}
                    style={{ ...inputBase(tFocus, isLowConf), paddingLeft: 24 }} />
                </div>
              </div>
            </div>

            {/* Rebate */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
                <div>
                  <label style={labelStyle}>Rebate Rate</label>
                  <div style={{ position: "relative" }}>
                    <input type="number" step="0.01" min="0" value={rebateRate} onChange={(e) => setRebateRate(Number(e.target.value))} onFocus={() => setRFocus(true)} onBlur={() => setRFocus(false)} disabled={readOnly}
                      style={{ ...inputBase(rFocus), paddingRight: 28 }} />
                    <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94A3B8", pointerEvents: "none" }}>%</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>Rebate is auto-calculated.</p>
                </div>
                <div>
                  <label style={labelStyle}>Rebate Amount</label>
                  <div style={{ height: 40, display: "flex", alignItems: "center", paddingLeft: 2 }}>
                    <span style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>${rebateAmt.toFixed(2)}</span>
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, color: "#22C55E" }}>Verified Total</label>
                  <div style={{ height: 40, display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#22C55E", fontFamily: "'Inter', sans-serif" }}>${verifiedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>Line Items</p>
            <div style={{ borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden", marginBottom: 4 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Description", "Qty", "Unit Price", "Amount", ""].map((col) => (
                      <th key={col} style={{ ...thS, textAlign: col === "Amount" || col === "Unit Price" || col === "Qty" ? "right" : "left" }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, i) => {
                    const isEditing = editingLI === li.id;
                    return (
                      <React.Fragment key={li.id}>
                        <tr style={{ borderBottom: i < lineItems.length - 1 ? "1px solid #F1F5F9" : "none", height: 44, background: isEditing ? "#EFF6FF" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                          {isEditing ? (
                            <>
                              <td style={{ padding: "5px 8px", minWidth: 160 }}>
                                <input value={liDraft.description ?? li.description} onChange={(e) => setLiDraft((p) => ({ ...p, description: e.target.value }))}
                                  style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 5, border: "1px solid #E2E8F0", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
                                  onFocus={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#3B82F6"}
                                  onBlur={(e) => (e.currentTarget as HTMLInputElement).style.borderColor = "#E2E8F0"} />
                              </td>
                              <td style={{ padding: "5px 8px", minWidth: 60 }}>
                                <input type="number" value={liDraft.qty ?? li.qty} onChange={(e) => setLiDraft((p) => ({ ...p, qty: Number(e.target.value) }))}
                                  style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 5, border: "1px solid #E2E8F0", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box", textAlign: "right" }} />
                              </td>
                              <td style={{ padding: "5px 8px", minWidth: 90 }}>
                                <input type="number" value={liDraft.unitPrice ?? li.unitPrice} onChange={(e) => setLiDraft((p) => ({ ...p, unitPrice: Number(e.target.value) }))}
                                  style={{ width: "100%", height: 30, padding: "0 8px", borderRadius: 5, border: "1px solid #E2E8F0", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box", textAlign: "right" }} />
                              </td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>
                                ${((liDraft.qty ?? li.qty) * (liDraft.unitPrice ?? li.unitPrice)).toFixed(2)}
                              </td>
                              <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => { setLineItems((p) => p.map((x) => x.id === li.id ? { ...x, ...liDraft } as APLineItem : x)); setEditingLI(null); }}
                                    style={{ height: 26, padding: "0 10px", borderRadius: 5, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Save</button>
                                  <button onClick={() => setEditingLI(null)}
                                    style={{ height: 26, padding: "0 8px", borderRadius: 5, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>✕</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: "0 12px", fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{li.description}</td>
                              <td style={{ padding: "0 12px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", textAlign: "right" }}>{li.qty}</td>
                              <td style={{ padding: "0 12px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", textAlign: "right" }}>${li.unitPrice.toFixed(2)}</td>
                              <td style={{ padding: "0 12px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif", textAlign: "right" }}>${(li.qty * li.unitPrice).toFixed(2)}</td>
                              <td style={{ padding: "0 12px" }}>
                                {!readOnly && (
                                  <button onClick={() => { setEditingLI(li.id); setLiDraft({ ...li }); }}
                                    title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", lineHeight: 0, padding: 3, borderRadius: 4 }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1E293B"; (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </button>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {/* Subtotal */}
                  <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                    <td colSpan={3} style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "#64748B", fontFamily: "'Inter', sans-serif", textAlign: "right" }}>Subtotal</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", textAlign: "right" }}>${subtotal.toFixed(2)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setRejectModal(false); }}>
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: 420, padding: "28px", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(239,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={20} color="#EF4444" strokeWidth={2} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", marginBottom: 8 }}>Reject this invoice?</h3>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>This invoice will be marked as Rejected and archived. This action can be reviewed by an admin.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setRejectModal(false)} style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
              <button onClick={() => { setRejectModal(false); onReject(); }} style={{ height: 40, padding: "0 18px", borderRadius: 8, background: "#EF4444", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VendorInvoiceList({ onReview, onView }: { onReview: (id: string) => void; onView: (id: string) => void }) {
  const [filter, setFilter] = useState<VendorInvFilter>("All");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const filtered = VENDOR_INVOICES.filter((inv) => {
    if (filter === "Low Confidence" && !inv.lowConf) return false;
    if (filter !== "All" && filter !== "Low Confidence" && inv.status !== filter) return false;
    const q = search.toLowerCase();
    if (q && !inv.vendor.toLowerCase().includes(q) && !inv.invNo.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 4, flexShrink: 0 }}>
          {(["All", "Pending Review", "Low Confidence", "Approved", "Rejected", "Synced", "Failed"] as VendorInvFilter[]).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)}
              style={{ padding: "5px 10px", borderRadius: 6, border: filter === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: filter === tab ? "#FFFFFF" : "transparent", color: filter === tab ? "#1E293B" : "#64748B", fontSize: 12, fontWeight: filter === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "all 0.12s" }}>
              {tab}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", width: 260 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search vendor or invoice no…"
            style={{ width: "100%", height: 38, paddingLeft: 34, paddingRight: 14, borderRadius: 8, border: `1px solid ${searchFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Vendor", "Invoice No.", "Invoice Date", "Extracted Total", "Confidence", "Status", "Action"].map((col) => (
                  <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No invoices match the current filters.</td></tr>
              ) : filtered.map((inv, i) => {
                const isLowConf = inv.lowConf;
                const baseBg = isLowConf ? "#FEF2F2" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
                const hoverBg = isLowConf ? "#FEE2E2" : "#F1F5F9";
                const { bg: stBg, color: stColor } = INV_STATUS_STYLE[inv.status] ?? { bg: "#F1F5F9", color: "#64748B" };
                const isReviewable = inv.status === "Pending Review";
                return (
                  <tr key={inv.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid #E2E8F0" : "none", background: baseBg, height: 52 }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = hoverBg)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = baseBg)}>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{inv.vendor}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{inv.invNo}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 14, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{inv.date}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>${inv.total.toLocaleString("en-SG", { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: inv.confidence >= 80 ? "#22C55E" : "#EF4444", fontFamily: "'Inter', sans-serif" }}>{inv.confidence}%</span>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: stBg, color: stColor, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                          {inv.status === "Synced" && <CheckCircle2 size={11} strokeWidth={2.5} />}
                          {inv.status}
                        </span>
                        {isLowConf && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "rgba(239,68,68,0.10)", color: "#EF4444", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
                            <AlertTriangle size={10} strokeWidth={2.5} /> Low Confidence
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "0 16px", verticalAlign: "middle" }}>
                      <button onClick={() => isReviewable ? onReview(inv.id) : onView(inv.id)}
                        style={{ height: 32, padding: "0 14px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E293B")}>
                        {isReviewable ? "Review" : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Showing {filtered.length} of {VENDOR_INVOICES.length} invoices</span>
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={(id) => { setShowUpload(false); onReview(id); }} />}
    </>
  );
}

function APApp({ onLogout }: { onLogout: () => void }) {
  const [activePage, setActivePage] = useState<APPage>("dashboard");
  const [invView, setInvView] = useState<"list" | "review" | "view">("list");
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { toasts, add: addToast, dismiss } = useToasts();

  const pageTitle: Record<APPage, string> = {
    "dashboard":       "AP Dashboard",
    "vendor-invoices": "Vendor Invoices",
    "xero-sync":       "Xero Sync",
    "settings":        "Settings",
  };

  const headerLeft = (() => {
    if (activePage === "vendor-invoices" && invView !== "list") {
      const inv = VENDOR_INVOICES.find((i) => i.id === selectedInvId);
      const statusStyle = inv?.status === "Pending Review" ? { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" } : { bg: "rgba(34,197,94,0.12)", color: "#22C55E" };
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setInvView("list")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0, transition: "color 0.12s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Vendor Invoices
          </button>
          <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>
            {inv?.invNo ?? "Invoice Review"}
          </h1>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: statusStyle.bg, color: statusStyle.color, fontFamily: "'Inter', sans-serif" }}>
            {inv?.status ?? "Pending Review"}
          </span>
        </div>
      );
    }
    return <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>{pageTitle[activePage]}</h1>;
  })();

  const headerRight = (() => {
    if (activePage === "vendor-invoices" && invView === "list") {
      return (
        <button onClick={() => setShowUploadModal(true)}
          style={{ height: 40, padding: "0 18px", borderRadius: 8, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "background 0.12s" }}
          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#0F172A"}
          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#1E293B"}>
          + Upload Invoice
        </button>
      );
    }
    return null;
  })();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter', sans-serif", background: "#F8FAFC" }}>
      <APSidebar activePage={activePage} onNav={(p) => { setActivePage(p); setInvView("list"); }} onLogout={onLogout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 64, background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0 }}>
          {headerLeft}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {headerRight}
            <div style={{ position: "relative", lineHeight: 0 }}>
              <Bell size={20} color="#64748B" style={{ cursor: "pointer" }} />
              <span style={{ position: "absolute", top: -5, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#EF4444", color: "#FFFFFF", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>2</span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {activePage === "settings" && <XeroSettingsScreen onViewSyncLog={() => setActivePage("xero-sync")} />}
          {activePage === "xero-sync" && (
            <XeroSyncStatus onReconnect={() => setActivePage("settings")} />
          )}
          {activePage === "dashboard" && <APDashboard onNav={setActivePage} />}
          {activePage === "vendor-invoices" && invView === "list" && (
            <VendorInvoiceList
              onReview={(id) => { setSelectedInvId(id); setInvView("review"); }}
              onView={(id) => { setSelectedInvId(id); setInvView("view"); }}
            />
          )}
          {activePage === "vendor-invoices" && invView !== "list" && selectedInvId && (() => {
            const inv = VENDOR_INVOICES.find((i) => i.id === selectedInvId);
            const isPending = inv?.status === "Pending Review";
            const handleApprove = () => { addToast("success", `${inv?.invNo} approved successfully.`); setInvView("list"); };
            const handleReject = () => { addToast("success", `Invoice rejected and archived.`); setInvView("list"); };
            return (
              <>
                {!invView.includes("view") && isPending && (
                  <div style={{ display: "flex", gap: 10, marginBottom: 20, justifyContent: "flex-end" }}>
                    <button onClick={handleApprove}
                      style={{ height: 40, padding: "0 18px", borderRadius: 8, background: "#22C55E", color: "#FFFFFF", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background 0.12s" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#16A34A"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#22C55E"}>
                      Approve Invoice
                    </button>
                    <button onClick={() => {}}
                      style={{ height: 40, padding: "0 18px", borderRadius: 8, border: "1px solid #EF4444", background: "#FFFFFF", color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF"}>
                      Reject
                    </button>
                  </div>
                )}
                <APInvoiceReview
                  invoiceId={selectedInvId}
                  readOnly={invView === "view"}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </>
            );
          })()}
        </main>
      </div>

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUploaded={(id) => { setShowUploadModal(false); setActivePage("vendor-invoices"); setSelectedInvId(id); setInvView("review"); }}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        textarea::placeholder, input::placeholder { color: #94A3B8; }
      `}</style>
    </div>
  );
}
export default APApp;
