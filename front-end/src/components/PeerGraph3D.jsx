import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './PeerGraph3D.css'

// ─── ANONYMISED PEER PROFILES ─────────────────────────────────────────────────
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
  {
    id: 7, alias: 'Scholar #7',
    field: 'Physics', year: '4th Year', yearNum: 4, weeklyHours: 44,
    outcomeGrade: 'A+',
    avgDailyHours: 8.1, avgSessionMin: 102, sleep: 7.8,
    avgAttentionMin: 74, avgBreaks: 1.0, focusQualityPct: 95,
    apps: { obsidian: 2.2, vscode: 1.5, anki: 3.0, notion: 0.8, tiktok: 0.0, discord: 0.2, youtube: 0.4 },
    sites: { scholar: 'FREQUENT', arxiv: 'FREQUENT', reddit: 'NEVER', ytStudy: 'FREQUENT' },
  },
  {
    id: 8, alias: 'Scholar #8',
    field: 'Law', year: '2nd Year', yearNum: 2, weeklyHours: 38,
    outcomeGrade: 'B+',
    avgDailyHours: 5.8, avgSessionMin: 80, sleep: 6.8,
    avgAttentionMin: 60, avgBreaks: 1.5, focusQualityPct: 74,
    apps: { obsidian: 2.5, vscode: 0, anki: 1.8, notion: 2.2, tiktok: 0.4, discord: 0.6, youtube: 0.8 },
    sites: { scholar: 'FREQUENT', arxiv: 'NEVER', reddit: 'OCCASIONAL', ytStudy: 'OCCASIONAL' },
  },
  {
    id: 9, alias: 'Scholar #9',
    field: 'Art & Design', year: '1st Year', yearNum: 1, weeklyHours: 18,
    outcomeGrade: 'B',
    avgDailyHours: 3.2, avgSessionMin: 40, sleep: 7.5,
    avgAttentionMin: 35, avgBreaks: 3.0, focusQualityPct: 50,
    apps: { obsidian: 0, vscode: 0, anki: 0.2, notion: 1.8, tiktok: 2.0, discord: 1.5, youtube: 2.5 },
    sites: { scholar: 'RARE', arxiv: 'NEVER', reddit: 'OCCASIONAL', ytStudy: 'FREQUENT' },
  },
  {
    id: 10, alias: 'Scholar #10',
    field: 'Medicine', year: '3rd Year', yearNum: 3, weeklyHours: 50,
    outcomeGrade: 'A',
    avgDailyHours: 8.5, avgSessionMin: 90, sleep: 6.5,
    avgAttentionMin: 65, avgBreaks: 1.4, focusQualityPct: 88,
    apps: { obsidian: 1.5, vscode: 0, anki: 4.2, notion: 1.0, tiktok: 0.2, discord: 0.4, youtube: 0.6 },
    sites: { scholar: 'FREQUENT', arxiv: 'OCCASIONAL', reddit: 'RARE', ytStudy: 'OCCASIONAL' },
  },
  {
    id: 11, alias: 'Scholar #11',
    field: 'Philosophy', year: '2nd Year', yearNum: 2, weeklyHours: 20,
    outcomeGrade: 'C+',
    avgDailyHours: 3.0, avgSessionMin: 38, sleep: 8.5,
    avgAttentionMin: 30, avgBreaks: 3.5, focusQualityPct: 40,
    apps: { obsidian: 0.8, vscode: 0, anki: 0.4, notion: 1.2, tiktok: 1.8, discord: 2.0, youtube: 3.0 },
    sites: { scholar: 'OCCASIONAL', arxiv: 'NEVER', reddit: 'FREQUENT', ytStudy: 'OCCASIONAL' },
  },
  {
    id: 12, alias: 'Scholar #12',
    field: 'Data Science', year: '4th Year', yearNum: 4, weeklyHours: 40,
    outcomeGrade: 'A',
    avgDailyHours: 7.2, avgSessionMin: 85, sleep: 7.2,
    avgAttentionMin: 62, avgBreaks: 1.6, focusQualityPct: 85,
    apps: { obsidian: 1.0, vscode: 5.0, anki: 1.5, notion: 1.4, tiktok: 0.2, discord: 0.7, youtube: 1.2 },
    sites: { scholar: 'FREQUENT', arxiv: 'FREQUENT', reddit: 'RARE', ytStudy: 'FREQUENT' },
  },
]

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
  const [focusedPeer, setFocusedPeer] = useState(null)

  if (focusedPeer) {
    return <PeerDetail peer={focusedPeer} onBack={() => setFocusedPeer(null)} />
  }

  return (
    <div className="subpanel peer-panel">
      <div className="panel-title">❂ PEER BENCHMARK</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1.2rem' }}>
        Anonymised study profiles. Hover to spin · click to expand.
      </p>
      <div className="peer-grid">
        {PEERS.map(p => (
          <MiniPeerGraph key={p.id} peer={p} onFocus={setFocusedPeer} />
        ))}
      </div>
    </div>
  )
}
