<script setup lang="ts">
interface Props {
  modelValue?: string | number
  label?: string
  placeholder?: string
  type?: string
  error?: string
  icon?: object
  disabled?: boolean
  readonly?: boolean
  mask?: 'cpf' | 'telefone' | 'data' | 'crm'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement>()

function applyMask(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (props.mask === 'cpf') {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  if (props.mask === 'telefone') {
    return digits
      .slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2')
  }
  if (props.mask === 'data') {
    return digits
      .slice(0, 8)
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2')
  }
  return value
}

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const masked = props.mask ? applyMask(raw) : raw
  if (inputRef.value) inputRef.value.value = masked
  emit('update:modelValue', masked)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <label
      v-if="label"
      class="text-sm font-medium text-[var(--color-text-muted)]"
    >
      {{ label }}
    </label>
    <div class="relative">
      <span
        v-if="icon"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] pointer-events-none"
      >
        <component :is="icon" :size="16" />
      </span>
      <input
        ref="inputRef"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :class="[
          'input-base',
          icon ? 'pl-9' : '',
          error ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.15)]' : '',
        ]"
        @input="onInput"
      />
    </div>
    <p v-if="error" class="text-xs text-[var(--color-danger)] mt-0.5">{{ error }}</p>
  </div>
</template>
