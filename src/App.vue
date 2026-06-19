<template>
  <div class="loading" id="loading">生成粒子中…</div>
  <DownloadCard />
  <IconWave />
  <div class="typer-section" ref="typerRef">
	    <Typer v-if="typerVisible" :repeat="0" :erase-delay="9999999" :erase-style="'clear'" :type-delay="50" text="Google Antigravity is our agentic development platform, allowing anyone to build in the agent-first era." />
  </div>
  <section class="try-solutions-section">
    <div class="try-grid">
      <div class="try-card-wrap">
        <div class="morphing-card">
          <MorphCard
            imageUrl="/braces.png"
            color1="#318bf7"
            color2="#b3d9ff"
            :scale="1.5"
            :yOffset="0.1"
          />
          <div class="morph-overlay left">
            <span class="morph-badge">Available at no charge</span>
            <h2 class="morph-title">
              <span class="morph-title-bold">For developers</span>
              <span class="morph-title-light">那很糟诶</span>
            </h2>
            <a class="morph-btn morph-btn-primary" href="#">Download</a>
          </div>
        </div>
      </div>
      <div class="try-card-wrap">
        <div class="morphing-card">
          <MorphCard
            imageUrl="/cube.png"
            color1="#318bf7"
            color2="#b3d9ff"
            :scale="1.5"
            :yOffset="0"
          />
          <div class="morph-overlay right">
            <span class="morph-badge">Now Available!</span>
            <h2 class="morph-title">
              <span class="morph-title-bold">For organizations</span>
              <span class="morph-title-light">哎都死了算了</span>
            </h2>
            <a class="morph-btn morph-btn-secondary" href="#">Read More</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Typer } from 'vue3-typer'
import 'vue3-typer/dist/vue-typer.css'
import DownloadCard from './components/DownloadCard.vue'
import IconWave from './components/IconWave.vue'
import MorphCard from './components/MorphCard.vue'

const typerRef = ref(null)
const typerVisible = ref(false)
let observer = null

onMounted(() => {
  if (!typerRef.value) return
  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      typerVisible.value = true
      observer.disconnect()
    }
  }, { threshold: 0.3 })
  observer.observe(typerRef.value)
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
})
</script>
