<script setup lang="ts">
const props = defineProps<{
  roomId: string
  displayName?: string
}>()

const container = ref<HTMLElement | null>(null)
const erro = ref('')
let callFrame: any = null

async function iniciar() {
  erro.value = ''
  try {
    const { url, token } = await $fetch<{ url: string; token: string }>('/api/daily/token', {
      method: 'POST',
      body: { agendamentoId: props.roomId, nomeExibicao: props.displayName ?? 'Usuário' },
    })

    if (!container.value) return

    const DailyIframe = (await import('@daily-co/daily-js')).default
    callFrame?.destroy()
    callFrame = DailyIframe.createFrame(container.value, {
      url,
      token,
      showLeaveButton: false,
      iframeStyle: { width: '100%', height: '100%', border: '0' },
    })
    await callFrame.join()
  } catch (e: any) {
    erro.value = e?.data?.message ?? e?.message ?? 'Não foi possível entrar na videochamada.'
  }
}

onMounted(() => {
  iniciar()
})

onUnmounted(() => {
  callFrame?.destroy()
  callFrame = null
})
</script>

<template>
  <div style="width:100%;height:100%;background:#000 url('/logo.png') center/120px no-repeat;position:relative">
    <div ref="container" style="width:100%;height:100%" />
    <div
      v-if="erro"
      class="absolute inset-0 flex items-center justify-center text-center p-6"
      style="background:rgba(0,0,0,0.85);color:white"
    >
      <p class="text-sm">{{ erro }}</p>
    </div>
  </div>
</template>
