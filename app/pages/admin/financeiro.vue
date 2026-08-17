<script setup lang="ts">
import {
  DollarSign, TrendingUp, Users, BarChart3,
  CalendarDays, ChevronLeft, ChevronRight, Filter, Clock,
  FileText, FileSpreadsheet,
} from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()

function hoje() { return new Date().toISOString().slice(0, 10) }
function inicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtHoras(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
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

// Filtros
const dataIni = ref(inicioMes())
const dataFim = ref(hoje())
const medicoFiltro = ref('')
const medicos = ref<{ id: string; nome: string; especialidade: string; valor_consulta: number | null; valor_hora: number | null }[]>([])

// Dados
const carregando = ref(false)

interface RowMedico {
  id: string
  nome: string
  especialidade: string
  valorConsulta: number
  valorHora: number | null
  consultas: number
  minutosTrabalhados: number
  receitaTotal: number
  ticketMedio: number
}

const linhas = ref<RowMedico[]>([])

// Paginação dos atendimentos detalhados
const POR_PAGINA = 20
const paginaDetalhe = ref(1)
const totalDetalhe = ref(0)
const atendimentos = ref<{ data: string; paciente: string; medico: string; duracao: number | null; valor: number }[]>([])
const totalPagDetalhe = computed(() => Math.max(1, Math.ceil(totalDetalhe.value / POR_PAGINA)))

// KPIs
const receitaTotal = computed(() => linhas.value.reduce((s, r) => s + r.receitaTotal, 0))
const totalConsultas = computed(() => linhas.value.reduce((s, r) => s + r.consultas, 0))
const ticketMedioGeral = computed(() =>
  totalConsultas.value ? receitaTotal.value / totalConsultas.value : 0
)
const medicoTopReceita = computed(() =>
  [...linhas.value].sort((a, b) => b.receitaTotal - a.receitaTotal)[0] ?? null
)
const totalMinutos = computed(() => linhas.value.reduce((s, r) => s + r.minutosTrabalhados, 0))

async function carregar() {
  carregando.value = true
  paginaDetalhe.value = 1

  // Buscar todos os médicos com valor_consulta / valor_hora
  const { data: meds } = await supabase
    .from('medicos')
    .select('id, nome, especialidade, valor_consulta, valor_hora')
    .eq('ativo', true)
    .order('nome')
  medicos.value = (meds ?? []) as typeof medicos.value

  // Buscar consultas concluídas no período
  let q = supabase
    .from('consultas')
    .select('medico_id, duracao_minutos, created_at, pacientes(nome)', { count: 'exact' })
    .gte('created_at', `${dataIni.value}T00:00:00`)
    .lte('created_at', `${dataFim.value}T23:59:59`)

  if (medicoFiltro.value) q = q.eq('medico_id', medicoFiltro.value)

  const { data: consultas } = await q

  // Agrupar por médico — quantidade de consultas e minutos trabalhados
  const porMedico: Record<string, number> = {}
  const minutosPorMedico: Record<string, number> = {}
  ;(consultas ?? []).forEach((c: any) => {
    if (!c.medico_id) return
    porMedico[c.medico_id] = (porMedico[c.medico_id] ?? 0) + 1
    minutosPorMedico[c.medico_id] = (minutosPorMedico[c.medico_id] ?? 0) + (c.duracao_minutos ?? 0)
  })

  const medicosAlvo = medicoFiltro.value
    ? medicos.value.filter(m => m.id === medicoFiltro.value)
    : medicos.value

  linhas.value = medicosAlvo
    .map(m => {
      const qtd = porMedico[m.id] ?? 0
      const minutos = minutosPorMedico[m.id] ?? 0
      const valor = m.valor_consulta ?? 0
      // Médico com valor/hora definido é pago pelas horas trabalhadas;
      // senão, o padrão continua sendo por consulta.
      const receita = m.valor_hora
        ? (minutos / 60) * m.valor_hora
        : qtd * valor
      return {
        id: m.id,
        nome: m.nome,
        especialidade: m.especialidade,
        valorConsulta: valor,
        valorHora: m.valor_hora,
        consultas: qtd,
        minutosTrabalhados: minutos,
        receitaTotal: receita,
        ticketMedio: qtd ? receita / qtd : 0,
      }
    })
    .sort((a, b) => b.receitaTotal - a.receitaTotal)

  await carregarAtendimentos()
  carregando.value = false
}

async function carregarAtendimentos() {
  const from = (paginaDetalhe.value - 1) * POR_PAGINA
  let q = supabase
    .from('consultas')
    .select('created_at, duracao_minutos, medico_id, medicos(nome), pacientes(nome)', { count: 'exact' })
    .gte('created_at', `${dataIni.value}T00:00:00`)
    .lte('created_at', `${dataFim.value}T23:59:59`)
    .order('created_at', { ascending: false })
    .range(from, from + POR_PAGINA - 1)

  if (medicoFiltro.value) q = q.eq('medico_id', medicoFiltro.value)

  const { data, count } = await q
  totalDetalhe.value = count ?? 0

  const mapa: Record<string, { valorConsulta: number; valorHora: number | null }> = {}
  medicos.value.forEach(m => { mapa[m.id] = { valorConsulta: m.valor_consulta ?? 0, valorHora: m.valor_hora } })

  atendimentos.value = (data ?? []).map((c: any) => {
    const info = mapa[c.medico_id]
    const valor = info?.valorHora
      ? (info.valorHora / 60) * (c.duracao_minutos ?? 0)
      : info?.valorConsulta ?? 0
    return {
      data: c.created_at,
      paciente: c.pacientes?.nome ?? '—',
      medico: c.medicos?.nome ?? '—',
      duracao: c.duracao_minutos,
      valor,
    }
  })
}

watch([dataIni, dataFim, medicoFiltro], () => carregar())
watch(paginaDetalhe, carregarAtendimentos)
onMounted(carregar)

function setPeriodo(p: 'hoje' | '7d' | '30d' | 'mes') {
  dataFim.value = hoje()
  if (p === 'hoje') dataIni.value = hoje()
  else if (p === '7d') { const d = new Date(); d.setDate(d.getDate() - 6); dataIni.value = d.toISOString().slice(0, 10) }
  else if (p === '30d') { const d = new Date(); d.setDate(d.getDate() - 29); dataIni.value = d.toISOString().slice(0, 10) }
  else dataIni.value = inicioMes()
}

function exportarCSV() {
  const linhasCSV = [
    ['Médico', 'Especialidade', 'Valor/Consulta', 'Valor/Hora', 'Consultas', 'Horas Trabalhadas', 'Receita Total'],
    ...linhas.value.map(r => [r.nome, r.especialidade, r.valorConsulta, r.valorHora ?? '', r.consultas, (r.minutosTrabalhados / 60).toFixed(2), r.receitaTotal]),
  ]
  const csv = linhasCSV.map(l => l.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `financeiro_${dataIni.value}_${dataFim.value}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function periodoLabel() {
  const f = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
  return `${f(dataIni.value)} a ${f(dataFim.value)}`
}

async function urlParaBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const exportandoPDF = ref(false)
async function exportarPDF() {
  exportandoPDF.value = true
  try {
    const { default: pdfMake } = await import('pdfmake/build/pdfmake')
    const { default: vfsFonts } = await import('pdfmake/build/vfs_fonts')
    pdfMake.vfs = vfsFonts.vfs

    const logoBase64 = await urlParaBase64(`${window.location.origin}/logo.png`)
    const geradoEm = new Date().toLocaleString('pt-BR')

    const corpoTabela = [
      ['Médico', 'Especialidade', 'Valor', 'Consultas', 'Horas', 'Receita'].map(t => ({ text: t, style: 'th' })),
      ...linhas.value.map(r => [
        r.nome,
        r.especialidade,
        r.valorHora ? `${fmtBRL(r.valorHora)}/h` : fmtBRL(r.valorConsulta),
        String(r.consultas),
        fmtHoras(r.minutosTrabalhados),
        { text: fmtBRL(r.receitaTotal), bold: true },
      ]),
      [
        { text: 'Total', colSpan: 3, bold: true }, {}, {},
        { text: String(totalConsultas.value), bold: true },
        { text: fmtHoras(totalMinutos.value), bold: true },
        { text: fmtBRL(receitaTotal.value), bold: true, color: '#16a34a' },
      ],
    ]

    const docDef = {
      pageMargins: [40, 90, 40, 60] as [number, number, number, number],
      background: logoBase64
        ? () => ({
            image: logoBase64,
            width: 260,
            opacity: 0.06,
            absolutePosition: { x: (595.28 - 260) / 2, y: (841.89 - 260 * (248 / 600)) / 2 },
          })
        : undefined,
      header: {
        margin: [40, 24, 40, 0],
        stack: [
          {
            columns: [
              ...(logoBase64 ? [{ image: logoBase64, width: 90 } as unknown] : []),
              {
                width: '*',
                stack: [
                  { text: 'Central SóMedicos', style: 'clinica', alignment: 'right' },
                  { text: 'Relatório Financeiro', style: 'clinicaSub', alignment: 'right' },
                ],
              },
            ],
          },
          { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1.2, lineColor: '#2563eb' }] },
        ],
      },
      footer: (currentPage: number, pageCount: number) => ({
        margin: [40, 8, 40, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#94a3b8' }] },
          {
            columns: [
              { text: 'Central SóMedicos', style: 'rodape' },
              { text: `Gerado em ${geradoEm}`, style: 'rodape', alignment: 'center' },
              { text: `Página ${currentPage} de ${pageCount}`, style: 'rodape', alignment: 'right' },
            ],
          },
        ],
      }),
      content: [
        { text: 'Relatório Financeiro', style: 'titulo' },
        { text: `Período: ${periodoLabel()}${medicoFiltro.value ? ' · ' + (medicos.value.find(m => m.id === medicoFiltro.value)?.nome ?? '') : ''}`, style: 'subtitulo' },
        '\n',
        {
          columns: [
            { text: [{ text: 'Receita Total\n', style: 'kpiLabel' }, { text: fmtBRL(receitaTotal.value), style: 'kpiValor' }] },
            { text: [{ text: 'Consultas\n', style: 'kpiLabel' }, { text: String(totalConsultas.value), style: 'kpiValor' }] },
            { text: [{ text: 'Horas Trabalhadas\n', style: 'kpiLabel' }, { text: fmtHoras(totalMinutos.value), style: 'kpiValor' }] },
            { text: [{ text: 'Ticket Médio\n', style: 'kpiLabel' }, { text: fmtBRL(ticketMedioGeral.value), style: 'kpiValor' }] },
          ],
        },
        '\n\n',
        {
          table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'], body: corpoTabela },
          layout: {
            fillColor: (i: number) => (i === 0 ? '#eff6ff' : i === corpoTabela.length - 1 ? '#f8fafc' : null),
            hLineColor: () => '#e2e8f0',
            vLineWidth: () => 0,
            hLineWidth: (i: number) => (i === 1 ? 1 : 0.5),
          },
        },
      ],
      styles: {
        clinica: { fontSize: 16, bold: true, color: '#2563eb', margin: [0, 0, 0, 2] },
        clinicaSub: { fontSize: 9, color: '#64748b' },
        titulo: { fontSize: 16, bold: true, color: '#0f172a' },
        subtitulo: { fontSize: 10, color: '#64748b', margin: [0, 2, 0, 0] },
        kpiLabel: { fontSize: 9, color: '#64748b' },
        kpiValor: { fontSize: 14, bold: true, color: '#0f172a' },
        th: { bold: true, fontSize: 9, color: '#1d4ed8' },
        rodape: { fontSize: 8, color: '#94a3b8' },
      },
      defaultStyle: { fontSize: 9, lineHeight: 1.3 },
    }

    pdfMake.createPdf(docDef as any).download(`financeiro_${dataIni.value}_${dataFim.value}.pdf`)
  } finally {
    exportandoPDF.value = false
  }
}

async function exportarExcel() {
  const XLSX = await import('xlsx')

  const linhasPlanilha: (string | number)[][] = [
    ['CENTRAL SÓMEDICOS'],
    ['Relatório Financeiro'],
    [`Período: ${periodoLabel()}`],
    [],
    ['Médico', 'Especialidade', 'Valor/Consulta', 'Valor/Hora', 'Consultas', 'Horas Trabalhadas', 'Receita Total'],
    ...linhas.value.map(r => [
      r.nome, r.especialidade, r.valorConsulta, r.valorHora ?? '', r.consultas,
      Number((r.minutosTrabalhados / 60).toFixed(2)), r.receitaTotal,
    ]),
    [],
    ['Total', '', '', '', totalConsultas.value, Number((totalMinutos.value / 60).toFixed(2)), receitaTotal.value],
  ]

  const ws = XLSX.utils.aoa_to_sheet(linhasPlanilha)
  ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 11 }, { wch: 16 }, { wch: 14 }]
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Financeiro')
  XLSX.writeFile(wb, `financeiro_${dataIni.value}_${dataFim.value}.xlsx`)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Financeiro</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">Receita por médico com base nas consultas realizadas</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UiButton variant="secondary" size="sm" :loading="exportandoPDF" @click="exportarPDF">
          <FileText :size="15" /> Exportar PDF
        </UiButton>
        <UiButton variant="secondary" size="sm" @click="exportarExcel">
          <FileSpreadsheet :size="15" /> Exportar Excel
        </UiButton>
        <UiButton variant="ghost" size="sm" @click="exportarCSV">
          <BarChart3 :size="15" /> CSV
        </UiButton>
      </div>
    </div>

    <!-- Filtros -->
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
          @click="setPeriodo(p.v as any)"
        >{{ p.l }}</button>
        <div class="flex items-center gap-1.5 ml-auto">
          <input v-model="dataIni" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
          <span class="text-xs" style="color:var(--color-text-dim)">até</span>
          <input v-model="dataFim" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:var(--color-border);background:var(--color-surface-2)" />
        </div>
      </div>

      <!-- Médico -->
      <div class="flex flex-wrap gap-2 items-center">
        <span class="inline-flex items-center gap-1 text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">
          <Filter :size="12" /> Médico:
        </span>
        <button
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="medicoFiltro === '' ? 'background:#2563eb;color:white;border-color:#2563eb' : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="medicoFiltro = ''"
        >Todos</button>
        <button
          v-for="m in medicos" :key="m.id"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="medicoFiltro === m.id ? 'background:#2563eb;color:white;border-color:#2563eb' : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="medicoFiltro = m.id"
        >{{ m.nome }}</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="carregando" class="py-12 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <template v-else>
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="bg-white rounded-2xl border p-4" style="border-color:var(--color-border)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#dbeafe">
              <DollarSign :size="16" style="color:#2563eb" />
            </div>
            <p class="text-xs font-semibold" style="color:var(--color-text-muted)">Receita Total</p>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text)]">{{ fmtBRL(receitaTotal) }}</p>
        </div>

        <div class="bg-white rounded-2xl border p-4" style="border-color:var(--color-border)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#dcfce7">
              <BarChart3 :size="16" style="color:#16a34a" />
            </div>
            <p class="text-xs font-semibold" style="color:var(--color-text-muted)">Consultas</p>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text)]">{{ totalConsultas }}</p>
        </div>

        <div class="bg-white rounded-2xl border p-4" style="border-color:var(--color-border)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#fef3c7">
              <TrendingUp :size="16" style="color:#d97706" />
            </div>
            <p class="text-xs font-semibold" style="color:var(--color-text-muted)">Ticket Médio</p>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text)]">{{ fmtBRL(ticketMedioGeral) }}</p>
        </div>

        <div class="bg-white rounded-2xl border p-4" style="border-color:var(--color-border)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#e0f2fe">
              <Clock :size="16" style="color:#0284c7" />
            </div>
            <p class="text-xs font-semibold" style="color:var(--color-text-muted)">Horas Trabalhadas</p>
          </div>
          <p class="text-2xl font-bold text-[var(--color-text)]">{{ fmtHoras(totalMinutos) }}</p>
        </div>

        <div class="bg-white rounded-2xl border p-4" style="border-color:var(--color-border)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#ede9fe">
              <Users :size="16" style="color:#7c3aed" />
            </div>
            <p class="text-xs font-semibold" style="color:var(--color-text-muted)">Top Receita</p>
          </div>
          <p class="text-sm font-bold text-[var(--color-text)] leading-tight">
            {{ medicoTopReceita?.nome ?? '—' }}
          </p>
          <p v-if="medicoTopReceita" class="text-xs mt-0.5" style="color:var(--color-text-muted)">
            {{ fmtBRL(medicoTopReceita.receitaTotal) }}
          </p>
        </div>
      </div>

      <!-- Tabela por médico -->
      <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
        <div class="px-5 py-4 border-b font-semibold text-[var(--color-text)]" style="border-color:var(--color-border-light)">
          Receita por Médico
        </div>
        <div v-if="!linhas.length" class="py-12 text-center">
          <DollarSign :size="32" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
          <p class="text-sm" style="color:var(--color-text-muted)">Nenhuma consulta no período selecionado</p>
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr style="background:var(--color-surface-2);border-bottom:1px solid var(--color-border-light)">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Médico</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">Especialidade</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style="color:var(--color-text-muted)">Valor/Consulta ou Hora</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Consultas</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">Horas</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Receita Total</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style="color:var(--color-text-muted)">% do total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in linhas" :key="r.id"
              class="border-b hover:bg-blue-50 transition-colors"
              style="border-color:var(--color-border-light)"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <UiAvatar :name="r.nome" size="xs" />
                  <span class="font-medium text-[var(--color-text)]">{{ r.nome }}</span>
                </div>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell text-sm" style="color:var(--color-text-muted)">{{ r.especialidade }}</td>
              <td class="px-4 py-3 hidden md:table-cell">
                <span v-if="r.valorHora" class="text-sm font-semibold" style="color:#0284c7">{{ fmtBRL(r.valorHora) }}/h</span>
                <span v-else-if="r.valorConsulta" class="text-sm font-semibold" style="color:#16a34a">{{ fmtBRL(r.valorConsulta) }}</span>
                <span v-else class="text-xs px-2 py-0.5 rounded-full" style="background:#fef3c7;color:#d97706">Não definido</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm font-bold px-2.5 py-1 rounded-full" style="background:#dbeafe;color:#2563eb">
                  {{ r.consultas }}
                </span>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell text-sm font-medium" style="color:var(--color-text-muted)">
                {{ fmtHoras(r.minutosTrabalhados) }}
              </td>
              <td class="px-4 py-3">
                <span class="text-sm font-bold" style="color:#16a34a">{{ fmtBRL(r.receitaTotal) }}</span>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background:#f1f5f9;max-width:80px">
                    <div
                      class="h-full rounded-full"
                      style="background:#2563eb"
                      :style="`width:${receitaTotal ? Math.round((r.receitaTotal / receitaTotal) * 100) : 0}%`"
                    />
                  </div>
                  <span class="text-xs font-semibold" style="color:var(--color-text-muted)">
                    {{ receitaTotal ? Math.round((r.receitaTotal / receitaTotal) * 100) : 0 }}%
                  </span>
                </div>
              </td>
            </tr>
            <!-- Totais -->
            <tr style="background:var(--color-surface-2);border-top:2px solid var(--color-border)">
              <td class="px-4 py-3 font-bold text-[var(--color-text)]" colspan="3">Total</td>
              <td class="px-4 py-3">
                <span class="text-sm font-bold px-2.5 py-1 rounded-full" style="background:#dbeafe;color:#2563eb">
                  {{ totalConsultas }}
                </span>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell font-bold text-sm" style="color:var(--color-text-muted)">{{ fmtHoras(totalMinutos) }}</td>
              <td class="px-4 py-3 font-bold text-lg" style="color:#16a34a">{{ fmtBRL(receitaTotal) }}</td>
              <td class="px-4 py-3 hidden lg:table-cell" />
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tabela de atendimentos detalhados -->
      <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
        <div class="px-5 py-4 border-b font-semibold text-[var(--color-text)]" style="border-color:var(--color-border-light)">
          Atendimentos individuais <span class="text-sm font-normal" style="color:var(--color-text-muted)">({{ totalDetalhe }} registros)</span>
        </div>
        <div v-if="!atendimentos.length" class="py-10 text-center text-sm" style="color:var(--color-text-muted)">
          Nenhum atendimento no período
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr style="background:var(--color-surface-2);border-bottom:1px solid var(--color-border-light)">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Data</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Paciente</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style="color:var(--color-text-muted)">Médico</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">Duração</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(a, i) in atendimentos" :key="i"
              class="border-b hover:bg-blue-50 transition-colors"
              style="border-color:var(--color-border-light)"
            >
              <td class="px-4 py-3 text-xs" style="color:var(--color-text-muted)">
                {{ new Date(a.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }}
              </td>
              <td class="px-4 py-3 font-medium text-[var(--color-text)]">{{ a.paciente }}</td>
              <td class="px-4 py-3 hidden md:table-cell text-sm" style="color:var(--color-text-muted)">{{ a.medico }}</td>
              <td class="px-4 py-3 hidden sm:table-cell text-xs" style="color:var(--color-text-muted)">
                {{ a.duracao ? `${a.duracao} min` : '—' }}
              </td>
              <td class="px-4 py-3 font-semibold text-sm" style="color:#16a34a">
                {{ a.valor ? fmtBRL(a.valor) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
        <!-- Paginação -->
        <div
          v-if="totalPagDetalhe > 1"
          class="flex items-center justify-between px-4 py-3"
          style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)"
        >
          <span class="text-xs" style="color:var(--color-text-muted)">
            {{ (paginaDetalhe - 1) * POR_PAGINA + 1 }}–{{ Math.min(paginaDetalhe * POR_PAGINA, totalDetalhe) }} de {{ totalDetalhe }}
          </span>
          <div class="flex gap-1">
            <button :disabled="paginaDetalhe === 1" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="paginaDetalhe--"><ChevronLeft :size="15" /></button>
            <button
              v-for="p in gerarPaginas(paginaDetalhe, totalPagDetalhe)" :key="p"
              class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold"
              :style="p === paginaDetalhe ? 'background:#2563eb;color:white;border:1px solid #2563eb' : p === '...' ? 'background:transparent;color:var(--color-text-dim);cursor:default;border:none' : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
              :disabled="p === '...'"
              @click="typeof p === 'number' && (paginaDetalhe = p)"
            >{{ p }}</button>
            <button :disabled="paginaDetalhe === totalPagDetalhe" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="paginaDetalhe++"><ChevronRight :size="15" /></button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
