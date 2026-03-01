import React, { useState, useEffect } from 'react'
import { X, Upload, Sparkles, FileText, Building2, FileText as FileIcon, Trash2, CheckCircle2, Music, Loader2, CheckCircle, Clock, AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Database, Calendar, Globe, TrendingUp } from 'lucide-react'

// ============================================================
// XO PROTOTYPE - MAIN APP
// Three screens: Upload -> Enrich -> Results
// ============================================================

const API_BASE = 'https://2t9mg17baj.execute-api.us-west-1.amazonaws.com/prod'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('upload') // upload | enrich | results
  const [showModal, setShowModal] = useState(false)
  const [showCompanyModal, setShowCompanyModal] = useState(false)
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

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <div className="logo-box">XO</div>
            <div className="header-title">
              <h1>
                XO Quickstart
                <span className="version-badge">Rapid Prototype</span>
              </h1>
              <p>{companyData.name || 'Domain Partner Onboarding'}</p>
            </div>
          </div>
        </div>
      </header>

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
    if (!companyData.name.trim()) {
      setError('Please enter company name')
      return
    }
    if (files.length === 0) {
      setError('Please upload at least one file')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Step 1: Create client
      const clientResponse = await fetch(`${API_BASE}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyData.name,
          description: companyData.description
        })
      })

      if (!clientResponse.ok) throw new Error('Failed to create client')
      const { client_id } = await clientResponse.json()
      setClientId(client_id)

      // Step 2: Get presigned URLs
      const uploadResponse = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id,
          files: files.map(f => ({ name: f.name, type: f.type }))
        })
      })

      if (!uploadResponse.ok) throw new Error('Failed to get upload URLs')
      const { upload_urls } = await uploadResponse.json()

      // Step 3: Upload files to S3
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const url = upload_urls[i]

        await fetch(url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type }
        })

        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
      }

      // Success - move to enrich screen
      setTimeout(() => onComplete(), 500)

    } catch (err) {
      setError(err.message)
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
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>

        {/* Step 1: Domain Expertise */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: '12px',
          padding: '1rem',
          border: step1Complete ? '2px solid #dc2626' : '2px solid transparent',
          transition: 'all 0.3s',
          minHeight: '260px',
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
          padding: '1rem',
          border: step2Complete ? '2px solid #dc2626' : '2px solid transparent',
          transition: 'all 0.3s',
          minHeight: '260px',
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
          background: allStepsComplete ? '#1a1a2e' : 'rgba(26, 26, 46, 0.5)',
          borderRadius: '12px',
          padding: '1rem',
          border: '2px solid transparent',
          opacity: allStepsComplete ? 1 : 0.6,
          transition: 'all 0.3s',
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Step Number Circle */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: allStepsComplete ? 'rgba(220, 38, 38, 0.2)' : 'rgba(100, 100, 100, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            border: `2px solid ${allStepsComplete ? 'rgba(220, 38, 38, 0.3)' : 'rgba(100, 100, 100, 0.2)'}`,
            transition: 'all 0.3s'
          }}>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: allStepsComplete ? '#dc2626' : '#666'
            }}>3</span>
          </div>

          {/* Step Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: allStepsComplete ? 'white' : 'rgba(255, 255, 255, 0.4)',
              marginBottom: '0.25rem',
              letterSpacing: '-0.01em'
            }}>
              INTELLIGENT GROWTH
            </h3>
            <p style={{
              fontSize: '0.75rem',
              color: allStepsComplete ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem'
            }}>
              The Output
            </p>

            <p style={{
              fontSize: '0.85rem',
              color: allStepsComplete ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.4)',
              lineHeight: 1.5,
              marginBottom: '0.75rem',
              flex: 1
            }}>
              MBA-level analysis. Problems identified. Schema proposed. Action plan delivered.
            </p>

            {!allStepsComplete && (
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.4)',
                fontStyle: 'italic',
                textAlign: 'center'
              }}>
                Complete steps 1 & 2 →
              </p>
            )}
          </div>
        </div>
      </div>

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
