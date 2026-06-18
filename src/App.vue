<template>
  <div class="loading" id="loading">生成粒子中…</div>
  <DownloadCard />
  <IconWave />
  <section class="try-solutions-section">
    <div class="try-grid">
      <div class="try-card-wrap">
        <div class="morphing-card">
          <MorphCard
            imageUrl="/individual.png"
            color1="#318bf7"
            color2="#bada4c"
            color3="#e35058"
            :scale="1.3"
            :yOffset="0.1"
          />
          <MorphCard
            imageUrl="/cube.png"
            color1="#aecbfa"
            color2="#aecbfa"
            color3="#93bbfc"
            :scale="1.2"
            :yOffset="0.05"
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
