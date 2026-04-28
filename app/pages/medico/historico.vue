<script setup lang="ts">
import { Search, CalendarDays, Clock, ChevronLeft, ChevronRight, FileText, User } from 'lucide-vue-next'
import type { Consulta } from '~/types'

definePageMeta({ layout: 'medico', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const authStore = useAuthStore()

const consultas = ref<Consulta[]>([])
const total = ref(0)
const carregando = ref(true)
const busca = ref('')
const dataInicio = ref('')
const dataFim = ref('')
const pagina = ref(1)
const POR_PAGINA = 15

let debounce: ReturnType<typeof setTimeout>

async function carregar() {
  if (!authStore.medicoId) return
  carregando.value = true

  const from = (pagina.value - 1) * POR_PAGINA
  const to = from + POR_PAGINA - 1

  let q = supabase
    .from('consultas')
    .select('*, pacientes(nome, cpf, data_nascimento), agendamentos(data_consulta, motivo)', { count: 'exact' })
    .eq('medico_id', authStore.medicoId)
    .order('created_at', { ascending: false })

  if (dataInicio.value) q = q.gte('created_at', dataInicio.value)
  if (dataFim.value) q = q.lte('created_at', dataFim.value + 'T23:59:59')

  const { data, count } = await q.range(from, to)
  let resultado = (data ?? []) as Consulta[]

  if (busca.value.trim()) {
    const termo = busca.value.toLowerCase()
    resultado = resultado.filter(c =>
      ((c.pacientes as any)?.nome ?? '').toLowerCase().includes(termo)
    )
  }

  consultas.value = resultado
  total.value = count ?? 0
  carregando.value = false
}

const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

function definirPeriodo(p: 'hoje' | '7dias' | '30dias' | 'mes') {
  const hoje = new Date()
  dataFim.value = hoje.toISOString().slice(0, 10)
  if (p === 'hoje') dataInicio.value = hoje.toISOString().slice(0, 10)
  else if (p === '7dias') { const d = new Date(hoje); d.setDate(d.getDate() - 6); dataInicio.value = d.toISOString().slice(0, 10) }
  else if (p === '30dias') { const d = new Date(hoje); d.setDate(d.getDate() - 29); dataInicio.value = d.toISOString().slice(0, 10) }
  else if (p === 'mes') dataInicio.value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  pagina.value = 1
}

onMounted(() => {
  watch(() => authStore.medicoId, id => { if (id) carregar() }, { immediate: true })
})

watch([dataInicio, dataFim], () => { pagina.value = 1; carregar() })
watch(pagina, carregar)
watch(busca, () => { clearTimeout(debounce); debounce = setTimeout(() => { pagina.value = 1; carregar() }, 300) })

function formatarData(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('pt-BR')
}

function calcularIdade(dataNasc: string | null) {
  if (!dataNasc) return null
  const hoje = new Date(); const nasc = new Date(dataNasc)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  if (hoje.getMonth() - nasc.getMonth() < 0) idade--
  return idade
}

function formatarCPF(cpf: string) {
  return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? '—'
}

const paginasVisiveis = computed(() => {
  const t = totalPaginas.value; const atual = pagina.value
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
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 class="text-2xl font-bold" style="color:#0f172a">Histórico de Consultas</h1>
        <p class="text-sm mt-0.5" style="color:#64748b">
          {{ carregando ? '…' : `${total} consulta${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}` }}
        </p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border p-4 space-y-4" style="border-color:#e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.05)">
      <!-- Busca -->
      <div class="relative">
        <Search :size="15" class="absolute left-3.5 top-1/2 -translate-y-1/2" style="color:#94a3b8" />
        <input
          v-model="busca"
          placeholder="Buscar por nome do paciente..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
          style="border-color:#e2e8f0;background:#f8fafc"
        />
      </div>

      <!-- Chips de período -->
      <div class="flex flex-wrap items-center gap-2">
        <CalendarDays :size="14" style="color:#94a3b8" class="shrink-0" />
        <span class="text-xs font-semibold shrink-0" style="color:#64748b">Período:</span>
        <button
          v-for="p in [{ v: 'hoje', l: 'Hoje' }, { v: '7dias', l: '7 dias' }, { v: '30dias', l: '30 dias' }, { v: 'mes', l: 'Este mês' }]"
          :key="p.v"
          type="button"
          class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
          style="background:white;color:#64748b;border-color:#e2e8f0"
          @click="definirPeriodo(p.v as any)"
        >{{ p.l }}</button>
        <div class="flex items-center gap-1.5 ml-auto">
          <input v-model="dataInicio" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:#e2e8f0;background:#f8fafc" />
          <span class="text-xs" style="color:#94a3b8">até</span>
          <input v-model="dataFim" type="date" class="rounded-xl border px-3 py-1.5 text-xs outline-none" style="border-color:#e2e8f0;background:#f8fafc" />
        </div>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="carregando" class="space-y-3">
      <div v-for="n in 6" :key="n" class="h-24 rounded-2xl animate-pulse" style="background:#f1f5f9" />
    </div>

    <!-- Vazio -->
    <div v-else-if="consultas.length === 0"
         class="bg-white rounded-2xl border py-16 text-center"
         style="border-color:#e2e8f0">
      <FileText :size="40" class="mx-auto mb-3" style="color:#cbd5e1" />
      <p class="font-semibold" style="color:#0f172a">Nenhuma consulta encontrada</p>
      <p class="text-sm mt-1" style="color:#64748b">Tente ajustar os filtros de busca</p>
    </div>

    <!-- Lista -->
    <div v-else class="space-y-3">
      <div
        v-for="c in consultas"
        :key="c.id"
        class="bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow"
        style="border-color:#e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.04)"
      >
        <div class="flex items-start justify-between gap-3">
          <!-- Paciente -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                 style="background:linear-gradient(135deg,#ecfdf5,#dbeafe)">
              <User :size="18" style="color:#059669" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-sm truncate" style="color:#0f172a">{{ (c.pacientes as any)?.nome }}</p>
              <p class="text-xs mt-0.5" style="color:#64748b">
                CPF: {{ formatarCPF((c.pacientes as any)?.cpf ?? '') }}
                <span v-if="calcularIdade((c.pacientes as any)?.data_nascimento)">
                  · {{ calcularIdade((c.pacientes as any)?.data_nascimento) }} anos
                </span>
              </p>
            </div>
          </div>

          <!-- Data + duração -->
          <div class="text-right shrink-0">
            <p class="text-sm font-semibold" style="color:#0f172a">
              {{ formatarData((c.agendamentos as any)?.data_consulta) }}
            </p>
            <div v-if="c.duracao_minutos" class="flex items-center justify-end gap-1 mt-0.5">
              <Clock :size="11" style="color:#94a3b8" />
              <span class="text-xs" style="color:#64748b">{{ c.duracao_minutos }} min</span>
            </div>
          </div>
        </div>

        <!-- Motivo -->
        <div v-if="(c.agendamentos as any)?.motivo"
             class="mt-3 text-xs px-3 py-2 rounded-lg"
             style="background:#f8fafc;color:#475569;border:1px solid #f1f5f9">
          <span class="font-semibold" style="color:#059669">Motivo:</span>
          {{ (c.agendamentos as any).motivo }}
        </div>

        <!-- Evolução -->
        <div v-if="c.evolucao"
             class="mt-2 text-sm px-3 py-2.5 rounded-xl"
             style="background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #d1fae5">
          <p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color:#059669">Evolução clínica</p>
          <p style="color:#0f172a;line-height:1.6">{{ c.evolucao }}</p>
        </div>
      </div>
    </div>

    <!-- Paginação -->
    <div v-if="totalPaginas > 1" class="flex items-center justify-center gap-1 pt-2">
      <button
        :disabled="pagina === 1"
        class="p-2 rounded-lg transition-colors disabled:opacity-30"
        style="color:#64748b"
        @click="pagina--"
      ><ChevronLeft :size="16" /></button>

      <template v-for="p in paginasVisiveis" :key="p">
        <span v-if="p === '...'" class="px-2 text-sm" style="color:#94a3b8">…</span>
        <button
          v-else
          class="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
          :style="pagina === p
            ? 'background:#059669;color:white'
            : 'color:#64748b;hover:background:#f1f5f9'"
          @click="pagina = p as number"
        >{{ p }}</button>
      </template>

      <button
        :disabled="pagina === totalPaginas"
        class="p-2 rounded-lg transition-colors disabled:opacity-30"
        style="color:#64748b"
        @click="pagina++"
      ><ChevronRight :size="16" /></button>
    </div>
  </div>
</template>

