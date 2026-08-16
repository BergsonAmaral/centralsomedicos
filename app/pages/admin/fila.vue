<script setup lang="ts">
import { Filter, LayoutGrid, CalendarRange } from 'lucide-vue-next'
import { useFila } from '~/composables/useFila'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const fila = useFila()

// Filtros por médico e por unidade (compartilhados entre as duas views)
const medicos = ref<{ id: string; nome: string }[]>([])
const medicoFiltro = ref<string>('')

const unidades = ref<{ id: string; nome: string }[]>([])
const unidadeFiltro = ref<string>('')

// View
const view = ref<'hoje' | 'agenda'>('hoje')

onMounted(async () => {
  const [{ data: mData }, { data: uData }] = await Promise.all([
    supabase.from('medicos').select('id, nome').eq('ativo', true),
    supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome'),
  ])
  medicos.value = mData ?? []
  unidades.value = uData ?? []

  await fila.carregar(medicoFiltro.value || null)
  fila.subscrever(medicoFiltro.value || null)
})

onUnmounted(() => fila.desinscrever())

watch(medicoFiltro, async (val) => {
  fila.desinscrever()
  await fila.carregar(val || null)
  fila.subscrever(val || null)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Agenda & Fila</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          {{ new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}
        </p>
      </div>

      <!-- Filtros por médico e unidade -->
      <div class="flex flex-wrap items-center gap-2">
        <Filter :size="16" class="text-[var(--color-text-muted)]" />
        <select
          v-model="unidadeFiltro"
          class="input-base py-2 text-sm max-w-xs"
        >
          <option value="">Todas as unidades</option>
          <option v-for="u in unidades" :key="u.id" :value="u.id">{{ u.nome }}</option>
        </select>
        <select
          v-model="medicoFiltro"
          class="input-base py-2 text-sm max-w-xs"
        >
          <option value="">Todos os médicos</option>
          <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }}</option>
        </select>
      </div>
    </div>

    <!-- Tabs -->
    <div class="inline-flex rounded-lg p-1" style="background:#f1f5f9;border:1px solid var(--color-border-light)">
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors"
        :class="view === 'hoje'
          ? 'bg-white text-[var(--color-text)] shadow-sm'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
        @click="view = 'hoje'"
      >
        <LayoutGrid :size="14" /> Fila de hoje
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors"
        :class="view === 'agenda'
          ? 'bg-white text-[var(--color-text)] shadow-sm'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
        @click="view = 'agenda'"
      >
        <CalendarRange :size="14" /> Agenda completa
      </button>
    </div>

    <!-- Conteúdo -->
    <AdminFilaColunas v-if="view === 'hoje'" :medico-filtro="medicoFiltro || null" :unidade-filtro="unidadeFiltro || null" />
    <AdminAgendaCompleta v-else :medico-filtro="medicoFiltro || null" :unidade-filtro="unidadeFiltro || null" />
  </div>
</template>
