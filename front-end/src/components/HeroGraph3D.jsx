import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './HeroGraph3D.css'

// ─── DEMO GRAPH DATA (landing page – no user account needed) ────────────────
const NODES = [
  { id: 'outcome',    label: 'PREDICTED OUTCOME',   group: 'outcome',   radius: 0.46, color: '#c8ff00' },

  { id: 'study',      label: 'STUDY TIME',           group: 'category',  radius: 0.28, color: '#d4af37' },
  { id: 'attention',  label: 'ATTENTION SPAN',        group: 'category',  radius: 0.28, color: '#d4af37' },
  { id: 'apps',       label: 'APP USAGE',             group: 'category',  radius: 0.28, color: '#d4af37' },
  { id: 'major',      label: 'MAJOR / FIELD',         group: 'category',  radius: 0.28, color: '#d4af37' },
  { id: 'websites',   label: 'WEBSITES',              group: 'category',  radius: 0.28, color: '#d4af37' },

  // Study
  { id: 'avg-time',    label: 'AVG TIME: 5h/DAY',    group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'study' },
  { id: 'session-dur', label: 'SESSION: ~45 MIN',    group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'study' },
  { id: 'sleep',       label: 'SLEEP: 7h/NIGHT',     group: 'leaf-prod', radius: 0.14, color: '#44cc66', parent: 'study' },

  // Attention
  { id: 'att-avg',    label: 'AVG SPAN: 40 MIN',     group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'attention' },
  { id: 'att-breaks', label: 'BREAKS: 2/DAY',        group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'attention' },
  { id: 'att-qual',   label: 'FOCUS QUALITY',         group: 'leaf-prod', radius: 0.13, color: '#44cc66', parent: 'attention' },

  // Apps – productive
  { id: 'obsidian',  label: 'Obsidian',               group: 'leaf-prod', radius: 0.17, color: '#44cc66', parent: 'apps' },
  { id: 'vscode',    label: 'VS Code',                group: 'leaf-prod', radius: 0.18, color: '#44cc66', parent: 'apps' },
  { id: 'anki',      label: 'Anki',                   group: 'leaf-prod', radius: 0.15, color: '#44cc66', parent: 'apps' },
  { id: 'ai-agents', label: 'AI Agents',              group: 'leaf-prod', radius: 0.17, color: '#44cc66', parent: 'apps' },
  { id: 'notion',    label: 'Notion / Plabable',      group: 'leaf-prod', radius: 0.15, color: '#44cc66', parent: 'apps' },
  // Apps – distracting / neutral
  { id: 'tiktok',   label: 'TikTok',                  group: 'leaf-dist', radius: 0.17, color: '#cc3333', parent: 'apps' },
  { id: 'discord',  label: 'Discord',                 group: 'leaf-neut', radius: 0.14, color: '#ccaa33', parent: 'apps' },
  { id: 'youtube',  label: 'YouTube',                 group: 'leaf-neut', radius: 0.15, color: '#ccaa33', parent: 'apps' },

  // Major
  { id: 'field',   label: 'COMPUTER SCIENCE',         group: 'leaf-blue', radius: 0.18, color: '#7f7fff', parent: 'major' },
  { id: 'year',    label: 'YEAR 2',                   group: 'leaf-blue', radius: 0.15, color: '#7f7fff', parent: 'major' },
  { id: 'target',  label: 'TARGET: 20H/WK',           group: 'leaf-blue', radius: 0.14, color: '#7f7fff', parent: 'major' },

  // Websites
  { id: 'scholar',  label: 'Google Scholar',          group: 'leaf-prod', radius: 0.16, color: '#44cc66', parent: 'websites' },
  { id: 'arxiv',    label: 'ArXiv',                   group: 'leaf-prod', radius: 0.14, color: '#44cc66', parent: 'websites' },
  { id: 'reddit',   label: 'Reddit',                  group: 'leaf-dist', radius: 0.15, color: '#cc3333', parent: 'websites' },
  { id: 'yt-study', label: 'YouTube Study',           group: 'leaf-neut', radius: 0.13, color: '#ccaa33', parent: 'websites' },
]

const EDGES = [
  { from: 'outcome', to: 'study' },
  { from: 'outcome', to: 'attention' },
  { from: 'outcome', to: 'apps' },
  { from: 'outcome', to: 'major' },
  { from: 'outcome', to: 'websites' },
  { from: 'study',     to: 'avg-time' },
  { from: 'study',     to: 'session-dur' },
  { from: 'study',     to: 'sleep' },
  { from: 'attention', to: 'att-avg' },
  { from: 'attention', to: 'att-breaks' },
  { from: 'attention', to: 'att-qual' },
  { from: 'apps',      to: 'obsidian' },
  { from: 'apps',      to: 'vscode' },
  { from: 'apps',      to: 'anki' },
  { from: 'apps',      to: 'ai-agents' },
  { from: 'apps',      to: 'notion' },
  { from: 'apps',      to: 'tiktok' },
  { from: 'apps',      to: 'discord' },
  { from: 'apps',      to: 'youtube' },
  { from: 'major',     to: 'field' },
  { from: 'major',     to: 'year' },
  { from: 'major',     to: 'target' },
  { from: 'websites',  to: 'scholar' },
  { from: 'websites',  to: 'arxiv' },
  { from: 'websites',  to: 'reddit' },
  { from: 'websites',  to: 'yt-study' },
]

function fibSphere(n, r) {
  const pts   = []
  const phi   = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y   = 1 - (i / (n - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const t   = phi * i
    pts.push(new THREE.Vector3(Math.cos(t) * rad * r, y * r, Math.sin(t) * rad * r))
  }
  return pts
}

const Y_OFFSETS = [0.0, 0.35, -0.28, 0.18, -0.12, 0.42, -0.38, 0.22]

export default function HeroGraph3D() {
  const mountRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, label: '', x: 0, y: 0 })

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Position nodes ──────────────────────────────────────────
    const nodes   = NODES.map(n => ({ ...n }))
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

    nodeMap['outcome'].pos = new THREE.Vector3(0, 0, 0)

    const cats    = nodes.filter(n => n.group === 'category')
    const catPos  = fibSphere(cats.length, 3.4)
    cats.forEach((c, i) => { c.pos = catPos[i] })

    const byParent = {}
    nodes.filter(n => n.parent).forEach(n => {
      byParent[n.parent] = byParent[n.parent] || []
      byParent[n.parent].push(n)
    })
    Object.entries(byParent).forEach(([pid, kids]) => {
      const parent = nodeMap[pid]
      if (!parent?.pos) return
      kids.forEach((kid, i) => {
        const angle = (i / kids.length) * Math.PI * 2
        kid.pos = new THREE.Vector3(
          parent.pos.x + Math.cos(angle) * 1.6,
          parent.pos.y + Y_OFFSETS[i % Y_OFFSETS.length],
          parent.pos.z + Math.sin(angle) * 1.6,
        )
      })
    })

    // ── Renderer & scene ────────────────────────────────────────
    const scene    = new THREE.Scene()
    const W = mount.clientWidth, H = mount.clientHeight
    const camera   = new THREE.PerspectiveCamera(52, W / H, 0.1, 100)
    camera.position.set(0, 1.5, 12)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const controls          = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping  = true
    controls.dampingFactor  = 0.06
    controls.autoRotate     = true
    controls.autoRotateSpeed = 0.55
    controls.minDistance    = 5
    controls.maxDistance    = 22
    controls.enablePan      = false

    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const pLight = new THREE.PointLight(0xffffff, 2, 35)
    pLight.position.set(4, 6, 4)
    scene.add(pLight)

    // Starfield
    const starArr = new Float32Array(500 * 3)
    for (let i = 0; i < starArr.length; i++) starArr[i] = (Math.random() - 0.5) * 70
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starArr, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x1a331a, size: 0.07 })))

    // ── Meshes ──────────────────────────────────────────────────
    const meshes = []
    nodes.forEach(node => {
      if (!node.pos) return
      const color = new THREE.Color(node.color)
      const mat   = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: node.group === 'outcome' ? 0.55 : 0.2,
        shininess: 90,
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(node.radius, 22, 22), mat)
      mesh.position.copy(node.pos)
      mesh.userData = { id: node.id, label: node.label, group: node.group }
      scene.add(mesh)
      meshes.push(mesh)

      if (node.group === 'outcome' || node.group === 'category') {
        const haloMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: node.group === 'outcome' ? 0.08 : 0.04,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide,
        })
        const halo = new THREE.Mesh(new THREE.SphereGeometry(node.radius * 2.6, 16, 16), haloMat)
        halo.position.copy(node.pos)
        scene.add(halo)
      }
    })

    // ── Edges ───────────────────────────────────────────────────
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x2a4a2a, transparent: true, opacity: 0.5 })
    EDGES.forEach(({ from, to }) => {
      const a = nodeMap[from], b = nodeMap[to]
      if (!a?.pos || !b?.pos) return
      const geo = new THREE.BufferGeometry().setFromPoints([a.pos.clone(), b.pos.clone()])
      scene.add(new THREE.Line(geo, edgeMat))
    })

    // ── Hover ───────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse     = new THREE.Vector2()
    let hoveredId   = null

    const onMouseMove = e => {
      const rect = mount.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      if (hoveredId !== null) {
        const prev = meshes.find(m => m.userData.id === hoveredId)
        if (prev) { prev.material.emissiveIntensity = prev.userData.group === 'outcome' ? 0.55 : 0.2; prev.scale.setScalar(1) }
      }

      const hits = raycaster.intersectObjects(meshes)
      if (hits.length > 0) {
        const mesh = hits[0].object
        mesh.material.emissiveIntensity = 0.95
        mesh.scale.setScalar(1.35)
        hoveredId = mesh.userData.id
        setTooltip({ visible: true, label: mesh.userData.label, x: e.clientX - rect.left, y: e.clientY - rect.top })
        mount.style.cursor = 'pointer'
      } else {
        hoveredId = null
        setTooltip(t => ({ ...t, visible: false }))
        mount.style.cursor = 'default'
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

    // ── Animate ─────────────────────────────────────────────────
    const outcomeMesh = meshes.find(m => m.userData.id === 'outcome')
    let frame, t = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      t += 0.013
      if (outcomeMesh && hoveredId !== 'outcome') {
        outcomeMesh.material.emissiveIntensity = 0.45 + Math.sin(t * 1.8) * 0.22
        outcomeMesh.scale.setScalar(1 + Math.sin(t * 1.4) * 0.05)
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
  }, [])

  return (
    <div className="hero-graph-wrap" ref={mountRef}>
      {tooltip.visible && (
        <div className="hero-graph-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 32 }}>
          {tooltip.label}
        </div>
      )}
    </div>
  )
}
