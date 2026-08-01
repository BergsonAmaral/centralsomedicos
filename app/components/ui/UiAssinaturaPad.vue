<script setup lang="ts">
/**
 * UiAssinaturaPad — Canvas para captura de assinatura manuscrita.
 * Emite 'save' com o Blob PNG quando o usuário confirmar.
 * Emite 'clear' quando limpar.
 */
const emit = defineEmits<{
  save: [blob: Blob]
  clear: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const desenhando = ref(false)
const temTraço = ref(false)

function getCtx() {
  const canvas = canvasRef.value
  if (!canvas) return null
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  return ctx
}

function getCoordenadas(e: MouseEvent | TouchEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  if ('touches' in e) {
    const t = e.touches[0]
    return {
      x: (t.clientX - rect.left) * scaleX,
      y: (t.clientY - rect.top) * scaleY,
    }
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

function iniciar(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  const ctx = getCtx()
  if (!ctx) return
  desenhando.value = true
  temTraço.value = true
  const { x, y } = getCoordenadas(e)
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function desenhar(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  if (!desenhando.value) return
  const ctx = getCtx()
  if (!ctx) return
  const { x, y } = getCoordenadas(e)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function parar(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  desenhando.value = false
}

function limpar() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  temTraço.value = false
  emit('clear')
}

function salvar() {
  const canvas = canvasRef.value
  if (!canvas || !temTraço.value) return
  canvas.toBlob((blob) => {
    if (blob) emit('save', blob)
  }, 'image/png')
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  // DPI nítido em telas retina
  const dpr = window.devicePixelRatio ?? 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
})
</script>

<template>
  <div class="space-y-2">
    <div
      class="relative rounded-xl border-2 border-dashed overflow-hidden select-none"
      style="border-color:#cbd5e1;background:#fafafa;touch-action:none"
    >
      <canvas
        ref="canvasRef"
        class="w-full block"
        style="height:140px;cursor:crosshair"
        @mousedown="iniciar"
        @mousemove="desenhar"
        @mouseup="parar"
        @mouseleave="parar"
        @touchstart="iniciar"
        @touchmove="desenhar"
        @touchend="parar"
      />
      <p
        v-if="!temTraço"
        class="absolute inset-0 flex items-center justify-center text-sm pointer-events-none"
        style="color:#94a3b8"
      >
        Assine aqui com o mouse ou toque
      </p>
    </div>

    <div class="flex gap-2 justify-end">
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
        style="background:white;color:#64748b;border-color:#e2e8f0"
        @click="limpar"
      >
        Limpar
      </button>
      <button
        type="button"
        :disabled="!temTraço"
        class="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
        style="background:#2563eb;color:white"
        @click="salvar"
      >
        Salvar assinatura
      </button>
    </div>
  </div>
</template>
