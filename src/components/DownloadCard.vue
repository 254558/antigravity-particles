<template>
  <div class="download-card" ref="cardRef">
    <div class="card-overlay">
      <h1>反重力</h1>
      <div class="download-btns">
        <a class="download-btn download-btn-primary" href="#">Download for Apple Silicon</a>
        <a class="download-btn download-btn-secondary" href="#">Download for Intel</a>
      </div>
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
  density: 100,
  cameraZoom: 7.5,
  ringWidth: 0.15,
  ringWidth2: 0.05,
  ringDisplacement: 0.23,
  particlesScale: 0.65,
  colors: ['#a0c4ff', '#a0c4ff', '#a0c4ff'],
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
	  uniform float uRingRadius, uRingWidth, uRingWidth2, uRingDisplacement;
	  uniform float uBreath;
	  ${noiseGLSL}
	  void main() {
	    vec2 uv = gl_FragCoord.xy / 256.0;
	    vec4 pFrame = texture2D(uPosition, uv);
	    float scale = pFrame.z;
	    float velocity = pFrame.w;
	    vec2 refPos = texture2D(uPosRefs, uv).xy;
	    float time = uTime * 0.5;
		vec2 curentPos = refPos;
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
		    // far from ring → fade down, but keep a faint sparse glow toward center
		    float farFade = 1. - smoothstep(uRingRadius - uRingWidth * 2., uRingRadius + uRingWidth * 6., dist);
			    // center region: visible dots, no fade, same brightness across center
			    float centerGlow = 0.8 * (1.0 - smoothstep(0.0, uRingRadius * 1.5, dist));
			    t = t * farFade + centerGlow;
	    t += snoise(vec3(curentPos.xy * 30. + vec2(11.4924, 12.9744), time * 0.5)) * t3 * 0.5;

	    float noise1 = snoise(vec3(curentPos.xy * 4. + vec2(88.494, 32.4397), time * 0.35));
	    float noise2 = snoise(vec3(curentPos.xy * 4. + vec2(50.904, 120.947), time * 0.35));
	    float noise3 = snoise(vec3(curentPos.xy * 20. + vec2(18.4924, 72.9744), time * 0.5));
	    float noise4 = snoise(vec3(curentPos.xy * 20. + vec2(50.904, 120.947), time * 0.5));

	    vec2 disp = vec2(noise1, noise2) * 0.03;
	    disp += vec2(noise3, noise4) * 0.005;

	    disp.x += sin((refPos.x * 20.) + (time * 4.)) * 0.02 * clamp(dist, 0., 1.);
	    disp.y += cos((refPos.y * 20.) + (time * 3.)) * 0.02 * clamp(dist, 0., 1.);

		    // breath: all-ring contraction with circulation flow
		    // radial + tangential flow field for bell top-view circulation
		    vec2 dir = normalize(curentPos - uRingPos + 0.001);
		    vec2 tangent = vec2(-dir.y, dir.x);
		    // ① tangential swirl: locked to the ring band — strongest at bell rim
		    float swirlWeight = smoothstep(uRingRadius - uRingWidth * 2., uRingRadius, dist)
		      - smoothstep(uRingRadius, uRingRadius + uRingWidth * 2., dist1);
		    pos += tangent * swirlWeight * 0.012;
		    // ② core suction: edge particles curl inward toward center, core is stable
		    float corePull = smoothstep(uRingRadius * 0.3, uRingRadius, dist);
		    pos -= dir * corePull * 0.008;
		    // ③ edge fold noise: periodic bulges along rim, like umbrella ribs / bell folds
		    float foldNoise = snoise(vec3(dir * 8.0, time * 0.8));
		    pos += dir * foldNoise * swirlWeight * 0.01;
		    // ④ radial contraction (existing): layer-weighted inward curl
		    float edgeWeight = smoothstep(uRingRadius * 0.4, uRingRadius * 1.2, dist);
		    float breathDisp = (0.6 + uBreath * 0.8) * (1.0 + edgeWeight * 0.8);
		    float layerFalloff = smoothstep(0.0, uRingRadius * 1.2, dist);
		    pos -= (uRingPos - (curentPos + disp)) * pow(t2, 0.75) * uRingDisplacement * breathDisp * layerFalloff;

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
  uniform float uRingRadius;
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

	    // edge particles grow larger — smooth ramp from center to rim
	    float edgeSize = pow(clamp(length(pos.xy) / 0.5, 0.0, 1.0), 1.5);
	    // center thickness: denser/heavier core for bell top
	    float centerWeight = 1.0 - smoothstep(0.0, uRingRadius * 0.8, length(pos.xy));

		    float ptSize = ((vScale * 5.5) * (uPixelRatio * 0.385) * uParticleScale) + (minScale * uPixelRatio * 0.88) + (edgeSize * 8.8 * uPixelRatio) + (centerWeight * 4.4 * uPixelRatio);
    // minimum pixels so round ends can render — tiny sprites turn into square pixels
    gl_PointSize = max(ptSize, 3.0 * uPixelRatio);
  }
`

const renderFragShader = `
  precision highp float;
  varying vec4 vSeeds;
  varying vec2 vScreenPos, vLocalPos;
  varying float vScale, vVelocity;
  uniform vec3 uColor1, uColor2, uColor3;
  uniform vec2 uRingPos, uRez;
  uniform float uAlpha, uTime, uBreath, uMood;
  uniform int uColorScheme;
  ${noiseGLSL}
  #define PI 3.14159265359

  // capsule: line segment with rounded ends — perfect half-circles, never deforms
  float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }
  vec2 rotate(vec2 v, float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, s, -s, c) * v;
  }

  void main() {
    float noiseAngle = snoise(vec3(vLocalPos * 10. + vec2(18.4924, 72.9744), uTime * .85));
    float noiseColor = snoise(vec3(vLocalPos * 2. + vec2(74.664, 91.556), uTime * .5));
    noiseColor = (noiseColor + 1.) * .5;

    // point outward (away from bell center) → reads as convex dome, like umbrella ribs
    vec2 dirFromRing = vLocalPos - uRingPos;
    float angle = atan(dirFromRing.y, dirFromRing.x);
    float distToRing = length(dirFromRing);
    // bell weight: peak at ring, fade to dot toward center & far edge
    float ringProx = 1.0 - smoothstep(0.0, 0.15, abs(distToRing - 0.28));
    vec2 uv = gl_PointCoord.xy - 0.5;
    uv.y *= -1.;
    uv = rotate(uv, angle + (noiseAngle * .5)); // capsule radiates outward (convex bell)

    float h = 0.8;
    float progress = smoothstep(0., .75, pow(noiseColor, 2.));
    vec3 col = mix(mix(uColor1, uColor2, progress/h), mix(uColor2, uColor3, (progress - h)/(1.0 - h)), step(h, progress));
	    vec3 color = col;

	    // non-symmetric capsule: inner end fixed at origin, outer end extends/shortens
	    float halfLen = mix(0.14, 0.32, ringProx) * (0.8 + uMood * 0.4);
		    float capR = 0.14;
		    halfLen = max(halfLen, capR);
		    halfLen = min(halfLen, 0.32);
		    float capEnd = max(halfLen * 2.0 - capR, capR);
		    // clamp: keep within point sprite (uv ∈ [-0.5,0.5], center at 0)
		    // asymmetric: inner end at origin, outer end at capEnd → capEnd ≤ 0.5
		    capEnd = min(capEnd, 0.5 - capR);
	    float rounded = sdCapsule(uv, vec2(0.0, 0.0), vec2(capEnd, 0.0), capR);
	    float aa = max(capEnd * 0.04, 0.02);
	    rounded = smoothstep(aa, 0., rounded);

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
      uRingRadius: { value: 0.28 },
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
	      uBreath: { value: 0 },
	      uMood: { value: 0.5 },
	      uRingRadius: { value: 0.28 },
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
  // keep only points inside a circle → round jellyfish bell, not square
  const maxR = 230
  for (const p of base) {
    const dx = p[0] - 250, dy = p[1] - 250
    if (dx * dx + dy * dy <= maxR * maxR) {
      pointsData.push(dx, dy)
    }
  }
  count = pointsData.length / 2
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
	  // breath pulse: 0=contract, 1=expand — drives particle displacement amplitude, NOT capsule length speed
	  // mood: slow pseudo-random drift (0~1) — high = energetic, low = relaxed
	  const mood = 0.5 + 0.5 * (Math.sin(time * 0.18) * 0.6 + Math.sin(time * 0.07 + 1.3) * 0.4)
	  // mood modulates: frequency (faster when energetic), amplitude (stronger), offset
	  const breathFreq = 1.8 + mood * 0.6
	  const breathAmp = 0.35 + mood * 0.5
  const rawBreath = 0.5 + 0.5 * Math.sin(time * breathFreq * 0.5)
  const breathPulse = Math.pow(rawBreath, 1.8)
  const ringRadius = 0.22 + breathPulse * 0.11
  const pw = pushProgress * hoverProgress
  const ringWidthVal = CONFIG.ringWidth + pw * 0.08
  const ringWidth2Val = CONFIG.ringWidth2 + pw * 0.04
  // mouse velocity → smooth boost capped to prevent wild deformation
	  const rawVel = smoothRingPos.distanceTo(targetPos) * 8
	  smoothVelBoost += (rawVel - smoothVelBoost) * 0.02
	  const cappedBoost = Math.min(smoothVelBoost, 0.03)
	  const ringDispVal = CONFIG.ringDisplacement + pw * 0.06 + cappedBoost
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
  renderMaterial.uniforms.uBreath.value = breathPulse
  renderMaterial.uniforms.uMood.value = mood
  renderMaterial.uniforms.uRingRadius.value = ringRadius

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
