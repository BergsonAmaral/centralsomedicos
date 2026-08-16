<script setup lang="ts">
import { UserX, UserCheck, PhoneCall, Eye, Clock, Zap, Building2, Undo2, Ban } from 'lucide-vue-next'
import type { Agendamento } from '~/types'
import { useFila } from '~/composables/useFila'

interface Props {
  medicoFiltro?: string | null
  unidadeFiltro?: string | null
}

const props = withDefaults(defineProps<Props>(), { medicoFiltro: null, unidadeFiltro: null })

const fila = useFila()
const toast = useToast()

// Com pacientes chegando de várias unidades ao mesmo tempo, filtra por
// unidade no cliente (o filtro por médico já é feito no servidor).
function porUnidade(lista: Agendamento[]): Agendamento[] {
  if (!props.unidadeFiltro) return lista
  return lista.filter((a) => (a.pacientes as any)?.unidade_id === props.unidadeFiltro)
}
const agendadosFiltrados = computed(() => porUnidade(fila.agendados.value))
const filaAtivaFiltrada = computed(() => porUnidade(fila.filaAtiva.value))
const finalizadosFiltrados = computed(() => porUnidade(fila.finalizados.value))

// Modais
const checkinModal = ref<Agendamento | null>(null)
const chamarModal = ref<Agendamento | null>(null)
const verModal = ref<Agendamento | null>(null)

// Tempo de espera em minutos
function tempoEspera(checkinEm: string | null): string {
  if (!checkinEm) return '—'
  const diff = Date.now() - new Date(checkinEm).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`
}

function duracaoConsulta(ag: Agendamento): string {
  if (!ag.chamado_em || !ag.encerrado_em) return '—'
  const diff = new Date(ag.encerrado_em).getTime() - new Date(ag.chamado_em).getTime()
  return `${Math.round(diff / 60000)}min`
}

function horaFormatada(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const marcandoFaltou = ref<string | null>(null)
const entradaDireta = ref<string | null>(null)

async function fazerEntradaDireta(ag: Agendamento) {
  entradaDireta.value = ag.id
  try {
    const { error } = await fila.fazerCheckin(ag.id, {})
    if (error) throw new Error((error as any).message)
    await fila.carregar()
  } catch (e: any) {
    alert('Erro: ' + (e?.message ?? 'tente novamente'))
  } finally {
    entradaDireta.value = null
  }
}

async function confirmarFaltou(id: string) {
  marcandoFaltou.value = id
  try {
    const { error } = await fila.marcarFaltou(id)
    if (error) throw new Error(error.message)
    await fila.carregar()
    toast.sucesso('Paciente marcado como falta.')
  } catch (e: any) {
    toast.erro('Erro ao marcar faltou: ' + (e?.message ?? 'tente novamente'))
  } finally {
    marcandoFaltou.value = null
  }
}

// ── Autonomia do admin sobre atendimentos já encaminhados ──────────
// Sem isso, um paciente encaminhado ficava preso: se o médico não
// respondia ou o paciente desistia, não havia como desfazer.
const revertendo = ref<string | null>(null)

async function voltarParaFila(ag: Agendamento) {
  const nome = ag.pacientes?.nome ?? 'este paciente'
  if (!confirm(`Cancelar o encaminhamento e devolver ${nome} para a fila?`)) return
  revertendo.value = ag.id
  try {
    const { error } = await fila.voltarParaFila(ag.id)
    if (error) throw new Error(error.message)
    await fila.carregar()
    toast.sucesso('Paciente devolvido para a fila.')
  } catch (e: any) {
    toast.erro('Erro ao devolver para a fila: ' + (e?.message ?? 'tente novamente'))
  } finally {
    revertendo.value = null
  }
}

async function cancelarAtendimento(ag: Agendamento) {
  const nome = ag.pacientes?.nome ?? 'este paciente'
  if (!confirm(`Cancelar definitivamente o atendimento de ${nome}?`)) return
  revertendo.value = ag.id
  try {
    const { error } = await fila.cancelarAtendimento(ag.id)
    if (error) throw new Error(error.message)
    await fila.carregar()
    toast.sucesso('Atendimento cancelado.')
  } catch (e: any) {
    toast.erro('Erro ao cancelar: ' + (e?.message ?? 'tente novamente'))
  } finally {
    revertendo.value = null
  }
}
const tick = ref(0)
let interval: ReturnType<typeof setInterval>
onMounted(() => { interval = setInterval(() => tick.value++, 60000) })
onUnmounted(() => clearInterval(interval))
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

    <!-- ===========================
         COLUNA 1 — AGENDADOS
         =========================== -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-[var(--color-text)]">Agendados</h3>
        <span class="badge badge-agendado">{{ agendadosFiltrados.length }}</span>
      </div>

      <div v-if="agendadosFiltrados.length === 0" class="card p-6 text-center text-[var(--color-text-dim)] text-sm">
        Nenhum paciente agendado
      </div>

      <div
        v-for="ag in agendadosFiltrados"
        :key="ag.id"
        class="card p-4 space-y-3"
      >
        <div>
          <div class="flex items-center justify-between gap-2">
            <p class="font-semibold text-[var(--color-text)]">{{ ag.pacientes?.nome }}</p>
            <span v-if="ag.pacientes?.unidades?.nome" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style="background:#e8eef8;color:#1e4d9a">
              <Building2 :size="10" /> {{ ag.pacientes.unidades.nome }}
            </span>
          </div>
          <p class="text-xs text-[var(--color-text-muted)]">{{ ag.medicos?.nome }}</p>
          <p v-if="ag.motivo" class="text-xs text-[var(--color-text-dim)] mt-1 truncate">{{ ag.motivo }}</p>
        </div>
        <div class="space-y-2">
          <div class="flex gap-2">
            <UiButton variant="primary" size="sm" class="flex-1" title="Check-in com triagem e sinais vitais" @click="checkinModal = ag">
              <UserCheck :size="14" /> Check-in
            </UiButton>
            <UiButton variant="ghost" size="sm" title="Marcar como falta" @click="confirmarFaltou(ag.id)" :loading="marcandoFaltou === ag.id">
              <UserX :size="14" />
            </UiButton>
          </div>
          <UiButton
            variant="ghost"
            size="sm"
            class="w-full"
            title="Coloca o paciente direto na fila, pulando a triagem"
            :loading="entradaDireta === ag.id"
            @click="fazerEntradaDireta(ag)"
          >
            <Zap :size="13" style="color:#f59e0b" /> Entrada rápida (sem triagem)
          </UiButton>
        </div>
      </div>
    </div>

    <!-- ===========================
         COLUNA 2 — FILA ATIVA
         =========================== -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-[var(--color-text)]">Fila Ativa</h3>
        <span class="badge badge-checkin">{{ filaAtivaFiltrada.length }}</span>
      </div>

      <div v-if="filaAtivaFiltrada.length === 0" class="card p-6 text-center text-[var(--color-text-dim)] text-sm">
        Nenhum na fila
      </div>

      <div
        v-for="(ag, index) in filaAtivaFiltrada"
        :key="ag.id"
        :class="[
          'card p-4 space-y-3',
          index === 0 ? 'border-[var(--color-green)] shadow-[var(--shadow-md)]' : '',
        ]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs font-mono font-bold text-[var(--color-text-muted)]">
                {{ index + 1 }}º
              </span>
              <p class="font-semibold text-[var(--color-text)] truncate">{{ ag.pacientes?.nome }}</p>
            </div>
            <p class="text-xs text-[var(--color-text-muted)]">{{ ag.medicos?.nome }}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span v-if="ag.pacientes?.unidades?.nome" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style="background:#e8eef8;color:#1e4d9a">
                <Building2 :size="10" /> {{ ag.pacientes.unidades.nome }}
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

        <UiButton
          v-if="ag.status === 'checkin'"
          variant="success"
          size="sm"
          class="w-full"
          @click="chamarModal = ag"
        >
          <PhoneCall :size="14" /> Encaminhar →
        </UiButton>

        <!-- Já encaminhado: mostra o status e mantém o controle com o admin -->
        <div v-else class="space-y-2">
          <div
            class="w-full text-center text-xs font-semibold py-2 rounded-lg"
            :style="ag.status === 'em_consulta'
              ? 'background:#dcfce7;color:#166534'
              : 'background:#fef9c3;color:#854d0e'"
          >
            {{
              ag.status === 'aguardando_medico' ? 'Chamando médico…'
              : ag.status === 'aguardando_paciente' ? 'Aguardando paciente entrar…'
              : 'Em consulta'
            }}
          </div>
          <div class="flex gap-2">
            <UiButton
              variant="ghost"
              size="sm"
              class="flex-1"
              title="Desfaz o encaminhamento e devolve o paciente para a fila"
              :loading="revertendo === ag.id"
              @click="voltarParaFila(ag)"
            >
              <Undo2 :size="13" /> Voltar p/ fila
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              title="Cancelar definitivamente este atendimento"
              :loading="revertendo === ag.id"
              @click="cancelarAtendimento(ag)"
            >
              <Ban :size="13" style="color:#dc2626" />
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- ===========================
         COLUNA 3 — FINALIZADOS
         =========================== -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-[var(--color-text)]">Finalizados Hoje</h3>
        <span class="badge badge-concluido">{{ finalizadosFiltrados.length }}</span>
      </div>

      <div v-if="finalizadosFiltrados.length === 0" class="card p-6 text-center text-[var(--color-text-dim)] text-sm">
        Nenhum finalizado
      </div>

      <div
        v-for="ag in finalizadosFiltrados"
        :key="ag.id"
        class="card p-4 space-y-2"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="font-medium text-[var(--color-text)] truncate text-sm">{{ ag.pacientes?.nome }}</p>
              <span v-if="ag.pacientes?.unidades?.nome" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style="background:#e8eef8;color:#1e4d9a">
                <Building2 :size="10" /> {{ ag.pacientes.unidades.nome }}
              </span>
            </div>
            <p class="text-xs text-[var(--color-text-muted)]">{{ ag.medicos?.nome }}</p>
            <p class="text-xs text-[var(--color-text-dim)] mt-0.5">
              {{ horaFormatada(ag.chamado_em) }} → {{ horaFormatada(ag.encerrado_em) }}
              · {{ duracaoConsulta(ag) }}
            </p>
          </div>
          <UiBadge :variant="ag.status as any" />
        </div>
        <UiButton variant="ghost" size="sm" @click="verModal = ag">
          <Eye :size="13" /> Ver
        </UiButton>
      </div>
    </div>
  </div>

  <!-- Modais -->
  <AdminCheckinModal
    v-if="checkinModal"
    :agendamento="checkinModal"
    @close="checkinModal = null"
  />

  <AdminChamarModal
    v-if="chamarModal"
    :agendamento="chamarModal"
    @close="chamarModal = null"
    @chamado="chamarModal = null"
  />

  <!-- Modal Prontuário somente leitura -->
  <UiModal v-if="verModal" :model-value="true" title="Detalhes da Consulta" size="md" @update:model-value="verModal = null">
    <div class="space-y-3 text-sm">
      <p><strong>Paciente:</strong> {{ verModal.pacientes?.nome }}</p>
      <p><strong>Médico:</strong> {{ verModal.medicos?.nome }}</p>
      <p><strong>Status:</strong> <UiBadge :variant="verModal.status as any" /></p>
      <p><strong>Motivo:</strong> {{ verModal.motivo ?? '—' }}</p>
      <p v-if="verModal.triagem?.obs"><strong>Observações triagem:</strong> {{ verModal.triagem.obs }}</p>
      <div class="grid grid-cols-2 gap-3 mt-2">
        <div class="p-2 rounded bg-[var(--color-surface-2)]">
          <p class="text-xs text-[var(--color-text-muted)]">Chamado em</p>
          <p class="font-medium">{{ horaFormatada(verModal.chamado_em) }}</p>
        </div>
        <div class="p-2 rounded bg-[var(--color-surface-2)]">
          <p class="text-xs text-[var(--color-text-muted)]">Encerrado em</p>
          <p class="font-medium">{{ horaFormatada(verModal.encerrado_em) }}</p>
        </div>
      </div>
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="verModal = null">Fechar</UiButton>
    </template>
  </UiModal>
</template>
