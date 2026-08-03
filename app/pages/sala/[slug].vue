<script setup lang="ts">
import type { Agendamento, Medico } from '~/types'

definePageMeta({ layout: 'sala' })

const route = useRoute()
const slug = route.params.slug as string
const supabase = useSupabaseClient()

const medico = ref<Medico | null>(null)
const pacienteAtual = ref<Agendamento | null>(null)
const horaAtual = ref('')
const erro = ref('')

let clockInterval: ReturnType<typeof setInterval>
let pollingInterval: ReturnType<typeof setInterval>

function atualizarHora() {
  const now = new Date()
  horaAtual.value = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

async function buscarPacienteAtivo() {
  if (!medico.value) return
  const { data } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome), medicos(id, nome, especialidade)')
    .eq('medico_id', medico.value.id)
    .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'])
    .eq('data_consulta', getHoje())
    .maybeSingle()

  pacienteAtual.value = data ?? null
}

// Buscar médico pelo sala_slug
const { data: medicoData } = await useAsyncData(
  `medico-sala-${slug}`,
  async () => {
    const { data } = await supabase
      .from('medicos')
      .select('*')
      .eq('sala_slug', slug)
      .eq('ativo', true)
      .single()
    return data ?? null
  }
)

if (!medicoData.value) {
  erro.value = 'Sala não encontrada ou médico inativo.'
} else {
  medico.value = medicoData.value as Medico

  const { data: ativo } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome), medicos(id, nome, especialidade)')
    .eq('medico_id', medico.value.id)
    .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'])
    .eq('data_consulta', getHoje())
    .maybeSingle()

  if (ativo) pacienteAtual.value = ativo
}

// Se o paciente fechar a aba/navegador durante a consulta, avisa o servidor
// via sendBeacon (funciona mesmo com a página descarregando) para o médico
// não ficar preso numa consulta fantasma.
function avisarSaidaSeEmConsulta() {
  if (pacienteAtual.value?.status === 'em_consulta') {
    const payload = JSON.stringify({ agendamentoId: pacienteAtual.value.id, quem: 'paciente' })
    navigator.sendBeacon('/api/agendamentos/desconectar', new Blob([payload], { type: 'application/json' }))
  }
}

onMounted(() => {
  atualizarHora()
  clockInterval = setInterval(atualizarHora, 1000)
  pollingInterval = setInterval(buscarPacienteAtivo, 3000)

  window.addEventListener('pagehide', avisarSaidaSeEmConsulta)

  if (!medico.value) return

  supabase
    .channel(`sala-medico-${medico.value.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'agendamentos',
        filter: `medico_id=eq.${medico.value.id}`,
      },
      async (payload) => {
        if (['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'].includes(payload.new.status)) {
          const { data } = await supabase
            .from('agendamentos')
            .select('*, pacientes(nome), medicos(id, nome, especialidade)')
            .eq('id', payload.new.id)
            .single()
          pacienteAtual.value = data
        }
        if (['concluido', 'cancelado', 'faltou', 'checkin', 'agendado'].includes(payload.new.status)) {
          if (pacienteAtual.value?.id === payload.new.id) {
            pacienteAtual.value = null
          }
        }
      }
    )
    .subscribe()
})

onUnmounted(() => {
  clearInterval(clockInterval)
  clearInterval(pollingInterval)
  window.removeEventListener('pagehide', avisarSaidaSeEmConsulta)
  supabase.removeAllChannels()
})

async function entrarConsulta() {
  if (!pacienteAtual.value) return
  const { data, error } = await supabase
    .from('agendamentos')
    .update({ status: 'em_consulta' })
    .eq('id', pacienteAtual.value.id)
    .eq('status', 'aguardando_paciente')
    .select()
    .maybeSingle()

  if (error || !data) {
    alert('Não foi possível entrar na consulta agora. Atualize a página e tente novamente.')
    return
  }
  pacienteAtual.value = data
}
</script>

<template>
  <div class="w-screen h-screen overflow-hidden select-none">
    <div v-if="erro" class="flex items-center justify-center h-full text-white text-2xl font-bold" style="background:#071526">
      {{ erro }}
    </div>

    <SalaTelaEspera
      v-else-if="medico"
      :medico="medico"
      :paciente-atual="pacienteAtual"
      :hora-atual="horaAtual"
      @entrar="entrarConsulta"
    />
  </div>
</template>
