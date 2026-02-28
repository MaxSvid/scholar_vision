import { useState, useRef } from 'react'
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
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 ** 2).toFixed(1)}MB`
}

export default function FileImport() {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [editId, setEditId] = useState(null)
  const inputRef = useRef()

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(f => ({
      id:       Date.now() + Math.random(),
      name:     f.name,
      size:     f.size,
      type:     f.name.split('.').pop().toLowerCase(),
      category: 'Other',
      uploaded: new Date().toLocaleDateString('en-GB'),
      notes:    '',
    }))
    setFiles(prev => [...newFiles, ...prev])
  }

  const onDrop = e => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const removeFile = id => setFiles(prev => prev.filter(f => f.id !== id))

  const updateFile = (id, key, val) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f))

  const icon = type => FILE_ICONS[type] || FILE_ICONS.default

  return (
    <div className="subpanel">
      <div className="panel-title">&gt; ACADEMIC FILE IMPORT</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
        Upload grade sheets, feedback reports, assignments, and exam results.
        Files are stored locally in your browser session.
      </p>

      {/* Drop zone */}
      <div
        className={`fi-dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
        <div className="fi-drop-icon">{dragging ? '▼' : '▦'}</div>
        <div className="fi-drop-text">
          {dragging
            ? 'DROP FILES HERE'
            : 'DRAG & DROP FILES HERE  //  CLICK TO BROWSE'
          }
        </div>
        <div className="fi-drop-sub muted-text">
          Accepted: PDF, DOC, DOCX, XLSX, CSV, TXT, PNG, JPG
        </div>
      </div>

      {/* Stats */}
      {files.length > 0 && (
        <div className="sp-stat-row">
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">{files.length}</div>
            <div className="sp-stat-lbl">FILES</div>
          </div>
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">
              {formatSize(files.reduce((s, f) => s + f.size, 0))}
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
          <div key={f.id} className="retro-card fi-file-row">
            <div className="fi-file-icon">{icon(f.type)}</div>

            <div className="fi-file-info">
              <div className="fi-file-name">{f.name}</div>
              <div className="fi-file-meta muted-text">
                {formatSize(f.size)} · {f.uploaded} · {f.type.toUpperCase()}
              </div>
            </div>

            {editId === f.id ? (
              <div className="fi-edit-row">
                <select
                  className="retro-input fi-cat-select"
                  value={f.category}
                  onChange={e => updateFile(f.id, 'category', e.target.value)}
                >
                  {FILE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input
                  className="retro-input fi-notes-input"
                  placeholder="Notes..."
                  value={f.notes}
                  onChange={e => updateFile(f.id, 'notes', e.target.value)}
                />
                <button className="retro-btn" onClick={() => setEditId(null)}>DONE</button>
              </div>
            ) : (
              <div className="fi-file-right">
                <span className="fi-cat-badge muted-text">{f.category.toUpperCase()}</span>
                {f.notes && <span className="fi-notes muted-text">{f.notes}</span>}
                <button className="retro-btn fi-edit-btn" onClick={() => setEditId(f.id)}>EDIT</button>
                <button className="sp-delete muted-text" onClick={() => removeFile(f.id)}>✕</button>
              </div>
            )}
          </div>
        ))}

        {files.length === 0 && (
          <div className="sp-empty muted-text">&gt; No files uploaded yet.</div>
        )}
      </div>
    </div>
  )
}
