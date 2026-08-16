<script setup lang="ts">
const props = defineProps<{
  roomId: string
  displayName?: string
}>()

const container = ref<HTMLElement | null>(null)
let api: any = null

const roomName = computed(() =>
  `somedicos-${props.roomId.replace(/-/g, '').slice(0, 20)}`
)

async function initJitsi() {
  // Carrega o script da External API se ainda não foi carregado
  if (!(window as any).JitsiMeetExternalAPI) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Falha ao carregar Jitsi API'))
      document.head.appendChild(script)
    })
  }

  if (!container.value) return

  // Destrói instância anterior se existir
  api?.dispose()

  api = new (window as any).JitsiMeetExternalAPI('meet.jit.si', {
    roomName: roomName.value,
    parentNode: container.value,
    width: '100%',
    height: '100%',
    userInfo: {
      displayName: props.displayName ?? 'Usuário',
      // Mostrado como avatar sempre que a câmera está desligada (e antes de
      // ligar), em vez do círculo genérico com as iniciais.
      avatarURL: `${window.location.origin}/logo.png`,
    },
    configOverwrite: {
      prejoinPageEnabled: false,
      prejoinConfig: { enabled: false },
      startWithVideoMuted: false,
      startWithAudioMuted: false,
      disableDeepLinking: true,
      disableThirdPartyRequests: false,
    },
    interfaceConfigOverwrite: {
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      MOBILE_APP_PROMO: false,
      TOOLBAR_BUTTONS: [
        'microphone', 'camera', 'desktop', 'fullscreen',
        'fodeviceselection', 'hangup', 'chat', 'settings',
        'videoquality', 'tileview', 'closedcaptions', 'select-background',
      ],
    },
  })

  // Aplica a imagem de fundo da SóMedicos na câmera automaticamente, sem
  // precisar que a pessoa abra o menu e escolha manualmente. Continua
  // trocável a qualquer momento pelo botão "select-background" na barra.
  api.addEventListener('videoConferenceJoined', () => {
    try {
      api.setVirtualBackground(true, `${window.location.origin}/fundo-videochamada.jpg`)
    } catch { /* segue sem fundo virtual se o navegador não suportar */ }
  })
}

onMounted(() => {
  initJitsi()
})

onUnmounted(() => {
  api?.dispose()
  api = null
})
</script>

<template>
  <!-- Fundo com a logo enquanto o Jitsi ainda está carregando/conectando -->
  <div
    ref="container"
    style="width:100%;height:100%;background:#000 url('/logo.png') center/120px no-repeat"
  />
</template>
