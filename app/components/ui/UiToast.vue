<script setup lang="ts">
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'

const { toasts, remover } = useToast()

const ESTILOS = {
  sucesso: { bg: '#f0fdf4', borda: '#bbf7d0', cor: '#166534', icone: CheckCircle2 },
  erro:    { bg: '#fef2f2', borda: '#fecaca', cor: '#b91c1c', icone: AlertCircle },
  info:    { bg: '#eff6ff', borda: '#bfdbfe', cor: '#1d4ed8', icone: Info },
} as const
</script>

<template>
  <div
    class="fixed z-[200] flex flex-col gap-2 pointer-events-none"
    style="top:1rem;right:1rem;max-width:calc(100vw - 2rem);width:22rem"
  >
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg"
        :style="`background:${ESTILOS[t.tipo].bg};border:1px solid ${ESTILOS[t.tipo].borda};color:${ESTILOS[t.tipo].cor}`"
      >
        <component :is="ESTILOS[t.tipo].icone" :size="17" class="shrink-0 mt-0.5" />
        <p class="flex-1 text-sm font-medium leading-snug">{{ t.mensagem }}</p>
        <button
          type="button"
          class="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Fechar"
          @click="remover(t.id)"
        >
          <X :size="15" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.toast-enter-from { opacity: 0; transform: translateX(1.5rem); }
.toast-leave-to   { opacity: 0; transform: translateX(1.5rem); }
.toast-move       { transition: transform 0.25s ease; }
</style>
