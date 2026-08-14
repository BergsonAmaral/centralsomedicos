<script setup lang="ts">
import { UserCheck, X, Heart, Thermometer, Activity, Weight, Bluetooth, BluetoothConnected, BluetoothOff, Loader2, Droplets, Scale } from 'lucide-vue-next'
import type { Agendamento } from '~/types'
import { useFila } from '~/composables/useFila'
import { useDispositivosBT, type TipoDispositivo } from '~/composables/useDispositivosBT'

interface Props {
  agendamento: Agendamento
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const supabase = useSupabaseClient()
const fila = useFila()
const carregando = ref(false)

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

const triagem = ref({
  alergia: false,
  febre: false,
  urgencia: false,
  obs: '',
  pressao_sistolica: null as number | null,
  pressao_diastolica: null as number | null,
  pulso: null as number | null,
  temperatura: null as number | null,
  saturacao: null as number | null,
  peso: null as number | null,
  altura: null as number | null,
  glicemia: null as number | null,
  gordura_percentual: null as number | null,
  imc: null as number | null,
})

interface MedicoOpcao { id: string; nome: string; especialidade: string; pausado: boolean }
interface SalaOpcao { id: string; slug: string; nome: string }

const medicos = ref<MedicoOpcao[]>([])
const ocupadoIds = ref<Set<string>>(new Set())
const medicoSelecionadoId = ref<string | null>(props.agendamento.medico_id ?? null)

const salas = ref<SalaOpcao[]>([])
const salaSelecionadaSlug = ref<string | null>(null)

onMounted(async () => {
  const hoje = new Date()
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const unidadeId = (props.agendamento.pacientes as any)?.unidade_id ?? null

  const [{ data: mData }, { data: ocupData }, { data: sData }] = await Promise.all([
    supabase.from('medicos').select('id, nome, especialidade, pausado').eq('ativo', true).order('nome'),
    supabase.from('agendamentos').select('medico_id').eq('data_consulta', dataHoje)
      .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta']),
    unidadeId
      ? supabase.from('salas').select('id, slug, nome').eq('unidade_id', unidadeId).eq('ativo', true).order('nome')
      : Promise.resolve({ data: [] as SalaOpcao[] }),
  ])
  medicos.value = mData ?? []
  ocupadoIds.value = new Set((ocupData ?? []).map((a) => a.medico_id))
  salas.value = sData ?? []
  if (salas.value.length === 1) salaSelecionadaSlug.value = salas.value[0]?.slug ?? null
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
    // Faz check-in com triagem, já registrando em qual sala da unidade o
    // paciente está fisicamente
    const { error: errCheckin } = await fila.fazerCheckin(props.agendamento.id, triagem.value, salaSelecionadaSlug.value)
    if (errCheckin) throw new Error(errCheckin.message)

    // Se médico já selecionado, chama direto (entra na fila ativa como aguardando_medico)
    if (medicoSelecionadoId.value) {
      const { error: errChamar } = await fila.chamar(props.agendamento.id, medicoSelecionadoId.value)
      if (errChamar) throw new Error(errChamar.message)
    }

    await fila.carregar()
    emit('close')
  } catch (e: any) {
    alert('Erro ao fazer check-in: ' + (e?.message ?? 'tente novamente'))
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <UiModal :model-value="true" title="Fazer Check-in" size="md" @update:model-value="emit('close')">
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

      <!-- Sala: onde o paciente está fisicamente, na unidade dele -->
      <div>
        <label class="text-xs font-semibold text-[var(--color-text-muted)] block mb-1">Sala (na unidade do paciente)</label>
        <select v-model="salaSelecionadaSlug" class="input-base py-2.5 text-sm">
          <option :value="null">Selecione…</option>
          <option v-for="s in salas" :key="s.id" :value="s.slug">{{ s.nome }}</option>
        </select>
        <p v-if="salas.length === 0" class="mt-1.5 text-xs font-medium" style="color:#dc2626">
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
      <p v-if="!medicoSelecionadoId" class="text-xs text-[var(--color-text-muted)] -mt-1">
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
        Confirmar Check-in
      </UiButton>
    </template>
  </UiModal>
</template>
