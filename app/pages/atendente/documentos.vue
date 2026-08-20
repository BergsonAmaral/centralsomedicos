<script setup lang="ts">
import { FileText, Eye, FileDown, Search, CalendarDays } from 'lucide-vue-next'
import type { Documento } from '~/types'

definePageMeta({ layout: 'atendente', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const { resolverUrlAssinada } = useDocumentos()

const documentos = ref<Documento[]>([])
const carregando = ref(true)
const verModal = ref<Documento | null>(null)
const verModalUrl = ref<string | null>(null)

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

async function carregar() {
  carregando.value = true
  // RLS já restringe aos documentos de pacientes da unidade do atendente
  const { data } = await supabase
    .from('documentos')
    .select('*, pacientes(nome), medicos(nome)')
    .order('created_at', { ascending: false })
  documentos.value = (data ?? []) as Documento[]
  carregando.value = false
}
onMounted(carregar)

async function abrirVer(doc: Documento) {
  verModal.value = doc
  verModalUrl.value = doc.pdf_url ? await resolverUrlAssinada(doc.pdf_url) : null
}

// Filtros
function dataLocal(offsetDias = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const filtroTipo = ref('')
const filtroPeriodo = ref<'todos' | 'hoje' | '7dias' | '30dias'>('todos')
const buscaPaciente = ref('')

const documentosFiltrados = computed(() => {
  const hoje = dataLocal(0)
  const limite7 = dataLocal(-6)
  const limite30 = dataLocal(-29)
  const q = buscaPaciente.value.trim().toLowerCase()
  return documentos.value.filter((d) => {
    if (filtroTipo.value && d.tipo !== filtroTipo.value) return false
    const dia = d.created_at.slice(0, 10)
    if (filtroPeriodo.value === 'hoje' && dia !== hoje) return false
    if (filtroPeriodo.value === '7dias' && dia < limite7) return false
    if (filtroPeriodo.value === '30dias' && dia < limite30) return false
    if (q && !((d.pacientes as any)?.nome ?? '').toLowerCase().includes(q)) return false
    return true
  })
})

// Agrupado por dia — facilita achar o documento de um atendimento específico
const documentosPorDia = computed(() => {
  const grupos: Record<string, Documento[]> = {}
  for (const d of documentosFiltrados.value) {
    const dia = d.created_at.slice(0, 10)
    ;(grupos[dia] ??= []).push(d)
  }
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
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Documentos</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">
        {{ carregando ? '…' : `${documentosFiltrados.length} documento${documentosFiltrados.length !== 1 ? 's' : ''}` }} da sua unidade — só visualização.
      </p>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border p-4 space-y-3" style="border-color:var(--color-border)">
      <div class="flex flex-wrap items-center gap-2">
        <CalendarDays :size="14" style="color:var(--color-text-dim)" />
        <span class="text-xs font-semibold shrink-0" style="color:var(--color-text-muted)">Período:</span>
        <button
          v-for="p in [{ v: 'todos', l: 'Todos' }, { v: 'hoje', l: 'Hoje' }, { v: '7dias', l: '7 dias' }, { v: '30dias', l: '30 dias' }]"
          :key="p.v"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          :style="filtroPeriodo === p.v ? 'background:#2563eb;color:white;border-color:#2563eb' : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="filtroPeriodo = p.v as any"
        >{{ p.l }}</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Tipo</label>
          <select v-model="filtroTipo" class="input-base py-2 text-sm">
            <option value="">Todos</option>
            <option v-for="(label, key) in TIPOS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Buscar paciente</label>
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input v-model="buscaPaciente" type="text" placeholder="nome do paciente..." class="input-base py-2 text-sm pl-9" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="carregando" class="py-8 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <div v-else-if="documentosFiltrados.length === 0" class="bg-white rounded-2xl border py-16 text-center" style="border-color:var(--color-border)">
      <FileText :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
      <p class="font-medium" style="color:var(--color-text-muted)">Nenhum documento encontrado</p>
    </div>

    <div v-else class="space-y-5">
      <div v-for="[dia, itens] in documentosPorDia" :key="dia" class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
        <div class="px-4 py-2.5 text-xs font-bold uppercase tracking-wide" style="background:var(--color-surface-2);color:var(--color-text-dim)">
          {{ fmtDiaGrupo(dia) }} <span class="font-normal normal-case">({{ itens.length }})</span>
        </div>
        <table class="w-full text-sm">
          <tbody>
            <tr
              v-for="doc in itens" :key="doc.id"
              class="border-b transition-colors hover:bg-blue-50 cursor-pointer last:border-b-0"
              style="border-color:var(--color-border-light)"
              @click="abrirVer(doc)"
            >
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" :style="`background:${TIPOS_CORES[doc.tipo]}18;color:${TIPOS_CORES[doc.tipo]}`">
                  <FileText :size="11" /> {{ TIPOS_LABELS[doc.tipo] ?? doc.tipo }}
                </span>
              </td>
              <td class="px-4 py-3 font-medium" style="color:var(--color-text)">{{ (doc.pacientes as any)?.nome ?? '—' }}</td>
              <td class="px-4 py-3 hidden md:table-cell text-sm" style="color:var(--color-text-muted)">{{ (doc.medicos as any)?.nome ?? '—' }}</td>
              <td class="px-4 py-3 hidden sm:table-cell text-xs" style="color:var(--color-text-muted)">
                {{ new Date(doc.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
              </td>
              <td class="px-4 py-3" @click.stop>
                <button v-if="doc.pdf_url" class="p-1.5 rounded-lg" style="background:#eff6ff;color:#2563eb" title="Visualizar PDF" @click="abrirVer(doc)">
                  <Eye :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <UiModal v-if="verModal" :model-value="true" title="Visualizar Documento" size="xl" @update:model-value="verModal = null; verModalUrl = null">
      <div v-if="!verModalUrl" class="py-16 text-center text-sm text-[var(--color-text-muted)]">Carregando documento…</div>
      <iframe v-else :src="verModalUrl" class="w-full h-[70vh] rounded-lg border border-[var(--color-border)]" />
      <template #footer>
        <a v-if="verModalUrl" :href="verModalUrl" target="_blank" class="inline-flex">
          <UiButton variant="secondary" size="sm">
            <FileDown :size="15" /> Baixar PDF
          </UiButton>
        </a>
        <UiButton variant="ghost" @click="verModal = null; verModalUrl = null">Fechar</UiButton>
      </template>
    </UiModal>
  </div>
</template>
