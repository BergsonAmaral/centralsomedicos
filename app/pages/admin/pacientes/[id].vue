<script setup lang="ts">
import { ArrowLeft, Plus, Search } from 'lucide-vue-next'
import type { Paciente, Agendamento, Documento, AgendamentoStatus } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const route = useRoute()
const id = route.params.id as string

const paciente = ref<Paciente | null>(null)
const agendamentos = ref<Agendamento[]>([])
const documentos = ref<Documento[]>([])
const carregando = ref(true)
const salvando = ref(false)
const novoAgendamentoModal = ref(false)

// Filtros do histórico
const filtroStatus = ref<AgendamentoStatus | ''>('')
const filtroPeriodo = ref<'todos' | 'futuros' | 'passados' | 'mes'>('todos')
const buscaMotivo = ref('')

onMounted(async () => {
  const [pacRes, agRes, docRes] = await Promise.all([
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
  ])
  paciente.value = pacRes.data
  agendamentos.value = (agRes.data ?? []) as Agendamento[]
  documentos.value = docRes.data ?? []
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
  await supabase.from('pacientes').update({
    nome: paciente.value.nome,
    telefone: paciente.value.telefone,
    email: paciente.value.email,
    sus_cartao: paciente.value.sus_cartao,
  }).eq('id', id)
  salvando.value = false
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

const TIPOS_LABELS: Record<string, string> = {
  atestado: 'Atestado', pedido_exame: 'Pedido Exame', receita: 'Receita',
  receita_controlada: 'Rec. Controlada', encaminhamento: 'Encaminhamento', declaracao: 'Declaração',
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <button @click="navigateTo('/admin/pacientes')" class="p-2 rounded-lg hover:bg-[var(--color-surface-2)]">
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
                {{ (ag.medicos as {nome:string}|undefined)?.nome }}
                <span v-if="(ag.medicos as {especialidade?:string}|undefined)?.especialidade">
                  · {{ (ag.medicos as {especialidade:string}).especialidade }}
                </span>
              </p>
              <p v-if="ag.motivo" class="text-xs text-[var(--color-text-dim)] mt-0.5">{{ ag.motivo }}</p>
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
                {{ new Date(doc.created_at).toLocaleDateString('pt-BR') }} — {{ (doc.medicos as {nome:string}|undefined)?.nome }}
              </p>
            </div>
            <a v-if="doc.pdf_url" :href="doc.pdf_url" target="_blank">
              <UiButton variant="ghost" size="sm">Ver PDF</UiButton>
            </a>
          </div>
        </div>
      </UiCard>
    </template>
  </div>

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
</template>
