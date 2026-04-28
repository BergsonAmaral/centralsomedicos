<script setup lang="ts">
import type { Agendamento, Medico, Sala } from '~/types'

definePageMeta({ layout: 'sala' })

const route = useRoute()
const slug = route.params.slug as string
const supabase = useSupabaseClient()

// Estado
const sala = ref<Sala | null>(null)
const medico = ref<Medico | null>(null)
const pacienteAtual = ref<Agendamento | null>(null)
const horaAtual = ref('')
const erro = ref('')

// Relógio + polling
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
  const { data } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome)')
    .eq('sala_slug', slug)
    .in('status', ['aguardando_paciente', 'em_consulta'])
    .eq('data_consulta', getHoje())
    .maybeSingle()

  if (data) {
    pacienteAtual.value = data
  } else if (!pacienteAtual.value || !['aguardando_paciente','em_consulta'].includes(pacienteAtual.value.status)) {
    pacienteAtual.value = null
  }
}

// Buscar sala pelo slug → médico associado
const { data: salaData } = await useAsyncData(
  `sala-${slug}`,
  async () => {
    const { data } = await supabase
      .from('salas')
      .select('*, medicos(id, nome, especialidade, foto_url, sala_slug)')
      .eq('slug', slug)
      .eq('ativo', true)
      .single()
    return data ?? null
  }
)

// Fallback: compatibilidade com medicos que usam sala_slug antigo
if (!salaData.value) {
  const { data: medicoLegado } = await supabase
    .from('medicos')
    .select('id, nome, especialidade, foto_url, sala_slug')
    .eq('sala_slug', slug)
    .eq('ativo', true)
    .maybeSingle()
  if (medicoLegado) {
    medico.value = medicoLegado as Medico
  } else {
    erro.value = 'Sala não encontrada ou inativa.'
  }
} else {
  sala.value = salaData.value as any
  medico.value = (salaData.value as any).medicos as Medico
}

if (medico.value || sala.value) {
  // Verificar se já há paciente ativo nesta sala agora
  const { data: ativo } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome)')
    .eq('sala_slug', slug)
    .in('status', ['aguardando_paciente', 'em_consulta'])
    .eq('data_consulta', getHoje())
    .maybeSingle()

  if (ativo) pacienteAtual.value = ativo
}

// Realtime — escuta agendamentos desta sala (por sala_slug)
onMounted(() => {
  atualizarHora()
  clockInterval = setInterval(atualizarHora, 1000)
  // Polling a cada 3s — fallback quando Realtime demora
  pollingInterval = setInterval(buscarPacienteAtivo, 3000)

  supabase
    .channel(`sala-slug-${slug}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'agendamentos',
        filter: `sala_slug=eq.${slug}`,
      },
      async (payload) => {
        if (['aguardando_paciente', 'em_consulta'].includes(payload.new.status)) {
          const { data } = await supabase
            .from('agendamentos')
            .select('*, pacientes(nome)')
            .eq('id', payload.new.id)
            .single()
          pacienteAtual.value = data
        }
        if (['aguardando_avaliacao', 'concluido', 'cancelado', 'faltou', 'checkin', 'aguardando_medico'].includes(payload.new.status)) {
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
  supabase.removeAllChannels()
})

async function entrarConsulta() {
  if (!pacienteAtual.value) return
  await supabase
    .from('agendamentos')
    .update({ status: 'em_consulta' })
    .eq('id', pacienteAtual.value.id)
}
</script>

<template>
  <div class="w-screen h-screen overflow-hidden select-none">
    <!-- Erro -->
    <div v-if="erro" class="flex items-center justify-center h-full bg-[#0c2340] text-white text-2xl">
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
