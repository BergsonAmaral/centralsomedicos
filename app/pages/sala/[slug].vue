<script setup lang="ts">
import type { Agendamento, Sala } from '~/types'

definePageMeta({ layout: 'sala' })

const route = useRoute()
const slug = route.params.slug as string
const supabase = useSupabaseClient()

const sala = ref<Sala | null>(null)
const pacienteAtual = ref<Agendamento | null>(null)
const horaAtual = ref('')
const erro = ref('')
const medicoOcupado = ref(false)
const posicaoFila = ref(0) // 0 = não sabe / não se aplica; 1 = próximo; 2+ = quantos na frente

const unidadeNome = computed(() => sala.value?.unidades?.nome ?? '')

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

// Escolhe, entre os agendamentos ativos da sala, qual mostrar. Uma
// avaliação nunca respondida (paciente foi embora sem votar) fica presa em
// "aguardando_avaliacao" e não deve bloquear o próximo paciente chamado
// para a mesma sala — por isso um atendimento em andamento sempre tem
// prioridade sobre uma avaliação pendente.
function escolherAtivo(lista: Agendamento[]): Agendamento | null {
  return lista.find((a) => a.status !== 'aguardando_avaliacao') ?? lista[0] ?? null
}

async function buscarPacienteAtivo() {
  const { data } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome), medicos(id, nome, especialidade)')
    .eq('sala_slug', slug)
    .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'])
    .eq('data_consulta', getHoje())

  pacienteAtual.value = escolherAtivo(data ?? [])
  await checarMedicoOcupado()
}

// Enquanto o paciente espera o médico aceitar (aguardando_medico), verifica
// (1) se esse médico já está em outro atendimento agora e (2) quantos
// outros pacientes já estão na fila dele há mais tempo — pra não dizer
// "você é o próximo" quando na verdade tem mais gente na frente (nada
// impede dois atendentes encaminharem pacientes diferentes pro mesmo
// médico livre ao mesmo tempo).
async function checarMedicoOcupado() {
  const p = pacienteAtual.value
  if (!p || p.status !== 'aguardando_medico' || !p.medico_id) {
    medicoOcupado.value = false
    posicaoFila.value = 0
    return
  }

  const [ocupadoRes, filaRes] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id')
      .eq('medico_id', p.medico_id)
      .eq('status', 'em_consulta')
      .neq('id', p.id)
      .limit(1),
    supabase
      .from('agendamentos')
      .select('id, chamado_em')
      .eq('medico_id', p.medico_id)
      .eq('status', 'aguardando_medico')
      .eq('data_consulta', getHoje()),
  ])

  medicoOcupado.value = (ocupadoRes.data?.length ?? 0) > 0

  const fila = (filaRes.data ?? []) as { id: string; chamado_em: string | null }[]
  const minhaChamada = fila.find((a) => a.id === p.id)?.chamado_em ?? p.chamado_em
  const naFrente = minhaChamada
    ? fila.filter((a) => a.id !== p.id && (a.chamado_em ?? '') < minhaChamada).length
    : 0
  posicaoFila.value = naFrente + 1
}

// Buscar a sala (e a unidade dona dela) pelo slug
const { data: salaData } = await useAsyncData(
  `sala-${slug}`,
  async () => {
    const { data } = await supabase
      .from('salas')
      .select('*, unidades(id, nome, tipo)')
      .eq('slug', slug)
      .eq('ativo', true)
      .single()
    return data ?? null
  }
)

if (!salaData.value) {
  erro.value = 'Sala não encontrada ou inativa.'
} else {
  sala.value = salaData.value as Sala

  const { data: ativos } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome), medicos(id, nome, especialidade)')
    .eq('sala_slug', slug)
    .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'])
    .eq('data_consulta', getHoje())

  pacienteAtual.value = escolherAtivo(ativos ?? [])
  await checarMedicoOcupado()
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

// Navegadores atrasam (ou pausam) setInterval em abas em segundo plano —
// se a sala ficar minimizada ou atrás de outra janela por um tempo, o
// polling de 3s pode não rodar. Ao voltar o foco, força uma busca na hora
// em vez de esperar o próximo ciclo, para não ficar com o status atrasado.
function aoVoltarFoco() {
  if (document.visibilityState === 'visible') buscarPacienteAtivo()
}

onMounted(() => {
  atualizarHora()
  clockInterval = setInterval(atualizarHora, 1000)
  pollingInterval = setInterval(buscarPacienteAtivo, 3000)

  window.addEventListener('pagehide', avisarSaidaSeEmConsulta)
  document.addEventListener('visibilitychange', aoVoltarFoco)
  window.addEventListener('focus', aoVoltarFoco)

  if (!sala.value) return

  supabase
    .channel(`sala-${slug}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'agendamentos',
        filter: `sala_slug=eq.${slug}`,
      },
      async (payload) => {
        if (['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'].includes(payload.new.status)) {
          const { data } = await supabase
            .from('agendamentos')
            .select('*, pacientes(nome), medicos(id, nome, especialidade)')
            .eq('id', payload.new.id)
            .single()
          pacienteAtual.value = data
          await checarMedicoOcupado()
        }
        if (['concluido', 'cancelado', 'faltou', 'checkin', 'agendado'].includes(payload.new.status)) {
          if (pacienteAtual.value?.id === payload.new.id) {
            pacienteAtual.value = null
            medicoOcupado.value = false
            posicaoFila.value = 0
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
  document.removeEventListener('visibilitychange', aoVoltarFoco)
  window.removeEventListener('focus', aoVoltarFoco)
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
      v-else-if="sala"
      :unidade-nome="unidadeNome"
      :sala-nome="sala?.nome ?? ''"
      :sala-slug="slug"
      :paciente-atual="pacienteAtual"
      :hora-atual="horaAtual"
      :medico-ocupado="medicoOcupado"
      :posicao-fila="posicaoFila"
      @entrar="entrarConsulta"
    />
  </div>
</template>
