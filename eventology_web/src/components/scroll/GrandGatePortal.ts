import * as THREE from 'three'

export interface GrandGateController {
  gateGroup: THREE.Group
  setGateOpen: (progress: number) => void
  setOpacity: (opacity: number) => void
  updateAnimation: (time: number) => void
  dispose: () => void
}

/**
 * Creates the Grand 3D Palace Gateway that the camera dives through.
 * Positioned in front of the card along the Z-axis.
 */
export function createGrandGatePortal(scene: THREE.Scene): GrandGateController {
  const gateGroup = new THREE.Group()
  gateGroup.position.set(0, 0, -1.2) // Positioned just beyond the card plane
  gateGroup.visible = false

  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = []

  // Create ornate stone/wood material for pillars
  const pillarCanvas = document.createElement('canvas')
  pillarCanvas.width = 512
  pillarCanvas.height = 1024
  const pCtx = pillarCanvas.getContext('2d')!
  pCtx.fillStyle = '#2A1A0F'
  pCtx.fillRect(0, 0, 512, 1024)
  pCtx.fillStyle = 'rgba(212, 175, 55, 0.15)'
  for (let i = 0; i < 40; i++) {
    pCtx.fillRect(40, i * 25, 432, 2)
  }
  const pillarTex = new THREE.CanvasTexture(pillarCanvas)
  disposables.push(pillarTex)

  const stoneMat = new THREE.MeshStandardMaterial({
    map: pillarTex,
    color: new THREE.Color('#3A2414'),
    roughness: 0.7,
    metalness: 0.25,
    transparent: true,
    opacity: 0,
  })
  disposables.push(stoneMat)

  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#D4AF37'),
    roughness: 0.3,
    metalness: 0.85,
    transparent: true,
    opacity: 0,
  })
  disposables.push(goldMat)

  // 1. Arch Pillars
  const pillarW = 0.55
  const pillarH = 4.2
  const pillarD = 0.45

  const pillarGeo = new THREE.BoxGeometry(pillarW, pillarH, pillarD)
  disposables.push(pillarGeo)

  const leftPillar = new THREE.Mesh(pillarGeo, stoneMat)
  leftPillar.position.set(-2.0, 0.3, 0)
  gateGroup.add(leftPillar)

  const rightPillar = new THREE.Mesh(pillarGeo, stoneMat)
  rightPillar.position.set(2.0, 0.3, 0)
  gateGroup.add(rightPillar)

  // Pillar gold capitals
  const capGeo = new THREE.BoxGeometry(0.7, 0.25, 0.55)
  disposables.push(capGeo)

  const leftCap = new THREE.Mesh(capGeo, goldMat)
  leftCap.position.set(-2.0, 2.4, 0)
  gateGroup.add(leftCap)

  const rightCap = new THREE.Mesh(capGeo, goldMat)
  rightCap.position.set(2.0, 2.4, 0)
  gateGroup.add(rightCap)

  // 2. Arch Top Header Beam
  const beamGeo = new THREE.BoxGeometry(4.7, 0.5, 0.5)
  disposables.push(beamGeo)
  const topBeam = new THREE.Mesh(beamGeo, stoneMat)
  topBeam.position.set(0, 2.65, 0)
  gateGroup.add(topBeam)

  // Ornate Gold Crest on Arch Center
  const crestGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 32)
  disposables.push(crestGeo)
  const crest = new THREE.Mesh(crestGeo, goldMat)
  crest.rotation.x = Math.PI / 2
  crest.position.set(0, 3.1, 0)
  gateGroup.add(crest)

  // 3. Palace Doors (Left & Right) with hinge groups
  const doorW = 1.65
  const doorH = 3.9
  const doorD = 0.08
  const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorD)
  disposables.push(doorGeo)

  // Ornate door material
  const doorCanvas = document.createElement('canvas')
  doorCanvas.width = 512
  doorCanvas.height = 1024
  const dCtx = doorCanvas.getContext('2d')!
  dCtx.fillStyle = '#1F1208'
  dCtx.fillRect(0, 0, 512, 1024)
  // Carved wooden panels and brass studs
  dCtx.strokeStyle = '#C59B27'
  dCtx.lineWidth = 6
  dCtx.strokeRect(30, 40, 452, 440)
  dCtx.strokeRect(30, 520, 452, 450)
  dCtx.fillStyle = '#D4AF37'
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      dCtx.beginPath()
      dCtx.arc(80 + c * 115, 80 + r * 115, 6, 0, Math.PI * 2)
      dCtx.fill()
    }
  }
  const doorTex = new THREE.CanvasTexture(doorCanvas)
  disposables.push(doorTex)

  const doorMat = new THREE.MeshStandardMaterial({
    map: doorTex,
    roughness: 0.5,
    metalness: 0.4,
    transparent: true,
    opacity: 0,
  })
  disposables.push(doorMat)

  // Left Door Hinge (Hinged at x = -1.75)
  const leftDoorHinge = new THREE.Group()
  leftDoorHinge.position.set(-1.72, 0.25, 0)
  const leftDoorMesh = new THREE.Mesh(doorGeo, doorMat)
  leftDoorMesh.position.set(doorW / 2, 0, 0) // Door extends inward toward center
  leftDoorHinge.add(leftDoorMesh)
  gateGroup.add(leftDoorHinge)

  // Right Door Hinge (Hinged at x = +1.75)
  const rightDoorHinge = new THREE.Group()
  rightDoorHinge.position.set(1.72, 0.25, 0)
  const rightDoorMesh = new THREE.Mesh(doorGeo, doorMat)
  rightDoorMesh.position.set(-doorW / 2, 0, 0) // Door extends inward toward center
  rightDoorHinge.add(rightDoorMesh)
  gateGroup.add(rightDoorHinge)

  // 4. Floral Toran Garland across arch
  const toranCanvas = document.createElement('canvas')
  toranCanvas.width = 1024
  toranCanvas.height = 256
  const tCtx = toranCanvas.getContext('2d')!
  tCtx.clearRect(0, 0, 1024, 256)
  // Scalloped gold and marigold floral garland
  tCtx.strokeStyle = '#D4AF37'
  tCtx.lineWidth = 8
  tCtx.beginPath()
  tCtx.moveTo(20, 40)
  tCtx.quadraticCurveTo(256, 180, 512, 60)
  tCtx.quadraticCurveTo(768, 180, 1004, 40)
  tCtx.stroke()

  const toranTex = new THREE.CanvasTexture(toranCanvas)
  disposables.push(toranTex)

  const toranMat = new THREE.MeshBasicMaterial({
    map: toranTex,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  })
  disposables.push(toranMat)

  const toranGeo = new THREE.PlaneGeometry(4.6, 1.1)
  disposables.push(toranGeo)
  const toranMesh = new THREE.Mesh(toranGeo, toranMat)
  toranMesh.position.set(0, 2.5, 0.28)
  gateGroup.add(toranMesh)

  // 5. Volumetric Light Shafts (God Rays Particle Cone)
  const rayCount = 450
  const rayGeo = new THREE.BufferGeometry()
  const rayPositions = new Float32Array(rayCount * 3)
  for (let i = 0; i < rayCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * 1.8
    const y = Math.random() * 3.5 - 1.0
    const spread = (3.5 - y) * 0.4
    rayPositions[i * 3 + 0] = Math.cos(angle) * (radius + spread)
    rayPositions[i * 3 + 1] = y
    rayPositions[i * 3 + 2] = Math.sin(angle) * (radius + spread) - 0.2
  }
  rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3))
  disposables.push(rayGeo)

  const rayMat = new THREE.PointsMaterial({
    color: new THREE.Color('#FFDF78'),
    size: 0.035,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  disposables.push(rayMat)

  const godRays = new THREE.Points(rayGeo, rayMat)
  gateGroup.add(godRays)

  scene.add(gateGroup)

  const allMaterials = [stoneMat, goldMat, doorMat, toranMat, rayMat]

  return {
    gateGroup,
    setGateOpen: (progress: number) => {
      // progress 0 = closed, progress 1 = fully open (90 degrees outward)
      const clamped = Math.max(0, Math.min(1, progress))
      // Left door swings backward/outward
      leftDoorHinge.rotation.y = -clamped * (Math.PI / 1.9)
      // Right door swings backward/outward
      rightDoorHinge.rotation.y = clamped * (Math.PI / 1.9)
    },
    setOpacity: (opacity: number) => {
      const clamped = Math.max(0, Math.min(1, opacity))
      allMaterials.forEach((m) => {
        m.opacity = clamped
      })
      rayMat.opacity = clamped * 0.45
      gateGroup.visible = clamped > 0.01
    },
    updateAnimation: (time: number) => {
      // Gentle ray pulse
      rayMat.opacity = Math.min(0.5, rayMat.opacity * (0.85 + Math.sin(time * 0.002) * 0.15))
    },
    dispose: () => {
      scene.remove(gateGroup)
      disposables.forEach((item) => item.dispose())
    },
  }
}
