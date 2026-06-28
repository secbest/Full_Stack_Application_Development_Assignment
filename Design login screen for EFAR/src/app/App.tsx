import React, { useState } from "react";
import {
  Eye, EyeOff, Bell, ArrowLeft, Search,
  ChevronDown, ChevronLeft, ChevronRight, CheckCircle2,
} from "lucide-react";
import {
  IntakeStatusFilter, BookingStatusFilter, View, Intake, Booking, Toast,
  INTAKES, BOOKINGS, formatQueue, queueColor,
  ToastContainer, useToasts,
  IntakeStatusBadge, BookingStatusBadge, TierBadge, StatCard,
  SidebarItem, Sidebar, FieldRow, FormLabel, StyledSelect, StyledDate, StyledTime, StyledTextarea,
  tdStyle, cellText,
  BookingList, BookingDetail, STATUS_ORDER, CREW_OPTIONS,
  backBtnStyle, cardStyle, cardHeaderStyle, cardTitleStyle, sectionLabelStyle,
  IntakeDetail,
} from "./shared";
import { FieldApp } from "./FieldApp";
import APApp from "./APApp";
import ARApp from "./ARApp";
import MDApp from "./MDApp";

type Role = "quotations" | "ap" | "field" | "ar" | "md";
// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const e = email.toLowerCase();
      const role: Role = e.includes("ravi") ? "field" : e.includes("chloe") ? "ap" : e.includes("sarah") ? "ar" : e.includes("doris") ? "md" : "quotations";
      onLogin(role);
    }, 1200);
  };
  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="relative hidden md:flex flex-col items-center justify-center" style={{ width: "60%", backgroundColor: "#1E293B", flexShrink: 0 }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute pointer-events-none" style={{ width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
        <div className="relative z-10 flex flex-col items-center gap-6 select-none">
          <div style={{ width: 72, height: 72, border: "2px solid rgba(255,255,255,0.25)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-label="Medical cross"><rect x="15" y="4" width="10" height="32" rx="2" stroke="white" strokeWidth="2" /><rect x="4" y="15" width="32" height="10" rx="2" stroke="white" strokeWidth="2" /></svg>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span style={{ fontSize: 40, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.02em", lineHeight: 1 }}>EFAR</span>
            <span style={{ fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.70)", textAlign: "center", maxWidth: 280 }}>Digital Operations-to-Billing Platform</span>
          </div>
          <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.20)" }} />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ambulance · Dispatch · Billing</p>
        </div>
        <div className="absolute bottom-8 left-0 right-0 flex justify-center" style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}>© 2026 EFAR. All rights reserved.</div>
      </div>
      <div className="flex flex-col items-center justify-center flex-1" style={{ backgroundColor: "#FFFFFF", padding: "48px" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", marginBottom: 6, lineHeight: 1.2 }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: "#64748B" }}>Sign in to your account</p>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="login-email" style={{ fontSize: 14, fontWeight: 500, color: "#1E293B" }}>Email address</label>
              <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)} placeholder="sarah@efar.com.sg" required style={{ height: 44, padding: "0 14px", borderRadius: 8, border: `1px solid ${emailFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="login-password" style={{ fontSize: 14, fontWeight: 500, color: "#1E293B" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} placeholder="••••••••" required style={{ height: 44, width: "100%", padding: "0 44px 0 14px", borderRadius: 8, border: `1px solid ${passwordFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 14, color: "#1E293B", outline: "none", fontFamily: "inherit", transition: "border-color 0.15s", boxSizing: "border-box" }} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", lineHeight: 0, padding: 4 }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 8, backgroundColor: loading ? "#334155" : "#1E293B", color: "#FFFFFF", fontSize: 14, fontWeight: 600, border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4, transition: "background-color 0.15s" }}>
              {loading ? (<><svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>Signing in…</>) : "Sign In"}
            </button>
          </form>
          <p style={{ marginTop: 16, fontSize: 12, color: "#64748B", textAlign: "center" }}>Forgot password? <span style={{ color: "#94A3B8" }}>Contact your administrator.</span></p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<{ loggedIn: boolean; role: Role }>({ loggedIn: false, role: "quotations" });
  const loggedIn = session.loggedIn;
  const role = session.role;
  const [activePage, setActivePage] = useState<"queue" | "bookings" | "settings">("queue");
  const [view, setView] = useState<View>("queue");
  const [selectedIntake, setSelectedIntake] = useState<Intake | null>(null);
  const [activeBookingRef, setActiveBookingRef] = useState("");

  // Intake queue state
  const [intakeTab, setIntakeTab] = useState<IntakeStatusFilter>("Pending");
  const [intakeSearch, setIntakeSearch] = useState("");
  const [intakeSearchFocused, setIntakeSearchFocused] = useState(false);
  const [intakeServiceFilter, setIntakeServiceFilter] = useState("");
  const [intakeTierFilter, setIntakeTierFilter] = useState("");

  const { toasts, add: addToast, dismiss } = useToasts();

  const filteredIntakes = INTAKES.filter((row) => {
    if (intakeTab !== "All" && row.status !== intakeTab) return false;
    if (intakeServiceFilter && row.serviceType !== intakeServiceFilter) return false;
    if (intakeTierFilter && row.tier !== intakeTierFilter) return false;
    const q = intakeSearch.toLowerCase();
    if (q && !row.ref.toLowerCase().includes(q) && !row.name.toLowerCase().includes(q) && !row.org.toLowerCase().includes(q)) return false;
    return true;
  });

  if (!loggedIn) return <LoginScreen onLogin={(r) => setSession({ loggedIn: true, role: r })} />;

  if (role === "ap")    return <APApp    onLogout={() => setSession({ loggedIn: false, role: "quotations" })} />;
  if (role === "field") return <FieldApp onLogout={() => setSession({ loggedIn: false, role: "quotations" })} />;
  if (role === "ar")    return <ARApp    onLogout={() => setSession({ loggedIn: false, role: "quotations" })} />;
  if (role === "md")    return <MDApp    onLogout={() => setSession({ loggedIn: false, role: "quotations" })} />;

  function navTo(page: "queue" | "bookings" | "settings") {
    setActivePage(page);
    setSelectedIntake(null);
    setView(page === "queue" ? "queue" : page === "bookings" ? "booking-list" : "queue");
  }

  function logout() { setSession({ loggedIn: false, role: "quotations" }); setSelectedIntake(null); setActivePage("queue"); setView("queue"); }


  // Header content
  const headerLeft = (() => {
    if (view === "detail" && selectedIntake) return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => { setView("queue"); setSelectedIntake(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
          <ArrowLeft size={16} /><span>Intake Queue</span>
        </button>
        <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>Review Submission</h1>
        <IntakeStatusBadge status={selectedIntake.status} />
      </div>
    );
    if (view === "booking-detail") return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setView("booking-list")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#1E293B")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#64748B")}>
          <ArrowLeft size={16} /><span>Bookings</span>
        </button>
        <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>{activeBookingRef}</h1>
        <BookingStatusBadge status={(BOOKINGS.find((b) => b.ref === activeBookingRef)?.status) ?? "Confirmed"} />
      </div>
    );
    if (view === "booking-created") return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => { setView("booking-list"); setActivePage("bookings"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0 }}>
          <ArrowLeft size={16} /><span>Bookings</span>
        </button>
        <span style={{ color: "#CBD5E1", fontSize: 16 }}>/</span>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>Booking Detail</h1>
      </div>
    );
    const title = activePage === "bookings" ? "Bookings" : activePage === "settings" ? "Settings" : "Intake Queue";
    return <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.01em", fontFamily: "'Inter', sans-serif" }}>{title}</h1>;
  })();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter', sans-serif", background: "#F8FAFC" }}>
      <Sidebar activePage={activePage} onNav={navTo} onLogout={logout} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header style={{ height: 64, background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", flexShrink: 0 }}>
          {headerLeft}
          <div style={{ position: "relative", lineHeight: 0 }}>
            <Bell size={20} color="#64748B" style={{ cursor: "pointer" }} />
            <span style={{ position: "absolute", top: -5, right: -6, width: 16, height: 16, borderRadius: "50%", background: "#EF4444", color: "#FFFFFF", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>3</span>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {/* Settings placeholder */}
          {activePage === "settings" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", color: "#94A3B8", fontSize: 14 }}>Settings — coming soon</div>
          )}

          {/* Intake Queue */}
          {activePage === "queue" && view === "queue" && (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                {[{ label: "Pending Review", value: "5", color: "#F59E0B" }, { label: "Confirmed Today", value: "3", color: "#22C55E" }, { label: "Rejected Today", value: "1", color: "#EF4444" }].map((c) => (
                  <StatCard key={c.label} {...c} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 8, padding: 4 }}>
                  {(["All", "Pending", "Confirmed", "Rejected"] as IntakeStatusFilter[]).map((tab) => (
                    <button key={tab} onClick={() => setIntakeTab(tab)} style={{ padding: "6px 14px", borderRadius: 6, border: intakeTab === tab ? "1px solid #E2E8F0" : "1px solid transparent", background: intakeTab === tab ? "#FFFFFF" : "transparent", color: intakeTab === tab ? "#1E293B" : "#64748B", fontSize: 13, fontWeight: intakeTab === tab ? 600 : 400, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.12s" }}>{tab}</button>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                  <input value={intakeSearch} onChange={(e) => setIntakeSearch(e.target.value)} onFocus={() => setIntakeSearchFocused(true)} onBlur={() => setIntakeSearchFocused(false)} placeholder="Search by name, reference, or organisation…"
                    style={{ width: "100%", height: 38, paddingLeft: 34, paddingRight: 14, borderRadius: 8, border: `1px solid ${intakeSearchFocused ? "#3B82F6" : "#E2E8F0"}`, background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }} />
                </div>
                {[{ val: intakeServiceFilter, set: setIntakeServiceFilter, opts: ["EAS", "MTS", "Event Medical Standby", "Workplace Medical Standby"], placeholder: "Service Type" },
                  { val: intakeTierFilter, set: setIntakeTierFilter, opts: ["Basic", "Advanced", "Critical"], placeholder: "Service Tier" }].map(({ val, set, opts, placeholder }) => (
                  <div key={placeholder} style={{ position: "relative" }}>
                    <select value={val} onChange={(e) => set(e.target.value)} style={{ height: 38, paddingLeft: 12, paddingRight: 32, borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: val ? "#1E293B" : "#94A3B8", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" }}>
                      <option value="">{placeholder}</option>{opts.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                  </div>
                ))}
              </div>
              <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                      {["Reference", "Customer Name", "Organisation", "Service Type", "Tier", "Preferred Date", "Status", "Time in Queue", "Action"].map((col) => (
                        <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" }}>{col}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filteredIntakes.length === 0 ? (
                        <tr><td colSpan={9} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: "'Inter', sans-serif" }}>No submissions match the current filters.</td></tr>
                      ) : filteredIntakes.map((row, i) => (
                        <tr key={row.ref}
                          style={{ borderBottom: i < filteredIntakes.length - 1 ? "1px solid #E2E8F0" : "none", background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF", height: 48 }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#F1F5F9")}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 1 ? "#F8FAFC" : "#FFFFFF")}>
                          <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 500, color: "#1E293B", letterSpacing: "0.02em", fontFamily: "'Inter', sans-serif" }}>{row.ref}</span></td>
                          <td style={tdStyle}><span style={cellText}>{row.name}</span></td>
                          <td style={tdStyle}><span style={{ ...cellText, color: row.org === "—" ? "#94A3B8" : "#1E293B" }}>{row.org}</span></td>
                          <td style={tdStyle}><span style={cellText}>{row.serviceType}</span></td>
                          <td style={tdStyle}><TierBadge tier={row.tier} /></td>
                          <td style={tdStyle}><span style={cellText}>{row.date}</span></td>
                          <td style={tdStyle}><IntakeStatusBadge status={row.status} /></td>
                          <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 500, color: queueColor(row.queueMinutes), fontFamily: "'Inter', sans-serif" }}>{formatQueue(row.queueMinutes)}</span></td>
                          <td style={tdStyle}>
                            <button onClick={() => { setSelectedIntake(row); setView("detail"); }}
                              style={{ height: 32, padding: "0 14px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transition: "background 0.12s" }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#0F172A")}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E293B")}>Review</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Showing 1–{filteredIntakes.length} of {filteredIntakes.length} result{filteredIntakes.length !== 1 ? "s" : ""}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button disabled style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", opacity: 0.4 }}><ChevronLeft size={14} color="#64748B" /></button>
                    <button style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #1E293B", background: "#1E293B", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>1</span></button>
                    <button disabled style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", opacity: 0.4 }}><ChevronRight size={14} color="#64748B" /></button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Intake detail */}
          {activePage === "queue" && view === "detail" && selectedIntake && (
            <IntakeDetail intake={selectedIntake} onBack={() => { setView("queue"); setSelectedIntake(null); }}
              onConfirmed={(bkg) => { setActiveBookingRef(bkg); setView("booking-created"); setActivePage("bookings"); }}
              onRejected={() => { setView("queue"); setSelectedIntake(null); }} addToast={addToast} />
          )}

          {/* Booking-created confirmation */}
          {view === "booking-created" && (
            <div>
              <button onClick={() => { setView("booking-list"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: 14, fontFamily: "'Inter', sans-serif", padding: 0, marginBottom: 24 }}>
                <ArrowLeft size={15} /> Bookings
              </button>
              <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "48px 32px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.10)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><CheckCircle2 size={28} color="#22C55E" /></div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>Booking Created</h2>
                <p style={{ fontSize: 14, color: "#64748B", marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>The booking has been confirmed and assigned a reference number.</p>
                <div style={{ display: "inline-block", padding: "10px 24px", borderRadius: 8, background: "#F1F5F9", border: "1px solid #E2E8F0" }}>
                  <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2, fontFamily: "'Inter', sans-serif" }}>Booking Reference</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif" }}>{activeBookingRef}</p>
                </div>
              </div>
            </div>
          )}

          {/* Bookings list */}
          {activePage === "bookings" && view === "booking-list" && (
            <BookingList onView={(ref) => { setActiveBookingRef(ref); setView("booking-detail"); }} />
          )}

          {/* Booking detail */}
          {activePage === "bookings" && view === "booking-detail" && (
            <BookingDetail
              bookingRef={activeBookingRef}
              onBack={() => setView("booking-list")}
              onViewIntake={(ref) => {
                setSelectedIntake(INTAKES.find((i) => i.ref === ref) ?? null);
                setActivePage("queue");
                setView("detail");
              }}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        select option { color: #1E293B; }
        textarea::placeholder, input::placeholder { color: #94A3B8; }
      `}</style>
    </div>
  );
}

