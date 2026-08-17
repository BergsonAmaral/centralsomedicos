<script setup lang="ts">
import { ArrowLeft, Plus, Search, Pencil, X as XIcon, Trash2, AlertTriangle } from 'lucide-vue-next'
import type { Paciente, Agendamento, Documento, AgendamentoStatus, Consulta } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const toast = useToast()
const { resolverUrlAssinada } = useDocumentos()
const route = useRoute()

// pdf_url é um path do storage privado (ou link externo) — resolve uma
// signed URL de curta duração só na hora de abrir.
async function abrirDocumento(pathOuLink: string) {
  const url = await resolverUrlAssinada(pathOuLink)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
const id = route.params.id as string
const voltar = () => navigateTo('/admin/pacientes')

const paciente = ref<Paciente | null>(null)
const agendamentos = ref<Agendamento[]>([])
const documentos = ref<Documento[]>([])
const consultas = ref<Consulta[]>([])
const consultaPorAgendamento = computed(() => {
  const mapa: Record<string, Consulta> = {}
  for (const c of consultas.value) if ((c as any).agendamento_id) mapa[(c as any).agendamento_id] = c
  return mapa
})
const carregando = ref(true)
const salvando = ref(false)
const novoAgendamentoModal = ref(false)
const unidades = ref<{ id: string; nome: string }[]>([])

// Filtros do histórico
const filtroStatus = ref<AgendamentoStatus | ''>('')
const filtroPeriodo = ref<'todos' | 'futuros' | 'passados' | 'mes'>('todos')
const buscaMotivo = ref('')

onMounted(async () => {
  const [pacRes, agRes, docRes, uRes, consRes] = await Promise.all([
    supabase.from('pacientes').select('*').eq('id', id).single(),
    supabase
      .from('agendamentos')
      .select('*, medicos(nome, especialidade)')
      .eq('paciente_id', id)
      .order('data_consulta', { ascending: false }),
    supabase
      .from('documentos')
      .select('*, medicos(nome)')
      .eq('paciente_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome'),
    // Prontuário — evolução clínica de todos os médicos que já atenderam,
    // independente de quem estiver de plantão hoje.
    supabase.from('consultas').select('*').eq('paciente_id', id).order('created_at', { ascending: false }),
  ])
  paciente.value = pacRes.data
  agendamentos.value = (agRes.data ?? []) as Agendamento[]
  documentos.value = docRes.data ?? []
  unidades.value = uRes.data ?? []
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

const agendamentosFiltrados = computed(() => {
  const hoje = dataLocal(0)
  const inicioMes = dataLocal(-30)
  const q = buscaMotivo.value.trim().toLowerCase()
  return agendamentos.value.filter((a) => {
    if (filtroStatus.value && a.status !== filtroStatus.value) return false
    if (filtroPeriodo.value === 'futuros' && a.data_consulta < hoje) return false
    if (filtroPeriodo.value === 'passados' && a.data_consulta >= hoje) return false
    if (filtroPeriodo.value === 'mes' && a.data_consulta < inicioMes) return false
    if (q && !(a.motivo ?? '').toLowerCase().includes(q)) return false
    return true
  })
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

async function salvarDados() {
  if (!paciente.value) return
  salvando.value = true
  const { error } = await supabase.from('pacientes').update({
    nome: paciente.value.nome,
    telefone: paciente.value.telefone,
    email: paciente.value.email,
    sus_cartao: paciente.value.sus_cartao,
    unidade_id: (paciente.value as any).unidade_id || null,
  }).eq('id', id)
  salvando.value = false
  if (error) { toast.erro('Erro ao salvar: ' + error.message); return }
  toast.sucesso('Dados do paciente salvos!')
}

// Novo agendamento manual
const medicos = ref<{ id: string; nome: string }[]>([])
const novoAg = ref({ medico_id: '', data_consulta: '', motivo: '' })
const criandoAg = ref(false)

async function abrirNovoAgendamento() {
  if (!medicos.value.length) {
    const { data } = await supabase.from('medicos').select('id, nome').eq('ativo', true)
    medicos.value = data ?? []
  }
  novoAg.value.data_consulta = dataLocal(0)
  novoAgendamentoModal.value = true
}

async function criarAgendamento() {
  if (!novoAg.value.medico_id || !novoAg.value.data_consulta) return
  criandoAg.value = true
  await supabase.from('agendamentos').insert({
    paciente_id: id,
    medico_id: novoAg.value.medico_id,
    data_consulta: novoAg.value.data_consulta,
    motivo: novoAg.value.motivo || null,
    origem: 'manual',
    status: 'agendado',
  })
  const { data } = await supabase
    .from('agendamentos')
    .select('*, medicos(nome, especialidade)')
    .eq('paciente_id', id)
    .order('data_consulta', { ascending: false })
  agendamentos.value = (data ?? []) as Agendamento[]
  novoAgendamentoModal.value = false
  criandoAg.value = false
}

// Editar agendamento
const editAgModal = ref<Agendamento | null>(null)
const editAg = ref({ medico_id: '', data_consulta: '', motivo: '', status: '' as AgendamentoStatus | '' })
const salvandoAg = ref(false)

function abrirEditAg(ag: Agendamento) {
  editAgModal.value = ag
  editAg.value = {
    medico_id: ag.medico_id ?? '',
    data_consulta: ag.data_consulta,
    motivo: ag.motivo ?? '',
    status: ag.status,
  }
  if (!medicos.value.length) {
    supabase.from('medicos').select('id, nome').eq('ativo', true).then(({ data }) => { medicos.value = data ?? [] })
  }
}

async function salvarEditAg() {
  if (!editAgModal.value) return
  salvandoAg.value = true
  await supabase.from('agendamentos').update({
    medico_id: editAg.value.medico_id || null,
    data_consulta: editAg.value.data_consulta,
    motivo: editAg.value.motivo || null,
    status: editAg.value.status as AgendamentoStatus,
  }).eq('id', editAgModal.value.id)
  const { data } = await supabase
    .from('agendamentos').select('*, medicos(nome, especialidade)')
    .eq('paciente_id', id).order('data_consulta', { ascending: false })
  agendamentos.value = (data ?? []) as Agendamento[]
  editAgModal.value = null
  salvandoAg.value = false
}

async function cancelarAgendamento(ag: Agendamento) {
  if (!confirm(`Cancelar consulta de ${new Date(ag.data_consulta + 'T12:00:00').toLocaleDateString('pt-BR')}?`)) return
  const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', ag.id)
  if (error) { alert(`Erro ao cancelar: ${error.message}`); return }
  const { data } = await supabase
    .from('agendamentos').select('*, medicos(nome, especialidade)')
    .eq('paciente_id', id).order('data_consulta', { ascending: false })
  agendamentos.value = (data ?? []) as Agendamento[]
}

// Zona de perigo
const confirmandoDelete = ref(false)
const deletandoPaciente = ref(false)

async function excluirPaciente() {
  if (!confirm('ATENÇÃO: Todos os agendamentos e documentos do paciente serão excluídos permanentemente. Confirma?')) return
  deletandoPaciente.value = true
  // Deleta em cascata (documentos → consultas → agendamentos → paciente).
  // "consultas" precisa vir antes de "agendamentos": desde que o prontuário
  // passou a ser criado já no início do atendimento (não só ao encerrar),
  // praticamente todo paciente com histórico tem uma linha em consultas
  // apontando pra ele — sem apagar isso primeiro, a FK bloqueia a exclusão.
  await supabase.from('documentos').delete().eq('paciente_id', id)
  await supabase.from('consultas').delete().eq('paciente_id', id)
  await supabase.from('agendamentos').delete().eq('paciente_id', id)
  const { error } = await supabase.from('pacientes').delete().eq('id', id)
  deletandoPaciente.value = false
  if (error) { toast.erro('Erro ao excluir paciente: ' + error.message); return }
  navigateTo('/admin/pacientes')
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
      <!-- Dados cadastrais -->
      <UiCard>
        <template #header>
          <h3 class="font-semibold">Dados Cadastrais</h3>
          <UiButton variant="primary" size="sm" :loading="salvando" @click="salvarDados">Salvar</UiButton>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UiInput v-model="paciente.nome" label="Nome completo" />
          <div>
            <label class="text-sm font-medium text-[var(--color-text-muted)]">CPF</label>
            <p class="input-base mt-1 bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed font-mono">
              {{ formatarCPF(paciente.cpf) }}
            </p>
          </div>
          <UiInput v-model="(paciente.telefone as string)" label="Telefone" mask="telefone" />
          <UiInput v-model="(paciente.email as string)" label="E-mail" type="email" />
          <UiInput v-model="(paciente.sus_cartao as string)" label="Cartão SUS" />
          <div>
            <label class="text-sm font-medium text-[var(--color-text-muted)]">Data de Nascimento</label>
            <p class="input-base mt-1 bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed">
              {{ paciente.data_nascimento ? new Date(paciente.data_nascimento).toLocaleDateString('pt-BR') : '—' }}
            </p>
          </div>
          <div>
            <label class="text-sm font-medium text-[var(--color-text-muted)]">Unidade</label>
            <select v-model="(paciente as any).unidade_id" class="input-base mt-1">
              <option :value="null">—</option>
              <option v-for="u in unidades" :key="u.id" :value="u.id">{{ u.nome }}</option>
            </select>
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

      <!-- Histórico de agendamentos -->
      <UiCard>
        <template #header>
          <h3 class="font-semibold">Histórico de Consultas</h3>
          <UiButton variant="secondary" size="sm" @click="abrirNovoAgendamento">
            <Plus :size="14" /> Novo Agendamento
          </UiButton>
        </template>

        <!-- Filtros -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Período</label>
            <select v-model="filtroPeriodo" class="input-base py-2 text-sm">
              <option value="todos">Todos</option>
              <option value="futuros">Futuros</option>
              <option value="passados">Passados</option>
              <option value="mes">Últimos 30 dias</option>
            </select>
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
        <div v-else class="space-y-2">
          <div
            v-for="ag in agendamentosFiltrados"
            :key="ag.id"
            class="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-surface-2)]"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold text-[var(--color-text)]">
                  {{ new Date(ag.data_consulta + 'T12:00:00').toLocaleDateString('pt-BR') }}
                </p>
                <UiBadge :variant="ag.status as any" />
              </div>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                {{ (ag.medicos as any)?.nome }}
                <span v-if="(ag.medicos as any)?.especialidade">
                  · {{ (ag.medicos as any).especialidade }}
                </span>
              </p>
              <p v-if="ag.motivo" class="text-xs text-[var(--color-text-dim)] mt-0.5">{{ ag.motivo }}</p>
              <div v-if="consultaPorAgendamento[ag.id]?.evolucao" class="mt-1.5 p-2 rounded-lg text-xs" style="background:#f0f9ff;border:1px solid #bae6fd;color:#075985">
                <p class="font-semibold uppercase tracking-wide text-[10px] mb-0.5">Prontuário</p>
                {{ consultaPorAgendamento[ag.id]?.evolucao }}
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 ml-2">
              <button
                class="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                title="Editar agendamento"
                @click="abrirEditAg(ag)"
              >
                <Pencil :size="14" style="color:#2563eb" />
              </button>
              <button
                v-if="!['cancelado','concluido','faltou'].includes(ag.status)"
                class="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                title="Cancelar agendamento"
                @click="cancelarAgendamento(ag)"
              >
                <XIcon :size="14" style="color:#dc2626" />
              </button>
            </div>
          </div>
        </div>
      </UiCard>

      <!-- Documentos -->
      <UiCard>
        <template #header>
          <h3 class="font-semibold">Documentos Emitidos</h3>
        </template>
        <div v-if="documentos.length === 0" class="py-6 text-center text-[var(--color-text-dim)] text-sm">
          Nenhum documento emitido
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="doc in documentos"
            :key="doc.id"
            class="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border-light)]"
          >
            <div>
              <p class="text-sm font-medium text-[var(--color-text)]">{{ TIPOS_LABELS[doc.tipo] ?? doc.tipo }}</p>
              <p class="text-xs text-[var(--color-text-muted)]">
                {{ new Date(doc.created_at).toLocaleDateString('pt-BR') }} — {{ (doc.medicos as any)?.nome }}
              </p>
            </div>
            <UiButton v-if="doc.pdf_url" variant="ghost" size="sm" @click="abrirDocumento(doc.pdf_url)">Ver PDF</UiButton>
          </div>
        </div>
      </UiCard>
      <!-- Zona de Perigo -->
      <div class="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-4">
        <div class="flex items-center gap-2">
          <AlertTriangle :size="18" style="color:#dc2626" />
          <h3 class="font-bold text-red-700">Zona de Perigo</h3>
        </div>
        <p class="text-sm text-red-600">
          As ações abaixo são <strong>irreversíveis</strong>. Todo o histórico (agendamentos, documentos) será removido permanentemente.
        </p>
        <div v-if="!confirmandoDelete">
          <UiButton variant="ghost" size="sm" class="border border-red-300 text-red-600 hover:bg-red-100" @click="confirmandoDelete = true">
            <Trash2 :size="14" /> Excluir paciente e todos os dados
          </UiButton>
        </div>
        <div v-else class="flex items-center gap-3">
          <span class="text-sm font-semibold text-red-700">Tem certeza absoluta?</span>
          <UiButton variant="ghost" size="sm" @click="confirmandoDelete = false">Não, cancelar</UiButton>
          <button
            class="px-4 py-1.5 rounded-lg text-sm font-bold text-white transition-opacity"
            style="background:#dc2626"
            :disabled="deletandoPaciente"
            @click="excluirPaciente"
          >
            {{ deletandoPaciente ? 'Excluindo...' : 'Sim, excluir tudo' }}
          </button>
        </div>
      </div>
    </template>

    <!-- Modal novo agendamento -->
  <UiModal v-if="novoAgendamentoModal" :model-value="true" title="Novo Agendamento Manual" size="md" @update:model-value="novoAgendamentoModal = false">
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Médico *</label>
        <select v-model="novoAg.medico_id" class="input-base">
          <option value="">Selecione o médico</option>
          <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
        </select>
      </div>
      <UiInput v-model="novoAg.data_consulta" label="Data da consulta *" type="date" />
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Motivo</label>
        <textarea v-model="novoAg.motivo" class="input-base resize-none" rows="3" placeholder="Motivo da consulta..." />
      </div>
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="novoAgendamentoModal = false">Cancelar</UiButton>
      <UiButton variant="primary" :loading="criandoAg" @click="criarAgendamento">Criar Agendamento</UiButton>
    </template>
  </UiModal>

  <!-- Modal editar agendamento -->
  <UiModal v-if="editAgModal" :model-value="true" title="Editar Agendamento" size="md" @update:model-value="editAgModal = null">
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Médico</label>
        <select v-model="editAg.medico_id" class="input-base">
          <option value="">Sem médico definido</option>
          <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
        </select>
      </div>
      <UiInput v-model="editAg.data_consulta" label="Data da consulta" type="date" />
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Status</label>
        <select v-model="editAg.status" class="input-base">
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div>
        <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Motivo</label>
        <textarea v-model="editAg.motivo" class="input-base resize-none" rows="3" placeholder="Motivo da consulta..." />
      </div>
    </div>
    <template #footer>
      <UiButton variant="ghost" @click="editAgModal = null">Cancelar</UiButton>
      <UiButton variant="primary" :loading="salvandoAg" @click="salvarEditAg">Salvar</UiButton>
    </template>
  </UiModal>
</div>
</template>
