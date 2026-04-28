<script setup lang="ts">
import { Phone, Mail, IdCard, Calendar, AlertTriangle, History, ChevronDown } from 'lucide-vue-next'
import type { Agendamento, Consulta } from '~/types'

const props = defineProps<{ agendamento: Agendamento }>()

const supabase = useSupabaseClient()
const historicoAberto = ref(false)
const consultasAnteriores = ref<Consulta[]>([])
const carregandoHist = ref(false)

const paciente = computed(() => props.agendamento.pacientes as any)
const triagem = computed(() => props.agendamento.triagem ?? ({} as any))

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

async function toggleHistorico() {
  historicoAberto.value = !historicoAberto.value
  if (historicoAberto.value && !consultasAnteriores.value.length) {
    carregandoHist.value = true
    const { data } = await supabase
      .from('consultas')
      .select('*, agendamentos(data_consulta, motivo)')
      .eq('paciente_id', paciente.value?.id)
      .order('created_at', { ascending: false })
    consultasAnteriores.value = data ?? []
    carregandoHist.value = false
  }
}

const alertas = computed(() => {
  const arr: { label: string; bg: string; cor: string }[] = []
  if (triagem.value.urgencia) arr.push({ label: 'Urgência', bg: '#fef2f2', cor: '#b91c1c' })
  if (triagem.value.alergia)  arr.push({ label: 'Alergia',  bg: '#fff7ed', cor: '#c2410c' })
  if (triagem.value.febre)    arr.push({ label: 'Febre',    bg: '#fefce8', cor: '#a16207' })
  return arr
})
</script>

<template>
  <div class="space-y-5">
    <!-- Cabeçalho -->
    <div class="flex items-center gap-3">
      <UiAvatar :name="paciente?.nome" size="lg" />
      <div class="min-w-0">
        <h2 class="text-base font-bold text-[var(--color-text)] leading-tight">{{ paciente?.nome }}</h2>
        <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
          {{ calcularIdade(paciente?.data_nascimento) ?? '—' }} anos
        </p>
      </div>
    </div>

    <!-- Alertas de triagem -->
    <div v-if="alertas.length || triagem.observacoes || triagem.obs" class="space-y-2">
      <div v-if="alertas.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="a in alertas"
          :key="a.label"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
          :style="`background:${a.bg};color:${a.cor}`"
        >
          <AlertTriangle :size="11" />
          {{ a.label }}
        </span>
      </div>
      <div
        v-if="triagem.observacoes || triagem.obs"
        class="rounded-lg p-2.5 text-xs"
        style="background:#fffbeb;border:1px solid #fde68a;color:#92400e"
      >
        <p class="font-semibold uppercase tracking-wide text-[10px] mb-0.5">Obs. da triagem</p>
        {{ triagem.observacoes ?? triagem.obs }}
      </div>
    </div>

    <!-- Motivo -->
    <div v-if="agendamento.motivo">
      <p class="text-[10px] uppercase tracking-wider font-semibold mb-1" style="color:#94a3b8">Motivo</p>
      <p class="text-sm text-[var(--color-text)] leading-relaxed">{{ agendamento.motivo }}</p>
    </div>

    <!-- Dados de contato -->
    <div class="space-y-2">
      <p class="text-[10px] uppercase tracking-wider font-semibold" style="color:#94a3b8">Identificação</p>
      <div class="space-y-1.5 text-sm">
        <div class="flex items-center gap-2">
          <IdCard :size="13" style="color:#94a3b8" class="shrink-0" />
          <span class="font-mono text-[var(--color-text)]">{{ paciente?.cpf ? formatarCPF(paciente.cpf) : '—' }}</span>
        </div>
        <div v-if="paciente?.sus_cartao" class="flex items-center gap-2">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded" style="background:#dbeafe;color:#1d4ed8">SUS</span>
          <span class="font-mono text-[var(--color-text)]">{{ paciente.sus_cartao }}</span>
        </div>
        <div v-if="paciente?.telefone" class="flex items-center gap-2">
          <Phone :size="13" style="color:#94a3b8" class="shrink-0" />
          <span class="text-[var(--color-text)]">{{ paciente.telefone }}</span>
        </div>
        <div v-if="paciente?.email" class="flex items-center gap-2 min-w-0">
          <Mail :size="13" style="color:#94a3b8" class="shrink-0" />
          <span class="text-[var(--color-text)] truncate">{{ paciente.email }}</span>
        </div>
      </div>
    </div>

    <!-- Histórico -->
    <div>
      <button
        type="button"
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
        style="background:#f8fafc;color:#475569"
        @click="toggleHistorico"
      >
        <span class="flex items-center gap-2">
          <History :size="14" />
          Consultas anteriores
        </span>
        <ChevronDown
          :size="16"
          class="transition-transform"
          :style="historicoAberto ? 'transform:rotate(180deg)' : ''"
        />
      </button>

      <div v-if="historicoAberto" class="mt-2 space-y-2">
        <div v-if="carregandoHist" class="py-3 text-center text-xs text-[var(--color-text-muted)]">
          Carregando…
        </div>
        <div
          v-else-if="consultasAnteriores.length === 0"
          class="py-3 text-center text-xs text-[var(--color-text-muted)]"
        >
          Sem registros anteriores.
        </div>
        <div
          v-for="c in consultasAnteriores"
          :key="c.id"
          class="rounded-lg border p-3 text-xs"
          style="border-color:#e2e8f0"
        >
          <div class="flex items-center gap-1.5 font-semibold text-[var(--color-text)] mb-1">
            <Calendar :size="11" style="color:#94a3b8" />
            {{ (c.agendamentos as any)?.data_consulta
              ? new Date((c.agendamentos as any).data_consulta).toLocaleDateString('pt-BR')
              : '—' }}
          </div>
          <p class="text-[var(--color-text-muted)] leading-relaxed">
            {{ c.evolucao ?? 'Sem evolução registrada.' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
