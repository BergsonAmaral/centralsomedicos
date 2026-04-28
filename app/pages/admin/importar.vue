<script setup lang="ts">
import { UserPlus, Upload } from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const cadastroModal = ref(false)
const ultimoCadastrado = ref<{ nome: string } | null>(null)

function onCriado(p: { id: string; nome: string }) {
  ultimoCadastrado.value = { nome: p.nome }
  setTimeout(() => { ultimoCadastrado.value = null }, 4000)
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Cadastro de pacientes</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          Importe a planilha do SUS ou cadastre manualmente quando necessário.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shrink-0"
        style="background:#2563eb;color:white"
        @click="cadastroModal = true"
      >
        <UserPlus :size="16" />
        Cadastrar manualmente
      </button>
    </div>

    <!-- Toast sucesso -->
    <div
      v-if="ultimoCadastrado"
      class="rounded-lg px-4 py-3 flex items-center gap-2 text-sm"
      style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0"
    >
      <UserPlus :size="16" />
      <span><strong>{{ ultimoCadastrado.nome }}</strong> cadastrado com sucesso.</span>
    </div>

    <!-- Card SUS -->
    <div class="bg-white rounded-xl border" style="border-color:var(--color-border)">
      <div class="px-5 py-4 flex items-center gap-3" style="border-bottom:1px solid var(--color-border-light)">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center" style="background:#ede9fe">
          <Upload :size="16" style="color:#7c3aed" />
        </div>
        <div>
          <h2 class="font-semibold text-[var(--color-text)]">Importação em lote (SUS)</h2>
          <p class="text-xs text-[var(--color-text-muted)]">
            Faça upload do arquivo CSV/Excel da agenda do SUS para cadastrar vários pacientes de uma vez.
          </p>
        </div>
      </div>
      <div class="p-5">
        <AdminImportSus />
      </div>
    </div>

    <AdminCadastroPacienteModal
      v-if="cadastroModal"
      @close="cadastroModal = false"
      @criado="onCriado"
    />
  </div>
</template>
