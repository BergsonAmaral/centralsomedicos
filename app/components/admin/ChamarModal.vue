<script setup lang="ts">
import { PhoneCall, UserCheck, DoorOpen } from 'lucide-vue-next'
import type { Agendamento } from '~/types'
import { useFila } from '~/composables/useFila'

interface Props {
  agendamento: Agendamento
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: []; chamado: [] }>()

const supabase = useSupabaseClient()
const fila = useFila()
const carregando = ref(false)

const paciente = computed(() => props.agendamento.pacientes)

// Lista de médicos disponíveis
interface MedicoOpcao { id: string; nome: string; especialidade: string; ativo: boolean; pausado: boolean }
const medicos = ref<MedicoOpcao[]>([])
const ocupadoIds = ref<Set<string>>(new Set())
const medicoSelecionadoId = ref(props.agendamento.medico_id)

async function carregarMedicos() {
  const hoje = new Date()
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const [{ data: mData }, { data: ocupData }] = await Promise.all([
    supabase.from('medicos').select('id, nome, especialidade, ativo, pausado').eq('ativo', true).order('nome'),
    supabase.from('agendamentos').select('medico_id').eq('data_consulta', dataHoje)
      .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta'])
      .neq('id', props.agendamento.id),
  ])
  medicos.value = mData ?? []
  ocupadoIds.value = new Set((ocupData ?? []).map((a) => a.medico_id))
  medicoSelecionadoId.value = props.agendamento.medico_id
}

onMounted(carregarMedicos)

function disponivel(m: MedicoOpcao): boolean {
  return !m.pausado && !ocupadoIds.value.has(m.id)
}

// Só oferece médicos livres agora — o já vinculado a este agendamento
// sempre aparece, mesmo ocupado, para não sumir da tela sem explicação.
const medicosDisponiveis = computed(() =>
  medicos.value.filter((m) => disponivel(m) || m.id === props.agendamento.medico_id)
)

// Agrupados por especialidade — cada paciente pode precisar de uma diferente.
const medicosPorEspecialidade = computed(() => {
  const grupos: Record<string, MedicoOpcao[]> = {}
  for (const m of medicosDisponiveis.value) {
    (grupos[m.especialidade] ??= []).push(m)
  }
  return grupos
})

const medicoSelecionado = computed(() =>
  medicos.value.find(m => m.id === medicoSelecionadoId.value) ?? null
)

// A sala já foi definida no check-in (é a sala física da unidade onde o
// paciente está) — aqui só se escolhe quem vai atender, não se muda a sala.
const salaAtualSlug = computed(() => props.agendamento.sala_slug ?? null)

async function confirmar() {
  carregando.value = true
  try {
    const novoMedicoId = medicoSelecionadoId.value !== props.agendamento.medico_id
      ? medicoSelecionadoId.value ?? undefined
      : undefined

    const { error } = await fila.chamar(props.agendamento.id, novoMedicoId)
    if (error) throw new Error(error.message)
    await fila.carregar()
    try {
      await useAdminLog().registrar('paciente_chamado', {
        entidade: 'agendamento',
        entidadeId: props.agendamento.id,
        detalhes: {
          paciente: paciente.value?.nome,
          medico: medicoSelecionado.value?.nome,
          sala: salaAtualSlug.value,
        },
      })
    } catch {}
    emit('chamado')
    emit('close')
  } catch (e: any) {
    alert('Erro ao chamar paciente: ' + (e?.message ?? 'tente novamente'))
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <UiModal :model-value="true" title="Chamar Paciente" size="md" @update:model-value="emit('close')">
    <div class="space-y-5">
      <!-- Paciente -->
      <div class="text-center py-3">
        <p class="text-[var(--color-text-muted)] text-sm mb-1">Chamando:</p>
        <p class="text-2xl font-bold text-[var(--color-text)]">{{ paciente?.nome }}</p>
      </div>

      <!-- Seletor de médico -->
      <div>
        <label class="block text-sm font-semibold text-[var(--color-text)] mb-2 flex items-center gap-1.5">
          <UserCheck :size="16" class="text-[var(--color-green)]" />
          Médico que irá atender
        </label>
        <select
          v-model="medicoSelecionadoId"
          class="w-full input-base py-2.5 text-sm"
        >
          <optgroup v-for="(lista, especialidade) in medicosPorEspecialidade" :key="especialidade" :label="especialidade">
            <option v-for="m in lista" :key="m.id" :value="m.id">
              {{ m.nome }}{{ !disponivel(m) ? ' — ocupado agora' : '' }}
            </option>
          </optgroup>
        </select>
        <p v-if="medicosDisponiveis.length === 0" class="mt-1.5 text-xs font-medium" style="color:#dc2626">
          Nenhum médico disponível no momento — todos estão pausados ou em consulta.
        </p>
        <p
          v-else-if="medicoSelecionadoId !== agendamento.medico_id"
          class="mt-1.5 text-xs font-medium"
          style="color:#f59e0b"
        >
          ⚠️ Médico diferente do agendado — o agendamento será atualizado.
        </p>
      </div>

      <!-- Sala: já definida no check-in, na unidade do paciente -->
      <div>
        <label class="block text-sm font-semibold text-[var(--color-text)] mb-2 flex items-center gap-1.5">
          <DoorOpen :size="16" style="color:#7c3aed" />
          Sala do paciente
        </label>
        <div v-if="salaAtualSlug"
          class="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm"
          style="background:#f5f3ff;border-color:#ddd6fe;color:#5b21b6"
        >
          <DoorOpen :size="15" style="color:#7c3aed;flex-shrink:0" />
          <span class="font-semibold">/sala/{{ salaAtualSlug }}</span>
        </div>
        <div v-else class="text-xs p-3 rounded-lg" style="background:#fef9c3;color:#854d0e">
          ⚠️ Este paciente não tem sala definida. Volte ao check-in e selecione a sala da unidade.
        </div>
      </div>

      <!-- Aviso -->
      <p class="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] p-3 rounded-lg border border-[var(--color-border-light)]">
        ℹ️ O médico receberá um aviso para aceitar. A tela da sala do paciente exibirá o nome dele quando confirmado.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Cancelar</UiButton>
      <UiButton variant="success" :loading="carregando" :disabled="!medicoSelecionadoId" @click="confirmar">
        <PhoneCall :size="16" />
        Confirmar Chamada
      </UiButton>
    </template>
  </UiModal>
</template>

