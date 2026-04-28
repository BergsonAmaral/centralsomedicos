<script setup lang="ts">
import { ChevronUp, ChevronDown, Search } from 'lucide-vue-next'

interface Column {
  key: string
  label: string
  sortable?: boolean
  width?: string
}

interface Props {
  columns: Column[]
  rows: Record<string, unknown>[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  perPage?: number
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  searchable: false,
  searchPlaceholder: 'Buscar...',
  perPage: 20,
  emptyText: 'Nenhum registro encontrado.',
})

const emit = defineEmits<{
  rowClick: [row: Record<string, unknown>]
}>()

const search = ref('')
const sortKey = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)

const filtered = computed(() => {
  let data = [...props.rows]
  if (props.searchable && search.value.trim()) {
    const q = search.value.toLowerCase()
    data = data.filter((r) =>
      Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q))
    )
  }
  if (sortKey.value) {
    data.sort((a, b) => {
      const va = String(a[sortKey.value] ?? '')
      const vb = String(b[sortKey.value] ?? '')
      return sortDir.value === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }
  return data
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / props.perPage)))

const paginated = computed(() => {
  const start = (page.value - 1) * props.perPage
  return filtered.value.slice(start, start + props.perPage)
})

function setSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

watch(search, () => { page.value = 1 })
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Busca -->
    <div v-if="searchable" class="relative max-w-xs">
      <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
      <input
        v-model="search"
        :placeholder="searchPlaceholder"
        class="input-base pl-9 py-2 text-sm"
      />
    </div>

    <!-- Tabela -->
    <div class="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table class="w-full border-collapse">
        <thead>
          <tr class="table-header-row">
            <th
              v-for="col in columns"
              :key="col.key"
              :style="col.width ? `width:${col.width}` : ''"
              class="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap"
              :class="col.sortable ? 'cursor-pointer select-none hover:text-[var(--color-text)]' : ''"
              @click="col.sortable ? setSort(col.key) : undefined"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <span v-if="col.sortable && sortKey === col.key">
                  <ChevronUp v-if="sortDir === 'asc'" :size="12" />
                  <ChevronDown v-else :size="12" />
                </span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          <!-- Skeleton -->
          <template v-if="loading">
            <tr v-for="n in 5" :key="n" class="border-t border-[var(--color-border-light)]">
              <td v-for="col in columns" :key="col.key" class="px-4 py-3">
                <div class="h-4 bg-[var(--color-surface-2)] rounded animate-pulse" />
              </td>
            </tr>
          </template>

          <!-- Dados -->
          <template v-else-if="paginated.length">
            <tr
              v-for="(row, i) in paginated"
              :key="i"
              class="border-t border-[var(--color-border-light)] table-row-hover"
              @click="emit('rowClick', row)"
            >
              <td v-for="col in columns" :key="col.key" class="px-4 py-3 text-sm text-[var(--color-text)]">
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                  {{ row[col.key] ?? '—' }}
                </slot>
              </td>
            </tr>
          </template>

          <!-- Vazio -->
          <tr v-else>
            <td :colspan="columns.length" class="px-4 py-10 text-center text-[var(--color-text-dim)] text-sm">
              {{ emptyText }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginação -->
    <div v-if="!loading && totalPages > 1" class="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
      <span>{{ filtered.length }} registros</span>
      <div class="flex items-center gap-1">
        <button
          :disabled="page <= 1"
          class="px-2 py-1 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          @click="page--"
        >
          ‹
        </button>
        <span class="px-3">{{ page }} / {{ totalPages }}</span>
        <button
          :disabled="page >= totalPages"
          class="px-2 py-1 rounded hover:bg-[var(--color-surface-2)] disabled:opacity-40"
          @click="page++"
        >
          ›
        </button>
      </div>
    </div>
  </div>
</template>
