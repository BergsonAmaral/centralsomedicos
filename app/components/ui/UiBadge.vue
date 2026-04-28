<script setup lang="ts">
import type { AgendamentoStatus } from '~/types'

type BadgeVariant =
  | AgendamentoStatus
  | 'urgencia'
  | 'alergia'
  | 'febre'
  | 'online'
  | 'pausado'
  | 'offline'
  | 'info'
  | 'warning'

interface Props {
  variant: BadgeVariant
  pulsing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pulsing: false,
})

const labelMap: Record<BadgeVariant, string> = {
  agendado: 'Agendado',
  checkin: 'Check-in',
  aguardando_medico: 'Aguardando Médico',
  aguardando_paciente: 'Aguardando Paciente',
  em_consulta: 'Em Consulta',
  aguardando_avaliacao: 'Em Avaliação',
  concluido: 'Concluído',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
  urgencia: 'URGÊNCIA',
  alergia: 'ALERGIA',
  febre: 'FEBRE',
  online: 'Online',
  pausado: 'Pausado',
  offline: 'Offline',
  info: 'Info',
  warning: 'Atenção',
}

const styleMap: Record<BadgeVariant, string> = {
  agendado: 'badge-agendado',
  checkin: 'badge-checkin',
  aguardando_medico: 'bg-[#fef3c7] text-[#92400e]',
  aguardando_paciente: 'bg-[#dbeafe] text-[#1e40af]',
  em_consulta: 'badge-em_consulta',
  aguardando_avaliacao: 'bg-[#ede9fe] text-[#6d28d9]',
  concluido: 'badge-concluido',
  faltou: 'badge-faltou',
  cancelado: 'badge-cancelado',
  urgencia: 'badge-urgencia',
  alergia: 'bg-[#fef3c7] text-[#92400e]',
  febre: 'bg-[#fee2e2] text-[#991b1b]',
  online: 'bg-[var(--color-green-pale)] text-[var(--color-green-dark)]',
  pausado: 'bg-[#fef3c7] text-[#92400e]',
  offline: 'bg-[#f1f5f9] text-[#64748b]',
  info: 'bg-[var(--color-blue-pale)] text-[var(--color-blue-dark)]',
  warning: 'bg-[#fef3c7] text-[#92400e]',
}

const showDot = computed(() =>
  ['em_consulta', 'online', 'aguardando_medico', 'aguardando_paciente'].includes(props.variant) || props.pulsing
)
</script>

<template>
  <span :class="['badge', styleMap[variant]]">
    <span
      v-if="showDot"
      class="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot"
    />
    <slot>{{ labelMap[variant] }}</slot>
  </span>
</template>
