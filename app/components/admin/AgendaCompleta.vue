<script setup lang="ts">
import { Search, Filter, Eye, Calendar, Plus, Building2 } from 'lucide-vue-next'
import type { Agendamento, AgendamentoStatus } from '~/types'

interface Props {
  medicoFiltro?: string | null
  unidadeFiltro?: string | null
}
const props = withDefaults(defineProps<Props>(), { medicoFiltro: null, unidadeFiltro: null })

const supabase = useSupabaseClient()

// Filtros
function dataLocal(offsetDias = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const dataInicio = ref<string>(dataLocal(-7))
const dataFim    = ref<string>(dataLocal(30))
const statusFiltro = ref<AgendamentoStatus | ''>('')
const busca = ref('')

const ags = ref<Agendamento[]>([])
const carregando = ref(true)

async function carregar() {
  carregando.value = true
  let q = supabase
    .from('agendamentos')
    .select('*, pacientes(nome, cpf, telefone, unidade_id, unidades(id, nome)), medicos(nome, especialidade)')
    .gte('data_consulta', dataInicio.value)
    .lte('data_consulta', dataFim.value)
    .order('data_consulta', { ascending: true })

  if (props.medicoFiltro) q = q.eq('medico_id', props.medicoFiltro)
  if (statusFiltro.value) q = q.eq('status', statusFiltro.value)

  const { data } = await q
  ags.value = (data ?? []) as Agendamento[]
  carregando.value = false
}

watch(
  [() => props.medicoFiltro, dataInicio, dataFim, statusFiltro],
  carregar,
  { immediate: true },
)

const filtrados = computed(() => {
  let lista = ags.value

  // Filtra por unidade no cliente — vem de várias unidades ao mesmo tempo
  if (props.unidadeFiltro) {
    lista = lista.filter((a) => (a.pacientes as any)?.unidade_id === props.unidadeFiltro)
  }

  const q = busca.value.trim().toLowerCase()
  if (!q) return lista
  return lista.filter((a) => {
    const nomePac = (a.pacientes as { nome?: string } | null)?.nome?.toLowerCase() ?? ''
    const cpfPac = (a.pacientes as { cpf?: string } | null)?.cpf ?? ''
    return nomePac.includes(q) || cpfPac.includes(q.replace(/\D/g, ''))
  })
})

// Agrupar por dia
const grupos = computed(() => {
  const map = new Map<string, Agendamento[]>()
  for (const a of filtrados.value) {
    const k = a.data_consulta
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(a)
  }
  return Array.from(map.entries()).map(([data, lista]) => ({ data, lista }))
})

function rotuloData(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const hoje = dataLocal(0)
  const amanha = dataLocal(1)
  const ontem = dataLocal(-1)
  if (iso === hoje) return 'Hoje'
  if (iso === amanha) return 'Amanhã'
  if (iso === ontem) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function aplicarPreset(preset: 'hoje' | 'semana' | 'mes' | 'passado' | 'tudo') {
  if (preset === 'hoje') { dataInicio.value = dataLocal(0); dataFim.value = dataLocal(0) }
  if (preset === 'semana') { dataInicio.value = dataLocal(0); dataFim.value = dataLocal(7) }
  if (preset === 'mes') { dataInicio.value = dataLocal(0); dataFim.value = dataLocal(30) }
  if (preset === 'passado') { dataInicio.value = dataLocal(-30); dataFim.value = dataLocal(-1) }
  if (preset === 'tudo') { dataInicio.value = '2024-01-01'; dataFim.value = dataLocal(365) }
}

const presetAtivo = computed<string>(() => {
  if (dataInicio.value === dataLocal(0) && dataFim.value === dataLocal(0)) return 'hoje'
  if (dataInicio.value === dataLocal(0) && dataFim.value === dataLocal(7)) return 'semana'
  if (dataInicio.value === dataLocal(0) && dataFim.value === dataLocal(30)) return 'mes'
  if (dataInicio.value === dataLocal(-30) && dataFim.value === dataLocal(-1)) return 'passado'
  return 'custom'
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

function horaFmt(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const verModal = ref<Agendamento | null>(null)

const PRESETS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Próximos 7 dias' },
  { key: 'mes', label: 'Próximos 30 dias' },
  { key: 'passado', label: 'Últimos 30 dias' },
  { key: 'tudo', label: 'Tudo' },
] as const
</script>

<template>
  <div class="space-y-4">
    <!-- Filtros -->
    <div class="card p-4 space-y-3">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.key"
          type="button"
          class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
          :class="presetAtivo === p.key
            ? 'bg-[#0a1f14] text-white border-[#0a1f14]'
            : 'bg-white text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'"
          @click="aplicarPreset(p.key)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">De</label>
          <input v-model="dataInicio" type="date" class="input-base py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Até</label>
          <input v-model="dataFim" type="date" class="input-base py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Status</label>
          <select v-model="statusFiltro" class="input-base py-2 text-sm">
            <option value="">Todos</option>
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Buscar</label>
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              v-model="busca"
              type="text"
              placeholder="Nome ou CPF..."
              class="input-base py-2 text-sm pl-9"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Resultado -->
    <div v-if="carregando" class="card p-8 text-center text-[var(--color-text-muted)] text-sm">
      Carregando…
    </div>

    <div v-else-if="!filtrados.length" class="card p-10 text-center">
      <Calendar :size="32" class="mx-auto text-[var(--color-text-dim)] mb-2" />
      <p class="text-sm text-[var(--color-text-muted)]">Nenhum agendamento encontrado neste período.</p>
    </div>

    <div v-else class="space-y-5">
      <div v-for="g in grupos" :key="g.data" class="card overflow-hidden">
        <div
          class="px-4 py-2.5 flex items-center justify-between"
          style="background:#f8fafc;border-bottom:1px solid var(--color-border-light)"
        >
          <div class="flex items-center gap-2">
            <Calendar :size="14" class="text-[var(--color-text-muted)]" />
            <p class="text-sm font-bold text-[var(--color-text)] capitalize">{{ rotuloData(g.data) }}</p>
            <span class="text-xs text-[var(--color-text-muted)]">{{ new Date(g.data + 'T12:00:00').toLocaleDateString('pt-BR') }}</span>
          </div>
          <span class="text-xs font-semibold text-[var(--color-text-muted)]">
            {{ g.lista.length }} {{ g.lista.length === 1 ? 'consulta' : 'consultas' }}
          </span>
        </div>

        <div class="divide-y" style="border-color:var(--color-border-light)">
          <div
            v-for="ag in g.lista"
            :key="ag.id"
            class="px-4 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-[var(--color-text)] text-sm">{{ (ag.pacientes as any)?.nome ?? '—' }}</p>
                <UiBadge :variant="ag.status as any" />
                <span v-if="(ag.pacientes as any)?.unidades?.nome" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style="background:#e8eef8;color:#1e4d9a">
                  <Building2 :size="10" /> {{ (ag.pacientes as any).unidades.nome }}
                </span>
                <span v-if="ag.origem === 'publico'" class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style="background:#f3e8ff;color:#7c3aed">
                  Cadastro público
                </span>
              </div>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                {{ (ag.medicos as any)?.nome }}
                <span v-if="(ag.medicos as any)?.especialidade"> · {{ (ag.medicos as any).especialidade }}</span>
                <span v-if="ag.horario"> · {{ ag.horario.slice(0, 5) }}</span>
              </p>
              <p v-if="ag.motivo" class="text-xs text-[var(--color-text-dim)] mt-0.5 truncate">{{ ag.motivo }}</p>
            </div>

            <div class="text-right shrink-0 hidden sm:block">
              <p v-if="ag.checkin_em" class="text-xs text-[var(--color-text-muted)]">
                Check-in {{ horaFmt(ag.checkin_em) }}
              </p>
              <p v-if="ag.encerrado_em" class="text-xs text-[var(--color-text-muted)]">
                Encerrado {{ horaFmt(ag.encerrado_em) }}
              </p>
            </div>

            <button
              type="button"
              class="p-2 rounded-lg hover:bg-white text-[var(--color-text-muted)] shrink-0"
              title="Ver detalhes"
              @click="verModal = ag"
            >
              <Eye :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal detalhes -->
    <UiModal v-if="verModal" :model-value="true" title="Detalhes do Agendamento" size="md" @update:model-value="verModal = null">
      <div class="space-y-2 text-sm">
        <p><strong>Paciente:</strong> {{ (verModal.pacientes as any)?.nome }}</p>
        <p><strong>Médico:</strong> {{ (verModal.medicos as any)?.nome }}</p>
        <p><strong>Data:</strong> {{ new Date(verModal.data_consulta + 'T12:00:00').toLocaleDateString('pt-BR') }}</p>
        <p><strong>Status:</strong> <UiBadge :variant="verModal.status as any" /></p>
        <p><strong>Motivo:</strong> {{ verModal.motivo ?? '—' }}</p>
        <p v-if="verModal.observacoes"><strong>Observações:</strong> {{ verModal.observacoes }}</p>
        <p v-if="verModal.horario"><strong>Horário marcado:</strong> {{ verModal.horario.slice(0, 5) }}</p>
        <p v-if="verModal.checkin_em"><strong>Check-in:</strong> {{ horaFmt(verModal.checkin_em) }}</p>
        <p v-if="verModal.chamado_em"><strong>Chamado em:</strong> {{ horaFmt(verModal.chamado_em) }}</p>
        <p v-if="verModal.encerrado_em"><strong>Encerrado em:</strong> {{ horaFmt(verModal.encerrado_em) }}</p>
        <p v-if="verModal.triagem?.obs"><strong>Observações triagem:</strong> {{ verModal.triagem.obs }}</p>
      </div>
    </UiModal>
  </div>
</template>
