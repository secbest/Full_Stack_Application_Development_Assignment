import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks'
import { getRoleHome } from '@/router/routes'

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Already logged in - redirect straight to role home
  useEffect(() => {
    if (user) navigate(getRoleHome(user.role), { replace: true })
  }, [user, navigate])

  function validateEmail(val) {
    if (!val.trim()) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Enter a valid email address.'
    return ''
  }

  function validatePassword(val) {
    if (!val) return 'Password is required.'
    if (val.length < 6) return 'Password must be at least 6 characters.'
    return ''
  }

  function handleEmailChange(e) {
    setEmail(e.target.value)
    if (emailError) setEmailError(validateEmail(e.target.value))
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value)
    if (passwordError) setPasswordError(validatePassword(e.target.value))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const eErr = validateEmail(email)
    const pErr = validatePassword(password)
    setEmailError(eErr)
    setPasswordError(pErr)
    if (eErr || pErr) return

    setLoading(true)
    try {
      const decoded = await login(email, password)
      navigate(getRoleHome(decoded.role), { replace: true })
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Left branding panel (hidden on mobile, shown md+) ──────────────── */}
      <div
        className="relative hidden md:flex flex-col items-center justify-center"
        style={{ width: '60%', backgroundColor: '#1E293B', flexShrink: 0 }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Blue radial glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Brand content */}
        <div className="relative z-10 flex flex-col items-center gap-6 select-none">
          {/* Medical cross icon */}
          <div
            style={{
              width: 72,
              height: 72,
              border: '2px solid rgba(255,255,255,0.25)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-label="Medical cross">
              <rect x="15" y="4" width="10" height="32" rx="2" stroke="white" strokeWidth="2" />
              <rect x="4" y="15" width="32" height="10" rx="2" stroke="white" strokeWidth="2" />
            </svg>
          </div>

          {/* Name + tagline */}
          <div className="flex flex-col items-center gap-2">
            <span
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              EFAR
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.70)',
                textAlign: 'center',
                maxWidth: 280,
              }}
            >
              Digital Operations-to-Billing Platform
            </span>
          </div>

          <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.20)' }} />

          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.40)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Ambulance · Dispatch · Billing
          </p>
        </div>

        {/* Copyright */}
        <div
          className="absolute bottom-8 left-0 right-0 flex justify-center"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}
        >
          © 2026 EFAR. All rights reserved.
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center justify-center flex-1"
        style={{ backgroundColor: '#FFFFFF', padding: 48 }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#1E293B',
                marginBottom: 6,
                lineHeight: 1.2,
              }}
            >
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>Sign in to your account</p>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="login-email"
                style={{ fontSize: 14, fontWeight: 500, color: '#1E293B' }}
              >
                Email address
              </label>
              <input
                id="login-email"
                type="text"
                autoComplete="email"
                value={email}
                onChange={handleEmailChange}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => { setEmailFocused(false); setEmailError(validateEmail(email)) }}
                placeholder="sarah@efar.com.sg"
                style={{
                  height: 44,
                  padding: '0 14px',
                  borderRadius: 8,
                  border: `1px solid ${emailError ? '#EF4444' : emailFocused ? '#3B82F6' : '#E2E8F0'}`,
                  background: '#FFFFFF',
                  fontSize: 14,
                  color: '#1E293B',
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
              />
              {emailError && (
                <span style={{ fontSize: 12, color: '#EF4444' }}>{emailError}</span>
              )}
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="login-password"
                style={{ fontSize: 14, fontWeight: 500, color: '#1E293B' }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={handlePasswordChange}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => { setPasswordFocused(false); setPasswordError(validatePassword(password)) }}
                  placeholder="••••••••"
                  style={{
                    height: 44,
                    width: '100%',
                    padding: '0 44px 0 14px',
                    borderRadius: 8,
                    border: `1px solid ${passwordError ? '#EF4444' : passwordFocused ? '#3B82F6' : '#E2E8F0'}`,
                    background: '#FFFFFF',
                    fontSize: 14,
                    color: '#1E293B',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    lineHeight: 0,
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <span style={{ fontSize: 12, color: '#EF4444' }}>{passwordError}</span>
              )}
            </div>

            {/* Inline error */}
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  fontSize: 13,
                  color: '#EF4444',
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                height: 48,
                borderRadius: 8,
                backgroundColor: loading ? '#334155' : '#1E293B',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                transition: 'background-color 0.15s',
              }}
            >
              {loading ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ animation: 'spin 0.8s linear infinite' }}
                  >
                    <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <path
                      d="M8 2a6 6 0 0 1 6 6"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p style={{ marginTop: 16, fontSize: 12, color: '#64748B', textAlign: 'center' }}>
            Forgot password?{' '}
            <span style={{ color: '#94A3B8' }}>Contact your administrator.</span>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
