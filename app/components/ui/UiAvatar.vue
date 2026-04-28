<script setup lang="ts">
interface Props {
  src?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'pausado' | 'em_consulta' | null
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  status: null,
})

const sizeMap = {
  xs: { container: 'w-7 h-7 text-xs', dot: 'w-2 h-2' },
  sm: { container: 'w-9 h-9 text-sm', dot: 'w-2.5 h-2.5' },
  md: { container: 'w-11 h-11 text-base', dot: 'w-3 h-3' },
  lg: { container: 'w-14 h-14 text-lg', dot: 'w-3.5 h-3.5' },
  xl: { container: 'w-20 h-20 text-2xl', dot: 'w-4 h-4' },
}

const dotColorMap = {
  online: 'bg-[var(--color-green-light)]',
  em_consulta: 'bg-[var(--color-green-light)] animate-pulse-dot',
  pausado: 'bg-[var(--color-warning)]',
  offline: 'bg-[var(--color-text-dim)]',
}

const initials = computed(() => {
  if (!props.name) return '?'
  return props.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
})

const sizes = computed(() => sizeMap[props.size])
</script>

<template>
  <div class="relative inline-flex shrink-0">
    <div
      :class="[
        'rounded-full overflow-hidden flex items-center justify-center font-bold text-white bg-[var(--color-blue)] select-none',
        sizes.container,
      ]"
    >
      <img
        v-if="src"
        :src="src"
        :alt="name"
        class="w-full h-full object-cover"
      />
      <span v-else>{{ initials }}</span>
    </div>

    <!-- Indicador de status -->
    <span
      v-if="status"
      :class="[
        'absolute bottom-0 right-0 rounded-full border-2 border-[var(--color-surface)]',
        sizes.dot,
        dotColorMap[status],
      ]"
    />
  </div>
</template>
