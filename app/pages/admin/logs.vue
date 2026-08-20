<script setup lang="ts">
import { Activity, Search, Filter, RefreshCw, User, LogIn, LogOut, UserPlus, UserCheck, FileText, PhoneCall, Upload, Pause, Play, Edit, Trash2, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { AdminLog, AdminLogAcao } from '~/composables/useAdminLog'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const logs = ref<AdminLog[]>([])
const carregando = ref(true)

// Filtros
const buscaEmail = ref('')
const filtroAcao = ref<AdminLogAcao | ''>('')
const filtroPeriodo = ref<'hoje' | '7d' | '30d' | 'tudo' | 'custom'>('7d')
const filtroDataIni = ref('')
const filtroDataFim = ref('')

// Paginação
const POR_PAGINA = 30
const pagina = ref(1)
const total = ref(0)
const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

function hoje() { return new Date().toISOString().slice(0, 10) }

function aplicarPeriodo(p: typeof filtroPeriodo.value) {
  filtroPeriodo.value = p
  filtroDataFim.value = ''
  filtroDataIni.value = ''
}

function gerarPaginas(atual: number, t: number): (number | '...')[] {
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(t - 1, atual + 1); i++) pages.push(i)
  if (atual < t - 2) pages.push('...')
  pages.push(t)
  return pages
}

async function carregar() {
  carregando.value = true
  const from = (pagina.value - 1) * POR_PAGINA
  const to = from + POR_PAGINA - 1

  let q = supabase
    .from('admin_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  // Período
  if (filtroPeriodo.value !== 'tudo' && filtroPeriodo.value !== 'custom') {
    const d = new Date()
    if (filtroPeriodo.value === 'hoje') {
      q = q.gte('created_at', hoje() + 'T00:00:00')
    } else if (filtroPeriodo.value === '7d') {
      d.setDate(d.getDate() - 7); q = q.gte('created_at', d.toISOString())
    } else if (filtroPeriodo.value === '30d') {
      d.setDate(d.getDate() - 30); q = q.gte('created_at', d.toISOString())
    }
  } else if (filtroPeriodo.value === 'custom') {
    if (filtroDataIni.value) q = q.gte('created_at', filtroDataIni.value + 'T00:00:00')
    if (filtroDataFim.value) q = q.lte('created_at', filtroDataFim.value + 'T23:59:59')
  }

  if (filtroAcao.value) q = q.eq('acao', filtroAcao.value)
  if (buscaEmail.value.trim()) q = q.ilike('admin_email', `%${buscaEmail.value.trim()}%`)

  const { data, count } = await q
  logs.value = (data ?? []) as AdminLog[]
  total.value = count ?? 0
  carregando.value = false
}

watch([filtroAcao, filtroPeriodo, filtroDataIni, filtroDataFim], () => { pagina.value = 1; carregar() })
watch(pagina, carregar)

let debounce: ReturnType<typeof setTimeout>
watch(buscaEmail, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => { pagina.value = 1; carregar() }, 350)
})

const temFiltroAtivo = computed(() =>
  !!filtroAcao.value || filtroPeriodo.value !== '7d' || !!buscaEmail.value
)

function limparFiltros() {
  buscaEmail.value = ''
  filtroAcao.value = ''
  filtroDataIni.value = ''
  filtroDataFim.value = ''
  filtroPeriodo.value = '7d'
  pagina.value = 1
}

const acoesDisponiveis: { value: AdminLogAcao; label: string }[] = [
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'paciente_criado', label: 'Paciente criado' },
  { value: 'paciente_editado', label: 'Paciente editado' },
  { value: 'paciente_excluido', label: 'Paciente excluído' },
  { value: 'medico_criado', label: 'Médico criado' },
  { value: 'medico_editado', label: 'Médico editado' },
  { value: 'medico_pausado', label: 'Médico pausado' },
  { value: 'medico_ativado', label: 'Médico ativado' },
  { value: 'atendente_criado', label: 'Atendente criado' },
  { value: 'atendente_editado', label: 'Atendente editado' },
  { value: 'atendente_excluido', label: 'Atendente excluído' },
  { value: 'admin_criado', label: 'Admin criado' },
  { value: 'admin_excluido', label: 'Admin excluído' },
  { value: 'paciente_chamado', label: 'Paciente chamado' },
  { value: 'agendamento_criado', label: 'Agendamento criado' },
  { value: 'agendamento_cancelado', label: 'Agendamento cancelado' },
  { value: 'importacao_sus', label: 'Importação SUS' },
  { value: 'consulta_encerrada', label: 'Consulta encerrada' },
  { value: 'documento_emitido', label: 'Documento emitido' },
]

function infoAcao(acao: AdminLogAcao): { icone: any; cor: string; bg: string; label: string } {
  const map: Record<string, { icone: any; cor: string; bg: string; label: string }> = {
    login:                    { icone: LogIn,     cor: '#16a34a', bg: '#dcfce7', label: 'Login' },
    logout:                   { icone: LogOut,    cor: '#64748b', bg: '#f1f5f9', label: 'Logout' },
    paciente_criado:          { icone: UserPlus,  cor: '#2563eb', bg: '#dbeafe', label: 'Paciente criado' },
    paciente_editado:         { icone: Edit,      cor: '#7c3aed', bg: '#ede9fe', label: 'Paciente editado' },
    paciente_excluido:        { icone: Trash2,    cor: '#dc2626', bg: '#fee2e2', label: 'Paciente excluído' },
    medico_criado:            { icone: UserPlus,  cor: '#0891b2', bg: '#cffafe', label: 'Médico criado' },
    medico_editado:           { icone: Edit,      cor: '#0891b2', bg: '#cffafe', label: 'Médico editado' },
    medico_pausado:           { icone: Pause,     cor: '#a16207', bg: '#fef3c7', label: 'Médico pausado' },
    medico_ativado:           { icone: Play,      cor: '#16a34a', bg: '#dcfce7', label: 'Médico ativado' },
    atendente_criado:         { icone: UserPlus,  cor: '#0891b2', bg: '#cffafe', label: 'Atendente criado' },
    atendente_editado:        { icone: Edit,      cor: '#0891b2', bg: '#cffafe', label: 'Atendente editado' },
    atendente_excluido:       { icone: Trash2,    cor: '#dc2626', bg: '#fee2e2', label: 'Atendente excluído' },
    admin_criado:             { icone: UserPlus,  cor: '#7c3aed', bg: '#ede9fe', label: 'Admin criado' },
    admin_excluido:           { icone: Trash2,    cor: '#dc2626', bg: '#fee2e2', label: 'Admin excluído' },
    paciente_chamado:         { icone: PhoneCall, cor: '#16a34a', bg: '#dcfce7', label: 'Chamou paciente' },
    paciente_recolocado_fila: { icone: UserCheck, cor: '#a16207', bg: '#fef3c7', label: 'Recolocado fila' },
    agendamento_criado:       { icone: UserCheck, cor: '#2563eb', bg: '#dbeafe', label: 'Agendamento criado' },
    agendamento_cancelado:    { icone: Trash2,    cor: '#dc2626', bg: '#fee2e2', label: 'Agend. cancelado' },
    importacao_sus:           { icone: Upload,    cor: '#7c3aed', bg: '#ede9fe', label: 'Importação SUS' },
    consulta_encerrada:       { icone: UserCheck, cor: '#475569', bg: '#f1f5f9', label: 'Consulta encerrada' },
    documento_emitido:        { icone: FileText,  cor: '#16a34a', bg: '#dcfce7', label: 'Documento emitido' },
  }
  return map[acao] ?? { icone: Activity, cor: '#475569', bg: '#f1f5f9', label: acao }
}

function formatarData(iso: string): string {
  const d = new Date(iso)
  const ehHoje = d.toDateString() === new Date().toDateString()
  if (ehHoje) return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function descricao(log: AdminLog): string {
  const d = log.detalhes ?? {}
  switch (log.acao) {
    case 'login':              return 'Entrou no sistema'
    case 'logout':             return 'Saiu do sistema'
    case 'paciente_criado':    return `Cadastrou paciente: ${d.nome ?? '—'}`
    case 'paciente_editado':   return `Editou paciente: ${d.nome ?? '—'}`
    case 'medico_criado':      return `Cadastrou médico: ${d.nome ?? '—'}`
    case 'medico_editado':     return `Editou médico: ${d.nome ?? '—'}`
    case 'medico_pausado':     return `Pausou ${d.nome ?? 'médico'}`
    case 'medico_ativado':     return `Reativou ${d.nome ?? 'médico'}`
    case 'atendente_criado':   return `Cadastrou atendente: ${d.nome ?? '—'}`
    case 'atendente_editado':  return `Editou atendente: ${d.nome ?? '—'}`
    case 'atendente_excluido': return `Excluiu atendente: ${d.nome ?? '—'}`
    case 'admin_criado':       return `Cadastrou admin: ${d.nome ?? '—'}`
    case 'admin_excluido':     return `Excluiu admin: ${d.nome ?? '—'}`
    case 'paciente_chamado':   return `Chamou ${d.paciente ?? '—'} para ${d.medico ?? '—'}`
    case 'agendamento_criado': return `Agendou ${d.paciente ?? '—'} com ${d.medico ?? '—'}`
    case 'importacao_sus':     return `Importou ${d.total ?? 0} pacientes (${d.criados ?? 0} novos)`
    case 'consulta_encerrada': return `Consulta encerrada — ${d.paciente ?? '—'}`
    case 'documento_emitido':  return `Emitiu ${d.tipo ?? 'documento'} para ${d.paciente ?? '—'}`
    default:                   return JSON.stringify(d)
  }
}

onMounted(carregar)
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Logs do sistema</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          {{ carregando ? '…' : `${total} registro${total !== 1 ? 's' : ''}` }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
        style="background:white;color:#475569;border:1px solid #e2e8f0"
        @click="carregar"
      >
        <RefreshCw :size="14" :class="carregando ? 'animate-spin' : ''" />
        Atualizar
      </button>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border p-4 space-y-3" style="border-color:var(--color-border)">
      <!-- Linha 1: busca email + ação -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="relative">
          <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2" style="color:var(--color-text-dim)" />
          <input
            v-model="buscaEmail"
            placeholder="Filtrar por e-mail do admin..."
            class="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-blue-400"
            style="border-color:var(--color-border);background:var(--color-surface-2)"
          />
        </div>
        <div class="relative">
          <select
            v-model="filtroAcao"
            class="w-full pl-4 pr-8 py-2.5 rounded-xl border text-sm outline-none appearance-none cursor-pointer"
            style="border-color:var(--color-border);background:var(--color-surface-2);color:var(--color-text)"
          >
            <option value="">Todas as ações</option>
            <option v-for="a in acoesDisponiveis" :key="a.value" :value="a.value">{{ a.label }}</option>
          </select>
          <ChevronRight :size="13" class="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" style="color:var(--color-text-dim)" />
        </div>
      </div>

      <!-- Linha 2: período -->
      <div class="flex flex-wrap items-center gap-2">
        <CalendarDays :size="14" style="color:var(--color-text-dim)" />
        <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Período:</span>
        <button
          v-for="p in [{ v: 'hoje', l: 'Hoje' }, { v: '7d', l: '7 dias' }, { v: '30d', l: '30 dias' }, { v: 'tudo', l: 'Tudo' }, { v: 'custom', l: 'Personalizado' }]"
          :key="p.v"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="filtroPeriodo === p.v
            ? 'background:#0a1f14;color:white;border-color:#0a1f14'
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="aplicarPeriodo(p.v as any)"
        >{{ p.l }}</button>

        <!-- Datas customizadas -->
        <template v-if="filtroPeriodo === 'custom'">
          <div class="flex items-center gap-1.5 ml-1">
            <input
              v-model="filtroDataIni"
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
        </template>

        <button
          v-if="temFiltroAtivo"
          class="px-3 py-1 rounded-full text-xs font-semibold ml-auto"
          style="color:#ef4444;background:#fef2f2;border:1px solid #fecaca"
          @click="limparFiltros"
        >✕ Limpar</button>
      </div>

      <!-- Chips de ação (rápido) -->
      <div class="flex flex-wrap gap-1.5 items-center">
        <span class="inline-flex items-center gap-1 text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">
          <Filter :size="12" /> Ação rápida:
        </span>
        <button
          v-for="a in acoesDisponiveis.slice(0, 8)"
          :key="a.value"
          class="px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all"
          :style="filtroAcao === a.value
            ? `background:${infoAcao(a.value).cor};color:white;border-color:${infoAcao(a.value).cor}`
            : `background:${infoAcao(a.value).bg};color:${infoAcao(a.value).cor};border-color:${infoAcao(a.value).cor}30`"
          @click="filtroAcao = filtroAcao === a.value ? '' : a.value; pagina = 1"
        >{{ a.label }}</button>
      </div>
    </div>

    <!-- Lista -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
      <div v-if="carregando" class="p-10 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
      <div v-else-if="logs.length === 0" class="p-10 text-center">
        <Activity :size="32" class="mx-auto mb-2" style="color:var(--color-text-dim)" />
        <p class="text-sm" style="color:var(--color-text-muted)">Nenhum registro encontrado.</p>
        <button v-if="temFiltroAtivo" class="mt-2 text-sm text-blue-500 hover:underline" @click="limparFiltros">Limpar filtros</button>
      </div>
      <template v-else>
        <ul class="divide-y" style="border-color:var(--color-border-light)">
          <li
            v-for="log in logs"
            :key="log.id"
            class="px-5 py-3 flex items-start gap-3 hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              :style="`background:${infoAcao(log.acao).bg}`"
            >
              <component :is="infoAcao(log.acao).icone" :size="16" :style="`color:${infoAcao(log.acao).cor}`" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2 flex-wrap">
                <span class="text-xs font-bold uppercase tracking-wide" :style="`color:${infoAcao(log.acao).cor}`">
                  {{ infoAcao(log.acao).label }}
                </span>
                <span class="text-xs" style="color:var(--color-text-dim)">·</span>
                <span class="text-xs" style="color:var(--color-text-muted)">{{ formatarData(log.created_at) }}</span>
              </div>
              <p class="text-sm text-[var(--color-text)] mt-0.5">{{ descricao(log) }}</p>
              <div class="flex items-center gap-1 mt-1 text-xs" style="color:var(--color-text-dim)">
                <User :size="11" />
                {{ log.admin_email ?? 'sistema' }}
              </div>
            </div>
          </li>
        </ul>

        <!-- Paginação -->
        <div
          v-if="totalPaginas > 1"
          class="flex items-center justify-between px-5 py-3"
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
            ><ChevronLeft :size="15" /></button>
            <button
              v-for="p in gerarPaginas(pagina, totalPaginas)"
              :key="p"
              class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors"
              :style="p === pagina
                ? 'background:#0a1f14;color:white;border:1px solid #0a1f14'
                : p === '...'
                  ? 'background:transparent;color:var(--color-text-dim);cursor:default;border:none'
                  : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
              :disabled="p === '...'"
              @click="typeof p === 'number' && (pagina = p)"
            >{{ p }}</button>
            <button
              :disabled="pagina === totalPaginas"
              class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style="background:white;border:1px solid var(--color-border)"
              @click="pagina++"
            ><ChevronRight :size="15" /></button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
