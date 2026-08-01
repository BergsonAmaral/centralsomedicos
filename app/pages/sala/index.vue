<script setup lang="ts">
import type { Agendamento, Medico } from '~/types'

definePageMeta({ layout: 'sala' })

const supabase = useSupabaseClient()

const pacienteAtual = ref<Agendamento | null>(null)
const horaAtual = ref('')

let clockInterval: ReturnType<typeof setInterval>
let pollingInterval: ReturnType<typeof setInterval>
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function buscarPacienteAtivo() {
  const { data } = await supabase
    .from('agendamentos')
    .select('*, pacientes(nome), medicos(id, nome, especialidade, sala_slug, crm, foto_url, ativo, pausado, user_id, valor_consulta, assinatura_url, created_at)')
    .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'])
    .eq('data_consulta', getHoje())
    .order('chamado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) {
    pacienteAtual.value = data
  } else if (!pacienteAtual.value || !['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'].includes(pacienteAtual.value.status)) {
    pacienteAtual.value = null
  }
}

const medicoAtual = computed<Medico | null>(() => {
  if (!pacienteAtual.value?.medicos) return null
  return pacienteAtual.value.medicos as unknown as Medico
})

onMounted(async () => {
  atualizarHora()
  clockInterval = setInterval(atualizarHora, 1000)
  await buscarPacienteAtivo()
  pollingInterval = setInterval(buscarPacienteAtivo, 3000)

  realtimeChannel = supabase
    .channel('sala-generica-realtime')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'agendamentos' },
      async (payload) => {
        if (['aguardando_medico', 'aguardando_paciente', 'em_consulta', 'aguardando_avaliacao'].includes(payload.new.status)) {
          await buscarPacienteAtivo()
        }
        if (['concluido', 'cancelado', 'faltou', 'checkin'].includes(payload.new.status)) {
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
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)
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
    <!-- Há consulta ativa: passa o médico do agendamento -->
    <SalaTelaEspera
      v-if="medicoAtual"
      :medico="medicoAtual"
      :paciente-atual="pacienteAtual"
      :hora-atual="horaAtual"
      @entrar="entrarConsulta"
    />

    <!-- Sem consulta ativa: tela de espera genérica -->
    <div
      v-else
      class="h-screen w-full flex flex-col overflow-hidden"
      style="background:linear-gradient(135deg,#0c2340 0%,#1a4a7a 100%)"
    >
      <header class="flex items-center justify-between px-10 py-6 shrink-0">
        <p class="text-sm font-mono tracking-widest uppercase" style="color:rgba(255,255,255,0.6)">SoMedicos</p>
        <p class="font-mono text-2xl font-bold tracking-widest" style="color:#ffffff">{{ horaAtual }}</p>
      </header>

      <div class="flex-1 flex flex-col items-center justify-center gap-8 px-10 text-center">
        <div class="relative">
          <div class="w-32 h-32 rounded-full flex items-center justify-center" style="background:rgba(255,255,255,0.1)">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </div>
          <div class="absolute inset-0 rounded-full animate-ping" style="border:2px solid rgba(255,255,255,0.2)" />
          <div class="absolute rounded-full animate-ping" style="inset:-12px;border:1px solid rgba(255,255,255,0.1);animation-delay:0.3s" />
        </div>
        <div>
          <h1 class="text-5xl font-bold mb-4" style="color:#ffffff">Aguardando chamada...</h1>
          <p class="text-xl" style="color:rgba(255,255,255,0.6)">Fique à vontade. Você será chamado em breve.</p>
        </div>
      </div>
    </div>
  </div>
</template>
