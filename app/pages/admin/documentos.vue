<script setup lang="ts">
import { FileText, Eye, Send, Archive, FileDown, Search, Filter, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-vue-next'
import type { Documento } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const documentos = ref<Documento[]>([])
const carregando = ref(true)
const verModal = ref<Documento | null>(null)
const enviarModal = ref<Documento | null>(null)
const total = ref(0)

const TIPOS_LABELS: Record<string, string> = {
  atestado: 'Atestado',
  pedido_exame: 'Pedido de Exame',
  receita: 'Receita',
  receita_controlada: 'Receita Controlada',
  encaminhamento: 'Encaminhamento',
  declaracao: 'Declaração',
}

const TIPOS_CORES: Record<string, string> = {
  atestado: '#2563eb',
  pedido_exame: '#7c3aed',
  receita: '#16a34a',
  receita_controlada: '#dc2626',
  encaminhamento: '#d97706',
  declaracao: '#0891b2',
}

// Filtros
const buscaPaciente = ref('')
const filtroMedico = ref('')
const filtroTipo = ref('')
const filtroStatus = ref('')
const filtroDataInicio = ref('')
const filtroDataFim = ref('')

const medicos = ref<{ id: string; nome: string }[]>([])

// Funil
const funil = ref({ gerado: 0, enviado_paciente: 0, arquivado: 0, total: 0 })
const funilPorTipo = ref<Record<string, number>>({})

async function carregarFunil() {
  const { data } = await supabase.from('documentos').select('status, tipo')
  const lista = data ?? []
  funil.value = {
    gerado: lista.filter(d => d.status === 'gerado').length,
    enviado_paciente: lista.filter(d => d.status === 'enviado_paciente').length,
    arquivado: lista.filter(d => d.status === 'arquivado').length,
    total: lista.length,
  }
  const porTipo: Record<string, number> = {}
  lista.forEach(d => { porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1 })
  funilPorTipo.value = porTipo
}

const POR_PAGINA = 20
const pagina = ref(1)

async function carregar() {
  carregando.value = true
  const from = (pagina.value - 1) * POR_PAGINA
  const to = from + POR_PAGINA - 1

  let q = supabase
    .from('documentos')
    .select('*, pacientes(nome, telefone, email), medicos(nome)', { count: 'exact' })

  if (filtroMedico.value) q = q.eq('medico_id', filtroMedico.value)
  if (filtroTipo.value) q = q.eq('tipo', filtroTipo.value)
  if (filtroStatus.value) q = q.eq('status', filtroStatus.value)
  if (filtroDataInicio.value) q = q.gte('created_at', filtroDataInicio.value)
  if (filtroDataFim.value) q = q.lte('created_at', filtroDataFim.value + 'T23:59:59')

  q = q.order('created_at', { ascending: false }).range(from, to)

  const { data, count } = await q
  let lista = (data ?? []) as Documento[]

  // Filtro por nome do paciente (client-side após busca paginada não é ideal,
  // mas pacientes.nome não é coluna direta — filtramos localmente e ajustamos total)
  if (buscaPaciente.value.trim()) {
    const termo = buscaPaciente.value.trim().toLowerCase()
    lista = lista.filter(d =>
      ((d.pacientes as any)?.nome ?? '').toLowerCase().includes(termo)
    )
  }

  documentos.value = lista
  total.value = count ?? 0
  carregando.value = false
}

const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

onMounted(async () => {
  const { data: meds } = await supabase.from('medicos').select('id, nome').order('nome')
  medicos.value = meds ?? []
  await Promise.all([carregar(), carregarFunil()])

  supabase
    .channel('documentos-admin')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documentos' }, () => { carregar(); carregarFunil() })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documentos' }, () => { carregar(); carregarFunil() })
    .subscribe()
})

watch([filtroMedico, filtroTipo, filtroStatus, filtroDataInicio, filtroDataFim], () => {
  pagina.value = 1
  carregar()
})
watch(pagina, carregar)

let debounce: ReturnType<typeof setTimeout>
watch(buscaPaciente, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => { pagina.value = 1; carregar() }, 300)
})

const temFiltroAtivo = computed(() =>
  !!filtroMedico.value || !!filtroTipo.value || !!filtroStatus.value ||
  !!filtroDataInicio.value || !!filtroDataFim.value || !!buscaPaciente.value
)

function limparFiltros() {
  buscaPaciente.value = ''
  filtroMedico.value = ''
  filtroTipo.value = ''
  filtroStatus.value = ''
  filtroDataInicio.value = ''
  filtroDataFim.value = ''
  pagina.value = 1
}

function definirPeriodo(periodo: 'hoje' | '7dias' | '30dias' | 'mes') {
  const hoje = new Date()
  filtroDataFim.value = hoje.toISOString().slice(0, 10)
  if (periodo === 'hoje') {
    filtroDataInicio.value = hoje.toISOString().slice(0, 10)
  } else if (periodo === '7dias') {
    const d = new Date(hoje); d.setDate(d.getDate() - 6)
    filtroDataInicio.value = d.toISOString().slice(0, 10)
  } else if (periodo === '30dias') {
    const d = new Date(hoje); d.setDate(d.getDate() - 29)
    filtroDataInicio.value = d.toISOString().slice(0, 10)
  } else if (periodo === 'mes') {
    filtroDataInicio.value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  }
}

async function arquivar(id: string) {
  await supabase.from('documentos').update({ status: 'arquivado' }).eq('id', id)
  await carregar()
}

// Envio
const enviandoTelefone = ref('')
const enviandoEmail = ref('')
const enviandoCanal = ref<'whatsapp' | 'email' | 'ambos'>('email')
const enviandoLoading = ref(false)

function abrirEnviar(doc: Documento) {
  enviarModal.value = doc
  enviandoTelefone.value = doc.pacientes?.telefone ?? ''
  enviandoEmail.value = doc.pacientes?.email ?? ''
  enviandoCanal.value = 'email'
}

async function confirmarEnvio() {
  if (!enviarModal.value) return
  enviandoLoading.value = true
  try {
    await $fetch('/api/documentos/send', {
      method: 'POST',
      body: {
        documentoId: enviarModal.value.id,
        canal: enviandoCanal.value,
        telefone: enviandoTelefone.value,
        email: enviandoEmail.value,
      },
    })
    await carregar()
    enviarModal.value = null
  } finally {
    enviandoLoading.value = false
  }
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
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Caixa de Documentos</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          {{ carregando ? '…' : `${total} documento${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` }}
        </p>
      </div>
    </div>

    <!-- Funil de status -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button
        v-for="etapa in [
          { status: '', label: 'Total', valor: funil.total, bg: '#f1f5f9', cor: '#475569', borda: '#e2e8f0', ativo: '#2563eb' },
          { status: 'gerado', label: 'Gerados', valor: funil.gerado, bg: '#fff7ed', cor: '#c2410c', borda: '#fed7aa', ativo: '#d97706' },
          { status: 'enviado_paciente', label: 'Enviados', valor: funil.enviado_paciente, bg: '#f0fdf4', cor: '#166534', borda: '#bbf7d0', ativo: '#16a34a' },
          { status: 'arquivado', label: 'Arquivados', valor: funil.arquivado, bg: '#f8fafc', cor: '#64748b', borda: '#e2e8f0', ativo: '#64748b' },
        ]"
        :key="etapa.status"
        type="button"
        class="rounded-2xl border p-4 text-left transition-all hover:shadow-sm"
        :style="filtroStatus === etapa.status
          ? `background:${etapa.ativo};color:white;border-color:${etapa.ativo}`
          : `background:${etapa.bg};color:${etapa.cor};border-color:${etapa.borda}`"
        @click="filtroStatus = etapa.status; pagina.value = 1"
      >
        <p class="text-2xl font-bold">{{ etapa.valor }}</p>
        <p class="text-xs font-semibold mt-0.5 opacity-80">{{ etapa.label }}</p>
        <div
          v-if="etapa.valor > 0 && funil.total > 0"
          class="mt-2 h-1 rounded-full overflow-hidden"
          :style="filtroStatus === etapa.status ? 'background:rgba(255,255,255,0.3)' : 'background:rgba(0,0,0,0.08)'"
        >
          <div
            class="h-full rounded-full"
            :style="`width:${Math.round((etapa.valor / funil.total) * 100)}%;background:${filtroStatus === etapa.status ? 'white' : etapa.ativo}`"
          />
        </div>
      </button>
    </div>

    <!-- Funil por tipo -->
    <div class="flex flex-wrap gap-2 items-center">
      <span class="text-xs font-semibold" style="color:var(--color-text-muted)">Por tipo:</span>
      <span
        v-for="(label, key) in TIPOS_LABELS"
        :key="key"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border transition-all"
        :style="filtroTipo === key
          ? `background:${TIPOS_CORES[key]};color:white;border-color:${TIPOS_CORES[key]}`
          : `background:white;color:${TIPOS_CORES[key]};border-color:${TIPOS_CORES[key]}40`"
        @click="filtroTipo = filtroTipo === key ? '' : key; pagina.value = 1"
      >
        <span class="w-1.5 h-1.5 rounded-full" :style="`background:${TIPOS_CORES[key]}`" />
        {{ label }}
        <span class="opacity-70">({{ funilPorTipo[key] ?? 0 }})</span>
      </span>
    </div>

    <!-- Painel de filtros -->
    <div class="bg-white rounded-2xl border p-4 space-y-4" style="border-color:var(--color-border)">

      <!-- Linha 1: busca + médico -->
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

      <!-- Linha 2: período -->
      <div class="flex flex-wrap items-center gap-2">
        <CalendarDays :size="14" style="color:var(--color-text-dim)" class="shrink-0" />
        <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Período:</span>
        <button
          v-for="p in [{ v: 'hoje', l: 'Hoje' }, { v: '7dias', l: 'Últimos 7 dias' }, { v: '30dias', l: 'Últimos 30 dias' }, { v: 'mes', l: 'Este mês' }]"
          :key="p.v"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          style="background:white;color:var(--color-text-muted);border-color:var(--color-border)"
          @click="definirPeriodo(p.v as any)"
        >
          {{ p.l }}
        </button>
        <div class="flex items-center gap-1.5 ml-auto">
          <input
            v-model="filtroDataInicio"
            type="date"
            class="rounded-xl border px-3 py-1.5 text-xs outline-none"
            style="border-color:var(--color-border);background:var(--color-surface-2)"
          />
          <span class="text-xs" style="color:var(--color-text-dim)">até</span>
          <input
            v-model="filtroDataFim"
            type="date"
            class="rounded-xl border px-3 py-1.5 text-xs outline-none"
            style="border-color:var(--color-border);background:var(--color-surface-2)"
          />
        </div>
      </div>

      <!-- Linha 3: tipo (chips) -->
      <div class="flex flex-wrap gap-2 items-center">
        <span class="inline-flex items-center gap-1 text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">
          <Filter :size="13" /> Tipo:
        </span>
        <button
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="filtroTipo === ''
            ? 'background:#2563eb;color:white;border-color:#2563eb'
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="filtroTipo = ''"
        >Todos</button>
        <button
          v-for="(label, key) in TIPOS_LABELS"
          :key="key"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="filtroTipo === key
            ? `background:${TIPOS_CORES[key]};color:white;border-color:${TIPOS_CORES[key]}`
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="filtroTipo = key"
        >{{ label }}</button>
      </div>

      <!-- Linha 4: status + limpar -->
      <div class="flex flex-wrap gap-2 items-center">
        <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Status:</span>
        <button
          v-for="op in [{ v: '', l: 'Todos', bg: '#2563eb' }, { v: 'gerado', l: 'Gerado', bg: '#d97706' }, { v: 'enviado_paciente', l: 'Enviado', bg: '#16a34a' }, { v: 'arquivado', l: 'Arquivado', bg: '#64748b' }]"
          :key="op.v"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="filtroStatus === op.v
            ? `background:${op.bg};color:white;border-color:${op.bg}`
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="filtroStatus = op.v"
        >{{ op.l }}</button>

        <button
          v-if="temFiltroAtivo"
          class="px-3 py-1 rounded-full text-xs font-semibold ml-auto"
          style="color:#ef4444;background:#fef2f2;border:1px solid #fecaca"
          @click="limparFiltros"
        >✕ Limpar filtros</button>
      </div>
    </div>

    <!-- Tabela -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
      <!-- Loading -->
      <div v-if="carregando" class="p-8 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>

      <!-- Vazio -->
      <div v-else-if="documentos.length === 0" class="py-16 text-center">
        <FileText :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
        <p class="font-medium" style="color:var(--color-text-muted)">Nenhum documento encontrado</p>
        <button v-if="temFiltroAtivo" class="mt-2 text-sm text-blue-500 hover:underline" @click="limparFiltros">
          Limpar filtros
        </button>
      </div>

      <template v-else>
        <table class="w-full text-sm">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border-light);background:var(--color-surface-2)">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Tipo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Paciente</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style="color:var(--color-text-muted)">Médico</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">Data</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="doc in documentos"
              :key="doc.id"
              class="border-b transition-colors hover:bg-blue-50"
              style="border-color:var(--color-border-light)"
            >
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  :style="`background:${TIPOS_CORES[doc.tipo]}18;color:${TIPOS_CORES[doc.tipo]}`"
                >
                  <FileText :size="11" />
                  {{ TIPOS_LABELS[doc.tipo] ?? doc.tipo }}
                </span>
              </td>
              <td class="px-4 py-3">
                <p class="font-medium text-[var(--color-text)]">{{ (doc.pacientes as any)?.nome ?? '—' }}</p>
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-sm" style="color:var(--color-text-muted)">
                {{ (doc.medicos as any)?.nome ?? '—' }}
              </td>
              <td class="px-4 py-3 hidden sm:table-cell text-xs" style="color:var(--color-text-muted)">
                {{ new Date(doc.created_at).toLocaleDateString('pt-BR') }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                  :style="doc.status === 'gerado'
                    ? 'background:#fef3c7;color:#d97706'
                    : doc.status === 'enviado_paciente'
                      ? 'background:#dcfce7;color:#16a34a'
                      : 'background:#f1f5f9;color:#64748b'"
                >
                  {{ doc.status === 'gerado' ? 'Gerado' : doc.status === 'enviado_paciente' ? 'Enviado' : 'Arquivado' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <button
                    v-if="doc.pdf_url"
                    class="p-1.5 rounded-lg transition-colors"
                    style="background:#eff6ff;color:#2563eb"
                    title="Visualizar"
                    @click="verModal = doc"
                  >
                    <Eye :size="14" />
                  </button>
                  <button
                    v-if="doc.status !== 'arquivado'"
                    class="p-1.5 rounded-lg transition-colors"
                    style="background:#dcfce7;color:#16a34a"
                    title="Enviar ao paciente"
                    @click="abrirEnviar(doc)"
                  >
                    <Send :size="14" />
                  </button>
                  <button
                    v-if="doc.status !== 'arquivado'"
                    class="p-1.5 rounded-lg transition-colors"
                    style="background:#f1f5f9;color:#64748b"
                    title="Arquivar"
                    @click="arquivar(doc.id)"
                  >
                    <Archive :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Paginação -->
        <div
          v-if="totalPaginas > 1"
          class="flex items-center justify-between px-4 py-3"
          style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)"
        >
          <p class="text-xs" style="color:var(--color-text-muted)">
            {{ (pagina - 1) * POR_PAGINA + 1 }}–{{ Math.min(pagina * POR_PAGINA, total) }} de {{ total }}
          </p>
          <div class="flex items-center gap-1">
            <button
              :disabled="pagina === 1"
              class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style="background:white;border:1px solid var(--color-border)"
              @click="pagina--"
            >
              <ChevronLeft :size="15" />
            </button>
            <button
              v-for="p in paginasVisiveis"
              :key="p"
              class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors"
              :style="p === pagina
                ? 'background:#2563eb;color:white;border:1px solid #2563eb'
                : p === '...'
                  ? 'background:transparent;color:var(--color-text-dim);cursor:default;border:none'
                  : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
              :disabled="p === '...'"
              @click="typeof p === 'number' && (pagina = p)"
            >
              {{ p }}
            </button>
            <button
              :disabled="pagina === totalPaginas"
              class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style="background:white;border:1px solid var(--color-border)"
              @click="pagina++"
            >
              <ChevronRight :size="15" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Modal Visualizar PDF -->
  <UiModal v-if="verModal" :model-value="true" title="Visualizar Documento" size="xl" @update:model-value="verModal = null">
    <iframe
      :src="verModal.pdf_url ?? ''"
      class="w-full h-[70vh] rounded-lg border border-[var(--color-border)]"
    />
    <template #footer>
      <a :href="verModal.pdf_url ?? '#'" target="_blank" class="inline-flex">
        <UiButton variant="secondary" size="sm">
          <FileDown :size="15" /> Baixar PDF
        </UiButton>
      </a>
      <UiButton variant="ghost" @click="verModal = null">Fechar</UiButton>
    </template>
  </UiModal>

  <!-- Modal Enviar -->
  <UiModal v-if="enviarModal" :model-value="true" title="Enviar ao Paciente" size="lg" @update:model-value="enviarModal = null">
    <div class="space-y-4">
      <div v-if="enviarModal.pdf_url">
        <p class="text-sm font-semibold text-[var(--color-text-muted)] mb-2">Preview do documento</p>
        <iframe :src="enviarModal.pdf_url" class="w-full h-64 rounded border border-[var(--color-border)]" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <UiInput v-model="enviandoTelefone" label="Telefone / WhatsApp" placeholder="(XX) XXXXX-XXXX" mask="telefone" />
        <UiInput v-model="enviandoEmail" label="E-mail" type="email" placeholder="paciente@email.com" />
      </div>
      <div>
        <p class="text-sm font-semibold text-[var(--color-text-muted)] mb-2">Canal de envio</p>
        <div class="flex gap-4">
          <label v-for="canal in ['whatsapp', 'email', 'ambos']" :key="canal" class="flex items-center gap-2 cursor-pointer text-sm">
            <input type="radio" :value="canal" v-model="enviandoCanal" class="accent-[var(--color-blue)]" />
            {{ canal === 'ambos' ? 'WhatsApp + E-mail' : canal.charAt(0).toUpperCase() + canal.slice(1) }}
          </label>
        </div>
      </div>
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="enviarModal = null">Cancelar</UiButton>
      <UiButton variant="success" :loading="enviandoLoading" @click="confirmarEnvio">
        <Send :size="15" /> Confirmar Envio
      </UiButton>
    </template>
  </UiModal>
</template>
