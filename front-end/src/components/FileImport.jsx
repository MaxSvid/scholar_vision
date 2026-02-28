import { useState, useRef, useEffect } from 'react'
import './SubPanel.css'
import './FileImport.css'

const ACCEPT = '.pdf,.doc,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg'

const FILE_ICONS = {
  pdf:  '▣',
  doc:  '◧',
  docx: '◧',
  xlsx: '◫',
  csv:  '◫',
  txt:  '◩',
  png:  '◨',
  jpg:  '◨',
  jpeg: '◨',
  default: '▦',
}

const FILE_CATS = ['Grade Sheet', 'Feedback Report', 'Assignment', 'Exam Result', 'Syllabus', 'Other']

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 ** 2).toFixed(1)}MB`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB')
}

// Stable session ID persisted across page reloads
function getSessionId() {
  let id = sessionStorage.getItem('sv_session_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('sv_session_id', id)
  }
  return id
}

export default function FileImport() {
  const [files,    setFiles]    = useState([])
  const [dragging, setDragging] = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const inputRef = useRef()
  const sessionId = getSessionId()

  // Load existing files on mount
  useEffect(() => {
    fetchFiles()
  }, [])

  async function fetchFiles() {
    console.log('[FileImport] Loading existing files for session:', sessionId)
    try {
      const res = await fetch(`/api/files?session_id=${sessionId}`)
      if (!res.ok) {
        console.warn('[FileImport] Failed to load file list — HTTP', res.status)
        return
      }
      const data = await res.json()
      console.log('[FileImport] Loaded', data.files?.length ?? 0, 'file(s) from server')
      setFiles(data.files || [])
    } catch (e) {
      console.warn('[FileImport] Backend unreachable — starting with empty list:', e.message)
    }
  }

  async function uploadFile(f, category = 'Other', notes = '') {
    const sizeMB = (f.size / 1024 / 1024).toFixed(2)
    console.log(`[FileImport] Uploading "${f.name}" (${sizeMB} MB, type: ${f.type || 'unknown'})`)

    const form = new FormData()
    form.append('file',       f)
    form.append('session_id', sessionId)
    form.append('category',   category)
    form.append('notes',      notes)

    let res
    try {
      res = await fetch('/api/files/upload', { method: 'POST', body: form })
    } catch (e) {
      console.error(`[FileImport] Network error uploading "${f.name}":`, e.message)
      throw new Error(`Network error — is the server running?`)
    }

    if (res.status === 413) {
      console.error(`[FileImport] "${f.name}" rejected — file exceeds 20 MB limit`)
      throw new Error(`"${f.name}" exceeds the 20 MB limit`)
    }
    if (res.status === 415) {
      const ext = f.name.split('.').pop()
      console.error(`[FileImport] "${f.name}" rejected — unsupported file type: .${ext}`)
      throw new Error(`File type ".${ext}" is not supported`)
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const detail = err.detail || `HTTP ${res.status}`
      console.error(`[FileImport] Upload failed for "${f.name}":`, detail)
      throw new Error(detail)
    }

    const data = await res.json()
    const status = data.parse_error
      ? `parsed with error — ${data.parse_error}`
      : `parsed OK (${data.grades_count} grade(s), ${data.snippets_count} snippet(s))`
    console.log(`[FileImport] "${f.name}" uploaded and ${status}`)
    if (data.parse_error) {
      console.warn(`[FileImport] Parse warning for "${f.name}":`, data.parse_error)
    }

    return data
  }

  const addFiles = async (fileList) => {
    const files = Array.from(fileList)
    console.log(`[FileImport] Starting import of ${files.length} file(s):`, files.map(f => f.name))
    setError(null)
    setLoading(true)
    try {
      for (const f of files) {
        await uploadFile(f)
      }
      console.log('[FileImport] All uploads complete — refreshing file list')
      await fetchFiles()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = e => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const removeFile = async (fileId) => {
    console.log('[FileImport] Deleting file:', fileId)
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) console.warn('[FileImport] Delete returned HTTP', res.status, 'for', fileId)
      else console.log('[FileImport] Deleted:', fileId)
    } catch (e) {
      console.error('[FileImport] Delete failed for', fileId, '—', e.message)
    }
    setFiles(prev => prev.filter(f => f.file_id !== fileId))
  }

  const updateLocal = (fileId, key, val) =>
    setFiles(prev => prev.map(f => f.file_id === fileId ? { ...f, [key]: val } : f))

  const icon = type => FILE_ICONS[type] || FILE_ICONS.default

  return (
    <div className="subpanel">
      <div className="panel-title">&gt; ACADEMIC FILE IMPORT</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
        Upload grade sheets, feedback reports, assignments, and exam results.
        Files are parsed and stored for analysis.
      </p>

      {/* Drop zone */}
      <div
        className={`fi-dropzone ${dragging ? 'dragging' : ''} ${loading ? 'fi-uploading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
        <div className="fi-drop-icon">{loading ? '…' : dragging ? '▼' : '▦'}</div>
        <div className="fi-drop-text">
          {loading
            ? 'UPLOADING…'
            : dragging
              ? 'DROP FILES HERE'
              : 'DRAG & DROP FILES HERE  //  CLICK TO BROWSE'
          }
        </div>
        <div className="fi-drop-sub muted-text">
          Accepted: PDF, DOC, DOCX, XLSX, CSV, TXT, PNG, JPG
        </div>
      </div>

      {error && (
        <div className="fi-error muted-text">&gt; {error}</div>
      )}

      {/* Stats */}
      {files.length > 0 && (
        <div className="sp-stat-row">
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">{files.length}</div>
            <div className="sp-stat-lbl">FILES</div>
          </div>
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">
              {formatSize(files.reduce((s, f) => s + (f.file_size || 0), 0))}
            </div>
            <div className="sp-stat-lbl">TOTAL SIZE</div>
          </div>
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">
              {new Set(files.map(f => f.category)).size}
            </div>
            <div className="sp-stat-lbl">CATEGORIES</div>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="fi-list">
        {files.map(f => (
          <div key={f.file_id} className="retro-card fi-file-row">
            <div className="fi-file-icon">{icon(f.file_type)}</div>

            <div className="fi-file-info">
              <div className="fi-file-name">{f.original_name}</div>
              <div className="fi-file-meta muted-text">
                {formatSize(f.file_size)} · {formatDate(f.uploaded_at)} · {(f.file_type || '').toUpperCase()}
                {f.parse_status && (
                  <span className={`fi-parse-badge fi-parse-${f.parse_status}`}>
                    {' '}· {f.parse_status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {editId === f.file_id ? (
              <div className="fi-edit-row">
                <select
                  className="retro-input fi-cat-select"
                  value={f.category}
                  onChange={e => updateLocal(f.file_id, 'category', e.target.value)}
                >
                  {FILE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input
                  className="retro-input fi-notes-input"
                  placeholder="Notes..."
                  value={f.notes || ''}
                  onChange={e => updateLocal(f.file_id, 'notes', e.target.value)}
                />
                <button className="retro-btn" onClick={() => setEditId(null)}>DONE</button>
              </div>
            ) : (
              <div className="fi-file-right">
                <span className="fi-cat-badge muted-text">{(f.category || 'Other').toUpperCase()}</span>
                {f.notes && <span className="fi-notes muted-text">{f.notes}</span>}
                <button className="retro-btn fi-edit-btn" onClick={() => setEditId(f.file_id)}>EDIT</button>
                <button className="sp-delete muted-text" onClick={() => removeFile(f.file_id)}>✕</button>
              </div>
            )}
          </div>
        ))}

        {files.length === 0 && !loading && (
          <div className="sp-empty muted-text">&gt; No files uploaded yet.</div>
        )}
      </div>
    </div>
  )
}
