<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'success' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
})

const styles = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-lg cursor-pointer border transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-blue)] disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:
      'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm active:scale-[0.98]',
    success:
      'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm active:scale-[0.98]',
    secondary:
      'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 active:scale-[0.98]',
    ghost:
      'bg-transparent text-[var(--color-text-muted)] border-transparent hover:bg-slate-100 hover:text-[var(--color-text)]',
    danger:
      'bg-red-600 text-white border-transparent hover:bg-red-700 shadow-sm active:scale-[0.98]',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return [base, variants[props.variant], sizes[props.size]].join(' ')
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="styles"
  >
    <span
      v-if="loading"
      class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
    />
    <slot />
  </button>
</template>
