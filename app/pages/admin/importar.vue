<script setup lang="ts">
import { UserPlus, Upload, User } from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const aba = ref<'importar' | 'manual'>('importar')
const cadastroModal = ref(false)
const ultimoCadastrado = ref<{ nome: string } | null>(null)

function onCriado(p: { id: string; nome: string }) {
  ultimoCadastrado.value = { nome: p.nome }
  setTimeout(() => { ultimoCadastrado.value = null }, 4000)
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">

    <!-- Cabeçalho -->
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Cadastro de Pacientes</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">
        Importe em lote pela planilha do SUS ou cadastre pacientes individualmente.
      </p>
    </div>

    <!-- Abas -->
    <div class="flex gap-1 p-1 rounded-xl" style="background:var(--color-surface-2);width:fit-content">
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        :class="aba === 'importar'
          ? 'bg-white shadow text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
        @click="aba = 'importar'"
      >
        <Upload :size="15" />
        Importar SUS
      </button>
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        :class="aba === 'manual'
          ? 'bg-white shadow text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
        @click="aba = 'manual'"
      >
        <UserPlus :size="15" />
        Cadastro Manual
      </button>
    </div>

    <!-- Aba: Importar SUS -->
    <AdminImportSus v-if="aba === 'importar'" />

    <!-- Aba: Cadastro Manual -->
    <template v-else>
      <!-- Toast sucesso -->
      <div
        v-if="ultimoCadastrado"
        class="rounded-lg px-4 py-3 flex items-center gap-2 text-sm"
        style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0"
      >
        <UserPlus :size="16" />
        <span><strong>{{ ultimoCadastrado.nome }}</strong> cadastrado com sucesso.</span>
      </div>

      <!-- Card cadastro -->
      <div class="card p-10 text-center space-y-5">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style="background:#dbeafe">
          <User :size="28" style="color:#2563eb" />
        </div>
        <div>
          <h2 class="font-semibold text-lg text-[var(--color-text)]">Cadastro individual</h2>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">
            Cadastre um paciente por vez com todos os dados necessários.
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
          style="background:#2563eb;color:white"
          @click="cadastroModal = true"
        >
          <UserPlus :size="16" />
          Novo Paciente
        </button>
      </div>
    </template>

    <AdminCadastroPacienteModal
      v-if="cadastroModal"
      @close="cadastroModal = false"
      @criado="onCriado"
    />
  </div>
</template>
