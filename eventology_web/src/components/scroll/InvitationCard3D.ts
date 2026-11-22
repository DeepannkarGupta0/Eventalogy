import * as THREE from 'three'

export interface InvitationCardController {
  cardGroup: THREE.Group
  rightGroup: THREE.Group
  setHingeAngle: (angleRad: number) => void
  updateIdle: (time: number, mouseParallax: { x: number; y: number }, isIdle: boolean) => void
  setOpacity: (opacity: number) => void
  updateLanternFlicker: (time: number) => void
  dispose: () => void
}

/**
 * Creates high-resolution procedural canvas textures for the luxury invitation card.
 * Zero external image dependencies, immediate render, zero CORS issues.
 */
function createFrontCoverTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1460
  const ctx = canvas.getContext('2d')!

  // Warm ivory fine textured background
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1460)
  bgGrad.addColorStop(0, '#FAF6EE')
  bgGrad.addColorStop(0.5, '#F5EFE0')
  bgGrad.addColorStop(1, '#EDE4D1')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 1024, 1460)

  // Subtle paper grain noise
  ctx.fillStyle = 'rgba(180, 150, 100, 0.04)'
  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * 1024
    const y = Math.random() * 1460
    ctx.fillRect(x, y, 1.5, 1.5)
  }

  // Outer gold foil double filigree border
  ctx.strokeStyle = '#C59B27'
  ctx.lineWidth = 4
  ctx.strokeRect(48, 48, 928, 1364)

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(62, 62, 900, 1336)

  // Corner ornaments
  const corners = [
    [70, 70],
    [954, 70],
    [70, 1390],
    [954, 1390],
  ]
  ctx.fillStyle = '#C59B27'
  ctx.font = '28px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  corners.forEach(([cx, cy]) => {
    ctx.fillText('❖', cx, cy)
  })

  // Center crest / emblem
  const centerY = 580
  ctx.beginPath()
  ctx.arc(512, centerY, 110, 0, Math.PI * 2)
  ctx.strokeStyle = '#D4AF37'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(512, centerY, 98, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(197, 155, 39, 0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Monogram inside circle
  ctx.fillStyle = '#B8860B'
  ctx.font = '600 76px serif'
  ctx.fillText('E', 512, centerY + 8)

  // Brand Name
  ctx.fillStyle = '#1A140B'
  ctx.font = '600 52px serif'
  ctx.letterSpacing = '6px'
  ctx.fillText('EVENTALOGY', 512, 800)

  ctx.fillStyle = '#C59B27'
  ctx.font = '500 24px sans-serif'
  ctx.letterSpacing = '10px'
  ctx.fillText('INTERNATIONAL', 512, 855)

  // Gold separator
  ctx.font = '22px serif'
  ctx.fillText('✦  ✦  ✦', 512, 920)

  // Subtitle
  ctx.fillStyle = '#6B5435'
  ctx.font = '300 26px sans-serif'
  ctx.letterSpacing = '3px'
  ctx.fillText('AN INVITATION TO SPLENDOR', 512, 980)

  ctx.fillStyle = 'rgba(107, 84, 53, 0.7)'
  ctx.font = 'italic 20px serif'
  ctx.fillText('Exclusive Celebrations & Grand Gatherings', 512, 1025)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return texture
}

function createLeftPageTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1460
  const ctx = canvas.getContext('2d')!

  // Soft warm parchment
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1460)
  bgGrad.addColorStop(0, '#FDFBF6')
  bgGrad.addColorStop(1, '#F3ECE0')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 1024, 1460)

  // Inner border
  ctx.strokeStyle = 'rgba(197, 155, 39, 0.45)'
  ctx.lineWidth = 2
  ctx.strokeRect(50, 50, 924, 1360)

  // Invitation Calligraphy
  ctx.textAlign = 'center'

  ctx.fillStyle = '#B8860B'
  ctx.font = 'italic 400 48px serif'
  ctx.fillText('Together with Honour,', 512, 230)

  ctx.fillStyle = '#1C150C'
  ctx.font = '600 64px serif'
  ctx.fillText('You Are Cordially Invited', 512, 330)

  ctx.fillStyle = '#C59B27'
  ctx.font = '24px serif'
  ctx.fillText('✦  ❖  ✦', 512, 400)

  ctx.fillStyle = '#4A3B2C'
  ctx.font = '300 30px sans-serif'
  ctx.fillText('To enter a sanctuary of curated moments,', 512, 500)
  ctx.fillText('where celebrations become legends,', 512, 555)
  ctx.fillText('and memories are woven with timeless elegance.', 512, 610)

  // Event Categories
  ctx.strokeStyle = 'rgba(197, 155, 39, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(250, 720)
  ctx.lineTo(774, 720)
  ctx.stroke()

  ctx.fillStyle = '#9C782F'
  ctx.font = '500 22px sans-serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('WEDDINGS  •  ROYAL GALAS  •  CONCERTS', 512, 790)
  ctx.fillText('GLOBAL SUMMITS  •  CURATED RETREATS', 512, 840)

  ctx.beginPath()
  ctx.moveTo(250, 910)
  ctx.lineTo(774, 910)
  ctx.stroke()

  // Royal seal / stamp at bottom
  ctx.fillStyle = '#B8860B'
  ctx.font = 'italic 24px serif'
  ctx.fillText('Step through the gateway to experience it live.', 512, 1060)

  ctx.fillStyle = '#1C150C'
  ctx.font = '600 32px serif'
  ctx.fillText('Eventalogy International Concierge', 512, 1220)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return texture
}

function createRightPageTexture(): { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1460
  const ctx = canvas.getContext('2d')!

  // Render base illustration: Grand Palace Gateway
  renderGateIllustration(ctx, 1024, 1460, 1.0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  return { texture, canvas, ctx }
}

function renderGateIllustration(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lanternBrightness: number
) {
  // Deep twilight/golden palace courtyard atmosphere
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h)
  skyGrad.addColorStop(0, '#1E140A')
  skyGrad.addColorStop(0.5, '#3D2812')
  skyGrad.addColorStop(1, '#5E3D19')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, w, h)

  // Floating star/bokeh particles
  ctx.fillStyle = 'rgba(255, 220, 130, 0.4)'
  const dots = [
    [120, 150, 3], [300, 110, 2], [800, 180, 4], [720, 90, 2.5],
    [200, 320, 2], [850, 310, 3], [480, 140, 3.5], [620, 240, 2]
  ]
  dots.forEach(([x, y, r]) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  })

  // Grand Palace Arch Pillars (Left and Right)
  const pillarW = 120
  const archTop = 400
  const pillarGrad = ctx.createLinearGradient(0, 0, w, 0)
  pillarGrad.addColorStop(0, '#2A1B0E')
  pillarGrad.addColorStop(0.5, '#4F351B')
  pillarGrad.addColorStop(1, '#2A1B0E')

  ctx.fillStyle = pillarGrad
  // Left Pillar
  ctx.fillRect(160, archTop, pillarW, h - archTop)
  // Right Pillar
  ctx.fillRect(w - 160 - pillarW, archTop, pillarW, h - archTop)

  // Arch curve connecting pillars
  ctx.beginPath()
  ctx.moveTo(160, archTop)
  ctx.bezierCurveTo(160, 180, w - 160, 180, w - 160, archTop)
  ctx.lineWidth = 70
  ctx.strokeStyle = '#382513'
  ctx.stroke()

  // Gold Trim on Arch
  ctx.lineWidth = 8
  ctx.strokeStyle = '#D4AF37'
  ctx.stroke()

  // Floral Toran (garland) hanging beneath the arch
  ctx.lineWidth = 14
  ctx.strokeStyle = '#B8860B'
  ctx.beginPath()
  ctx.moveTo(170, archTop + 30)
  ctx.quadraticCurveTo(340, archTop + 140, 512, archTop + 60)
  ctx.quadraticCurveTo(680, archTop + 140, w - 170, archTop + 30)
  ctx.stroke()

  // Floral tassels
  const tassels = [260, 380, 512, 644, 764]
  tassels.forEach((tx) => {
    ctx.fillStyle = '#E69C24'
    ctx.beginPath()
    ctx.arc(tx, archTop + 90, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#F5D061'
    ctx.beginPath()
    ctx.arc(tx, archTop + 90, 6, 0, Math.PI * 2)
    ctx.fill()
  })

  // Gates (Left & Right doors closed inside arch)
  const doorTop = archTop + 60
  const doorH = h - doorTop
  const doorW = (w - 320 - pillarW * 2) / 2

  // Left Door
  ctx.fillStyle = '#22150A'
  ctx.fillRect(160 + pillarW, doorTop, doorW, doorH)
  // Right Door
  ctx.fillStyle = '#1D1208'
  ctx.fillRect(160 + pillarW + doorW + 4, doorTop, doorW, doorH)

  // Brass Door Knocker & Carvings
  ctx.strokeStyle = '#C59B27'
  ctx.lineWidth = 4
  ctx.strokeRect(160 + pillarW + 20, doorTop + 40, doorW - 40, doorH - 80)
  ctx.strokeRect(160 + pillarW + doorW + 24, doorTop + 40, doorW - 40, doorH - 80)

  // Palace Lanterns (Glowing warm light)
  const lanternY = archTop + 120
  const glowAlpha = Math.max(0.3, Math.min(1.0, lanternBrightness))

  const drawLantern = (lx: number) => {
    // Glow radial
    const radial = ctx.createRadialGradient(lx, lanternY, 5, lx, lanternY, 90)
    radial.addColorStop(0, `rgba(255, 220, 100, ${0.9 * glowAlpha})`)
    radial.addColorStop(0.4, `rgba(240, 160, 40, ${0.5 * glowAlpha})`)
    radial.addColorStop(1, 'rgba(240, 160, 40, 0)')
    ctx.fillStyle = radial
    ctx.beginPath()
    ctx.arc(lx, lanternY, 90, 0, Math.PI * 2)
    ctx.fill()

    // Lantern cage
    ctx.strokeStyle = '#C59B27'
    ctx.lineWidth = 4
    ctx.strokeRect(lx - 20, lanternY - 30, 40, 60)
    ctx.fillStyle = `rgba(255, 245, 180, ${glowAlpha})`
    ctx.fillRect(lx - 16, lanternY - 26, 32, 52)
  }

  drawLantern(220)
  drawLantern(w - 220)

  // Call to Action Text on Right Page
  ctx.textAlign = 'center'
  ctx.fillStyle = '#F5E6CC'
  ctx.font = '600 36px serif'
  ctx.fillText('THE GRAND GATEWAY', w / 2, h - 220)

  ctx.fillStyle = '#E5C07B'
  ctx.font = '300 24px sans-serif'
  ctx.letterSpacing = '2px'
  ctx.fillText('Scroll to step into the celebration', w / 2, h - 160)

  ctx.font = '30px serif'
  ctx.fillStyle = '#D4AF37'
  ctx.fillText('↓', w / 2, h - 100)
}

export function createInvitationCard(scene: THREE.Scene): InvitationCardController {
  const CARD_W = 1.35
  const CARD_H = 1.95
  const CARD_D = 0.016

  const frontCoverTex = createFrontCoverTexture()
  const leftPageTex = createLeftPageTexture()
  const rightPageData = createRightPageTexture()

  // Materials
  const goldEdgeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#D4AF37'),
    metalness: 0.85,
    roughness: 0.25,
    transparent: true,
    opacity: 1.0,
  })

  const coverMat = new THREE.MeshStandardMaterial({
    map: frontCoverTex,
    roughness: 0.75,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  })

  const leftInnerMat = new THREE.MeshStandardMaterial({
    map: leftPageTex,
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    opacity: 1.0,
  })

  const rightInnerMat = new THREE.MeshStandardMaterial({
    map: rightPageData.texture,
    roughness: 0.8,
    metalness: 0.05,
    transparent: true,
    opacity: 1.0,
  })

  // Back of left panel (outer back cover)
  const backCoverMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FAF6EE'),
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 1.0,
  })

  // Left Panel: BoxGeometry face materials
  // 0: +X, 1: -X, 2: +Y, 3: -Y, 4: +Z (inner spread), 5: -Z (back of card)
  const leftPanelMats = [
    goldEdgeMat, // +X spine edge
    goldEdgeMat, // -X outer left edge
    goldEdgeMat, // +Y top edge
    goldEdgeMat, // -Y bottom edge
    leftInnerMat, // +Z (inner page facing camera when open)
    backCoverMat, // -Z (outer back cover)
  ]

  const leftGeo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D)
  const leftPanel = new THREE.Mesh(leftGeo, leftPanelMats)
  leftPanel.position.set(-CARD_W / 2, 0, 0)

  // Right Panel: Hinged at the spine (x=0)
  const rightGroup = new THREE.Group()
  rightGroup.position.set(0, 0, 0)

  // When closed (hinge=0), right panel is folded over left panel.
  // When opened to -160deg, +Z points towards camera.
  // 4: +Z (inner right page with Grand Gate illustration), 5: -Z (front cover seen when closed)
  const rightPanelMats = [
    goldEdgeMat, // +X outer right edge
    goldEdgeMat, // -X spine edge
    goldEdgeMat, // +Y top edge
    goldEdgeMat, // -Y bottom edge
    rightInnerMat, // +Z inner right page (revealed when opened)
    coverMat, // -Z outer front cover (seen when closed)
  ]

  const rightGeo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D)
  const rightPanel = new THREE.Mesh(rightGeo, rightPanelMats)
  rightPanel.position.set(CARD_W / 2, 0, 0)
  rightGroup.add(rightPanel)

  // Main Card Group
  const cardGroup = new THREE.Group()
  cardGroup.add(leftPanel)
  cardGroup.add(rightGroup)
  scene.add(cardGroup)

  let lastFlicker = 0
  const allMaterials = [
    goldEdgeMat,
    coverMat,
    leftInnerMat,
    rightInnerMat,
    backCoverMat,
  ]

  return {
    cardGroup,
    rightGroup,
    setHingeAngle: (angleRad: number) => {
      // 0 rad = closed, -2.79 rad (-160 deg) = fully open
      rightGroup.rotation.y = angleRad
    },
    updateIdle: (time: number, mouseParallax: { x: number; y: number }, isIdle: boolean) => {
      if (isIdle) {
        // Slow continuous revolving
        cardGroup.rotation.y = time * 0.0006
        // Gentle vertical levitation
        cardGroup.position.y = Math.sin(time * 0.0012) * 0.08
        // Mouse parallax tilt
        cardGroup.rotation.x = mouseParallax.y * 0.12
        cardGroup.rotation.z = mouseParallax.x * -0.06
      }
    },
    setOpacity: (opacity: number) => {
      const clamped = Math.max(0, Math.min(1, opacity))
      allMaterials.forEach((m) => {
        m.opacity = clamped
        m.visible = clamped > 0.001
      })
      cardGroup.visible = clamped > 0.001
    },
    updateLanternFlicker: (time: number) => {
      // Periodic subtle flicker on the right page canvas
      if (time - lastFlicker > 120) {
        lastFlicker = time
        const flicker = 0.8 + Math.random() * 0.4
        renderGateIllustration(rightPageData.ctx, 1024, 1460, flicker)
        rightPageData.texture.needsUpdate = true
      }
    },
    dispose: () => {
      scene.remove(cardGroup)
      leftGeo.dispose()
      rightGeo.dispose()
      allMaterials.forEach((m) => m.dispose())
      frontCoverTex.dispose()
      leftPageTex.dispose()
      rightPageData.texture.dispose()
    },
  }
}
