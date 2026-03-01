import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useAuth } from '../context/AuthContext'
import './PeerGraph3D.css'

// ─── DB ROW → PEER OBJECT ─────────────────────────────────────────────────────
// Maps the exact column names returned by GET /api/peers (cohort_students table)
// to the shape expected by the 3-D graph.
//
// Columns from DB:  id, study_hours, attention_span, focus_ratio,
//                   sleep_hours, break_freq, current_grade
//
// Fields not stored in the DB (field, year, apps, sites, health) are derived
// deterministically from the peer's id so the visualisation is stable across
// page loads while still reflecting the real study metrics where possible.

const _FIELDS = [
  'Computer Science', 'Mathematics', 'Physics', 'Engineering',
  'Biology', 'Psychology', 'Economics', 'Medicine',
  'Data Science', 'Law', 'Chemistry', 'Philosophy',
]
const _YEARS = [
  { year: '1st Year', yearNum: 1 },
  { year: '2nd Year', yearNum: 2 },
  { year: '3rd Year', yearNum: 3 },
  { year: '4th Year', yearNum: 4 },
]
const _FREQ = ['FREQUENT', 'OCCASIONAL', 'RARE', 'NEVER']

// Deterministic pseudo-random in [0, 1) — seeded by (id, slot)
function _dr(id, slot) {
  const x = Math.sin(id * 127.1 + slot * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function transformPeer(row, index) {
  // ── DB columns (exact names) ──────────────────────────────────────────────
  const { id, study_hours, attention_span, focus_ratio,
          sleep_hours, break_freq, current_grade } = row

  const toGrade = s =>
    s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B+' :
    s >= 60 ? 'B'  : s >= 50 ? 'C+' : 'C'

  const f = focus_ratio / 100  // 0–1 focus fraction

  // Academic sites: high focus → index 0 (FREQUENT)
  // Distraction sites: low focus → index 0 (FREQUENT)
  const acIdx = n => Math.max(0, Math.min(3, Math.round((1 - f) * 3 + _dr(id, n) - 0.5)))
  const dtIdx = n => Math.max(0, Math.min(3, Math.round(      f  * 3 + _dr(id, n) - 0.5)))

  return {
    id,
    alias:           `Scholar #${index + 1}`,
    field:           _FIELDS[id % _FIELDS.length],
    year:            _YEARS[id % 4].year,
    yearNum:         _YEARS[id % 4].yearNum,
    weeklyHours:     Math.round(study_hours * 7),
    outcomeGrade:    toGrade(current_grade),

    // ── Core metrics — directly from DB columns ───────────────────────────
    avgDailyHours:   parseFloat(study_hours.toFixed(1)),
    avgSessionMin:   Math.round(attention_span * 1.2),   // session ≈ 1.2× span
    sleep:           parseFloat(sleep_hours.toFixed(1)),
    avgAttentionMin: parseFloat(attention_span.toFixed(1)),
    avgBreaks:       parseFloat(break_freq.toFixed(1)),
    focusQualityPct: Math.round(focus_ratio),

    // ── App usage — scaled by focus_ratio ────────────────────────────────
    apps: {
      obsidian: parseFloat((f * 2.0 * _dr(id, 1)).toFixed(1)),
      vscode:   parseFloat((f * 5.0 * _dr(id, 2)).toFixed(1)),
      anki:     parseFloat((f * 3.0 * _dr(id, 3)).toFixed(1)),
      notion:   parseFloat((0.5 + _dr(id, 4) * 1.5).toFixed(1)),
      tiktok:   parseFloat(((1 - f) * 3.0 * _dr(id, 5)).toFixed(1)),
      discord:  parseFloat(((1 - f * 0.7) * 1.2 * _dr(id, 6)).toFixed(1)),
      youtube:  parseFloat((0.5 + _dr(id, 7) * 2.0).toFixed(1)),
    },

    // ── Website frequency — academic sites correlate with high focus ──────
    sites: {
      scholar: _FREQ[acIdx(8)],
      arxiv:   _FREQ[acIdx(9)],
      reddit:  _FREQ[dtIdx(10)],
      ytStudy: _FREQ[Math.max(0, Math.min(3, Math.round(_dr(id, 11) * 3)))],
    },

    // ── Health — sleep & study hours as base, id-seeded variance ─────────
    health: {
      avgSteps:   Math.round(4000 + sleep_hours * 600  + _dr(id, 12) * 3000),
      avgHR:      Math.round(58   + (1 - f) * 18       + _dr(id, 13) * 8),
      hrv:        Math.round(22   + f * 45              + _dr(id, 14) * 12),
      activeCal:  Math.round(150  + study_hours * 35   + _dr(id, 15) * 180),
      mindfulMin: Math.round(f * 55                    + _dr(id, 16) * 18),
    },
  }
}

// ─── RADIUS SCALING ───────────────────────────────────────────────────────────
const LEAF_SCALE = 0.030
const MIN_LEAF_R = 0.03
const FREQ = { FREQUENT: 3.0, OCCASIONAL: 1.5, RARE: 0.5, NEVER: 0.15 }

function leafValue(id, peer) {
  switch (id) {
    case 'avg-time':    return peer.avgDailyHours
    case 'session-dur': return peer.avgSessionMin / 60
    case 'sleep':       return peer.sleep
    case 'att-avg':     return peer.avgAttentionMin / 60
    case 'att-breaks':  return peer.avgBreaks * 0.5
    case 'att-qual':    return peer.focusQualityPct / 20
    case 'obsidian':    return peer.apps.obsidian
    case 'vscode':      return peer.apps.vscode
    case 'anki':        return peer.apps.anki
    case 'ai-agents':   return 0.3
    case 'notion':      return peer.apps.notion
    case 'tiktok':      return peer.apps.tiktok
    case 'discord':     return peer.apps.discord
    case 'youtube-a':   return peer.apps.youtube
    case 'field':       return 1.5
    case 'year':        return peer.yearNum * 0.5
    case 'target':      return peer.weeklyHours / 7
    case 'scholar':     return FREQ[peer.sites.scholar]
    case 'arxiv':       return FREQ[peer.sites.arxiv]
    case 'reddit':      return FREQ[peer.sites.reddit]
    case 'yt-study':    return FREQ[peer.sites.ytStudy]
    case 'h-steps':     return peer.health.avgSteps / 3000
    case 'h-hr':        return (100 - peer.health.avgHR) / 20
    case 'h-hrv':       return peer.health.hrv / 20
    case 'h-active':    return peer.health.activeCal / 150
    case 'h-mindful':   return peer.health.mindfulMin / 20
    default:            return 1.0
  }
}
function leafRadius(id, peer)     { return Math.max(MIN_LEAF_R, leafValue(id, peer) * LEAF_SCALE) }
function categoryRadius(id, peer) {
  let agg = 0
  switch (id) {
    case 'study':     agg = peer.avgDailyHours + peer.avgSessionMin / 60 + peer.sleep; break
    case 'attention': agg = peer.avgAttentionMin / 60 + peer.focusQualityPct / 20; break
    case 'apps':      agg = Object.values(peer.apps).reduce((s, v) => s + v, 0); break
    case 'major':     agg = peer.weeklyHours / 7 + peer.yearNum * 0.5; break
    case 'websites':  agg = Object.values(peer.sites).reduce((s, f) => s + (FREQ[f] || 0), 0); break
    case 'health':    agg = (peer.health.avgSteps / 3000) + (peer.health.hrv / 20) + (peer.health.mindfulMin / 20); break
    default:          agg = 5
  }
  return Math.min(0.42, Math.max(0.16, agg * 0.020))
}
function outcomeRadius(grade) {
  return ({ 'A+': 0.54, 'A': 0.48, 'B+': 0.43, 'B': 0.38, 'C+': 0.33, 'C': 0.29 })[grade] ?? 0.26
}
function gradeColor(grade) {
  if (grade.startsWith('A')) return '#44cc66'
  if (grade.startsWith('B')) return '#d4af37'
  if (grade.startsWith('C')) return '#ffb000'
  return '#cc3333'
}

// ─── GRAPH STRUCTURE ──────────────────────────────────────────────────────────
const NODE_DEFS = [
  { id: 'outcome',     label: '',  group: 'outcome',   color: '#c8ff00' },
  { id: 'study',       label: 'STUDY TIME',     group: 'category', color: '#d4af37' },
  { id: 'attention',   label: 'ATTENTION SPAN', group: 'category', color: '#d4af37' },
  { id: 'apps',        label: 'APP USAGE',      group: 'category', color: '#d4af37' },
  { id: 'major',       label: 'MAJOR / FIELD',  group: 'category', color: '#d4af37' },
  { id: 'websites',    label: 'WEBSITES',       group: 'category', color: '#d4af37' },
  { id: 'health',      label: 'HEALTH',         group: 'category', color: '#e8729a' },
  { id: 'avg-time',    label: '', group: 'leaf-prod', color: '#44cc66', parent: 'study' },
  { id: 'session-dur', label: '', group: 'leaf-prod', color: '#44cc66', parent: 'study' },
  { id: 'sleep',       label: '', group: 'leaf-prod', color: '#44cc66', parent: 'study' },
  { id: 'att-avg',     label: '', group: 'leaf-prod', color: '#44cc66', parent: 'attention' },
  { id: 'att-breaks',  label: '', group: 'leaf-neut', color: '#ccaa33', parent: 'attention' },
  { id: 'att-qual',    label: '', group: 'leaf-prod', color: '#44cc66', parent: 'attention' },
  { id: 'obsidian',    label: '', group: 'leaf-prod', color: '#44cc66', parent: 'apps' },
  { id: 'vscode',      label: '', group: 'leaf-prod', color: '#44cc66', parent: 'apps' },
  { id: 'anki',        label: '', group: 'leaf-prod', color: '#44cc66', parent: 'apps' },
  { id: 'ai-agents',   label: '', group: 'leaf-prod', color: '#44cc66', parent: 'apps' },
  { id: 'notion',      label: '', group: 'leaf-prod', color: '#44cc66', parent: 'apps' },
  { id: 'tiktok',      label: '', group: 'leaf-dist', color: '#cc3333', parent: 'apps' },
  { id: 'discord',     label: '', group: 'leaf-neut', color: '#ccaa33', parent: 'apps' },
  { id: 'youtube-a',   label: '', group: 'leaf-neut', color: '#ccaa33', parent: 'apps' },
  { id: 'field',       label: '', group: 'leaf-blue', color: '#7f7fff', parent: 'major' },
  { id: 'year',        label: '', group: 'leaf-blue', color: '#7f7fff', parent: 'major' },
  { id: 'target',      label: '', group: 'leaf-blue', color: '#7f7fff', parent: 'major' },
  { id: 'scholar',     label: '', group: 'leaf-prod', color: '#44cc66', parent: 'websites' },
  { id: 'arxiv',       label: '', group: 'leaf-prod', color: '#44cc66', parent: 'websites' },
  { id: 'reddit',      label: '', group: 'leaf-dist', color: '#cc3333', parent: 'websites' },
  { id: 'yt-study',    label: '', group: 'leaf-neut', color: '#ccaa33', parent: 'websites' },
  { id: 'h-steps',    label: '', group: 'leaf-health', color: '#ff9dbf', parent: 'health' },
  { id: 'h-hr',       label: '', group: 'leaf-health', color: '#ff9dbf', parent: 'health' },
  { id: 'h-hrv',      label: '', group: 'leaf-health', color: '#ff9dbf', parent: 'health' },
  { id: 'h-active',   label: '', group: 'leaf-health', color: '#ff9dbf', parent: 'health' },
  { id: 'h-mindful',  label: '', group: 'leaf-health', color: '#ff9dbf', parent: 'health' },
]

const EDGE_DEFS = [
  { from: 'outcome', to: 'study' }, { from: 'outcome', to: 'attention' },
  { from: 'outcome', to: 'apps' },  { from: 'outcome', to: 'major' },
  { from: 'outcome', to: 'websites' },
  { from: 'outcome', to: 'health' },
  { from: 'health', to: 'h-steps' },
  { from: 'health', to: 'h-hr' },
  { from: 'health', to: 'h-hrv' },
  { from: 'health', to: 'h-active' },
  { from: 'health', to: 'h-mindful' },
  { from: 'study', to: 'avg-time' }, { from: 'study', to: 'session-dur' }, { from: 'study', to: 'sleep' },
  { from: 'attention', to: 'att-avg' }, { from: 'attention', to: 'att-breaks' }, { from: 'attention', to: 'att-qual' },
  { from: 'apps', to: 'obsidian' }, { from: 'apps', to: 'vscode' }, { from: 'apps', to: 'anki' },
  { from: 'apps', to: 'ai-agents' }, { from: 'apps', to: 'notion' }, { from: 'apps', to: 'tiktok' },
  { from: 'apps', to: 'discord' },   { from: 'apps', to: 'youtube-a' },
  { from: 'major', to: 'field' }, { from: 'major', to: 'year' }, { from: 'major', to: 'target' },
  { from: 'websites', to: 'scholar' }, { from: 'websites', to: 'arxiv' },
  { from: 'websites', to: 'reddit' },  { from: 'websites', to: 'yt-study' },
]

const GROUP_NODES = {
  study:     ['outcome', 'study', 'avg-time', 'session-dur', 'sleep'],
  attention: ['outcome', 'attention', 'att-avg', 'att-breaks', 'att-qual'],
  apps:      ['outcome', 'apps', 'obsidian', 'vscode', 'anki', 'ai-agents', 'notion', 'tiktok', 'discord', 'youtube-a'],
  major:     ['outcome', 'major', 'field', 'year', 'target'],
  websites:  ['outcome', 'websites', 'scholar', 'arxiv', 'reddit', 'yt-study'],
  health:    ['outcome', 'health', 'h-steps', 'h-hr', 'h-hrv', 'h-active', 'h-mindful'],
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

const BASE_EMISSIVE = { outcome: 0.55, category: 0.22, default: 0.22 }

function fibSphere(n, r) {
  const pts = [], golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(Math.max(0, 1 - y * y)), theta = golden * i
    pts.push(new THREE.Vector3(Math.cos(theta) * rad * r, y * r, Math.sin(theta) * rad * r))
  }
  return pts
}

function buildPeerNodes(peer) {
  const gc = gradeColor(peer.outcomeGrade)
  return NODE_DEFS.map(n => {
    const node = { ...n }
    if (n.id === 'outcome') { node.radius = outcomeRadius(peer.outcomeGrade); node.color = gc }
    else if (n.group === 'category') { node.radius = categoryRadius(n.id, peer) }
    else { node.radius = leafRadius(n.id, peer) }

    if (n.id === 'outcome')     node.label = `PREDICTED: ${peer.outcomeGrade}`
    if (n.id === 'field')       node.label = peer.field.toUpperCase()
    if (n.id === 'year')        node.label = peer.year.toUpperCase()
    if (n.id === 'target')      node.label = `TARGET: ${peer.weeklyHours}H/WK`
    if (n.id === 'avg-time')    node.label = `AVG TIME: ${peer.avgDailyHours}H/DAY`
    if (n.id === 'session-dur') node.label = `SESSION: ~${peer.avgSessionMin}MIN`
    if (n.id === 'sleep')       node.label = `SLEEP: ${peer.sleep}H/NIGHT`
    if (n.id === 'att-avg')     node.label = `AVG SPAN: ${peer.avgAttentionMin}MIN`
    if (n.id === 'att-breaks')  node.label = `BREAKS: ${peer.avgBreaks}/SESSION`
    if (n.id === 'att-qual')    node.label = `FOCUS QUALITY: ${peer.focusQualityPct}% HIGH`
    if (n.id === 'obsidian')    node.label = peer.apps.obsidian  ? `Obsidian: ${peer.apps.obsidian}h`  : 'Obsidian: —'
    if (n.id === 'vscode')      node.label = peer.apps.vscode    ? `VS Code: ${peer.apps.vscode}h`     : 'VS Code: —'
    if (n.id === 'anki')        node.label = peer.apps.anki      ? `Anki: ${peer.apps.anki}h`          : 'Anki: —'
    if (n.id === 'ai-agents')   node.label = 'AI Agents'
    if (n.id === 'notion')      node.label = peer.apps.notion    ? `Notion: ${peer.apps.notion}h`      : 'Notion: —'
    if (n.id === 'tiktok')      node.label = peer.apps.tiktok    ? `TikTok: ${peer.apps.tiktok}h`      : 'TikTok: —'
    if (n.id === 'discord')     node.label = peer.apps.discord   ? `Discord: ${peer.apps.discord}h`    : 'Discord: —'
    if (n.id === 'youtube-a')   node.label = peer.apps.youtube   ? `YouTube: ${peer.apps.youtube}h`    : 'YouTube: —'
    if (n.id === 'scholar')     node.label = `Google Scholar: ${peer.sites.scholar}`
    if (n.id === 'arxiv')       node.label = `ArXiv: ${peer.sites.arxiv}`
    if (n.id === 'reddit')      node.label = `Reddit: ${peer.sites.reddit}`
    if (n.id === 'yt-study')    node.label = `YouTube Study: ${peer.sites.ytStudy}`
    if (n.id === 'h-steps')     node.label = `STEPS: ${peer.health.avgSteps.toLocaleString()}/DAY`
    if (n.id === 'h-hr')        node.label = `HEART RATE: ${peer.health.avgHR} BPM`
    if (n.id === 'h-hrv')       node.label = `HRV: ${peer.health.hrv} MS`
    if (n.id === 'h-active')    node.label = `ACTIVE CAL: ${peer.health.activeCal} KCAL`
    if (n.id === 'h-mindful')   node.label = `MINDFULNESS: ${peer.health.mindfulMin} MIN/WK`
    return node
  })
}

// ─── SHARED SCENE BUILDER ─────────────────────────────────────────────────────
function buildScene(peer) {
  const nodes   = buildPeerNodes(peer)
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  nodeMap['outcome'].pos = new THREE.Vector3(0, 0, 0)
  const cats = nodes.filter(n => n.group === 'category')
  fibSphere(cats.length, 3.6).forEach((pos, i) => { cats[i].pos = pos })

  const byParent = {}
  nodes.filter(n => n.parent).forEach(n => {
    byParent[n.parent] = byParent[n.parent] || []; byParent[n.parent].push(n)
  })
  const OFFSETS = [0.0, 0.3, -0.25, 0.15, -0.1, 0.4, -0.35, 0.2]
  Object.entries(byParent).forEach(([pid, kids]) => {
    const parent = nodeMap[pid]; if (!parent?.pos) return
    kids.forEach((kid, i) => {
      const angle = (i / kids.length) * Math.PI * 2
      kid.pos = new THREE.Vector3(
        parent.pos.x + Math.cos(angle) * 1.65,
        parent.pos.y + OFFSETS[i % OFFSETS.length],
        parent.pos.z + Math.sin(angle) * 1.65,
      )
    })
  })

  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  const pLight = new THREE.PointLight(0xffffff, 1.8, 35)
  pLight.position.set(5, 7, 5); scene.add(pLight)

  const meshes = []
  nodes.forEach(node => {
    if (!node.pos) return
    const color = new THREE.Color(node.color)
    const mat = new THREE.MeshPhongMaterial({
      color, emissive: color,
      emissiveIntensity: BASE_EMISSIVE[node.group] ?? BASE_EMISSIVE.default,
      shininess: 90, transparent: true, opacity: 1.0,
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(node.radius, 18, 18), mat)
    mesh.position.copy(node.pos)
    mesh.userData = { id: node.id, label: node.label, group: node.group,
                      baseEmissive: BASE_EMISSIVE[node.group] ?? BASE_EMISSIVE.default }
    scene.add(mesh); meshes.push(mesh)
  })

  const edgeMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.3 })
  EDGE_DEFS.forEach(({ from, to }) => {
    const a = nodeMap[from], b = nodeMap[to]; if (!a?.pos || !b?.pos) return
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.pos.clone(), b.pos.clone()]), edgeMat))
  })

  return { scene, nodes, nodeMap, meshes }
}

// ─── MINI PEER GRAPH ─────────────────────────────────────────────────────────
function MiniPeerGraph({ peer, onFocus }) {
  const mountRef    = useRef(null)
  const controlsRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const { scene, meshes } = buildScene(peer)

    const W = mount.clientWidth, H = mount.clientHeight
    const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 100)
    camera.position.set(0, 2, 14)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan    = false
    controls.enableZoom   = false
    controls.enableRotate = false
    controls.autoRotate      = true
    controls.autoRotateSpeed = 0.5
    controlsRef.current = controls

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    })
    ro.observe(mount)

    const outcomeMesh = meshes.find(m => m.userData.id === 'outcome')
    let frame, t = 0
    const animate = () => {
      frame = requestAnimationFrame(animate); t += 0.012
      if (outcomeMesh) {
        outcomeMesh.material.emissiveIntensity = 0.45 + Math.sin(t * 1.8) * 0.2
        outcomeMesh.scale.setScalar(1 + Math.sin(t * 1.4) * 0.04)
      }
      controls.update(); renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect(); controls.dispose(); renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [peer])

  return (
    <div
      className="peer-mini-card"
      onMouseEnter={() => { if (controlsRef.current) controlsRef.current.autoRotateSpeed = 3.5 }}
      onMouseLeave={() => { if (controlsRef.current) controlsRef.current.autoRotateSpeed = 0.5 }}
      onClick={() => onFocus(peer)}
    >
      <div className="peer-mini-header">
        <div>
          <div className="peer-mini-alias">{peer.alias}</div>
          <div className="peer-mini-field muted-text">{peer.field} · {peer.year}</div>
        </div>
        <span className="peer-mini-grade" style={{ color: gradeColor(peer.outcomeGrade) }}>
          {peer.outcomeGrade}
        </span>
      </div>
      <div className="peer-mini-canvas" ref={mountRef} />
    </div>
  )
}

// ─── DETAIL VIEW ─────────────────────────────────────────────────────────────
function PeerDetail({ peer, onBack }) {
  const mountRef       = useRef(null)
  const meshesRef      = useRef([])
  const selectedGrpRef = useRef(null)

  const [selectedGroup, setSelectedGroup] = useState(null)
  const [tooltip,       setTooltip]       = useState({ visible: false, label: '', x: 0, y: 0 })

  const selectGroup = id => { setSelectedGroup(id); selectedGrpRef.current = id }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const { scene, meshes } = buildScene(peer)

    const W = mount.clientWidth, H = mount.clientHeight
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100)
    camera.position.set(0, 2.5, 13)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // Stars
    const starPos = new Float32Array(350 * 3)
    for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 60
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.06 })))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.06
    controls.autoRotate = true;    controls.autoRotateSpeed = 0.35
    controls.minDistance = 5;      controls.maxDistance = 22

    meshesRef.current = meshes

    // Hover
    const HIT_MIN_PX = 20
    let hoveredId = null
    const onMouseMove = e => {
      const rect = mount.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const fovRad = camera.fov * Math.PI / 180
      let closest = null, closestDist = Infinity
      meshes.forEach(mesh => {
        const ndc = mesh.position.clone().project(camera)
        if (ndc.z > 1) return
        const sx    = (ndc.x *  0.5 + 0.5) * rect.width
        const sy    = (ndc.y * -0.5 + 0.5) * rect.height
        const camD  = camera.position.distanceTo(mesh.position)
        const projR = (mesh.geometry.parameters.radius / camD) * (rect.height / (2 * Math.tan(fovRad / 2)))
        const hitR  = Math.max(HIT_MIN_PX, projR)
        const d     = Math.hypot(mx - sx, my - sy)
        if (d < hitR && d < closestDist) { closestDist = d; closest = mesh }
      })
      if (hoveredId !== null) {
        const prev = meshes.find(m => m.userData.id === hoveredId)
        if (prev) { prev.material.emissiveIntensity = prev.userData.baseEmissive; prev.scale.setScalar(1) }
      }
      if (closest) {
        closest.material.emissiveIntensity = 0.9; closest.scale.setScalar(1.25)
        hoveredId = closest.userData.id
        setTooltip({ visible: true, label: closest.userData.label, x: mx, y: my })
        mount.style.cursor = 'pointer'
      } else {
        hoveredId = null; setTooltip(t => ({ ...t, visible: false })); mount.style.cursor = 'grab'
      }
    }
    mount.addEventListener('mousemove', onMouseMove)

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    })
    ro.observe(mount)

    const outcomeMesh = meshes.find(m => m.userData.id === 'outcome')
    let frame, t = 0
    const animate = () => {
      frame = requestAnimationFrame(animate); t += 0.012
      const highlighted = selectedGrpRef.current ? GROUP_NODES[selectedGrpRef.current] : null
      meshes.forEach(m => {
        if (m.userData.id === hoveredId) return
        if (!highlighted) {
          m.material.opacity = 1.0
          if (m.userData.id !== 'outcome') m.material.emissiveIntensity = m.userData.baseEmissive
        } else {
          const active = highlighted.includes(m.userData.id)
          m.material.opacity           = active ? 1.0 : 0.1
          m.material.emissiveIntensity = active ? m.userData.baseEmissive : 0.03
        }
      })
      if (outcomeMesh && hoveredId !== 'outcome') {
        outcomeMesh.material.emissiveIntensity = 0.45 + Math.sin(t * 1.8) * 0.2
        outcomeMesh.scale.setScalar(1 + Math.sin(t * 1.4) * 0.045)
      }
      controls.update(); renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      mount.removeEventListener('mousemove', onMouseMove)
      ro.disconnect(); controls.dispose(); renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [peer])

  return (
    <div className="subpanel peer-panel">
      <div className="peer-detail-header">
        <button className="retro-btn peer-back-btn" onClick={onBack}>← BACK</button>
        <div className="peer-detail-title">
          <span className="panel-title" style={{ margin: 0 }}>{peer.alias}</span>
          <span className="muted-text" style={{ fontSize: '0.78rem' }}>
            {peer.field} · {peer.year}
          </span>
        </div>
        <div className="peer-grade-row">
          <span className="peer-grade-dot" style={{ background: gradeColor(peer.outcomeGrade) }} />
          <span className="peer-grade">{peer.outcomeGrade}</span>
        </div>
      </div>

      <div className="peer-groups">
        {GROUP_BUTTONS.map(btn => (
          <button
            key={String(btn.id)}
            className={`peer-group-btn ${selectedGroup === btn.id ? 'active' : ''}`}
            onClick={() => selectGroup(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="peer-legend">
        <span><span className="peer-dot" style={{ background: gradeColor(peer.outcomeGrade) }} />OUTCOME</span>
        <span><span className="peer-dot" style={{ background: '#d4af37' }} />CATEGORY</span>
        <span><span className="peer-dot" style={{ background: '#44cc66' }} />PRODUCTIVE</span>
        <span><span className="peer-dot" style={{ background: '#cc3333' }} />DISTRACTING</span>
        <span><span className="peer-dot" style={{ background: '#ccaa33' }} />NEUTRAL</span>
        <span><span className="peer-dot" style={{ background: '#7f7fff' }} />ACADEMIC</span>
        <span><span className="peer-dot" style={{ background: '#ff9dbf' }} />HEALTH</span>
      </div>

      <div className="peer-canvas" ref={mountRef}>
        {tooltip.visible && (
          <div className="peer-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 32 }}>
            {tooltip.label}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function PeerGraph3D() {
  const { apiFetch } = useAuth()
  const [focusedPeer, setFocusedPeer] = useState(null)
  const [peers,       setPeers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    apiFetch('/api/peers')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => setPeers((data.peers || []).map(transformPeer)))
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false))
  }, [apiFetch])

  if (focusedPeer) {
    return <PeerDetail peer={focusedPeer} onBack={() => setFocusedPeer(null)} />
  }

  return (
    <div className="subpanel peer-panel">
      <div className="panel-title">❂ PEER BENCHMARK</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1.2rem' }}>
        Anonymised cohort profiles from the database. Hover to spin · click to expand.
      </p>

      {loading && (
        <div className="muted-text" style={{ fontSize: '0.8rem' }}>&gt; Loading peers…</div>
      )}
      {error && (
        <div style={{ color: '#cc4444', fontSize: '0.8rem' }}>&gt; Could not load peers: {error}</div>
      )}

      <div className="peer-grid">
        {peers.map(p => (
          <MiniPeerGraph key={p.id} peer={p} onFocus={setFocusedPeer} />
        ))}
      </div>
    </div>
  )
}
