import React, { useState } from 'react';
import { Search, Users, Eye, EyeOff } from 'lucide-react';
import api from '../../api';
import { useToast } from '../../context/ToastContext';

const ROLES = ["Quotations", "Field Crew", "Accounts Receivable", "Accounts Payable", "Managing Director"];

// Maps the display labels above to the role slugs the backend's registerSchema expects.
const ROLE_SLUGS = {
  "Quotations": "quotations_specialist",
  "Field Crew": "field_crew",
  "Accounts Receivable": "ar_specialist",
  "Accounts Payable": "ap_specialist",
  "Managing Director": "managing_director",
};

const INITIAL_ACCOUNTS = [
  { name: "Camilla Cruz", email: "camilla@efar.com.sg", role: "Quotations",        status: "Online",  lastLogin: "Active now"  },
  { name: "Ravi Kumar",   email: "ravi@efar.com.sg",    role: "Field Crew",        status: "Offline", lastLogin: "2 hours ago" },
  { name: "Sarah Lee",    email: "sarah@efar.com.sg",   role: "Accounts Receivable", status: "Online",  lastLogin: "15 mins ago" },
  { name: "Chloe Wong",   email: "chloe@efar.com.sg",   role: "Accounts Payable",  status: "Offline", lastLogin: "Yesterday"   },
  { name: "Doris Tan",    email: "doris@efar.com.sg",   role: "Managing Director", status: "Online",  lastLogin: "Active now"  },
];

function AddUserModal({ onClose, onAdd }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    const errors = {};
    if (!name.trim()) errors.name = "Full name is required.";

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      errors.email = "A valid email is required.";
    } else if (!trimmedEmail.toLowerCase().endsWith("@efar.com.sg")) {
      errors.email = "Invalid email. Only @efar.com.sg email addresses are allowed.";
    }

    const hasDigit = /\d/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
    if (!password || password.length < 8 || !hasDigit || !hasSpecialChar) {
      errors.password = "Password must be at least 8 characters long and contain at least one number and one special character.";
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setGeneralError("");
      if (errors.email) toast.error(errors.email);
      if (errors.password) toast.error(errors.password);
      return;
    }

    setFieldErrors({});
    setGeneralError("");
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        role: ROLE_SLUGS[role],
      });
      const newUser = data.data.user;
      onAdd({ id: newUser.id, name: newUser.name, email: newUser.email, role, status: "Offline", lastLogin: "Just added" });
      toast.success(`Account created for ${newUser.name}.`);
      onClose();
    } catch (err) {
      const backendErrors = err.response?.data?.errors;
      if (err.response?.status === 400 && Array.isArray(backendErrors)) {
        const mapped = {};
        backendErrors.forEach((e) => { if (e.field) mapped[e.field] = e.message; });
        setFieldErrors(mapped);
      } else {
        const message = err.response?.data?.message || "Something went wrong while creating the account. Please try again.";
        setGeneralError(message);
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inp = (hasError) => ({ width: "100%", height: 38, padding: "0 12px", borderRadius: 8, border: `1px solid ${hasError ? "#EF4444" : "#E2E8F0"}`, background: "#F8FAFC", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" });
  const lbl = { fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: "'Inter', sans-serif", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.04em" };
  const fieldErr = { fontSize: 12, color: "#EF4444", fontFamily: "'Inter', sans-serif", margin: "6px 0 0" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-user-heading" style={{ background: "#FFFFFF", borderRadius: 16, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 id="add-user-heading" style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Add New User</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, borderRadius: 6, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={lbl}>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" style={inp(!!fieldErrors.name)} />
            {fieldErrors.name && <p style={fieldErr}>{fieldErrors.name}</p>}
          </div>
          <div>
            <label style={lbl}>Email Address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. john@efar.com.sg" style={inp(!!fieldErrors.email)} />
            {fieldErrors.email && <p style={fieldErr}>{fieldErrors.email}</p>}
          </div>
          <div>
            <label style={lbl}>Temporary Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 chars, 1 number, 1 special character"
                style={{ ...inp(!!fieldErrors.password), paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 6, borderRadius: 6, cursor: "pointer", color: "#94A3B8", display: "flex" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && <p style={fieldErr}>{fieldErrors.password}</p>}
          </div>
          <div>
            <label style={lbl}>Role</label>
            <div style={{ position: "relative" }}>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inp(!!fieldErrors.role), appearance: "none", cursor: "pointer", paddingRight: 36 }}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            {fieldErrors.role && <p style={fieldErr}>{fieldErrors.role}</p>}
          </div>
          {generalError && <p role="alert" style={{ fontSize: 12, color: "#EF4444", fontFamily: "'Inter', sans-serif", margin: 0, padding: "10px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA" }}>{generalError}</p>}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={submitting} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, fontWeight: 500, color: "#64748B", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: "#1E293B", fontSize: 13, fontWeight: 600, color: "#FFFFFF", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily: "'Inter', sans-serif" }}>{submitting ? "Adding…" : "Add User"}</button>
        </div>
      </div>
    </div>
  );
}

const ACTION_BUTTON_VARIANTS = {
  destructive: { color: "#EF4444", hoverBg: "rgba(239,68,68,0.1)" },
  info:        { color: "#3B82F6", hoverBg: "rgba(59,130,246,0.1)" },
  neutral:     { color: "#64748B", hoverBg: "#F1F5F9" },
};

function ActionButton({ variant, onClick, disabled, children }) {
  const [hover, setHover] = useState(false);
  const { color, hoverBg } = ACTION_BUTTON_VARIANTS[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: !disabled && hover ? hoverBg : "transparent", border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontSize: 13, fontWeight: 500, color, fontFamily: "'Inter', sans-serif", padding: "6px 12px", borderRadius: 6, transition: "background 0.15s", whiteSpace: "nowrap" }}
    >
      {children}
    </button>
  );
}

function AccountsManagement() {
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const toast = useToast();

  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingEmail, setRemovingEmail] = useState(null);

  // Only rows created via Add New User in this session carry a real backend `id` -
  // the seeded demo rows above are UI mock data, not actual DB users, so removing
  // them is correctly rejected by the backend rather than silently faked here.
  async function handleRemove(row) {
    if (!row.id) {
      toast.error("This demo account isn't backed by a real user record, so it can't be removed.");
      return;
    }
    setRemovingEmail(row.email);
    try {
      await api.delete(`/users/${row.id}`);
      setAccounts((prev) => prev.filter((r) => r.email !== row.email));
      toast.success(`${row.name}'s account was removed.`);
    } catch (err) {
      const message = err.response?.data?.message || "Something went wrong while removing this account. Please try again.";
      toast.error(message);
    } finally {
      setRemovingEmail(null);
    }
  }

  const filtered = accounts.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    const matchRole = roleFilter === "All Roles" || r.role === roleFilter;
    const matchStatus = statusFilter === "All Statuses" || r.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const onlineCount = accounts.filter((r) => r.status === "Online").length;
  const lockedCount = accounts.filter((r) => r.status === "Locked").length;

  const selSty = { height: 32, padding: "0 28px 0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onAdd={(u) => setAccounts((prev) => [u, ...prev])}
        />
      )}

      {/* Action Bar Row */}
      <div style={{ background: "#FFFFFF", padding: "0 16px", height: 48, borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative", width: 320 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            style={{ width: "100%", height: 32, paddingLeft: 36, paddingRight: 12, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selSty}>
              <option>All Roles</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div style={{ position: "relative" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selSty}>
              <option>All Statuses</option>
              <option>Online</option>
              <option>Offline</option>
              <option>Locked</option>
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <button onClick={() => setShowAddModal(true)} style={{ height: 32, padding: "0 16px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>Add New User</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Users</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 6 }}>{accounts.length}</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{accounts.filter((r) => r.role.includes("Admin") || r.role === "Managing Director").length} admin, {accounts.filter((r) => r.role === "Field Crew").length} crew.</p>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Currently Online</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#22C55E", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 6 }}>{onlineCount}</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Across active sessions.</p>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Security Alerts</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: lockedCount > 0 ? "#EF4444" : "#22C55E", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 6 }}>{lockedCount}</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{lockedCount > 0 ? `${lockedCount} account${lockedCount > 1 ? "s" : ""} locked due to failed logins.` : "No locked accounts."}</p>
        </div>
      </div>

      {/* User Directory */}
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>User Directory</h2>
          <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{filtered.length} of {accounts.length} users</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["User Info", "Role", "Current Status", "Last Login", "Actions"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>
                  No users match your filters.
                </td>
              </tr>
            ) : filtered.map((row, i) => {
              const dotColor = row.status === "Online" ? "#22C55E" : row.status === "Locked" ? "#EF4444" : "#64748B";
              return (
                <tr key={row.email} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F1F5F9" : "none", height: 52, background: "#FFFFFF" }}>
                  <td style={{ padding: "0 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.name}</span>
                      <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.role}</td>
                  <td style={{ padding: "0 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: row.status !== "Offline" ? 600 : 400, color: row.status === "Locked" ? "#EF4444" : "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.lastLogin}</td>
                  <td style={{ padding: "0 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 16 }}>
                      <ActionButton variant="neutral" disabled={removingEmail === row.email} onClick={() => handleRemove(row)}>
                        {removingEmail === row.email ? "Removing…" : "Remove"}
                      </ActionButton>
                      {row.status === "Online" && (
                        <ActionButton variant="destructive" onClick={() => setAccounts((prev) => prev.map((r) => r.email === row.email ? { ...r, status: "Offline", lastLogin: "Just now" } : r))}>Force Logout</ActionButton>
                      )}
                      {row.status === "Locked" && (
                        <ActionButton variant="info" onClick={() => setAccounts((prev) => prev.map((r) => r.email === row.email ? { ...r, status: "Offline" } : r))}>Unlock</ActionButton>
                      )}
                    </div>
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

export default function ManagementPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: 32, background: "#F8FAFC", minHeight: "100%" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Users size={20} color="#64748B" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Accounts Management</h1>
      </div>

      <AccountsManagement />
    </div>
  );
}