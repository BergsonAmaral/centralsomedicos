<script setup lang="ts">
import { AlertTriangle, PhoneCall } from 'lucide-vue-next'
import type { Agendamento } from '~/types'

defineProps<{ fila: Agendamento[] }>()
const emit = defineEmits<{ chamar: [id: string] }>()

const chamando = ref<string | null>(null)

async function chamarPaciente(id: string) {
  chamando.value = id
  try {
    emit('chamar', id)
  } finally {
    setTimeout(() => { chamando.value = null }, 2000)
  }
}

function calcularIdade(dataNasc: string | null): number | null {
  if (!dataNasc) return null
  const hoje = new Date()
  const nasc = new Date(dataNasc)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  if (hoje.getMonth() - nasc.getMonth() < 0) idade--
  return idade
}

function tempoEspera(checkin: string | null): string {
  if (!checkin) return '—'
  const min = Math.floor((Date.now() - new Date(checkin).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60}min`
}
</script>

<template>
  <ol class="space-y-2">
    <li
      v-for="(ag, i) in fila"
      :key="ag.id"
      class="flex items-center gap-3 p-3 rounded-xl transition-colors border"
      :style="i === 0
        ? 'background:#f0fdf4;border-color:#bbf7d0'
        : 'background:white;border-color:#e2e8f0'"
    >
      <!-- Posição -->
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
        :style="i === 0 ? 'background:#16a34a;color:white' : 'background:#f1f5f9;color:#64748b'"
      >
        {{ i + 1 }}
      </div>

      <UiAvatar :name="(ag.pacientes as any)?.nome" size="sm" />

      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-[var(--color-text)] truncate">
          {{ (ag.pacientes as any)?.nome }}
        </p>
        <p class="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
          <span>{{ calcularIdade((ag.pacientes as any)?.data_nascimento) ?? '—' }} anos</span>
          <span style="color:#cbd5e1">•</span>
          <span>aguardando há {{ tempoEspera(ag.checkin_em) }}</span>
          <template v-if="ag.sala_slug">
            <span style="color:#cbd5e1">•</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:#ede9fe;color:#7c3aed">
              {{ ag.sala_slug }}
            </span>
          </template>
        </p>
      </div>

      <!-- Triagem (alertas compactos) -->
      <div class="flex flex-col gap-1 items-end shrink-0">
        <span
          v-if="ag.triagem?.urgencia"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
          style="background:#fef2f2;color:#b91c1c"
        >
          <AlertTriangle :size="9" /> URG
        </span>
        <div class="flex gap-1">
          <span v-if="ag.triagem?.alergia" title="Alergia" class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:#fff7ed;color:#c2410c">A</span>
          <span v-if="ag.triagem?.febre" title="Febre" class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:#fefce8;color:#a16207">F</span>
        </div>
        <button
          type="button"
          :disabled="chamando === ag.id"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          style="background:#16a34a;color:white"
          @click="chamarPaciente(ag.id)"
        >
          <PhoneCall :size="11" />
          {{ chamando === ag.id ? 'Chamando…' : 'Chamar' }}
        </button>
      </div>
    </li>
  </ol>
</template>
