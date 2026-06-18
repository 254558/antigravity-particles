<template>
  <div class="download-card" ref="cardRef">
    <div class="card-overlay">
      <h1>Download Google Antigravity</h1>
      <p>for macOS</p>
      <a class="btn" href="#">⬇ Download</a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { noiseGLSL } from '../composables/useNoiseGLSL.js'

const SIZE = 256
const CONFIG = {
  density: 220,
  cameraZoom: 3.5,
  ringWidth: 0.15,
  ringWidth2: 0.05,
  ringDisplacement: 0.23,
  particlesScale: 0.65,
  colors: ['#7aaeff', '#7aaeff', '#7aaeff'],
}
const PI = Math.PI

const cardRef = ref(null)

// Three.js objects
let renderer, camera, scene, clock
let raycastPlane, raycaster, mouseNDC, intersectionPoint
let isIntersecting = false, mouseIsOver = false
let hoverProgress = 0, pushProgress = 0, lastHoverState = false
let count, pointsData
let posTex, rt1, rt2, everRendered = false
let mesh, simMaterial, renderMaterial, simScene, simCamera
	let animId = null
	let smoothRingPos = new THREE.Vector2(0, 0)
	let smoothVelBoost = 0 // smoothed mouse velocity boost
	
	
function linearMap(x, a, b, c, d) {
  return ((x - a) * (d - c)) / (b - a) + c
}

function poissonDiskFixed(shape, minDist, maxDist, tries = 20) {
  const cellSize = minDist / Math.SQRT2
  const gridW = Math.ceil(shape[0] / cellSize)
  const gridH = Math.ceil(shape[1] / cellSize)
  const grid = new Int32Array(gridW * gridH).fill(-1)
  const points = []
  const active = []
  const rng = Math.random
  const gIdx = p => Math.floor(p[0] / cellSize) + Math.floor(p[1] / cellSize) * gridW
  const far = (p, minD2) => {
    const gx = Math.floor(p[0] / cellSize), gy = Math.floor(p[1] / cellSize)
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const nx = gx + dx, ny = gy + dy
      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
      const pi = grid[nx + ny * gridW]
      if (pi !== -1) {
        const q = points[pi]
        const dx2 = p[0] - q[0], dy2 = p[1] - q[1]
        if (dx2 * dx2 + dy2 * dy2 < minD2) return false
      }
    }
    return true
  }
  const p0 = [rng() * shape[0], rng() * shape[1]]
  points.push(p0); grid[gIdx(p0)] = 0; active.push(0)
  while (active.length) {
    const ri = active[Math.floor(rng() * active.length)]
    let found = false
    for (let t = 0; t < tries; t++) {
      const ang = rng() * PI * 2
      const rad = minDist + rng() * (maxDist - minDist)
      const np = [points[ri][0] + Math.cos(ang) * rad, points[ri][1] + Math.sin(ang) * rad]
      if (np[0] < 0 || np[0] >= shape[0] || np[1] < 0 || np[1] >= shape[1]) continue
      if (far(np, minDist * minDist)) {
        points.push(np); grid[gIdx(np)] = points.length - 1
        active.push(points.length - 1); found = true; break
      }
    }
    if (!found) active.splice(active.indexOf(ri), 1)
  }
  return points
}

function createDataTexture(data) {
  const arr = new Float32Array(SIZE * SIZE * 4)
  for (let r = 0; r < count; r++) {
    arr[r * 4] = data[r * 2] * (1 / 250)
    arr[r * 4 + 1] = data[r * 2 + 1] * (1 / 250)
    arr[r * 4 + 2] = 0
    arr[r * 4 + 3] = 0
  }
  const tex = new THREE.DataTexture(arr, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

function createRT() {
  return new THREE.WebGLRenderTarget(SIZE, SIZE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  })
}

const simFragShader = `
  precision highp float;
  uniform sampler2D uPosition, uPosRefs;
  uniform vec2 uRingPos;
  uniform float uTime, uDeltaTime;
  uniform float uRingRadius, uRingWidth, uRingWidth2, uRingDisplacement, uBreath;
  ${noiseGLSL}
  void main() {
    vec2 uv = gl_FragCoord.xy / 256.0;
    vec4 pFrame = texture2D(uPosition, uv);
    float scale = pFrame.z;
    float velocity = pFrame.w;
    vec2 refPos = texture2D(uPosRefs, uv).xy;
    float time = uTime * 0.5;
    // breath: one continuous bell — center drifts slightly, rim moves a lot,
    // smooth gradient (no dead zone) so it reads as a single contracting surface
    float distFromCenter = length(refPos);
    float edgeWeight = pow(clamp(distFromCenter / 0.5, 0.0, 1.0), 1.5);
    float ang = atan(refPos.y, refPos.x);
    // irregular wavy rim, not a perfect circle
    float wave = sin(ang * 5.0 + uTime * 1.2) * 0.5 + sin(ang * 8.0 - uTime * 0.7) * 0.3;
    // uBreath: 0 = contract (gather inward), 1 = expand (spread out)
    float contract = (1.0 - uBreath);
    float breathOffset = -contract * 0.45 + uBreath * 0.25 + wave * 0.10;
    vec2 curentPos = refPos * (1.0 + breathOffset * edgeWeight);
    vec2 pos = pFrame.xy;
    pos *= 0.8;

    float dist = distance(curentPos.xy, uRingPos);
    float noise0 = snoise(vec3(curentPos.xy * 0.2 + vec2(18.4924, 72.9744), time * 0.5));
    float dist1 = distance(curentPos.xy + (noise0 * 0.005), uRingPos);

    float t = smoothstep(uRingRadius - (uRingWidth * 2.), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth, dist1);
    float t2 = smoothstep(uRingRadius - (uRingWidth2 * 2.), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
    float t3 = smoothstep(uRingRadius + uRingWidth2, uRingRadius, dist);

    t = pow(t, 2.);
    t2 = pow(t2, 3.);
    t += t2 * 3.;
    // far from ring → fade to 0
    float farFade = 1. - smoothstep(uRingRadius - uRingWidth * 2., uRingRadius + uRingWidth * 6., dist);
    t *= farFade;
    t += snoise(vec3(curentPos.xy * 30. + vec2(11.4924, 12.9744), time * 0.5)) * t3 * 0.5;

    float nS = snoise(vec3(curentPos.xy * 2. + vec2(18.4924, 72.9744), time * 0.5));
    t += pow((nS + 1.5) * 0.5, 2.) * 0.6;

    float noise1 = snoise(vec3(curentPos.xy * 4. + vec2(88.494, 32.4397), time * 0.35));
    float noise2 = snoise(vec3(curentPos.xy * 4. + vec2(50.904, 120.947), time * 0.35));
    float noise3 = snoise(vec3(curentPos.xy * 20. + vec2(18.4924, 72.9744), time * 0.5));
    float noise4 = snoise(vec3(curentPos.xy * 20. + vec2(50.904, 120.947), time * 0.5));

    vec2 disp = vec2(noise1, noise2) * 0.03;
    disp += vec2(noise3, noise4) * 0.005;

    disp.x += sin((refPos.x * 20.) + (time * 4.)) * 0.02 * clamp(dist, 0., 1.);
    disp.y += cos((refPos.y * 20.) + (time * 3.)) * 0.02 * clamp(dist, 0., 1.);

    pos -= (uRingPos - (curentPos + disp)) * pow(t2, 0.75) * uRingDisplacement;

    // scale: single source (ring intensity) — no separate boost, keeps one bell
    float scaleDiff = t - scale;
    scaleDiff *= 0.2;
    scale += scaleDiff;

    vec2 finalPos = curentPos + disp + (pos * 0.25);

    velocity *= 0.5;
    velocity += scale * 0.25;

    gl_FragColor = vec4(finalPos, scale, velocity);
  }
`

const renderVertShader = `
  precision highp float;
  attribute vec4 seeds;
  uniform sampler2D uPosition;
  uniform float uTime, uParticleScale, uPixelRatio;
  uniform int uColorScheme;
  uniform float uIsHovering;
  varying vec4 vSeeds;
  varying float vVelocity, vScale;
  varying vec2 vLocalPos, vScreenPos;
  ${noiseGLSL}
  void main() {
    vec4 pos = texture2D(uPosition, uv);
    vSeeds = seeds;

    float noiseX = snoise(vec3(vec2(pos.xy * 10.), uTime * .2 + 100.));
    float noiseY = snoise(vec3(vec2(pos.xy * 10.), uTime * .2));
    float noiseX2 = snoise(vec3(vec2(pos.xy * .5), uTime * .15 + 45.));
    float noiseY2 = snoise(vec3(vec2(pos.xy * .5), uTime * .15 + 87.));

    float cDist = length(pos.xy) * 1.;
    float progress = 0.0;
    float t = smoothstep(progress - .25, progress, cDist) - smoothstep(progress, progress + .25, cDist);
    t *= smoothstep(1., .0, cDist);
    pos.xy *= 1. + (t * .02);

    float dist = smoothstep(0., 0.9, pos.w);
    dist = mix(0., dist, uIsHovering);

    pos.y += noiseY * 0.005 * dist;
    pos.x += noiseX * 0.005 * dist;
    pos.y += noiseY2 * 0.02;
    pos.x += noiseX2 * 0.02;

    vVelocity = pos.w;
    vScale = pos.z;
    vLocalPos = pos.xy;
    vec4 viewSpace = modelViewMatrix * vec4(vec3(pos.xy, 0.), 1.0);
    gl_Position = projectionMatrix * viewSpace;
    vScreenPos = gl_Position.xy;

    float minScale = .25;
    minScale += float(uColorScheme) * .75;

    gl_PointSize = ((vScale * 7.) * (uPixelRatio * 0.5) * uParticleScale) + (minScale * uPixelRatio);
  }
`

const renderFragShader = `
  precision highp float;
  varying vec4 vSeeds;
  varying vec2 vScreenPos, vLocalPos;
  varying float vScale, vVelocity;
  uniform vec3 uColor1, uColor2, uColor3;
  uniform vec2 uRingPos, uRez;
  uniform float uAlpha, uTime;
  uniform int uColorScheme;
  ${noiseGLSL}
  #define PI 3.14159265359

  float sdRoundBox(vec2 p, vec2 b, vec4 r) {
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    r.x = (p.y > 0.0) ? r.x : r.y;
    vec2 q = abs(p) - b + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }
  vec2 rotate(vec2 v, float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, s, -s, c) * v;
  }

  void main() {
    float noiseAngle = snoise(vec3(vLocalPos * 10. + vec2(18.4924, 72.9744), uTime * .85));
    float noiseColor = snoise(vec3(vLocalPos * 2. + vec2(74.664, 91.556), uTime * .5));
    noiseColor = (noiseColor + 1.) * .5;

    vec2 dirToRing = uRingPos - vLocalPos;
    float angle = atan(dirToRing.y, dirToRing.x);
    vec2 uv = gl_PointCoord.xy - 0.5;
    uv.y *= -1.;
    uv = rotate(uv, angle + (noiseAngle * .5)); // capsule long axis points toward ring

    float h = 0.8;
    float progress = smoothstep(0., .75, pow(noiseColor, 2.));
    vec3 col = mix(mix(uColor1, uColor2, progress/h), mix(uColor2, uColor3, (progress - h)/(1.0 - h)), step(h, progress));
    vec3 color = col;

    float rounded = sdRoundBox(uv, vec2(0.5, 0.2), vec4(.25));
    rounded = smoothstep(.1, 0., rounded);

    float a = uAlpha * rounded * smoothstep(0.1, 0.2, vScale);
    if (a < 0.01) discard;

    color = clamp(color, 0., 1.);
    color = mix(color, color * clamp(vVelocity, 0., 1.), float(uColorScheme));

    gl_FragColor = vec4(color, clamp(a, 0., 1.));
  }
`

function initGPU() {
  const card = cardRef.value
  renderer = new THREE.WebGLRenderer({
    antialias: true, alpha: true, powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(card.offsetWidth, card.offsetHeight)
  renderer.setClearColor(0, 0)
  renderer.autoClear = false
  card.prepend(renderer.domElement)

  camera = new THREE.PerspectiveCamera(40, card.offsetWidth / card.offsetHeight, 0.1, 1000)
  camera.position.z = CONFIG.cameraZoom

  scene = new THREE.Scene()
  scene.background = null
  clock = new THREE.Clock()

  raycastPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(12.5, 12.5),
    new THREE.MeshBasicMaterial({ visible: false })
  )
  scene.add(raycastPlane)
  raycaster = new THREE.Raycaster()
  mouseNDC = new THREE.Vector2()
  intersectionPoint = new THREE.Vector3()

  posTex = createDataTexture(pointsData)
  rt1 = createRT(); rt2 = createRT()
  renderer.setRenderTarget(rt1); renderer.setClearColor(0, 0); renderer.clear()
  renderer.setRenderTarget(rt2); renderer.setClearColor(0, 0); renderer.clear()
  renderer.setRenderTarget(null)
  everRendered = false

  simScene = new THREE.Scene()
  simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: { value: posTex },
      uPosRefs: { value: posTex },
      uRingPos: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uDeltaTime: { value: 0 },
      uRingRadius: { value: 0.175 },
      uRingWidth: { value: CONFIG.ringWidth },
      uRingWidth2: { value: CONFIG.ringWidth2 },
      uRingDisplacement: { value: CONFIG.ringDisplacement },
      uBreath: { value: 0 },
    },
    vertexShader: `void main(){ gl_Position = vec4(position, 1.0); }`,
    fragmentShader: simFragShader,
    depthTest: false,
    depthWrite: false,
  })
  simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial))

  const geom = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const seeds = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const x = i % SIZE, y = Math.floor(i / SIZE)
    uvs[i * 2] = x / SIZE
    uvs[i * 2 + 1] = y / SIZE
    seeds[i * 4] = Math.random()
    seeds[i * 4 + 1] = Math.random()
    seeds[i * 4 + 2] = Math.random()
    seeds[i * 4 + 3] = Math.random()
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geom.setAttribute('seeds', new THREE.BufferAttribute(seeds, 4))
  geom.setDrawRange(0, count)

  renderMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPosition: { value: posTex },
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(CONFIG.colors[0]) },
      uColor2: { value: new THREE.Color(CONFIG.colors[1]) },
      uColor3: { value: new THREE.Color(CONFIG.colors[2]) },
      uAlpha: { value: 1 },
      uRingPos: { value: new THREE.Vector2(0, 0) },
      uIsHovering: { value: 0 },
      uRez: { value: new THREE.Vector2(card.offsetWidth, card.offsetHeight) },
      uParticleScale: { value: 1 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uColorScheme: { value: 1 },
    },
    vertexShader: renderVertShader,
    fragmentShader: renderFragShader,
  })

  mesh = new THREE.Points(geom, renderMaterial)
  mesh.position.set(0, 0, 0)
  mesh.scale.set(5, -5, 5)
  mesh.frustumCulled = false
  scene.add(mesh)

  document.getElementById('loading').style.display = 'none'
}

function buildParticles() {
  const minD = linearMap(CONFIG.density, 0, 300, 10, 2)
  const maxD = linearMap(CONFIG.density, 0, 300, 11, 3)
  const base = poissonDiskFixed([500, 500], minD, maxD, 20)
  pointsData = []
  for (const p of base) {
    pointsData.push(p[0] - 250, p[1] - 250)
  }
  count = base.length
  document.getElementById('loading').textContent = `生成中… ${count} 个粒子`
  initGPU()
}

function updateMouse(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect()
  mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1
  mouseIsOver = mouseNDC.x >= -1 && mouseNDC.x <= 1 && mouseNDC.y >= -1 && mouseNDC.y <= 1
}

function checkHover() {
  if (mouseIsOver) {
    raycaster.setFromCamera(mouseNDC, camera)
    const hits = raycaster.intersectObject(raycastPlane)
    if (hits.length > 0) {
      intersectionPoint.copy(hits[0].point)
      isIntersecting = true
    } else isIntersecting = false
  } else isIntersecting = false

  if (isIntersecting && !lastHoverState) {
    gsap.to(scene.userData, {
      hoverProgress: 1, duration: 0.5, ease: 'power3.out',
      onUpdate: () => { hoverProgress = scene.userData.hoverProgress }
    })
    gsap.fromTo(scene.userData, { pushProgress: 0 }, {
      pushProgress: 1, duration: 2, delay: 0.1, ease: 'power2.out',
      onUpdate: () => { pushProgress = scene.userData.pushProgress }
    })
  } else if (!isIntersecting && lastHoverState) {
    gsap.to(scene.userData, {
      hoverProgress: 0, duration: 0.5, ease: 'power3.out',
      onUpdate: () => { hoverProgress = scene.userData.hoverProgress }
    })
    gsap.fromTo(scene.userData, { pushProgress: 0 }, {
      pushProgress: 1, duration: 2, delay: 0, ease: 'power2.out',
      onUpdate: () => { pushProgress = scene.userData.pushProgress }
    })
  }
  lastHoverState = isIntersecting
}

function animate() {
  animId = requestAnimationFrame(animate)
  if (!mesh) return
  const time = clock.getElapsedTime()
  const dt = time - (clock.elapsedTime - clock.getDelta())
  checkHover()

  // smooth lerp ring position toward mouse
  const targetPos = new THREE.Vector2(
    intersectionPoint.x * 0.175,
    intersectionPoint.y * -0.175
  )
  smoothRingPos.lerp(targetPos, 0.03)
  const ringPos = smoothRingPos.clone()
  const ringRadius = 0.175 + Math.sin(time * 1) * 0.03 + Math.cos(time * 3) * 0.02
  // breath pulse: 0~1 sinusoid, ~5s per cycle for a slow calm inhale/exhale
  const breathPulse = 0.5 + 0.5 * Math.sin(time * 1.2)
  const pw = pushProgress * hoverProgress
  const ringWidthVal = CONFIG.ringWidth + pw * 0.08
  const ringWidth2Val = CONFIG.ringWidth2 + pw * 0.04
  // mouse velocity → smooth boost that rises slowly and decays gradually
  const rawVel = smoothRingPos.distanceTo(targetPos) * 8
  smoothVelBoost += (rawVel - smoothVelBoost) * 0.02
  const ringDispVal = CONFIG.ringDisplacement + pw * 0.06 + smoothVelBoost
  const particleScale = renderer.domElement.width / renderer.getPixelRatio() / 2000 * CONFIG.particlesScale

  simMaterial.uniforms.uPosition.value = everRendered ? rt1.texture : posTex
  simMaterial.uniforms.uRingPos.value = ringPos
  simMaterial.uniforms.uTime.value = time
  simMaterial.uniforms.uDeltaTime.value = dt
  simMaterial.uniforms.uRingRadius.value = ringRadius
  simMaterial.uniforms.uRingWidth.value = ringWidthVal
  simMaterial.uniforms.uRingWidth2.value = ringWidth2Val
  simMaterial.uniforms.uRingDisplacement.value = ringDispVal
  simMaterial.uniforms.uBreath.value = breathPulse

  renderer.setRenderTarget(rt2)
  renderer.render(simScene, simCamera)
  renderer.setRenderTarget(null)

  renderMaterial.uniforms.uPosition.value = everRendered ? rt2.texture : posTex
  renderMaterial.uniforms.uRingPos.value = ringPos
  renderMaterial.uniforms.uTime.value = time
  renderMaterial.uniforms.uParticleScale.value = particleScale

  renderer.clear()
  renderer.render(scene, camera)

  ;[rt1, rt2] = [rt2, rt1]
  everRendered = true
}

function onMouseMove(e) {
  updateMouse(e.clientX, e.clientY)
}
function onMouseLeave() {
  mouseIsOver = false
}

onMounted(() => {
  scene = new THREE.Scene()
  scene.userData.hoverProgress = 0
  scene.userData.pushProgress = 0
  buildParticles()
  animate()
  const card = cardRef.value
  if (card) {
    card.addEventListener('mousemove', onMouseMove)
    card.addEventListener('mouseleave', onMouseLeave)
  }
})

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
  if (renderer) renderer.dispose()
  const card = cardRef.value
  if (card) {
    card.removeEventListener('mousemove', onMouseMove)
    card.removeEventListener('mouseleave', onMouseLeave)
  }
})
</script>
