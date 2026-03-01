import React, { useState, useEffect } from 'react'
import { X, Upload, Sparkles, FileText, Building2, FileText as FileIcon, Trash2, CheckCircle2, Music, Loader2, CheckCircle, Clock, AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Database, Calendar, Globe, TrendingUp, Menu, Settings, Moon, Sun, GripVertical, Copy, Edit3, Trash, Plus } from 'lucide-react'
import logoLight from './assets/logo-light.png'
import logoDark from './assets/logo-dark.png'

// ============================================================
// XO PROTOTYPE - MAIN APP
// Three screens: Upload -> Enrich -> Results
// ============================================================

const API_BASE = 'https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod'

export default function App() {
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
    description: ''
  })

  const navigateTo = (screen) => {
    setCurrentScreen(screen)
    setShowSidebar(false)
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
                XO Quickstart
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
                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>Menu</span>
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
              <button
                onClick={() => navigateTo('upload')}
                style={{
                  width: '100%',
                  background: currentScreen === 'upload' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                  border: 'none',
                  borderLeft: currentScreen === 'upload' ? '3px solid #dc2626' : '3px solid transparent',
                  color: currentScreen === 'upload' ? '#dc2626' : 'rgba(255, 255, 255, 0.7)',
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
                <Upload size={20} />
                Upload
              </button>
              <button
                onClick={() => navigateTo('enrich')}
                disabled={!clientId}
                style={{
                  width: '100%',
                  background: currentScreen === 'enrich' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                  border: 'none',
                  borderLeft: currentScreen === 'enrich' ? '3px solid #dc2626' : '3px solid transparent',
                  color: currentScreen === 'enrich' ? '#dc2626' : 'rgba(255, 255, 255, 0.7)',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: clientId ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  opacity: clientId ? 1 : 0.5,
                  transition: 'all 0.2s'
                }}
              >
                <Sparkles size={20} />
                Enrich
              </button>
              <button
                onClick={() => navigateTo('results')}
                disabled={!clientId}
                style={{
                  width: '100%',
                  background: currentScreen === 'results' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                  border: 'none',
                  borderLeft: currentScreen === 'results' ? '3px solid #dc2626' : '3px solid transparent',
                  color: currentScreen === 'results' ? '#dc2626' : 'rgba(255, 255, 255, 0.7)',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: clientId ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  opacity: clientId ? 1 : 0.5,
                  transition: 'all 0.2s'
                }}
              >
                <FileText size={20} />
                Results
              </button>
              <button
                onClick={() => navigateTo('skills')}
                disabled={!clientId}
                style={{
                  width: '100%',
                  background: currentScreen === 'skills' ? 'rgba(220, 38, 38, 0.2)' : 'transparent',
                  border: 'none',
                  borderLeft: currentScreen === 'skills' ? '3px solid #dc2626' : '3px solid transparent',
                  color: currentScreen === 'skills' ? '#dc2626' : 'rgba(255, 255, 255, 0.7)',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: clientId ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  opacity: clientId ? 1 : 0.5,
                  transition: 'all 0.2s'
                }}
              >
                <Database size={20} />
                Skills
              </button>
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
                  color: currentScreen === 'configuration' ? '#dc2626' : 'rgba(255, 255, 255, 0.7)',
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
            </nav>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main">
        {/* Navigation Tabs */}
        <div className="action-buttons">
          <button
            className={`action-btn ${currentScreen === 'upload' ? 'red' : 'gray'}`}
            onClick={() => setCurrentScreen('upload')}
            type="button"
          >
            <Upload size={18} />
            Upload
          </button>
          <button
            className={`action-btn ${currentScreen === 'enrich' ? 'red' : 'gray'}`}
            onClick={() => setCurrentScreen('enrich')}
            type="button"
            disabled={!clientId}
          >
            <Sparkles size={18} />
            Enrich
          </button>
          <button
            className={`action-btn ${currentScreen === 'results' ? 'red' : 'gray'}`}
            onClick={() => setCurrentScreen('results')}
            type="button"
            disabled={!clientId}
          >
            <FileText size={18} />
            Results
          </button>
        </div>

        {/* Screen Content */}
        {currentScreen === 'upload' && (
          <UploadScreen
            setClientId={setClientId}
            companyData={companyData}
            onComplete={() => setCurrentScreen('enrich')}
            onOpenCompanyModal={() => setShowCompanyModal(true)}
          />
        )}
        {currentScreen === 'enrich' && (
          <EnrichScreen
            clientId={clientId}
            onComplete={() => setCurrentScreen('results')}
          />
        )}
        {currentScreen === 'results' && <ResultsScreen setShowModal={setShowModal} clientId={clientId} />}
        {currentScreen === 'skills' && <SkillsScreen clientId={clientId} />}
        {currentScreen === 'configuration' && <ConfigurationScreen />}
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
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
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
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Website URL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
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
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Contact Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
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
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Contact Title */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
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
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* LinkedIn URL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
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
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Industry */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
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
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
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
                  border: '1px solid #e5e5e5',
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
function UploadScreen({ setClientId, companyData, onComplete, onOpenCompanyModal }) {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [error, setError] = useState(null)

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
  }

  const isAudioFile = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    return ['mp3', 'wav', 'm4a', 'aac'].includes(ext)
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyData.name,
          website: companyData.website,
          contactName: companyData.contactName,
          contactTitle: companyData.contactTitle,
          contactLinkedIn: companyData.contactLinkedIn,
          industry: companyData.industry,
          description: companyData.description
        })
      })

      if (!clientResponse.ok) {
        const errorData = await clientResponse.json()
        throw new Error(errorData.error || 'Failed to create client')
      }
      const { client_id } = await clientResponse.json()
      setClientId(client_id)
      console.log('Created client:', client_id)

      // Step 2: Get presigned URLs
      console.log('Getting presigned URLs for', files.length, 'files')
      const uploadResponse = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id,
          files: files.map(f => ({ name: f.name, type: f.type }))
        })
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to get upload URLs')
      }
      const { upload_urls } = await uploadResponse.json()
      console.log('Received', upload_urls.length, 'presigned URLs')

      // Step 3: Upload files to S3
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const url = upload_urls[i]

        console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`)
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
                {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''} selected` : 'Drop or click'}
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
            color: '#1a1a1a',
            lineHeight: 1.6,
            marginBottom: '0.625rem'
          }}>
            I wasn't leading. I was typing at 6:00 AM. I became my own admin clerk.
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: '#666',
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
            color: '#1a1a1a',
            lineHeight: 1.6,
            marginBottom: '0.625rem'
          }}>
            We're business operators first, not technologists. We built this because we needed it.
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: '#666',
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
    </div>
  )
}

// ============================================================
// ENRICH SCREEN
// ============================================================
function EnrichScreen({ clientId, onComplete }) {
  const [jobStatus, setJobStatus] = useState(null) // null | 'processing' | 'complete' | 'error'
  const [jobId, setJobId] = useState(null)
  const [currentStage, setCurrentStage] = useState(null)
  const [error, setError] = useState(null)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId })
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
        const response = await fetch(`${API_BASE}/results/${id}`)
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
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        {/* Not Started State */}
        {!jobStatus && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Sparkles size={64} style={{ color: '#dc2626', opacity: 0.5, margin: '0 auto 1.5rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#1a1a1a' }}>
              Ready to Enrich Your Data
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '2rem', lineHeight: 1.6 }}>
              Our AI will extract text from documents, transcribe audio files,<br />
              research your company online, and generate a comprehensive analysis.
            </p>
            <button
              onClick={startEnrichment}
              className="action-btn red"
              style={{ padding: '0.875rem 2rem', fontSize: '1rem' }}
            >
              <Sparkles size={20} />
              Start Enrichment
            </button>
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
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
                  Processing your data...
                </h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
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
                        <p style={{ fontSize: '0.75rem', color: '#888', margin: '0.25rem 0 0 0' }}>
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
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1a1a1a' }}>
              Enrichment Complete!
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
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
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
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
    <div>
      {/* Skills Header */}
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
      </div>

      {/* Skills List */}
      <div style={{ marginTop: '1rem' }}>
        {loading ? (
          <div className="panel">
            <div className="empty-state">
              <Loader2 size={48} style={{ color: '#dc2626', animation: 'spin 1s linear infinite' }} />
              <p>Loading skills...</p>
            </div>
          </div>
        ) : skills.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <Database size={48} style={{ color: '#ccc' }} />
              <p>No skills yet. Add your first skill to enhance AI analysis.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {skills.map((skill, index) => (
              <div key={index} className="panel">
                <div style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.25rem' }}>
                      {skill.name}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
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
  const [skillContent, setSkillContent] = useState(skill?.content || '')
  const [saving, setSaving] = useState(false)
  const [uploadMode, setUploadMode] = useState(false)

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.md')) {
      alert('Please upload a .md file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setSkillContent(event.target.result)
      setSkillName(file.name.replace('.md', ''))
      setUploadMode(false)
    }
    reader.readAsText(file)
  }

  const handleSave = async () => {
    if (!skillName.trim()) {
      alert('Skill name is required')
      return
    }
    if (!skillContent.trim()) {
      alert('Skill content is required')
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
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Skill Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
                Skill Name *
              </label>
              <input
                type="text"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g., waste-management-analysis"
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Upload or Write Toggle */}
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
                  textDecoration: 'underline'
                }}
              >
                {uploadMode ? 'Write manually' : 'Upload .md file'}
              </button>
            </div>

            {/* Upload Mode */}
            {uploadMode ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
                  Upload Markdown File
                </label>
                <input
                  type="file"
                  accept=".md"
                  onChange={handleFileUpload}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            ) : (
              /* Skill Content */
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
                  Skill Content (Markdown) *
                </label>
                <textarea
                  value={skillContent}
                  onChange={(e) => setSkillContent(e.target.value)}
                  placeholder="# Skill Instructions&#10;&#10;Write your skill instructions in Markdown format.&#10;&#10;This will be injected into the Claude prompt during enrichment."
                  rows={12}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    resize: 'vertical',
                    lineHeight: 1.6
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
                  Tip: Use markdown formatting. This content will be provided to Claude during analysis.
                </p>
              </div>
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
function ConfigurationScreen() {
  const [darkMode, setDarkMode] = useState(false)
  const [buttons, setButtons] = useState([
    { id: 1, label: 'New Partner', icon: 'Building2', color: 'red' },
    { id: 2, label: 'Upload', icon: 'Upload', color: 'blue' },
    { id: 3, label: 'Enrich', icon: 'Sparkles', color: 'green' }
  ])

  return (
    <div>
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
            background: '#fafafa',
            borderRadius: '10px',
            border: '1px solid #e5e5e5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {darkMode ? <Moon size={20} className="icon-blue" /> : <Sun size={20} className="icon-amber" />}
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1a1a1a' }}>
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                width: '52px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: darkMode ? '#3b82f6' : '#e5e5e5',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: darkMode ? '27px' : '3px',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* Configure Buttons & Preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem',
        marginTop: '1rem'
      }}>
        {/* Configure Buttons */}
        <div className="panel">
          <div className="panel-header">
            <h2>Configure Buttons</h2>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              {buttons.map((button) => (
                <div
                  key={button.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: '#fafafa',
                    border: '1px solid #e5e5e5',
                    borderRadius: '10px'
                  }}
                >
                  <GripVertical size={16} style={{ color: '#9ca3af', cursor: 'grab' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
                      {button.label}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                      {button.icon} • {button.color}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.25rem'
                      }}
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '0.25rem'
                      }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        padding: '0.25rem'
                      }}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="action-btn blue"
              style={{
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <Plus size={18} />
              Add Button
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="panel">
          <div className="panel-header">
            <h2>Live Preview</h2>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{
              background: '#f0f0f0',
              borderRadius: '10px',
              padding: '1.5rem',
              minHeight: '200px'
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: '#888',
                textAlign: 'center',
                marginBottom: '1rem',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.05em'
              }}>
                Preview
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {buttons.map((button) => (
                  <button
                    key={button.id}
                    className={`action-btn ${button.color}`}
                    style={{
                      pointerEvents: 'none'
                    }}
                  >
                    {button.label}
                  </button>
                ))}
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
      const response = await fetch(`${API_BASE}/results/${clientId}`)
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
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
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
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: '#1a1a1a' }}>
            {displayResults.summary}
          </p>
        </div>
      </div>

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
                background: '#fafafa',
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
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
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
                  <ChevronDown size={20} style={{ color: '#666', flexShrink: 0 }} />
                ) : (
                  <ChevronRight size={20} style={{ color: '#666', flexShrink: 0 }} />
                )}
              </div>
              {expandedProblems[index] && (
                <div style={{
                  padding: '0 1.25rem 1rem',
                  borderTop: '1px solid #e5e5e5'
                }}>
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Evidence
                    </p>
                    <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#1a1a1a', marginBottom: '1rem' }}>
                      {problem.evidence}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Recommendation
                    </p>
                    <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#1a1a1a' }}>
                      {problem.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
                border: '1px solid #e5e5e5',
                borderRadius: '10px',
                background: '#fafafa',
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
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.25rem' }}>
                    {table.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
                    {table.purpose}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="badge-count blue">{table.columns?.length || 0} columns</span>
                  {expandedTables[table.name] ? (
                    <ChevronDown size={20} style={{ color: '#666' }} />
                  ) : (
                    <ChevronRight size={20} style={{ color: '#666' }} />
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
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600, color: '#666' }}>Column</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600, color: '#666' }}>Type</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600, color: '#666' }}>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns?.map((col, colIndex) => (
                          <tr key={colIndex} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '0.625rem 0.5rem', fontWeight: 500, color: '#1a1a1a' }}>{col.name}</td>
                            <td style={{ padding: '0.625rem 0.5rem', color: '#666', fontFamily: 'monospace', fontSize: '0.75rem' }}>{col.type}</td>
                            <td style={{ padding: '0.625rem 0.5rem', color: '#666' }}>{col.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
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
                border: '1px solid #e5e5e5',
                borderRadius: '10px',
                background: '#fafafa',
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
                  <li key={actionIndex} style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#1a1a1a' }}>
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
                  background: '#fafafa',
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
                <span style={{ color: '#1a1a1a' }}>{source.reference}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
