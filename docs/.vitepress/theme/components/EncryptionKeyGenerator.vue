<script setup lang="ts">
import { onMounted, ref } from 'vue'

const key = ref('')
const copied = ref(false)

function generateKey() {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  key.value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  copied.value = false
}

async function copyKey() {
  if (!key.value) return
  await navigator.clipboard.writeText(key.value)
  copied.value = true
}

onMounted(generateKey)
</script>

<template>
  <div class="keygen">
    <label class="keygen-label" for="encryption-key">ENCRYPTION_KEY</label>
    <div class="keygen-row">
      <input id="encryption-key" :value="key" readonly spellcheck="false">
      <button type="button" @click="copyKey">{{ copied ? '已复制' : '复制' }}</button>
      <button type="button" @click="generateKey">重新生成</button>
    </div>
  </div>
</template>

<style scoped>
.keygen {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}

.keygen-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

.keygen-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
}

input {
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

button {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  background: var(--vp-c-brand-1);
  color: white;
  font-size: 13px;
  cursor: pointer;
}

button + button {
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

@media (max-width: 640px) {
  .keygen-row {
    grid-template-columns: 1fr;
  }
}
</style>
