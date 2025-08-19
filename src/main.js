import { createApp } from 'vue';
import App from './App.vue';
import { ensureSession, setupAuthDebugListener } from './lib/supabaseClient.js';

async function bootstrap() {
  try {
    setupAuthDebugListener();   // 任意
    await ensureSession();      // 匿名セッション確立
  } catch (e) {
    console.error('[bootstrap] failed to establish session', e);
  }
  createApp(App).mount('#app');
}

bootstrap();