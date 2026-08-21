<script setup lang="ts">
import { Search, Pencil, X as XIcon, CalendarDays, Filter, ChevronLeft, Plus } from 'lucide-vue-next'
import type { Agendamento, AgendamentoStatus } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()

// Filtros
const buscaPaciente = ref('')
const filtroMedico = ref('')
const filtroStatus = ref<AgendamentoStatus | ''>('')
const filtroDataInicio = ref('')
const filtroDataFim = ref('')
const pagina = ref(1)
const POR_PAGINA = 20

// Dados
const agendamentos = ref<(Agendamento & { pacientes: { nome: string }; medicos: { nome: string; especialidade: string } })[]>([])
const total = ref(0)
const carregando = ref(false)
const medicos = ref<{ id: string; nome: string }[]>([])

const STATUS_LABELS: Record<AgendamentoStatus, string> = {
  agendado: 'Agendado',
  checkin: 'Check-in',
  aguardando_medico: 'Aguard. médico',
  aguardando_paciente: 'Aguard. paciente',
  em_consulta: 'Em consulta',
  concluido: 'Concluído',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
  aguardando_avaliacao: 'Aguard. avaliação',
}

const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

async function carregar() {
  carregando.value = true
  const from = (pagina.value - 1) * POR_PAGINA
  const to = from + POR_PAGINA - 1

  let q = supabase
    .from('agendamentos')
    .select('*, pacientes(nome), medicos(nome, especialidade)', { count: 'exact' })
    .order('data_consulta', { ascending: false })
    .range(from, to)

  if (filtroMedico.value) q = q.eq('medico_id', filtroMedico.value)
  if (filtroStatus.value) q = q.eq('status', filtroStatus.value)
  if (filtroDataInicio.value) q = q.gte('data_consulta', filtroDataInicio.value)
  if (filtroDataFim.value) q = q.lte('data_consulta', filtroDataFim.value)
  if (buscaPaciente.value.trim()) {
    // Busca por nome do paciente via join (usa ilike no nome do paciente)
    q = q.ilike('pacientes.nome', `%${buscaPaciente.value.trim()}%`)
  }

  const { data, count } = await q
  agendamentos.value = (data ?? []) as any
  total.value = count ?? 0
  carregando.value = false
}

onMounted(async () => {
  const { data: meds } = await supabase.from('medicos').select('id, nome').order('nome')
  medicos.value = meds ?? []
  definirPeriodo('hoje')
  await carregar()
})

watch([filtroMedico, filtroStatus, filtroDataInicio, filtroDataFim], () => { pagina.value = 1; carregar() })
watch(pagina, carregar)

let debounce: ReturnType<typeof setTimeout>
watch(buscaPaciente, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => { pagina.value = 1; carregar() }, 300)
})

// Data em horário LOCAL — toISOString() usa UTC e no Brasil (UTC-3) já
// vira o dia seguinte a partir das 21h, fazendo o filtro pular um dia.
function dataLocal(offsetDias = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function definirPeriodo(periodo: 'hoje' | '7dias' | '30dias') {
  filtroDataFim.value = dataLocal(0)
  if (periodo === 'hoje') filtroDataInicio.value = dataLocal(0)
  else if (periodo === '7dias') filtroDataInicio.value = dataLocal(-6)
  else if (periodo === '30dias') filtroDataInicio.value = dataLocal(-29)
}

// Qual preset corresponde às datas atuais — sem isso os botões nunca
// ficavam marcados, mesmo funcionando.
const periodoAtivo = computed(() => {
  if (filtroDataFim.value !== dataLocal(0)) return ''
  if (filtroDataInicio.value === dataLocal(0)) return 'hoje'
  if (filtroDataInicio.value === dataLocal(-6)) return '7dias'
  if (filtroDataInicio.value === dataLocal(-29)) return '30dias'
  return ''
})

// ── Calendário — escolher um dia específico em vez de digitar um período ──
const calendarioAberto = ref(false)
const mesVisivel = ref(new Date())
const diasComConsulta = ref<Set<string>>(new Set())

// Dia único selecionado só quando início === fim (senão é um período livre,
// não faz sentido marcar um dia só no calendário)
const diaSelecionado = computed(() =>
  filtroDataInicio.value && filtroDataInicio.value === filtroDataFim.value ? filtroDataInicio.value : ''
)

function fmtDataYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function carregarDiasComConsulta() {
  const ano = mesVisivel.value.getFullYear()
  const mes = mesVisivel.value.getMonth()
  const inicio = fmtDataYMD(new Date(ano, mes, 1))
  const fim = fmtDataYMD(new Date(ano, mes + 1, 0))
  let q = supabase.from('agendamentos').select('data_consulta').gte('data_consulta', inicio).lte('data_consulta', fim)
  if (filtroMedico.value) q = q.eq('medico_id', filtroMedico.value)
  const { data } = await q
  diasComConsulta.value = new Set((data ?? []).map((a: any) => a.data_consulta as string))
}

watch([calendarioAberto, mesVisivel, filtroMedico], () => {
  if (calendarioAberto.value) carregarDiasComConsulta()
})

const diasDoMes = computed(() => {
  const ano = mesVisivel.value.getFullYear()
  const mes = mesVisivel.value.getMonth()
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const dias: { data: string; numero: number; foraDoMes: boolean }[] = []
  // Preenche os dias do mês anterior pra completar a primeira semana
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const d = new Date(ano, mes, i - primeiroDiaSemana + 1)
    dias.push({ data: fmtDataYMD(d), numero: d.getDate(), foraDoMes: true })
  }
  for (let dia = 1; dia <= totalDias; dia++) {
    dias.push({ data: fmtDataYMD(new Date(ano, mes, dia)), numero: dia, foraDoMes: false })
  }
  // Completa a última semana
  while (dias.length % 7 !== 0) {
    const anterior = dias[dias.length - 1]
    if (!anterior) break
    const ultimo = new Date(anterior.data + 'T12:00:00')
    ultimo.setDate(ultimo.getDate() + 1)
    dias.push({ data: fmtDataYMD(ultimo), numero: ultimo.getDate(), foraDoMes: true })
  }
  return dias
})

const nomeMesVisivel = computed(() =>
  mesVisivel.value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
)

function mudarMes(delta: number) {
  mesVisivel.value = new Date(mesVisivel.value.getFullYear(), mesVisivel.value.getMonth() + delta, 1)
}

function escolherDia(data: string) {
  filtroDataInicio.value = data
  filtroDataFim.value = data
  calendarioAberto.value = false
}

function abrirCalendario() {
  mesVisivel.value = diaSelecionado.value ? new Date(diaSelecionado.value + 'T12:00:00') : new Date()
  calendarioAberto.value = !calendarioAberto.value
}

// Nova consulta
const novoModal = ref(false)
const novoForm = ref({ paciente_busca: '', medico_id: '', data_consulta: '', motivo: '' })
const novoPaciente = ref<{ id: string; nome: string; cpf?: string } | null>(null)
const resultadosPaciente = ref<{ id: string; nome: string; cpf: string }[]>([])
const buscandoPaciente = ref(false)
const erroPaciente = ref('')
const criandoNovo = ref(false)

function abrirNovo() {
  const hoje = new Date()
  novoForm.value = {
    paciente_busca: '',
    medico_id: medicos.value[0]?.id ?? '',
    data_consulta: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`,
    motivo: '',
  }
  novoPaciente.value = null
  resultadosPaciente.value = []
  erroPaciente.value = ''
  novoModal.value = true
}

// Busca por nome ou CPF — mesmo critério usado na lista de pacientes:
// 6+ dígitos seguidos vira busca por CPF, senão busca por nome.
let debounceNovo: ReturnType<typeof setTimeout>
async function buscarPaciente() {
  novoPaciente.value = null
  const termo = novoForm.value.paciente_busca.trim()
  const somenteDigitos = termo.replace(/\D/g, '')
  if (termo.length < 2) { resultadosPaciente.value = []; erroPaciente.value = ''; return }
  clearTimeout(debounceNovo)
  debounceNovo = setTimeout(async () => {
    buscandoPaciente.value = true
    erroPaciente.value = ''
    let q = supabase.from('pacientes').select('id, nome, cpf').order('nome').limit(8)
    q = somenteDigitos.length >= 6 ? q.ilike('cpf', `%${somenteDigitos}%`) : q.ilike('nome', `%${termo}%`)
    const { data } = await q
    buscandoPaciente.value = false
    resultadosPaciente.value = data ?? []
    if (!resultadosPaciente.value.length) erroPaciente.value = 'Nenhum paciente encontrado. Cadastre primeiro em Pacientes.'
  }, 350)
}

function escolherPaciente(p: { id: string; nome: string; cpf: string }) {
  novoPaciente.value = p
  novoForm.value.paciente_busca = p.nome
  resultadosPaciente.value = []
}

async function criarConsulta() {
  if (!novoPaciente.value || !novoForm.value.medico_id || !novoForm.value.data_consulta) return
  criandoNovo.value = true
  const { error } = await supabase.from('agendamentos').insert({
    paciente_id: novoPaciente.value.id,
    medico_id: novoForm.value.medico_id,
    data_consulta: novoForm.value.data_consulta,
    motivo: novoForm.value.motivo || null,
    origem: 'manual',
    status: 'agendado',
  })
  criandoNovo.value = false
  if (error) { alert(`Erro: ${error.message}`); return }
  novoModal.value = false
  await carregar()
}

// Editar agendamento
const editModal = ref<(typeof agendamentos.value)[0] | null>(null)
const editForm = ref({ medico_id: '', data_consulta: '', motivo: '', status: '' as AgendamentoStatus | '' })
const salvandoEdit = ref(false)

function abrirEdit(ag: (typeof agendamentos.value)[0]) {
  editModal.value = ag
  editForm.value = {
    medico_id: ag.medico_id ?? '',
    data_consulta: ag.data_consulta,
    motivo: ag.motivo ?? '',
    status: ag.status,
  }
}

async function salvarEdit() {
  if (!editModal.value) return
  salvandoEdit.value = true

  const statusAnterior = editModal.value.status
  const novoStatus = editForm.value.status as AgendamentoStatus
  const agora = new Date().toISOString()

  const payload: Record<string, unknown> = {
    medico_id: editForm.value.medico_id || null,
    data_consulta: editForm.value.data_consulta,
    motivo: editForm.value.motivo || null,
    status: novoStatus,
  }

  // Sincroniza os timestamps de fila quando o admin muda o status manualmente,
  // senão os tempos de espera/duração exibidos na fila ficam incorretos.
  if (novoStatus !== statusAnterior) {
    if (novoStatus === 'checkin' && !editModal.value.checkin_em) {
      payload.checkin_em = agora
    }
    if (['aguardando_medico', 'em_consulta'].includes(novoStatus) && !editModal.value.chamado_em) {
      payload.chamado_em = agora
    }
    if (['concluido', 'aguardando_avaliacao', 'cancelado', 'faltou'].includes(novoStatus) && !editModal.value.encerrado_em) {
      payload.encerrado_em = agora
    }
  }

  await supabase.from('agendamentos').update(payload).eq('id', editModal.value.id)
  editModal.value = null
  salvandoEdit.value = false
  await carregar()
}

async function cancelar(ag: (typeof agendamentos.value)[0]) {
  const data = new Date(ag.data_consulta + 'T12:00:00').toLocaleDateString('pt-BR')
  if (!confirm(`Cancelar consulta de ${(ag.pacientes as any)?.nome} em ${data}?`)) return
  const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', ag.id)
  if (error) { alert(`Erro ao cancelar: ${error.message}`); return }
  await carregar()
}

const paginasVisiveis = computed(() => {
  const t = totalPaginas.value
  const atual = pagina.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(t - 1, atual + 1); i++) pages.push(i)
  if (atual < t - 2) pages.push('...')
  pages.push(t)
  return pages
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Consultas</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          {{ carregando ? '…' : `${total} consulta${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}` }}
        </p>
      </div>
      <UiButton variant="primary" @click="abrirNovo">
        <Plus :size="16" /> Nova Consulta
      </UiButton>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border p-4 space-y-4" style="border-color:var(--color-border)">
      <!-- Busca + médico -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="relative">
          <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2" style="color:var(--color-text-dim)" />
          <input
            v-model="buscaPaciente"
            placeholder="Buscar por paciente..."
            class="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-blue-400"
            style="border-color:var(--color-border);background:var(--color-surface-2)"
          />
        </div>
        <div class="relative">
          <select
            v-model="filtroMedico"
            class="w-full pl-4 pr-8 py-2.5 rounded-xl border text-sm outline-none appearance-none cursor-pointer"
            style="border-color:var(--color-border);background:var(--color-surface-2);color:var(--color-text)"
          >
            <option value="">Todos os médicos</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
          </select>
          <ChevronLeft :size="14" class="absolute right-3 top-1/2 -translate-y-1/2 rotate-[-90deg] pointer-events-none" style="color:var(--color-text-dim)" />
        </div>
      </div>

      <!-- Período -->
      <div class="flex flex-wrap items-center gap-2">
        <CalendarDays :size="14" style="color:var(--color-text-dim)" class="shrink-0" />
        <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Período:</span>
        <button
          v-for="p in [{ v: 'hoje', l: 'Hoje' }, { v: '7dias', l: 'Últimos 7 dias' }, { v: '30dias', l: 'Últimos 30 dias' }]"
          :key="p.v"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="periodoAtivo === p.v
            ? 'background:#2563eb;color:white;border-color:#2563eb'
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="definirPeriodo(p.v as any)"
        >{{ p.l }}</button>
        <div class="flex items-center gap-1.5 ml-auto relative">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
            :style="diaSelecionado
              ? 'background:#2563eb;color:white;border-color:#2563eb'
              : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
            @click="abrirCalendario"
          >
            <CalendarDays :size="13" />
            {{ diaSelecionado ? new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Escolher dia' }}
          </button>
          <input v-model="filtroDataInicio" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
          <span class="text-xs" style="color:var(--color-text-dim)">até</span>
          <input v-model="filtroDataFim" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />

          <!-- Calendário -->
          <div
            v-if="calendarioAberto"
            class="absolute right-0 top-full mt-2 z-20 bg-white rounded-2xl border shadow-lg p-3"
            style="border-color:var(--color-border);width:280px"
          >
            <div class="flex items-center justify-between mb-2">
              <button type="button" class="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]" @click="mudarMes(-1)">
                <ChevronLeft :size="16" />
              </button>
              <p class="text-sm font-semibold capitalize" style="color:var(--color-text)">{{ nomeMesVisivel }}</p>
              <button type="button" class="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]" style="transform:scaleX(-1)" @click="mudarMes(1)">
                <ChevronLeft :size="16" />
              </button>
            </div>
            <div class="grid grid-cols-7 gap-1 mb-1">
              <span v-for="d in ['D','S','T','Q','Q','S','S']" :key="d" class="text-center text-[10px] font-bold" style="color:var(--color-text-dim)">{{ d }}</span>
            </div>
            <div class="grid grid-cols-7 gap-1">
              <button
                v-for="d in diasDoMes" :key="d.data"
                type="button"
                class="relative aspect-square rounded-lg text-xs font-medium transition-colors"
                :disabled="d.foraDoMes"
                :style="[
                  d.foraDoMes ? 'color:var(--color-text-dim);opacity:0.35' : 'color:var(--color-text)',
                  d.data === diaSelecionado ? 'background:#2563eb;color:white;font-weight:700' : d.data === dataLocal(0) ? 'background:var(--color-surface-2);font-weight:700' : '',
                ]"
                @click="!d.foraDoMes && escolherDia(d.data)"
              >
                {{ d.numero }}
                <span
                  v-if="diasComConsulta.has(d.data) && d.data !== diaSelecionado"
                  class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style="background:#16a34a"
                />
              </button>
            </div>
            <button
              type="button"
              class="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold"
              style="background:var(--color-surface-2);color:var(--color-text-muted)"
              @click="escolherDia(dataLocal(0))"
            >Hoje</button>
          </div>
        </div>
      </div>

      <!-- Status -->
      <div class="relative max-w-xs">
        <select
          v-model="filtroStatus"
          class="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none appearance-none cursor-pointer"
          style="border-color:var(--color-border);background:var(--color-surface-2);color:var(--color-text)"
        >
          <option value="">Todos os status</option>
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <Filter :size="13" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color:var(--color-text-dim)" />
      </div>
    </div>

    <!-- Tabela -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
      <div v-if="carregando" class="py-16 text-center text-[var(--color-text-muted)] text-sm">Carregando...</div>
      <div v-else-if="agendamentos.length === 0" class="py-16 text-center text-[var(--color-text-dim)] text-sm">
        Nenhuma consulta encontrada com os filtros selecionados.
      </div>
      <template v-else>
        <table class="w-full text-sm">
          <thead>
            <tr style="background:var(--color-surface-2);border-bottom:1px solid var(--color-border)">
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Data</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Paciente</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden sm:table-cell">Médico</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]">Status</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] hidden md:table-cell">Motivo</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ag in agendamentos"
              :key="ag.id"
              class="border-t hover:bg-[var(--color-surface-2)] transition-colors"
              style="border-color:var(--color-border-light)"
            >
              <td class="px-4 py-3 font-mono text-xs whitespace-nowrap" style="color:var(--color-text)">
                {{ new Date(ag.data_consulta + 'T12:00:00').toLocaleDateString('pt-BR') }}
              </td>
              <td class="px-4 py-3">
                <NuxtLink
                  :to="`/admin/pacientes/${ag.paciente_id}`"
                  class="font-medium hover:underline"
                  style="color:var(--color-text)"
                >
                  {{ (ag.pacientes as any)?.nome ?? '—' }}
                </NuxtLink>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell text-[var(--color-text-muted)] text-xs">
                {{ (ag.medicos as any)?.nome ?? '—' }}
                <span v-if="(ag.medicos as any)?.especialidade" class="opacity-70"> · {{ (ag.medicos as any).especialidade }}</span>
              </td>
              <td class="px-4 py-3">
                <UiBadge :variant="ag.status as any" />
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-[var(--color-text-dim)] text-xs max-w-[180px] truncate">
                {{ ag.motivo ?? '—' }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1 justify-end">
                  <button
                    class="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Editar"
                    @click="abrirEdit(ag)"
                  >
                    <Pencil :size="13" style="color:#2563eb" />
                  </button>
                  <button
                    v-if="!['cancelado','concluido','faltou'].includes(ag.status)"
                    class="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Cancelar"
                    @click="cancelar(ag)"
                  >
                    <XIcon :size="13" style="color:#dc2626" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Paginação -->
        <div v-if="totalPaginas > 1" class="flex items-center justify-between px-4 py-3 border-t" style="border-color:var(--color-border)">
          <p class="text-xs" style="color:var(--color-text-muted)">
            Página {{ pagina }} de {{ totalPaginas }}
          </p>
          <div class="flex items-center gap-1">
            <button
              class="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40"
              :disabled="pagina === 1"
              style="border-color:var(--color-border)"
              @click="pagina--"
            >‹</button>
            <button
              v-for="p in paginasVisiveis"
              :key="p"
              class="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
              :style="p === pagina
                ? 'background:#2563eb;color:white;border-color:#2563eb'
                : p === '...' ? 'border:none;cursor:default' : 'border-color:var(--color-border)'"
              :disabled="p === '...'"
              @click="typeof p === 'number' && (pagina = p)"
            >{{ p }}</button>
            <button
              class="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40"
              :disabled="pagina === totalPaginas"
              style="border-color:var(--color-border)"
              @click="pagina++"
            >›</button>
          </div>
        </div>
      </template>
    </div>

  <!-- Modal editar -->
  <UiModal v-if="editModal" :model-value="true" title="Editar Consulta" size="md" @update:model-value="editModal = null">
    <div class="space-y-4">
      <div class="p-3 rounded-xl bg-[var(--color-surface-2)]">
        <p class="text-sm font-semibold text-[var(--color-text)]">{{ (editModal.pacientes as any)?.nome }}</p>
        <p class="text-xs text-[var(--color-text-muted)] mt-0.5">Agendamento #{{ editModal.id.slice(0, 8) }}</p>
      </div>
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Médico</label>
        <select v-model="editForm.medico_id" class="input-base">
          <option value="">Sem médico definido</option>
          <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
        </select>
      </div>
      <UiInput v-model="editForm.data_consulta" label="Data da consulta" type="date" />
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Status</label>
        <select v-model="editForm.status" class="input-base">
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Motivo</label>
        <textarea v-model="editForm.motivo" class="input-base resize-none" rows="3" placeholder="Motivo da consulta..." />
      </div>
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="editModal = null">Cancelar</UiButton>
      <UiButton variant="primary" :loading="salvandoEdit" @click="salvarEdit">Salvar</UiButton>
    </template>
  </UiModal>

  <!-- Modal nova consulta -->
  <UiModal v-if="novoModal" :model-value="true" title="Nova Consulta" size="md" @update:model-value="novoModal = false">
    <div class="space-y-4">
      <div class="relative">
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Paciente (nome ou CPF)</label>
        <input
          v-model="novoForm.paciente_busca"
          type="text"
          class="input-base"
          placeholder="Digite o nome ou CPF..."
          @input="buscarPaciente()"
        />
        <p v-if="buscandoPaciente" class="text-xs text-[var(--color-text-muted)] mt-1">Buscando...</p>
        <p v-else-if="novoPaciente" class="text-xs mt-1" style="color:#16a34a">Selecionado: <strong>{{ novoPaciente.nome }}</strong></p>
        <p v-else-if="erroPaciente" class="text-xs mt-1" style="color:#dc2626">{{ erroPaciente }}</p>

        <!-- Resultados da busca -->
        <div
          v-if="resultadosPaciente.length"
          class="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg overflow-hidden"
          style="border-color:var(--color-border)"
        >
          <button
            v-for="p in resultadosPaciente"
            :key="p.id"
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-2)] transition-colors"
            @click="escolherPaciente(p)"
          >
            <span class="font-medium text-[var(--color-text)]">{{ p.nome }}</span>
            <span class="text-xs font-mono text-[var(--color-text-muted)]">{{ p.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') }}</span>
          </button>
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Médico *</label>
        <select v-model="novoForm.medico_id" class="input-base">
          <option value="">Selecione um médico</option>
          <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
        </select>
      </div>
      <UiInput v-model="novoForm.data_consulta" label="Data da consulta *" type="date" />
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Motivo</label>
        <textarea v-model="novoForm.motivo" class="input-base resize-none" rows="3" placeholder="Motivo da consulta..." />
      </div>
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="novoModal = false">Cancelar</UiButton>
      <UiButton variant="primary" :loading="criandoNovo" :disabled="!novoPaciente || !novoForm.medico_id || !novoForm.data_consulta" @click="criarConsulta">Criar Consulta</UiButton>
    </template>
  </UiModal>
  </div>
</template>
