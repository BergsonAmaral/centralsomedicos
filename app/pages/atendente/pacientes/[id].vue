<script setup lang="ts">
import { ArrowLeft, Search } from 'lucide-vue-next'
import type { Paciente, Agendamento, Documento, AgendamentoStatus, Consulta } from '~/types'

definePageMeta({ layout: 'atendente', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const { resolverUrlAssinada } = useDocumentos()
const route = useRoute()
const id = route.params.id as string
const voltar = () => navigateTo('/atendente/pacientes')

async function abrirDocumento(pathOuLink: string) {
  const url = await resolverUrlAssinada(pathOuLink)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

const paciente = ref<Paciente | null>(null)
const agendamentos = ref<Agendamento[]>([])
const documentos = ref<Documento[]>([])
const consultas = ref<Consulta[]>([])
const carregando = ref(true)

const consultaPorAgendamento = computed(() => {
  const mapa: Record<string, Consulta> = {}
  for (const c of consultas.value) if (c.agendamento_id) mapa[c.agendamento_id] = c
  return mapa
})

// Filtros do histórico
const filtroStatus = ref<AgendamentoStatus | ''>('')
const filtroPeriodo = ref<'todos' | 'futuros' | 'passados' | 'mes'>('todos')
const buscaMotivo = ref('')

onMounted(async () => {
  // RLS já restringe tudo isso ao paciente estar na unidade da atendente —
  // não filtra por médico em nenhuma dessas consultas, então o histórico
  // vem completo, de qualquer médico que já atendeu.
  const [pacRes, agRes, docRes, consRes] = await Promise.all([
    supabase.from('pacientes').select('*').eq('id', id).single(),
    supabase.from('agendamentos').select('*, medicos(nome, especialidade)').eq('paciente_id', id).order('data_consulta', { ascending: false }),
    supabase.from('documentos').select('*, medicos(nome)').eq('paciente_id', id).order('created_at', { ascending: false }),
    supabase.from('consultas').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
  ])
  paciente.value = pacRes.data
  agendamentos.value = (agRes.data ?? []) as Agendamento[]
  documentos.value = docRes.data ?? []
  consultas.value = (consRes.data ?? []) as Consulta[]
  carregando.value = false
})

const STATUS_LABELS: Record<AgendamentoStatus, string> = {
  agendado: 'Agendado',
  checkin: 'Check-in',
  aguardando_medico: 'Aguard. médico',
  aguardando_paciente: 'Aguard. paciente',
  em_consulta: 'Em consulta',
  concluido: 'Concluído',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
}

function dataLocal(offsetDias = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Calendário — escolher um dia específico sobrepõe os botões de período.
// Já temos tudo em memória (sem paginação nessa tela), então os dias com
// evento vêm direto do que já foi carregado, sem precisar buscar de novo
// a cada mês trocado no calendário.
const diaEscolhidoAg = ref('')
function escolherDiaAg(dia: string) { diaEscolhidoAg.value = dia; filtroPeriodo.value = 'todos' }
const diasComConsulta = computed(() => new Set(agendamentos.value.map((a) => a.data_consulta)))

const agendamentosFiltrados = computed(() => {
  const hoje = dataLocal(0)
  const inicioMes = dataLocal(-30)
  const q = buscaMotivo.value.trim().toLowerCase()
  return agendamentos.value.filter((a) => {
    if (filtroStatus.value && a.status !== filtroStatus.value) return false
    if (diaEscolhidoAg.value) {
      if (a.data_consulta !== diaEscolhidoAg.value) return false
    } else {
      if (filtroPeriodo.value === 'futuros' && a.data_consulta < hoje) return false
      if (filtroPeriodo.value === 'passados' && a.data_consulta >= hoje) return false
      if (filtroPeriodo.value === 'mes' && a.data_consulta < inicioMes) return false
    }
    if (q && !(a.motivo ?? '').toLowerCase().includes(q)) return false
    return true
  })
})

// Agrupa por dia da consulta — mais fácil de ler o histórico assim do que
// numa lista corrida, ainda mais pra paciente com muitas consultas. A
// numeração (#) é contínua entre os dias, tipo linha de planilha.
interface AgComIndice { ag: Agendamento; indice: number }
const agendamentosPorDia = computed(() => {
  const grupos: Record<string, AgComIndice[]> = {}
  agendamentosFiltrados.value.forEach((a, i) => {
    (grupos[a.data_consulta] ??= []).push({ ag: a, indice: i + 1 })
  })
  return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
})

function fmtDiaGrupo(data: string): string {
  const d = new Date(data + 'T12:00:00')
  const hoje = dataLocal(0)
  const ontem = dataLocal(-1)
  if (data === hoje) return 'Hoje'
  if (data === ontem) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

// Documentos: mesma ideia — filtro por tipo + calendário + agrupado por dia de emissão
const filtroTipoDoc = ref('')
const diaEscolhidoDoc = ref('')
function escolherDiaDoc(dia: string) { diaEscolhidoDoc.value = dia }
const diasComDocumentos = computed(() => new Set(documentos.value.map((d) => d.created_at.slice(0, 10))))
const documentosFiltrados = computed(() =>
  documentos.value.filter((d) => {
    if (filtroTipoDoc.value && d.tipo !== filtroTipoDoc.value) return false
    if (diaEscolhidoDoc.value && d.created_at.slice(0, 10) !== diaEscolhidoDoc.value) return false
    return true
  })
)
interface DocComIndice { doc: Documento; indice: number }
const documentosPorDia = computed(() => {
  const grupos: Record<string, DocComIndice[]> = {}
  documentosFiltrados.value.forEach((d, i) => {
    const dia = d.created_at.slice(0, 10)
    ;(grupos[dia] ??= []).push({ doc: d, indice: i + 1 })
  })
  return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
})

const stats = computed(() => {
  const lista = agendamentos.value
  return {
    total: lista.length,
    concluidas: lista.filter((a) => a.status === 'concluido').length,
    faltou: lista.filter((a) => a.status === 'faltou').length,
    futuras: lista.filter((a) => ['agendado', 'checkin'].includes(a.status) && a.data_consulta >= dataLocal(0)).length,
  }
})

function formatarCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function calcularIdade(dataNasc: string | null): number | null {
  if (!dataNasc) return null
  const hoje = new Date()
  const nasc = new Date(dataNasc)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  if (hoje.getMonth() - nasc.getMonth() < 0) idade--
  return idade
}

const TIPOS_LABELS: Record<string, string> = {
  atestado: 'Atestado', pedido_exame: 'Pedido Exame', receita: 'Receita',
  receita_controlada: 'Rec. Controlada', encaminhamento: 'Encaminhamento', declaracao: 'Declaração',
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <button @click="voltar()" class="p-2 rounded-lg hover:bg-[var(--color-surface-2)]">
        <ArrowLeft :size="20" class="text-[var(--color-text-muted)]" />
      </button>
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">{{ paciente?.nome ?? '...' }}</h1>
        <p class="text-sm text-[var(--color-text-muted)]" v-if="paciente">
          {{ calcularIdade(paciente.data_nascimento) }} anos
        </p>
      </div>
    </div>

    <div v-if="carregando" class="text-center py-12 text-[var(--color-text-muted)]">Carregando...</div>

    <template v-else-if="paciente">
      <!-- Dados cadastrais (somente leitura) -->
      <UiCard>
        <template #header><h3 class="font-semibold">Dados Cadastrais</h3></template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">CPF</label>
            <p class="font-mono text-[var(--color-text)]">{{ formatarCPF(paciente.cpf) }}</p>
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Data de Nascimento</label>
            <p class="text-[var(--color-text)]">{{ paciente.data_nascimento ? new Date(paciente.data_nascimento).toLocaleDateString('pt-BR') : '—' }}</p>
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Telefone</label>
            <p class="text-[var(--color-text)]">{{ paciente.telefone || '—' }}</p>
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">E-mail</label>
            <p class="text-[var(--color-text)]">{{ paciente.email || '—' }}</p>
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Cartão SUS</label>
            <p class="text-[var(--color-text)]">{{ paciente.sus_cartao || '—' }}</p>
          </div>
        </div>
      </UiCard>

      <!-- Resumo -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="card p-3">
          <p class="text-xs text-[var(--color-text-muted)]">Total</p>
          <p class="text-2xl font-bold text-[var(--color-text)]">{{ stats.total }}</p>
        </div>
        <div class="card p-3">
          <p class="text-xs text-[var(--color-text-muted)]">Concluídas</p>
          <p class="text-2xl font-bold" style="color:#16a34a">{{ stats.concluidas }}</p>
        </div>
        <div class="card p-3">
          <p class="text-xs text-[var(--color-text-muted)]">Faltou</p>
          <p class="text-2xl font-bold" style="color:#dc2626">{{ stats.faltou }}</p>
        </div>
        <div class="card p-3">
          <p class="text-xs text-[var(--color-text-muted)]">Futuras</p>
          <p class="text-2xl font-bold" style="color:#2563eb">{{ stats.futuras }}</p>
        </div>
      </div>

      <!-- Histórico de consultas — de qualquer médico -->
      <UiCard>
        <template #header>
          <h3 class="font-semibold">Histórico de Consultas</h3>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Período</label>
            <div class="flex items-center gap-2">
              <select v-model="filtroPeriodo" class="input-base py-2 text-sm" @change="diaEscolhidoAg = ''">
                <option value="todos">Todos</option>
                <option value="futuros">Futuros</option>
                <option value="passados">Passados</option>
                <option value="mes">Últimos 30 dias</option>
              </select>
              <UiCalendarioDiaPicker :model-value="diaEscolhidoAg" :dias-com-eventos="diasComConsulta" @update:model-value="escolherDiaAg" />
            </div>
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Status</label>
            <select v-model="filtroStatus" class="input-base py-2 text-sm">
              <option value="">Todos</option>
              <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Buscar motivo</label>
            <div class="relative">
              <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input v-model="buscaMotivo" type="text" placeholder="dor, retorno..." class="input-base py-2 text-sm pl-9" />
            </div>
          </div>
        </div>

        <div v-if="agendamentosFiltrados.length === 0" class="py-6 text-center text-[var(--color-text-dim)] text-sm">
          Nenhum agendamento encontrado.
        </div>
        <div v-else class="space-y-4">
          <div v-for="[dia, itens] in agendamentosPorDia" :key="dia">
            <p class="text-xs font-bold uppercase tracking-wide mb-2" style="color:var(--color-text-dim)">
              {{ fmtDiaGrupo(dia) }} <span class="font-normal normal-case">({{ itens.length }})</span>
            </p>
            <div class="space-y-2">
              <div
                v-for="{ ag, indice } in itens"
                :key="ag.id"
                class="p-3 rounded-lg border border-[var(--color-border-light)] flex gap-3"
              >
                <span class="text-xs font-mono shrink-0" style="color:var(--color-text-dim)">{{ indice }}</span>
                <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <UiBadge :variant="ag.status as any" />
                </div>
                <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {{ (ag.medicos as any)?.nome }}
                  <span v-if="(ag.medicos as any)?.especialidade"> · {{ (ag.medicos as any).especialidade }}</span>
                </p>
                <p v-if="ag.motivo" class="text-xs text-[var(--color-text-dim)] mt-0.5">{{ ag.motivo }}</p>
                <div v-if="consultaPorAgendamento[ag.id]?.evolucao" class="mt-1.5 p-2 rounded-lg text-xs" style="background:#f0f9ff;border:1px solid #bae6fd;color:#075985">
                  <p class="font-semibold uppercase tracking-wide text-[10px] mb-0.5">Prontuário</p>
                  {{ consultaPorAgendamento[ag.id]?.evolucao }}
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UiCard>

      <!-- Documentos -->
      <UiCard>
        <template #header><h3 class="font-semibold">Documentos Emitidos</h3></template>
        <div class="flex items-center gap-2 mb-3">
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Tipo</label>
            <select v-model="filtroTipoDoc" class="input-base py-2 text-sm max-w-xs">
              <option value="">Todos</option>
              <option v-for="(label, key) in TIPOS_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="pt-5">
            <UiCalendarioDiaPicker :model-value="diaEscolhidoDoc" :dias-com-eventos="diasComDocumentos" @update:model-value="escolherDiaDoc" />
          </div>
        </div>
        <div v-if="documentosFiltrados.length === 0" class="py-6 text-center text-[var(--color-text-dim)] text-sm">
          Nenhum documento emitido
        </div>
        <div v-else class="space-y-4">
          <div v-for="[dia, itens] in documentosPorDia" :key="dia">
            <p class="text-xs font-bold uppercase tracking-wide mb-2" style="color:var(--color-text-dim)">
              {{ fmtDiaGrupo(dia) }} <span class="font-normal normal-case">({{ itens.length }})</span>
            </p>
            <div class="space-y-2">
              <div
                v-for="{ doc, indice } in itens"
                :key="doc.id"
                class="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border-light)]"
              >
                <span class="text-xs font-mono shrink-0 w-6" style="color:var(--color-text-dim)">{{ indice }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--color-text)]">{{ TIPOS_LABELS[doc.tipo] ?? doc.tipo }}</p>
                  <p class="text-xs text-[var(--color-text-muted)]">
                    {{ new Date(doc.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }} — {{ (doc.medicos as any)?.nome }}
                  </p>
                </div>
                <UiButton v-if="doc.pdf_url" variant="ghost" size="sm" @click="abrirDocumento(doc.pdf_url)">Ver PDF</UiButton>
              </div>
            </div>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>
