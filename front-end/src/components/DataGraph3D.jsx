import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './DataGraph3D.css'

// STATIC GRAPH STRUCTURE 
const NODE_DEFS = [
  { id: 'outcome',     label: 'PREDICTED OUTCOME', group: 'outcome',     radius: 0.48, color: '#c8ff00' },
  { id: 'study',       label: 'STUDY TIME',         group: 'category',    radius: 0.30, color: '#d4af37' },
  { id: 'attention',   label: 'ATTENTION SPAN',      group: 'category',    radius: 0.30, color: '#d4af37' },
  { id: 'apps',        label: 'APP USAGE',           group: 'category',    radius: 0.30, color: '#d4af37' },
  { id: 'major',       label: 'MAJOR / FIELD',       group: 'category',    radius: 0.30, color: '#d4af37' },
  { id: 'websites',    label: 'WEBSITES',            group: 'category',    radius: 0.30, color: '#d4af37' },
  { id: 'health',      label: 'HEALTH',              group: 'category',    radius: 0.30, color: '#e8729a' },
  { id: 'h-sleep',    label: 'SLEEP: —',            group: 'leaf-health', radius: 0.16, color: '#ff9dbf', parent: 'health' },
  { id: 'h-steps',    label: 'STEPS: —',            group: 'leaf-health', radius: 0.16, color: '#ff9dbf', parent: 'health' },
  { id: 'h-hr',       label: 'HEART RATE: —',       group: 'leaf-health', radius: 0.14, color: '#ff9dbf', parent: 'health' },
  { id: 'h-hrv',      label: 'HRV: —',              group: 'leaf-health', radius: 0.13, color: '#ff9dbf', parent: 'health' },
  { id: 'h-active',   label: 'ACTIVE CAL: —',       group: 'leaf-health', radius: 0.15, color: '#ff9dbf', parent: 'health' },
  { id: 'h-mindful',  label: 'MINDFULNESS: —',      group: 'leaf-health', radius: 0.13, color: '#ff9dbf', parent: 'health' },
  { id: 'avg-time',    label: 'AVG TIME: —',         group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'study' },
  { id: 'session-dur', label: 'SESSION: —',          group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'study' },
  { id: 'sleep',       label: 'SLEEP: 7h/NIGHT',     group: 'leaf-prod', radius: 0.14, color: '#44cc66', parent: 'study' },
  { id: 'att-avg',     label: 'AVG SPAN: —',         group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'attention' },
  { id: 'att-breaks',  label: 'BREAKS: —',           group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'attention' },
  { id: 'att-qual',    label: 'FOCUS QUALITY: —',    group: 'leaf-prod', radius: 0.13, color: '#44cc66', parent: 'attention' },
  { id: 'obsidian',    label: 'Obsidian',            group: 'leaf-prod', radius: 0.18, color: '#44cc66', parent: 'apps' },
  { id: 'vscode',      label: 'VS Code',             group: 'leaf-prod', radius: 0.18, color: '#44cc66', parent: 'apps' },
  { id: 'anki',        label: 'Anki',                group: 'leaf-prod', radius: 0.15, color: '#44cc66', parent: 'apps' },
  { id: 'ai-agents',   label: 'AI Agents',           group: 'leaf-prod', radius: 0.18, color: '#44cc66', parent: 'apps' },
  { id: 'notion',      label: 'Notion',              group: 'leaf-prod', radius: 0.15, color: '#44cc66', parent: 'apps' },
  { id: 'tiktok',      label: 'TikTok',              group: 'leaf-dist', radius: 0.17, color: '#cc3333', parent: 'apps' },
  { id: 'discord',     label: 'Discord',             group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'apps' },
  { id: 'youtube-a',   label: 'YouTube',             group: 'leaf-neut', radius: 0.15, color: '#ccaa33', parent: 'apps' },
  { id: 'field',       label: 'FIELD OF STUDY',      group: 'leaf-blue', radius: 0.18, color: '#7f7fff', parent: 'major' },
  { id: 'year',        label: 'YEAR / LEVEL',        group: 'leaf-blue', radius: 0.16, color: '#7f7fff', parent: 'major' },
  { id: 'target',      label: 'WEEKLY TARGET',       group: 'leaf-blue', radius: 0.14, color: '#7f7fff', parent: 'major' },
  { id: 'scholar',     label: 'Google Scholar',      group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'websites' },
  { id: 'arxiv',       label: 'ArXiv',               group: 'leaf-prod', radius: 0.14, color: '#44cc66', parent: 'websites' },
  { id: 'reddit',      label: 'Reddit',              group: 'leaf-dist', radius: 0.15, color: '#cc3333', parent: 'websites' },
  { id: 'yt-study',    label: 'YouTube Study',       group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'websites' },
]

const EDGE_DEFS = [
  { from: 'outcome', to: 'study' },
  { from: 'outcome', to: 'attention' },
  { from: 'outcome', to: 'apps' },
  { from: 'outcome', to: 'major' },
  { from: 'outcome', to: 'websites' },
  { from: 'outcome', to: 'health' },
  { from: 'health', to: 'h-sleep' },
  { from: 'health', to: 'h-steps' },
  { from: 'health', to: 'h-hr' },
  { from: 'health', to: 'h-hrv' },
  { from: 'health', to: 'h-active' },
  { from: 'health', to: 'h-mindful' },
  { from: 'study', to: 'avg-time' },
  { from: 'study', to: 'session-dur' },
  { from: 'study', to: 'sleep' },
  { from: 'attention', to: 'att-avg' },
  { from: 'attention', to: 'att-breaks' },
  { from: 'attention', to: 'att-qual' },
  { from: 'apps', to: 'obsidian' },
  { from: 'apps', to: 'vscode' },
  { from: 'apps', to: 'anki' },
  { from: 'apps', to: 'ai-agents' },
  { from: 'apps', to: 'notion' },
  { from: 'apps', to: 'tiktok' },
  { from: 'apps', to: 'discord' },
  { from: 'apps', to: 'youtube-a' },
  { from: 'major', to: 'field' },
  { from: 'major', to: 'year' },
  { from: 'major', to: 'target' },
  { from: 'websites', to: 'scholar' },
  { from: 'websites', to: 'arxiv' },
  { from: 'websites', to: 'reddit' },
  { from: 'websites', to: 'yt-study' },
]

// Which node ids belong to each selectable group (always include outcome)
const GROUP_NODES = {
  study:     ['outcome', 'study', 'avg-time', 'session-dur', 'sleep'],
  attention: ['outcome', 'attention', 'att-avg', 'att-breaks', 'att-qual'],
  apps:      ['outcome', 'apps', 'obsidian', 'vscode', 'anki', 'ai-agents', 'notion', 'tiktok', 'discord', 'youtube-a'],
  major:     ['outcome', 'major', 'field', 'year', 'target'],
  websites:  ['outcome', 'websites', 'scholar', 'arxiv', 'reddit', 'yt-study'],
  health:    ['outcome', 'health', 'h-sleep', 'h-steps', 'h-hr', 'h-hrv', 'h-active', 'h-mindful'],
}

const GROUP_BUTTONS = [
  { id: null,        label: 'ALL' },
  { id: 'study',     label: 'STUDY TIME' },
  { id: 'attention', label: 'ATTENTION' },
  { id: 'apps',      label: 'APP USAGE' },
  { id: 'major',     label: 'ACADEMIC' },
  { id: 'websites',  label: 'WEBSITES' },
  { id: 'health',    label: 'HEALTH' },
]

const APP_NODE_MAP = {
  'Obsidian':        'obsidian',
  'VS Code':         'vscode',
  'Anki':            'anki',
  'Notion':          'notion',
  'TikTok':          'tiktok',
  'Discord':         'discord',
  'YouTube (Study)': 'youtube-a',
}

const BASE_EMISSIVE = { outcome: 0.55, category: 0.22, default: 0.22 }

function fibSphere(n, r) {
  const pts = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y     = 1 - (i / (n - 1)) * 2
    const rad   = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pts.push(new THREE.Vector3(Math.cos(theta) * rad * r, y * r, Math.sin(theta) * rad * r))
  }
  return pts
}

function buildNodes(user, studySessions, appLogs, attSessions, healthMetrics) {
  const totalStudyHours = studySessions.reduce((s, x) => s + x.hours, 0)
  const studyDays       = new Set(studySessions.map(s => s.date)).size || 1
  const avgDaily        = (totalStudyHours / studyDays).toFixed(1)
  const avgSession      = studySessions.length
    ? Math.round((totalStudyHours / studySessions.length) * 60)
    : null

  const avgAttMin = attSessions.length
    ? Math.round(attSessions.reduce((s, x) => s + x.duration, 0) / attSessions.length)
    : null
  const avgBreaks = attSessions.length
    ? (attSessions.reduce((s, x) => s + x.breaks, 0) / attSessions.length).toFixed(1)
    : null
  const highQPct = attSessions.length
    ? Math.round(attSessions.filter(s => s.quality === 'High').length / attSessions.length * 100)
    : null

  const appTotals = appLogs.reduce((acc, l) => {
    acc[l.app] = (acc[l.app] || 0) + l.hours
    return acc
  }, {})

  const hm = Object.fromEntries((healthMetrics || []).map(r => [r.type, r]))

  return NODE_DEFS.map(n => {
    const node = { ...n }
    if (n.id === 'field'       && user?.fieldOfStudy) node.label = user.fieldOfStudy.toUpperCase()
    if (n.id === 'year'        && user?.yearOfStudy)  node.label = user.yearOfStudy.toUpperCase()
    if (n.id === 'target'      && user?.weeklyHours)  node.label = `TARGET: ${user.weeklyHours}H/WK`
    if (n.id === 'avg-time')    node.label = `AVG TIME: ${avgDaily}H/DAY`
    if (n.id === 'session-dur') node.label = avgSession != null ? `SESSION: ~${avgSession}MIN` : 'SESSION: —'
    if (n.id === 'att-avg')     node.label = avgAttMin != null ? `AVG SPAN: ${avgAttMin}MIN` : 'AVG SPAN: —'
    if (n.id === 'att-breaks')  node.label = avgBreaks != null ? `BREAKS: ${avgBreaks}/SESSION` : 'BREAKS: —'
    if (n.id === 'att-qual')    node.label = highQPct  != null ? `FOCUS QUALITY: ${highQPct}% HIGH` : 'FOCUS QUALITY: —'
    const appName = Object.entries(APP_NODE_MAP).find(([, id]) => id === n.id)?.[0]
    if (appName && appTotals[appName] != null) node.label = `${appName}: ${appTotals[appName].toFixed(1)}h`
    // Health leaves
    if (n.id === 'h-sleep') {
      const r = hm['sleep_analysis']
      node.label = r ? `SLEEP: ${parseFloat(r.avg_value).toFixed(1)}h` : 'SLEEP: —'
    }
    if (n.id === 'h-steps') {
      const r = hm['step_count']
      node.label = r ? `STEPS: ${Math.round(parseFloat(r.avg_value)).toLocaleString()}` : 'STEPS: —'
    }
    if (n.id === 'h-hr') {
      const r = hm['heart_rate'] || hm['resting_heart_rate']
      node.label = r ? `HEART RATE: ${Math.round(parseFloat(r.avg_value))} BPM` : 'HEART RATE: —'
    }
    if (n.id === 'h-hrv') {
      const r = hm['heart_rate_variability_sdnn']
      node.label = r ? `HRV: ${Math.round(parseFloat(r.avg_value))} MS` : 'HRV: —'
    }
    if (n.id === 'h-active') {
      const r = hm['active_energy_burned']
      node.label = r ? `ACTIVE CAL: ${Math.round(parseFloat(r.avg_value))} KCAL` : 'ACTIVE CAL: —'
    }
    if (n.id === 'h-mindful') {
      const r = hm['mindful_session']
      node.label = r ? `MINDFULNESS: ${r.count} SESSIONS` : 'MINDFULNESS: —'
    }
    return node
  })
}

// COMPONENT 
export default function DataGraph3D({ user, studySessions = [], appLogs = [], attSessions = [], healthMetrics = [] }) {
  const mountRef        = useRef(null)
  const meshesRef       = useRef([])
  const selectedGrpRef  = useRef(null)
  const [tooltip, setTooltip]           = useState({ visible: false, label: '', x: 0, y: 0 })
  const [selectedGroup, setSelectedGroup] = useState(null)

  const selectGroup = (id) => {
    setSelectedGroup(id)
    selectedGrpRef.current = id
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const nodes   = buildNodes(user, studySessions, appLogs, attSessions, healthMetrics)
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

    // ── Position ────────────────────────────────────────────────
    nodeMap['outcome'].pos = new THREE.Vector3(0, 0, 0)
    const cats = nodes.filter(n => n.group === 'category')
    fibSphere(cats.length, 3.6).forEach((pos, i) => { cats[i].pos = pos })

    const byParent = {}
    nodes.filter(n => n.parent).forEach(n => {
      byParent[n.parent] = byParent[n.parent] || []
      byParent[n.parent].push(n)
    })
    const OFFSETS = [0.0, 0.3, -0.25, 0.15, -0.1, 0.4, -0.35, 0.2]
    Object.entries(byParent).forEach(([pid, kids]) => {
      const parent = nodeMap[pid]
      if (!parent?.pos) return
      kids.forEach((kid, i) => {
        const angle = (i / kids.length) * Math.PI * 2
        kid.pos = new THREE.Vector3(
          parent.pos.x + Math.cos(angle) * 1.65,
          parent.pos.y + OFFSETS[i % OFFSETS.length],
          parent.pos.z + Math.sin(angle) * 1.65,
        )
      })
    })

    // ── Scene ───────────────────────────────────────────────────
    const scene  = new THREE.Scene()
    const W = mount.clientWidth, H = mount.clientHeight
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100)
    camera.position.set(0, 2.5, 13)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping   = true
    controls.dampingFactor   = 0.06
    controls.autoRotate      = true
    controls.autoRotateSpeed = 0.35
    controls.minDistance     = 5
    controls.maxDistance     = 22

    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const pLight = new THREE.PointLight(0xffffff, 1.8, 35)
    pLight.position.set(5, 7, 5)
    scene.add(pLight)

    // Starfield
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(350 * 3)
    for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 60
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.06 })))

    // ── Node meshes ─────────────────────────────────────────────
    const meshes = []
    nodes.forEach(node => {
      if (!node.pos) return
      const color = new THREE.Color(node.color)
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: BASE_EMISSIVE[node.group] ?? BASE_EMISSIVE.default,
        shininess: 90,
        transparent: true,
        opacity: 1.0,
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(node.radius, 22, 22), mat)
      mesh.position.copy(node.pos)
      mesh.userData = { id: node.id, label: node.label, group: node.group,
                        baseEmissive: BASE_EMISSIVE[node.group] ?? BASE_EMISSIVE.default }
      scene.add(mesh)
      meshes.push(mesh)
    })
    meshesRef.current = meshes

    // ── Edges ───────────────────────────────────────────────────
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.35 })
    EDGE_DEFS.forEach(({ from, to }) => {
      const a = nodeMap[from], b = nodeMap[to]
      if (!a?.pos || !b?.pos) return
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a.pos.clone(), b.pos.clone()]),
        edgeMat,
      ))
    })

    // ── Hover — screen-space proximity ──────────────────────────
    const HIT_MIN_PX = 20   // minimum hit radius in screen pixels
    let hoveredId = null

    const onMouseMove = e => {
      const rect   = mount.getBoundingClientRect()
      const mx     = e.clientX - rect.left
      const my     = e.clientY - rect.top
      const fovRad = camera.fov * Math.PI / 180

      let closest = null, closestDist = Infinity
      meshes.forEach(mesh => {
        const ndc = mesh.position.clone().project(camera)
        if (ndc.z > 1) return
        const sx    = (ndc.x *  0.5 + 0.5) * rect.width
        const sy    = (ndc.y * -0.5 + 0.5) * rect.height
        const camD  = camera.position.distanceTo(mesh.position)
        const projR = (mesh.geometry.parameters.radius / camD)
                    * (rect.height / (2 * Math.tan(fovRad / 2)))
        const hitR  = Math.max(HIT_MIN_PX, projR)
        const d     = Math.hypot(mx - sx, my - sy)
        if (d < hitR && d < closestDist) { closestDist = d; closest = mesh }
      })

      if (hoveredId !== null) {
        const prev = meshes.find(m => m.userData.id === hoveredId)
        if (prev) { prev.material.emissiveIntensity = prev.userData.baseEmissive; prev.scale.setScalar(1) }
      }
      if (closest) {
        closest.material.emissiveIntensity = 0.9
        closest.scale.setScalar(1.35)
        hoveredId = closest.userData.id
        setTooltip({ visible: true, label: closest.userData.label, x: mx, y: my })
        mount.style.cursor = 'pointer'
      } else {
        hoveredId = null
        setTooltip(t => ({ ...t, visible: false }))
        mount.style.cursor = 'grab'
      }
    }
    mount.addEventListener('mousemove', onMouseMove)

    // ── Resize ──────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    })
    ro.observe(mount)

    // ── Animation loop ──────────────────────────────────────────
    const outcomeMesh = meshes.find(m => m.userData.id === 'outcome')
    let frame, t = 0

    const animate = () => {
      frame = requestAnimationFrame(animate)
      t += 0.012

      // Group highlight — runs every frame so it stays in sync with the ref
      const sg = selectedGrpRef.current
      const highlighted = sg ? GROUP_NODES[sg] : null
      meshes.forEach(m => {
        if (m.userData.id === hoveredId) return
        if (!highlighted) {
          m.material.opacity = 1.0
          if (m.userData.id !== 'outcome') m.material.emissiveIntensity = m.userData.baseEmissive
        } else {
          const active = highlighted.includes(m.userData.id)
          m.material.opacity            = active ? 1.0 : 0.1
          m.material.emissiveIntensity  = active ? m.userData.baseEmissive : 0.03
        }
      })

      if (outcomeMesh && hoveredId !== 'outcome') {
        outcomeMesh.material.emissiveIntensity = 0.45 + Math.sin(t * 1.8) * 0.2
        outcomeMesh.scale.setScalar(1 + Math.sin(t * 1.4) * 0.045)
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      mount.removeEventListener('mousemove', onMouseMove)
      ro.disconnect(); controls.dispose(); renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [user, studySessions, appLogs, attSessions, healthMetrics])

  return (
    <div className="subpanel graph3d-panel">
      <div className="panel-title">&gt; 3D DATA INFLUENCE GRAPH</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
        All data points feeding your academic outcome prediction. Hover nodes · drag to orbit · scroll to zoom.
      </p>

      {/* Group selector */}
      <div className="graph3d-groups">
        {GROUP_BUTTONS.map(btn => (
          <button
            key={String(btn.id)}
            className={`g3d-group-btn ${selectedGroup === btn.id ? 'active' : ''}`}
            onClick={() => selectGroup(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="graph3d-legend">
        <span><span className="g3d-dot" style={{ background: '#c8ff00' }} />OUTCOME</span>
        <span><span className="g3d-dot" style={{ background: '#d4af37' }} />CATEGORY</span>
        <span><span className="g3d-dot" style={{ background: '#44cc66' }} />PRODUCTIVE</span>
        <span><span className="g3d-dot" style={{ background: '#cc3333' }} />DISTRACTING</span>
        <span><span className="g3d-dot" style={{ background: '#ccaa33' }} />NEUTRAL</span>
        <span><span className="g3d-dot" style={{ background: '#7f7fff' }} />ACADEMIC</span>
        <span><span className="g3d-dot" style={{ background: '#ff9dbf' }} />HEALTH</span>
      </div>

      <div className="graph3d-canvas" ref={mountRef}>
        {tooltip.visible && (
          <div className="graph3d-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 32 }}>
            {tooltip.label}
          </div>
        )}
      </div>
    </div>
  )
}
