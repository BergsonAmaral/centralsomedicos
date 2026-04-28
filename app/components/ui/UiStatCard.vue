<script setup lang="ts">
interface Props {
  icon?: object
  iconColor?: string
  iconBg?: string
  value: number | string
  label: string
  delta?: number | null
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  iconColor: 'text-[var(--color-blue)]',
  iconBg: 'bg-[var(--color-blue-pale)]',
  delta: null,
  loading: false,
})
</script>

<template>
  <div class="bg-white rounded-2xl border p-5 flex items-start gap-4" style="border-color:#e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.06)">
    <div
      v-if="icon"
      :class="['w-11 h-11 rounded-xl flex items-center justify-center shrink-0', iconBg]"
    >
      <component :is="icon" :size="20" :class="iconColor" />
    </div>

    <div class="flex-1 min-w-0">
      <p class="text-xs font-semibold uppercase tracking-wide truncate" style="color:#94a3b8">{{ label }}</p>

      <div v-if="loading" class="h-7 w-16 bg-slate-100 rounded-lg animate-pulse mt-1.5" />
      <p v-else class="text-2xl font-bold leading-tight mt-1" style="color:#0f172a">
        {{ value }}
      </p>

      <p
        v-if="delta !== null && delta !== undefined"
        :class="['text-xs font-semibold mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full', delta >= 0 ? 'text-emerald-700' : 'text-red-600']"
        :style="delta >= 0 ? 'background:#ecfdf5' : 'background:#fef2f2'"
      >
        {{ delta >= 0 ? '↑' : '↓' }} {{ Math.abs(delta) }}% vs ontem
      </p>
    </div>
  </div>
</template>
