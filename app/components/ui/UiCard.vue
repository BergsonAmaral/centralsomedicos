<script setup lang="ts">
interface Props {
  highlighted?: 'blue' | 'green' | false
  noPadding?: boolean
}

withDefaults(defineProps<Props>(), {
  highlighted: false,
  noPadding: false,
})
</script>

<template>
  <div
    :class="[
      'card',
      highlighted === 'blue' ? 'border-[var(--color-blue)] shadow-[var(--shadow-md)]' : '',
      highlighted === 'green' ? 'border-[var(--color-green)] shadow-[var(--shadow-md)]' : '',
    ]"
  >
    <div
      v-if="$slots.header"
      class="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between"
    >
      <slot name="header" />
    </div>
    <div :class="noPadding ? '' : 'p-5'">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="px-5 py-4 border-t border-[var(--color-border-light)] flex items-center justify-between"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
