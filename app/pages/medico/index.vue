<script setup lang="ts">
import { Video, PauseCircle, PlayCircle, Clock, X, ChevronRight, Check, Bell } from 'lucide-vue-next'

definePageMeta({ layout: 'medico', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const filaStore = useFilaStore()
const fila = useFila()

const pausado = ref(false)
const encerrandoModal = ref(false)
const evolucao = ref('')
const salvando = ref(false)
const processandoAceite = ref(false)

const timerSeg = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

// Painel lateral durante a consulta: alterna entre dados do paciente e
// documentos sem precisar rolar a tela — o médico troca com 1 clique,
// sem sair da chamada.
// Abre em "paciente" por padrão — é onde ficam a triagem e os sinais
// vitais do check-in. Começar em "documentos" escondia essas informações
// atrás de um clique que o médico não sabia que precisava dar.
const sidebarTab = ref<'paciente' | 'documentos'>('paciente')

const emConsulta = computed(() => {
  const ag = filaStore.filaAtiva.find((a) => a.status === 'em_consulta')
  return ag ?? null
})

// Paciente que o admin chamou e está aguardando o médico aceitar
const aguardandoAceite = computed(() =>
  filaStore.filaAtiva.find((a) => a.status === 'aguardando_medico') ?? null
)

// Paciente que o médico já aceitou e está aguardando o paciente entrar
const aguardandoPaciente = computed(() =>
  filaStore.filaAtiva.find((a) => a.status === 'aguardando_paciente') ?? null
)

// No Jitsi público (sem autenticação), quem entra primeiro na sala vira o
// anfitrião. Antes o médico só entrava quando o status virava "em_consulta"
// — mas o paciente entra na sala assim que clica "Entrar", antes desse
// status ser confirmado, então o paciente quase sempre chegava primeiro e
// ficava com os controles de anfitrião. Agora o médico entra assim que
// aceita (aguardando_paciente), garantindo que chegue primeiro.
const consultaAtiva = computed(() => emConsulta.value ?? aguardandoPaciente.value)

// Volta pra aba "Paciente" a cada novo atendimento — se o médico ficou na
// aba Documentos na consulta anterior, a próxima já abria escondendo a
// triagem de novo.
watch(() => consultaAtiva.value?.id, (novoId, antigoId) => {
  if (novoId && novoId !== antigoId) sidebarTab.value = 'paciente'
})

const proximosFila = computed(() =>
  filaStore.filaAtiva.filter((a) => a.status === 'checkin')
)

// Som ao chegar nova chamada
function tocarBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch { /* silencioso */ }
}

watch(aguardandoAceite, (val, prev) => {
  if (val && !prev) tocarBeep()
})

async function aceitarPaciente() {
  if (!aguardandoAceite.value) return
  processandoAceite.value = true
  try {
    await fila.aceitarMedico(aguardandoAceite.value.id)
  } finally {
    processandoAceite.value = false
  }
}

async function recusarPaciente() {
  if (!aguardandoAceite.value) return
  processandoAceite.value = true
  try {
    await fila.recusarMedico(aguardandoAceite.value.id)
  } finally {
    processandoAceite.value = false
  }
}

// Médico chama diretamente da fila (sem precisar do admin)
async function medicoIniciar(id: string) {
  await fila.medicoIniciarConsulta(id)
  await fila.carregar(authStore.medicoId!)
}

function iniciarTimer() {
  timerSeg.value = 0
  timerInterval = setInterval(() => timerSeg.value++, 1000)
}

function pararTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
}

function formatarTimer(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60).toString().padStart(2, '0')
  const s = (seg % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

watch(emConsulta, (val) => {
  if (val) iniciarTimer()
  else pararTimer()
}, { immediate: true })

async function togglePausa() {
  if (!authStore.medicoId) return
  pausado.value = !pausado.value
  await supabase.from('medicos').update({ pausado: pausado.value }).eq('id', authStore.medicoId)
}

const erroEncerrar = ref('')

async function encerrarConsulta() {
  if (!emConsulta.value) return
  salvando.value = true
  erroEncerrar.value = ''
  try {
    const agendamentoId = emConsulta.value.id
    const duracaoMin = Math.round(timerSeg.value / 60)
    const pacienteId = (emConsulta.value.pacientes as any)?.id
    const pacienteNome = (emConsulta.value.pacientes as any)?.nome
    const medicoIdAtual = emConsulta.value.medico_id
    const salaSlugAtual = emConsulta.value.sala_slug ?? null

    // 1. Atualiza o status primeiro — isso é o mais importante
    const { error: errEncerrar } = await fila.encerrar(agendamentoId)
    if (errEncerrar) throw new Error((errEncerrar as any).message)

    const evolucaoCapturada = evolucao.value || null
    pararTimer()
    encerrandoModal.value = false
    evolucao.value = ''

    // 2. Salva a consulta em background (não bloqueia o fluxo)
    supabase
      .from('consultas')
      .insert({
        agendamento_id: agendamentoId,
        paciente_id: pacienteId,
        medico_id: medicoIdAtual,
        evolucao: evolucaoCapturada,
        duracao_minutos: duracaoMin,
      })
      .select('id')
      .single()
      .then(({ data: consulta }) => {
        if (consulta?.id) {
          // Vincula documentos à consulta
          supabase
            .from('documentos')
            .update({ consulta_id: consulta.id })
            .eq('agendamento_id', agendamentoId)
            .is('consulta_id', null)
            .then(() => {})
        }
        useAdminLog().registrar('consulta_encerrada', {
          entidade: 'consulta',
          entidadeId: consulta?.id,
          detalhes: { paciente: pacienteNome, duracao_minutos: duracaoMin },
        }).catch(() => {})
      })
      .catch(() => {}) // falha silenciosa — status já foi atualizado

    // 3. Chama automaticamente o próximo paciente em checkin
    await fila.carregar(medicoIdAtual)
    const proximo = filaStore.filaAtiva.find((a) => a.status === 'checkin')
    if (proximo && medicoIdAtual) {
      await fila.chamar(proximo.id, medicoIdAtual, salaSlugAtual ?? undefined)
      await fila.carregar(medicoIdAtual)
    }
  } catch (e: any) {
    erroEncerrar.value = e?.message ?? 'Erro ao encerrar consulta'
  } finally {
    salvando.value = false
  }
}

let pollInterval: ReturnType<typeof setInterval> | null = null

async function iniciarPainel() {
  const id = authStore.medicoId
  if (!id) return
  await fila.carregar(id)
  fila.subscrever(id)
  const { data } = await supabase.from('medicos').select('pausado').eq('id', id).single()
  pausado.value = data?.pausado ?? false
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(() => fila.carregar(authStore.medicoId!), 10000)
}

// Se o médico fechar a aba/navegador durante a consulta, avisa o servidor
// via sendBeacon para o paciente não ficar preso numa consulta fantasma.
function avisarSaidaSeEmConsulta() {
  if (emConsulta.value?.status === 'em_consulta') {
    const payload = JSON.stringify({ agendamentoId: emConsulta.value.id, quem: 'medico' })
    navigator.sendBeacon('/api/agendamentos/desconectar', new Blob([payload], { type: 'application/json' }))
  }
}

onMounted(async () => {
  // Aguarda o perfil carregar caso ainda não esteja disponível
  if (!authStore.medicoId) {
    await authStore.loadProfile()
  }
  await iniciarPainel()
  window.addEventListener('pagehide', avisarSaidaSeEmConsulta)
})

onUnmounted(() => {
  fila.desinscrever()
  pararTimer()
  if (pollInterval) clearInterval(pollInterval)
  window.removeEventListener('pagehide', avisarSaidaSeEmConsulta)
})
</script>

<template>
  <div>
    <!-- ============================================ -->
    <!--  ESTADO 1: SEM PACIENTE — aguardando         -->
    <!-- ============================================ -->
    <div v-if="!emConsulta" class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text)]">Painel do Médico</h1>
          <p class="text-[var(--color-text-muted)] text-sm mt-1">
            {{ authStore.medicoData?.especialidade ?? '—' }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          :style="pausado
            ? 'background:#16a34a;color:white'
            : 'background:white;color:#a16207;border:1px solid #fde68a'"
          @click="togglePausa"
        >
          <component :is="pausado ? PlayCircle : PauseCircle" :size="16" />
          {{ pausado ? 'Retomar atendimento' : 'Pausar atendimento' }}
        </button>
      </div>

      <!-- Hero: aguardando -->
      <div
        class="rounded-2xl p-8 text-center"
        style="background:linear-gradient(135deg,#0a1f14,#0f3322);color:white"
      >
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style="background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3)"
        >
          <Clock :size="28" style="color:#4ade80" />
        </div>
        <p class="text-xl font-bold mb-1">
          {{ pausado ? 'Atendimento pausado' : 'Aguardando próximo paciente' }}
        </p>
        <p class="text-sm" style="color:#94a3b8">
          {{ proximosFila.length > 0 ? `${proximosFila.length} paciente(s) na fila` : 'Fila vazia no momento' }}
        </p>
        <div class="inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full text-xs font-medium" :style="pausado ? 'background:rgba(251,191,36,0.15);color:#fde68a' : 'background:rgba(74,222,128,0.15);color:#86efac'">
          <span class="w-1.5 h-1.5 rounded-full" :style="`background:${pausado ? '#fbbf24' : '#4ade80'};${!pausado ? 'animation:pulse 2s infinite' : ''}`" />
          {{ pausado ? 'Pausado' : 'Online' }}
        </div>
      </div>

      <!-- Próximos -->
      <div class="bg-white rounded-xl border" style="border-color:var(--color-border)">
        <div class="px-5 py-4 flex items-center justify-between" style="border-bottom:1px solid var(--color-border-light)">
          <h2 class="font-semibold text-[var(--color-text)]">Fila de pacientes</h2>
          <span class="text-xs px-2 py-0.5 rounded-full font-semibold" style="background:#f1f5f9;color:#475569">
            {{ proximosFila.length }}
          </span>
        </div>
        <div v-if="proximosFila.length === 0" class="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
          Nenhum paciente na fila.
        </div>
        <div v-else class="p-3">
          <MedicoProximosFila :fila="proximosFila" @chamar="medicoIniciar" />
        </div>
      </div>
    </div>

    <!-- ============================================ -->
    <!--  ESTADO 2: EM CONSULTA — integrado na página  -->
    <!-- ============================================ -->
    <Teleport to="#medico-main">
      <div
        v-if="consultaAtiva"
        class="absolute inset-0 z-[100] flex flex-col lg:flex-row"
        style="background:#0f172a"
      >
        <!-- ── Painel de vídeo (esquerda/topo) ── -->
        <div class="flex flex-col min-h-0" style="flex:1 1 0%;min-height:40vh">
          <!-- Top bar compacto -->
          <div class="flex items-center gap-3 px-4 py-2 shrink-0" style="background:#0a1f14">
            <UiAvatar :name="(consultaAtiva.pacientes as any)?.nome" size="xs" />
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-bold uppercase tracking-wider" style="color:#4ade80">
                {{ emConsulta ? 'Em consulta' : 'Aguardando paciente entrar' }}
              </p>
              <p class="text-white text-sm font-semibold truncate">{{ (consultaAtiva.pacientes as any)?.nome }}</p>
            </div>
            <span class="font-mono font-bold text-sm hidden lg:block" style="color:#4ade80">{{ formatarTimer(timerSeg) }}</span>
          </div>
          <!-- Jitsi Meet integrado (oculto quando modal está aberto para evitar que iframe sobreponha overlay).
               Monta já em "aguardando_paciente" (antes do paciente entrar) para o médico ser o primeiro
               a entrar na sala do Jitsi e virar anfitrião automaticamente. -->
          <div class="flex-1 min-h-0">
            <UiJitsiMeet
              v-if="!encerrandoModal"
              :room-id="consultaAtiva.id"
              :display-name="authStore.medicoData?.nome ?? 'Médico'"
            />
          </div>
        </div>

        <!-- ── Painel lateral: documentos (direita/baixo) ── -->
        <div
          class="consult-sidebar flex flex-col min-h-0 shrink-0 overflow-hidden"
          style="background:#1e293b"
        >
          <!-- Header -->
          <div class="shrink-0 px-4 py-3 flex items-center justify-between" style="background:#0f172a;border-bottom:1px solid #334155">
            <div class="min-w-0">
              <p class="text-[11px] font-bold uppercase tracking-wider" style="color:#94a3b8">Prontuário</p>
              <p class="text-white text-sm font-semibold truncate">{{ (consultaAtiva.pacientes as any)?.nome }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="emConsulta" class="font-mono font-bold" style="color:#4ade80">{{ formatarTimer(timerSeg) }}</span>
              <button
                v-if="emConsulta"
                type="button"
                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold"
                style="background:#dc2626;color:white"
                @click="encerrandoModal = true"
              >
                <X :size="13" /> Encerrar
              </button>
            </div>
          </div>
          <!-- Fila mini -->
          <div
            v-if="proximosFila.length > 0"
            class="shrink-0 px-4 py-2 flex items-center gap-2"
            style="background:#0f172a;border-bottom:1px solid #1e293b"
          >
            <span class="text-[10px] font-bold uppercase tracking-wider shrink-0" style="color:#94a3b8">Fila:</span>
            <div class="flex gap-1.5 overflow-x-auto">
              <span
                v-for="(ag, i) in proximosFila.slice(0, 3)"
                :key="ag.id"
                class="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
                :style="i === 0 ? 'background:#166534;color:#86efac' : 'background:#334155;color:#94a3b8'"
              >
                {{ (ag.pacientes as any)?.nome?.split(' ')[0] }}
              </span>
              <span v-if="proximosFila.length > 3" class="text-xs shrink-0" style="color:#64748b">+{{ proximosFila.length - 3 }}</span>
            </div>
          </div>
          <!-- Abas fixas: alterna sem rolar a tela, sem sair da chamada -->
          <div class="shrink-0 flex gap-1 px-3 pt-3" style="background:#1e293b">
            <button
              type="button"
              class="flex-1 py-2 rounded-t-lg text-sm font-semibold transition-colors"
              :style="sidebarTab === 'paciente'
                ? 'background:white;color:#0f172a'
                : 'background:#0f172a;color:#94a3b8'"
              @click="sidebarTab = 'paciente'"
            >
              Paciente
            </button>
            <button
              type="button"
              class="flex-1 py-2 rounded-t-lg text-sm font-semibold transition-colors"
              :style="sidebarTab === 'documentos'
                ? 'background:white;color:#0f172a'
                : 'background:#0f172a;color:#94a3b8'"
              @click="sidebarTab = 'documentos'"
            >
              Documentos
            </button>
          </div>

          <!-- Conteúdo rolável -->
          <div class="flex-1 overflow-y-auto p-4" style="background:white">
            <MedicoPacienteAtual v-if="sidebarTab === 'paciente'" :agendamento="consultaAtiva" />
            <MedicoDocumentoForm
              v-if="sidebarTab === 'documentos' && authStore.medicoData && authStore.medicoId"
              :agendamento="consultaAtiva"
              :medico-id="authStore.medicoId"
              :medico-nome="authStore.medicoData.nome"
              :medico-c-r-m="authStore.medicoData.crm"
              :medico-especialidade="authStore.medicoData.especialidade"
              :medico-assinatura-url="authStore.medicoData.assinatura_url"
            />
          </div>
        </div>

        <!-- Modal encerrar (inline dentro do Teleport) -->
        <div
          v-if="encerrandoModal"
          class="absolute inset-0 z-10 flex items-center justify-center p-4"
          style="background:rgba(0,0,0,0.8);backdrop-filter:blur(4px)"
        >
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="px-6 py-4" style="border-bottom:1px solid #e2e8f0">
              <p class="font-bold text-slate-900">Encerrar consulta</p>
              <p class="text-xs text-slate-500 mt-0.5">Registre a evolução clínica antes de finalizar.</p>
            </div>
            <div class="p-6">
              <label class="block text-xs font-semibold uppercase tracking-wide mb-1.5" style="color:#475569">
                Evolução clínica
              </label>
              <textarea
                v-model="evolucao"
                rows="6"
                class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style="border-color:#e2e8f0"
                placeholder="Diagnóstico, conduta, evolução..."
              />
              <p v-if="erroEncerrar" class="mt-2 text-xs font-semibold rounded-lg px-3 py-2" style="background:#fef2f2;color:#b91c1c">
                {{ erroEncerrar }}
              </p>
            </div>
            <div class="px-6 pb-5 flex justify-end gap-2">
              <button
                type="button"
                class="px-4 py-2 rounded-lg text-sm font-medium"
                style="background:#f1f5f9;color:#475569"
                @click="encerrandoModal = false"
              >Cancelar</button>
              <button
                type="button"
                :disabled="salvando"
                class="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                style="background:#dc2626;color:white"
                @click="encerrarConsulta"
              >{{ salvando ? 'Salvando…' : 'Salvar e encerrar' }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal encerrar (fora da consulta — fallback) -->
    <UiModal
      v-if="encerrandoModal && !consultaAtiva"
      :model-value="true"
      title="Encerrar consulta"
      size="md"
      @update:model-value="encerrandoModal = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-[var(--color-text-muted)]">
          Registre a evolução clínica antes de finalizar. Será adicionada ao histórico do paciente.
        </p>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">
            Evolução clínica
          </label>
          <textarea
            v-model="evolucao"
            rows="6"
            class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style="border-color:#e2e8f0"
            placeholder="Diagnóstico, conduta, evolução..."
          />
        </div>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="encerrandoModal = false">Cancelar</UiButton>
        <UiButton variant="danger" :loading="salvando" @click="encerrarConsulta">
          Salvar e encerrar
        </UiButton>
      </template>
    </UiModal>

    <!-- Modal de chamada (admin chamou — médico precisa aceitar) -->
    <Teleport to="#medico-main">
      <Transition name="fade">
        <div
          v-if="aguardandoAceite"
          class="absolute inset-0 z-[60] flex items-center justify-center p-4"
          style="background:rgba(15,23,42,0.7);backdrop-filter:blur(4px)"
        >
          <div
            class="rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-pulse-ring"
            style="background:white"
          >
            <!-- Header -->
            <div class="px-6 py-5 text-center" style="background:linear-gradient(135deg,#0a1f14,#0f3322);color:white">
              <div
                class="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
                style="background:rgba(74,222,128,0.2);border:2px solid rgba(74,222,128,0.4);animation:bell 0.5s ease infinite alternate"
              >
                <Bell :size="26" style="color:#86efac" />
              </div>
              <p class="text-xs uppercase tracking-widest font-bold" style="color:#86efac">Nova chamada</p>
              <p class="text-lg font-bold mt-1">Paciente aguardando você</p>
            </div>

            <!-- Body -->
            <div class="p-6 space-y-3">
              <div class="flex items-center gap-3">
                <UiAvatar :name="(aguardandoAceite.pacientes as any)?.nome" size="md" />
                <div class="min-w-0 flex-1">
                  <p class="font-bold text-base text-[var(--color-text)] truncate">
                    {{ (aguardandoAceite.pacientes as any)?.nome }}
                  </p>
                  <p class="text-xs text-[var(--color-text-muted)]">
                    {{ aguardandoAceite.motivo ?? 'Sem motivo informado' }}
                  </p>
                </div>
              </div>

              <div v-if="aguardandoAceite.triagem?.urgencia || aguardandoAceite.triagem?.alergia || aguardandoAceite.triagem?.febre" class="flex flex-wrap gap-1.5">
                <span v-if="aguardandoAceite.triagem?.urgencia" class="px-2 py-0.5 rounded-full text-[11px] font-bold" style="background:#fef2f2;color:#b91c1c">URGÊNCIA</span>
                <span v-if="aguardandoAceite.triagem?.alergia" class="px-2 py-0.5 rounded-full text-[11px] font-bold" style="background:#fff7ed;color:#c2410c">Alergia</span>
                <span v-if="aguardandoAceite.triagem?.febre" class="px-2 py-0.5 rounded-full text-[11px] font-bold" style="background:#fefce8;color:#a16207">Febre</span>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 pb-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                :disabled="processandoAceite"
                class="px-4 py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                style="background:#f1f5f9;color:#475569"
                @click="recusarPaciente"
              >
                Recusar
              </button>
              <button
                type="button"
                :disabled="processandoAceite"
                class="px-4 py-3 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                style="background:#16a34a;color:white"
                @click="aceitarPaciente"
              >
                <Check :size="16" /> Aceitar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Faixa: aguardando paciente entrar (após médico ter aceitado) -->
    <Teleport to="#medico-main">
      <Transition name="fade">
        <div
          v-if="aguardandoPaciente && !emConsulta"
          class="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3"
          style="background:#0a1f14;color:white;border:1px solid #16a34a;white-space:nowrap"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:#4ade80;animation:pulse 1.5s infinite" />
          <p class="text-sm">
            Aguardando <strong>{{ (aguardandoPaciente.pacientes as any)?.nome }}</strong> entrar na consulta…
          </p>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
@keyframes bell {
  from { transform: rotate(-8deg); }
  to   { transform: rotate(8deg); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.4); }
}
.animate-pulse-ring {
  animation: pulseRing 1.4s ease-in-out infinite;
}
@keyframes pulseRing {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6), 0 25px 60px rgba(0,0,0,0.5); }
  50%      { box-shadow: 0 0 0 12px rgba(34,197,94,0), 0 25px 60px rgba(0,0,0,0.5); }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Layout do painel lateral durante consulta */
.consult-sidebar {
  width: 100%;
  max-height: 50vh;
  border-top: 1px solid #334155;
}
@media (min-width: 1024px) {
  .consult-sidebar {
    width: 420px;
    max-height: 100%;
    height: 100%;
    border-top: none;
    border-left: 1px solid #334155;
  }
}
</style>
