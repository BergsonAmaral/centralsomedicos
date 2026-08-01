<script setup lang="ts">
import {
  Users2, ClipboardList, Activity, FileText,
  Stethoscope, Clock, CheckCircle2, XCircle,
} from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const hoje = new Date().toISOString().split('T')[0]
const carregando = ref(true)
let channel: ReturnType<typeof supabase.channel> | null = null

const stats = ref({
  filaAgora: 0,
  emConsulta: 0,
  concluidosHoje: 0,
  faltaramHoje: 0,
  medicosAtivos: 0,
  totalMedicos: 0,
  docsPendentes: 0,
})

const medicosStatus = ref<{
  id: string
  nome: string
  especialidade: string
  foto_url: string | null
  pausado: boolean
  emConsulta: boolean
}[]>([])

async function carregar() {
  carregando.value = true

  const [agResult, medicosResult, docsResult] = await Promise.all([
    supabase.from('agendamentos').select('status, medico_id').eq('data_consulta', hoje),
    supabase.from('medicos').select('id, nome, especialidade, foto_url, pausado, ativo').eq('ativo', true),
    supabase.from('documentos').select('id').eq('status', 'gerado'),
  ])

  const ags = agResult.data ?? []
  const meds = medicosResult.data ?? []

  stats.value = {
    filaAgora: ags.filter((a) => a.status === 'checkin').length,
    emConsulta: ags.filter((a) => a.status === 'em_consulta').length,
    concluidosHoje: ags.filter((a) => a.status === 'concluido').length,
    faltaramHoje: ags.filter((a) => a.status === 'faltou').length,
    medicosAtivos: meds.length,
    totalMedicos: meds.length,
    docsPendentes: (docsResult.data ?? []).length,
  }

  const emConsultaIds = new Set(
    ags.filter((a) => a.status === 'em_consulta').map((a) => a.medico_id)
  )

  medicosStatus.value = meds.map((m) => ({
    id: m.id,
    nome: m.nome,
    especialidade: m.especialidade,
    foto_url: m.foto_url,
    pausado: m.pausado,
    emConsulta: emConsultaIds.has(m.id),
  }))

  carregando.value = false
}

onMounted(() => {
  carregar()
  channel = supabase.channel('dashboard-realtime')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agendamentos' }, carregar)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documentos' }, carregar)
    .subscribe()
})

onUnmounted(() => {
  if (channel) supabase.removeChannel(channel)
})

function statusMedico(m: typeof medicosStatus.value[0]): 'em_consulta' | 'pausado' | 'online' {
  if (m.emConsulta) return 'em_consulta'
  if (m.pausado) return 'pausado'
  return 'online'
}

// Contador animado
const displayed = ref({ filaAgora: 0, emConsulta: 0, concluidosHoje: 0, faltaramHoje: 0, docsPendentes: 0 })

function animateCounter(key: keyof typeof displayed.value, target: number) {
  const duration = 600
  const start = displayed.value[key]
  const diff = target - start
  if (diff === 0) return
  const startTime = performance.now()
  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    displayed.value[key] = Math.round(start + diff * ease)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

watch(stats, (val) => {
  animateCounter('filaAgora', val.filaAgora)
  animateCounter('emConsulta', val.emConsulta)
  animateCounter('concluidosHoje', val.concluidosHoje)
  animateCounter('faltaramHoje', val.faltaramHoje)
  animateCounter('docsPendentes', val.docsPendentes)
}, { deep: true })


</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Visão Geral</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1 capitalize">
          {{ new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}
        </p>
      </div>
      <NuxtLink
        to="/admin/fila"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style="background:#1e4d9a;color:white"
      >
        <ClipboardList :size="16" />
        Atendimentos
      </NuxtLink>
    </div>

    <!-- KPIs principais (hero) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Fila -->
      <div class="rounded-2xl p-5 relative overflow-hidden stagger-1" style="background:linear-gradient(135deg,#1a3678 0%,#1e4d9a 60%,#163c7d 100%);box-shadow:0 4px 20px rgba(30,77,154,0.28),0 1px 4px rgba(0,0,0,0.08)">
        <div class="absolute -right-5 -top-5 w-28 h-28 rounded-full" style="background:rgba(255,255,255,0.06)" />
        <div class="absolute right-2 -bottom-6 w-16 h-16 rounded-full" style="background:rgba(45,170,138,0.12)" />
        <div class="flex items-center justify-between mb-4 relative">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:rgba(255,255,255,0.18)">
            <ClipboardList :size="18" style="color:white" />
          </div>
          <span class="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style="background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9)">agora</span>
        </div>
        <p class="text-4xl font-extrabold tabular-nums text-white leading-none relative">{{ carregando ? '—' : displayed.filaAgora }}</p>
        <p class="text-xs mt-2 relative" style="color:rgba(255,255,255,0.65)">Pacientes na fila</p>
      </div>

      <!-- Em consulta -->
      <div class="rounded-2xl p-5 bg-white relative overflow-hidden transition-all hover:-translate-y-px stagger-2" style="border:1px solid #d1fae5;box-shadow:0 2px 8px rgba(22,163,74,0.1),0 1px 3px rgba(0,0,0,0.04)">
        <div class="absolute -right-4 -top-4 w-20 h-20 rounded-full" style="background:rgba(22,163,74,0.05)" />
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:#dcfce7">
            <Activity :size="18" style="color:#16a34a" />
          </div>
          <span class="w-2.5 h-2.5 rounded-full animate-pulse" style="background:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,0.15)" />
        </div>
        <p class="text-4xl font-extrabold tabular-nums leading-none" style="color:var(--color-text)">{{ carregando ? '—' : displayed.emConsulta }}</p>
        <p class="text-xs mt-2" style="color:var(--color-text-muted)">Em consulta</p>
      </div>

      <!-- Concluídos -->
      <div class="rounded-2xl p-5 bg-white relative overflow-hidden transition-all hover:-translate-y-px stagger-3" style="border:1px solid #bae6fd;box-shadow:0 2px 8px rgba(8,145,178,0.08),0 1px 3px rgba(0,0,0,0.04)">
        <div class="absolute -right-4 -top-4 w-20 h-20 rounded-full" style="background:rgba(8,145,178,0.05)" />
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:#e0f2fe">
            <CheckCircle2 :size="18" style="color:#0891b2" />
          </div>
          <span class="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style="background:#f0f9ff;color:#0891b2">hoje</span>
        </div>
        <p class="text-4xl font-extrabold tabular-nums leading-none" style="color:var(--color-text)">{{ carregando ? '—' : displayed.concluidosHoje }}</p>
        <p class="text-xs mt-2" style="color:var(--color-text-muted)">Concluídos</p>
      </div>

      <!-- Faltaram -->
      <div class="rounded-2xl p-5 bg-white relative overflow-hidden transition-all hover:-translate-y-px stagger-4" style="border:1px solid #fecdd3;box-shadow:0 2px 8px rgba(220,38,38,0.08),0 1px 3px rgba(0,0,0,0.04)">
        <div class="absolute -right-4 -top-4 w-20 h-20 rounded-full" style="background:rgba(220,38,38,0.05)" />
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:#fee2e2">
            <XCircle :size="18" style="color:#dc2626" />
          </div>
          <span class="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style="background:#fff1f2;color:#dc2626">hoje</span>
        </div>
        <p class="text-4xl font-extrabold tabular-nums leading-none" style="color:var(--color-text)">{{ carregando ? '—' : displayed.faltaramHoje }}</p>
        <p class="text-xs mt-2" style="color:var(--color-text-muted)">Faltas</p>
      </div>
    </div>

    <!-- Cards secundários -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

      <!-- Status médicos (ocupa 2 colunas) -->
      <div class="lg:col-span-2 bg-white rounded-2xl border" style="border-color:var(--color-border);box-shadow:0 1px 3px rgba(15,23,42,0.04),0 4px 12px rgba(15,23,42,0.03)">
        <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid var(--color-border-light)">
          <div>
            <h2 class="font-semibold text-[var(--color-text)]">Médicos online</h2>
            <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{{ stats.medicosAtivos }} ativos no momento</p>
          </div>
          <NuxtLink to="/admin/medicos" class="text-sm font-medium" style="color:#2563eb">
            Ver todos →
          </NuxtLink>
        </div>

        <div v-if="carregando" class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div v-for="n in 4" :key="n" class="h-14 rounded-xl animate-shimmer" />
        </div>

        <div v-else-if="medicosStatus.length === 0" class="p-10 text-center text-sm text-[var(--color-text-muted)]">
          Nenhum médico cadastrado
        </div>

        <div v-else class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
          <div
            v-for="m in medicosStatus"
            :key="m.id"
            class="flex items-center gap-3 p-2.5 rounded-lg transition-colors"
            style="background:transparent"
            @mouseenter="($event.currentTarget as HTMLElement).style.background='var(--color-surface-2)'"
            @mouseleave="($event.currentTarget as HTMLElement).style.background='transparent'"
          >
            <UiAvatar :src="m.foto_url" :name="m.nome" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-[var(--color-text)] text-sm truncate">{{ m.nome }}</p>
              <p class="text-xs text-[var(--color-text-muted)] truncate">{{ m.especialidade }}</p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
              :style="m.emConsulta
                ? 'background:#dbeafe;color:#1d4ed8'
                : m.pausado
                ? 'background:#fef9c3;color:#a16207'
                : 'background:#dcfce7;color:#16a34a'"
            >
              <span class="w-1.5 h-1.5 rounded-full" :style="`background:${m.emConsulta ? '#1d4ed8' : m.pausado ? '#a16207' : '#16a34a'}`" />
              {{ m.emConsulta ? 'Consulta' : m.pausado ? 'Pausa' : 'Online' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Card lateral: Documentos pendentes + atalhos -->
      <div class="space-y-4">
        <!-- Doc pendentes -->
        <div class="bg-white rounded-2xl border p-5 relative overflow-hidden" style="border-color:var(--color-border);box-shadow:0 1px 3px rgba(15,23,42,0.04),0 4px 12px rgba(15,23,42,0.03)">
          <div class="absolute -right-4 -top-4 w-20 h-20 rounded-full" style="background:rgba(217,119,6,0.05)" />
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold uppercase tracking-wider" style="color:var(--color-text-muted)">Documentos</p>
            <FileText :size="16" style="color:#a16207" />
          </div>
          <p class="text-3xl font-bold text-[var(--color-text)]">{{ carregando ? '—' : displayed.docsPendentes }}</p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">aguardando envio</p>
          <NuxtLink
            to="/admin/documentos"
            class="block w-full mt-3 px-3 py-2 rounded-lg text-xs font-medium text-center transition-colors"
            style="background:#fef3c7;color:#a16207"
          >
            Revisar agora
          </NuxtLink>
        </div>

        <!-- Atalhos -->
        <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border);box-shadow:0 1px 3px rgba(15,23,42,0.04),0 4px 12px rgba(15,23,42,0.03)">
          <p class="text-xs font-semibold uppercase tracking-wider px-5 pt-4 pb-2" style="color:var(--color-text-muted)">Atalhos</p>
          <NuxtLink
            v-for="link in [
              { to: '/admin/importar', label: 'Importar SUS', icon: Users2 },
              { to: '/admin/medicos', label: 'Cadastrar médico', icon: Stethoscope },
              { to: '/admin/relatorios', label: 'Ver relatórios', icon: Activity },
            ]"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors"
            style="color:var(--color-text)"
            @mouseenter="($event.currentTarget as HTMLElement).style.background='var(--color-surface-2)'"
            @mouseleave="($event.currentTarget as HTMLElement).style.background='transparent'"
          >
            <component :is="link.icon" :size="15" style="color:var(--color-text-muted)" />
            <span class="flex-1">{{ link.label }}</span>
            <span style="color:var(--color-text-dim)">→</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
