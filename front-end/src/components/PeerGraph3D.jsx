import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './PeerGraph3D.css'

// ─── ANONYMISED PEER PROFILES ────────────────────────────────────────────────
// sleep stored as number (hours); yearNum for year-of-study scaling
const PEERS = [
  {
    id: 1, alias: 'Scholar #1',
    field: 'Computer Science', year: '3rd Year', yearNum: 3, weeklyHours: 35,
    outcomeGrade: 'A',
    avgDailyHours: 6.2, avgSessionMin: 72, sleep: 7.5,
    avgAttentionMin: 55, avgBreaks: 1.8, focusQualityPct: 82,
    apps: { obsidian: 1.1, vscode: 4.5, anki: 1.2, notion: 0.9, tiktok: 0.3, discord: 0.5, youtube: 1.0 },
    sites: { scholar: 'FREQUENT', arxiv: 'FREQUENT', reddit: 'RARE', ytStudy: 'OCCASIONAL' },
  },
  {
    id: 2, alias: 'Scholar #2',
    field: 'Biology', year: '2nd Year', yearNum: 2, weeklyHours: 28,
    outcomeGrade: 'B+',
    avgDailyHours: 4.8, avgSessionMin: 55, sleep: 7.0,
    avgAttentionMin: 42, avgBreaks: 2.3, focusQualityPct: 65,
    apps: { obsidian: 0, vscode: 0, anki: 2.1, notion: 1.5, tiktok: 0.8, discord: 1.2, youtube: 1.5 },
    sites: { scholar: 'FREQUENT', arxiv: 'RARE', reddit: 'OCCASIONAL', ytStudy: 'FREQUENT' },
  },
  {
    id: 3, alias: 'Scholar #3',
    field: 'Psychology', year: '1st Year', yearNum: 1, weeklyHours: 15,
    outcomeGrade: 'C',
    avgDailyHours: 2.5, avgSessionMin: 32, sleep: 6.0,
    avgAttentionMin: 24, avgBreaks: 4.1, focusQualityPct: 28,
    apps: { obsidian: 0, vscode: 0, anki: 0.3, notion: 0.5, tiktok: 3.5, discord: 2.8, youtube: 2.0 },
    sites: { scholar: 'RARE', arxiv: 'NEVER', reddit: 'FREQUENT', ytStudy: 'RARE' },
  },
  {
    id: 4, alias: 'Scholar #4',
    field: 'Mathematics', year: '4th Year', yearNum: 4, weeklyHours: 42,
    outcomeGrade: 'A+',
    avgDailyHours: 7.8, avgSessionMin: 95, sleep: 8.0,
    avgAttentionMin: 68, avgBreaks: 1.2, focusQualityPct: 92,
    apps: { obsidian: 1.8, vscode: 2.0, anki: 2.5, notion: 1.2, tiktok: 0.1, discord: 0.3, youtube: 0.5 },
    sites: { scholar: 'FREQUENT', arxiv: 'FREQUENT', reddit: 'NEVER', ytStudy: 'FREQUENT' },
  },
  {
    id: 5, alias: 'Scholar #5',
    field: 'Economics', year: '2nd Year', yearNum: 2, weeklyHours: 22,
    outcomeGrade: 'B',
    avgDailyHours: 3.8, avgSessionMin: 48, sleep: 6.5,
    avgAttentionMin: 38, avgBreaks: 2.8, focusQualityPct: 55,
    apps: { obsidian: 0, vscode: 0, anki: 0.8, notion: 2.0, tiktok: 1.5, discord: 1.8, youtube: 2.2 },
    sites: { scholar: 'OCCASIONAL', arxiv: 'NEVER', reddit: 'FREQUENT', ytStudy: 'OCCASIONAL' },
  },
  {
    id: 6, alias: 'Scholar #6',
    field: 'Engineering', year: '3rd Year', yearNum: 3, weeklyHours: 30,
    outcomeGrade: 'B+',
    avgDailyHours: 5.1, avgSessionMin: 61, sleep: 7.0,
    avgAttentionMin: 47, avgBreaks: 2.1, focusQualityPct: 70,
    apps: { obsidian: 0.4, vscode: 3.8, anki: 0.9, notion: 1.1, tiktok: 0.6, discord: 0.9, youtube: 1.3 },
    sites: { scholar: 'FREQUENT', arxiv: 'OCCASIONAL', reddit: 'RARE', ytStudy: 'RARE' },
  },
]

// ─── RADIUS SCALING ──────────────────────────────────────────────────────────
// All values are normalised to "hour-equivalents" so that
// radius is strictly proportional: 4h node = 4× radius of 1h node.
const LEAF_SCALE = 0.030   // 1 h-equivalent → radius 0.030
const MIN_LEAF_R = 0.03    // floor so zero-usage nodes stay visible

const FREQ = { FREQUENT: 3.0, OCCASIONAL: 1.5, RARE: 0.5, NEVER: 0.15 }

function leafValue(id, peer) {
  switch (id) {
    // Study leaves – hours
    case 'avg-time':    return peer.avgDailyHours
    case 'session-dur': return peer.avgSessionMin / 60
    case 'sleep':       return peer.sleep
    // Attention leaves – convert to h-equivalents
    case 'att-avg':     return peer.avgAttentionMin / 60
    case 'att-breaks':  return peer.avgBreaks * 0.5          // 1 break ≈ 0.5 h-eq
    case 'att-qual':    return peer.focusQualityPct / 20     // 100% → 5 h-eq
    // App leaves – hours
    case 'obsidian':    return peer.apps.obsidian
    case 'vscode':      return peer.apps.vscode
    case 'anki':        return peer.apps.anki
    case 'ai-agents':   return 0.3                           // not tracked, minimal
    case 'notion':      return peer.apps.notion
    case 'tiktok':      return peer.apps.tiktok
    case 'discord':     return peer.apps.discord
    case 'youtube-a':   return peer.apps.youtube
    // Academic leaves – h-equivalents
    case 'field':       return 1.5                           // descriptive, neutral
    case 'year':        return peer.yearNum * 0.5            // 1st→0.5 … 4th→2.0
    case 'target':      return peer.weeklyHours / 7          // daily h target
    // Website leaves – frequency h-equivalents
    case 'scholar':     return FREQ[peer.sites.scholar]
    case 'arxiv':       return FREQ[peer.sites.arxiv]
    case 'reddit':      return FREQ[peer.sites.reddit]
    case 'yt-study':    return FREQ[peer.sites.ytStudy]
    default:            return 1.0
  }
}

function leafRadius(id, peer) {
  return Math.max(MIN_LEAF_R, leafValue(id, peer) * LEAF_SCALE)
}

// Category radius driven by aggregate of its leaves
function categoryRadius(id, peer) {
  let agg = 0
  switch (id) {
    case 'study':
      agg = peer.avgDailyHours + peer.avgSessionMin / 60 + peer.sleep; break
    case 'attention':
      agg = peer.avgAttentionMin / 60 + peer.focusQualityPct / 20; break
    case 'apps':
      agg = Object.values(peer.apps).reduce((s, v) => s + v, 0); break
    case 'major':
      agg = peer.weeklyHours / 7 + peer.yearNum * 0.5; break
    case 'websites':
      agg = Object.values(peer.sites).reduce((s, f) => s + (FREQ[f] || 0), 0); break
    default: agg = 5
  }
  return Math.min(0.42, Math.max(0.16, agg * 0.020))
}

// Outcome radius reflects grade quality
function outcomeRadius(grade) {
  const map = { 'A+': 0.54, 'A': 0.48, 'B+': 0.43, 'B': 0.38, 'C+': 0.33, 'C': 0.29 }
  return map[grade] ?? 0.26
}

function gradeColor(grade) {
  if (grade.startsWith('A')) return '#44cc66'
  if (grade.startsWith('B')) return '#d4af37'
  if (grade.startsWith('C')) return '#ffb000'
  return '#cc3333'
}

// ─── GRAPH STRUCTURE ─────────────────────────────────────────────────────────
const NODE_DEFS = [
  { id: 'outcome',     label: '',  group: 'outcome',   color: '#c8ff00' },
  { id: 'study',       label: 'STUDY TIME',        group: 'category',  color: '#d4af37' },
  { id: 'attention',   label: 'ATTENTION SPAN',    group: 'category',  color: '#d4af37' },
  { id: 'apps',        label: 'APP USAGE',         group: 'category',  color: '#d4af37' },
  { id: 'major',       label: 'MAJOR / FIELD',     group: 'category',  color: '#d4af37' },
  { id: 'websites',    label: 'WEBSITES',          group: 'category',  color: '#d4af37' },
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
]

const EDGE_DEFS = [
  { from: 'outcome', to: 'study' }, { from: 'outcome', to: 'attention' },
  { from: 'outcome', to: 'apps' },  { from: 'outcome', to: 'major' },
  { from: 'outcome', to: 'websites' },
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
}

const GROUP_BUTTONS = [
  { id: null,        label: 'ALL' },
  { id: 'study',     label: 'STUDY TIME' },
  { id: 'attention', label: 'ATTENTION' },
  { id: 'apps',      label: 'APP USAGE' },
  { id: 'major',     label: 'ACADEMIC' },
  { id: 'websites',  label: 'WEBSITES' },
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

// ─── BUILD NODES WITH DATA-DRIVEN RADII ──────────────────────────────────────
function buildPeerNodes(peer) {
  const gc = gradeColor(peer.outcomeGrade)
  return NODE_DEFS.map(n => {
    const node = { ...n }

    // Radius: outcome and category driven by data; leaves proportional to value
    if (n.id === 'outcome') {
      node.radius = outcomeRadius(peer.outcomeGrade)
      node.color  = gc
    } else if (n.group === 'category') {
      node.radius = categoryRadius(n.id, peer)
    } else {
      node.radius = leafRadius(n.id, peer)
    }

    // Labels
    if (n.id === 'outcome')     { node.label = `PREDICTED: ${peer.outcomeGrade}` }
    if (n.id === 'field')        node.label = peer.field.toUpperCase()
    if (n.id === 'year')         node.label = peer.year.toUpperCase()
    if (n.id === 'target')       node.label = `TARGET: ${peer.weeklyHours}H/WK`
    if (n.id === 'avg-time')     node.label = `AVG TIME: ${peer.avgDailyHours}H/DAY`
    if (n.id === 'session-dur')  node.label = `SESSION: ~${peer.avgSessionMin}MIN`
    if (n.id === 'sleep')        node.label = `SLEEP: ${peer.sleep}H/NIGHT`
    if (n.id === 'att-avg')      node.label = `AVG SPAN: ${peer.avgAttentionMin}MIN`
    if (n.id === 'att-breaks')   node.label = `BREAKS: ${peer.avgBreaks}/SESSION`
    if (n.id === 'att-qual')     node.label = `FOCUS QUALITY: ${peer.focusQualityPct}% HIGH`
    if (n.id === 'obsidian')     node.label = peer.apps.obsidian  ? `Obsidian: ${peer.apps.obsidian}h`  : 'Obsidian: —'
    if (n.id === 'vscode')       node.label = peer.apps.vscode    ? `VS Code: ${peer.apps.vscode}h`     : 'VS Code: —'
    if (n.id === 'anki')         node.label = peer.apps.anki      ? `Anki: ${peer.apps.anki}h`          : 'Anki: —'
    if (n.id === 'ai-agents')    node.label = 'AI Agents'
    if (n.id === 'notion')       node.label = peer.apps.notion    ? `Notion: ${peer.apps.notion}h`      : 'Notion: —'
    if (n.id === 'tiktok')       node.label = peer.apps.tiktok    ? `TikTok: ${peer.apps.tiktok}h`      : 'TikTok: —'
    if (n.id === 'discord')      node.label = peer.apps.discord   ? `Discord: ${peer.apps.discord}h`    : 'Discord: —'
    if (n.id === 'youtube-a')    node.label = peer.apps.youtube   ? `YouTube: ${peer.apps.youtube}h`    : 'YouTube: —'
    if (n.id === 'scholar')      node.label = `Google Scholar: ${peer.sites.scholar}`
    if (n.id === 'arxiv')        node.label = `ArXiv: ${peer.sites.arxiv}`
    if (n.id === 'reddit')       node.label = `Reddit: ${peer.sites.reddit}`
    if (n.id === 'yt-study')     node.label = `YouTube Study: ${peer.sites.ytStudy}`

    return node
  })
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function PeerGraph3D() {
  const mountRef       = useRef(null)
  const meshesRef      = useRef([])
  const selectedGrpRef = useRef(null)

  const [activePeer,    setActivePeer]    = useState(PEERS[0])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [tooltip,       setTooltip]       = useState({ visible: false, label: '', x: 0, y: 0 })

  const selectGroup = id => { setSelectedGroup(id); selectedGrpRef.current = id }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const nodes   = buildPeerNodes(activePeer)
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

    // ── Positions ───────────────────────────────────────────────
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
    controls.enableDamping = true; controls.dampingFactor = 0.06
    controls.autoRotate = true;    controls.autoRotateSpeed = 0.35
    controls.minDistance = 5;      controls.maxDistance = 22

    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const pLight = new THREE.PointLight(0xffffff, 1.8, 35)
    pLight.position.set(5, 7, 5); scene.add(pLight)

    const starPos = new Float32Array(350 * 3)
    for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 60
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 0.06 })))

    // ── Node meshes ─────────────────────────────────────────────
    const meshes = []
    nodes.forEach(node => {
      if (!node.pos) return
      const color = new THREE.Color(node.color)
      const mat = new THREE.MeshPhongMaterial({
        color, emissive: color,
        emissiveIntensity: BASE_EMISSIVE[node.group] ?? BASE_EMISSIVE.default,
        shininess: 90, transparent: true, opacity: 1.0,
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(node.radius, 22, 22), mat)
      mesh.position.copy(node.pos)
      mesh.userData = { id: node.id, label: node.label, group: node.group,
                        baseEmissive: BASE_EMISSIVE[node.group] ?? BASE_EMISSIVE.default }
      scene.add(mesh); meshes.push(mesh)
    })
    meshesRef.current = meshes

    // ── Edges ───────────────────────────────────────────────────
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.35 })
    EDGE_DEFS.forEach(({ from, to }) => {
      const a = nodeMap[from], b = nodeMap[to]; if (!a?.pos || !b?.pos) return
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.pos.clone(), b.pos.clone()]), edgeMat))
    })

    // ── Hover ───────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2()
    let hoveredId = null

    const onMouseMove = e => {
      const rect = mount.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      if (hoveredId !== null) {
        const prev = meshes.find(m => m.userData.id === hoveredId)
        if (prev) { prev.material.emissiveIntensity = prev.userData.baseEmissive; prev.scale.setScalar(1) }
      }
      const hits = raycaster.intersectObjects(meshes)
      if (hits.length > 0) {
        const mesh = hits[0].object
        mesh.material.emissiveIntensity = 0.9; mesh.scale.setScalar(1.25)
        hoveredId = mesh.userData.id
        setTooltip({ visible: true, label: mesh.userData.label, x: e.clientX - rect.left, y: e.clientY - rect.top })
        mount.style.cursor = 'pointer'
      } else {
        hoveredId = null; setTooltip(t => ({ ...t, visible: false })); mount.style.cursor = 'grab'
      }
    }
    mount.addEventListener('mousemove', onMouseMove)

    // ── Resize ──────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    })
    ro.observe(mount)

    // ── Animation ───────────────────────────────────────────────
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
  }, [activePeer])

  return (
    <div className="subpanel peer-panel">
      <div className="panel-title">❂ PEER BENCHMARK</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '0.9rem' }}>
        Anonymised study profiles. Circle size is proportional to data magnitude — larger means more.
        Hover nodes · drag to orbit · scroll to zoom.
      </p>

      {/* Peer selector */}
      <div className="peer-selector">
        {PEERS.map(p => (
          <button
            key={p.id}
            className={`peer-card ${activePeer.id === p.id ? 'active' : ''}`}
            onClick={() => { setActivePeer(p); setSelectedGroup(null); selectedGrpRef.current = null }}
          >
            <div className="peer-alias">{p.alias}</div>
            <div className="peer-field">{p.field}</div>
            <div className="peer-grade-row">
              <span className="peer-grade-dot" style={{ background: gradeColor(p.outcomeGrade) }} />
              <span className="peer-grade">{p.outcomeGrade}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Group selector */}
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

      {/* Legend */}
      <div className="peer-legend">
        <span><span className="peer-dot" style={{ background: gradeColor(activePeer.outcomeGrade) }} />OUTCOME</span>
        <span><span className="peer-dot" style={{ background: '#d4af37' }} />CATEGORY</span>
        <span><span className="peer-dot" style={{ background: '#44cc66' }} />PRODUCTIVE</span>
        <span><span className="peer-dot" style={{ background: '#cc3333' }} />DISTRACTING</span>
        <span><span className="peer-dot" style={{ background: '#ccaa33' }} />NEUTRAL</span>
        <span><span className="peer-dot" style={{ background: '#7f7fff' }} />ACADEMIC</span>
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
