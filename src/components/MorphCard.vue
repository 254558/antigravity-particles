<template>
  <canvas :ref="el => { if (el) canvasEl = el }"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { noiseGLSL } from '../composables/useNoiseGLSL.js'

const props = defineProps({
  imageUrl: { type: String, required: true },
  color1: { type: String, default: '#318bf7' },
  color2: { type: String, default: '#8892ff' },
  scale: { type: Number, default: 1.3 },
  yOffset: { type: Number, default: 0.1 },
})

const SIZE = 256
const VIEW = 1.05

let canvasEl = null
let renderer, camera, scene, clock
let simMat, simScene, simCam
let posTex, refTex, nearTex
let rt1, rt2, everRendered = false
let mesh, rdrMat
let hp = 0
let animId = null
let resizeHandler = null
let mouseEnterHandler = null
let mouseLeaveHandler = null

function loadShapeImageData(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const cvs = document.createElement('canvas')
      cvs.width = 500; cvs.height = 500
      const ctx = cvs.getContext('2d')
      ctx.drawImage(img, 0, 0, 500, 500)
      resolve(ctx.getImageData(0, 0, 500, 500))
    }
    img.onerror = () => {
      const cvs = document.createElement('canvas')
      cvs.width = 500; cvs.height = 500
      const ctx = cvs.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 500, 500)
      resolve(ctx.getImageData(0, 0, 500, 500))
    }
    img.src = url
  })
}

// 1) 四邻域边缘检测: 提取形状的 1px 轮廓像素
function sampleEdgePixels(imgData) {
  const w = imgData.width, h = imgData.height
  const isDark = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = imgData.data[(x + y * w) * 4] / 255
      isDark[y * w + x] = (p * p * p < 0.15) ? 1 : 0
    }
  }
  const edge = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isDark[y * w + x]) continue
      const l = x > 0 ? isDark[y * w + (x - 1)] : 1
      const r = x < w - 1 ? isDark[y * w + (x + 1)] : 1
      const t = y > 0 ? isDark[(y - 1) * w + x] : 1
      const b = y < h - 1 ? isDark[(y + 1) * w + x] : 1
      if (!(l && r && t && b)) edge.push([x, y])
    }
  }
  return edge
}

function createRT() {
  return new THREE.WebGLRenderTarget(SIZE, SIZE, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat, type: THREE.FloatType, depthBuffer: false, stencilBuffer: false,
  })
}

// SIM shader — 官方逻辑 1:1
const simFrag = `
  precision highp float;
  uniform sampler2D uPosition, uPosRefs, uPosNearest;
  uniform float uTime, uDeltaTime, uIsHovering;
  vec2 hash(vec2 p){ p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37))); return fract(sin(p)*43758.5453); }
  void main(){
    vec2 uv=gl_FragCoord.xy/256.0;
    vec4 pf=texture2D(uPosition,uv); float s=pf.z, v=pf.w;
    vec2 rp=texture2D(uPosRefs,uv).xy, np=texture2D(uPosNearest,uv).xy;
    float sd=hash(uv).x, sd2=hash(uv).y, t=uTime*.5, le=3.+sin(sd2*100.)*1., lt=mod(sd*100.+t,le);
			    vec2 p=pf.xy;
			    // 所有粒子可吸附，但离目标太远的粒子不动
			    vec2 tg=mix(rp,np,uIsHovering);
			    vec2 dPos=tg-p;
			    float d=length(dPos);
			    if(d>.001&&d<.1) p+=normalize(dPos)*min(d*.4, .1);
			    // 循环流动: 粒子到达目标后重置到随机位置，周围新粒子源源不断被吸附
				    float arrival=1.-smoothstep(.001,.03,d);
				    float resetPhase=fract(sd*17.3+uTime*.3);
					    if(uIsHovering>.01 && arrival<.5 && resetPhase<.015) { vec2 dir=normalize(rp); p=rp+dir*.08; pf.xy=rp+dir*.08; s=0.005; v=0.; }
		    // scale: 生命周期脉动 + hover 时接近目标的粒子增大
		    float ts=smoothstep(.01,.5,lt)-smoothstep(.5,1.,lt/le);
		    ts+=smoothstep(.05,0.,d)*.8*uIsHovering;
		    s+=(ts-s)*.15;
	    // velocity: hover 时靠近目标的粒子变亮
	    v=smoothstep(.3,.001,d)*uIsHovering;
    gl_FragColor=vec4(pf.xy+(p-pf.xy)*.2,s,v);
  }
`

// RENDER vertex — 官方同款
const rdrVert = `
  precision highp float;
  attribute vec4 seeds;
  uniform sampler2D uPosition;
	  uniform float uTime, uParticleScale, uPixelRatio, uIsHovering, uPulseProgress;
	  varying float vVelocity, vScale;
	  ${noiseGLSL}
	  void main(){
	    vec4 pos=texture2D(uPosition,uv);
	    float nx=snoise(vec3(pos.xy*10.,uTime*.2+100.)), ny=snoise(vec3(pos.xy*10.,uTime*.2));
	    float nx2=snoise(vec3(pos.xy*.5,uTime*.15+45.)), ny2=snoise(vec3(pos.xy*.5,uTime*.15+87.));
	    float cd=length(pos.xy), pr=uPulseProgress;
	    float tt=smoothstep(pr-.25,pr,cd)-smoothstep(pr,pr+.25,cd); tt*=smoothstep(1.,.0,cd);
	    pos.xy*=1.+(tt*.02);
	    float d=smoothstep(0.,.9,pos.w); d=mix(0.,d,uIsHovering);
	    pos.y+=ny*.005*d; pos.x+=nx*.005*d; pos.y+=ny2*.02; pos.x+=nx2*.02;
	    vVelocity=pos.w; vScale=pos.z;
	    vec4 vs=modelViewMatrix*vec4(vec3(pos.xy,0.),1.); gl_Position=projectionMatrix*vs;
		    gl_PointSize=((vScale*7.+0.0001)*uPixelRatio*.6);
  }
`

// RENDER fragment — 官方同款小圆点
const rdrFrag = `
	  precision highp float;
	  varying float vScale, vVelocity;
	  uniform vec3 uColor1,uColor2;
	  uniform float uAlpha;
	  void main(){
    vec2 uv=gl_PointCoord.xy-.5; uv.y*=-1.;
	    float pr=vVelocity;
	    vec3 col=mix(uColor1,uColor2,pr);
	    float disc=smoothstep(.5,.2,length(uv)), a=uAlpha*disc;
    if(a<.01)discard; col=clamp(col,0.,1.);
    gl_FragColor=vec4(col,clamp(a,0.,1.));
  }
`

onMounted(async () => {
  if (!canvasEl) return
  const card = canvasEl.parentElement
  if (!card) return

  const W = card.offsetWidth
  const H = card.offsetHeight
  canvasEl.style.position = 'absolute'
  canvasEl.style.top = '0'
  canvasEl.style.left = '0'
  canvasEl.style.width = '100%'
  canvasEl.style.height = '100%'
  canvasEl.style.display = 'block'
  canvasEl.width = W
  canvasEl.height = H

  // 1. 加载形状图
  const imgData = await loadShapeImageData(props.imageUrl)
  const scl = props.scale
  const yOff = props.yOffset

		  // 2. 边缘检测: 提取 1px 轮廓像素
		  const edgePts = sampleEdgePixels(imgData)

	  // 合并
	  const totalPts = edgePts
  const count = Math.min(totalPts.length, SIZE * SIZE)

  // 3. 生成位置数据
  // 每个粒子: base=随机的散落位置, target=离它最近的边缘像素位置
  const base = new Float32Array(count * 2)
  const nearest = new Float32Array(count * 2)

  // 预计算所有边缘点的归一化坐标
  const edgeNorm = edgePts.map(([ex, ey]) => [
    ((ex - 250) / 250) * scl,
    ((250 - ey) / 250) * scl + yOff
  ])

  for (let i = 0; i < count; i++) {
    // 随机初始位置
    const rx = Math.random() * 500, ry = Math.random() * 500
    const bx = (rx - 250) / 250, by = (250 - ry) / 250
    base[i * 2] = bx
    base[i * 2 + 1] = by

    // 找最近的边缘点作为目标
    let bestD = Infinity, bestNx = bx, bestNy = by
    for (let j = 0; j < edgeNorm.length; j++) {
      const dx = edgeNorm[j][0] - bx, dy = edgeNorm[j][1] - by
      const dd = dx * dx + dy * dy
      if (dd < bestD) { bestD = dd; bestNx = edgeNorm[j][0]; bestNy = edgeNorm[j][1] }
    }
    nearest[i * 2] = bestNx
    nearest[i * 2 + 1] = bestNy
  }

  // 4. Three.js
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(W, H, false)
  renderer.setClearColor(0x000000, 0)

  const aspect = W / H
  camera = new THREE.OrthographicCamera(-VIEW * aspect, VIEW * aspect, VIEW, -VIEW, 0, 10)
  camera.position.z = 5
  scene = new THREE.Scene()
  scene.background = null
  clock = new THREE.Clock()

  // 5. GPGPU textures
  const rawPos = new Float32Array(SIZE * SIZE * 4)
  for (let i = 0; i < count; i++) { rawPos[i * 4] = base[i * 2]; rawPos[i * 4 + 1] = base[i * 2 + 1] }
  const rawRef = new Float32Array(SIZE * SIZE * 4)
  for (let i = 0; i < count; i++) { rawRef[i * 4] = base[i * 2]; rawRef[i * 4 + 1] = base[i * 2 + 1] }
  const rawNear = new Float32Array(SIZE * SIZE * 4)
  for (let i = 0; i < count; i++) { rawNear[i * 4] = nearest[i * 2]; rawNear[i * 4 + 1] = nearest[i * 2 + 1] }

  posTex = new THREE.DataTexture(rawPos, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType)
  posTex.needsUpdate = true; posTex.minFilter = THREE.NearestFilter; posTex.magFilter = THREE.NearestFilter
  refTex = new THREE.DataTexture(rawRef, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType)
  refTex.needsUpdate = true; refTex.minFilter = THREE.NearestFilter; refTex.magFilter = THREE.NearestFilter
  nearTex = new THREE.DataTexture(rawNear, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType)
  nearTex.needsUpdate = true; nearTex.minFilter = THREE.NearestFilter; nearTex.magFilter = THREE.NearestFilter
  rt1 = createRT()
  rt2 = createRT()

  // 6. SIM
  simMat = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: { value: posTex }, uPosRefs: { value: refTex }, uPosNearest: { value: nearTex },
      uTime: { value: 0 }, uDeltaTime: { value: 0 }, uIsHovering: { value: 0 },
    },
    vertexShader: 'void main(){gl_Position=vec4(position,1.0);}',
    fragmentShader: simFrag, depthTest: false, depthWrite: false,
  })
  simScene = new THREE.Scene()
  simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat))
  simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  // 7. RENDER
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
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geom.setAttribute('seeds', new THREE.BufferAttribute(seeds, 4))

  const particleScale = W / 2000
  rdrMat = new THREE.ShaderMaterial({
    uniforms: {
      uPosition: { value: posTex }, uTime: { value: 0 },
      uParticleScale: { value: particleScale },
      uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
      uAlpha: { value: 1 }, uIsHovering: { value: 0 },
	      uPulseProgress: { value: 0 },
	      uColor1: { value: new THREE.Color(props.color1) },
	      uColor2: { value: new THREE.Color(props.color2) },
    },
    vertexShader: rdrVert, fragmentShader: rdrFrag,
    transparent: true, depthTest: false, depthWrite: false,
  })
  mesh = new THREE.Points(geom, rdrMat)
  mesh.frustumCulled = false
  scene.add(mesh)

  // 8. Hover
  mouseEnterHandler = () => {
    gsap.to({ v: hp }, {
      v: 1, duration: 0.2, ease: 'power2.out',
      onUpdate() { hp = this.targets()[0].v }
    })
  }
  mouseLeaveHandler = () => {
    gsap.to({ v: hp }, {
      v: 0, duration: 0.2, ease: 'power2.out',
      onUpdate() { hp = this.targets()[0].v }
    })
  }
  canvasEl.addEventListener('mouseenter', mouseEnterHandler)
  canvasEl.addEventListener('mouseleave', mouseLeaveHandler)

  // 9. Animate
  function animate() {
    animId = requestAnimationFrame(animate)
    const dt = clock.getDelta(), t = clock.getElapsedTime()
    simMat.uniforms.uTime.value = t
    simMat.uniforms.uDeltaTime.value = dt
    simMat.uniforms.uIsHovering.value = hp
    simMat.uniforms.uPosition.value = everRendered ? rt1.texture : posTex
    renderer.setRenderTarget(rt2)
    renderer.render(simScene, simCam)
    renderer.setRenderTarget(null)
    ;[rt1, rt2] = [rt2, rt1]
    everRendered = true
    rdrMat.uniforms.uPosition.value = rt1.texture
    rdrMat.uniforms.uTime.value = t
    rdrMat.uniforms.uIsHovering.value = hp
    rdrMat.uniforms.uPulseProgress.value = (Math.sin(t * 0.6) + 1) * 0.5
    renderer.render(scene, camera)
  }
  animate()

  // 10. Resize
  resizeHandler = () => {
    const nw = card.offsetWidth, nh = card.offsetHeight
    renderer.setSize(nw, nh, false)
    const na = nw / nh
    camera.left = -VIEW * na
    camera.right = VIEW * na
    camera.top = VIEW
    camera.bottom = -VIEW
    camera.updateProjectionMatrix()
    if (rdrMat) {
	      rdrMat.uniforms.uParticleScale.value = nw / 2000
    }
  }
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  if (canvasEl) {
    if (mouseEnterHandler) canvasEl.removeEventListener('mouseenter', mouseEnterHandler)
    if (mouseLeaveHandler) canvasEl.removeEventListener('mouseleave', mouseLeaveHandler)
  }
  if (renderer) renderer.dispose()
})
</script>
