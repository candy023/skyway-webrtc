<script setup>
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <div class="p-6 bg-gray-100 text-center">
    <h1 class="text-3xl font-bold text-indigo-600">Hello Tailwind!</h1>
    <p class="mt-2 text-gray-700">SkyWay + Vue + Tailwind の世界へようこそ</p>
  </div>
</template>


<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
