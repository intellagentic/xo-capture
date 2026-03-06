import React, { useState, useEffect, useMemo } from 'react'
import { X, Upload, Sparkles, FileText, Building2, FileText as FileIcon, Trash2, CheckCircle2, Music, Loader2, CheckCircle, Clock, AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Database, Calendar, Globe, TrendingUp, Menu, Settings, Moon, Sun, GripVertical, Copy, Edit2, Plus, Home, Zap, Heart, Star, Send, Check, Save, User, Users, Bell, Search, Mail, Phone, MapPin, Play, ExternalLink, Package, LogOut, Lock, Eye, EyeOff, Cloud, FolderOpen, ChevronLeft, HardDrive, MoreVertical, ToggleLeft, ToggleRight, History, RefreshCw, Image, FileSpreadsheet, FileType, File, Download, Link, Share2 } from 'lucide-react'
import logoLight from './assets/logo-light.png'
import logoDark from './assets/logo-dark.png'

// ============================================================
// XO PROTOTYPE - MAIN APP
// Three screens: Upload -> Enrich -> Results
// ============================================================

const API_BASE = 'https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod'

// Migrate contact: split legacy "name" into firstName/lastName if needed
function migrateContact(c) {
  if (c.firstName !== undefined || c.lastName !== undefined) return c
  const name = c.name || ''
  const spaceIdx = name.indexOf(' ')
  return {
    ...c,
    firstName: spaceIdx > 0 ? name.substring(0, spaceIdx) : name,
    lastName: spaceIdx > 0 ? name.substring(spaceIdx + 1) : '',
  }
}

// Auth helpers
function getAuthHeaders() {
  const token = localStorage.getItem('xo-token')
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  }
}

function isTokenExpired(token) {
  try {
    // JWT uses URL-safe base64: replace - with + and _ with / before decoding
    let b64 = token.split('.')[1]
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    while (b64.length % 4) b64 += '='
    const payload = JSON.parse(atob(b64))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

// ============================================================
// LOGIN SCREEN — Google OAuth + Email/Password fallback
// ============================================================
const GOOGLE_CLIENT_ID = '801271873723-7htidmimhfl2qbdl4jv5leap0tqvu8gh.apps.googleusercontent.com'

function LoginScreen({ onLogin }) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotPassword, setForgotPassword] = useState('')
  const [forgotConfirm, setForgotConfirm] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  // Load Google Identity Services library
  useEffect(() => {
    if (showEmailForm) return // Don't load if showing email form

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback
        })
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large', width: 360, text: 'signin_with' }
        )
      }
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup: remove the script if component unmounts
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [showEmailForm])

  const handleGoogleCallback = async (response) => {
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Google sign-in failed')
        setLoading(false)
        return
      }

      localStorage.setItem('xo-token', data.token)
      localStorage.setItem('xo-user', JSON.stringify(data.user))
      onLogin(data.user, data.token)
    } catch (err) {
      setError('Connection failed. Please try again.')
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Email and password are required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      localStorage.setItem('xo-token', data.token)
      localStorage.setItem('xo-user', JSON.stringify(data.user))
      onLogin(data.user, data.token)
    } catch (err) {
      setError('Connection failed. Please try again.')
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')

    if (!forgotEmail) { setForgotError('Email is required'); return }
    if (!forgotPassword || forgotPassword.length < 8) { setForgotError('Password must be at least 8 characters'); return }
    if (forgotPassword !== forgotConfirm) { setForgotError('Passwords do not match'); return }

    setForgotLoading(true)
    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, new_password: forgotPassword })
      })
      const data = await response.json()
      if (!response.ok) { setForgotError(data.error || 'Reset failed'); setForgotLoading(false); return }
      setForgotSuccess('Password reset successfully. You can now sign in.')
      setForgotLoading(false)
    } catch {
      setForgotError('Connection failed. Please try again.')
      setForgotLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px 14px 48px',
    background: '#ffffff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '15px',
    color: '#1a1a1a',
    outline: 'none',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box'
  }

  const inputFocus = (e) => {
    e.target.style.borderColor = '#dc2626'
    e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'
  }
  const inputBlur = (e) => {
    e.target.style.borderColor = '#e5e7eb'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* Same header as main app */}
      <header className="header" style={{ position: 'relative' }}>
        <div className="header-inner">
          <div className="header-left">
            <div className="logo-box">XO</div>
            <div className="header-title">
              <h1>
                <span>Capture</span>
                <span className="version-badge">Rapid Prototype</span>
              </h1>
            </div>
          </div>
          <div className="header-right">
            <img src={logoLight} alt="Intellagentic" style={{ height: '26px' }} />
          </div>
        </div>
      </header>

      {/* Form area */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
      }}>
        <div style={{ width: '100%', maxWidth: '440px', animation: 'slideUp 0.6s ease-out' }}>
          {/* Invitation heading */}
          <p style={{
            textAlign: 'center', marginBottom: '24px',
            fontSize: '1.05rem', fontWeight: 400, color: '#9ca3af',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            Welcome
          </p>

          <div style={{
            background: '#ffffff', padding: '40px', borderRadius: '20px',
            border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
          }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#dc2626', fontSize: '14px'
              }}>
                <AlertTriangle size={16} /> {error}
              </div>
            )}

            {!showEmailForm ? (
              <>
                {/* Google Sign-In Button */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', minHeight: '44px' }}>
                  <div id="google-signin-btn"></div>
                  {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Signing in...
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0'
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                  <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                </div>

                {/* Email fallback link */}
                <p style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setShowEmailForm(true); setError('') }}
                    style={{
                      background: 'none', border: 'none', color: '#6b7280', fontSize: '14px',
                      cursor: 'pointer', textDecoration: 'underline', padding: 0
                    }}
                  >
                    Sign in with email instead
                  </button>
                </p>
              </>
            ) : (
              <>
                {/* Email/Password Form */}
                <form onSubmit={handleSubmit}>
                  {/* Email */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                      <input type="email" placeholder="you@company.com" required value={email}
                        onChange={(e) => { setEmail(e.target.value); setError('') }}
                        style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ marginBottom: '28px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        required value={password}
                        onChange={(e) => { setPassword(e.target.value); setError('') }}
                        style={{ ...inputStyle, paddingRight: '48px' }} onFocus={inputFocus} onBlur={inputBlur} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex', alignItems: 'center' }}>
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={loading}
                    style={{
                      width: '100%', padding: '16px', background: '#dc2626', border: 'none', borderRadius: '12px',
                      color: 'white', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease', letterSpacing: '0.02em', opacity: loading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => { if (!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 32px rgba(220,38,38,0.3)' } }}
                    onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none' }}>
                    {loading && <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />}
                    {loading ? 'Signing in...' : 'Continue'}
                  </button>
                </form>

                {/* Forgot Password link */}
                <p style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotError(''); setForgotSuccess('') }}
                    style={{
                      background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px',
                      cursor: 'pointer', textDecoration: 'underline', padding: 0
                    }}
                  >
                    Forgot Password?
                  </button>
                </p>

                {/* Back to Google */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 8px'
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                  <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                </div>
                <p style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setShowEmailForm(false); setError('') }}
                    style={{
                      background: 'none', border: 'none', color: '#6b7280', fontSize: '14px',
                      cursor: 'pointer', textDecoration: 'underline', padding: 0
                    }}
                  >
                    Sign in with Google
                  </button>
                </p>
              </>
            )}
          </div>

          {/* Forgot Password Form */}
          {showForgot && (
            <div style={{
              marginTop: '16px', background: '#ffffff', padding: '32px', borderRadius: '20px',
              border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Reset Password</h3>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {forgotError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  color: '#dc2626', fontSize: '13px'
                }}>
                  <AlertTriangle size={14} /> {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  color: '#16a34a', fontSize: '13px'
                }}>
                  <CheckCircle size={14} /> {forgotSuccess}
                </div>
              )}

              <form onSubmit={handleForgotSubmit}>
                {/* Email */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input type="email" required value={forgotEmail}
                      onChange={(e) => { setForgotEmail(e.target.value); setForgotError('') }}
                      placeholder="you@company.com"
                      style={{ ...inputStyle, padding: '12px 14px 12px 42px', fontSize: '14px' }}
                      onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>

                {/* New Password */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input type="password" required value={forgotPassword}
                      onChange={(e) => { setForgotPassword(e.target.value); setForgotError('') }}
                      placeholder="Min. 8 characters"
                      style={{ ...inputStyle, padding: '12px 14px 12px 42px', fontSize: '14px' }}
                      onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>

                {/* Confirm Password */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input type="password" required value={forgotConfirm}
                      onChange={(e) => { setForgotConfirm(e.target.value); setForgotError('') }}
                      placeholder="Re-enter password"
                      style={{ ...inputStyle, padding: '12px 14px 12px 42px', fontSize: '14px' }}
                      onFocus={inputFocus} onBlur={inputBlur} />
                  </div>
                </div>

                <button type="submit" disabled={forgotLoading}
                  style={{
                    width: '100%', padding: '14px', background: '#dc2626', border: 'none', borderRadius: '12px',
                    color: 'white', fontSize: '15px', fontWeight: '600', cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    opacity: forgotLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}>
                  {forgotLoading && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ============================================================
// SHARE LINK MODAL — Magic link management for client access
// ============================================================
function ShareLinkModal({ clientId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [linkData, setLinkData] = useState({ token: null, url: null, expires_at: null })
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const fetchLink = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/magic-link?client_id=${clientId}`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setLinkData(data)
      } else {
        setError('Failed to load link')
      }
    } catch {
      setError('Connection failed')
    }
    setLoading(false)
  }

  useEffect(() => { fetchLink() }, [clientId])

  const generateLink = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/magic-link`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ client_id: clientId })
      })
      if (res.ok) {
        const data = await res.json()
        setLinkData(data)
      } else {
        setError('Failed to generate link')
      }
    } catch {
      setError('Connection failed')
    }
    setGenerating(false)
  }

  const revokeLink = async () => {
    setError('')
    try {
      const res = await fetch(`${API_BASE}/auth/magic-link?client_id=${clientId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (res.ok) {
        setLinkData({ token: null, url: null, expires_at: null })
      } else {
        setError('Failed to revoke link')
      }
    } catch {
      setError('Connection failed')
    }
  }

  const copyLink = () => {
    if (linkData.url) {
      navigator.clipboard.writeText(linkData.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-card, #fff)', borderRadius: '16px',
        padding: '1.5rem', width: '90%', maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link size={18} /> Share Client Access
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)', padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Generate a magic link to share with this client. Anyone with the link can access the workspace — no login required.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#dc2626' }} />
          </div>
        ) : (
          <>
            {error && (
              <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                {error}
              </div>
            )}

            {linkData.token ? (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--bg-secondary, #f3f4f6)', borderRadius: '8px',
                  padding: '0.625rem 0.75rem', marginBottom: '0.5rem'
                }}>
                  <input
                    readOnly
                    value={linkData.url}
                    style={{
                      flex: 1, background: 'none', border: 'none', fontSize: '0.75rem',
                      color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={copyLink}
                    style={{
                      background: copied ? '#22c55e' : '#dc2626', border: 'none', borderRadius: '6px',
                      color: 'white', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem',
                      transition: 'background 0.2s', whiteSpace: 'nowrap'
                    }}
                  >
                    {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>
                  Expires: {linkData.expires_at ? new Date(linkData.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
                </div>
              </div>
            ) : (
              <div style={{
                padding: '1rem', textAlign: 'center', background: 'var(--bg-secondary, #f3f4f6)',
                borderRadius: '8px', marginBottom: '1rem', color: 'var(--text-muted, #9ca3af)', fontSize: '0.8125rem'
              }}>
                No active link
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={generateLink}
                disabled={generating}
                className="action-btn red"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Link size={14} />}
                {linkData.token ? 'Regenerate' : 'Generate Link'}
              </button>
              {linkData.token && (
                <button
                  onClick={revokeLink}
                  className="action-btn"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={14} /> Revoke
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}


// ============================================================
// DASHBOARD SCREEN — Admin multi-client view
// ============================================================
function DashboardScreen({ onSelectClient, onCreateClient, isAdmin, isPartner, partners }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteConfirmClient, setDeleteConfirmClient] = useState(null)
  const [shareLinkClient, setShareLinkClient] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPartner, setFilterPartner] = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')

  const industries = useMemo(() => [...new Set(clients.map(c => c.industry).filter(Boolean))].sort(), [clients])

  const filteredClients = useMemo(() => {
    let result = clients
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.industry || '').toLowerCase().includes(q)
      )
    }
    if (filterPartner === 'direct') {
      result = result.filter(c => !c.partner_id)
    } else if (filterPartner) {
      result = result.filter(c => String(c.partner_id) === filterPartner)
    }
    if (filterIndustry) {
      result = result.filter(c => c.industry === filterIndustry)
    }
    return result
  }, [clients, searchQuery, filterPartner, filterIndustry])

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_BASE}/clients/list`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients || [])
      } else {
        setError('Failed to load clients')
      }
    } catch {
      setError('Connection failed')
    }
    setLoading(false)
  }

  const deleteClient = async (client) => {
    try {
      const res = await fetch(`${API_BASE}/clients?client_id=${client.client_id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (res.ok) {
        setDeleteConfirmClient(null)
        fetchClients()
      } else {
        alert('Failed to delete client')
      }
    } catch {
      alert('Failed to delete client')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#dc2626', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted, #6b7280)' }}>Loading clients...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <AlertTriangle size={32} style={{ color: '#dc2626', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted, #6b7280)' }}>{error}</p>
        <button onClick={fetchClients} className="action-btn" style={{ marginTop: '1rem' }}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <Building2 size={48} style={{ color: 'var(--text-muted, #9ca3af)', margin: '0 auto 1rem' }} />
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No clients yet</h3>
        <p style={{ color: 'var(--text-muted, #6b7280)', marginBottom: '1.5rem' }}>Create your first client to get started.</p>
        <button onClick={onCreateClient} className="action-btn red" style={{ margin: '0 auto' }}>
          <Plus size={16} /> Create First Client
        </button>
      </div>
    )
  }

  const borderColor = (status) => {
    if (status === 'complete' || status === 'completed') return '#22c55e'
    if (status === 'error' || status === 'failed') return '#dc2626'
    if (status === 'processing') return '#eab308'
    return '#d1d5db'
  }

  const enrichedClients = filteredClients.filter(c => ['complete', 'completed', 'processing'].includes(c.enrichment_status))
  const needsEnrichment = filteredClients.filter(c => !['complete', 'completed', 'processing'].includes(c.enrichment_status))

  const renderRow = (client) => (
    <div
      key={client.id}
      onClick={() => onSelectClient(client)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.55rem 0.875rem',
        cursor: 'pointer',
        transition: 'background 0.15s',
        borderLeft: `3px solid ${borderColor(client.enrichment_status)}`,
        borderBottom: '1px solid var(--border-color, #e5e7eb)',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-card-alt, #fafafa)'
        e.currentTarget.querySelectorAll('[data-hover-btn]').forEach(el => el.style.opacity = '1')
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.querySelectorAll('[data-hover-btn]').forEach(el => el.style.opacity = '0')
      }}
    >
      {client.icon_url ? (
        <img src={client.icon_url} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
          background: 'var(--bg-secondary, #f3f4f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 700, color: '#dc2626'
        }}>
          {(client.company_name || '?')[0].toUpperCase()}
        </div>
      )}
      <div style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {client.company_name}
        </span>
        {isAdmin && client.partner_name && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #9ca3af)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            via {client.partner_name}
          </span>
        )}
      </div>
      {client.industry && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {client.industry}
        </span>
      )}
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
        <FolderOpen size={12} /> {client.source_count}
      </span>
      {client.enrichment_date && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #9ca3af)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {new Date(client.enrichment_date).toLocaleDateString()}
        </span>
      )}
      <button
        data-hover-btn
        onClick={(e) => { e.stopPropagation(); setShareLinkClient(client) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem',
          color: 'var(--text-muted, #9ca3af)', borderRadius: '4px', display: 'flex', flexShrink: 0,
          opacity: 0, transition: 'opacity 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
        title="Share link"
      >
        <ExternalLink size={13} />
      </button>
      {isAdmin && (
        <button
          data-hover-btn
          onClick={(e) => { e.stopPropagation(); setDeleteConfirmClient(client) }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem',
            color: 'var(--text-muted, #9ca3af)', borderRadius: '4px', display: 'flex', flexShrink: 0,
            opacity: 0, transition: 'opacity 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #9ca3af)'}
          title="Delete client"
        >
          <Trash2 size={13} />
        </button>
      )}
      <ChevronRight size={14} style={{ color: 'var(--text-muted, #9ca3af)', flexShrink: 0 }} />
    </div>
  )

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header row: title + search + new client */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {isPartner && !isAdmin ? 'My Clients' : 'All Clients'} <span style={{ fontWeight: 400, color: 'var(--text-muted, #6b7280)', fontSize: '0.8125rem' }}>({filteredClients.length})</span>
        </h2>
        <div style={{ position: 'relative', flex: '0 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #9ca3af)' }} />
          <input
            type="text"
            placeholder="Filter clients..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.3rem 0.5rem 0.3rem 1.75rem', fontSize: '0.75rem',
              border: '1px solid var(--border-color, #d1d5db)', borderRadius: '6px',
              background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>
        {isAdmin && (
          <select
            value={filterPartner}
            onChange={e => setFilterPartner(e.target.value)}
            style={{
              padding: '0.3rem 0.5rem', fontSize: '0.75rem',
              border: '1px solid var(--border-color, #d1d5db)', borderRadius: '6px',
              background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary)',
              outline: 'none', flex: '0 0 auto'
            }}
          >
            <option value="">All Partners</option>
            <option value="direct">Direct (Intellagentic)</option>
            {partners.map(p => <option key={p.id} value={String(p.id)}>{p.company || p.name}</option>)}
          </select>
        )}
        {industries.length > 0 && (
          <select
            value={filterIndustry}
            onChange={e => setFilterIndustry(e.target.value)}
            style={{
              padding: '0.3rem 0.5rem', fontSize: '0.75rem',
              border: '1px solid var(--border-color, #d1d5db)', borderRadius: '6px',
              background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary)',
              outline: 'none', flex: '0 0 auto'
            }}
          >
            <option value="">All Industries</option>
            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onCreateClient} className="action-btn red">
          <Plus size={14} /> New Client
        </button>
      </div>

      {/* Client list */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        {enrichedClients.map(renderRow)}
        {enrichedClients.length > 0 && needsEnrichment.length > 0 && (
          <div style={{
            padding: '0.3rem 0.875rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-muted, #9ca3af)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'var(--bg-card-alt, #fafafa)',
            borderBottom: '1px solid var(--border-color, #e5e7eb)'
          }}>
            Needs Enrichment
          </div>
        )}
        {needsEnrichment.map(renderRow)}
      </div>

      {filteredClients.length === 0 && clients.length > 0 && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.8125rem' }}>No clients match "{searchQuery}"</p>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {shareLinkClient && (
        <ShareLinkModal
          clientId={shareLinkClient.client_id}
          onClose={() => setShareLinkClient(null)}
        />
      )}

      {deleteConfirmClient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 100
        }}
          onClick={() => setDeleteConfirmClient(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', width: '90%',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Trash2 size={32} style={{ color: '#ef4444', margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.5rem' }}>
              Delete {deleteConfirmClient.company_name}?
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#444444', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              This will permanently remove the client and all their sources, enrichments, and branding. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmClient(null)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db', color: '#333333',
                  cursor: 'pointer', fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteClient(deleteConfirmClient)}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem',
                  background: '#ef4444', border: 'none', color: '#ffffff',
                  cursor: 'pointer', fontWeight: 600
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Restore session synchronously before first render
function getInitialAuth() {
  try {
    const token = localStorage.getItem('xo-token')
    const savedUser = localStorage.getItem('xo-user')
    if (token && savedUser && !isTokenExpired(token)) {
      return { loggedIn: true, user: JSON.parse(savedUser), token }
    }
  } catch {
    // JSON parse or localStorage error -- fall through
  }
  localStorage.removeItem('xo-token')
  localStorage.removeItem('xo-user')
  return { loggedIn: false, user: null, token: null }
}

export default function App() {
  // Auth state -- restored from localStorage synchronously
  const [initialAuth] = useState(getInitialAuth)
  const [isLoggedIn, setIsLoggedIn] = useState(initialAuth.loggedIn)
  const [user, setUser] = useState(initialAuth.user)
  const [authToken, setAuthToken] = useState(initialAuth.token)

  // Model preference state
  const [preferredModel, setPreferredModel] = useState(
    initialAuth.user?.preferred_model || 'claude-sonnet-4-5-20250929'
  )

  // Admin / Partner state
  const [isAdmin, setIsAdmin] = useState(initialAuth.user?.is_admin || false)
  const [isPartner, setIsPartner] = useState(initialAuth.user?.is_partner || false)

  // Magic token URL handling — loading state
  const [magicTokenLoading, setMagicTokenLoading] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return !!params.get('token')
  })

  const handleLogin = (userData, token) => {
    setUser(userData)
    setAuthToken(token)
    setIsLoggedIn(true)
    const admin = !!userData.is_admin
    const partner = !!userData.is_partner
    setIsAdmin(admin)
    setIsPartner(partner)
    if (userData.preferred_model) setPreferredModel(userData.preferred_model)
    if (admin || partner) {
      setCurrentScreen('dashboard')
    } else if (userData.is_client && userData.client_id) {
      setClientId(userData.client_id)
      localStorage.setItem('xo-client-id', userData.client_id)
      setCurrentScreen('upload')
    }
  }

  const saveModelPreference = async (model) => {
    setPreferredModel(model)
    try {
      await fetch(`${API_BASE}/auth/preferences`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ preferred_model: model })
      })
    } catch (err) {
      console.error('Failed to save model preference:', err)
    }
  }

  const handleLogout = () => {
    setUser(null)
    setAuthToken(null)
    setIsLoggedIn(false)
    setIsAdmin(false)
    setIsPartner(false)
    setClientId(null)
    localStorage.removeItem('xo-token')
    localStorage.removeItem('xo-user')
    localStorage.removeItem('xo-client-id')
    setCurrentScreen('upload')
  }

  const [currentScreen, setCurrentScreen] = useState(() => {
    return (initialAuth.user?.is_admin || initialAuth.user?.is_partner) ? 'dashboard' : 'upload'
  }) // dashboard | upload | enrich | results | skills | configuration
  const [showModal, setShowModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [clientId, setClientId] = useState(() => localStorage.getItem('xo-client-id') || null)
  const [companyData, setCompanyData] = useState({
    name: '',
    website: '',
    contacts: [],
    addresses: [],
    industry: '',
    description: '',
    painPoint: '',
    logoUrl: null,
    iconUrl: null
  })

  // Partners state (for admin partner management & dropdowns)
  const [partners, setPartners] = useState([])

  // Theme state - persisted to localStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('xo-theme') || 'light'
  })

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('xo-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  // Persist clientId to localStorage
  useEffect(() => {
    if (clientId) localStorage.setItem('xo-client-id', clientId)
  }, [clientId])

  // Magic token URL handling — validate on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const magicToken = params.get('token')
    if (!magicToken) return

    const validateToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: magicToken })
        })
        const data = await res.json()
        if (res.ok && data.token) {
          localStorage.setItem('xo-token', data.token)
          localStorage.setItem('xo-user', JSON.stringify(data.user))
          setUser(data.user)
          setAuthToken(data.token)
          setIsLoggedIn(true)
          setIsAdmin(false)
          setIsPartner(false)
          if (data.user.client_id) {
            setClientId(data.user.client_id)
            localStorage.setItem('xo-client-id', data.user.client_id)
          }
          setCurrentScreen('upload')
        }
      } catch (err) {
        console.error('Magic token validation failed:', err)
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      setMagicTokenLoading(false)
    }
    validateToken()
  }, [])

  // Custom buttons state - synced with PostgreSQL via API
  const [configButtons, setConfigButtons] = useState(DEFAULT_BUTTONS)
  const [buttonsLoaded, setButtonsLoaded] = useState(false)

  // Fetch buttons, client data, and partners from API after login
  useEffect(() => {
    if (isLoggedIn && !buttonsLoaded) {
      fetchButtons()
    }
    if (isLoggedIn) {
      fetchExistingClient()
      fetchPartners()
    }
  }, [isLoggedIn])

  const fetchPartners = async () => {
    try {
      const res = await fetch(`${API_BASE}/partners`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setPartners(data.partners || [])
      }
    } catch (err) {
      console.error('Failed to fetch partners:', err)
    }
  }

  const fetchButtons = async () => {
    try {
      const response = await fetch(`${API_BASE}/buttons`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        if (data.buttons && data.buttons.length > 0) {
          setConfigButtons(data.buttons)
        }
      }
    } catch (err) {
      console.error('Failed to fetch buttons:', err)
    }
    setButtonsLoaded(true)
  }

  const fetchExistingClient = async () => {
    try {
      const url = clientId
        ? `${API_BASE}/clients?client_id=${clientId}`
        : `${API_BASE}/clients`
      const response = await fetch(url, { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        // Build contacts array: prefer API contacts, fallback to legacy flat fields
        let contacts = (data.contacts || []).map(migrateContact)
        if (!contacts.length && (data.contactName || data.contactEmail)) {
          const legacyName = data.contactName || ''
          const spaceIdx = legacyName.indexOf(' ')
          contacts = [{ firstName: spaceIdx > 0 ? legacyName.substring(0, spaceIdx) : legacyName, lastName: spaceIdx > 0 ? legacyName.substring(spaceIdx + 1) : '', title: data.contactTitle || '', email: data.contactEmail || '', phone: data.contactPhone || '', linkedin: data.contactLinkedIn || '' }]
        }
        setCompanyData({
          name: data.company_name || '',
          website: data.website || '',
          contacts,
          addresses: data.addresses || [],
          industry: data.industry || '',
          description: data.description || '',
          painPoint: data.painPoint || '',
          logoUrl: data.logo_url || null,
          iconUrl: data.icon_url || null,
          partner_id: data.partner_id || null,
          intellagentic_lead: data.intellagentic_lead || false
        })
        if (data.client_id && !clientId) {
          setClientId(data.client_id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch existing client:', err)
    }
  }

  const saveButtons = async (newButtons) => {
    setConfigButtons(newButtons)
    try {
      await fetch(`${API_BASE}/buttons/sync`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ buttons: newButtons })
      })
    } catch (err) {
      console.error('Failed to save buttons:', err)
    }
  }

  const navigateTo = (screen) => {
    setCurrentScreen(screen)
    setShowSidebar(false)
  }

  // Create or update client when company info is saved
  const handleClientCreate = async (data) => {
    try {
      if (clientId) {
        // Update existing client
        const response = await fetch(`${API_BASE}/clients`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            client_id: clientId,
            company_name: data.name,
            website: data.website,
            contacts: data.contacts || [],
            addresses: data.addresses || [],
            industry: data.industry,
            description: data.description,
            painPoint: data.painPoint,
            partner_id: data.partner_id,
            intellagentic_lead: data.intellagentic_lead
          })
        })
        if (response.ok) {
          console.log('Client updated:', clientId)
        }
      } else {
        // Create new client
        const response = await fetch(`${API_BASE}/clients`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            company_name: data.name,
            website: data.website,
            contacts: data.contacts || [],
            addresses: data.addresses || [],
            industry: data.industry,
            description: data.description,
            painPoint: data.painPoint,
            partner_id: data.partner_id,
            intellagentic_lead: data.intellagentic_lead
          })
        })
        if (response.ok) {
          const { client_id } = await response.json()
          setClientId(client_id)
          console.log('Client created on company save:', client_id)
        }
      }
    } catch (err) {
      console.error('Failed to save client:', err)
    }
  }

  // Dashboard: select an existing client and enter workspace
  const handleSelectClient = async (client) => {
    setClientId(client.client_id)
    localStorage.setItem('xo-client-id', client.client_id)
    // Fetch full company data
    try {
      const res = await fetch(`${API_BASE}/clients?client_id=${client.client_id}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        let contacts = (data.contacts || []).map(migrateContact)
        if (!contacts.length && (data.contactName || data.contactEmail)) {
          const legacyName = data.contactName || ''
          const spaceIdx = legacyName.indexOf(' ')
          contacts = [{ firstName: spaceIdx > 0 ? legacyName.substring(0, spaceIdx) : legacyName, lastName: spaceIdx > 0 ? legacyName.substring(spaceIdx + 1) : '', title: data.contactTitle || '', email: data.contactEmail || '', phone: data.contactPhone || '', linkedin: data.contactLinkedIn || '' }]
        }
        setCompanyData({
          name: data.company_name || '',
          website: data.website || '',
          contacts,
          addresses: data.addresses || [],
          industry: data.industry || '',
          description: data.description || '',
          painPoint: data.painPoint || '',
          logoUrl: data.logo_url || null,
          iconUrl: data.icon_url || null,
          partner_id: data.partner_id || null,
          intellagentic_lead: data.intellagentic_lead || false
        })
      }
    } catch (err) {
      console.error('Failed to fetch client:', err)
    }
    setCurrentScreen('upload')
  }

  // Dashboard: create new client
  const handleCreateNewClient = () => {
    setClientId(null)
    localStorage.removeItem('xo-client-id')
    setCompanyData({ name: '', website: '', contacts: [], addresses: [], industry: '', description: '', painPoint: '', logoUrl: null, iconUrl: null, partner_id: null, intellagentic_lead: false })

    setShowCompanyModal(true)
  }

  // After company modal save, navigate to workspace if coming from dashboard
  const handleClientCreateFromDashboard = async (data) => {
    await handleClientCreate(data)
    if (currentScreen === 'dashboard') {
      setCurrentScreen('upload')
    }
  }

  // Magic token loading gate
  if (magicTokenLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary, #fff)' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: '#dc2626', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.9375rem' }}>Validating access...</p>
        </div>
      </div>
    )
  }

  // Auth gate
  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <button
              onClick={() => setShowSidebar(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Menu size={24} />
            </button>
            <div className="logo-box">XO</div>
            <div className="header-title">
              <h1>
                <span className="header-title-desktop">Capture</span>
                <span className="header-title-mobile">Capture</span>
                <span className="version-badge">Rapid Prototype</span>
              </h1>
              {currentScreen === 'dashboard' && (
                <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isPartner && !isAdmin ? 'Partner Dashboard' : 'Client Dashboard'}
                </p>
              )}
            </div>
          </div>
          <div className="header-right">
            <img src={logoLight} alt="Intellagentic" style={{ height: '26px' }} />
          </div>
        </div>
      </header>

      {/* Sidebar */}
      {showSidebar && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setShowSidebar(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.25)',
              zIndex: 200
            }}
          />
          {/* Sidebar Panel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '220px',
              background: '#1a1a2e',
              zIndex: 201,
              boxShadow: '2px 0 8px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Sidebar Header */}
            <div style={{
              padding: '0.75rem 0.875rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '0.8rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Menu'}</span>
                  {user?.email && <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{user.email}</span>}
                </div>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  flexShrink: 0
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu Items */}
            <nav style={{ flex: 1, padding: '0.5rem 0' }}>
              {(isAdmin || isPartner) && (
                <>
                  <button
                    onClick={() => navigateTo('dashboard')}
                    style={{
                      width: '100%',
                      background: currentScreen === 'dashboard' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                      border: 'none',
                      borderLeft: currentScreen === 'dashboard' ? '3px solid #dc2626' : '3px solid transparent',
                      color: currentScreen === 'dashboard' ? '#dc2626' : '#ffffff',
                      padding: '0.6rem 0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                  >
                    <Building2 size={17} style={{ flexShrink: 0 }} />
                    {isPartner && !isAdmin ? 'My Clients' : 'All Clients'}
                  </button>
                  <div style={{
                    height: '1px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    margin: '0.35rem 0.875rem'
                  }} />
                </>
              )}
              {[
                { screen: 'upload', icon: Home, label: 'Welcome' },
                { screen: 'sources', icon: FolderOpen, label: 'Sources' },
                { screen: 'enrich', icon: Sparkles, label: 'Enrich' },
                { screen: 'results', icon: FileText, label: 'Results' },
                { screen: 'skills', icon: Database, label: 'Skills' },
                ...(isAdmin ? [{ screen: 'partners', icon: Users, label: 'Partners' }] : []),
              ].map(({ screen, icon: Icon, label }) => (
                <button
                  key={screen}
                  onClick={() => navigateTo(screen)}
                  style={{
                    width: '100%',
                    background: currentScreen === screen ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                    border: 'none',
                    borderLeft: currentScreen === screen ? '3px solid #dc2626' : '3px solid transparent',
                    color: currentScreen === screen ? '#dc2626' : '#ffffff',
                    padding: '0.6rem 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  <Icon size={17} style={{ flexShrink: 0 }} />
                  {label}
                </button>
              ))}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '0.5rem 0.875rem'
              }} />
              <button
                  onClick={() => navigateTo('configuration')}
                  style={{
                    width: '100%',
                    background: currentScreen === 'configuration' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                    border: 'none',
                    borderLeft: currentScreen === 'configuration' ? '3px solid #dc2626' : '3px solid transparent',
                    color: currentScreen === 'configuration' ? '#dc2626' : '#ffffff',
                    padding: '0.6rem 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  <Settings size={17} style={{ flexShrink: 0 }} />
                  Configuration
                </button>
              {currentScreen !== 'dashboard' && clientId && (
                <button
                  onClick={() => navigateTo('branding')}
                  style={{
                    width: '100%',
                    background: currentScreen === 'branding' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                    border: 'none',
                    borderLeft: currentScreen === 'branding' ? '3px solid #dc2626' : '3px solid transparent',
                    color: currentScreen === 'branding' ? '#dc2626' : '#ffffff',
                    padding: '0.6rem 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  <Image size={17} style={{ flexShrink: 0 }} />
                  Branding
                </button>
              )}

              {/* Theme Toggle in Sidebar */}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '0.5rem 0.875rem'
              }} />
              <div
                style={{
                  padding: '0.6rem 0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem', fontWeight: 500 }}>
                  {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </div>
                <button
                  onClick={toggleTheme}
                  style={{
                    width: '38px',
                    height: '20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: theme === 'dark' ? '#3b82f6' : 'rgba(255, 255, 255, 0.3)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: theme === 'dark' ? '21px' : '3px',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                  }} />
                </button>
              </div>

              {/* Sign Out */}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '0.5rem 0.875rem'
              }} />
              <button
                onClick={() => { setShowSidebar(false); handleLogout() }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderLeft: '3px solid transparent',
                  color: '#ef4444',
                  padding: '0.6rem 0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <LogOut size={17} style={{ flexShrink: 0 }} />
                Sign Out
              </button>
            </nav>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main">
        {/* Client Identity Banner — shown when inside a workspace */}
        {currentScreen !== 'dashboard' && currentScreen !== 'partners' && clientId && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem 0 0.75rem 0'
          }}>
            {companyData.logoUrl ? (
              <div>
                <img src={companyData.logoUrl} alt={companyData.name} style={{ height: '44px', maxWidth: '200px', objectFit: 'contain' }} />
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {(isAdmin || isPartner) ? 'Partner Workspace' : (companyData.name || 'My Workspace')}
                </div>
              </div>
            ) : (
              <>
                {companyData.iconUrl ? (
                  <img src={companyData.iconUrl} alt="" style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '10px', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0,
                    background: '#1a1a2e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem', fontWeight: 700, color: '#dc2626'
                  }}>
                    {(companyData.name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {companyData.name || 'New Client'}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {(isAdmin || isPartner) ? 'Partner Workspace' : (companyData.name || 'My Workspace')}
                  </div>
                </div>
              </>
            )}
            {(isAdmin || isPartner) && clientId && (
              <button
                onClick={() => setShowShareModal(true)}
                style={{
                  background: 'none', border: '1px solid var(--border-color, #d1d5db)',
                  borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  transition: 'all 0.2s', marginLeft: 'auto'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color, #d1d5db)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <Share2 size={14} /> Share
              </button>
            )}
          </div>
        )}

        {/* Screen Content */}
        {currentScreen === 'dashboard' && (
          <DashboardScreen
            onSelectClient={handleSelectClient}
            onCreateClient={handleCreateNewClient}
            isAdmin={isAdmin}
            isPartner={isPartner}
            partners={partners}
          />
        )}
        {currentScreen === 'upload' && (
          <UploadScreen
            setClientId={setClientId}
            clientId={clientId}
            companyData={companyData}
            setCompanyData={setCompanyData}
            onClientCreate={handleClientCreate}
            onComplete={() => setCurrentScreen('enrich')}
            onOpenCompanyModal={() => setShowCompanyModal(true)}
            configButtons={configButtons}
            onNavigate={navigateTo}
            isAdmin={isAdmin}
          />
        )}
        {currentScreen === 'sources' && (
          <SourcesScreen
            clientId={clientId}
            companyData={companyData}
            onNavigate={navigateTo}
          />
        )}
        {currentScreen === 'enrich' && (
          <EnrichScreen
            clientId={clientId}
            onComplete={() => setCurrentScreen('results')}
            preferredModel={preferredModel}
          />
        )}
        {currentScreen === 'results' && <ResultsScreen setShowModal={setShowModal} clientId={clientId} isAdmin={isAdmin} />}
        {currentScreen === 'skills' && <SkillsScreen clientId={clientId} isAdmin={isAdmin} />}
        {currentScreen === 'configuration' && <ConfigurationScreen theme={theme} toggleTheme={toggleTheme} buttons={configButtons} setButtons={saveButtons} preferredModel={preferredModel} setPreferredModel={saveModelPreference} clientId={clientId} />}
        {currentScreen === 'branding' && <BrandingScreen clientId={clientId} companyData={companyData} setCompanyData={setCompanyData} />}
        {currentScreen === 'partners' && isAdmin && <PartnersScreen partners={partners} setPartners={setPartners} />}

      </main>

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, textAlign: 'center', padding: '0.375rem 0', fontSize: '11px', color: '#808080', pointerEvents: 'none', zIndex: 10 }}>
        &copy; 2026 Intellagentic Limited. All rights reserved.
      </div>

      {/* Company Information Modal */}
      {showCompanyModal && (
        <CompanyInfoModal
          companyData={companyData}
          setCompanyData={setCompanyData}
          onClose={() => setShowCompanyModal(false)}
          onClientCreate={handleClientCreateFromDashboard}
          clientId={clientId}
          partners={partners}
          isAdmin={isAdmin}
        />
      )}

      {showShareModal && clientId && (
        <ShareLinkModal
          clientId={clientId}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// PARTNERS SCREEN — CRUD management for channel partners (admin only)
// ============================================================
function PartnersScreen({ partners, setPartners }) {
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editPartner, setEditPartner] = useState(null)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', industry: '', notes: '' })
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const fetchPartners = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/partners`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setPartners(data.partners || [])
      }
    } catch (err) {
      console.error('Failed to fetch partners:', err)
    }
    setLoading(false)
  }

  useEffect(() => { fetchPartners() }, [])

  const openAdd = () => {
    setEditPartner(null)
    setForm({ name: '', company: '', email: '', phone: '', industry: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (p) => {
    setEditPartner(p)
    setForm({ name: p.name, company: p.company, email: p.email, phone: p.phone, industry: p.industry, notes: p.notes })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Name is required'); return }
    try {
      if (editPartner) {
        await fetch(`${API_BASE}/partners`, {
          method: 'PUT', headers: getAuthHeaders(),
          body: JSON.stringify({ id: editPartner.id, ...form })
        })
      } else {
        await fetch(`${API_BASE}/partners`, {
          method: 'POST', headers: getAuthHeaders(),
          body: JSON.stringify(form)
        })
      }
      setShowForm(false)
      fetchPartners()
    } catch (err) {
      alert('Failed to save partner')
    }
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE}/partners?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() })
      setDeleteConfirm(null)
      fetchPartners()
    } catch (err) {
      alert('Failed to delete partner')
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.8125rem',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    fontFamily: 'inherit', background: 'var(--bg-input, #ffffff)', color: 'var(--text-primary)'
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Channel Partners <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>({partners.length})</span>
        </h2>
        <button onClick={openAdd} className="action-btn red"><Plus size={14} /> Add Partner</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#dc2626' }} />
        </div>
      ) : partners.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted, #9ca3af)' }} />
          <p>No partners yet. Add your first channel partner.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          {partners.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-alt, #fafafa)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                background: 'var(--bg-secondary, #f3f4f6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: '#dc2626'
              }}>
                {(p.name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                {p.company && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>{p.company}</div>}
              </div>
              {p.industry && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.industry}</span>}
              {p.email && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.email}</span>}
              <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }} title="Edit">
                <Edit2 size={14} />
              </button>
              <button onClick={() => setDeleteConfirm(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }} title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={20} className="icon-red" />
                <h2>{editPartner ? 'Edit Partner' : 'Add Partner'}</h2>
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Partner name" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>Company</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Company name" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>Email</label>
                    <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>Phone</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>Industry</label>
                  <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="e.g., Waste Management" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowForm(false)} className="action-btn" style={{ background: 'var(--bg-secondary)' }}>Cancel</button>
              <button onClick={handleSave} className="action-btn red"><Save size={14} /> {editPartner ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Delete Partner</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? Clients linked to this partner will be unlinked.</p>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setDeleteConfirm(null)} className="action-btn">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="action-btn" style={{ background: '#dc2626', color: '#fff' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// COMPANY INFORMATION MODAL
// ============================================================
function CompanyInfoModal({ companyData, setCompanyData, onClose, onClientCreate, clientId, partners, isAdmin }) {
  const [localData, setLocalData] = useState({ ...companyData, contacts: [...(companyData.contacts || [])], addresses: [...(companyData.addresses || [])] })
  const [localPartnerId, setLocalPartnerId] = useState(companyData.partner_id || '')
  const [localIntellagentic, setLocalIntellagentic] = useState(companyData.intellagentic_lead || false)
  const [localContacts, setLocalContacts] = useState(() => {
    const c = companyData.contacts || []
    return c.map(ct => ({ ...ct }))
  })
  const [localAddresses, setLocalAddresses] = useState(() => {
    const a = companyData.addresses || []
    return a.map(addr => ({ ...addr }))
  })

  const addContact = () => {
    setLocalContacts(prev => [...prev, { firstName: '', lastName: '', title: '', email: '', phone: '', linkedin: '' }])
  }
  const updateContact = (index, field, value) => {
    setLocalContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }
  const removeContact = (index) => {
    setLocalContacts(prev => prev.filter((_, i) => i !== index))
  }

  const addLocalAddress = () => {
    setLocalAddresses(prev => [...prev, { label: '', address1: '', address2: '', city: '', state: '', postalCode: '', country: '' }])
  }
  const updateLocalAddress = (index, field, value) => {
    setLocalAddresses(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a))
  }
  const removeLocalAddress = (index) => {
    setLocalAddresses(prev => prev.filter((_, i) => i !== index))
  }
  const [modalContactsExpanded, setModalContactsExpanded] = useState(false)
  const [modalAddressesExpanded, setModalAddressesExpanded] = useState(false)
  const [logoUrl, setLogoUrl] = useState(companyData.logoUrl || null)
  const [iconUrl, setIconUrl] = useState(companyData.iconUrl || null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)

  // Load branding URLs on mount if we have a clientId
  useEffect(() => {
    if (clientId) {
      fetch(`${API_BASE}/upload/branding?client_id=${clientId}`, { headers: getAuthHeaders() })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            if (data.logo_url) setLogoUrl(data.logo_url)
            if (data.icon_url) setIconUrl(data.icon_url)
          }
        })
        .catch(() => {})
    }
  }, [clientId])

  const handleBrandingUpload = async (file, fileType) => {
    if (!clientId) {
      alert('Please save partner information first to enable branding uploads.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('File must be under 2MB')
      return
    }
    const ext = file.name.split('.').pop().toLowerCase()
    const contentTypeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' }
    const contentType = contentTypeMap[ext]
    if (!contentType) {
      alert('Supported formats: PNG, JPG, SVG, WebP')
      return
    }

    const setUploading = fileType === 'logo' ? setUploadingLogo : setUploadingIcon
    setUploading(true)

    try {
      // Get presigned URL
      const res = await fetch(`${API_BASE}/upload/branding`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ client_id: clientId, file_type: fileType, content_type: contentType, file_extension: ext })
      })
      if (!res.ok) throw new Error('Failed to get upload URL')
      const { upload_url } = await res.json()

      // Upload file to S3
      await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file
      })

      // Fetch fresh presigned GET URL
      const brandingRes = await fetch(`${API_BASE}/upload/branding?client_id=${clientId}`, { headers: getAuthHeaders() })
      if (brandingRes.ok) {
        const data = await brandingRes.json()
        if (fileType === 'logo' && data.logo_url) {
          setLogoUrl(data.logo_url)
          setCompanyData(prev => ({ ...prev, logoUrl: data.logo_url }))
        }
        if (fileType === 'icon' && data.icon_url) {
          setIconUrl(data.icon_url)
          setCompanyData(prev => ({ ...prev, iconUrl: data.icon_url }))
        }
      }
    } catch (err) {
      console.error(`Failed to upload ${fileType}:`, err)
      alert(`Failed to upload ${fileType}. Please try again.`)
    }
    setUploading(false)
  }

  const handleSave = () => {
    if (!localData.name.trim()) {
      alert('Company name is required')
      return
    }
    const saveData = { ...localData, contacts: localContacts, addresses: localAddresses, partner_id: localPartnerId ? parseInt(localPartnerId) : null, intellagentic_lead: localIntellagentic }
    setCompanyData(prev => ({ ...saveData, logoUrl: prev.logoUrl, iconUrl: prev.iconUrl }))
    if (onClientCreate) onClientCreate(saveData)
    onClose()
  }

  const brandingDropZoneStyle = {
    border: '2px dashed var(--border-color)',
    borderRadius: '8px',
    padding: '1rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    position: 'relative',
    minHeight: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '0.5rem'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Building2 size={20} className="icon-red" />
            <h2>Partner Information</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Company Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Company Name *
              </label>
              <input
                type="text"
                value={localData.name}
                onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                placeholder="Enter company name"
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Website URL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Website URL
              </label>
              <input
                type="url"
                value={localData.website}
                onChange={(e) => setLocalData({ ...localData, website: e.target.value })}
                placeholder="https://example.com"
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Contacts Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Contacts
                </label>
                <button
                  type="button"
                  onClick={addContact}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 500,
                    background: 'var(--accent-color, #3b82f6)', color: '#fff',
                    border: 'none', borderRadius: '6px', cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Add Contact
                </button>
              </div>

              {localContacts.length === 0 && (
                <div style={{
                  border: '2px dashed var(--border-color)', borderRadius: '8px',
                  padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)'
                }}>
                  <User size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.85rem' }}>No contacts added yet</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Click "Add Contact" to add a primary contact</div>
                </div>
              )}

              {localContacts.map((contact, idx) => (idx > 0 && !modalContactsExpanded) ? null : (
                <div key={idx} style={{
                  border: '1px solid var(--border-color)', borderRadius: '8px',
                  padding: '0.75rem', marginBottom: '0.75rem'
                }}>
                  {/* Contact card header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: idx === 0 ? 'var(--accent-color, #3b82f6)' : 'var(--text-secondary)' }}>
                      {idx === 0 ? 'Primary Contact' : `Contact ${idx + 1}`}
                    </span>
                    <button type="button" onClick={() => removeContact(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}
                      title="Remove contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input type="text" value={contact.firstName || ''} onChange={(e) => updateContact(idx, 'firstName', e.target.value)}
                        placeholder="First Name" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                      <input type="text" value={contact.lastName || ''} onChange={(e) => updateContact(idx, 'lastName', e.target.value)}
                        placeholder="Last Name" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    </div>
                    {localData.name && (
                      <div style={{ padding: '0.5rem', background: 'var(--bg-secondary, #f3f4f6)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {localData.name}
                      </div>
                    )}
                    <input type="text" value={contact.title} onChange={(e) => updateContact(idx, 'title', e.target.value)}
                      placeholder="Title / Role" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input type="email" value={contact.email} onChange={(e) => updateContact(idx, 'email', e.target.value)}
                        placeholder="Email" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                      <input type="text" value={contact.phone} onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                        placeholder="Phone" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    </div>
                    <input type="url" value={contact.linkedin} onChange={(e) => updateContact(idx, 'linkedin', e.target.value)}
                      placeholder="LinkedIn URL" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                  </div>
                </div>
              ))}

              {localContacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setModalContactsExpanded(prev => !prev)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0', fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--accent-color, #3b82f6)'
                  }}
                >
                  {modalContactsExpanded ? (
                    <><ChevronUp size={14} /> Hide {localContacts.length - 1} more contact{localContacts.length - 1 > 1 ? 's' : ''}</>
                  ) : (
                    <><ChevronDown size={14} /> View {localContacts.length - 1} more contact{localContacts.length - 1 > 1 ? 's' : ''}</>
                  )}
                </button>
              )}
            </div>

            {/* Addresses Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Addresses
                </label>
                <button
                  type="button"
                  onClick={addLocalAddress}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 500,
                    background: 'var(--accent-color, #3b82f6)', color: '#fff',
                    border: 'none', borderRadius: '6px', cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> Add Address
                </button>
              </div>

              {localAddresses.length === 0 && (
                <div style={{
                  border: '2px dashed var(--border-color)', borderRadius: '8px',
                  padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)'
                }}>
                  <MapPin size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.85rem' }}>No addresses added yet</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Click "Add Address" to add a location</div>
                </div>
              )}

              {localAddresses.map((addr, idx) => (idx > 0 && !modalAddressesExpanded) ? null : (
                <div key={idx} style={{
                  border: '1px solid var(--border-color)', borderRadius: '8px',
                  padding: '0.75rem', marginBottom: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: idx === 0 ? 'var(--accent-color, #3b82f6)' : 'var(--text-secondary)' }}>
                      {idx === 0 ? 'Primary Address' : `Address ${idx + 1}`}
                    </span>
                    <button type="button" onClick={() => removeLocalAddress(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}
                      title="Remove address"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input type="text" value={addr.label || ''} onChange={(e) => updateLocalAddress(idx, 'label', e.target.value)}
                      placeholder="Label (e.g., Headquarters, Warehouse)" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    <input type="text" value={addr.address1 || ''} onChange={(e) => updateLocalAddress(idx, 'address1', e.target.value)}
                      placeholder="Address Line 1" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    <input type="text" value={addr.address2 || ''} onChange={(e) => updateLocalAddress(idx, 'address2', e.target.value)}
                      placeholder="Address Line 2" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input type="text" value={addr.city || ''} onChange={(e) => updateLocalAddress(idx, 'city', e.target.value)}
                        placeholder="City" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                      <input type="text" value={addr.state || ''} onChange={(e) => updateLocalAddress(idx, 'state', e.target.value)}
                        placeholder="State / Province" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                      <input type="text" value={addr.postalCode || ''} onChange={(e) => updateLocalAddress(idx, 'postalCode', e.target.value)}
                        placeholder="Postal Code" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                      <input type="text" value={addr.country || ''} onChange={(e) => updateLocalAddress(idx, 'country', e.target.value)}
                        placeholder="Country" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                    </div>
                  </div>
                </div>
              ))}

              {localAddresses.length > 1 && (
                <button
                  type="button"
                  onClick={() => setModalAddressesExpanded(prev => !prev)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0', fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--accent-color, #3b82f6)'
                  }}
                >
                  {modalAddressesExpanded ? (
                    <><ChevronUp size={14} /> Hide {localAddresses.length - 1} more address{localAddresses.length - 1 > 1 ? 'es' : ''}</>
                  ) : (
                    <><ChevronDown size={14} /> View {localAddresses.length - 1} more address{localAddresses.length - 1 > 1 ? 'es' : ''}</>
                  )}
                </button>
              )}
            </div>

            {/* Industry */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Industry/Vertical
              </label>
              <input
                type="text"
                value={localData.industry}
                onChange={(e) => setLocalData({ ...localData, industry: e.target.value })}
                placeholder="e.g., Waste Management, Healthcare, Hospitality"
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Channel Partner (admin only) */}
            {isAdmin && partners && partners.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Channel Partner
                </label>
                <select
                  value={localPartnerId}
                  onChange={(e) => setLocalPartnerId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    background: 'var(--bg-input, #ffffff)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">None</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.company ? ` — ${p.company}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Intellagentic Lead (admin only) */}
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="intellagentic-lead"
                  checked={localIntellagentic}
                  onChange={(e) => setLocalIntellagentic(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <label htmlFor="intellagentic-lead" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Intellagentic Lead
                </label>
              </div>
            )}

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Description
              </label>
              <textarea
                value={localData.description}
                onChange={(e) => setLocalData({ ...localData, description: e.target.value })}
                placeholder="Brief description of the business"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Immediate Pain Point */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Immediate Pain Point
              </label>
              <textarea
                value={localData.painPoint}
                onChange={(e) => setLocalData({ ...localData, painPoint: e.target.value })}
                placeholder="What's the one problem you need solved right now?"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Client Branding Section */}
            <div style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1rem',
              marginTop: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Image size={16} style={{ color: '#dc2626' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Client Branding</span>
                {!clientId && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>(save partner info first)</span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Logo Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>
                    Company Logo
                  </label>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', marginBottom: '0.5rem' }}>
                    400x100px, PNG/SVG, transparent bg
                  </p>
                  <div
                    style={{
                      ...brandingDropZoneStyle,
                      opacity: clientId ? 1 : 0.5,
                      pointerEvents: clientId ? 'auto' : 'none'
                    }}
                    onClick={() => {
                      if (!clientId) return
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = '.png,.jpg,.jpeg,.svg,.webp'
                      input.onchange = (e) => {
                        if (e.target.files[0]) handleBrandingUpload(e.target.files[0], 'logo')
                      }
                      input.click()
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#dc2626' }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.style.borderColor = 'var(--border-color)'
                      if (e.dataTransfer.files[0]) handleBrandingUpload(e.dataTransfer.files[0], 'logo')
                    }}
                  >
                    {uploadingLogo ? (
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#dc2626' }} />
                    ) : logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ maxHeight: '50px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <>
                        <Upload size={18} style={{ color: 'var(--text-muted, #9ca3af)' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>Drop logo or click</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Icon Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--text-primary)' }}>
                    Company Icon
                  </label>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7280)', marginBottom: '0.5rem' }}>
                    128x128px, PNG/SVG, square
                  </p>
                  <div
                    style={{
                      ...brandingDropZoneStyle,
                      opacity: clientId ? 1 : 0.5,
                      pointerEvents: clientId ? 'auto' : 'none'
                    }}
                    onClick={() => {
                      if (!clientId) return
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = '.png,.jpg,.jpeg,.svg,.webp'
                      input.onchange = (e) => {
                        if (e.target.files[0]) handleBrandingUpload(e.target.files[0], 'icon')
                      }
                      input.click()
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#dc2626' }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.style.borderColor = 'var(--border-color)'
                      if (e.dataTransfer.files[0]) handleBrandingUpload(e.dataTransfer.files[0], 'icon')
                    }}
                  >
                    {uploadingIcon ? (
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#dc2626' }} />
                    ) : iconUrl ? (
                      <img src={iconUrl} alt="Icon" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px' }} />
                    ) : (
                      <>
                        <Upload size={18} style={{ color: 'var(--text-muted, #9ca3af)' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>Drop icon or click</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="action-btn red"
            style={{
              width: '100%',
              marginTop: '1.5rem',
              justifyContent: 'center'
            }}
          >
            Save Partner Information
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// BRANDING SCREEN
// ============================================================
function BrandingScreen({ clientId, companyData, setCompanyData }) {
  const [logoUrl, setLogoUrl] = useState(companyData.logoUrl || null)
  const [iconUrl, setIconUrl] = useState(companyData.iconUrl || null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (clientId) {
      fetch(`${API_BASE}/upload/branding?client_id=${clientId}`, { headers: getAuthHeaders() })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            if (data.logo_url) setLogoUrl(data.logo_url)
            if (data.icon_url) setIconUrl(data.icon_url)
          }
        })
        .catch(() => {})
        .finally(() => setLoaded(true))
    } else {
      setLoaded(true)
    }
  }, [clientId])

  const handleUpload = async (file, fileType) => {
    if (!clientId) return
    if (file.size > 2 * 1024 * 1024) {
      alert('File must be under 2MB')
      return
    }
    const ext = file.name.split('.').pop().toLowerCase()
    const contentTypeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' }
    const contentType = contentTypeMap[ext]
    if (!contentType) {
      alert('Supported formats: PNG, JPG, SVG, WebP')
      return
    }

    const setUploading = fileType === 'logo' ? setUploadingLogo : setUploadingIcon
    setUploading(true)

    try {
      const res = await fetch(`${API_BASE}/upload/branding`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ client_id: clientId, file_type: fileType, content_type: contentType, file_extension: ext })
      })
      if (!res.ok) throw new Error('Failed to get upload URL')
      const { upload_url } = await res.json()

      await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })

      const brandingRes = await fetch(`${API_BASE}/upload/branding?client_id=${clientId}`, { headers: getAuthHeaders() })
      if (brandingRes.ok) {
        const data = await brandingRes.json()
        if (fileType === 'logo' && data.logo_url) {
          setLogoUrl(data.logo_url)
          setCompanyData(prev => ({ ...prev, logoUrl: data.logo_url }))
        }
        if (fileType === 'icon' && data.icon_url) {
          setIconUrl(data.icon_url)
          setCompanyData(prev => ({ ...prev, iconUrl: data.icon_url }))
        }
      }
    } catch (err) {
      console.error(`Failed to upload ${fileType}:`, err)
      alert(`Failed to upload ${fileType}. Please try again.`)
    }
    setUploading(false)
  }

  const dropZoneBase = {
    border: '2px dashed var(--border-color)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '0.75rem',
    position: 'relative'
  }

  const makeDropHandlers = (fileType) => ({
    onClick: () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.png,.jpg,.jpeg,.svg,.webp'
      input.onchange = (e) => { if (e.target.files[0]) handleUpload(e.target.files[0], fileType) }
      input.click()
    },
    onDragOver: (e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.04)' },
    onDragLeave: (e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'transparent' },
    onDrop: (e) => {
      e.preventDefault()
      e.currentTarget.style.borderColor = 'var(--border-color)'
      e.currentTarget.style.background = 'transparent'
      if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0], fileType)
    }
  })

  if (!clientId) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <Image size={48} style={{ color: 'var(--text-muted, #9ca3af)', margin: '0 auto 1rem' }} />
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Client Selected</h3>
        <p style={{ color: 'var(--text-muted, #6b7280)' }}>Create or select a client first to manage branding assets.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Image size={22} style={{ color: '#dc2626' }} />
          Client Branding
        </h2>
        <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Upload a logo and icon for <strong>{companyData.name || 'this client'}</strong>. These appear on the dashboard, workspace header, and Streamline webhook.
        </p>
      </div>

      {/* Company Logo */}
      <div style={{
        background: 'var(--bg-primary, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Company Logo</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6b7280)', marginTop: '0.25rem' }}>
            Recommended: 400x100px, PNG or SVG with transparent background. Max 2MB.
          </p>
        </div>
        <div style={{ ...dropZoneBase, padding: '2rem', minHeight: '120px' }} {...makeDropHandlers('logo')}>
          {uploadingLogo ? (
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#dc2626' }} />
          ) : logoUrl ? (
            <div style={{ textAlign: 'center' }}>
              <img src={logoUrl} alt="Logo" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.75rem' }}>Click or drop to replace</p>
            </div>
          ) : (
            <>
              <Upload size={28} style={{ color: 'var(--text-muted, #9ca3af)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted, #9ca3af)' }}>Drop logo here or click to browse</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #b0b0b0)' }}>PNG, JPG, SVG, or WebP</span>
            </>
          )}
        </div>
      </div>

      {/* Company Icon */}
      <div style={{
        background: 'var(--bg-primary, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Company Icon</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6b7280)', marginTop: '0.25rem' }}>
            Recommended: 128x128px, PNG or SVG, square format. Shown on dashboard cards. Max 2MB.
          </p>
        </div>
        <div style={{ ...dropZoneBase, padding: '2rem', minHeight: '120px' }} {...makeDropHandlers('icon')}>
          {uploadingIcon ? (
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#dc2626' }} />
          ) : iconUrl ? (
            <div style={{ textAlign: 'center' }}>
              <img src={iconUrl} alt="Icon" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '12px' }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', marginTop: '0.75rem' }}>Click or drop to replace</p>
            </div>
          ) : (
            <>
              <Upload size={28} style={{ color: 'var(--text-muted, #9ca3af)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted, #9ca3af)' }}>Drop icon here or click to browse</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #b0b0b0)' }}>PNG, JPG, SVG, or WebP</span>
            </>
          )}
        </div>
      </div>

      {/* Preview */}
      {(logoUrl || iconUrl) && (
        <div style={{
          background: 'var(--bg-primary, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '12px',
          padding: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem' }}>Preview</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logoUrl && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Header Logo</span>
                <div style={{ marginTop: '0.5rem', background: '#1a1a2e', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '28px', height: '28px', background: '#dc2626', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem', fontWeight: 800 }}>XO</div>
                  <img src={logoUrl} alt="" style={{ height: '20px', maxWidth: '120px', objectFit: 'contain' }} />
                </div>
              </div>
            )}
            {iconUrl && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard Card Icon</span>
                <div style={{ marginTop: '0.5rem', background: 'var(--bg-secondary, #f9fafb)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <img src={iconUrl} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '8px' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{companyData.name || 'Company Name'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================================
// UPLOAD SCREEN
// ============================================================
function UploadScreen({ setClientId, clientId, companyData, setCompanyData, onClientCreate, onComplete, onOpenCompanyModal, configButtons, onNavigate, isAdmin }) {
  const [error, setError] = useState(null)
  const [sourceCount, setSourceCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)

  // Inline form state
  const [formData, setFormData] = useState({
    name: companyData.name || '',
    website: companyData.website || '',
    industry: companyData.industry || '',
    description: companyData.description || '',
    painPoint: companyData.painPoint || ''
  })
  const [formContacts, setFormContacts] = useState(() =>
    (companyData.contacts || []).map(c => ({ ...c }))
  )
  const [formAddresses, setFormAddresses] = useState(() =>
    (companyData.addresses || []).map(a => ({ ...a }))
  )
  const [saving, setSaving] = useState(false)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [contactsExpanded, setContactsExpanded] = useState(false)
  const [addressesExpanded, setAddressesExpanded] = useState(false)

  // Sync form when companyData changes externally (e.g. client switch)
  useEffect(() => {
    setFormData({
      name: companyData.name || '',
      website: companyData.website || '',
      industry: companyData.industry || '',
      description: companyData.description || '',
      painPoint: companyData.painPoint || ''
    })
    setFormContacts((companyData.contacts || []).map(c => ({ ...c })))
    setFormAddresses((companyData.addresses || []).map(a => ({ ...a })))
  }, [companyData.name, clientId])

  const addContact = () => {
    setFormContacts(prev => [...prev, { firstName: '', lastName: '', title: '', email: '', phone: '', linkedin: '' }])
  }
  const updateContact = (index, field, value) => {
    setFormContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }
  const removeContact = (index) => {
    setFormContacts(prev => prev.filter((_, i) => i !== index))
  }

  const addAddress = () => {
    setFormAddresses(prev => [...prev, { label: '', address1: '', address2: '', city: '', state: '', postalCode: '', country: '' }])
  }
  const updateAddress = (index, field, value) => {
    setFormAddresses(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a))
  }
  const removeAddress = (index) => {
    setFormAddresses(prev => prev.filter((_, i) => i !== index))
  }

  // Autosave: called on blur from any form field
  const autoSave = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    const saveData = { ...formData, contacts: formContacts, addresses: formAddresses }
    setCompanyData(prev => ({ ...saveData, logoUrl: prev.logoUrl, iconUrl: prev.iconUrl }))
    if (onClientCreate) await onClientCreate(saveData)
    setSaving(false)
    setSavedIndicator(true)
    setTimeout(() => setSavedIndicator(false), 2000)
  }

  // Fetch source counts when clientId is available
  useEffect(() => {
    if (clientId) {
      fetchSourceCounts()
    }
  }, [clientId])

  const fetchSourceCounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/uploads?client_id=${clientId}`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        const uploads = data.uploads || []
        setSourceCount(uploads.length)
        setActiveCount(uploads.filter(u => u.status === 'active').length)
      }
    } catch (err) {
      console.error('Failed to fetch source counts:', err)
    }
  }

  const step1Complete = !!companyData.name
  const step2Complete = sourceCount > 0
  const allStepsComplete = step1Complete && step2Complete

  return (
    <div>
      {/* Two-Column Split Layout */}
      <div className="workspace-columns" style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        alignItems: 'flex-start'
      }}>

        {/* LEFT COLUMN — Partner Information Form (always editable, light theme) */}
        <div className="workspace-col-left" style={{
          flex: '0 0 38%',
          minWidth: '280px',
          background: '#ffffff',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Building2 size={18} style={{ color: '#dc2626' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
              ORGANIZATION PROFILE
            </h3>
          </div>

          {/* Company Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Company Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onBlur={autoSave}
              placeholder="Enter company name"
              style={{
                width: '100%', padding: '0.5rem 0.625rem',
                background: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '0.85rem', color: '#111827',
                fontFamily: 'inherit', outline: 'none'
              }}
            />
          </div>

          {/* Website URL */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Website URL
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              onBlur={autoSave}
              placeholder="https://example.com"
              style={{
                width: '100%', padding: '0.5rem 0.625rem',
                background: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '0.85rem', color: '#111827',
                fontFamily: 'inherit', outline: 'none'
              }}
            />
          </div>

          {/* Industry */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Industry / Vertical
            </label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              onBlur={autoSave}
              placeholder="e.g., Waste Management, Healthcare"
              style={{
                width: '100%', padding: '0.5rem 0.625rem',
                background: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '0.85rem', color: '#111827',
                fontFamily: 'inherit', outline: 'none'
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onBlur={autoSave}
              placeholder="Brief description of the business"
              rows={2}
              style={{
                width: '100%', padding: '0.5rem 0.625rem',
                background: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '0.85rem', color: '#111827',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical'
              }}
            />
          </div>

          {/* Pain Point */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Immediate Pain Point
            </label>
            <textarea
              value={formData.painPoint}
              onChange={(e) => setFormData({ ...formData, painPoint: e.target.value })}
              onBlur={autoSave}
              placeholder="What's the one problem you need solved?"
              rows={2}
              style={{
                width: '100%', padding: '0.5rem 0.625rem',
                background: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '6px', fontSize: '0.85rem', color: '#111827',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical'
              }}
            />
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: '#e5e7eb' }} />

          {/* Contacts Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Contacts
              </label>
              <button
                type="button"
                onClick={addContact}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
                  background: 'rgba(220, 38, 38, 0.08)', color: '#dc2626',
                  border: '1px solid rgba(220, 38, 38, 0.25)', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            {formContacts.length === 0 && (
              <div style={{
                border: '1px dashed #d1d5db', borderRadius: '6px',
                padding: '0.75rem', textAlign: 'center', color: '#9ca3af',
                fontSize: '0.75rem'
              }}>
                No contacts yet
              </div>
            )}

            {formContacts.map((contact, idx) => (idx > 0 && !contactsExpanded) ? null : (
              <div key={idx} style={{
                border: '1px solid #e5e7eb', borderRadius: '8px',
                padding: '0.625rem', marginBottom: '0.5rem',
                background: '#f9fafb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: idx === 0 ? '#dc2626' : '#6b7280' }}>
                    {idx === 0 ? 'Primary Contact' : `Contact ${idx + 1}`}
                  </span>
                  <button type="button" onClick={() => removeContact(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                    <input type="text" value={contact.firstName || ''} onChange={(e) => updateContact(idx, 'firstName', e.target.value)} onBlur={autoSave}
                      placeholder="First Name" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                    <input type="text" value={contact.lastName || ''} onChange={(e) => updateContact(idx, 'lastName', e.target.value)} onBlur={autoSave}
                      placeholder="Last Name" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  {formData.name && (
                    <div style={{ padding: '0.375rem 0.5rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '5px', fontSize: '0.75rem', color: '#6b7280' }}>
                      {formData.name}
                    </div>
                  )}
                  <input type="text" value={contact.title} onChange={(e) => updateContact(idx, 'title', e.target.value)} onBlur={autoSave}
                    placeholder="Title" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                    <input type="email" value={contact.email} onChange={(e) => updateContact(idx, 'email', e.target.value)} onBlur={autoSave}
                      placeholder="Email" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                    <input type="text" value={contact.phone} onChange={(e) => updateContact(idx, 'phone', e.target.value)} onBlur={autoSave}
                      placeholder="Phone" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  <input type="url" value={contact.linkedin || ''} onChange={(e) => updateContact(idx, 'linkedin', e.target.value)} onBlur={autoSave}
                    placeholder="LinkedIn URL" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                </div>
              </div>
            ))}

            {formContacts.length > 1 && (
              <button
                type="button"
                onClick={() => setContactsExpanded(prev => !prev)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.25rem 0', fontSize: '0.7rem', fontWeight: 600,
                  color: '#dc2626'
                }}
              >
                {contactsExpanded ? (
                  <>
                    <ChevronUp size={13} />
                    Hide {formContacts.length - 1} more contact{formContacts.length - 1 > 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} />
                    View {formContacts.length - 1} more contact{formContacts.length - 1 > 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: '#e5e7eb' }} />

          {/* Addresses Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Addresses
              </label>
              <button
                type="button"
                onClick={addAddress}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
                  background: 'rgba(220, 38, 38, 0.08)', color: '#dc2626',
                  border: '1px solid rgba(220, 38, 38, 0.25)', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            {formAddresses.length === 0 && (
              <div style={{
                border: '1px dashed #d1d5db', borderRadius: '6px',
                padding: '0.75rem', textAlign: 'center', color: '#9ca3af',
                fontSize: '0.75rem'
              }}>
                No addresses yet
              </div>
            )}

            {formAddresses.map((addr, idx) => (idx > 0 && !addressesExpanded) ? null : (
              <div key={idx} style={{
                border: '1px solid #e5e7eb', borderRadius: '8px',
                padding: '0.625rem', marginBottom: '0.5rem',
                background: '#f9fafb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: idx === 0 ? '#dc2626' : '#6b7280' }}>
                    {idx === 0 ? 'Primary Address' : `Address ${idx + 1}`}
                  </span>
                  <button type="button" onClick={() => removeAddress(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <input type="text" value={addr.label || ''} onChange={(e) => updateAddress(idx, 'label', e.target.value)} onBlur={autoSave}
                    placeholder="Label (e.g., Headquarters, Warehouse)" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                  <input type="text" value={addr.address1 || ''} onChange={(e) => updateAddress(idx, 'address1', e.target.value)} onBlur={autoSave}
                    placeholder="Address Line 1" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                  <input type="text" value={addr.address2 || ''} onChange={(e) => updateAddress(idx, 'address2', e.target.value)} onBlur={autoSave}
                    placeholder="Address Line 2" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                    <input type="text" value={addr.city || ''} onChange={(e) => updateAddress(idx, 'city', e.target.value)} onBlur={autoSave}
                      placeholder="City" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                    <input type="text" value={addr.state || ''} onChange={(e) => updateAddress(idx, 'state', e.target.value)} onBlur={autoSave}
                      placeholder="State / Province" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                    <input type="text" value={addr.postalCode || ''} onChange={(e) => updateAddress(idx, 'postalCode', e.target.value)} onBlur={autoSave}
                      placeholder="Postal Code" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                    <input type="text" value={addr.country || ''} onChange={(e) => updateAddress(idx, 'country', e.target.value)} onBlur={autoSave}
                      placeholder="Country" style={{ width: '100%', padding: '0.375rem 0.5rem', background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.75rem', color: '#111827', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                </div>
              </div>
            ))}

            {formAddresses.length > 1 && (
              <button
                type="button"
                onClick={() => setAddressesExpanded(prev => !prev)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.25rem 0', fontSize: '0.7rem', fontWeight: 600,
                  color: '#dc2626'
                }}
              >
                {addressesExpanded ? (
                  <>
                    <ChevronUp size={13} />
                    Hide {formAddresses.length - 1} more address{formAddresses.length - 1 > 1 ? 'es' : ''}
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} />
                    View {formAddresses.length - 1} more address{formAddresses.length - 1 > 1 ? 'es' : ''}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Autosave Indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.375rem', padding: '0.375rem 0', minHeight: '1.5rem',
            transition: 'opacity 0.3s',
            opacity: saving || savedIndicator ? 1 : 0
          }}>
            {saving ? (
              <>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#6b7280' }} />
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Saving...</span>
              </>
            ) : savedIndicator ? (
              <>
                <CheckCircle size={13} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>Saved</span>
              </>
            ) : null}
          </div>
        </div>

        {/* RIGHT COLUMN — Workflow Cards */}
        <div className="workspace-col-right" style={{ flex: '1 1 0', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Card 1: Domain Expertise */}
          <div style={{
            background: '#1a1a2e',
            borderRadius: '10px',
            padding: '0.625rem 0.75rem',
            border: step1Complete ? '2px solid #dc2626' : '2px solid transparent',
            transition: 'all 0.3s',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: step1Complete ? '#dc2626' : 'rgba(220, 38, 38, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(220, 38, 38, 0.3)', transition: 'all 0.3s'
              }}>
                {step1Complete ? (
                  <CheckCircle2 size={16} style={{ color: 'white' }} />
                ) : (
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>1</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'white', marginBottom: '0.1rem', letterSpacing: '-0.01em' }}>
                  DOMAIN EXPERTISE
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  The Filter
                </p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.4, marginBottom: '0.35rem' }}>
                  Tell us about your business. YOU are the filter.
                </p>

                {step1Complete ? (
                  <div style={{
                    padding: '0.625rem',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{companyData.name}</div>
                    {companyData.industry && (
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.15rem' }}>{companyData.industry}</div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.45)', fontStyle: 'italic' }}>
                    Fill in partner information and save →
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Raw Data */}
          <div style={{
            background: '#1a1a2e',
            borderRadius: '10px',
            padding: '0.625rem 0.75rem',
            border: step2Complete ? '2px solid #dc2626' : '2px solid transparent',
            transition: 'all 0.3s',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: step2Complete ? '#dc2626' : 'rgba(220, 38, 38, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(220, 38, 38, 0.3)', transition: 'all 0.3s'
              }}>
                {step2Complete ? (
                  <CheckCircle2 size={16} style={{ color: 'white' }} />
                ) : (
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>2</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'white', marginBottom: '0.1rem', letterSpacing: '-0.01em' }}>
                  RAW DATA
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  The Noise
                </p>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                  Upload documents, connect data sources.
                </p>

                {sourceCount > 0 ? (
                  <div style={{
                    padding: '0.875rem',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FolderOpen size={18} style={{ color: '#dc2626' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>
                          {sourceCount} source{sourceCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        {activeCount} active
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigate('sources')}
                      style={{
                        width: '100%', padding: '0.5rem',
                        background: 'rgba(220, 38, 38, 0.15)',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        borderRadius: '6px', color: '#dc2626',
                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem'
                      }}
                    >
                      <FolderOpen size={14} />
                      Manage Sources
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onNavigate('sources')}
                    className="action-btn red"
                    style={{ justifyContent: 'center', padding: '0.75rem', fontSize: '0.9rem', width: '100%' }}
                  >
                    <Upload size={18} />
                    Add Sources
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Intellagentic Growth */}
          <div style={{
            background: allStepsComplete ? '#1a1a2e' : '#2a2a3e',
            borderRadius: '10px',
            padding: '0.625rem 0.75rem',
            border: allStepsComplete ? '2px solid transparent' : '2px solid rgba(100, 100, 100, 0.3)',
            transition: 'all 0.3s',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: allStepsComplete ? 'rgba(220, 38, 38, 0.2)' : 'rgba(150, 150, 150, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${allStepsComplete ? 'rgba(220, 38, 38, 0.3)' : 'rgba(150, 150, 150, 0.4)'}`,
                transition: 'all 0.3s'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: allStepsComplete ? '#dc2626' : '#999' }}>3</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '0.9375rem', fontWeight: 700,
                  color: allStepsComplete ? 'white' : 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '0.1rem', letterSpacing: '-0.01em'
                }}>
                  INTELLAGENTIC GROWTH
                </h3>
                <p style={{
                  fontSize: '0.75rem',
                  color: allStepsComplete ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.55)',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem'
                }}>
                  The Output
                </p>
                <p style={{
                  fontSize: '0.8rem',
                  color: allStepsComplete ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.65)',
                  lineHeight: 1.4, marginBottom: '0.5rem'
                }}>
                  MBA-level analysis. Problems identified. Schema proposed. Action plan delivered.
                </p>

                {allStepsComplete ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <button
                      onClick={() => onNavigate('skills')}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        padding: '0.45rem', fontSize: '0.75rem', fontWeight: 600, width: '100%',
                        background: '#3B82F6', color: 'white', border: 'none', borderRadius: '7px',
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', transition: 'all 0.2s'
                      }}
                    >
                      <Database size={14} />
                      Skills
                    </button>
                    <button
                      onClick={onComplete}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                        padding: '0.55rem', fontSize: '0.8rem', fontWeight: 600, width: '100%',
                        background: '#22c55e', color: 'white', border: 'none', borderRadius: '7px',
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)', transition: 'all 0.2s'
                      }}
                    >
                      <Sparkles size={15} />
                      Enrich
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', textAlign: 'center' }}>
                    Complete steps 1 & 2 →
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Founder Quotes — admin only */}
          {isAdmin && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginTop: '0.25rem'
          }}>
            {/* Alan's Quote */}
            <div style={{ padding: '0.25rem 0' }}>
              <div style={{
                fontSize: '3rem', lineHeight: 0.8, color: '#dc2626',
                fontFamily: 'Georgia, serif', marginBottom: '0.25rem', opacity: 0.8
              }}>"</div>
              <p style={{
                fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-primary)',
                lineHeight: 1.6, marginBottom: '0.5rem'
              }}>
                I wasn't leading. I was typing at 6:00 AM. I became my own admin clerk.
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>
                — Alan Moore, Co-Founder & CEO
              </p>
            </div>

            {/* Ken's Quote */}
            <div style={{ padding: '0.25rem 0' }}>
              <div style={{
                fontSize: '3rem', lineHeight: 0.8, color: '#dc2626',
                fontFamily: 'Georgia, serif', marginBottom: '0.25rem', opacity: 0.8
              }}>"</div>
              <p style={{
                fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-primary)',
                lineHeight: 1.6, marginBottom: '0.5rem'
              }}>
                We're business operators first, not technologists. We built this because we needed it.
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0 }}>
                — Ken Scott, Co-Founder & President
              </p>
            </div>
          </div>
          )}

        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: 0 }}>
            {error}
          </p>
        </div>
      )}

    </div>
  )
}

// ============================================================
// SOURCES SCREEN — NotebookLM-style Source Library
// ============================================================
function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  const map = {
    csv: FileSpreadsheet, xls: FileSpreadsheet, xlsx: FileSpreadsheet,
    pdf: FileText, doc: FileText, docx: FileText, txt: FileText,
    mp3: Music, wav: Music, m4a: Music, aac: Music,
    png: Image, jpg: Image, jpeg: Image, gif: Image,
    json: FileType, xml: FileType,
    ppt: File, pptx: File, zip: File
  }
  return map[ext] || File
}

function formatFileSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SourcesScreen({ clientId, companyData, onNavigate }) {
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([]) // { file, progress }
  const [openMenuId, setOpenMenuId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [replacingId, setReplacingId] = useState(null)

  // Text input source state
  const [textSourceLabel, setTextSourceLabel] = useState('')
  const [textSourceContent, setTextSourceContent] = useState('')
  const [textSourceSaving, setTextSourceSaving] = useState(false)

  // Google Drive state
  const [gdriveConnected, setGdriveConnected] = useState(false)
  const [gdriveLoading, setGdriveLoading] = useState(false)
  const [showGdrivePicker, setShowGdrivePicker] = useState(false)
  const [gdriveFiles, setGdriveFiles] = useState([])
  const [selectedGdriveFiles, setSelectedGdriveFiles] = useState([])
  const [gdriveImporting, setGdriveImporting] = useState(false)
  const [currentGdriveFolder, setCurrentGdriveFolder] = useState('root')
  const [gdriveFolderStack, setGdriveFolderStack] = useState([])

  useEffect(() => {
    if (clientId) fetchUploads()
    else setLoading(false)
  }, [clientId])

  // Close kebab menu on outside click
  useEffect(() => {
    const handler = () => setOpenMenuId(null)
    if (openMenuId) document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openMenuId])

  const fetchUploads = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/uploads?client_id=${clientId}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setUploads(data.uploads || [])
      }
    } catch (err) {
      console.error('Failed to fetch uploads:', err)
    } finally {
      setLoading(false)
    }
  }

  // === Upload Handlers ===
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    uploadFiles(droppedFiles)
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    uploadFiles(selectedFiles)
    e.target.value = '' // reset so same file can be re-selected
  }

  const uploadFiles = async (fileList) => {
    if (!clientId) return

    const validExtensions = ['csv', 'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'xml', 'zip', 'mp3', 'wav', 'm4a', 'aac', 'png', 'jpg', 'jpeg', 'webp']
    const filtered = fileList.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      return validExtensions.includes(ext)
    })
    if (filtered.length === 0) return

    // Add to pending
    const pending = filtered.map(f => ({ file: f, progress: 0 }))
    setPendingFiles(prev => [...prev, ...pending])

    try {
      // Get presigned URLs
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          client_id: clientId,
          files: filtered.map(f => ({ name: f.name, type: f.type, size: f.size }))
        })
      })
      if (!res.ok) throw new Error('Failed to get upload URLs')
      const { upload_urls } = await res.json()

      // Upload each file
      for (let i = 0; i < filtered.length; i++) {
        const file = filtered[i]
        await fetch(upload_urls[i], {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        })
        setPendingFiles(prev => prev.map(p =>
          p.file.name === file.name ? { ...p, progress: 100 } : p
        ))
      }

      // Refresh list and clear pending
      await fetchUploads()
      setPendingFiles(prev => prev.filter(p => p.progress < 100))
    } catch (err) {
      console.error('Upload error:', err)
      setPendingFiles([])
    }
  }

  // Upload text as a .txt file source
  const addTextSource = async () => {
    if (!clientId || !textSourceContent.trim()) return
    setTextSourceSaving(true)
    try {
      const label = (textSourceLabel.trim() || 'Text Note').replace(/[^a-zA-Z0-9 _-]/g, '')
      const fileName = `${label.replace(/\s+/g, '_')}_${Date.now()}.txt`
      const blob = new Blob([textSourceContent], { type: 'text/plain' })
      const file = new File([blob], fileName, { type: 'text/plain' })

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          client_id: clientId,
          files: [{ name: file.name, type: file.type, size: file.size }]
        })
      })
      if (!res.ok) throw new Error('Failed to get upload URL')
      const { upload_urls } = await res.json()

      await fetch(upload_urls[0], {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'text/plain' }
      })

      await fetchUploads()
      setTextSourceLabel('')
      setTextSourceContent('')
    } catch (err) {
      console.error('Text source upload error:', err)
    }
    setTextSourceSaving(false)
  }

  // === CRUD Handlers ===
  const toggleUpload = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/uploads/${id}/toggle`, {
        method: 'PUT',
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setUploads(prev => prev.map(u => u.id === id ? { ...u, status: data.status } : u))
      }
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const deleteUpload = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/uploads/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (res.ok) {
        setUploads(prev => prev.filter(u => u.id !== id))
        setDeleteConfirmId(null)
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleReplace = async (parentId, file) => {
    try {
      const res = await fetch(`${API_BASE}/uploads/${parentId}/replace`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size })
      })
      if (!res.ok) throw new Error('Failed to replace')
      const data = await res.json()

      // Upload new file
      await fetch(data.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      })

      setReplacingId(null)
      await fetchUploads()
    } catch (err) {
      console.error('Replace error:', err)
    }
  }

  // === Google Drive Functions ===
  const connectGoogleDrive = async () => {
    setGdriveLoading(true)
    try {
      const res = await fetch(`${API_BASE}/gdrive/auth-url`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get auth URL')
      const popup = window.open(data.auth_url, 'google-drive-auth', 'width=500,height=600,scrollbars=yes')
      const pollTimer = setInterval(async () => {
        try {
          if (!popup || popup.closed) { clearInterval(pollTimer); setGdriveLoading(false); return }
          const popupUrl = popup.location.href
          if (popupUrl.startsWith(window.location.origin)) {
            clearInterval(pollTimer)
            const url = new URL(popupUrl)
            const code = url.searchParams.get('code')
            popup.close()
            if (code) {
              const cbRes = await fetch(`${API_BASE}/gdrive/callback`, {
                method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ code })
              })
              if (cbRes.ok) setGdriveConnected(true)
            }
            setGdriveLoading(false)
          }
        } catch { /* cross-origin while on Google domain */ }
      }, 500)
    } catch (err) {
      console.error('Google Drive connect error:', err)
      setGdriveLoading(false)
    }
  }

  const fetchGdriveFiles = async (folderId = 'root') => {
    try {
      const res = await fetch(`${API_BASE}/gdrive/files?folder_id=${folderId}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (res.ok) { setGdriveFiles(data.files || []); setCurrentGdriveFolder(folderId) }
    } catch (err) { console.error('Fetch Drive files error:', err) }
  }

  const openGdrivePicker = async () => {
    setShowGdrivePicker(true)
    setSelectedGdriveFiles([])
    setGdriveFolderStack([])
    setCurrentGdriveFolder('root')
    await fetchGdriveFiles('root')
  }

  const navigateToGdriveFolder = async (folderId, folderName) => {
    setGdriveFolderStack(prev => [...prev, { id: currentGdriveFolder, name: folderName }])
    await fetchGdriveFiles(folderId)
  }

  const navigateGdriveBack = async () => {
    const stack = [...gdriveFolderStack]
    const parent = stack.pop()
    setGdriveFolderStack(stack)
    await fetchGdriveFiles(parent ? parent.id : 'root')
  }

  const toggleGdriveFileSelection = (file) => {
    setSelectedGdriveFiles(prev => {
      const exists = prev.find(f => f.id === file.id)
      return exists ? prev.filter(f => f.id !== file.id) : [...prev, file]
    })
  }

  const importGdriveFiles = async () => {
    if (selectedGdriveFiles.length === 0) return
    setGdriveImporting(true)
    try {
      const res = await fetch(`${API_BASE}/gdrive/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ file_ids: selectedGdriveFiles.map(f => f.id), client_id: clientId })
      })
      if (res.ok) await fetchUploads()
      setShowGdrivePicker(false)
      setSelectedGdriveFiles([])
    } catch (err) { console.error('Import error:', err) }
    setGdriveImporting(false)
  }

  // === Computed ===
  const activeUploads = uploads.filter(u => u.status === 'active')
  const totalSize = uploads.reduce((sum, u) => sum + (u.file_size || 0), 0)

  // === No clientId state ===
  if (!clientId) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <FolderOpen size={20} className="icon-red" />
            <h2>Source Library</h2>
          </div>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <FolderOpen size={64} style={{ color: '#dc2626', opacity: 0.5, margin: '0 auto 1.5rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            Complete Domain Expertise First
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Fill in your company information on the Welcome screen to create a project,<br />
            then come back here to upload and manage your sources.
          </p>
          <button
            onClick={() => onNavigate('upload')}
            className="action-btn red"
            style={{ padding: '0.625rem 1.5rem', fontSize: '0.875rem' }}
          >
            <Home size={18} />
            Go to Welcome
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Panel 1: Source Library ── */}
      <div className="panel" style={{ overflow: 'visible' }}>
        <div className="panel-header">
          <div className="panel-header-left">
            <FolderOpen size={20} className="icon-red" />
            <h2>Source Library</h2>
            <span className="badge-count blue">{uploads.length}</span>
          </div>
          <button
            onClick={fetchUploads}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Summary Bar */}
        {uploads.length > 0 && (
          <div style={{
            padding: '0.5rem 1.25rem',
            background: 'var(--surface-secondary, rgba(255,255,255,0.03))',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            display: 'flex',
            gap: '1rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            <span><strong style={{ color: 'var(--text-primary)' }}>{activeUploads.length}</strong> active</span>
            <span><strong style={{ color: 'var(--text-primary)' }}>{uploads.length}</strong> total</span>
            <span><strong style={{ color: 'var(--text-primary)' }}>{formatFileSize(totalSize)}</strong></span>
          </div>
        )}

        <div style={{ padding: '1.25rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Loader2 size={64} style={{ color: '#dc2626', opacity: 0.5, margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                Loading Sources
              </h3>
            </div>
          ) : uploads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <FolderOpen size={64} style={{ color: '#dc2626', opacity: 0.5, margin: '0 auto 1.5rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                No Sources Yet
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                Sources are the raw data that feeds your analysis — CSVs, PDFs, audio recordings,<br />
                spreadsheets. Drop files below or connect Google Drive.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Drag & drop files in the <strong>Add Sources</strong> area below to get started.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {uploads.map(upload => {
                const IconComp = getFileIcon(upload.filename)
                const isActive = upload.status === 'active'
                const isReplaced = upload.status === 'replaced'
                const isMenuOpen = openMenuId === upload.id
                const isDeleting = deleteConfirmId === upload.id

                if (isReplaced) return null // hide replaced versions from main list

                return (
                  <div
                    key={upload.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 0.875rem',
                      background: 'var(--surface-secondary, rgba(255,255,255,0.03))',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                      borderRadius: '10px',
                      opacity: isActive ? 1 : 0.5,
                      filter: isActive ? 'none' : 'grayscale(30%)',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'visible'
                    }}
                  >
                    {/* File Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '8px',
                      background: 'rgba(220, 38, 38, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <IconComp size={18} style={{ color: '#dc2626' }} />
                    </div>

                    {/* File Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{
                          fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {upload.filename}
                        </span>
                        {upload.version > 1 && (
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px',
                            borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6'
                          }}>
                            v{upload.version}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.625rem', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '1px 6px', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 600,
                          background: upload.source === 'google_drive' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                          color: upload.source === 'google_drive' ? '#3b82f6' : '#dc2626'
                        }}>
                          {upload.source === 'google_drive' ? 'Google Drive' : 'Local'}
                        </span>
                        <span>{formatFileSize(upload.file_size)}</span>
                        <span>{formatDate(upload.uploaded_at)}</span>
                      </div>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleUpload(upload.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                        color: isActive ? '#22c55e' : 'var(--text-muted)', flexShrink: 0
                      }}
                      title={isActive ? 'Deactivate' : 'Activate'}
                    >
                      {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>

                    {/* Kebab Menu */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : upload.id) }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>

                      {isMenuOpen && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 50,
                          background: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px', padding: '0.25rem 0', minWidth: '150px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
                          marginTop: '4px'
                        }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(`https://xo-client-data.s3.us-west-1.amazonaws.com/${upload.s3_key}`, '_blank'); setOpenMenuId(null) }}
                            style={{
                              width: '100%', textAlign: 'left', padding: '0.5rem 0.875rem',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#1a1a1a', fontSize: '0.8rem',
                              display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setReplacingId(upload.id); setOpenMenuId(null) }}
                            style={{
                              width: '100%', textAlign: 'left', padding: '0.5rem 0.875rem',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#1a1a1a', fontSize: '0.8rem',
                              display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <RefreshCw size={14} /> Replace
                          </button>
                          <div style={{ height: '1px', background: '#e5e7eb', margin: '0.25rem 0' }} />
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(upload.id); setOpenMenuId(null) }}
                            style={{
                              width: '100%', textAlign: 'left', padding: '0.5rem 0.875rem',
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#ef4444', fontSize: '0.8rem',
                              display: 'flex', alignItems: 'center', gap: '0.5rem'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete Confirmation Overlay */}
                    {isDeleting && (
                      <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 100
                      }}
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px', padding: '1.5rem', maxWidth: '360px', width: '90%',
                            textAlign: 'center',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)'
                          }}
                        >
                          <Trash2 size={32} style={{ color: '#ef4444', margin: '0 auto 0.75rem' }} />
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.5rem' }}>
                            Delete Source?
                          </h3>
                          <p style={{ fontSize: '0.85rem', color: '#444444', marginBottom: '1.25rem' }}>
                            <strong>{upload.filename}</strong> will be permanently removed.
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              style={{
                                padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem',
                                background: '#f3f4f6',
                                border: '1px solid #d1d5db', color: '#333333',
                                cursor: 'pointer', fontWeight: 500
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => deleteUpload(upload.id)}
                              style={{
                                padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem',
                                background: '#ef4444', border: 'none', color: '#ffffff',
                                cursor: 'pointer', fontWeight: 600
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Replace File Input */}
                    {replacingId === upload.id && (
                      <input
                        type="file"
                        ref={el => { if (el) el.click() }}
                        onChange={(e) => {
                          const file = e.target.files[0]
                          if (file) handleReplace(upload.id, file)
                          else setReplacingId(null)
                        }}
                        style={{ display: 'none' }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel 2: Add Sources ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <Upload size={20} className="icon-red" />
            <h2>Add Sources</h2>
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? '#dc2626' : 'var(--border-color, rgba(255,255,255,0.2))'}`,
              borderRadius: '10px',
              padding: '1.5rem',
              textAlign: 'center',
              background: isDragging ? 'rgba(220, 38, 38, 0.08)' : 'var(--surface-secondary, rgba(255,255,255,0.03))',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => document.getElementById('sources-file-input').click()}
          >
            <Upload size={36} style={{ color: '#dc2626', opacity: 0.6, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Drop files here or click to browse
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              CSV, Excel, Word, PDF, Images, Video, Audio, JSON, and more
            </p>
            <input
              id="sources-file-input"
              type="file"
              multiple
              accept=".csv,.txt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.json,.xml,.zip,.mp3,.wav,.m4a,.aac,.mp4,.webm,.png,.jpg,.jpeg,.webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* Screenshot tip */}
          <p style={{
            fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--surface-secondary, rgba(0,0,0,0.03))',
            borderRadius: '6px', lineHeight: 1.5
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Tip:</strong> You can screenshot WhatsApp messages, text conversations, or any screen and drop them in as images. We accept PNG, JPG, and PDF screenshots.
          </p>

          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {pendingFiles.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--surface-secondary, rgba(255,255,255,0.03))',
                  borderRadius: '8px'
                }}>
                  <Loader2 size={14} style={{ color: '#dc2626', animation: p.progress < 100 ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.file.name}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: p.progress === 100 ? '#22c55e' : 'var(--text-muted)', flexShrink: 0 }}>
                    {p.progress === 100 ? 'Done' : 'Uploading...'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Sources Strip - Connectors */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600,
              background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626',
              border: '1px solid rgba(220, 38, 38, 0.3)'
            }}>
              <Upload size={11} /> Upload
            </span>

            <button
              onClick={gdriveConnected ? openGdrivePicker : connectGoogleDrive}
              disabled={gdriveLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600,
                background: gdriveConnected ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface-secondary, rgba(0,0,0,0.05))',
                color: gdriveConnected ? '#3b82f6' : 'var(--text-secondary)',
                border: gdriveConnected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)',
                cursor: gdriveLoading ? 'wait' : 'pointer', transition: 'all 0.2s'
              }}
            >
              {gdriveLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <HardDrive size={11} />}
              {gdriveConnected ? 'Google Drive' : 'Connect Drive'}
            </button>

            {['NotebookLM', 'Dropbox', 'OneDrive'].map(name => (
              <span key={name} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600,
                background: 'var(--surface-secondary, rgba(0,0,0,0.03))',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                opacity: 0.5
              }}>
                {name === 'NotebookLM' ? <FileText size={11} /> : <Cloud size={11} />} {name}
              </span>
            ))}
          </div>
          {/* Text Input Source */}
          <div style={{
            marginTop: '1rem',
            borderTop: '1px solid var(--border-color, rgba(255,255,255,0.1))',
            paddingTop: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <FileText size={16} style={{ color: '#dc2626' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Paste Text Source</span>
            </div>

            <input
              type="text"
              value={textSourceLabel}
              onChange={(e) => setTextSourceLabel(e.target.value)}
              placeholder="Source label (e.g. Phone call notes, Email thread, Meeting notes)"
              style={{
                width: '100%', padding: '0.5rem 0.625rem', marginBottom: '0.5rem',
                border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                borderRadius: '6px', fontSize: '0.85rem',
                color: 'var(--text-primary)', background: 'var(--surface-secondary, rgba(255,255,255,0.03))',
                fontFamily: 'inherit', outline: 'none'
              }}
            />

            <textarea
              value={textSourceContent}
              onChange={(e) => setTextSourceContent(e.target.value)}
              placeholder="Paste raw text content here — call notes, email threads, chat logs, meeting minutes..."
              rows={5}
              style={{
                width: '100%', padding: '0.625rem', marginBottom: '0.5rem',
                border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                borderRadius: '6px', fontSize: '0.85rem',
                color: 'var(--text-primary)', background: 'var(--surface-secondary, rgba(255,255,255,0.03))',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5
              }}
            />

            <button
              onClick={addTextSource}
              disabled={textSourceSaving || !textSourceContent.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                width: '100%', padding: '0.6rem',
                background: !textSourceContent.trim() ? 'var(--surface-secondary, rgba(0,0,0,0.05))' : '#dc2626',
                color: !textSourceContent.trim() ? 'var(--text-muted)' : 'white',
                border: !textSourceContent.trim() ? '1px solid var(--border-color)' : 'none',
                borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                cursor: !textSourceContent.trim() || textSourceSaving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {textSourceSaving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={15} />}
              {textSourceSaving ? 'Saving...' : 'Add Source'}
            </button>
          </div>
        </div>
      </div>

      {/* Google Drive File Picker Modal */}
      {showGdrivePicker && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a2e', borderRadius: '16px', width: '90%', maxWidth: '520px',
            maxHeight: '70vh', display: 'flex', flexDirection: 'column',
            border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HardDrive size={20} style={{ color: '#3b82f6' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: 0 }}>Google Drive</h3>
              </div>
              <button
                onClick={() => { setShowGdrivePicker(false); setSelectedGdriveFiles([]) }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {gdriveFolderStack.length > 0 && (
              <button
                onClick={navigateGdriveBack}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.25rem',
                  background: 'none', border: 'none', borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  color: '#3b82f6', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
              {gdriveFiles.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '2rem', fontSize: '0.85rem' }}>
                  No files found in this folder
                </p>
              ) : gdriveFiles.map(file => {
                const isSelected = selectedGdriveFiles.some(f => f.id === file.id)
                return (
                  <div
                    key={file.id}
                    onClick={() => file.isFolder ? navigateToGdriveFolder(file.id, file.name) : toggleGdriveFileSelection(file)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.625rem 1.25rem', cursor: 'pointer',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                  >
                    {file.isFolder ? <FolderOpen size={18} style={{ color: '#facc15', flexShrink: 0 }} />
                      : isSelected ? <CheckCircle2 size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                      : <FileText size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />}
                    <span style={{
                      fontSize: '0.85rem', color: isSelected ? '#3b82f6' : 'white',
                      fontWeight: isSelected ? 600 : 400, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1
                    }}>
                      {file.name}
                    </span>
                    {file.isFolder && <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                {selectedGdriveFiles.length} file{selectedGdriveFiles.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={importGdriveFiles}
                disabled={selectedGdriveFiles.length === 0 || gdriveImporting}
                className="action-btn red"
                style={{
                  padding: '0.5rem 1.25rem', fontSize: '0.8rem',
                  opacity: selectedGdriveFiles.length === 0 ? 0.4 : 1,
                  cursor: selectedGdriveFiles.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {gdriveImporting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importing...</>
                  : <><Upload size={14} /> Import Files</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================================
// ENRICH SCREEN
// ============================================================
const MODEL_LABELS = {
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5'
}

function EnrichScreen({ clientId, onComplete, preferredModel }) {
  const [jobStatus, setJobStatus] = useState(null) // null | 'processing' | 'complete' | 'error'
  const [jobId, setJobId] = useState(null)
  const [currentStage, setCurrentStage] = useState(null)
  const [error, setError] = useState(null)
  const [showInfoPopover, setShowInfoPopover] = useState(false)
  const [stages, setStages] = useState([
    { id: 'extracting', label: 'Extracting Text', status: 'pending', icon: FileText },
    { id: 'transcribing', label: 'Transcribing Audio', status: 'pending', icon: Music },
    { id: 'researching', label: 'Web Research', status: 'pending', icon: Sparkles },
    { id: 'analyzing', label: 'AI Analysis', status: 'pending', icon: Sparkles },
    { id: 'complete', label: 'Complete', status: 'pending', icon: CheckCircle }
  ])

  const startEnrichment = async () => {
    setError(null)
    setJobStatus('processing')
    setCurrentStage('extracting')

    try {
      // Trigger enrichment Lambda
      const response = await fetch(`${API_BASE}/enrich`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ client_id: clientId, model: preferredModel })
      })

      if (!response.ok) throw new Error('Failed to start enrichment')

      const data = await response.json()
      setJobId(data.job_id)

      // Start polling for status
      pollJobStatus(data.job_id)

    } catch (err) {
      setError(err.message)
      setJobStatus('error')
    }
  }

  const pollJobStatus = async (id) => {
    let errorCount = 0
    const maxErrors = 5
    const startTime = Date.now()
    const maxPollTime = 5 * 60 * 1000 // 5 minutes

    const pollInterval = setInterval(async () => {
      // Timeout after 5 minutes of polling
      if (Date.now() - startTime > maxPollTime) {
        clearInterval(pollInterval)
        setError('Enrichment is taking longer than expected. Check the Results tab — it may have completed.')
        setJobStatus('error')
        return
      }

      try {
        const response = await fetch(`${API_BASE}/results/${id}`, {
          headers: getAuthHeaders()
        })

        if (!response.ok) {
          errorCount++
          console.warn(`Poll error (${errorCount}/${maxErrors}): HTTP ${response.status}`)
          if (errorCount >= maxErrors) {
            clearInterval(pollInterval)
            setError('Lost connection to enrichment service')
            setJobStatus('error')
          }
          return
        }

        // Reset error count on successful response
        errorCount = 0
        const data = await response.json()

        // Update current stage based on backend response
        if (data.stage) {
          setCurrentStage(data.stage)
          updateStageStatus(data.stage, 'active')
        }

        // Check if complete
        if (data.status === 'complete') {
          clearInterval(pollInterval)
          setJobStatus('complete')
          updateStageStatus('complete', 'complete')

          // Auto-navigate to results after 1.5 seconds
          setTimeout(() => onComplete(), 1500)
        }

        if (data.status === 'error') {
          clearInterval(pollInterval)
          setJobStatus('error')
          setError(data.error || data.message || 'Enrichment failed')
        }

      } catch (err) {
        errorCount++
        console.warn(`Poll exception (${errorCount}/${maxErrors}):`, err.message)
        if (errorCount >= maxErrors) {
          clearInterval(pollInterval)
          setError('Lost connection to enrichment service')
          setJobStatus('error')
        }
      }
    }, 3000) // Poll every 3 seconds
  }

  const updateStageStatus = (stageId, status) => {
    setStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        return { ...stage, status }
      }
      // Mark previous stages as complete
      const stageIndex = prev.findIndex(s => s.id === stageId)
      const currentIndex = prev.findIndex(s => s.id === stage.id)
      if (currentIndex < stageIndex && stage.status === 'pending') {
        return { ...stage, status: 'complete' }
      }
      return stage
    }))
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <Sparkles size={20} className="icon-red" />
          <h2>AI Enrichment</h2>
          {jobStatus === 'processing' && (
            <span className="badge-count blue">Processing</span>
          )}
          {jobStatus === 'complete' && (
            <span className="badge-count green">Complete</span>
          )}
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: preferredModel.includes('opus') ? '#a855f7' : '#3b82f6',
            background: preferredModel.includes('opus') ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            padding: '3px 10px',
            borderRadius: '999px',
            border: `1px solid ${preferredModel.includes('opus') ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
          }}>
            {MODEL_LABELS[preferredModel] || preferredModel}
          </span>
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        {/* Not Started State */}
        {!jobStatus && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Sparkles size={64} style={{ color: '#dc2626', opacity: 0.5, margin: '0 auto 1.5rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Ready to Enrich Your Data
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              Our AI will extract text from documents, transcribe audio files,<br />
              research your company online, and generate a comprehensive analysis.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                onClick={startEnrichment}
                className="action-btn red"
                style={{ padding: '0.875rem 2rem', fontSize: '1rem' }}
              >
                <Sparkles size={20} />
                Start Enrichment
              </button>
              <button
                onClick={() => setShowInfoPopover(true)}
                style={{
                  background: 'none',
                  border: '2px solid var(--border-color)',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                title="What happens when you click Enrich?"
              >
                <AlertCircle size={18} />
              </button>
            </div>

            {/* Enrichment Info Modal */}
            {showInfoPopover && (
              <div className="modal-overlay" onClick={() => setShowInfoPopover(false)}>
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 400,
                    maxWidth: '90vw',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    padding: '1.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      What happens when you click Enrich?
                    </h4>
                    <button
                      onClick={() => setShowInfoPopover(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {[
                    { num: '1', label: 'Extract', desc: 'Read all uploaded documents, transcribe audio files', icon: FileText },
                    { num: '2', label: 'Context', desc: 'Company info, pain points, and survival metrics guide the analysis', icon: Building2 },
                    { num: '3', label: 'Skills', desc: 'System + domain + client skills shape how AI thinks', icon: Database },
                    { num: '4', label: 'Web Research', desc: 'Company, competitors, and market research', icon: Globe },
                    { num: '5', label: 'AI Analysis', desc: `${MODEL_LABELS[preferredModel] || 'Claude'} produces MBA-level analysis`, icon: Sparkles },
                    { num: '6', label: 'Output', desc: 'Problems, architecture, schema, 7/14/21 day plan', icon: CheckCircle }
                  ].map(step => (
                    <div key={step.num} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '0.75rem' }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'rgba(220, 38, 38, 0.1)',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1
                      }}>
                        {step.num}
                      </div>
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{step.label}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.375rem' }}>{step.desc}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: preferredModel.includes('opus') ? '#a855f7' : '#3b82f6',
                      background: preferredModel.includes('opus') ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${preferredModel.includes('opus') ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                    }}>
                      {MODEL_LABELS[preferredModel] || preferredModel}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Change model in Configuration
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing State */}
        {jobStatus === 'processing' && (
          <div>
            <div style={{
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Loader2 size={20} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Processing your data...
                </h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                This may take a few minutes. We'll automatically advance when complete.
              </p>
            </div>

            {/* Progress Stages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stages.map((stage, index) => {
                const StageIcon = stage.icon
                const isActive = stage.status === 'active'
                const isComplete = stage.status === 'complete'
                const isPending = stage.status === 'pending'

                return (
                  <div
                    key={stage.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: isActive ? 'rgba(220, 38, 38, 0.05)' : isComplete ? 'rgba(34, 197, 94, 0.05)' : '#fafafa',
                      border: `1px solid ${isActive ? 'rgba(220, 38, 38, 0.2)' : isComplete ? 'rgba(34, 197, 94, 0.2)' : '#e5e5e5'}`,
                      borderRadius: '10px',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isComplete ? 'rgba(34, 197, 94, 0.15)' : isActive ? 'rgba(220, 38, 38, 0.15)' : '#e5e5e5',
                      flexShrink: 0
                    }}>
                      {isComplete ? (
                        <CheckCircle size={20} style={{ color: '#16a34a' }} />
                      ) : isActive ? (
                        <Loader2 size={20} style={{ color: '#dc2626', animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Clock size={20} style={{ color: '#9ca3af' }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontSize: '0.9rem',
                        fontWeight: isActive || isComplete ? 600 : 500,
                        color: isActive ? '#dc2626' : isComplete ? '#16a34a' : '#666',
                        margin: 0
                      }}>
                        {stage.label}
                      </p>
                      {isActive && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                          In progress...
                        </p>
                      )}
                      {isComplete && (
                        <p style={{ fontSize: '0.75rem', color: '#16a34a', margin: '0.25rem 0 0 0' }}>
                          Completed
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Complete State */}
        {jobStatus === 'complete' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <CheckCircle size={32} style={{ color: '#16a34a' }} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Enrichment Complete!
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Redirecting to results...
            </p>
          </div>
        )}

        {/* Error State */}
        {jobStatus === 'error' && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.05)',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <AlertCircle size={48} style={{ color: '#dc2626', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#dc2626' }}>
              Enrichment Failed
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {error || 'An error occurred during enrichment'}
            </p>
            <button
              onClick={startEnrichment}
              className="action-btn red"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// SKILLS SCREEN
// ============================================================
function SkillsScreen({ clientId, isAdmin }) {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)

  useEffect(() => {
    fetchSkills()
  }, [clientId])

  const fetchSkills = async () => {
    try {
      setLoading(true)
      const url = clientId
        ? `${API_BASE}/skills?client_id=${clientId}`
        : `${API_BASE}/skills?scope=system`
      const res = await fetch(url, { headers: getAuthHeaders() })
      const data = await res.json()
      setSkills(data.skills || [])
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (skill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return

    try {
      const res = await fetch(`${API_BASE}/skills?skill_id=${skill.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Delete failed')
      }
      setSkills(prev => prev.filter(s => s.id !== skill.id))
    } catch (err) {
      alert('Failed to delete skill: ' + err.message)
    }
  }

  const systemSkills = skills.filter(s => s.scope === 'system')
  const clientSkills = skills.filter(s => s.scope === 'client')

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-header-left">
          <Database size={20} className="icon-red" />
          <h2>Skills</h2>
          <span className="badge-count blue">{skills.length}</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="action-btn red"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          <Plus size={18} />
          Add Skill
        </button>
      </div>

      <div style={{ padding: '1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader2 size={64} style={{ color: '#dc2626', opacity: 0.5, margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Loading Skills
            </h3>
          </div>
        ) : skills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Database size={64} style={{ color: '#dc2626', opacity: 0.5, margin: '0 auto 1.5rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              No Skills Yet
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              Skills teach the AI what to focus on, what to ignore, and what success looks like<br />
              for your business. Think of them as instructions for your analyst.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click <strong>+ Add Skill</strong> above to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {/* System Skills */}
            {systemSkills.length > 0 && systemSkills.map((skill) => (
              <div key={skill.id} style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>
                      {skill.name}
                    </h3>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, color: '#3b82f6',
                      background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 999,
                      flexShrink: 0
                    }}>System</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {skill.content ? skill.content.substring(0, 80).replace(/[#\n]/g, ' ').trim() + '...' : 'System skill'}
                  </p>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => { setEditingSkill(skill); setShowAddModal(true) }}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.5rem' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(skill)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.5rem' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Divider between system and client skills */}
            {systemSkills.length > 0 && clientSkills.length > 0 && (
              <div style={{
                borderTop: '1px solid var(--border-color)',
                margin: '0.25rem 0',
                position: 'relative'
              }}>
                <span style={{
                  position: 'absolute', top: '-0.5rem', left: '1rem',
                  background: 'var(--bg-primary)', padding: '0 0.5rem',
                  fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500
                }}>Client Skills</span>
              </div>
            )}

            {/* Client Skills */}
            {clientSkills.map((skill) => (
              <div key={skill.id} style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>
                      {skill.name}
                    </h3>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)',
                      background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 999,
                      flexShrink: 0
                    }}>Client</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {skill.content ? skill.content.substring(0, 80).replace(/[#\n]/g, ' ').trim() + '...' : 'Client skill'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => { setEditingSkill(skill); setShowAddModal(true) }}
                    style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '0.5rem' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(skill)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.5rem' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Skill Modal */}
      {showAddModal && (
        <AddSkillModal
          clientId={clientId}
          isAdmin={isAdmin}
          skill={editingSkill}
          onClose={() => {
            setShowAddModal(false)
            setEditingSkill(null)
          }}
          onSave={() => {
            setShowAddModal(false)
            setEditingSkill(null)
            fetchSkills()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// ADD SKILL MODAL
// ============================================================
function AddSkillModal({ clientId, isAdmin, skill, onClose, onSave }) {
  const [skillName, setSkillName] = useState(skill?.name || '')
  const [focusOn, setFocusOn] = useState('')
  const [ignoreAvoid, setIgnoreAvoid] = useState('')
  const [successCriteria, setSuccessCriteria] = useState('')
  const [industryTerms, setIndustryTerms] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadMode, setUploadMode] = useState(false)
  const [uploadedContent, setUploadedContent] = useState('')
  const [scope, setScope] = useState(skill?.scope || (clientId ? 'client' : 'system'))

  // Parse existing skill content back into structured fields when editing
  useEffect(() => {
    if (skill?.content) {
      const content = skill.content
      const extractSection = (heading) => {
        const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
        const match = content.match(regex)
        if (!match) return ''
        return match[1].replace(/^[-*]\s+/gm, '').trim()
      }
      setFocusOn(extractSection('Focus Areas'))
      setIgnoreAvoid(extractSection('Ignore List'))
      setSuccessCriteria(extractSection('Success Criteria'))
      setIndustryTerms(extractSection('Industry Terms'))
      // If content doesn't parse into sections, switch to upload mode
      if (!extractSection('Focus Areas') && !extractSection('Ignore List') &&
          !extractSection('Success Criteria') && !extractSection('Industry Terms') && content.trim()) {
        setUploadMode(true)
        setUploadedContent(content)
      }
    }
  }, [skill])

  // Convert structured fields to markdown
  const buildMarkdown = () => {
    let md = `# ${skillName.trim()}\n\n`

    if (focusOn.trim()) {
      md += `## Focus Areas\n\n`
      focusOn.trim().split('\n').filter(l => l.trim()).forEach(line => {
        md += `- ${line.trim()}\n`
      })
      md += `\n`
    }

    if (ignoreAvoid.trim()) {
      md += `## Ignore List\n\n`
      ignoreAvoid.trim().split('\n').filter(l => l.trim()).forEach(line => {
        md += `- ${line.trim()}\n`
      })
      md += `\n`
    }

    if (successCriteria.trim()) {
      md += `## Success Criteria\n\n`
      successCriteria.trim().split('\n').filter(l => l.trim()).forEach(line => {
        md += `- ${line.trim()}\n`
      })
      md += `\n`
    }

    if (industryTerms.trim()) {
      md += `## Industry Terms\n\n`
      industryTerms.trim().split('\n').filter(l => l.trim()).forEach(line => {
        md += `- ${line.trim()}\n`
      })
      md += `\n`
    }

    return md
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const validExts = ['.md', '.txt']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!validExts.includes(ext)) {
      alert('Please upload a .md or .txt file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedContent(event.target.result)
      setSkillName(file.name.replace(/\.(md|txt)$/, ''))
    }
    reader.readAsText(file)
  }

  const handleSave = async () => {
    if (!skillName.trim()) {
      alert('Skill name is required')
      return
    }

    const content = uploadMode && uploadedContent ? uploadedContent : buildMarkdown()

    if (!uploadMode && !focusOn.trim() && !ignoreAvoid.trim() && !successCriteria.trim() && !industryTerms.trim()) {
      alert('Please fill in at least one field')
      return
    }

    setSaving(true)
    try {
      if (skill?.id) {
        // Update existing skill
        const res = await fetch(`${API_BASE}/skills`, {
          method: 'PUT',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ skill_id: skill.id, name: skillName.trim(), content })
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Update failed') }
      } else {
        // Create new skill
        const body = { name: skillName.trim(), content, scope }
        if (scope === 'client') body.client_id = clientId
        const res = await fetch(`${API_BASE}/skills`, {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Create failed') }
      }
      onSave()
    } catch (err) {
      alert('Failed to save skill: ' + err.message)
      setSaving(false)
    }
  }

  const fieldStyle = {
    width: '100%',
    padding: '0.625rem',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: 1.6
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.25rem',
    color: 'var(--text-primary)'
  }

  const hintStyle = {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    margin: '0 0 0.5rem 0'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Database size={20} className="icon-red" />
            <h2>{skill ? 'Edit Skill' : 'Add Skill'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
            Answer in plain English. The AI will use your answers to guide its analysis.
          </p>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Skill Name */}
            <div>
              <label style={labelStyle}>Skill Name *</label>
              <input
                type="text"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g., waste-management-analysis"
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Scope Selector (admin only, new skills only) */}
            {isAdmin && !skill && (
              <div>
                <label style={labelStyle}>Scope</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setScope('client')}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500,
                      border: scope === 'client' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                      background: scope === 'client' ? 'rgba(59,130,246,0.08)' : 'transparent',
                      color: scope === 'client' ? '#3b82f6' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >This client only</button>
                  <button
                    onClick={() => setScope('system')}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 500,
                      border: scope === 'system' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                      background: scope === 'system' ? 'rgba(59,130,246,0.08)' : 'transparent',
                      color: scope === 'system' ? '#3b82f6' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >System (all clients)</button>
                </div>
              </div>
            )}

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => setUploadMode(!uploadMode)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                {uploadMode ? 'Use guided form instead' : 'Advanced: Upload .md file'}
              </button>
            </div>

            {uploadMode ? (
              /* Upload Mode for Power Users */
              <div>
                <label style={labelStyle}>Upload Skill File</label>
                <p style={hintStyle}>Upload a .md or .txt file with your custom skill instructions.</p>
                <input
                  type="file"
                  accept=".md,.txt"
                  onChange={handleFileUpload}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
                {uploadedContent && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(34,197,94,0.08)',
                    borderRadius: '8px',
                    border: '1px solid rgba(34,197,94,0.2)'
                  }}>
                    <p style={{ fontSize: '0.8rem', color: '#22c55e', margin: 0, fontWeight: 500 }}>
                      <CheckCircle size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                      File loaded: {uploadedContent.length} characters
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Structured Form Fields */
              <>
                {/* Focus On */}
                <div>
                  <label style={labelStyle}>What should the AI focus on?</label>
                  <p style={hintStyle}>What metrics, problems, or themes matter most? One idea per line.</p>
                  <textarea
                    value={focusOn}
                    onChange={(e) => setFocusOn(e.target.value)}
                    placeholder="Revenue trends and cash flow patterns&#10;Customer churn and retention rates&#10;Operational bottlenecks in the delivery process"
                    rows={3}
                    style={fieldStyle}
                  />
                </div>

                {/* Ignore / Avoid */}
                <div>
                  <label style={labelStyle}>What should the AI ignore or avoid?</label>
                  <p style={hintStyle}>Topics, assumptions, or recommendations to skip. One per line.</p>
                  <textarea
                    value={ignoreAvoid}
                    onChange={(e) => setIgnoreAvoid(e.target.value)}
                    placeholder="Don't recommend switching CRM platforms&#10;Skip branding and logo suggestions&#10;Ignore data older than 2023"
                    rows={3}
                    style={fieldStyle}
                  />
                </div>

                {/* Success Criteria */}
                <div>
                  <label style={labelStyle}>What does success look like?</label>
                  <p style={hintStyle}>What outcome would make this analysis valuable? One per line.</p>
                  <textarea
                    value={successCriteria}
                    onChange={(e) => setSuccessCriteria(e.target.value)}
                    placeholder="Identify the top 3 revenue leaks&#10;Propose a database schema for tracking routes&#10;Give a 21-day action plan with specific milestones"
                    rows={3}
                    style={fieldStyle}
                  />
                </div>

                {/* Industry Terms */}
                <div>
                  <label style={labelStyle}>Any industry terms or jargon to know?</label>
                  <p style={hintStyle}>Help the AI understand your domain. One term or phrase per line.</p>
                  <textarea
                    value={industryTerms}
                    onChange={(e) => setIndustryTerms(e.target.value)}
                    placeholder="MRR = Monthly Recurring Revenue&#10;Churn rate = percentage of customers lost per month&#10;ARR = Annual Recurring Revenue"
                    rows={3}
                    style={fieldStyle}
                  />
                </div>
              </>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="action-btn red"
              style={{
                width: '100%',
                justifyContent: 'center',
                marginTop: '0.5rem',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  {skill ? 'Update Skill' : 'Save Skill'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CONFIGURATION SCREEN
// ============================================================
// ── Icon Library ──────────────────────────────────────────
const ICON_MAP = {
  Zap, Heart, Star, Send, Check,
  X, Edit2, Save, Home, Settings, User, Bell, Search,
  Calendar, Mail, Phone, MapPin, Upload, Play,
  ExternalLink, FileText, Globe, Package, CheckCircle2,
  Building2, Sparkles, Database, AlertCircle, AlertTriangle, TrendingUp, Clock,
  Download
}

const ICON_NAMES = Object.keys(ICON_MAP)

// ── Color Palette ─────────────────────────────────────────
const COLORS = [
  { name: 'Blue',   value: '#3b82f6' },
  { name: 'Green',  value: '#22c55e' },
  { name: 'Red',    value: '#ef4444' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink',   value: '#ec4899' },
  { name: 'Cyan',   value: '#06b6d4' },
  { name: 'Gray',   value: '#334155' }
]

const DEFAULT_BUTTONS = [
  { id: 1, label: 'Enrich', icon: 'Sparkles', color: '#22c55e', url: '/enrich' },
  { id: 2, label: 'Skills', icon: 'Database', color: '#334155', url: '/skills' },
  { id: 3, label: 'Rapid Prototype', icon: 'Download', color: '#dc2626', url: '/results' }
]

// Internal route map for button navigation
const ROUTE_MAP = {
  '/dashboard': 'dashboard',
  '/upload': 'upload',
  '/sources': 'sources',
  '/enrich': 'enrich',
  '/results': 'results',
  '/skills': 'skills',
  '/configuration': 'configuration'
}

function SystemSkillsPanel({ C }) {
  const [systemSkills, setSystemSkills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/skills?scope=system`, { headers: getAuthHeaders() })
        const data = await res.json()
        setSystemSkills(data.skills || [])
      } catch (e) {
        console.error('Failed to load system skills:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <div className="panel-header">
        <div className="panel-header-left">
          <Lock size={20} className="icon-red" />
          <h2>System Skills</h2>
          <span className="badge-count">{loading ? '...' : systemSkills.length}</span>
        </div>
      </div>
      <div style={{ padding: '1.25rem' }}>
        <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: '0.875rem', lineHeight: 1.5 }}>
          System skills are injected into every enrichment call before client skills. Manage them on the Skills screen.
        </p>
        <div className="system-skill-grid" style={{ display: 'grid', gap: '0.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: C.muted }} />
            </div>
          ) : systemSkills.map((skill) => (
            <div key={skill.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.625rem 0.875rem', background: C.surface, borderRadius: '8px',
              border: `1px solid ${C.border}`
            }}>
              <Lock size={14} style={{ color: C.muted, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text }}>{skill.name}</div>
                <div className="system-skill-desc" style={{
                  fontSize: '0.7rem', color: C.muted, marginTop: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>{skill.content ? skill.content.substring(0, 100).replace(/[#\n]/g, ' ').trim() : ''}</div>
              </div>
              <span style={{
                fontSize: '0.6rem', fontWeight: 600, color: '#3b82f6',
                background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 999,
                flexShrink: 0
              }}>System</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConfigurationScreen({ theme, toggleTheme, buttons, setButtons, preferredModel, setPreferredModel, clientId }) {
  const isDark = theme === 'dark'
  const [editingId, setEditingId] = useState(null)
  const [draggedId, setDraggedId] = useState(null)
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [webhookLoaded, setWebhookLoaded] = useState(false)
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookUrlSaving, setWebhookUrlSaving] = useState(false)
  const [webhookUrlSaved, setWebhookUrlSaved] = useState(false)

  useEffect(() => {
    if (clientId) {
      fetch(`${API_BASE}/clients?client_id=${clientId}`, { headers: getAuthHeaders() })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setWebhookEnabled(!!data.streamline_webhook_enabled)
            setWebhookUrl(data.streamline_webhook_url || '')
          }
        })
        .catch(() => {})
        .finally(() => setWebhookLoaded(true))
    } else {
      setWebhookLoaded(true)
    }
  }, [clientId])

  const toggleWebhook = async () => {
    if (!clientId) return
    const newValue = !webhookEnabled
    setWebhookEnabled(newValue)
    setWebhookSaving(true)
    try {
      // Need company_name for the PUT — fetch current then update
      const getRes = await fetch(`${API_BASE}/clients?client_id=${clientId}`, { headers: getAuthHeaders() })
      if (getRes.ok) {
        const current = await getRes.json()
        await fetch(`${API_BASE}/clients`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            client_id: clientId,
            company_name: current.company_name,
            website: current.website,
            contacts: current.contacts || [],
            industry: current.industry,
            description: current.description,
            painPoint: current.painPoint,
            streamline_webhook_enabled: newValue
          })
        })
      }
    } catch (err) {
      console.error('Failed to save webhook setting:', err)
      setWebhookEnabled(!newValue) // revert on error
    }
    setWebhookSaving(false)
  }

  const saveWebhookUrl = async () => {
    if (!clientId) return
    setWebhookUrlSaving(true)
    setWebhookUrlSaved(false)
    try {
      const getRes = await fetch(`${API_BASE}/clients?client_id=${clientId}`, { headers: getAuthHeaders() })
      if (getRes.ok) {
        const current = await getRes.json()
        await fetch(`${API_BASE}/clients`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            client_id: clientId,
            company_name: current.company_name,
            website: current.website,
            contacts: current.contacts || [],
            industry: current.industry,
            description: current.description,
            painPoint: current.painPoint,
            streamline_webhook_url: webhookUrl
          })
        })
        setWebhookUrlSaved(true)
        setTimeout(() => setWebhookUrlSaved(false), 2000)
      }
    } catch (err) {
      console.error('Failed to save webhook URL:', err)
    }
    setWebhookUrlSaving(false)
  }

  // Theme-aware colors matching reference C object
  const C = {
    bg:      isDark ? '#0d1117' : '#f6f8fa',
    surface: isDark ? '#161b22' : '#ffffff',
    border:  isDark ? '#30363d' : '#d0d7de',
    text:    isDark ? '#e6edf3' : '#1f2328',
    muted:   isDark ? '#8b949e' : '#656d76',
  }

  // ── Button Operations ─────────────────────────────────────
  const addButton = () => {
    const newBtn = {
      id: Date.now(),
      label: 'New Button',
      color: '#3b82f6',
      icon: 'Zap',
      url: ''
    }
    setButtons(prev => [...prev, newBtn])
    setEditingId(newBtn.id)
  }

  const deleteButton = (id) => {
    setButtons(prev => prev.filter(b => b.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const duplicateButton = (btn) => {
    const newBtn = { ...btn, id: Date.now(), label: `${btn.label} (copy)` }
    setButtons(prev => [...prev, newBtn])
  }

  const updateButton = (id, field, value) => {
    setButtons(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  // ── Drag & Drop ───────────────────────────────────────────
  const handleDragStart = (id) => setDraggedId(id)

  const handleDragOver = (e, targetId) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return
    const draggedIdx = buttons.findIndex(b => b.id === draggedId)
    const targetIdx = buttons.findIndex(b => b.id === targetId)
    const newButtons = [...buttons]
    const [removed] = newButtons.splice(draggedIdx, 1)
    newButtons.splice(targetIdx, 0, removed)
    setButtons(newButtons)
  }

  const handleDragEnd = () => setDraggedId(null)

  return (
    <div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .btn-hover:hover { opacity: .8; transform: translateY(-1px); }
        .card-hover:hover { border-color: ${C.text}40 !important; }
      `}</style>

      {/* Configuration Header */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <Settings size={20} className="icon-red" />
            <h2>Configuration</h2>
          </div>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-header">
          <h2>Theme</h2>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            background: C.surface,
            borderRadius: 10,
            border: `1px solid ${C.border}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isDark ? <Moon size={20} className="icon-blue" /> : <Sun size={20} className="icon-amber" />}
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: C.text }}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                border: 'none',
                background: isDark ? '#3b82f6' : '#e5e5e5',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: 3,
                left: isDark ? 27 : 3,
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* AI Model Selector */}
      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-header">
          <h2>AI Model</h2>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {[
            { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: 'Best analysis, deeper reasoning', color: '#a855f7' },
            { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', desc: 'Balanced speed and quality (default)', color: '#3b82f6' },
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: 'Fastest responses, lowest cost', color: '#22c55e' }
          ].map(m => {
            const isSelected = preferredModel === m.id
            return (
              <button
                key={m.id}
                onClick={() => setPreferredModel(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  background: isSelected ? `${m.color}12` : C.surface,
                  borderRadius: 10,
                  border: `2px solid ${isSelected ? m.color : C.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${isSelected ? m.color : C.muted}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isSelected && <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{m.label}</div>
                  <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>{m.desc}</div>
                </div>
                {isSelected && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, color: m.color,
                    background: `${m.color}18`, padding: '2px 8px', borderRadius: 999
                  }}>Active</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* System Skills — dynamic from API */}
      <SystemSkillsPanel C={C} />

      {/* Streamline Webhook Toggle */}
      {clientId && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <div className="panel-header">
            <div className="panel-header-left">
              <Send size={20} className="icon-red" />
              <h2>Streamline Webhook</h2>
            </div>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              background: C.surface,
              borderRadius: 10,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ flex: 1, marginRight: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500, color: C.text }}>
                    Send to Streamline
                  </span>
                  {webhookSaving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: C.muted }} />}
                </div>
                <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
                  Automatically send enrichment results to Streamline when enrichment completes
                </p>
              </div>
              <button
                onClick={toggleWebhook}
                disabled={webhookSaving}
                style={{
                  width: 52,
                  height: 28,
                  borderRadius: 14,
                  border: 'none',
                  background: webhookEnabled ? '#dc2626' : '#e5e5e5',
                  position: 'relative',
                  cursor: webhookSaving ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: 3,
                  left: webhookEnabled ? 27 : 3,
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                }} />
              </button>
            </div>
            <div style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.875rem',
              background: `${C.muted}10`,
              borderRadius: 8,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Webhook URL</span>
                {webhookUrlSaving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: C.muted }} />}
                {webhookUrlSaved && <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: 600 }}>Saved</span>}
              </div>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                onBlur={saveWebhookUrl}
                placeholder="https://hooks.example.com/webhook"
                style={{
                  width: '100%',
                  marginTop: 4,
                  padding: '0.5rem 0.625rem',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: C.text,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  outline: 'none',
                  boxSizing: 'border-box',
                  wordBreak: 'break-all'
                }}
              />
            </div>
            <p style={{ fontSize: '0.7rem', color: C.muted, marginTop: '0.625rem', lineHeight: 1.4 }}>
              The "Send to Streamline" button on the Results screen works regardless of this toggle — it's a manual override.
            </p>
          </div>
        </div>
      )}

      {/* Configure Buttons & Live Preview -- Two Column */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth > 600 ? '1fr 1fr' : '1fr',
        gap: 28,
        marginTop: '1rem'
      }}>
        {/* ── LEFT: Button List Editor ── */}
        <div style={{ animation: 'fadeIn .5s .1s ease backwards' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}>
            <h2 style={{
              fontSize: 16,
              fontWeight: 700,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Configure Buttons
            </h2>

            <button
              onClick={addButton}
              className="btn-hover"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#3b82f6', color: 'white',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all .2s',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Plus size={16} />
              Add Button
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {buttons.map((btn, index) => {
              const isEditing = editingId === btn.id
              const IconComp = ICON_MAP[btn.icon] || Zap

              return (
                <div
                  key={btn.id}
                  draggable
                  onDragStart={() => handleDragStart(btn.id)}
                  onDragOver={(e) => handleDragOver(e, btn.id)}
                  onDragEnd={handleDragEnd}
                  className="card-hover"
                  style={{
                    padding: 16,
                    background: C.surface,
                    border: `2px solid ${isEditing ? '#3b82f6' : C.border}`,
                    borderRadius: 12,
                    cursor: 'grab',
                    transition: 'all .2s',
                    animation: `slideIn .3s ${index * 0.05}s ease backwards`,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: isEditing ? 16 : 0,
                  }}>
                    <GripVertical size={18} color={C.muted} style={{ cursor: 'grab' }} />

                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: `${btn.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <IconComp size={18} color={btn.color} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: C.text,
                      }}>
                        {btn.label}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: C.muted,
                        marginTop: 2,
                      }}>
                        {COLORS.find(c => c.value === btn.color)?.name || 'Custom'} &bull; {btn.icon}
                      </div>
                      {btn.url && (
                        <div style={{
                          fontSize: 11,
                          color: '#3b82f6',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {btn.url}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setEditingId(isEditing ? null : btn.id)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: 'none',
                          background: isEditing ? '#3b82f6' : `${C.muted}20`,
                          color: isEditing ? 'white' : C.muted,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .2s',
                        }}
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        onClick={() => duplicateButton(btn)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: 'none',
                          background: `${C.muted}20`, color: C.muted,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .2s',
                        }}
                      >
                        <Copy size={14} />
                      </button>

                      <button
                        onClick={() => deleteButton(btn.id)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: 'none',
                          background: '#ef444420', color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .2s',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline Editing Panel */}
                  {isEditing && (
                    <div style={{
                      paddingTop: 16,
                      borderTop: `1px solid ${C.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      animation: 'fadeIn .3s ease',
                    }}>
                      {/* Label Input */}
                      <div>
                        <label style={{
                          display: 'block', fontSize: 11, fontWeight: 700,
                          color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 6,
                        }}>
                          Label
                        </label>
                        <input
                          type="text"
                          value={btn.label}
                          onChange={(e) => updateButton(btn.id, 'label', e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px',
                            background: C.bg, color: C.text,
                            border: `1px solid ${C.border}`,
                            borderRadius: 8, fontSize: 14, outline: 'none',
                          }}
                        />
                      </div>

                      {/* URL Input */}
                      <div>
                        <label style={{
                          display: 'block', fontSize: 11, fontWeight: 700,
                          color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 6,
                        }}>
                          URL
                        </label>
                        <input
                          type="text"
                          value={btn.url || ''}
                          onChange={(e) => updateButton(btn.id, 'url', e.target.value)}
                          placeholder="/enrich, /skills, or https://..."
                          style={{
                            width: '100%', padding: '8px 12px',
                            background: C.bg, color: C.text,
                            border: `1px solid ${C.border}`,
                            borderRadius: 8, fontSize: 14, outline: 'none',
                          }}
                        />
                      </div>

                      {/* Color Selector */}
                      <div>
                        <label style={{
                          display: 'block', fontSize: 11, fontWeight: 700,
                          color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 6,
                        }}>
                          Color
                        </label>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(8, 1fr)',
                          gap: 8,
                        }}>
                          {COLORS.map((c) => (
                            <button
                              key={c.value}
                              onClick={() => updateButton(btn.id, 'color', c.value)}
                              style={{
                                height: 36, borderRadius: 8,
                                border: btn.color === c.value ? `2px solid ${c.value}` : '2px solid transparent',
                                background: `${c.value}30`,
                                cursor: 'pointer', position: 'relative',
                                transition: 'all .2s',
                              }}
                            >
                              {btn.color === c.value && (
                                <Check
                                  size={16}
                                  color={c.value}
                                  style={{
                                    position: 'absolute',
                                    top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                  }}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Icon Selector */}
                      <div>
                        <label style={{
                          display: 'block', fontSize: 11, fontWeight: 700,
                          color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.05em', marginBottom: 6,
                        }}>
                          Icon
                        </label>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(10, 1fr)',
                          gap: 4,
                        }}>
                          {ICON_NAMES.map((iconName) => {
                            const Icon = ICON_MAP[iconName]
                            return (
                              <button
                                key={iconName}
                                onClick={() => updateButton(btn.id, 'icon', iconName)}
                                style={{
                                  aspectRatio: '1',
                                  borderRadius: 8,
                                  border: btn.icon === iconName ? `2px solid ${btn.color}` : `1px solid ${C.border}`,
                                  background: btn.icon === iconName ? `${btn.color}20` : C.bg,
                                  color: btn.icon === iconName ? btn.color : C.muted,
                                  cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all .2s',
                                }}
                              >
                                <Icon size={16} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {buttons.length === 0 && (
              <div style={{
                padding: 32, textAlign: 'center', color: C.muted,
                background: C.surface, border: `2px solid ${C.border}`,
                borderRadius: 12,
              }}>
                <Settings size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                <p>No buttons configured. Click "+ Add Button" to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div style={{ animation: 'fadeIn .5s .2s ease backwards' }}>
          <h2 style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}>
            Live Preview
          </h2>

          <div style={{
            marginTop: 24,
            padding: 16,
            background: C.surface,
            border: `2px solid ${C.border}`,
            borderRadius: 16,
            minHeight: 400,
          }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
              }}>
                {buttons.map((btn) => {
                  const IconComp = ICON_MAP[btn.icon] || Zap
                  return (
                    <button
                      key={btn.id}
                      className="btn-hover"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        background: btn.color,
                        color: 'white',
                        border: 'none',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        boxShadow: `0 4px 12px ${btn.color}40`,
                        transition: 'all .2s',
                      }}
                    >
                      <IconComp size={18} />
                      {btn.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// RESULTS SCREEN
// ============================================================
function ResultsScreen({ setShowModal, clientId, isAdmin }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedTables, setExpandedTables] = useState({})
  const [expandedProblems, setExpandedProblems] = useState({})
  const [streamlineSending, setStreamlineSending] = useState(false)
  const [streamlineStatus, setStreamlineStatus] = useState(null) // null | 'sent' | 'error'
  const [protoDownloading, setProtoDownloading] = useState(false)

  useEffect(() => {
    if (clientId) {
      fetchResults()
    }
  }, [clientId])

  const fetchResults = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/results/${clientId}`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) throw new Error('Failed to fetch results')
      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const sendToStreamline = async () => {
    setStreamlineSending(true)
    setStreamlineStatus(null)
    try {
      const response = await fetch(`${API_BASE}/send-to-streamline`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ client_id: clientId })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send')
      setStreamlineStatus('sent')
      setTimeout(() => setStreamlineStatus(null), 4000)
    } catch (err) {
      setStreamlineStatus('error')
      setTimeout(() => setStreamlineStatus(null), 4000)
    } finally {
      setStreamlineSending(false)
    }
  }

  const toggleTable = (tableName) => {
    setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }))
  }

  const toggleProblem = (index) => {
    setExpandedProblems(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#dc2626'
      case 'medium': return '#f59e0b'
      case 'low': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'high': return 'rgba(220, 38, 38, 0.1)'
      case 'medium': return 'rgba(245, 158, 11, 0.1)'
      case 'low': return 'rgba(59, 130, 246, 0.1)'
      default: return 'rgba(107, 116, 128, 0.1)'
    }
  }

  // Mock data for demonstration (remove when backend is ready)
  const mockResults = {
    status: 'complete',
    summary: 'This analysis reveals a mid-sized waste management company operating across three counties with approximately 2,500 commercial clients. The business demonstrates strong operational capabilities but faces challenges in route optimization, customer billing accuracy, and equipment maintenance tracking. Current revenue is estimated at $12-15M annually with modest EBITDA margins of 18-22%.',
    problems: [
      {
        title: 'Route Optimization Inefficiency',
        severity: 'high',
        evidence: 'Manual route planning leads to 15-20% excess fuel costs and driver overtime. Analysis of uploaded CSV data shows overlapping routes and suboptimal stop sequencing.',
        recommendation: 'Implement route optimization software. Expected ROI: $180K annually in fuel and labor savings.'
      },
      {
        title: 'Billing Reconciliation Errors',
        severity: 'high',
        evidence: 'Excel spreadsheets show 8-12% monthly discrepancies between service completion and invoicing. Lost revenue estimated at $60K-$90K annually.',
        recommendation: 'Integrate GPS tracking with automated billing system. Reduce reconciliation errors to <2%.'
      },
      {
        title: 'Equipment Maintenance Tracking',
        severity: 'medium',
        evidence: 'Maintenance records are paper-based and incomplete. Fleet downtime averages 12% vs. industry benchmark of 6-8%.',
        recommendation: 'Deploy fleet management system with predictive maintenance capabilities.'
      }
    ],
    schema: {
      tables: [
        {
          name: 'customers',
          purpose: 'Commercial client master data',
          columns: [
            { name: 'customer_id', type: 'UUID', description: 'Unique customer identifier' },
            { name: 'company_name', type: 'VARCHAR(255)', description: 'Business legal name' },
            { name: 'service_address', type: 'VARCHAR(500)', description: 'Primary pickup location' },
            { name: 'service_frequency', type: 'ENUM', description: 'Weekly, bi-weekly, monthly' },
            { name: 'container_type', type: 'VARCHAR(100)', description: 'Dumpster size and type' },
            { name: 'monthly_rate', type: 'DECIMAL(10,2)', description: 'Contracted service fee' }
          ],
          relationships: ['routes', 'invoices']
        },
        {
          name: 'routes',
          purpose: 'Daily service route assignments',
          columns: [
            { name: 'route_id', type: 'UUID', description: 'Unique route identifier' },
            { name: 'route_date', type: 'DATE', description: 'Scheduled service date' },
            { name: 'driver_id', type: 'UUID', description: 'Assigned driver' },
            { name: 'truck_id', type: 'UUID', description: 'Assigned vehicle' },
            { name: 'stop_sequence', type: 'INTEGER', description: 'Optimized stop order' },
            { name: 'customer_id', type: 'UUID', description: 'Foreign key to customers' }
          ],
          relationships: ['customers', 'trucks']
        },
        {
          name: 'trucks',
          purpose: 'Fleet vehicle master data and maintenance',
          columns: [
            { name: 'truck_id', type: 'UUID', description: 'Unique vehicle identifier' },
            { name: 'truck_number', type: 'VARCHAR(50)', description: 'Fleet number (e.g., T-042)' },
            { name: 'make_model', type: 'VARCHAR(100)', description: 'Vehicle manufacturer and model' },
            { name: 'year', type: 'INTEGER', description: 'Model year' },
            { name: 'mileage', type: 'INTEGER', description: 'Current odometer reading' },
            { name: 'last_maintenance', type: 'DATE', description: 'Most recent service date' }
          ],
          relationships: ['routes', 'maintenance_log']
        }
      ]
    },
    plan: [
      {
        phase: '30-day',
        actions: [
          'Audit existing customer database and geocode all service addresses',
          'Deploy GPS tracking units on all fleet vehicles',
          'Conduct time-motion study on current route performance',
          'Select route optimization vendor and begin integration planning'
        ]
      },
      {
        phase: '60-day',
        actions: [
          'Launch automated billing reconciliation with GPS validation',
          'Pilot route optimization on 2-3 high-volume routes',
          'Implement digital maintenance logging for fleet',
          'Train drivers on new mobile app for service confirmation'
        ]
      },
      {
        phase: '90-day',
        actions: [
          'Roll out route optimization across full fleet',
          'Measure fuel savings and driver overtime reduction',
          'Complete migration to automated billing for all customers',
          'Establish KPI dashboard for operations monitoring'
        ]
      }
    ],
    sources: [
      { type: 'client_data', reference: 'customer_list.csv (2,487 records)' },
      { type: 'client_data', reference: 'billing_export.xlsx (Q4 2025 invoices)' },
      { type: 'web_enrichment', reference: 'Company website analysis' },
      { type: 'web_enrichment', reference: 'Industry benchmarking data (Waste360, NWRA)' },
      { type: 'ai_analysis', reference: 'Claude Sonnet 4.5 - GPT analysis engine' }
    ]
  }

  const displayResults = results || mockResults

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <FileText size={20} className="icon-red" />
            <h2>Analysis Results</h2>
          </div>
        </div>
        <div className="empty-state">
          <Loader2 size={48} style={{ color: '#dc2626', animation: 'spin 1s linear infinite' }} />
          <p>Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <FileText size={20} className="icon-red" />
            <h2>Analysis Results</h2>
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{
            background: 'rgba(220, 38, 38, 0.05)',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <AlertCircle size={48} style={{ color: '#dc2626', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#dc2626' }}>
              Failed to Load Results
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {error}
            </p>
            <button onClick={fetchResults} className="action-btn red">
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', padding: '0 2rem' }}>
      {/* Header */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <FileText size={20} className="icon-red" />
            <h2>Analysis Results</h2>
            <span className="badge-count green">Complete</span>
          </div>
          {isAdmin && displayResults.status === 'complete' && displayResults.summary && displayResults.summary !== 'Analysis failed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {streamlineStatus === 'sent' && (
                <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 500 }}>Sent to Streamline</span>
              )}
              {streamlineStatus === 'error' && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>Failed to send</span>
              )}
              <button
                onClick={async () => {
                  setProtoDownloading(true)
                  try {
                    const res = await fetch(`${API_BASE}/rapid-prototype/${clientId}`, { headers: getAuthHeaders() })
                    if (!res.ok) throw new Error('Failed to generate spec')
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'PROTOTYPE-SPEC.md'
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  } catch (e) {
                    console.error('Prototype spec download failed:', e)
                  } finally {
                    setProtoDownloading(false)
                  }
                }}
                disabled={protoDownloading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  background: protoDownloading ? '#94a3b8' : '#000000',
                  color: 'white', border: 'none', borderRadius: 8,
                  cursor: protoDownloading ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem', fontWeight: 600,
                  transition: 'all .2s'
                }}
              >
                {protoDownloading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={14} />}
                {protoDownloading ? 'Generating...' : 'Download Prototype Spec (.md)'}
              </button>
              <button
                onClick={sendToStreamline}
                disabled={streamlineSending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  background: streamlineSending ? '#94a3b8' : '#3b82f6',
                  color: 'white', border: 'none', borderRadius: 8,
                  cursor: streamlineSending ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem', fontWeight: 600,
                  transition: 'all .2s'
                }}
              >
                {streamlineSending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                {streamlineSending ? 'Sending...' : 'Send to Streamline'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <TrendingUp size={20} className="icon-red" />
            <h2>Executive Summary</h2>
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-primary)' }}>
            {displayResults.summary}
          </p>
        </div>
      </div>

      {/* Bottom Line */}
      {displayResults.bottom_line && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-left">
              <Zap size={20} className="icon-red" />
              <h2>Bottom Line</h2>
            </div>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{
              background: 'rgba(220, 38, 38, 0.05)',
              border: '1px solid rgba(220, 38, 38, 0.15)',
              borderLeft: '4px solid #dc2626',
              borderRadius: '8px',
              padding: '1rem 1.25rem'
            }}>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
                {displayResults.bottom_line}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Problems Identified */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <AlertTriangle size={20} className="icon-red" />
            <h2>Problems Identified</h2>
            <span className="badge-count red">{displayResults.problems?.length || 0}</span>
          </div>
        </div>
        <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
          {displayResults.problems?.map((problem, index) => (
            <div
              key={index}
              style={{
                border: `1px solid ${getSeverityColor(problem.severity)}20`,
                borderLeft: `4px solid ${getSeverityColor(problem.severity)}`,
                borderRadius: '10px',
                background: 'var(--bg-card-alt)',
                overflow: 'hidden'
              }}
            >
              <div
                onClick={() => toggleProblem(index)}
                style={{
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {problem.title}
                    </h3>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: getSeverityBg(problem.severity),
                      color: getSeverityColor(problem.severity),
                      textTransform: 'uppercase'
                    }}>
                      {problem.severity}
                    </span>
                  </div>
                </div>
                {expandedProblems[index] ? (
                  <ChevronDown size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                ) : (
                  <ChevronRight size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                )}
              </div>
              {expandedProblems[index] && (
                <div style={{
                  padding: '0 1.25rem 1rem',
                  borderTop: '1px solid #e5e5e5'
                }}>
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Evidence
                    </p>
                    <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                      {problem.evidence}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Recommendation
                    </p>
                    <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      {problem.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Proposed Architecture */}
      {displayResults.architecture_diagram && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header-left">
              <Package size={20} className="icon-red" />
              <h2>Proposed Architecture</h2>
            </div>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <pre style={{
              background: 'var(--bg-card-alt)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '1.25rem',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              fontFamily: 'Monaco, Menlo, Consolas, monospace',
              color: 'var(--text-primary)',
              overflowX: 'auto',
              margin: 0,
              whiteSpace: 'pre'
            }}>
              {displayResults.architecture_diagram}
            </pre>
          </div>
        </div>
      )}

      {/* Proposed Schema */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <Database size={20} className="icon-red" />
            <h2>Proposed Data Schema</h2>
            <span className="badge-count blue">{displayResults.schema?.tables?.length || 0} Tables</span>
          </div>
        </div>
        <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
          {displayResults.schema?.tables?.map((table, index) => (
            <div
              key={index}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                background: 'var(--bg-card-alt)',
                overflow: 'hidden'
              }}
            >
              <div
                onClick={() => toggleTable(table.name)}
                style={{
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {table.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {table.purpose}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="badge-count blue">{table.columns?.length || 0} columns</span>
                  {expandedTables[table.name] ? (
                    <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} />
                  ) : (
                    <ChevronRight size={20} style={{ color: 'var(--text-secondary)' }} />
                  )}
                </div>
              </div>
              {expandedTables[table.name] && (
                <div style={{
                  padding: '0 1.25rem 1rem',
                  borderTop: '1px solid #e5e5e5'
                }}>
                  <div style={{ marginTop: '1rem' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Column</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns?.map((col, colIndex) => (
                          <tr key={colIndex} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '0.625rem 0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>{col.name}</td>
                            <td style={{ padding: '0.625rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{col.type}</td>
                            <td style={{ padding: '0.625rem 0.5rem', color: 'var(--text-secondary)' }}>{col.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
          {/* Schema Relationships */}
          {displayResults.schema?.relationships?.length > 0 && (
            <div style={{
              marginTop: '0.25rem',
              padding: '0.75rem 1rem',
              background: 'var(--bg-card-alt)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Relationships
              </p>
              {displayResults.schema.relationships.map((rel, i) => (
                <p key={i} style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'Monaco, Menlo, Consolas, monospace',
                  margin: '0.25rem 0',
                  lineHeight: 1.5
                }}>
                  {rel}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7/14/21 Day Plan */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <Calendar size={20} className="icon-red" />
            <h2>7/14/21 Day Action Plan</h2>
          </div>
        </div>
        <div style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
          {displayResults.plan?.map((phase, index) => (
            <div
              key={index}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                background: 'var(--bg-card-alt)',
                padding: '1rem 1.25rem'
              }}
            >
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#dc2626',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {phase.phase}
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
                {phase.actions?.map((action, actionIndex) => (
                  <li key={actionIndex} style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <Globe size={20} className="icon-red" />
            <h2>Data Sources</h2>
            <span className="badge-count">{displayResults.sources?.length || 0}</span>
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {displayResults.sources?.map((source, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--bg-card-alt)',
                  borderRadius: '8px',
                  fontSize: '0.85rem'
                }}
              >
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  background: source.type === 'client_data' ? 'rgba(220, 38, 38, 0.1)' : source.type === 'web_enrichment' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                  color: source.type === 'client_data' ? '#dc2626' : source.type === 'web_enrichment' ? '#3b82f6' : '#6b7280',
                  textTransform: 'uppercase'
                }}>
                  {source.type.replace('_', ' ')}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{source.reference}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
