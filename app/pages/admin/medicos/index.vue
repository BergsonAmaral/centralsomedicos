<script setup lang="ts">
import { Plus, Search, Pencil, Power, Stethoscope } from 'lucide-vue-next'
import type { Medico } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const medicos = ref<Medico[]>([])
const carregando = ref(true)
const busca = ref('')
const filtroStatus = ref<'todos' | 'ativos' | 'pausados' | 'inativos'>('todos')

async function carregar() {
  carregando.value = true
  const { data } = await supabase.from('medicos').select('*').order('nome')
  medicos.value = data ?? []
  carregando.value = false
}

onMounted(carregar)

async function alternarStatus(m: Medico) {
  const novoAtivo = !m.ativo
  await supabase.from('medicos').update({ ativo: novoAtivo }).eq('id', m.id)
  try {
    await useAdminLog().registrar(novoAtivo ? 'medico_ativado' : 'medico_pausado', {
      entidade: 'medico',
      entidadeId: m.id,
      detalhes: { nome: m.nome },
    })
  } catch {}
  await carregar()
}

const filtrados = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return medicos.value.filter((m) => {
    if (filtroStatus.value === 'ativos' && !(m.ativo && !m.pausado)) return false
    if (filtroStatus.value === 'pausados' && !m.pausado) return false
    if (filtroStatus.value === 'inativos' && m.ativo) return false
    if (!q) return true
    return (
      m.nome?.toLowerCase().includes(q) ||
      m.crm?.toLowerCase().includes(q) ||
      m.especialidade?.toLowerCase().includes(q)
    )
  })
})

const stats = computed(() => ({
  total: medicos.value.length,
  ativos: medicos.value.filter((m) => m.ativo && !m.pausado).length,
  pausados: medicos.value.filter((m) => m.pausado).length,
  inativos: medicos.value.filter((m) => !m.ativo).length,
}))

function statusInfo(m: Medico) {
  if (!m.ativo) return { label: 'Inativo', bg: '#f1f5f9', cor: '#64748b', dot: '#94a3b8' }
  if (m.pausado) return { label: 'Pausado', bg: '#fef9c3', cor: '#a16207', dot: '#ca8a04' }
  return { label: 'Ativo', bg: '#dcfce7', cor: '#166534', dot: '#16a34a' }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Médicos</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          {{ stats.total }} {{ stats.total === 1 ? 'profissional cadastrado' : 'profissionais cadastrados' }}
        </p>
      </div>
      <UiButton variant="primary" @click="navigateTo('/admin/medicos/novo')">
        <Plus :size="16" /> Novo Médico
      </UiButton>
    </div>

    <!-- Toolbar: busca + filtros -->
    <div class="bg-white rounded-xl border p-3 flex flex-col sm:flex-row gap-2" style="border-color:var(--color-border)">
      <div class="relative flex-1">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2" style="color:var(--color-text-muted)" />
        <input
          v-model="busca"
          type="text"
          placeholder="Buscar por nome, CRM ou especialidade..."
          class="w-full pl-9 pr-3 py-2 rounded-lg text-sm border"
          style="border-color:var(--color-border);background:var(--color-surface-2)"
        >
      </div>
      <div class="flex gap-1 p-1 rounded-lg" style="background:var(--color-surface-2)">
        <button
          v-for="f in [
            { v: 'todos', label: 'Todos', count: stats.total },
            { v: 'ativos', label: 'Ativos', count: stats.ativos },
            { v: 'pausados', label: 'Pausados', count: stats.pausados },
            { v: 'inativos', label: 'Inativos', count: stats.inativos },
          ]"
          :key="f.v"
          class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          :style="filtroStatus === f.v
            ? 'background:white;color:var(--color-text);box-shadow:0 1px 2px rgba(0,0,0,0.05)'
            : 'background:transparent;color:var(--color-text-muted)'"
          @click="filtroStatus = f.v as typeof filtroStatus"
        >
          {{ f.label }} <span class="opacity-60">{{ f.count }}</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="carregando" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="n in 6" :key="n" class="h-44 rounded-xl animate-pulse" style="background:var(--color-surface-2)" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="filtrados.length === 0"
      class="bg-white rounded-xl border py-16 text-center"
      style="border-color:var(--color-border)"
    >
      <Stethoscope :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
      <p class="text-[var(--color-text-muted)] text-sm">
        {{ busca ? 'Nenhum médico encontrado para sua busca' : 'Nenhum médico cadastrado' }}
      </p>
      <UiButton v-if="!busca" variant="primary" class="mt-4" @click="navigateTo('/admin/medicos/novo')">
        <Plus :size="16" /> Cadastrar primeiro médico
      </UiButton>
    </div>

    <!-- Grid de cards -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="m in filtrados"
        :key="m.id"
        class="bg-white rounded-xl border overflow-hidden flex flex-col transition-all"
        style="border-color:var(--color-border)"
        @mouseenter="($event.currentTarget as HTMLElement).style.borderColor='#cbd5e1'"
        @mouseleave="($event.currentTarget as HTMLElement).style.borderColor='var(--color-border)'"
      >
        <!-- Header do card: avatar + status -->
        <div class="p-4 flex items-start gap-3" style="border-bottom:1px solid var(--color-border-light)">
          <UiAvatar :src="m.foto_url" :name="m.nome" size="md" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-[var(--color-text)] truncate">{{ m.nome }}</p>
            <p class="text-xs text-[var(--color-text-muted)] truncate">{{ m.especialidade || 'Sem especialidade' }}</p>
            <p class="text-[11px] mt-0.5" style="color:var(--color-text-dim)">CRM {{ m.crm || '—' }}</p>
          </div>
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
            :style="`background:${statusInfo(m).bg};color:${statusInfo(m).cor}`"
          >
            <span class="w-1.5 h-1.5 rounded-full" :style="`background:${statusInfo(m).dot}`" />
            {{ statusInfo(m).label }}
          </span>
        </div>

        <!-- Ações -->
        <div class="px-4 py-3 flex gap-2" style="border-top:1px solid var(--color-border-light);background:#fafbfc">
          <button
            class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style="background:#2563eb;color:white"
            @click="navigateTo(`/admin/medicos/${m.id}`)"
          >
            <Pencil :size="12" /> Editar
          </button>
          <button
            class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            :style="m.ativo
              ? 'border-color:#fecaca;color:#b91c1c;background:white'
              : 'border-color:#bbf7d0;color:#166534;background:white'"
            :title="m.ativo ? 'Desativar' : 'Reativar'"
            @click="alternarStatus(m)"
          >
            <Power :size="12" />
            {{ m.ativo ? 'Desativar' : 'Reativar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
