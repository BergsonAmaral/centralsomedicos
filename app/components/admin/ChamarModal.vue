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
interface MedicoOpcao { id: string; nome: string; especialidade: string; ativo: boolean; pausado: boolean; sala_slug: string | null }
const medicos = ref<MedicoOpcao[]>([])
const medicoSelecionadoId = ref(props.agendamento.medico_id)

onMounted(async () => {
  const { data: mData } = await supabase
    .from('medicos')
    .select('id, nome, especialidade, ativo, pausado, sala_slug')
    .eq('ativo', true)
    .order('nome')
  medicos.value = mData ?? []
  medicoSelecionadoId.value = props.agendamento.medico_id
})

const medicoSelecionado = computed(() =>
  medicos.value.find(m => m.id === medicoSelecionadoId.value) ?? null
)

// Sala é sempre a sala do médico selecionado
const salaSelecionadaSlug = computed(() => medicoSelecionado.value?.sala_slug ?? null)

async function confirmar() {
  carregando.value = true
  try {
    const novoMedicoId = medicoSelecionadoId.value !== props.agendamento.medico_id
      ? medicoSelecionadoId.value ?? undefined
      : undefined

    const { error } = await fila.chamar(
      props.agendamento.id,
      novoMedicoId,
      salaSelecionadaSlug.value ?? undefined,
    )
    if (error) throw new Error(error.message)
    await fila.carregar()
    try {
      await useAdminLog().registrar('paciente_chamado', {
        entidade: 'agendamento',
        entidadeId: props.agendamento.id,
        detalhes: {
          paciente: paciente.value?.nome,
          medico: medicoSelecionado.value?.nome,
          sala: salaSelecionadaSlug.value,
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
          <option v-for="m in medicos" :key="m.id" :value="m.id">
            {{ m.nome }} — {{ m.especialidade }}{{ m.pausado ? ' (pausado)' : '' }}
          </option>
        </select>
        <p
          v-if="medicoSelecionadoId !== agendamento.medico_id"
          class="mt-1.5 text-xs font-medium"
          style="color:#f59e0b"
        >
          ⚠️ Médico diferente do agendado — o agendamento será atualizado.
        </p>
      </div>

      <!-- Sala automática do médico -->
      <div>
        <label class="block text-sm font-semibold text-[var(--color-text)] mb-2 flex items-center gap-1.5">
          <DoorOpen :size="16" style="color:#7c3aed" />
          Sala de atendimento
        </label>
        <div v-if="salaSelecionadaSlug"
          class="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm"
          style="background:#f5f3ff;border-color:#ddd6fe;color:#5b21b6"
        >
          <DoorOpen :size="15" style="color:#7c3aed;flex-shrink:0" />
          <span class="font-semibold">/sala/{{ salaSelecionadaSlug }}</span>
          <span class="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style="background:#ede9fe;color:#7c3aed">automático</span>
        </div>
        <div v-else class="text-xs p-3 rounded-lg" style="background:#fef9c3;color:#854d0e">
          ⚠️ Este médico não tem sala configurada. Edite o cadastro dele em <strong>Admin → Médicos</strong> e defina o slug da sala.
        </div>
      </div>

      <!-- Aviso -->
      <p class="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] p-3 rounded-lg border border-[var(--color-border-light)]">
        ℹ️ O médico receberá um aviso para aceitar. A tela da sala dele exibirá o nome do paciente chamado.
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

