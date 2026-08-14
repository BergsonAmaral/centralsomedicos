<script setup lang="ts">
// Não existe mais "sala genérica" — cada sala pertence a uma unidade
// específica, acessada sempre por /sala/[slug]. Esta página só orienta
// quem cair aqui sem slug (link antigo, favorito desatualizado, etc).
definePageMeta({ layout: 'sala' })

const horaAtual = ref('')
let clockInterval: ReturnType<typeof setInterval>

function atualizarHora() {
  const now = new Date()
  horaAtual.value = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

onMounted(() => {
  atualizarHora()
  clockInterval = setInterval(atualizarHora, 1000)
})

onUnmounted(() => clearInterval(clockInterval))
</script>

<template>
  <div class="w-screen h-screen overflow-hidden select-none">
    <div
      class="h-screen w-full flex flex-col overflow-hidden"
      style="background:linear-gradient(135deg,#0c2340 0%,#1a4a7a 100%)"
    >
      <header class="flex items-center justify-between px-10 py-6 shrink-0">
        <p class="text-sm font-mono tracking-widest uppercase" style="color:rgba(255,255,255,0.6)">SoMedicos</p>
        <p class="font-mono text-2xl font-bold tracking-widest" style="color:#ffffff">{{ horaAtual }}</p>
      </header>

      <div class="flex-1 flex flex-col items-center justify-center gap-8 px-10 text-center">
        <div class="relative">
          <div class="w-32 h-32 rounded-full flex items-center justify-center" style="background:rgba(255,255,255,0.1)">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </div>
          <div class="absolute inset-0 rounded-full animate-ping" style="border:2px solid rgba(255,255,255,0.2)" />
          <div class="absolute rounded-full animate-ping" style="inset:-12px;border:1px solid rgba(255,255,255,0.1);animation-delay:0.3s" />
        </div>
        <div>
          <h1 class="text-5xl font-bold mb-4" style="color:#ffffff">Link de sala inválido</h1>
          <p class="text-xl" style="color:rgba(255,255,255,0.6)">Peça à recepção o link correto da sua sala de atendimento.</p>
        </div>
      </div>
    </div>
  </div>
</template>
