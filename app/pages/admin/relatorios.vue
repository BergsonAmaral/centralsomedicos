<script setup lang="ts">
import {
  BarChart3, Download, Calendar, Clock, Users, FileText, Upload,
  ChevronLeft, ChevronRight, CalendarDays, Filter,
} from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()

const medicos = ref<{ id: string; nome: string }[]>([])
const abaAtiva = ref<'consultas' | 'documentos' | 'importacoes'>('consultas')

function hoje() { return new Date().toISOString().slice(0, 10) }
function inicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function fmtHoras(min: number): string {
  if (!min) return '0min'
  const h = Math.floor(min / 60); const m = min % 60
  if (!h) return `${m}min`; if (!m) return `${h}h`; return `${h}h ${m}min`
}
function gerarPaginas(atual: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) pages.push(i)
  if (atual < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
function setPeriodo(ini: Ref<string>, fim: Ref<string>, p: 'hoje' | '7d' | '30d' | 'mes') {
  fim.value = hoje()
  if (p === 'hoje') ini.value = hoje()
  else if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 6); ini.value = d.toISOString().slice(0, 10) }
  else if (p === '30d') { const d = new Date(); d.setDate(d.getDate() - 29); ini.value = d.toISOString().slice(0, 10) }
  else ini.value = inicioMes()
}

// ── CONSULTAS ──────────────────────────────────────────────────
const cDataIni = ref(inicioMes())
const cDataFim = ref(hoje())
const cMedico = ref('')
const cCarregando = ref(false)
const totalConsultas = ref(0)
const horasTotaisAtendidas = ref(0)
const tempoMedioEspera = ref(0)
const tempoMedioConsulta = ref(0)
const consultasPorMedico = ref<{ nome: string; total: number; concluidas: number; faltaram: number; minutos: number; horasFmt: string; comDuracao: number; mediaMin: number }[]>([])
const topPacientes = ref<{ nome: string; total: number }[]>([])
const C_PP = 15
const cPagMed = ref(1)
const cPagPac = ref(1)
const cMedicosPag = computed(() => consultasPorMedico.value.slice((cPagMed.value - 1) * C_PP, cPagMed.value * C_PP))
const cTotalPagMed = computed(() => Math.max(1, Math.ceil(consultasPorMedico.value.length / C_PP)))
const cPacientesPag = computed(() => topPacientes.value.slice((cPagPac.value - 1) * C_PP, cPagPac.value * C_PP))
const cTotalPagPac = computed(() => Math.max(1, Math.ceil(topPacientes.value.length / C_PP)))

async function carregarConsultas() {
  cCarregando.value = true; cPagMed.value = 1; cPagPac.value = 1
  let q = supabase.from('agendamentos').select('*, medicos(nome)')
    .gte('data_consulta', cDataIni.value).lte('data_consulta', cDataFim.value)
  if (cMedico.value) q = q.eq('medico_id', cMedico.value)
  const { data: ags } = await q
  const agendamentos = ags ?? []
  totalConsultas.value = agendamentos.filter(a => a.status === 'concluido').length

  const porMedico: Record<string, any> = {}
  agendamentos.forEach(a => {
    const nome = (a.medicos as any)?.nome ?? 'Desconhecido'
    if (!porMedico[a.medico_id]) porMedico[a.medico_id] = { nome, total: 0, concluidas: 0, faltaram: 0, minutos: 0, horasFmt: '0min', comDuracao: 0, mediaMin: 0 }
    porMedico[a.medico_id].total++
    if (a.status === 'concluido') porMedico[a.medico_id].concluidas++
    if (a.status === 'faltou') porMedico[a.medico_id].faltaram++
  })

  let qc = supabase.from('consultas')
    .select('medico_id, paciente_id, duracao_minutos, pacientes(nome), created_at')
    .gte('created_at', `${cDataIni.value}T00:00:00`).lte('created_at', `${cDataFim.value}T23:59:59`)
  if (cMedico.value) qc = qc.eq('medico_id', cMedico.value)
  const { data: consultas } = await qc
  const lst = consultas ?? []

  let totalMin = 0
  const porPaciente: Record<string, any> = {}
  lst.forEach((c: any) => {
    const min = c.duracao_minutos ?? 0; totalMin += min
    if (c.medico_id && porMedico[c.medico_id]) {
      porMedico[c.medico_id].minutos += min
      if (min > 0) porMedico[c.medico_id].comDuracao++
    }
    if (c.paciente_id) {
      const nome = (c.pacientes as any)?.nome ?? 'Desconhecido'
      if (!porPaciente[c.paciente_id]) porPaciente[c.paciente_id] = { nome, total: 0 }
      porPaciente[c.paciente_id].total++
    }
  })
  Object.values(porMedico).forEach((m: any) => {
    m.horasFmt = fmtHoras(m.minutos)
    m.mediaMin = m.comDuracao ? Math.round(m.minutos / m.comDuracao) : 0
  })
  consultasPorMedico.value = Object.values(porMedico).sort((a: any, b: any) => b.concluidas - a.concluidas)
  horasTotaisAtendidas.value = totalMin
  topPacientes.value = Object.values(porPaciente).sort((a: any, b: any) => b.total - a.total)

  const comEspera = agendamentos.filter(a => a.checkin_em && a.chamado_em)
  if (comEspera.length) {
    tempoMedioEspera.value = Math.round(
      comEspera.reduce((acc, a) => acc + (new Date(a.chamado_em).getTime() - new Date(a.checkin_em).getTime()), 0)
      / comEspera.length / 60000
    )
  }
  const comDur = agendamentos.filter(a => a.chamado_em && a.encerrado_em)
  if (comDur.length) {
    tempoMedioConsulta.value = Math.round(
      comDur.reduce((acc, a) => acc + (new Date(a.encerrado_em).getTime() - new Date(a.chamado_em).getTime()), 0)
      / comDur.length / 60000
    )
  }
  cCarregando.value = false
}
watch([cDataIni, cDataFim, cMedico], () => { if (abaAtiva.value === 'consultas') carregarConsultas() })

// ── DOCUMENTOS ─────────────────────────────────────────────────
const TIPOS_LABELS: Record<string, string> = {
  atestado: 'Atestado', pedido_exame: 'Pedido de Exame', receita: 'Receita',
  receita_controlada: 'Rec. Controlada', encaminhamento: 'Encaminhamento', declaracao: 'Declaração',
}
const TIPOS_CORES: Record<string, string> = {
  atestado: '#2563eb', pedido_exame: '#7c3aed', receita: '#16a34a',
  receita_controlada: '#dc2626', encaminhamento: '#d97706', declaracao: '#0891b2',
}

const dDataIni = ref(inicioMes())
const dDataFim = ref(hoje())
const dMedico = ref('')
const dTipo = ref('')
const dStatus = ref('')
const dCarregando = ref(false)
const dPagina = ref(1)
const dTotal = ref(0)
const documentosList = ref<any[]>([])
const docsPorTipo = ref<Record<string, number>>({})
const D_PP = 20
const dTotalPag = computed(() => Math.max(1, Math.ceil(dTotal.value / D_PP)))

async function carregarDocumentos() {
  dCarregando.value = true
  const from = (dPagina.value - 1) * D_PP
  let q = supabase.from('documentos')
    .select('*, pacientes(nome), medicos(nome)', { count: 'exact' })
    .gte('created_at', `${dDataIni.value}T00:00:00`).lte('created_at', `${dDataFim.value}T23:59:59`)
  if (dMedico.value) q = q.eq('medico_id', dMedico.value)
  if (dTipo.value) q = q.eq('tipo', dTipo.value)
  if (dStatus.value) q = q.eq('status', dStatus.value)
  const { data, count } = await q.order('created_at', { ascending: false }).range(from, from + D_PP - 1)
  documentosList.value = data ?? []; dTotal.value = count ?? 0

  let qs = supabase.from('documentos').select('tipo')
    .gte('created_at', `${dDataIni.value}T00:00:00`).lte('created_at', `${dDataFim.value}T23:59:59`)
  if (dMedico.value) qs = qs.eq('medico_id', dMedico.value)
  if (dStatus.value) qs = qs.eq('status', dStatus.value)
  const { data: td } = await qs
  const tc: Record<string, number> = {}
  ;(td ?? []).forEach((d: any) => { tc[d.tipo] = (tc[d.tipo] ?? 0) + 1 })
  docsPorTipo.value = tc
  dCarregando.value = false
}
watch([dDataIni, dDataFim, dMedico, dTipo, dStatus], () => { dPagina.value = 1; carregarDocumentos() })
watch(dPagina, carregarDocumentos)

// ── IMPORTAÇÕES ────────────────────────────────────────────────
const iDataIni = ref(inicioMes())
const iDataFim = ref(hoje())
const iCarregando = ref(false)
const iPagina = ref(1)
const iTotal = ref(0)
const importacoes = ref<{ created_at: string; arquivo_nome: string; importados: number; erros: number }[]>([])
const I_PP = 20
const iTotalPag = computed(() => Math.max(1, Math.ceil(iTotal.value / I_PP)))

async function carregarImportacoes() {
  iCarregando.value = true
  const from = (iPagina.value - 1) * I_PP
  const { data, count } = await supabase.from('importacoes_sus')
    .select('created_at, arquivo_nome, importados, erros', { count: 'exact' })
    .gte('created_at', `${iDataIni.value}T00:00:00`).lte('created_at', `${iDataFim.value}T23:59:59`)
    .order('created_at', { ascending: false }).range(from, from + I_PP - 1)
  importacoes.value = data ?? []; iTotal.value = count ?? 0
  iCarregando.value = false
}
watch([iDataIni, iDataFim], () => { iPagina.value = 1; carregarImportacoes() })
watch(iPagina, carregarImportacoes)

onMounted(async () => {
  const { data: meds } = await supabase.from('medicos').select('id, nome').order('nome')
  medicos.value = meds ?? []
  carregarConsultas()
})

watch(abaAtiva, v => {
  if (v === 'consultas') carregarConsultas()
  else if (v === 'documentos' && !documentosList.value.length) carregarDocumentos()
  else if (v === 'importacoes' && !importacoes.value.length) carregarImportacoes()
})

function exportarCSV() {
  const linhas = [
    ['Médico', 'Total', 'Concluídos', 'Faltaram', 'Minutos', 'Tempo total', 'Tempo médio (min)'],
    ...consultasPorMedico.value.map(m => [m.nome, m.total, m.concluidas, m.faltaram, m.minutos, m.horasFmt, m.mediaMin]),
  ]
  const csv = linhas.map(l => l.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `relatorio_${cDataIni.value}_${cDataFim.value}.csv`; a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Relatórios</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">Métricas e exportação de dados</p>
      </div>
      <UiButton v-if="abaAtiva === 'consultas'" variant="secondary" @click="exportarCSV">
        <Download :size="16" /> Exportar CSV
      </UiButton>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 p-1 rounded-xl" style="background:var(--color-surface-2);border:1px solid var(--color-border)">
      <button
        v-for="tab in [{ v: 'consultas', l: 'Consultas', icon: BarChart3 }, { v: 'documentos', l: 'Documentos', icon: FileText }, { v: 'importacoes', l: 'Importações SUS', icon: Upload }]"
        :key="tab.v"
        class="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
        :style="abaAtiva === tab.v
          ? 'background:white;color:#111827;box-shadow:0 1px 3px rgba(0,0,0,.08)'
          : 'background:transparent;color:var(--color-text-muted)'"
        @click="abaAtiva = tab.v as any"
      >
        <component :is="tab.icon" :size="15" />
        {{ tab.l }}
      </button>
    </div>

    <!-- ══ CONSULTAS ══════════════════════════════════════════════ -->
    <template v-if="abaAtiva === 'consultas'">
      <!-- Filtros -->
      <div class="bg-white rounded-2xl border p-4 space-y-3" style="border-color:var(--color-border)">
        <div class="flex flex-wrap items-center gap-2">
          <CalendarDays :size="14" style="color:var(--color-text-dim)" />
          <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Período:</span>
          <button
            v-for="p in [{ v: 'hoje', l: 'Hoje' }, { v: '7d', l: '7 dias' }, { v: '30d', l: '30 dias' }, { v: 'mes', l: 'Este mês' }]"
            :key="p.v"
            class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
            style="background:white;color:var(--color-text-muted);border-color:var(--color-border)"
            @click="setPeriodo(cDataIni, cDataFim, p.v as any)"
          >{{ p.l }}</button>
          <div class="flex items-center gap-1.5 ml-auto">
            <input v-model="cDataIni" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
            <span class="text-xs" style="color:var(--color-text-dim)">até</span>
            <input v-model="cDataFim" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
          </div>
        </div>
        <div class="relative max-w-xs">
          <select
            v-model="cMedico"
            class="w-full pl-4 pr-8 py-2.5 rounded-xl border text-sm outline-none appearance-none cursor-pointer"
            style="border-color:var(--color-border);background:var(--color-surface-2);color:var(--color-text)"
          >
            <option value="">Todos os médicos</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
          </select>
        </div>
      </div>

      <div v-if="cCarregando" class="py-12 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
      <template v-else>
        <!-- Métricas -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <UiStatCard :icon="BarChart3" :value="totalConsultas" label="Consultas realizadas" icon-color="text-[var(--color-blue)]" />
          <UiStatCard :icon="Clock" :value="fmtHoras(horasTotaisAtendidas)" label="Horas atendendo" icon-color="text-[var(--color-green)]" icon-bg="bg-[var(--color-green-pale)]" />
          <UiStatCard :icon="Calendar" :value="`${tempoMedioEspera}min`" label="Espera média" icon-color="text-[var(--color-warning)]" icon-bg="bg-[#fef3c7]" />
          <UiStatCard :icon="Calendar" :value="`${tempoMedioConsulta}min`" label="Consulta média" icon-color="text-[var(--color-blue)]" />
        </div>

        <!-- Por médico -->
        <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
          <div class="px-5 py-4 border-b font-semibold text-[var(--color-text)]" style="border-color:var(--color-border-light)">Consultas por Médico</div>
          <table class="w-full text-sm">
            <thead>
              <tr style="background:var(--color-surface-2);border-bottom:1px solid var(--color-border-light)">
                <th v-for="col in ['Médico','Total','Concluídas','Faltaram','Tempo total','Tempo médio']" :key="col"
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in cMedicosPag" :key="m.nome" class="border-b hover:bg-blue-50 transition-colors" style="border-color:var(--color-border-light)">
                <td class="px-4 py-3 font-medium text-[var(--color-text)]">{{ m.nome }}</td>
                <td class="px-4 py-3 text-[var(--color-text-muted)]">{{ m.total }}</td>
                <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background:#dcfce7;color:#16a34a">{{ m.concluidas }}</span></td>
                <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background:#fee2e2;color:#dc2626">{{ m.faltaram }}</span></td>
                <td class="px-4 py-3 text-[var(--color-text-muted)]">{{ m.horasFmt }}</td>
                <td class="px-4 py-3 text-[var(--color-text-muted)]">{{ m.mediaMin ? `${m.mediaMin}min` : '—' }}</td>
              </tr>
              <tr v-if="!cMedicosPag.length">
                <td colspan="6" class="px-4 py-8 text-center text-sm" style="color:var(--color-text-muted)">Nenhum dado no período</td>
              </tr>
            </tbody>
          </table>
          <div v-if="cTotalPagMed > 1" class="flex items-center justify-between px-4 py-3" style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)">
            <span class="text-xs" style="color:var(--color-text-muted)">Página {{ cPagMed }} de {{ cTotalPagMed }}</span>
            <div class="flex gap-1">
              <button :disabled="cPagMed === 1" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="cPagMed--"><ChevronLeft :size="15" /></button>
              <button v-for="p in gerarPaginas(cPagMed, cTotalPagMed)" :key="p" class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold"
                :style="p === cPagMed ? 'background:#2563eb;color:white;border:1px solid #2563eb' : p === '...' ? 'background:transparent;color:var(--color-text-dim);border:none;cursor:default' : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
                :disabled="p === '...'" @click="typeof p === 'number' && (cPagMed = p)">{{ p }}</button>
              <button :disabled="cPagMed === cTotalPagMed" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="cPagMed++"><ChevronRight :size="15" /></button>
            </div>
          </div>
        </div>

        <!-- Top pacientes -->
        <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
          <div class="px-5 py-4 border-b flex items-center gap-2 font-semibold text-[var(--color-text)]" style="border-color:var(--color-border-light)">
            <Users :size="15" style="color:#2563eb" /> Pacientes com mais consultas
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr style="background:var(--color-surface-2);border-bottom:1px solid var(--color-border-light)">
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">#</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Paciente</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Consultas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, idx) in cPacientesPag" :key="p.nome" class="border-b hover:bg-blue-50 transition-colors" style="border-color:var(--color-border-light)">
                <td class="px-4 py-3 text-xs font-bold" style="color:var(--color-text-dim)">{{ (cPagPac - 1) * C_PP + idx + 1 }}</td>
                <td class="px-4 py-3 font-medium text-[var(--color-text)]">{{ p.nome }}</td>
                <td class="px-4 py-3"><span class="text-xs font-bold px-2.5 py-1 rounded-full" style="background:#dbeafe;color:#2563eb">{{ p.total }}</span></td>
              </tr>
              <tr v-if="!cPacientesPag.length">
                <td colspan="3" class="px-4 py-8 text-center text-sm" style="color:var(--color-text-muted)">Nenhuma consulta no período</td>
              </tr>
            </tbody>
          </table>
          <div v-if="cTotalPagPac > 1" class="flex items-center justify-between px-4 py-3" style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)">
            <span class="text-xs" style="color:var(--color-text-muted)">Página {{ cPagPac }} de {{ cTotalPagPac }}</span>
            <div class="flex gap-1">
              <button :disabled="cPagPac === 1" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="cPagPac--"><ChevronLeft :size="15" /></button>
              <button v-for="p in gerarPaginas(cPagPac, cTotalPagPac)" :key="p" class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold"
                :style="p === cPagPac ? 'background:#2563eb;color:white;border:1px solid #2563eb' : p === '...' ? 'background:transparent;color:var(--color-text-dim);border:none;cursor:default' : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
                :disabled="p === '...'" @click="typeof p === 'number' && (cPagPac = p)">{{ p }}</button>
              <button :disabled="cPagPac === cTotalPagPac" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="cPagPac++"><ChevronRight :size="15" /></button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ══ DOCUMENTOS ════════════════════════════════════════════ -->
    <template v-else-if="abaAtiva === 'documentos'">
      <div class="bg-white rounded-2xl border p-4 space-y-3" style="border-color:var(--color-border)">
        <!-- Período -->
        <div class="flex flex-wrap items-center gap-2">
          <CalendarDays :size="14" style="color:var(--color-text-dim)" />
          <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Período:</span>
          <button
            v-for="p in [{ v: 'hoje', l: 'Hoje' }, { v: '7d', l: '7 dias' }, { v: '30d', l: '30 dias' }, { v: 'mes', l: 'Este mês' }]"
            :key="p.v"
            class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
            style="background:white;color:var(--color-text-muted);border-color:var(--color-border)"
            @click="setPeriodo(dDataIni, dDataFim, p.v as any)"
          >{{ p.l }}</button>
          <div class="flex items-center gap-1.5 ml-auto">
            <input v-model="dDataIni" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
            <span class="text-xs" style="color:var(--color-text-dim)">até</span>
            <input v-model="dDataFim" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
          </div>
        </div>
        <!-- Médico / Tipo / Status -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            v-model="dMedico"
            class="w-full pl-4 pr-8 py-2.5 rounded-xl border text-sm outline-none appearance-none cursor-pointer"
            style="border-color:var(--color-border);background:var(--color-surface-2);color:var(--color-text)"
          >
            <option value="">Todos os médicos</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
          </select>
          <div class="relative">
            <select
              v-model="dTipo"
              class="w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm outline-none appearance-none cursor-pointer"
              style="border-color:var(--color-border);background:var(--color-surface-2);color:var(--color-text)"
            >
              <option value="">Todos os tipos</option>
              <option v-for="(label, key) in TIPOS_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
            <Filter :size="12" class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color:var(--color-text-dim)" />
          </div>
          <select
            v-model="dStatus"
            class="w-full pl-4 pr-8 py-2.5 rounded-xl border text-sm outline-none appearance-none cursor-pointer"
            style="border-color:var(--color-border);background:var(--color-surface-2);color:var(--color-text)"
          >
            <option value="">Todos os status</option>
            <option value="gerado">Gerado</option>
            <option value="enviado_paciente">Enviado</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </div>
      </div>

      <div v-if="dCarregando" class="py-12 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
      <template v-else>
        <!-- Resumo por tipo (clicável para filtrar) -->
        <div v-if="Object.keys(docsPorTipo).length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div v-for="(count, tipo) in docsPorTipo" :key="tipo"
            class="p-3 rounded-xl border text-center cursor-pointer transition-all hover:scale-105"
            :style="`background:${TIPOS_CORES[tipo]}0f;border-color:${TIPOS_CORES[tipo]}${dTipo === tipo ? '99' : '30'}`"
            @click="dTipo = dTipo === tipo ? '' : tipo"
          >
            <p class="text-2xl font-bold" :style="`color:${TIPOS_CORES[tipo]}`">{{ count }}</p>
            <p class="text-xs mt-1 font-medium" style="color:var(--color-text-muted)">{{ TIPOS_LABELS[tipo] ?? tipo }}</p>
          </div>
        </div>

        <!-- Tabela documentos -->
        <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
          <div class="px-5 py-3 border-b" style="border-color:var(--color-border-light);background:var(--color-surface-2)">
            <span class="text-xs font-semibold" style="color:var(--color-text-muted)">{{ dTotal }} documento{{ dTotal !== 1 ? 's' : '' }}</span>
          </div>
          <div v-if="!documentosList.length" class="py-12 text-center">
            <FileText :size="32" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
            <p class="text-sm" style="color:var(--color-text-muted)">Nenhum documento no período</p>
          </div>
          <table v-else class="w-full text-sm">
            <thead>
              <tr style="border-bottom:1px solid var(--color-border-light)">
                <th v-for="col in ['Tipo','Paciente','Médico','Data','Status']" :key="col"
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in documentosList" :key="doc.id" class="border-b hover:bg-blue-50 transition-colors" style="border-color:var(--color-border-light)">
                <td class="px-4 py-3">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    :style="`background:${TIPOS_CORES[doc.tipo]}18;color:${TIPOS_CORES[doc.tipo]}`">
                    <FileText :size="10" /> {{ TIPOS_LABELS[doc.tipo] ?? doc.tipo }}
                  </span>
                </td>
                <td class="px-4 py-3 font-medium text-[var(--color-text)]">{{ doc.pacientes?.nome ?? '—' }}</td>
                <td class="px-4 py-3 hidden md:table-cell text-sm" style="color:var(--color-text-muted)">{{ doc.medicos?.nome ?? '—' }}</td>
                <td class="px-4 py-3 hidden sm:table-cell text-xs" style="color:var(--color-text-muted)">{{ new Date(doc.created_at).toLocaleDateString('pt-BR') }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                    :style="doc.status === 'gerado' ? 'background:#fef3c7;color:#d97706' : doc.status === 'enviado_paciente' ? 'background:#dcfce7;color:#16a34a' : 'background:#f1f5f9;color:#64748b'">
                    {{ doc.status === 'gerado' ? 'Gerado' : doc.status === 'enviado_paciente' ? 'Enviado' : 'Arquivado' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="dTotalPag > 1" class="flex items-center justify-between px-4 py-3" style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)">
            <span class="text-xs" style="color:var(--color-text-muted)">{{ (dPagina - 1) * D_PP + 1 }}–{{ Math.min(dPagina * D_PP, dTotal) }} de {{ dTotal }}</span>
            <div class="flex gap-1">
              <button :disabled="dPagina === 1" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="dPagina--"><ChevronLeft :size="15" /></button>
              <button v-for="p in gerarPaginas(dPagina, dTotalPag)" :key="p" class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold"
                :style="p === dPagina ? 'background:#2563eb;color:white;border:1px solid #2563eb' : p === '...' ? 'background:transparent;color:var(--color-text-dim);border:none;cursor:default' : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
                :disabled="p === '...'" @click="typeof p === 'number' && (dPagina = p)">{{ p }}</button>
              <button :disabled="dPagina === dTotalPag" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="dPagina++"><ChevronRight :size="15" /></button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ══ IMPORTAÇÕES ══════════════════════════════════════════ -->
    <template v-else-if="abaAtiva === 'importacoes'">
      <div class="bg-white rounded-2xl border p-4" style="border-color:var(--color-border)">
        <div class="flex flex-wrap items-center gap-2">
          <CalendarDays :size="14" style="color:var(--color-text-dim)" />
          <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Período:</span>
          <button
            v-for="p in [{ v: 'hoje', l: 'Hoje' }, { v: '7d', l: '7 dias' }, { v: '30d', l: '30 dias' }, { v: 'mes', l: 'Este mês' }]"
            :key="p.v"
            class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
            style="background:white;color:var(--color-text-muted);border-color:var(--color-border)"
            @click="setPeriodo(iDataIni, iDataFim, p.v as any)"
          >{{ p.l }}</button>
          <div class="flex items-center gap-1.5 ml-auto">
            <input v-model="iDataIni" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
            <span class="text-xs" style="color:var(--color-text-dim)">até</span>
            <input v-model="iDataFim" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
          </div>
        </div>
      </div>

      <div v-if="iCarregando" class="py-12 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
      <template v-else>
        <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
          <div class="px-5 py-4 border-b font-semibold text-[var(--color-text)]" style="border-color:var(--color-border-light)">
            Importações via SUS — {{ iTotal }} registro{{ iTotal !== 1 ? 's' : '' }}
          </div>
          <div v-if="!importacoes.length" class="py-16 text-center">
            <Upload :size="32" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
            <p class="text-sm" style="color:var(--color-text-muted)">Nenhuma importação no período</p>
          </div>
          <table v-else class="w-full text-sm">
            <thead>
              <tr style="background:var(--color-surface-2);border-bottom:1px solid var(--color-border-light)">
                <th v-for="col in ['Data','Arquivo','Importados','Erros','Status']" :key="col"
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="imp in importacoes" :key="imp.created_at" class="border-b hover:bg-blue-50 transition-colors" style="border-color:var(--color-border-light)">
                <td class="px-4 py-3 text-xs" style="color:var(--color-text-muted)">
                  {{ new Date(imp.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }}
                </td>
                <td class="px-4 py-3 font-mono text-xs text-[var(--color-text)]">{{ imp.arquivo_nome }}</td>
                <td class="px-4 py-3"><span class="text-xs font-bold px-2.5 py-1 rounded-full" style="background:#dcfce7;color:#16a34a">{{ imp.importados }}</span></td>
                <td class="px-4 py-3">
                  <span v-if="imp.erros" class="text-xs font-bold px-2.5 py-1 rounded-full" style="background:#fee2e2;color:#dc2626">{{ imp.erros }}</span>
                  <span v-else class="text-xs" style="color:var(--color-text-dim)">—</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-xs font-semibold px-2.5 py-1 rounded-full"
                    :style="imp.erros ? 'background:#fef3c7;color:#d97706' : 'background:#dcfce7;color:#16a34a'">
                    {{ imp.erros ? 'Com erros' : 'Sucesso' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="iTotalPag > 1" class="flex items-center justify-between px-4 py-3" style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)">
            <span class="text-xs" style="color:var(--color-text-muted)">{{ (iPagina - 1) * I_PP + 1 }}–{{ Math.min(iPagina * I_PP, iTotal) }} de {{ iTotal }}</span>
            <div class="flex gap-1">
              <button :disabled="iPagina === 1" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="iPagina--"><ChevronLeft :size="15" /></button>
              <button v-for="p in gerarPaginas(iPagina, iTotalPag)" :key="p" class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold"
                :style="p === iPagina ? 'background:#2563eb;color:white;border:1px solid #2563eb' : p === '...' ? 'background:transparent;color:var(--color-text-dim);border:none;cursor:default' : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
                :disabled="p === '...'" @click="typeof p === 'number' && (iPagina = p)">{{ p }}</button>
              <button :disabled="iPagina === iTotalPag" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="iPagina++"><ChevronRight :size="15" /></button>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
