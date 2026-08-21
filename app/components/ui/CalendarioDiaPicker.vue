<script setup lang="ts">
import { ChevronLeft, CalendarDays } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string // '' = nenhum dia específico selecionado
  diasComEventos?: Set<string>
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
  'mes-mudou': [{ inicio: string; fim: string }]
}>()

const aberto = ref(false)
const mesVisivel = ref(new Date())

function fmtDataYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dataLocalHoje(): string {
  return fmtDataYMD(new Date())
}

function emitirMesVisivel() {
  const ano = mesVisivel.value.getFullYear()
  const mes = mesVisivel.value.getMonth()
  emit('mes-mudou', { inicio: fmtDataYMD(new Date(ano, mes, 1)), fim: fmtDataYMD(new Date(ano, mes + 1, 0)) })
}

watch(mesVisivel, emitirMesVisivel)
watch(aberto, (val) => { if (val) emitirMesVisivel() })

const diasDoMes = computed(() => {
  const ano = mesVisivel.value.getFullYear()
  const mes = mesVisivel.value.getMonth()
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const dias: { data: string; numero: number; foraDoMes: boolean }[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const d = new Date(ano, mes, i - primeiroDiaSemana + 1)
    dias.push({ data: fmtDataYMD(d), numero: d.getDate(), foraDoMes: true })
  }
  for (let dia = 1; dia <= totalDias; dia++) {
    dias.push({ data: fmtDataYMD(new Date(ano, mes, dia)), numero: dia, foraDoMes: false })
  }
  while (dias.length % 7 !== 0) {
    const anterior = dias[dias.length - 1]
    if (!anterior) break
    const ultimo = new Date(anterior.data + 'T12:00:00')
    ultimo.setDate(ultimo.getDate() + 1)
    dias.push({ data: fmtDataYMD(ultimo), numero: ultimo.getDate(), foraDoMes: true })
  }
  return dias
})

const nomeMesVisivel = computed(() =>
  mesVisivel.value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
)

function mudarMes(delta: number) {
  mesVisivel.value = new Date(mesVisivel.value.getFullYear(), mesVisivel.value.getMonth() + delta, 1)
}

function escolherDia(data: string) {
  emit('update:modelValue', data)
  aberto.value = false
}

function limpar() {
  emit('update:modelValue', '')
  aberto.value = false
}

function alternarAberto() {
  mesVisivel.value = props.modelValue ? new Date(props.modelValue + 'T12:00:00') : new Date()
  aberto.value = !aberto.value
}
</script>

<template>
  <div class="relative inline-block">
    <button
      type="button"
      class="px-3 py-1.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors"
      :class="modelValue
        ? 'bg-[#0a1f14] text-white border-[#0a1f14]'
        : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'"
      @click="alternarAberto"
    >
      <CalendarDays :size="12" />
      {{ modelValue ? new Date(modelValue + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Escolher dia' }}
    </button>

    <div
      v-if="aberto"
      class="absolute left-0 top-full mt-2 z-20 bg-white rounded-2xl border shadow-lg p-3"
      style="border-color:var(--color-border);width:280px"
    >
      <div class="flex items-center justify-between mb-2">
        <button type="button" class="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]" @click="mudarMes(-1)">
          <ChevronLeft :size="16" />
        </button>
        <p class="text-sm font-semibold capitalize" style="color:var(--color-text)">{{ nomeMesVisivel }}</p>
        <button type="button" class="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]" style="transform:scaleX(-1)" @click="mudarMes(1)">
          <ChevronLeft :size="16" />
        </button>
      </div>
      <div class="grid grid-cols-7 gap-1 mb-1">
        <span v-for="d in ['D','S','T','Q','Q','S','S']" :key="d" class="text-center text-[10px] font-bold" style="color:var(--color-text-dim)">{{ d }}</span>
      </div>
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="d in diasDoMes" :key="d.data"
          type="button"
          class="relative aspect-square rounded-lg text-xs font-medium transition-colors"
          :disabled="d.foraDoMes"
          :style="[
            d.foraDoMes ? 'color:var(--color-text-dim);opacity:0.35' : 'color:var(--color-text)',
            d.data === modelValue ? 'background:#0a1f14;color:white;font-weight:700' : d.data === dataLocalHoje() ? 'background:var(--color-surface-2);font-weight:700' : '',
          ]"
          @click="!d.foraDoMes && escolherDia(d.data)"
        >
          {{ d.numero }}
          <span
            v-if="diasComEventos?.has(d.data) && d.data !== modelValue"
            class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style="background:#16a34a"
          />
        </button>
      </div>
      <button
        type="button"
        class="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold"
        style="background:var(--color-surface-2);color:var(--color-text-muted)"
        @click="escolherDia(dataLocalHoje())"
      >Hoje</button>
      <button
        v-if="modelValue"
        type="button"
        class="w-full mt-1 py-1.5 rounded-lg text-xs font-semibold"
        style="background:#fef2f2;color:#dc2626"
        @click="limpar"
      >Limpar dia</button>
    </div>
  </div>
</template>
