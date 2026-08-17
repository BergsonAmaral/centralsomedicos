<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useFila } from '~/composables/useFila'

definePageMeta({ layout: 'atendente', middleware: ['auth', 'role'] })

const authStore = useAuthStore()
const fila = useFila()

onMounted(async () => {
  await fila.carregar()
  fila.subscrever()
})
onUnmounted(() => fila.desinscrever())
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Fila de Espera</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">
        {{ authStore.atendenteData?.unidades?.nome ?? 'Sua unidade' }} · {{ new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}
      </p>
    </div>

    <AdminFilaColunas :unidade-filtro="authStore.atendenteUnidadeId" />
  </div>
</template>
