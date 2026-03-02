import React, { useState, useEffect } from 'react'
import { X, Upload, Sparkles, FileText, Building2, FileText as FileIcon, Trash2, CheckCircle2, Music, Loader2, CheckCircle, Clock, AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Database, Calendar, Globe, TrendingUp, Menu, Settings, Moon, Sun, GripVertical, Copy, Edit2, Plus, Home, Zap, Heart, Star, Send, Check, Save, User, Bell, Search, Mail, Phone, MapPin, Play, ExternalLink, Package, LogOut, Lock, Eye, EyeOff, Cloud, FolderOpen, ChevronLeft, HardDrive } from 'lucide-react'
import logoLight from './assets/logo-light.png'
import logoDark from './assets/logo-dark.png'

// ============================================================
// XO PROTOTYPE - MAIN APP
// Three screens: Upload -> Enrich -> Results
// ============================================================

const API_BASE = 'https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod'

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
// LOGIN SCREEN
// ============================================================
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
                <span>Rapid Deployment</span>
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
            Invitation
          </p>

          <form onSubmit={handleSubmit} style={{
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

            {/* Helper text */}
            <p style={{
              textAlign: 'center', marginTop: '20px',
              fontSize: '13px', color: '#9ca3af', lineHeight: '1.5'
            }}>
              Enter your email and password to get started.
            </p>
          </form>
        </div>
      </div>
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
    initialAuth.user?.preferred_model || 'claude-opus-4-5-20250529'
  )

  const handleLogin = (userData, token) => {
    setUser(userData)
    setAuthToken(token)
    setIsLoggedIn(true)
    if (userData.preferred_model) setPreferredModel(userData.preferred_model)
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
    localStorage.removeItem('xo-token')
    localStorage.removeItem('xo-user')
    setCurrentScreen('upload')
  }

  const [currentScreen, setCurrentScreen] = useState('upload') // upload | enrich | results | skills | configuration
  const [showModal, setShowModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [clientId, setClientId] = useState(null) // Set after upload completes
  const [companyData, setCompanyData] = useState({
    name: '',
    website: '',
    contactName: '',
    contactTitle: '',
    contactLinkedIn: '',
    industry: '',
    description: '',
    painPoint: ''
  })

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

  // Custom buttons state - synced with PostgreSQL via API
  const [configButtons, setConfigButtons] = useState(DEFAULT_BUTTONS)
  const [buttonsLoaded, setButtonsLoaded] = useState(false)

  // Fetch buttons from API after login
  useEffect(() => {
    if (isLoggedIn && !buttonsLoaded) {
      fetchButtons()
    }
  }, [isLoggedIn])

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
                <span className="header-title-desktop">XO Quickstart</span>
                <span className="header-title-mobile">Rapid Prototype</span>
                <span className="version-badge">Rapid Prototype</span>
              </h1>
              <p>{companyData.name || 'Domain Partner Onboarding'}</p>
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
              background: 'rgba(0, 0, 0, 0.5)',
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
              width: '280px',
              background: '#1a1a2e',
              zIndex: 201,
              boxShadow: '2px 0 8px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Sidebar Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="logo-box" style={{ width: '32px', height: '32px', fontSize: '1rem' }}>XO</div>
                <div>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem', display: 'block' }}>{user?.name || 'Menu'}</span>
                  {user?.email && <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>{user.email}</span>}
                </div>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <nav style={{ flex: 1, padding: '1rem 0' }}>
              {[
                { screen: 'upload', icon: Home, label: 'Welcome' },
                { screen: 'enrich', icon: Sparkles, label: 'Enrich' },
                { screen: 'results', icon: FileText, label: 'Results' },
                { screen: 'skills', icon: Database, label: 'Skills' },
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
                    padding: '0.875rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '0.75rem 1rem'
              }} />
              <button
                onClick={() => navigateTo('configuration')}
                style={{
                  width: '100%',
                  background: currentScreen === 'configuration' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                  border: 'none',
                  borderLeft: currentScreen === 'configuration' ? '3px solid #dc2626' : '3px solid transparent',
                  color: currentScreen === 'configuration' ? '#dc2626' : '#ffffff',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <Settings size={20} />
                Configuration
              </button>

              {/* Theme Toggle in Sidebar */}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '0.75rem 1rem'
              }} />
              <div
                style={{
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', fontWeight: 500 }}>
                  {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </div>
                <button
                  onClick={toggleTheme}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: theme === 'dark' ? '#3b82f6' : 'rgba(255, 255, 255, 0.3)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: theme === 'dark' ? '23px' : '3px',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                  }} />
                </button>
              </div>

              {/* Sign Out */}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '0.75rem 1rem'
              }} />
              <button
                onClick={() => { setShowSidebar(false); handleLogout() }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderLeft: '3px solid transparent',
                  color: '#ef4444',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                <LogOut size={20} />
                Sign Out
              </button>
            </nav>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main">
        {/* Screen Content */}
        {currentScreen === 'upload' && (
          <UploadScreen
            setClientId={setClientId}
            companyData={companyData}
            onComplete={() => setCurrentScreen('enrich')}
            onOpenCompanyModal={() => setShowCompanyModal(true)}
            configButtons={configButtons}
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
        {currentScreen === 'results' && <ResultsScreen setShowModal={setShowModal} clientId={clientId} />}
        {currentScreen === 'skills' && <SkillsScreen clientId={clientId} />}
        {currentScreen === 'configuration' && <ConfigurationScreen theme={theme} toggleTheme={toggleTheme} buttons={configButtons} setButtons={saveButtons} preferredModel={preferredModel} setPreferredModel={saveModelPreference} />}
      </main>

      {/* Company Information Modal */}
      {showCompanyModal && (
        <CompanyInfoModal
          companyData={companyData}
          setCompanyData={setCompanyData}
          onClose={() => setShowCompanyModal(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// COMPANY INFORMATION MODAL
// ============================================================
function CompanyInfoModal({ companyData, setCompanyData, onClose }) {
  const [localData, setLocalData] = useState({ ...companyData })

  const handleSave = () => {
    if (!localData.name.trim()) {
      alert('Company name is required')
      return
    }
    setCompanyData(localData)
    onClose()
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

            {/* Contact Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Contact Name
              </label>
              <input
                type="text"
                value={localData.contactName}
                onChange={(e) => setLocalData({ ...localData, contactName: e.target.value })}
                placeholder="Primary contact person"
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

            {/* Contact Title */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Contact Title/Role
              </label>
              <input
                type="text"
                value={localData.contactTitle}
                onChange={(e) => setLocalData({ ...localData, contactTitle: e.target.value })}
                placeholder="e.g., CEO, Operations Manager"
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

            {/* LinkedIn URL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Contact LinkedIn URL
              </label>
              <input
                type="url"
                value={localData.contactLinkedIn}
                onChange={(e) => setLocalData({ ...localData, contactLinkedIn: e.target.value })}
                placeholder="https://linkedin.com/in/..."
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
// UPLOAD SCREEN
// ============================================================
function UploadScreen({ setClientId, companyData, onComplete, onOpenCompanyModal, configButtons, onNavigate }) {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [error, setError] = useState(null)
  const [audioContext, setAudioContext] = useState({}) // { filename: { date, participants, topic } }

  // Google Drive state
  const [gdriveConnected, setGdriveConnected] = useState(false)
  const [gdriveLoading, setGdriveLoading] = useState(false)
  const [showGdrivePicker, setShowGdrivePicker] = useState(false)
  const [gdriveFiles, setGdriveFiles] = useState([])
  const [selectedGdriveFiles, setSelectedGdriveFiles] = useState([])
  const [gdriveImporting, setGdriveImporting] = useState(false)
  const [currentGdriveFolder, setCurrentGdriveFolder] = useState('root')
  const [gdriveFolderStack, setGdriveFolderStack] = useState([])

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    addFiles(selectedFiles)
  }

  const addFiles = (newFiles) => {
    const validTypes = [
      'text/csv',
      'text/plain',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/json',
      'application/xml',
      'text/xml',
      'application/zip',
      'application/x-zip-compressed',
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac'
    ]
    const filtered = newFiles.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      const validExtensions = ['csv', 'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'xml', 'zip', 'mp3', 'wav', 'm4a', 'aac']
      return validTypes.includes(file.type) || validExtensions.includes(ext)
    })
    setFiles(prev => [...prev, ...filtered])
    // Auto-initialize audio context for new audio files
    const today = new Date().toISOString().split('T')[0]
    const newContexts = {}
    filtered.forEach(file => {
      if (isAudioFile(file.name)) {
        newContexts[file.name] = { date: today, participants: '', topic: '' }
      }
    })
    if (Object.keys(newContexts).length > 0) {
      setAudioContext(prev => ({ ...prev, ...newContexts }))
    }
  }

  const isAudioFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    return ['mp3', 'wav', 'm4a', 'aac'].includes(ext)
  }

  const updateAudioContext = (filename, field, value) => {
    setAudioContext(prev => ({
      ...prev,
      [filename]: { ...prev[filename], [field]: value }
    }))
  }

  const removeFile = (index) => {
    setFiles(prev => {
      const removed = prev[index]
      if (removed && isAudioFile(removed.name)) {
        setAudioContext(ac => {
          const copy = { ...ac }
          delete copy[removed.name]
          return copy
        })
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleUpload = async () => {
    console.log('Upload button clicked')
    console.log('Company data:', companyData)
    console.log('Files:', files)

    if (!companyData.name.trim()) {
      setError('Please enter company name')
      alert('Please enter company name')
      return
    }
    if (files.length === 0) {
      setError('Please upload at least one file')
      alert('Please upload at least one file')
      return
    }

    setError(null)
    setUploading(true)
    console.log('Starting upload process...')

    try {
      // Step 1: Create client
      const clientResponse = await fetch(`${API_BASE}/clients`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          company_name: companyData.name,
          website: companyData.website,
          contactName: companyData.contactName,
          contactTitle: companyData.contactTitle,
          contactLinkedIn: companyData.contactLinkedIn,
          industry: companyData.industry,
          description: companyData.description,
          painPoint: companyData.painPoint
        })
      })

      if (!clientResponse.ok) {
        const errorData = await clientResponse.json()
        throw new Error(errorData.error || 'Failed to create client')
      }
      const { client_id } = await clientResponse.json()
      setClientId(client_id)
      console.log('Created client:', client_id)

      // Step 2: Separate manual files from imported (Drive) files
      const manualFiles = files.filter(f => !f._imported)
      const importedFiles = files.filter(f => f._imported)

      if (manualFiles.length > 0) {
        // Build context JSON blobs for audio files
        const contextUploads = [] // { name, blob }
        manualFiles.forEach(f => {
          if (isAudioFile(f.name) && audioContext[f.name]) {
            const ctx = audioContext[f.name]
            const contextBlob = new Blob(
              [JSON.stringify({ date: ctx.date, participants: ctx.participants, topic: ctx.topic })],
              { type: 'application/json' }
            )
            contextUploads.push({ name: `${f.name}.context.json`, blob: contextBlob })
          }
        })

        // Combined file list: manual files + context JSONs
        const allUploadEntries = [
          ...manualFiles.map(f => ({ name: f.name, type: f.type })),
          ...contextUploads.map(c => ({ name: c.name, type: 'application/json' }))
        ]

        // Get presigned URLs for all files (manual + context)
        console.log('Getting presigned URLs for', allUploadEntries.length, 'files (inc. context)')
        const uploadResponse = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            client_id,
            files: allUploadEntries
          })
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Failed to get upload URLs')
        }
        const { upload_urls } = await uploadResponse.json()
        console.log('Received', upload_urls.length, 'presigned URLs')

        // Step 3: Upload manual files to S3
        for (let i = 0; i < manualFiles.length; i++) {
          const file = manualFiles[i]
          const url = upload_urls[i]

          console.log(`Uploading file ${i + 1}/${manualFiles.length}: ${file.name}`)
          const s3Response = await fetch(url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
          })

          if (!s3Response.ok) {
            throw new Error(`Failed to upload ${file.name} to S3`)
          }

          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
          console.log(`Successfully uploaded: ${file.name}`)
        }

        // Upload context JSON files for audio
        for (let i = 0; i < contextUploads.length; i++) {
          const ctx = contextUploads[i]
          const url = upload_urls[manualFiles.length + i]
          console.log(`Uploading audio context: ${ctx.name}`)
          const ctxResponse = await fetch(url, {
            method: 'PUT',
            body: ctx.blob,
            headers: { 'Content-Type': 'application/json' }
          })
          if (!ctxResponse.ok) {
            console.warn(`Failed to upload context for ${ctx.name}`)
          }
        }
      }

      // Mark imported files as complete too
      importedFiles.forEach(f => {
        setUploadProgress(prev => ({ ...prev, [f.name]: 100 }))
      })

      console.log('All files uploaded successfully')
      // Success - move to enrich screen
      setTimeout(() => {
        console.log('Navigating to enrich screen')
        onComplete()
      }, 500)

    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message)
      alert('Upload failed: ' + err.message)
      setUploading(false)
    }
  }

  // === Google Drive OAuth & File Functions ===

  const connectGoogleDrive = async () => {
    setGdriveLoading(true)
    try {
      const res = await fetch(`${API_BASE}/gdrive/auth-url`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get auth URL')

      // Open popup for Google OAuth
      const popup = window.open(data.auth_url, 'google-drive-auth', 'width=500,height=600,scrollbars=yes')

      // Poll for redirect back to our origin
      const pollTimer = setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            clearInterval(pollTimer)
            setGdriveLoading(false)
            return
          }
          const popupUrl = popup.location.href
          if (popupUrl.startsWith(window.location.origin)) {
            clearInterval(pollTimer)
            const url = new URL(popupUrl)
            const code = url.searchParams.get('code')
            popup.close()

            if (code) {
              await exchangeGdriveCode(code)
            }
            setGdriveLoading(false)
          }
        } catch {
          // Cross-origin error while popup is on Google's domain - ignore
        }
      }, 500)
    } catch (err) {
      console.error('Google Drive connect error:', err)
      setGdriveLoading(false)
    }
  }

  const exchangeGdriveCode = async (code) => {
    try {
      const res = await fetch(`${API_BASE}/gdrive/callback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ code })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to connect')
      setGdriveConnected(true)
    } catch (err) {
      console.error('Exchange code error:', err)
    }
  }

  const fetchGdriveFiles = async (folderId = 'root') => {
    try {
      const res = await fetch(`${API_BASE}/gdrive/files?folder_id=${folderId}`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to list files')
      setGdriveFiles(data.files || [])
      setCurrentGdriveFolder(folderId)
    } catch (err) {
      console.error('Fetch Drive files error:', err)
    }
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
    if (parent) {
      await fetchGdriveFiles(parent.id)
    } else {
      await fetchGdriveFiles('root')
    }
  }

  const toggleGdriveFileSelection = (file) => {
    setSelectedGdriveFiles(prev => {
      const exists = prev.find(f => f.id === file.id)
      if (exists) return prev.filter(f => f.id !== file.id)
      return [...prev, file]
    })
  }

  const importGdriveFiles = async () => {
    if (selectedGdriveFiles.length === 0) return
    setGdriveImporting(true)
    try {
      const res = await fetch(`${API_BASE}/gdrive/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          file_ids: selectedGdriveFiles.map(f => f.id),
          client_id: 'pending' // Will be created on upload
        })
      })

      if (res.ok) {
        const data = await res.json()
        // Add imported files to the file list as pseudo-File objects
        const importedFileObjects = (data.files || []).map(f => ({
          name: f.name,
          type: f.type,
          size: 0,
          _imported: true,
          _source: 'google_drive',
          _s3Key: f.s3_key
        }))
        setFiles(prev => [...prev, ...importedFileObjects])
      }

      setShowGdrivePicker(false)
      setSelectedGdriveFiles([])
    } catch (err) {
      console.error('Import error:', err)
    }
    setGdriveImporting(false)
  }

  const driveFileCount = files.filter(f => f._source === 'google_drive').length

  const step1Complete = !!companyData.name  // Domain Expertise first
  const step2Complete = files.length > 0     // Raw Data second
  const allStepsComplete = step1Complete && step2Complete

  return (
    <div>
      {/* Journey Steps - Horizontal Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>

        {/* Step 1: Domain Expertise */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '0.875rem',
          border: step1Complete ? '2px solid #dc2626' : '2px solid transparent',
          transition: 'all 0.3s',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Step Number Circle */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: step1Complete ? '#dc2626' : 'rgba(220, 38, 38, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            border: '2px solid rgba(220, 38, 38, 0.3)',
            transition: 'all 0.3s'
          }}>
            {step1Complete ? (
              <CheckCircle2 size={24} style={{ color: 'white' }} />
            ) : (
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>1</span>
            )}
          </div>

          {/* Step Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'white',
              marginBottom: '0.25rem',
              letterSpacing: '-0.01em'
            }}>
              DOMAIN EXPERTISE
            </h3>
            <p style={{
              fontSize: '0.75rem',
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem'
            }}>
              The Filter
            </p>

            <p style={{
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.5,
              marginBottom: '0.75rem',
              flex: 1
            }}>
              Tell us about your business. YOU are the filter.
            </p>

            {!companyData.name ? (
              <button
                onClick={onOpenCompanyModal}
                className="action-btn red"
                style={{
                  justifyContent: 'center',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  width: '100%'
                }}
              >
                <Building2 size={18} />
                New Partner
              </button>
            ) : (
              <div style={{
                padding: '0.875rem',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {companyData.name}
                  </p>
                  {companyData.industry && (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {companyData.industry}
                    </p>
                  )}
                </div>
                <button
                  onClick={onOpenCompanyModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '0.25rem',
                    flexShrink: 0
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>

          {/* Step 2: Raw Data */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '0.875rem',
          border: step2Complete ? '2px solid #dc2626' : '2px solid transparent',
          transition: 'all 0.3s',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Step Number Circle */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: step2Complete ? '#dc2626' : 'rgba(220, 38, 38, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            border: '2px solid rgba(220, 38, 38, 0.3)',
            transition: 'all 0.3s'
          }}>
            {step2Complete ? (
              <CheckCircle2 size={24} style={{ color: 'white' }} />
            ) : (
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>2</span>
            )}
          </div>

          {/* Step Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'white',
              marginBottom: '0.25rem',
              letterSpacing: '-0.01em'
            }}>
              RAW DATA
            </h3>
            <p style={{
              fontSize: '0.75rem',
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem'
            }}>
              The Noise
            </p>

            <p style={{
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.5,
              marginBottom: '0.75rem'
            }}>
              Drop your documents. We'll analyze everything.
            </p>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? '#dc2626' : 'rgba(255, 255, 255, 0.2)'}`,
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
                background: isDragging ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => document.getElementById('file-input').click()}
            >
              <Upload size={32} style={{ color: '#dc2626', opacity: 0.7, marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>
                {files.length > 0
                  ? `${files.length} file${files.length !== 1 ? 's' : ''} selected${driveFileCount > 0 ? ` (${driveFileCount} from Drive)` : ''}`
                  : 'Drop or click'}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                CSV, Excel, Word, PDF, Audio, and more
              </p>
              <input
                id="file-input"
                type="file"
                multiple
                accept=".csv,.txt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.json,.xml,.zip,.mp3,.wav,.m4a,.aac"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {/* Audio Context Forms */}
            {files.filter(f => isAudioFile(f.name)).length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {files.filter(f => isAudioFile(f.name)).map(file => {
                  const ctx = audioContext[file.name] || { date: '', participants: '', topic: '' }
                  return (
                    <div key={file.name} style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '0.625rem 0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                        <Music size={14} style={{ color: '#dc2626' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>{file.name}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0.375rem' }}>
                        <input
                          type="date"
                          value={ctx.date}
                          onChange={e => updateAudioContext(file.name, 'date', e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '0.7rem',
                            padding: '0.35rem 0.4rem',
                            outline: 'none',
                            colorScheme: 'dark'
                          }}
                        />
                        <input
                          type="text"
                          placeholder="e.g., Ken Scott, Alan Moore"
                          value={ctx.participants}
                          onChange={e => updateAudioContext(file.name, 'participants', e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '0.7rem',
                            padding: '0.35rem 0.5rem',
                            outline: 'none'
                          }}
                        />
                        <input
                          type="text"
                          placeholder="e.g., Weekly strategy call"
                          value={ctx.topic}
                          onChange={e => updateAudioContext(file.name, 'topic', e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '0.7rem',
                            padding: '0.35rem 0.5rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Sources Strip */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.375rem',
              marginTop: '0.625rem'
            }}>
              {/* Upload - always active */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.65rem',
                fontWeight: 600,
                background: 'rgba(220, 38, 38, 0.15)',
                color: '#dc2626',
                border: '1px solid rgba(220, 38, 38, 0.3)'
              }}>
                <Upload size={11} /> Upload
              </span>

              {/* Google Drive - active connector */}
              <button
                onClick={gdriveConnected ? openGdrivePicker : connectGoogleDrive}
                disabled={gdriveLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  background: gdriveConnected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  color: gdriveConnected ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
                  border: gdriveConnected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: gdriveLoading ? 'wait' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {gdriveLoading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <HardDrive size={11} />}
                {gdriveConnected ? 'Google Drive' : 'Connect Drive'}
              </button>

              {/* NotebookLM - grayed out */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.65rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <FileText size={11} /> NotebookLM
              </span>

              {/* Dropbox - grayed out */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.65rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <Cloud size={11} /> Dropbox
              </span>

              {/* OneDrive - grayed out */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.65rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <Cloud size={11} /> OneDrive
              </span>
            </div>
          </div>
        </div>

        {/* Step 3: Intelligent Growth */}
        <div style={{
          background: allStepsComplete ? '#1a1a2e' : '#2a2a3e',
          borderRadius: '12px',
          padding: '0.875rem',
          border: allStepsComplete ? '2px solid transparent' : '2px solid rgba(100, 100, 100, 0.3)',
          transition: 'all 0.3s',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Step Number Circle */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: allStepsComplete ? 'rgba(220, 38, 38, 0.2)' : 'rgba(150, 150, 150, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            border: `2px solid ${allStepsComplete ? 'rgba(220, 38, 38, 0.3)' : 'rgba(150, 150, 150, 0.4)'}`,
            transition: 'all 0.3s'
          }}>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: allStepsComplete ? '#dc2626' : '#999'
            }}>3</span>
          </div>

          {/* Step Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: allStepsComplete ? 'white' : 'rgba(255, 255, 255, 0.7)',
              marginBottom: '0.25rem',
              letterSpacing: '-0.01em'
            }}>
              INTELLAGENTIC GROWTH
            </h3>
            <p style={{
              fontSize: '0.75rem',
              color: allStepsComplete ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.55)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem'
            }}>
              The Output
            </p>

            <p style={{
              fontSize: '0.85rem',
              color: allStepsComplete ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.65)',
              lineHeight: 1.5,
              marginBottom: '0.75rem',
              flex: 1
            }}>
              MBA-level analysis. Problems identified. Schema proposed. Action plan delivered.
            </p>

            {!allStepsComplete && (
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.5)',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                Complete steps 1 & 2 →
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI-Powered Tagline */}
      <div style={{
        textAlign: 'center',
        margin: '1.5rem 0 1rem',
        padding: '0.75rem 1rem',
        borderTop: '1px solid #e5e5e5',
        borderBottom: '1px solid #e5e5e5'
      }}>
        <p style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#3b82f6',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: 0
        }}>
          AI-Powered Business Intelligence
        </p>
      </div>

      {/* Custom Buttons from Configuration */}
      {configButtons && configButtons.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          margin: '1rem 0',
          padding: '0 0.5rem'
        }}>
          {configButtons.map((btn) => {
            const IconComp = ICON_MAP[btn.icon] || Zap
            const handleClick = () => {
              const url = btn.url || ''
              // Internal route (starts with /)
              if (url.startsWith('/') && ROUTE_MAP[url]) {
                onNavigate(ROUTE_MAP[url])
              // External URL
              } else if (url.startsWith('http://') || url.startsWith('https://')) {
                window.open(url, '_blank', 'noopener,noreferrer')
              // "New Partner" button opens company modal
              } else if (btn.label === 'New Partner') {
                onOpenCompanyModal()
              }
            }
            return (
              <button
                key={btn.id}
                type="button"
                onClick={handleClick}
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
      )}

      {/* Founder Quotes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        margin: '1rem 0 1rem',
        padding: '0 0.5rem'
      }}>
        {/* Alan's Quote */}
        <div style={{
          position: 'relative',
          padding: '0.25rem 0'
        }}>
          <div style={{
            fontSize: '3.5rem',
            lineHeight: 0.8,
            color: '#dc2626',
            fontFamily: 'Georgia, serif',
            marginBottom: '0.25rem',
            opacity: 0.8
          }}>
            "
          </div>
          <p style={{
            fontSize: '0.95rem',
            fontStyle: 'italic',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            marginBottom: '0.625rem'
          }}>
            I wasn't leading. I was typing at 6:00 AM. I became my own admin clerk.
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            — Alan Moore, Co-Founder & CEO, Intellagentic
          </p>
        </div>

        {/* Ken's Quote */}
        <div style={{
          position: 'relative',
          padding: '0.25rem 0'
        }}>
          <div style={{
            fontSize: '3.5rem',
            lineHeight: 0.8,
            color: '#dc2626',
            fontFamily: 'Georgia, serif',
            marginBottom: '0.25rem',
            opacity: 0.8
          }}>
            "
          </div>
          <p style={{
            fontSize: '0.95rem',
            fontStyle: 'italic',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            marginBottom: '0.625rem'
          }}>
            We're business operators first, not technologists. We built this because we needed it.
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            — Ken Scott, Co-Founder & President, Intellagentic
          </p>
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

      {/* Upload Button - Only show when both steps complete */}
      {allStepsComplete && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="action-btn red"
          style={{
            width: '100%',
            padding: '1.25rem',
            fontSize: '1.125rem',
            justifyContent: 'center',
            opacity: uploading ? 0.7 : 1,
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}
        >
          {uploading ? (
            <>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              Uploading {files.length} file{files.length !== 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <Upload size={24} />
              Upload & Continue to Enrichment
            </>
          )}
        </button>
      )}
      {/* Google Drive File Picker Modal */}
      {showGdrivePicker && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a2e',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '520px',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
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

            {/* Back Button */}
            {gdriveFolderStack.length > 0 && (
              <button
                onClick={navigateGdriveBack}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.5rem 1.25rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  color: '#3b82f6',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}

            {/* File List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
              {gdriveFiles.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '2rem', fontSize: '0.85rem' }}>
                  No files found in this folder
                </p>
              ) : (
                gdriveFiles.map(file => {
                  const isSelected = selectedGdriveFiles.some(f => f.id === file.id)
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        if (file.isFolder) {
                          navigateToGdriveFolder(file.id, file.name)
                        } else {
                          toggleGdriveFileSelection(file)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        padding: '0.625rem 1.25rem',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      {file.isFolder ? (
                        <FolderOpen size={18} style={{ color: '#facc15', flexShrink: 0 }} />
                      ) : isSelected ? (
                        <CheckCircle2 size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                      ) : (
                        <FileText size={18} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                      )}
                      <span style={{
                        fontSize: '0.85rem',
                        color: isSelected ? '#3b82f6' : 'white',
                        fontWeight: isSelected ? 600 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {file.name}
                      </span>
                      {file.isFolder && (
                        <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                {selectedGdriveFiles.length} file{selectedGdriveFiles.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={importGdriveFiles}
                disabled={selectedGdriveFiles.length === 0 || gdriveImporting}
                className="action-btn red"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8rem',
                  opacity: selectedGdriveFiles.length === 0 ? 0.4 : 1,
                  cursor: selectedGdriveFiles.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {gdriveImporting ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importing...</>
                ) : (
                  <><Upload size={14} /> Import Files</>
                )}
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
  'claude-opus-4-5-20250529': 'Claude Opus 4.5',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4.5'
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
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/results/${id}`, {
          headers: getAuthHeaders()
        })
        if (!response.ok) throw new Error('Failed to fetch status')

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
          setError(data.error || 'Enrichment failed')
        }

      } catch (err) {
        clearInterval(pollInterval)
        setError(err.message)
        setJobStatus('error')
      }
    }, 2000) // Poll every 2 seconds
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', position: 'relative' }}>
              <button
                onClick={startEnrichment}
                className="action-btn red"
                style={{ padding: '0.875rem 2rem', fontSize: '1rem' }}
              >
                <Sparkles size={20} />
                Start Enrichment
              </button>
              <button
                onClick={() => setShowInfoPopover(!showInfoPopover)}
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

              {/* Enrichment Info Popover */}
              {showInfoPopover && (
                <>
                  <div
                    onClick={() => setShowInfoPopover(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: 340,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    zIndex: 100,
                    padding: '1.25rem',
                    textAlign: 'left'
                  }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.875rem' }}>
                      What happens when you click Enrich?
                    </h4>
                    {[
                      { num: '1', label: 'Extract', desc: 'Read all uploaded documents, transcribe audio files', icon: FileText },
                      { num: '2', label: 'Context', desc: 'Company info, pain points, and survival metrics guide the analysis', icon: Building2 },
                      { num: '3', label: 'Skills', desc: 'System + domain + client skills shape how AI thinks', icon: Database },
                      { num: '4', label: 'Web Research', desc: 'Company, competitors, and market research', icon: Globe },
                      { num: '5', label: 'AI Analysis', desc: `${MODEL_LABELS[preferredModel] || 'Claude'} produces MBA-level analysis`, icon: Sparkles },
                      { num: '6', label: 'Output', desc: 'Problems, architecture, schema, 30/60/90 day plan', icon: CheckCircle }
                    ].map(step => (
                      <div key={step.num} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '0.625rem' }}>
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'rgba(220, 38, 38, 0.1)',
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: 1
                        }}>
                          {step.num}
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{step.label}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.375rem' }}>{step.desc}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.625rem',
                      borderTop: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: preferredModel.includes('opus') ? '#a855f7' : '#3b82f6',
                        background: preferredModel.includes('opus') ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        border: `1px solid ${preferredModel.includes('opus') ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                      }}>
                        {MODEL_LABELS[preferredModel] || preferredModel}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Change model in Configuration
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
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
function SkillsScreen({ clientId }) {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)

  useEffect(() => {
    if (clientId) {
      fetchSkills()
    } else {
      setLoading(false)
    }
  }, [clientId])

  const fetchSkills = async () => {
    try {
      setLoading(true)
      // TODO: Call API endpoint to list skills from S3
      // For now, mock data
      setSkills([])
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (skillName) => {
    if (!confirm(`Delete skill "${skillName}"?`)) return

    try {
      // TODO: Call API endpoint to delete skill from S3
      setSkills(prev => prev.filter(s => s.name !== skillName))
    } catch (err) {
      alert('Failed to delete skill: ' + err.message)
    }
  }

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
            {skills.map((skill, index) => (
              <div key={index} style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {skill.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {skill.preview || 'Markdown skill content'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setEditingSkill(skill)
                      setShowAddModal(true)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(skill.name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}
                  >
                    <Trash size={16} />
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
function AddSkillModal({ clientId, skill, onClose, onSave }) {
  const [skillName, setSkillName] = useState(skill?.name || '')
  const [focusOn, setFocusOn] = useState('')
  const [ignoreAvoid, setIgnoreAvoid] = useState('')
  const [successCriteria, setSuccessCriteria] = useState('')
  const [industryTerms, setIndustryTerms] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadMode, setUploadMode] = useState(false)
  const [uploadedContent, setUploadedContent] = useState('')

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
      // TODO: Call API endpoint to save skill to S3
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 500))
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
                    placeholder="Identify the top 3 revenue leaks&#10;Propose a database schema for tracking routes&#10;Give a 90-day action plan with specific milestones"
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
  Building2, Sparkles, Database, AlertCircle, AlertTriangle, TrendingUp, Clock
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
  { id: 2, label: 'Skills', icon: 'Database', color: '#334155', url: '/skills' }
]

// Internal route map for button navigation
const ROUTE_MAP = {
  '/upload': 'upload',
  '/enrich': 'enrich',
  '/results': 'results',
  '/skills': 'skills',
  '/configuration': 'configuration'
}

function ConfigurationScreen({ theme, toggleTheme, buttons, setButtons, preferredModel, setPreferredModel }) {
  const isDark = theme === 'dark'
  const [editingId, setEditingId] = useState(null)
  const [draggedId, setDraggedId] = useState(null)

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
            { id: 'claude-opus-4-5-20250529', label: 'Claude Opus 4.5', desc: 'Best analysis, deeper reasoning', color: '#a855f7' },
            { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4.5', desc: 'Faster responses, lower cost', color: '#3b82f6' }
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

      {/* System Skills (Admin View) */}
      <div className="panel" style={{ marginTop: '1rem' }}>
        <div className="panel-header">
          <div className="panel-header-left">
            <Lock size={20} className="icon-red" />
            <h2>System Skills</h2>
            <span className="badge-count">4</span>
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: '0.875rem', lineHeight: 1.5 }}>
            System skills are injected into every enrichment call before client skills. They define how the AI analyzes, formats output, and handles authority boundaries.
          </p>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {[
              { name: 'Analysis Framework', desc: 'Revenue drivers, cost structure, bottlenecks, competitive position, risk factors' },
              { name: 'Output Format', desc: 'Numbered sections, table schemas, severity ratings, confidence scores, source citations' },
              { name: 'Authority Boundaries', desc: 'What to recommend directly vs. flag for human review' },
              { name: 'Enrichment Process', desc: 'Data source hierarchy: client data > context > audio > web > inferred' }
            ].map((skill, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.875rem',
                background: C.surface,
                borderRadius: '8px',
                border: `1px solid ${C.border}`
              }}>
                <Lock size={14} style={{ color: C.muted, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.text }}>{skill.name}</div>
                  <div style={{
                    fontSize: '0.7rem', color: C.muted, marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>{skill.desc}</div>
                </div>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 600, color: C.muted,
                  background: `${C.muted}15`, padding: '2px 6px', borderRadius: 999,
                  flexShrink: 0
                }}>System</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
function ResultsScreen({ setShowModal, clientId }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedTables, setExpandedTables] = useState({})
  const [expandedProblems, setExpandedProblems] = useState({})

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
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Header */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <FileText size={20} className="icon-red" />
            <h2>Analysis Results</h2>
            <span className="badge-count green">Complete</span>
          </div>
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

      {/* 30/60/90 Day Plan */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-left">
            <Calendar size={20} className="icon-red" />
            <h2>30/60/90 Day Action Plan</h2>
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
