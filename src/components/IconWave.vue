<template>
  <section class="agent-first-section">
    <ul class="icon-list" ref="listRef">
      <li v-for="(name, i) in icons" :key="i">
        <div class="bouncer" :ref="el => { if (el) bouncers[i] = el }">{{ name }}</div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const icons = [
'data_object','code_blocks','dashboard_customize','commit','folder','merge', 'developer_mode_tv','keyboard_tab','code','terminal','keyboard_return','file_copy','device_hub','data_object','code_blocks','dashboard_customize'
]

const AMPLITUDE = 35
const WAVELENGTH = 1484

const listRef = ref(null)
const bouncers = ref([])
let animId = null
let phase = 0
const step = WAVELENGTH / (7 * 60)

function frame() {
  phase = (phase + step) % WAVELENGTH
  const listRect = listRef.value?.getBoundingClientRect()
  if (!listRect) { animId = requestAnimationFrame(frame); return }

  // 先计算所有图标的缩放值
  const scales = []
  for (let i = 0; i < bouncers.value.length; i++) {
    const el = bouncers.value[i]
    if (!el) { scales.push(1); continue }
    const r = el.getBoundingClientRect()
    const pos = r.left - listRect.left + r.width / 2
    const v = (pos + phase) / WAVELENGTH * Math.PI * 2
    const sc = 0.6 + 0.4 * (Math.sin(v) * 0.5 + 0.5)
    scales.push(sc)
  }

  for (let i = 0; i < bouncers.value.length; i++) {
    const el = bouncers.value[i]
    if (!el) continue
    const r = el.getBoundingClientRect()
    const pos = r.left - listRect.left + r.width / 2
    const v = (pos + phase) / WAVELENGTH * Math.PI * 2
    const ty = Math.sin(v) * AMPLITUDE
    const sc = scales[i]
    // 根据相邻图标的缩放差，水平平移来补偿空隙
    const gapL = i > 0 ? (1 - scales[i - 1]) * 25 : 0
    const gapR = i < scales.length - 1 ? (1 - scales[i + 1]) * 25 : 0
    const tx = (gapL - gapR) * 0.5
    el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(3)})`
  }
  animId = requestAnimationFrame(frame)
}

onMounted(() => {
  animId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
})
</script>
