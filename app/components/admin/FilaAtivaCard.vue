<script setup lang="ts">
import { PhoneCall, Pencil, Undo2, Ban, DoorOpen, Clock } from 'lucide-vue-next'
import type { Agendamento } from '~/types'

defineProps<{
  ag: Agendamento
  indice: number
  revertendo: string | null
}>()

const emit = defineEmits<{
  chamar: [ag: Agendamento]
  checkin: [ag: Agendamento]
  voltar: [ag: Agendamento]
  cancelar: [ag: Agendamento]
}>()

function tempoEspera(checkinEm: string | null): string {
  if (!checkinEm) return '—'
  const diff = Date.now() - new Date(checkinEm).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`
}

function horaFormatada(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div :class="['card p-4 space-y-3', indice === 0 ? 'border-[var(--color-green)] shadow-[var(--shadow-md)]' : '']">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-0.5">
          <span class="text-xs font-mono font-bold text-[var(--color-text-muted)]">{{ indice + 1 }}º</span>
          <p class="font-semibold text-[var(--color-text)] truncate">{{ ag.pacientes?.nome }}</p>
        </div>
        <p class="text-xs text-[var(--color-text-muted)]">
          {{ ag.medicos?.nome }}<span v-if="ag.medicos?.especialidade"> · {{ ag.medicos.especialidade }}</span>
        </p>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span v-if="ag.sala_slug" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style="background:#f5f3ff;color:#7c3aed">
            <DoorOpen :size="10" /> {{ ag.sala_slug }}
          </span>
          <div class="flex items-center gap-1 text-xs text-[var(--color-text-dim)]">
            <Clock :size="11" />
            {{ horaFormatada(ag.checkin_em) }} · {{ tempoEspera(ag.checkin_em) }} espera
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-1 shrink-0">
        <UiBadge v-if="ag.triagem?.urgencia" variant="urgencia" />
        <UiBadge v-if="ag.triagem?.alergia" variant="alergia" />
        <UiBadge v-if="ag.triagem?.febre" variant="febre" />
      </div>
    </div>

    <!-- Ainda na fila: dá para corrigir a triagem antes de encaminhar -->
    <div v-if="ag.status === 'checkin'" class="flex gap-2">
      <UiButton variant="success" size="sm" class="flex-1" @click="emit('chamar', ag)">
        <PhoneCall :size="14" /> Encaminhar →
      </UiButton>
      <UiButton variant="ghost" size="sm" title="Editar triagem, sinais vitais e sala" @click="emit('checkin', ag)">
        <Pencil :size="13" />
      </UiButton>
    </div>

    <!-- Já encaminhado: mostra o status e mantém o controle com o admin -->
    <div v-else class="space-y-2">
      <div
        class="w-full text-center text-xs font-semibold py-2 rounded-lg"
        :style="ag.status === 'em_consulta' ? 'background:#dcfce7;color:#166534' : 'background:#fef9c3;color:#854d0e'"
      >
        {{
          ag.status === 'aguardando_medico' ? 'Chamando médico…'
          : ag.status === 'aguardando_paciente' ? 'Aguardando paciente entrar…'
          : 'Em consulta'
        }}
      </div>
      <div class="flex gap-2">
        <UiButton
          variant="ghost" size="sm" class="flex-1"
          title="Desfaz o encaminhamento e devolve o paciente para a fila"
          :loading="revertendo === ag.id"
          @click="emit('voltar', ag)"
        >
          <Undo2 :size="13" /> Voltar p/ fila
        </UiButton>
        <UiButton
          variant="ghost" size="sm"
          title="Cancelar definitivamente este atendimento"
          :loading="revertendo === ag.id"
          @click="emit('cancelar', ag)"
        >
          <Ban :size="13" style="color:#dc2626" />
        </UiButton>
      </div>
    </div>
  </div>
</template>
