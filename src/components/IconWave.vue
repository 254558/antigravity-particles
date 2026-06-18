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
  'plus_code','deployed_code','spark','search_spark','data_object','refresh',
  'code_blocks','dashboard_customize','commit','spark','folder','merge',
  'developer_mode_tv','keyboard_tab','code','terminal','keyboard_return',
  'file_copy','device_hub','pen_spark','keyboard_command_key','check_circle'
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
  for (let i = 0; i < bouncers.value.length; i++) {
    const el = bouncers.value[i]
    if (!el) continue
    const r = el.getBoundingClientRect()
    const pos = r.left - listRect.left + r.width / 2
    const v = (pos + phase) / WAVELENGTH * Math.PI * 2
    const ty = Math.sin(v) * AMPLITUDE
    el.style.transform = `translateY(${ty.toFixed(2)}px)`
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
