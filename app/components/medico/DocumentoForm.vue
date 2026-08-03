<script setup lang="ts">
import {
  FileText, FlaskConical, Pill, ShieldCheck, Send, ClipboardCheck,
  Plus, Trash2, CheckCircle2, ExternalLink, AlertCircle, Loader2, Stamp,
} from 'lucide-vue-next'
import type { Agendamento, DocumentoTipo } from '~/types'

const props = defineProps<{
  agendamento: Agendamento
  medicoId: string
  medicoNome: string
  medicoCRM: string
  medicoEspecialidade: string
  medicoAssinaturaUrl?: string | null
}>()

const { gerarESalvar, salvarDocumentoExterno } = useDocumentos()

type TabKey = DocumentoTipo
const tab = ref<TabKey>('atestado')
const gerando = ref(false)
const ultimoPdfUrl = ref<string | null>(null)
const ultimoErro = ref('')

// ── Prescrição via Memed (solução intermediária, sem integração API) ──────
const linkMemed = ref('')
const salvandoMemed = ref(false)
const erroMemed = ref('')

const ehAbaReceita = computed(() => tab.value === 'receita' || tab.value === 'receita_controlada')

function abrirMemed() {
  window.open('https://memed.com.br', '_blank', 'noopener,noreferrer')
}

async function salvarReceitaMemed() {
  if (!paciente.value?.id) return
  erroMemed.value = ''
  salvandoMemed.value = true
  try {
    const result = await salvarDocumentoExterno({
      tipo: tab.value,
      medicoId: props.medicoId,
      pacienteId: paciente.value.id,
      agendamentoId: props.agendamento.id,
      link: linkMemed.value,
    })
    if (result.ok) {
      ultimoPdfUrl.value = linkMemed.value.trim()
      linkMemed.value = ''
    } else {
      erroMemed.value = result.error ?? 'Erro ao salvar link'
    }
  } finally {
    salvandoMemed.value = false
  }
}

const paciente = computed(() => props.agendamento.pacientes as any)

const atestado = ref({ dias: 1, cid: '', descricao: '' })
const pedidoExame = ref({ exames: [''], indicacaoClinica: '' })
const receita = ref({ medicamentos: [{ nome: '', posologia: '', quantidade: '' }] })
const receitaControlada = ref({ medicamento: '', posologia: '', quantidade: '', observacoes: '' })
const encaminhamento = ref({ especialidade: '', hipoteseDiagnostica: '', resumoClinico: '' })
const declaracao = ref({ finalidade: '', horaInicio: '', horaFim: '' })

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: 'atestado',           label: 'Atestado',     icon: FileText,       color: '#2563eb' },
  { key: 'pedido_exame',       label: 'Exames',       icon: FlaskConical,   color: '#0891b2' },
  { key: 'receita',            label: 'Receita',      icon: Pill,           color: '#16a34a' },
  { key: 'receita_controlada', label: 'Controlada',   icon: ShieldCheck,    color: '#dc2626' },
  { key: 'encaminhamento',     label: 'Encaminhar',   icon: Send,           color: '#a16207' },
  { key: 'declaracao',         label: 'Declaração',   icon: ClipboardCheck, color: '#7c3aed' },
]

function conteudoAtual(): any {
  switch (tab.value) {
    case 'atestado':           return atestado.value
    case 'pedido_exame':       return pedidoExame.value
    case 'receita':            return receita.value
    case 'receita_controlada': return receitaControlada.value
    case 'encaminhamento':     return encaminhamento.value
    case 'declaracao':         return declaracao.value
  }
}

async function gerar() {
  if (!paciente.value?.id) {
    ultimoErro.value = 'Paciente não identificado'
    return
  }
  ultimoErro.value = ''
  ultimoPdfUrl.value = null
  gerando.value = true
  try {
    const result = await gerarESalvar({
      tipo: tab.value,
      conteudo: conteudoAtual(),
      paciente: {
        id: paciente.value.id,
        nome: paciente.value.nome,
        cpf: paciente.value.cpf,
        data_nascimento: paciente.value.data_nascimento,
        sus_cartao: paciente.value.sus_cartao,
      },
      medico: {
        id: props.medicoId,
        nome: props.medicoNome,
        crm: props.medicoCRM,
        especialidade: props.medicoEspecialidade,
        assinatura_url: props.medicoAssinaturaUrl ?? null,
      },
      agendamentoId: props.agendamento.id,
    })
    if (result.ok) {
      ultimoPdfUrl.value = result.pdfUrl
    } else {
      ultimoErro.value = result.error ?? 'Falha ao gerar documento'
    }
  } finally {
    gerando.value = false
  }
}

function novoDocumento() {
  ultimoPdfUrl.value = null
  ultimoErro.value = ''
  if (tab.value === 'atestado') atestado.value = { dias: 1, cid: '', descricao: '' }
  if (tab.value === 'pedido_exame') pedidoExame.value = { exames: [''], indicacaoClinica: '' }
  if (tab.value === 'receita') receita.value = { medicamentos: [{ nome: '', posologia: '', quantidade: '' }] }
  if (tab.value === 'receita_controlada') receitaControlada.value = { medicamento: '', posologia: '', quantidade: '', observacoes: '' }
  if (tab.value === 'encaminhamento') encaminhamento.value = { especialidade: '', hipoteseDiagnostica: '', resumoClinico: '' }
  if (tab.value === 'declaracao') declaracao.value = { finalidade: '', horaInicio: '', horaFim: '' }
}

function addMedicamento() {
  receita.value.medicamentos.push({ nome: '', posologia: '', quantidade: '' })
}
function removeMedicamento(i: number) {
  receita.value.medicamentos.splice(i, 1)
}
function addExame() {
  pedidoExame.value.exames.push('')
}
function removeExame(i: number) {
  pedidoExame.value.exames.splice(i, 1)
}

const tabAtiva = computed(() => TABS.find((t) => t.key === tab.value)!)
</script>

<template>
  <div>
    <!-- Tabs -->
    <div class="flex flex-wrap gap-1.5 mb-5">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
        :style="tab === t.key
          ? `background:${t.color};color:white;border-color:${t.color}`
          : `background:white;color:#475569;border-color:#e2e8f0`"
        @click="tab = t.key; ultimoPdfUrl = null; ultimoErro = ''"
      >
        <component :is="t.icon" :size="13" />
        {{ t.label }}
      </button>
    </div>

    <!-- Sucesso -->
    <div v-if="ultimoPdfUrl" class="rounded-xl p-4 border mb-3" style="background:#f0fdf4;border-color:#bbf7d0">
      <div class="flex items-start gap-3">
        <CheckCircle2 :size="20" style="color:#16a34a" class="shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm" style="color:#166534">Documento gerado com sucesso</p>
          <p class="text-xs mt-0.5" style="color:#166534">Salvo no histórico — admin pode enviar ao paciente.</p>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <a
          :href="ultimoPdfUrl" target="_blank"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style="background:#16a34a;color:white"
        >
          <ExternalLink :size="13" /> Abrir PDF
        </a>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style="background:white;color:#166534;border-color:#bbf7d0"
          @click="novoDocumento"
        >
          Emitir outro
        </button>
      </div>
    </div>

    <!-- Erro -->
    <div
      v-if="ultimoErro"
      class="rounded-xl p-3 border mb-3 flex items-start gap-2.5"
      style="background:#fef2f2;border-color:#fecaca;color:#b91c1c"
    >
      <AlertCircle :size="16" class="shrink-0 mt-0.5" />
      <span class="text-sm">{{ ultimoErro }}</span>
    </div>

    <div v-if="!ultimoPdfUrl">
      <!-- Prescrição via Memed (receita / receita controlada) -->
      <div v-if="ehAbaReceita" class="rounded-xl p-4 mb-4 space-y-3" style="background:#f5f3ff;border:1px solid #ddd6fe">
        <div class="flex items-start gap-2.5">
          <Stamp :size="16" style="color:#7c3aed" class="shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold" style="color:#5b21b6">Prescrever com assinatura digital (Memed)</p>
            <p class="text-xs mt-0.5" style="color:#7c5cd6">
              Abra sua conta pessoal Memed, prescreva normalmente e cole aqui o link da receita gerada.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style="background:#7c3aed;color:white"
          @click="abrirMemed"
        >
          <ExternalLink :size="13" /> Abrir Memed em nova aba
        </button>
        <div class="flex gap-2">
          <input
            v-model="linkMemed"
            placeholder="Cole aqui o link da receita gerada na Memed"
            class="flex-1 px-3 py-2 rounded-lg border text-sm"
            style="border-color:#ddd6fe;background:white"
          >
          <button
            type="button"
            :disabled="!linkMemed.trim() || salvandoMemed"
            class="px-3 py-2 rounded-lg text-xs font-semibold shrink-0 disabled:opacity-40"
            style="background:#5b21b6;color:white"
            @click="salvarReceitaMemed"
          >
            {{ salvandoMemed ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
        <p v-if="erroMemed" class="text-xs" style="color:#b91c1c">{{ erroMemed }}</p>
        <p class="text-xs" style="color:#7c5cd6">
          Ou preencha o formulário abaixo para gerar um PDF simples sem assinatura digital certificada.
        </p>
      </div>

      <!-- Atestado -->
      <div v-if="tab === 'atestado'" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Dias</label>
            <input v-model.number="atestado.dias" type="number" min="1" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">CID (opcional)</label>
            <input v-model="atestado.cid" placeholder="Z00.0" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Descrição / motivo</label>
          <textarea v-model="atestado.descricao" rows="3" class="w-full px-3 py-2 rounded-lg border text-sm resize-none" style="border-color:#e2e8f0" placeholder="Necessita repouso por sintomas gripais..." />
        </div>
      </div>

      <!-- Pedido de exame -->
      <div v-else-if="tab === 'pedido_exame'" class="space-y-3">
        <label class="block text-xs font-semibold uppercase tracking-wide" style="color:#475569">Exames solicitados</label>
        <div v-for="(_, i) in pedidoExame.exames" :key="i" class="flex gap-2">
          <input v-model="pedidoExame.exames[i]" :placeholder="`Exame ${i + 1}`" class="flex-1 px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
          <button v-if="pedidoExame.exames.length > 1" type="button" class="p-2 rounded-lg" style="background:#fef2f2;color:#b91c1c" @click="removeExame(i)">
            <Trash2 :size="14" />
          </button>
        </div>
        <button type="button" class="inline-flex items-center gap-1.5 text-xs font-medium" style="color:#0891b2" @click="addExame">
          <Plus :size="13" /> Adicionar exame
        </button>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1 mt-2" style="color:#475569">Indicação clínica</label>
          <textarea v-model="pedidoExame.indicacaoClinica" rows="2" class="w-full px-3 py-2 rounded-lg border text-sm resize-none" style="border-color:#e2e8f0" />
        </div>
      </div>

      <!-- Receita -->
      <div v-else-if="tab === 'receita'" class="space-y-3">
        <div
          v-for="(med, i) in receita.medicamentos"
          :key="i"
          class="rounded-xl border p-3 space-y-2"
          style="border-color:#e2e8f0;background:#f8fafc"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wide" style="color:#475569">Medicamento {{ i + 1 }}</span>
            <button v-if="receita.medicamentos.length > 1" type="button" class="p-1 rounded" style="color:#b91c1c" @click="removeMedicamento(i)">
              <Trash2 :size="13" />
            </button>
          </div>
          <input v-model="med.nome" placeholder="Nome (ex: Paracetamol 750mg)" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0;background:white">
          <div class="grid grid-cols-2 gap-2">
            <input v-model="med.posologia" placeholder="Posologia" class="px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0;background:white">
            <input v-model="med.quantidade" placeholder="Quantidade" class="px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0;background:white">
          </div>
        </div>
        <button type="button" class="inline-flex items-center gap-1.5 text-xs font-medium" style="color:#16a34a" @click="addMedicamento">
          <Plus :size="13" /> Adicionar medicamento
        </button>
      </div>

      <!-- Receita controlada -->
      <div v-else-if="tab === 'receita_controlada'" class="space-y-3">
        <div class="rounded-lg p-2.5 text-xs flex items-center gap-2" style="background:#fef2f2;color:#b91c1c">
          <ShieldCheck :size="14" />
          <span>Atenção: medicamento controlado. Use apenas para listas B/C.</span>
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Medicamento</label>
          <input v-model="receitaControlada.medicamento" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Posologia</label>
            <input v-model="receitaControlada.posologia" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Quantidade</label>
            <input v-model="receitaControlada.quantidade" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Observações</label>
          <textarea v-model="receitaControlada.observacoes" rows="2" class="w-full px-3 py-2 rounded-lg border text-sm resize-none" style="border-color:#e2e8f0" />
        </div>
      </div>

      <!-- Encaminhamento -->
      <div v-else-if="tab === 'encaminhamento'" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Especialidade de destino</label>
          <input v-model="encaminhamento.especialidade" placeholder="Ex: Cardiologia" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Hipótese diagnóstica</label>
          <textarea v-model="encaminhamento.hipoteseDiagnostica" rows="2" class="w-full px-3 py-2 rounded-lg border text-sm resize-none" style="border-color:#e2e8f0" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Resumo clínico</label>
          <textarea v-model="encaminhamento.resumoClinico" rows="3" class="w-full px-3 py-2 rounded-lg border text-sm resize-none" style="border-color:#e2e8f0" />
        </div>
      </div>

      <!-- Declaração -->
      <div v-else-if="tab === 'declaracao'" class="space-y-3">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Finalidade</label>
          <input v-model="declaracao.finalidade" placeholder="Ex: Para fins trabalhistas" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Hora entrada</label>
            <input v-model="declaracao.horaInicio" type="time" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide mb-1" style="color:#475569">Hora saída</label>
            <input v-model="declaracao.horaFim" type="time" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:#e2e8f0">
          </div>
        </div>
      </div>

      <!-- Botão gerar -->
      <button
        type="button"
        :disabled="gerando"
        class="w-full mt-5 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
        :style="`background:${tabAtiva.color};${gerando ? 'opacity:0.6;cursor:not-allowed' : 'cursor:pointer'}`"
        @click="gerar"
      >
        <Loader2 v-if="gerando" :size="15" class="animate-spin" />
        <component v-else :is="tabAtiva.icon" :size="15" />
        {{ gerando ? 'Gerando PDF…' : `Gerar ${tabAtiva.label}` }}
      </button>
    </div>
  </div>
</template>
