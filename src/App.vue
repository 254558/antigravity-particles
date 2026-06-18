<template>
  <div class="loading" id="loading">生成粒子中…</div>
  <DownloadCard />
  <IconWave />
  <section class="try-solutions-section">
    <div class="try-grid">
      <div class="try-card-wrap">
        <div class="morphing-card">
          <MorphCard
            imageUrl="/braces.png"
            color1="#050a14"
            color2="#318bf7"
            :scale="1.5"
            :yOffset="0.1"
          />
        </div>
      </div>
      <div class="try-card-wrap">
        <div class="morphing-card">
          <MorphCard
            imageUrl="/cube.png"
            color1="#050a14"
            color2="#318bf7"
            :scale="1.5"
            :yOffset="0"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import DownloadCard from './components/DownloadCard.vue'
import IconWave from './components/IconWave.vue'
import MorphCard from './components/MorphCard.vue'
</script>
