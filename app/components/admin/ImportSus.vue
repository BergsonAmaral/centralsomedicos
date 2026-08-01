<script setup lang="ts">
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Table } from 'lucide-vue-next'
import { useImportSus } from '~/composables/useImportSus'

const importSus = useImportSus()
const arquivo = ref<File | null>(null)
const arrastando = ref(false)
const resultado = ref<{ importados: number; erros: number } | null>(null)
const etapa = ref<'upload' | 'preview' | 'sucesso'>('upload')
const fileInput = ref<HTMLInputElement | null>(null)

function onDrop(e: DragEvent) {
  arrastando.value = false
  const file = e.dataTransfer?.files[0]
  if (file) selecionarArquivo(file)
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) selecionarArquivo(file)
}

async function selecionarArquivo(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
    alert('Selecione um arquivo CSV ou Excel (.xlsx, .xls)')
    return
  }
  arquivo.value = file
  importSus.reset()
  await importSus.parsear(file)
  etapa.value = 'preview'
}

async function importar() {
  resultado.value = await importSus.importar()
  etapa.value = 'sucesso'
  try {
    await useAdminLog().registrar('importacao_sus', {
      detalhes: {
        total: importSus.validos.value.length + importSus.erros.value.length,
        criados: resultado.value?.importados ?? 0,
        erros: resultado.value?.erros ?? 0,
        arquivo: arquivo.value?.name,
      },
    })
  } catch {}
}

function reiniciar() {
  arquivo.value = null
  importSus.reset()
  resultado.value = null
  etapa.value = 'upload'
}

const colunas = [
  'nome', 'cpf', 'data_nascimento', 'telefone', 'email',
  'sus_cartao', 'medico_crm', 'data_consulta', 'motivo',
]
</script>

<template>
  <div class="space-y-5">
    <!-- ETAPA 1 — UPLOAD -->
    <div v-if="etapa === 'upload'" class="card p-8">
      <div
        class="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all"
        :class="arrastando ? 'border-[var(--color-blue)] bg-[var(--color-blue-pale)]' : 'border-[var(--color-border)] hover:border-[var(--color-blue-light)] hover:bg-[var(--color-surface-2)]'"
        @dragover.prevent="arrastando = true"
        @dragleave="arrastando = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <input ref="fileInput" type="file" accept=".csv,.xlsx,.xls" class="hidden" @change="onFileInput" />
        <FileSpreadsheet :size="48" class="mx-auto mb-4 text-[var(--color-blue-light)]" />
        <p class="text-lg font-semibold text-[var(--color-text)]">
          Arraste o arquivo aqui ou clique para selecionar
        </p>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">Aceita CSV ou Excel (.xlsx, .xls)</p>
      </div>

      <div class="mt-6">
        <p class="text-sm font-semibold text-[var(--color-text-muted)] mb-3">Colunas esperadas:</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="col in colunas"
            :key="col"
            class="font-mono text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-1 rounded-full text-[var(--color-text-muted)]"
          >
            {{ col }}
          </span>
        </div>
        <p class="text-xs text-[var(--color-text-dim)] mt-2">* Obrigatórios: nome, cpf, data_nascimento, medico_crm, data_consulta</p>
      </div>
    </div>

    <!-- ETAPA 2 — PREVIEW -->
    <template v-else-if="etapa === 'preview'">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card p-4 text-center">
          <p class="text-3xl font-bold text-[var(--color-text)]">{{ importSus.validos.value.length + importSus.erros.value.length }}</p>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">Total de linhas</p>
        </div>
        <div class="card p-4 text-center border-[var(--color-green)]">
          <p class="text-3xl font-bold text-[var(--color-green)]">{{ importSus.validos.value.length }}</p>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">Válidos</p>
        </div>
        <div class="card p-4 text-center" :class="importSus.erros.value.length ? 'border-[var(--color-danger)]' : ''">
          <p class="text-3xl font-bold" :class="importSus.erros.value.length ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'">
            {{ importSus.erros.value.length }}
          </p>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">Com erros</p>
        </div>
      </div>

      <!-- Preview tabela -->
      <div class="card" style="padding: 0">
        <div class="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center gap-2">
          <Table :size="16" class="text-[var(--color-blue)]" />
          <h3 class="font-semibold text-[var(--color-text)]">Preview (primeiras 10 linhas)</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="table-header-row">
                <th v-for="col in colunas" :key="col" class="px-3 py-2 text-left text-[var(--color-text-muted)] font-semibold whitespace-nowrap">
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in importSus.preview.value" :key="i" class="border-t border-[var(--color-border-light)]">
                <td v-for="col in colunas" :key="col" class="px-3 py-2 text-[var(--color-text)] whitespace-nowrap">
                  {{ (row as Record<string, unknown>)[col] ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Erros -->
      <div v-if="importSus.erros.value.length" class="card p-5">
        <div class="flex items-center gap-2 mb-3">
          <AlertCircle :size="18" class="text-[var(--color-danger)]" />
          <h3 class="font-semibold text-[var(--color-danger)]">Linhas com erro (serão ignoradas)</h3>
        </div>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <div v-for="err in importSus.erros.value" :key="err.linha" class="text-xs flex gap-3 p-2 rounded bg-red-50 text-red-700">
            <span class="font-mono font-bold shrink-0">Linha {{ err.linha }}</span>
            <span>{{ err.motivo }}</span>
          </div>
        </div>
      </div>

      <div class="flex gap-3 justify-end">
        <UiButton variant="ghost" @click="reiniciar">Cancelar</UiButton>
        <UiButton
          variant="success"
          size="lg"
          :loading="importSus.importando.value"
          :disabled="importSus.validos.value.length === 0"
          @click="importar"
        >
          <Upload :size="18" />
          Importar {{ importSus.validos.value.length }} pacientes
        </UiButton>
      </div>
    </template>

    <!-- ETAPA 3 — SUCESSO -->
    <div v-else-if="etapa === 'sucesso'" class="card p-10 text-center">
      <CheckCircle2 :size="64" class="mx-auto mb-4 text-[var(--color-green)]" />
      <h2 class="text-2xl font-bold text-[var(--color-text)] mb-2">Importação concluída!</h2>
      <p class="text-[var(--color-text-muted)]">
        <strong class="text-[var(--color-green)]">{{ resultado?.importados }}</strong> agendamentos importados com sucesso.
        <span v-if="resultado?.erros">
          <strong class="text-[var(--color-danger)]">{{ resultado.erros }}</strong> linhas com erro foram ignoradas.
        </span>
      </p>
      <div class="flex gap-3 justify-center mt-8">
        <UiButton variant="ghost" @click="reiniciar">Nova importação</UiButton>
        <UiButton variant="primary" @click="navigateTo('/admin/fila')">Ver fila →</UiButton>
      </div>
    </div>
  </div>
</template>
