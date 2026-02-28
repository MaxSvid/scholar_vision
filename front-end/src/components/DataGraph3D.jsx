import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './DataGraph3D.css'

// ─── GRAPH DEFINITION ───────────────────────────────────────────────────────
const NODE_DEFS = [
  // Center: outcome prediction
  { id: 'outcome',    label: 'PREDICTED OUTCOME', group: 'outcome',   radius: 0.48, color: '#c8ff00' },

  // Category layer
  { id: 'study',      label: 'STUDY TIME',         group: 'category',  radius: 0.30, color: '#d4af37' },
  { id: 'attention',  label: 'ATTENTION SPAN',      group: 'category',  radius: 0.30, color: '#d4af37' },
  { id: 'apps',       label: 'APP USAGE',           group: 'category',  radius: 0.30, color: '#d4af37' },
  { id: 'major',      label: 'MAJOR / FIELD',       group: 'category',  radius: 0.30, color: '#d4af37' },
  { id: 'websites',   label: 'WEBSITES',            group: 'category',  radius: 0.30, color: '#d4af37' },

  // Study leaves
  { id: 'avg-time',    label: 'AVG TIME: 5h/DAY',    group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'study' },
  { id: 'session-dur', label: 'SESSION: ~45 MIN',    group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'study' },
  { id: 'sleep',       label: 'SLEEP: 7h/NIGHT',     group: 'leaf-prod', radius: 0.14, color: '#44cc66', parent: 'study' },

  // Attention leaves
  { id: 'att-avg',    label: 'AVG SPAN: 40 MIN',    group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'attention' },
  { id: 'att-breaks', label: 'BREAKS: 2/DAY',       group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'attention' },
  { id: 'att-qual',   label: 'FOCUS QUALITY',        group: 'leaf-prod', radius: 0.13, color: '#44cc66', parent: 'attention' },

  // App leaves – productive
  { id: 'obsidian',   label: 'Obsidian',            group: 'leaf-prod', radius: 0.18, color: '#44cc66', parent: 'apps' },
  { id: 'vscode',     label: 'VS Code',             group: 'leaf-prod', radius: 0.18, color: '#44cc66', parent: 'apps' },
  { id: 'anki',       label: 'Anki',                group: 'leaf-prod', radius: 0.15, color: '#44cc66', parent: 'apps' },
  { id: 'ai-agents',  label: 'AI Agents',           group: 'leaf-prod', radius: 0.18, color: '#44cc66', parent: 'apps' },
  { id: 'notion',     label: 'Notion / Plabable',   group: 'leaf-prod', radius: 0.15, color: '#44cc66', parent: 'apps' },
  // App leaves – distracting
  { id: 'tiktok',    label: 'TikTok',               group: 'leaf-dist', radius: 0.17, color: '#cc3333', parent: 'apps' },
  { id: 'discord',   label: 'Discord',              group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'apps' },
  { id: 'youtube-a', label: 'YouTube',              group: 'leaf-neut', radius: 0.15, color: '#ccaa33', parent: 'apps' },

  // Major leaves
  { id: 'field',   label: 'FIELD OF STUDY',         group: 'leaf-blue', radius: 0.18, color: '#7f7fff', parent: 'major' },
  { id: 'year',    label: 'YEAR / LEVEL',           group: 'leaf-blue', radius: 0.16, color: '#7f7fff', parent: 'major' },
  { id: 'target',  label: 'WEEKLY TARGET',          group: 'leaf-blue', radius: 0.14, color: '#7f7fff', parent: 'major' },

  // Website leaves
  { id: 'scholar',    label: 'Google Scholar',      group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'websites' },
  { id: 'arxiv',      label: 'ArXiv',               group: 'leaf-prod', radius: 0.14, color: '#44cc66', parent: 'websites' },
  { id: 'reddit',     label: 'Reddit',              group: 'leaf-dist', radius: 0.15, color: '#cc3333', parent: 'websites' },
  { id: 'yt-study',   label: 'YouTube Study',       group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'websites' },
]

const EDGE_DEFS = [
  // Outcome → categories
  { from: 'outcome', to: 'study' },
  { from: 'outcome', to: 'attention' },
  { from: 'outcome', to: 'apps' },
  { from: 'outcome', to: 'major' },
  { from: 'outcome', to: 'websites' },
  // Study → leaves
  { from: 'study', to: 'avg-time' },
  { from: 'study', to: 'session-dur' },
  { from: 'study', to: 'sleep' },
  // Attention → leaves
  { from: 'attention', to: 'att-avg' },
  { from: 'attention', to: 'att-breaks' },
  { from: 'attention', to: 'att-qual' },
  // Apps → leaves
  { from: 'apps', to: 'obsidian' },
  { from: 'apps', to: 'vscode' },
  { from: 'apps', to: 'anki' },
  { from: 'apps', to: 'ai-agents' },
  { from: 'apps', to: 'notion' },
  { from: 'apps', to: 'tiktok' },
  { from: 'apps', to: 'discord' },
  { from: 'apps', to: 'youtube-a' },
  // Major → leaves
  { from: 'major', to: 'field' },
  { from: 'major', to: 'year' },
  { from: 'major', to: 'target' },
  // Websites → leaves
  { from: 'websites', to: 'scholar' },
  { from: 'websites', to: 'arxiv' },
  { from: 'websites', to: 'reddit' },
  { from: 'websites', to: 'yt-study' },
]

// Fibonacci sphere – evenly distributes n points on a unit sphere of radius r
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

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function DataGraph3D({ user }) {
  const mountRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, label: '', x: 0, y: 0 })

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Build node list, inject live user data ──────────────────
    const nodes = NODE_DEFS.map(n => {
      const node = { ...n }
      if (n.id === 'field'  && user?.fieldOfStudy) node.label = user.fieldOfStudy.toUpperCase()
      if (n.id === 'year'   && user?.yearOfStudy)  node.label = user.yearOfStudy.toUpperCase()
      if (n.id === 'target' && user?.weeklyHours)  node.label = `TARGET: ${user.weeklyHours}H/WK`
      return node
    })

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

    // ── Position nodes ──────────────────────────────────────────
    nodeMap['outcome'].pos = new THREE.Vector3(0, 0, 0)

    // Categories: Fibonacci sphere at r = 3.6
    const cats = nodes.filter(n => n.group === 'category')
    const catPos = fibSphere(cats.length, 3.6)
    cats.forEach((cat, i) => { cat.pos = catPos[i] })

    // Leaves: circle around parent
    const byParent = {}
    nodes.filter(n => n.parent).forEach(n => {
      byParent[n.parent] = byParent[n.parent] || []
      byParent[n.parent].push(n)
    })

    // Seeded offsets so positions are deterministic
    const OFFSETS = [0.0, 0.3, -0.25, 0.15, -0.1, 0.4, -0.35, 0.2]
    Object.entries(byParent).forEach(([pid, kids]) => {
      const parent = nodeMap[pid]
      if (!parent?.pos) return
      kids.forEach((kid, i) => {
        const angle  = (i / kids.length) * Math.PI * 2
        const r      = 1.65
        const yOff   = OFFSETS[i % OFFSETS.length]
        kid.pos = new THREE.Vector3(
          parent.pos.x + Math.cos(angle) * r,
          parent.pos.y + yOff,
          parent.pos.z + Math.sin(angle) * r,
        )
      })
    })

    // ── Scene ───────────────────────────────────────────────────
    const scene = new THREE.Scene()

    const W = mount.clientWidth
    const H = mount.clientHeight
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100)
    camera.position.set(0, 2.5, 13)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping    = true
    controls.dampingFactor    = 0.06
    controls.autoRotate       = true
    controls.autoRotateSpeed  = 0.35
    controls.minDistance      = 5
    controls.maxDistance      = 22

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const pLight = new THREE.PointLight(0xffffff, 1.8, 35)
    pLight.position.set(5, 7, 5)
    scene.add(pLight)

    // ── Particle background (starfield) ────────────────────────
    const starGeo = new THREE.BufferGeometry()
    const starCount = 350
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 60
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x224422, size: 0.06 })))

    // ── Node meshes ─────────────────────────────────────────────
    const meshes = []
    nodes.forEach(node => {
      if (!node.pos) return
      const color = new THREE.Color(node.color)
      const mat   = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: node.group === 'outcome' ? 0.55 : 0.22,
        shininess: 90,
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(node.radius, 22, 22), mat)
      mesh.position.copy(node.pos)
      mesh.userData = { id: node.id, label: node.label, group: node.group }
      scene.add(mesh)
      meshes.push(mesh)

      // Soft halo for outcome + category nodes
      if (node.group === 'outcome' || node.group === 'category') {
        const haloMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: node.group === 'outcome' ? 0.07 : 0.04,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide,
        })
        const halo = new THREE.Mesh(new THREE.SphereGeometry(node.radius * 2.5, 16, 16), haloMat)
        halo.position.copy(node.pos)
        scene.add(halo)
      }
    })

    // ── Edge lines ──────────────────────────────────────────────
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x335533, transparent: true, opacity: 0.45 })
    EDGE_DEFS.forEach(({ from, to }) => {
      const a = nodeMap[from], b = nodeMap[to]
      if (!a?.pos || !b?.pos) return
      const geo = new THREE.BufferGeometry().setFromPoints([a.pos.clone(), b.pos.clone()])
      scene.add(new THREE.Line(geo, edgeMat))
    })

    // ── Hover raycasting ────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse     = new THREE.Vector2()
    let hoveredId   = null

    const BASE_EMISSIVE = { outcome: 0.55, category: 0.22, default: 0.22 }

    const onMouseMove = e => {
      const rect = mount.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      // Reset previous hover
      if (hoveredId !== null) {
        const prev = meshes.find(m => m.userData.id === hoveredId)
        if (prev) {
          const base = BASE_EMISSIVE[prev.userData.group] ?? BASE_EMISSIVE.default
          prev.material.emissiveIntensity = base
          prev.scale.setScalar(1)
        }
      }

      const hits = raycaster.intersectObjects(meshes)
      if (hits.length > 0) {
        const mesh = hits[0].object
        mesh.material.emissiveIntensity = 0.9
        mesh.scale.setScalar(1.35)
        hoveredId = mesh.userData.id
        setTooltip({ visible: true, label: mesh.userData.label, x: e.clientX - rect.left, y: e.clientY - rect.top })
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
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    // ── Animation loop ──────────────────────────────────────────
    const outcomeMesh = meshes.find(m => m.userData.id === 'outcome')
    let frame, t = 0

    const animate = () => {
      frame = requestAnimationFrame(animate)
      t += 0.012

      // Pulse outcome node
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
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [user])

  return (
    <div className="subpanel graph3d-panel">
      <div className="panel-title">&gt; 3D DATA INFLUENCE GRAPH</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '0.6rem' }}>
        All data points feeding your academic outcome prediction, visualised as a 3D knowledge graph.
        Hover nodes for details · drag to orbit · scroll to zoom.
      </p>

      {/* Legend */}
      <div className="graph3d-legend">
        <span><span className="g3d-dot" style={{ background: '#c8ff00' }} />OUTCOME</span>
        <span><span className="g3d-dot" style={{ background: '#d4af37' }} />CATEGORY</span>
        <span><span className="g3d-dot" style={{ background: '#44cc66' }} />PRODUCTIVE</span>
        <span><span className="g3d-dot" style={{ background: '#cc3333' }} />DISTRACTING</span>
        <span><span className="g3d-dot" style={{ background: '#ccaa33' }} />NEUTRAL</span>
        <span><span className="g3d-dot" style={{ background: '#7f7fff' }} />ACADEMIC</span>
      </div>

      <div className="graph3d-canvas" ref={mountRef}>
        {tooltip.visible && (
          <div
            className="graph3d-tooltip"
            style={{ left: tooltip.x + 14, top: tooltip.y - 32 }}
          >
            {tooltip.label}
          </div>
        )}
      </div>
    </div>
  )
}
