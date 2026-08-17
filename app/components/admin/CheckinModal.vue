<script setup lang="ts">
import { UserCheck, X, Heart, Thermometer, Activity, Weight, Bluetooth, BluetoothConnected, BluetoothOff, Loader2, Droplets, Scale, Paperclip, Link2, Upload, Trash2, ExternalLink } from 'lucide-vue-next'
import type { Agendamento, AnexoTriagem } from '~/types'
import { useFila } from '~/composables/useFila'
import { useDispositivosBT, type TipoDispositivo } from '~/composables/useDispositivosBT'
import { useDocumentos } from '~/composables/useDocumentos'

interface Props {
  agendamento: Agendamento
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const supabase = useSupabaseClient()
const fila = useFila()
const toast = useToast()
const carregando = ref(false)
const { resolverUrlAssinada } = useDocumentos()

const bt = useDispositivosBT()
const maletaAberta = ref(false)

// Sincroniza sinais capturados → campos da triagem em tempo real
watch(bt.sinais, (s) => {
  if (s.pressao_sistolica != null)  triagem.value.pressao_sistolica  = s.pressao_sistolica
  if (s.pressao_diastolica != null) triagem.value.pressao_diastolica = s.pressao_diastolica
  if (s.pulso != null)              triagem.value.pulso              = s.pulso
  if (s.temperatura != null)        triagem.value.temperatura        = s.temperatura
  if (s.saturacao != null)          triagem.value.saturacao          = s.saturacao
  if (s.peso != null)               triagem.value.peso               = s.peso
  if (s.glicemia != null)           triagem.value.glicemia           = s.glicemia
  if (s.gordura_percentual != null) triagem.value.gordura_percentual = s.gordura_percentual
  if (s.imc != null)                triagem.value.imc                = s.imc
}, { deep: true })

const dispositivosConfig: { tipo: TipoDispositivo; label: string; icone: any; cor: string }[] = [
  { tipo: 'pressao',       label: 'Pressão + Pulso', icone: Activity,    cor: '#3b82f6' },
  { tipo: 'oximetro',      label: 'SpO₂ + Pulso',    icone: Heart,       cor: '#ef4444' },
  { tipo: 'termometro',    label: 'Temperatura',      icone: Thermometer, cor: '#f59e0b' },
  { tipo: 'balanca',       label: 'Balança / Peso',   icone: Weight,      cor: '#10b981' },
  { tipo: 'glicosimetro',  label: 'Glicemia (HGT)',   icone: Droplets,    cor: '#8b5cf6' },
  { tipo: 'bioimpedancia', label: 'Bioimpedância',    icone: Scale,       cor: '#0891b2' },
]

// Paciente já em check-in → estamos editando o que já foi registrado,
// não criando do zero. Pré-carrega a triagem salva para permitir corrigir
// um valor errado sem perder o resto.
const modoEdicao = computed(() => props.agendamento.status === 'checkin')

const triagemSalva = (props.agendamento.triagem ?? {}) as Record<string, any>

const triagem = ref({
  alergia: triagemSalva.alergia ?? false,
  febre: triagemSalva.febre ?? false,
  urgencia: triagemSalva.urgencia ?? false,
  obs: triagemSalva.obs ?? '',
  pressao_sistolica: (triagemSalva.pressao_sistolica ?? null) as number | null,
  pressao_diastolica: (triagemSalva.pressao_diastolica ?? null) as number | null,
  pulso: (triagemSalva.pulso ?? null) as number | null,
  temperatura: (triagemSalva.temperatura ?? null) as number | null,
  saturacao: (triagemSalva.saturacao ?? null) as number | null,
  peso: (triagemSalva.peso ?? null) as number | null,
  altura: (triagemSalva.altura ?? null) as number | null,
  glicemia: (triagemSalva.glicemia ?? null) as number | null,
  gordura_percentual: (triagemSalva.gordura_percentual ?? null) as number | null,
  imc: (triagemSalva.imc ?? null) as number | null,
})

// Documentos/exames anexados no check-in — link externo (ex: PDF no Drive,
// resultado online) ou arquivo enviado direto (guardado no bucket privado
// "documentos", igual aos documentos gerados pelo médico).
const anexos = ref<AnexoTriagem[]>((triagemSalva.anexos ?? []) as AnexoTriagem[])
const novoLinkLabel = ref('')
const novoLinkUrl = ref('')
const enviandoArquivo = ref(false)
const erroAnexo = ref('')

function adicionarLink() {
  erroAnexo.value = ''
  if (!novoLinkUrl.value.trim()) { erroAnexo.value = 'Cole um link.'; return }
  if (!/^https?:\/\//i.test(novoLinkUrl.value.trim())) { erroAnexo.value = 'O link precisa começar com http:// ou https://'; return }
  anexos.value.push({
    tipo: 'link',
    label: novoLinkLabel.value.trim() || 'Link',
    url: novoLinkUrl.value.trim(),
  })
  novoLinkLabel.value = ''
  novoLinkUrl.value = ''
}

async function enviarArquivo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  erroAnexo.value = ''
  enviandoArquivo.value = true
  try {
    const path = `checkin-anexos/${props.agendamento.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: false })
    if (error) throw new Error(error.message)
    anexos.value.push({ tipo: 'arquivo', label: file.name, url: path })
  } catch (err: any) {
    erroAnexo.value = err?.message ?? 'Erro ao enviar arquivo.'
  } finally {
    enviandoArquivo.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

function removerAnexo(i: number) {
  anexos.value.splice(i, 1)
}

async function abrirAnexo(a: AnexoTriagem) {
  const url = await resolverUrlAssinada(a.url)
  if (url) window.open(url, '_blank', 'noopener')
}

interface MedicoOpcao { id: string; nome: string; especialidade: string; pausado: boolean }
interface SalaOpcao { id: string; slug: string; nome: string }
interface UnidadeOpcao { id: string; nome: string }

const medicos = ref<MedicoOpcao[]>([])
const ocupadoIds = ref<Set<string>>(new Set())
const medicoSelecionadoId = ref<string | null>(props.agendamento.medico_id ?? null)

const salas = ref<SalaOpcao[]>([])
const salaSelecionadaSlug = ref<string | null>(props.agendamento.sala_slug ?? null)

// Muitos pacientes antigos não têm unidade definida — sem ela não dá pra
// saber quais salas mostrar, e a lista de salas simplesmente ficava vazia
// sem nenhuma explicação. Deixa escolher a unidade aqui mesmo quando falta.
const unidadePacienteId = (props.agendamento.pacientes as any)?.unidade_id ?? null
const unidades = ref<UnidadeOpcao[]>([])
const unidadeSelecionadaId = ref<string | null>(unidadePacienteId)
const carregandoSalas = ref(false)

async function carregarSalasDaUnidade(unidadeId: string | null) {
  carregandoSalas.value = true
  if (!unidadeId) {
    salas.value = []
    carregandoSalas.value = false
    return
  }
  const { data } = await supabase.from('salas').select('id, slug, nome').eq('unidade_id', unidadeId).eq('ativo', true).order('nome')
  salas.value = data ?? []
  // Só pré-seleciona a única sala se ainda não houver uma definida
  if (!salaSelecionadaSlug.value && salas.value.length === 1) {
    salaSelecionadaSlug.value = salas.value[0]?.slug ?? null
  }
  carregandoSalas.value = false
}
watch(unidadeSelecionadaId, (id) => carregarSalasDaUnidade(id))

onMounted(async () => {
  const hoje = new Date()
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const [{ data: mData }, { data: ocupData }] = await Promise.all([
    supabase.from('medicos').select('id, nome, especialidade, pausado').eq('ativo', true).order('nome'),
    supabase.from('agendamentos').select('medico_id').eq('data_consulta', dataHoje)
      .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta']),
    carregarSalasDaUnidade(unidadeSelecionadaId.value),
  ])
  medicos.value = mData ?? []
  ocupadoIds.value = new Set((ocupData ?? []).map((a) => a.medico_id))

  if (!unidadePacienteId) {
    const { data } = await supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome')
    unidades.value = data ?? []
  }
})

function disponivel(m: MedicoOpcao): boolean {
  return !m.pausado && !ocupadoIds.value.has(m.id)
}

// Só oferece médicos livres agora, agrupados por especialidade — cada
// paciente pode precisar de uma diferente.
const medicosPorEspecialidade = computed(() => {
  const grupos: Record<string, MedicoOpcao[]> = {}
  for (const m of medicos.value.filter(disponivel)) {
    (grupos[m.especialidade] ??= []).push(m)
  }
  return grupos
})

const paciente = computed(() => props.agendamento.pacientes)
const cpfFormatado = computed(() => {
  const cpf = paciente.value?.cpf ?? ''
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
})

async function confirmar() {
  carregando.value = true
  try {
    // Paciente sem unidade cadastrada e uma foi escolhida agora — grava no
    // cadastro dele pra não precisar escolher de novo da próxima vez
    if (!unidadePacienteId && unidadeSelecionadaId.value && paciente.value?.id) {
      const { error: errUnidade } = await supabase
        .from('pacientes')
        .update({ unidade_id: unidadeSelecionadaId.value })
        .eq('id', paciente.value.id)
      if (errUnidade) throw new Error(errUnidade.message)
    }

    // Faz/atualiza o check-in com triagem, já registrando em qual sala da
    // unidade o paciente está fisicamente
    const { error: errCheckin } = await fila.fazerCheckin(
      props.agendamento.id,
      { ...triagem.value, anexos: anexos.value },
      salaSelecionadaSlug.value
    )
    if (errCheckin) throw new Error(errCheckin.message)

    if (modoEdicao.value) {
      // Editando alguém que já está na fila: só corrige os dados. Encaminhar
      // é uma decisão à parte (botão "Encaminhar →"), senão salvar uma
      // correção de triagem mandaria o paciente para o médico sem querer.
      if (medicoSelecionadoId.value && medicoSelecionadoId.value !== props.agendamento.medico_id) {
        const { error: errMedico } = await supabase
          .from('agendamentos')
          .update({ medico_id: medicoSelecionadoId.value })
          .eq('id', props.agendamento.id)
        if (errMedico) throw new Error(errMedico.message)
      }
    } else if (medicoSelecionadoId.value) {
      // Check-in inicial com médico escolhido → já encaminha
      const { error: errChamar } = await fila.chamar(props.agendamento.id, medicoSelecionadoId.value)
      if (errChamar) throw new Error(errChamar.message)
    }

    await fila.carregar()
    toast.sucesso(modoEdicao.value ? 'Check-in atualizado!' : 'Check-in realizado!')
    emit('close')
  } catch (e: any) {
    toast.erro('Erro ao salvar check-in: ' + (e?.message ?? 'tente novamente'))
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <UiModal :model-value="true" :title="modoEdicao ? 'Editar Check-in' : 'Fazer Check-in'" size="md" @update:model-value="emit('close')">
    <div class="space-y-5">
      <!-- Dados do paciente (somente leitura) -->
      <div class="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border-light)]">
        <p class="text-lg font-bold text-[var(--color-text)]">{{ paciente?.nome }}</p>
        <p class="text-sm text-[var(--color-text-muted)] mt-0.5">CPF: {{ cpfFormatado }}</p>
        <p v-if="paciente?.sus_cartao" class="text-sm text-[var(--color-text-muted)]">
          Cartão SUS: {{ paciente.sus_cartao }}
        </p>
        <p v-if="agendamento.motivo" class="text-sm text-[var(--color-text-muted)] mt-1">
          Motivo: {{ agendamento.motivo }}
        </p>
      </div>

      <!-- Unidade: só aparece se o paciente não tiver uma cadastrada — sem
           isso não dava pra saber quais salas oferecer -->
      <div v-if="!unidadePacienteId">
        <label class="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Unidade do paciente</label>
        <select v-model="unidadeSelecionadaId" class="input-base py-2.5 text-sm">
          <option :value="null">Selecione…</option>
          <option v-for="u in unidades" :key="u.id" :value="u.id">{{ u.nome }}</option>
        </select>
        <p class="mt-1.5 text-xs" style="color:#854d0e">
          Este paciente ainda não tem unidade cadastrada — escolha uma pra liberar as salas.
        </p>
      </div>

      <!-- Sala: onde o paciente está fisicamente, na unidade dele -->
      <div>
        <label class="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Sala (na unidade do paciente)</label>
        <select v-model="salaSelecionadaSlug" class="input-base py-2.5 text-sm" :disabled="carregandoSalas || !unidadeSelecionadaId">
          <option :value="null">Selecione…</option>
          <option v-for="s in salas" :key="s.id" :value="s.slug">{{ s.nome }}</option>
        </select>
        <p v-if="!unidadeSelecionadaId" class="mt-1.5 text-xs font-medium" style="color:#dc2626">
          Escolha a unidade do paciente primeiro.
        </p>
        <p v-else-if="!carregandoSalas && salas.length === 0" class="mt-1.5 text-xs font-medium" style="color:#dc2626">
          Esta unidade não tem salas cadastradas. Cadastre em <strong>Admin → Salas</strong>.
        </p>
      </div>

      <!-- Médico: quem vai atender agora (opcional, pode chamar depois) -->
      <div>
        <label class="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Médico</label>
        <select v-model="medicoSelecionadoId" class="input-base py-2.5 text-sm">
          <option :value="null">Selecione…</option>
          <optgroup v-for="(lista, especialidade) in medicosPorEspecialidade" :key="especialidade" :label="especialidade">
            <option v-for="m in lista" :key="m.id" :value="m.id">{{ m.nome }}</option>
          </optgroup>
        </select>
        <p v-if="Object.keys(medicosPorEspecialidade).length === 0" class="mt-1.5 text-xs font-medium" style="color:#dc2626">
          Nenhum médico disponível no momento.
        </p>
      </div>
      <p v-if="modoEdicao" class="text-xs text-[var(--color-text-muted)] -mt-1">
        O paciente continua na fila — para enviá-lo ao médico use o botão <strong>Encaminhar</strong>.
      </p>
      <p v-else-if="!medicoSelecionadoId" class="text-xs text-[var(--color-text-muted)] -mt-1">
        Se não selecionar médico, o paciente ficará em check-in aguardando ser chamado manualmente.
      </p>

      <!-- Triagem -->
      <div>
        <p class="text-sm font-semibold text-[var(--color-text)] mb-3">Triagem Rápida</p>
        <div class="space-y-3">
          <label
            v-for="campo in [
              { key: 'alergia', label: 'Alergia a medicamento?', color: 'text-[var(--color-warning)]' },
              { key: 'febre', label: 'Febre?', color: 'text-[var(--color-danger)]' },
              { key: 'urgencia', label: 'Urgência?', color: 'text-[var(--color-danger)] font-bold' },
            ]"
            :key="campo.key"
            class="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border-light)] cursor-pointer hover:bg-[var(--color-surface-2)]"
          >
            <span :class="['text-sm', campo.color]">{{ campo.label }}</span>
            <div class="flex gap-4">
              <label class="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  :name="campo.key"
                  :value="true"
                  v-model="triagem[campo.key as 'alergia' | 'febre' | 'urgencia']"
                  class="accent-[var(--color-blue)]"
                />
                Sim
              </label>
              <label class="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  :name="campo.key"
                  :value="false"
                  v-model="triagem[campo.key as 'alergia' | 'febre' | 'urgencia']"
                  class="accent-[var(--color-blue)]"
                />
                Não
              </label>
            </div>
          </label>
        </div>

        <!-- Maleta de Telemetria (Bluetooth) -->
        <div v-if="bt.suportado" class="mt-4">
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
            :style="maletaAberta
              ? 'background:#eff6ff;border-color:#93c5fd;color:#1d4ed8'
              : 'background:#f8fafc;border-color:#e2e8f0;color:#475569'"
            @click="maletaAberta = !maletaAberta"
          >
            <span class="flex items-center gap-2">
              <Bluetooth :size="15" />
              Maleta de Telemetria
            </span>
            <span class="text-[11px] font-normal opacity-70">conectar aparelhos →</span>
          </button>

          <div v-if="maletaAberta" class="mt-2 space-y-3">
            <!-- Omron HEM-7156T (protocolo proprietário) -->
            <AdminOmronConectar @medido="(v) => { triagem.pressao_sistolica = v.sistolica; triagem.pressao_diastolica = v.diastolica; triagem.pulso = v.pulso }" />

            <!-- Demais aparelhos (protocolo GATT padrão) -->
            <div class="grid grid-cols-2 gap-2">
            <button
              v-for="d in dispositivosConfig"
              :key="d.tipo"
              type="button"
              class="flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all"
              :style="bt.estado[d.tipo].conectado
                ? `background:#f0fdf4;border-color:#86efac;color:${d.cor}`
                : bt.estado[d.tipo].erro
                  ? 'background:#fef2f2;border-color:#fca5a5;color:#dc2626'
                  : 'background:#f8fafc;border-color:#e2e8f0;color:#64748b'"
              :disabled="bt.estado[d.tipo].lendo"
              @click="bt.conectar[d.tipo]()"
            >
              <component
                :is="bt.estado[d.tipo].lendo ? Loader2 : bt.estado[d.tipo].conectado ? BluetoothConnected : bt.estado[d.tipo].erro ? BluetoothOff : d.icone"
                :size="20"
                :class="bt.estado[d.tipo].lendo ? 'animate-spin' : ''"
                :style="`color:${d.cor}`"
              />
              <span>{{ d.label }}</span>
              <span class="text-[10px] opacity-60">
                {{ bt.estado[d.tipo].lendo ? 'aguardando…' : bt.estado[d.tipo].conectado ? 'conectado ✓' : bt.estado[d.tipo].erro ? 'falhou' : 'toque para parear' }}
              </span>
            </button>
          </div>

          <!-- Preview dos valores capturados em tempo real -->
          <div
            v-if="maletaAberta && (bt.sinais.pressao_sistolica || bt.sinais.pulso || bt.sinais.saturacao || bt.sinais.temperatura || bt.sinais.peso || bt.sinais.glicemia || bt.sinais.gordura_percentual)"
            class="mt-2 flex flex-wrap gap-2 px-3 py-2 rounded-lg text-xs"
            style="background:#f0fdf4;border:1px solid #bbf7d0"
          >
            <span v-if="bt.sinais.pressao_sistolica" class="font-semibold text-green-700">
              PA {{ bt.sinais.pressao_sistolica }}/{{ bt.sinais.pressao_diastolica }} mmHg
            </span>
            <span v-if="bt.sinais.pulso" class="font-semibold text-green-700">
              Pulso {{ bt.sinais.pulso }} bpm
            </span>
            <span v-if="bt.sinais.saturacao" class="font-semibold text-green-700">
              SpO₂ {{ bt.sinais.saturacao }}%
            </span>
            <span v-if="bt.sinais.temperatura" class="font-semibold text-green-700">
              {{ bt.sinais.temperatura }} °C
            </span>
            <span v-if="bt.sinais.peso" class="font-semibold text-green-700">
              {{ bt.sinais.peso }} kg
            </span>
            <span v-if="bt.sinais.glicemia" class="font-semibold text-green-700">
              Glicemia {{ bt.sinais.glicemia }} mg/dL
            </span>
            <span v-if="bt.sinais.gordura_percentual" class="font-semibold text-green-700">
              Gordura {{ bt.sinais.gordura_percentual }}%
            </span>
            <span v-if="bt.sinais.imc" class="font-semibold text-green-700">
              IMC {{ bt.sinais.imc }}
            </span>
            <span class="text-green-600 opacity-70 ml-auto">preenchendo campos automaticamente…</span>
          </div>
          </div> <!-- /space-y-3 maleta -->
        </div>

        <!-- Sinais Vitais -->
        <div class="mt-4">
          <p class="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
            <Activity :size="15" class="text-[var(--color-blue)]" />
            Sinais Vitais
          </p>
          <div class="grid grid-cols-2 gap-3">
            <!-- Pressão Arterial -->
            <div class="col-span-2">
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Pressão Arterial (mmHg)</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="triagem.pressao_sistolica"
                  type="number"
                  min="40" max="300"
                  placeholder="Sistólica"
                  class="input-base text-sm"
                />
                <span class="text-[var(--color-text-muted)] font-bold">/</span>
                <input
                  v-model.number="triagem.pressao_diastolica"
                  type="number"
                  min="20" max="200"
                  placeholder="Diastólica"
                  class="input-base text-sm"
                />
              </div>
            </div>
            <!-- Pulso -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Pulso (bpm)</label>
              <input
                v-model.number="triagem.pulso"
                type="number"
                min="20" max="300"
                placeholder="ex: 72"
                class="input-base text-sm"
              />
            </div>
            <!-- Temperatura -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Temperatura (°C)</label>
              <input
                v-model.number="triagem.temperatura"
                type="number"
                min="30" max="45"
                step="0.1"
                placeholder="ex: 36.5"
                class="input-base text-sm"
              />
            </div>
            <!-- Saturação -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Saturação SpO₂ (%)</label>
              <input
                v-model.number="triagem.saturacao"
                type="number"
                min="50" max="100"
                placeholder="ex: 98"
                class="input-base text-sm"
              />
            </div>
            <!-- Peso -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Peso (kg)</label>
              <input
                v-model.number="triagem.peso"
                type="number"
                min="1" max="500"
                step="0.1"
                placeholder="ex: 70.5"
                class="input-base text-sm"
              />
            </div>
            <!-- Altura -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Altura (cm)</label>
              <input
                v-model.number="triagem.altura"
                type="number"
                min="30" max="250"
                placeholder="ex: 170"
                class="input-base text-sm"
              />
            </div>
            <!-- Glicemia -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Glicemia (mg/dL)</label>
              <input
                v-model.number="triagem.glicemia"
                type="number"
                min="20" max="600"
                placeholder="ex: 95"
                class="input-base text-sm"
              />
            </div>
            <!-- % Gordura -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">% Gordura corporal</label>
              <input
                v-model.number="triagem.gordura_percentual"
                type="number"
                min="1" max="70"
                step="0.1"
                placeholder="ex: 22.5"
                class="input-base text-sm"
              />
            </div>
            <!-- IMC -->
            <div>
              <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">IMC (kg/m²)</label>
              <input
                v-model.number="triagem.imc"
                type="number"
                min="10" max="70"
                step="0.1"
                placeholder="ex: 24.2"
                class="input-base text-sm"
              />
            </div>
          </div>
        </div>

        <!-- Documentos / Exames -->
        <div class="mt-4">
          <p class="text-sm font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
            <Paperclip :size="15" class="text-[var(--color-blue)]" />
            Documentos / Exames
          </p>

          <div v-if="anexos.length" class="space-y-1.5 mb-3">
            <div
              v-for="(a, i) in anexos" :key="i"
              class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
              style="border-color:#e2e8f0;background:#f8fafc"
            >
              <component :is="a.tipo === 'link' ? Link2 : Paperclip" :size="14" style="color:#64748b" class="shrink-0" />
              <button type="button" class="truncate text-left flex-1 hover:underline" style="color:#1d4ed8" @click="abrirAnexo(a)">
                {{ a.label }}
              </button>
              <ExternalLink :size="12" style="color:#94a3b8" class="shrink-0" />
              <button type="button" class="shrink-0" @click="removerAnexo(i)">
                <Trash2 :size="13" style="color:#dc2626" />
              </button>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-2">
            <input v-model="novoLinkLabel" type="text" placeholder="Nome (ex: Exame de sangue)" class="input-base text-sm flex-1" />
            <input v-model="novoLinkUrl" type="text" placeholder="https://..." class="input-base text-sm flex-1" />
            <UiButton type="button" variant="ghost" size="sm" @click="adicionarLink">
              <Link2 :size="13" /> Link
            </UiButton>
          </div>
          <label class="mt-2 inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer" style="color:#475569">
            <Upload :size="13" />
            {{ enviandoArquivo ? 'Enviando…' : 'Ou enviar um arquivo (PDF/imagem)' }}
            <input type="file" accept="application/pdf,image/*" class="hidden" :disabled="enviandoArquivo" @change="enviarArquivo" />
          </label>
          <p v-if="erroAnexo" class="mt-1.5 text-xs font-medium" style="color:#dc2626">{{ erroAnexo }}</p>
        </div>

        <div class="mt-3">
          <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">
            Observações
          </label>
          <textarea
            v-model="triagem.obs"
            rows="3"
            placeholder="Observações adicionais..."
            class="input-base resize-none"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Cancelar</UiButton>
      <UiButton variant="success" :loading="carregando" @click="confirmar">
        <UserCheck :size="16" />
        {{ modoEdicao ? 'Salvar alterações' : 'Confirmar Check-in' }}
      </UiButton>
    </template>
  </UiModal>
</template>
