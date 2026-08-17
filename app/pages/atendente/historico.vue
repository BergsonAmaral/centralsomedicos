<script setup lang="ts">
definePageMeta({ layout: 'atendente', middleware: ['auth', 'role'] })
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Histórico</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">Agendamentos e atendimentos da sua unidade.</p>
    </div>

    <!-- RLS já restringe os agendamentos aos pacientes da unidade do atendente -->
    <AdminAgendaCompleta />
  </div>
</template>
