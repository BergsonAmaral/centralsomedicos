<script setup lang="ts">
import { FileText, Eye, FileDown } from 'lucide-vue-next'
import type { Documento } from '~/types'

definePageMeta({ layout: 'atendente', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const { resolverUrlAssinada } = useDocumentos()

const documentos = ref<Documento[]>([])
const carregando = ref(true)
const verModal = ref<Documento | null>(null)
const verModalUrl = ref<string | null>(null)

const TIPOS_LABELS: Record<string, string> = {
  atestado: 'Atestado',
  pedido_exame: 'Pedido de Exame',
  receita: 'Receita',
  receita_controlada: 'Receita Controlada',
  encaminhamento: 'Encaminhamento',
  declaracao: 'Declaração',
}
const TIPOS_CORES: Record<string, string> = {
  atestado: '#2563eb',
  pedido_exame: '#7c3aed',
  receita: '#16a34a',
  receita_controlada: '#dc2626',
  encaminhamento: '#d97706',
  declaracao: '#0891b2',
}

async function carregar() {
  carregando.value = true
  // RLS já restringe aos documentos de pacientes da unidade do atendente
  const { data } = await supabase
    .from('documentos')
    .select('*, pacientes(nome), medicos(nome)')
    .order('created_at', { ascending: false })
  documentos.value = (data ?? []) as Documento[]
  carregando.value = false
}
onMounted(carregar)

async function abrirVer(doc: Documento) {
  verModal.value = doc
  verModalUrl.value = doc.pdf_url ? await resolverUrlAssinada(doc.pdf_url) : null
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Documentos</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">
        {{ carregando ? '…' : `${documentos.length} documento${documentos.length !== 1 ? 's' : ''}` }} da sua unidade — só visualização.
      </p>
    </div>

    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
      <div v-if="carregando" class="p-8 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>

      <div v-else-if="documentos.length === 0" class="py-16 text-center">
        <FileText :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
        <p class="font-medium" style="color:var(--color-text-muted)">Nenhum documento encontrado</p>
      </div>

      <table v-else class="w-full text-sm">
        <thead>
          <tr style="border-bottom:1px solid var(--color-border-light);background:var(--color-surface-2)">
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Tipo</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Paciente</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style="color:var(--color-text-muted)">Médico</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">Data</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in documentos" :key="doc.id"
            class="border-b transition-colors hover:bg-blue-50 cursor-pointer"
            style="border-color:var(--color-border-light)"
            @click="abrirVer(doc)"
          >
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" :style="`background:${TIPOS_CORES[doc.tipo]}18;color:${TIPOS_CORES[doc.tipo]}`">
                <FileText :size="11" /> {{ TIPOS_LABELS[doc.tipo] ?? doc.tipo }}
              </span>
            </td>
            <td class="px-4 py-3 font-medium" style="color:var(--color-text)">{{ (doc.pacientes as any)?.nome ?? '—' }}</td>
            <td class="px-4 py-3 hidden md:table-cell text-sm" style="color:var(--color-text-muted)">{{ (doc.medicos as any)?.nome ?? '—' }}</td>
            <td class="px-4 py-3 hidden sm:table-cell text-xs" style="color:var(--color-text-muted)">{{ new Date(doc.created_at).toLocaleDateString('pt-BR') }}</td>
            <td class="px-4 py-3" @click.stop>
              <button v-if="doc.pdf_url" class="p-1.5 rounded-lg" style="background:#eff6ff;color:#2563eb" title="Visualizar PDF" @click="abrirVer(doc)">
                <Eye :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UiModal v-if="verModal" :model-value="true" title="Visualizar Documento" size="xl" @update:model-value="verModal = null; verModalUrl = null">
      <div v-if="!verModalUrl" class="py-16 text-center text-sm text-[var(--color-text-muted)]">Carregando documento…</div>
      <iframe v-else :src="verModalUrl" class="w-full h-[70vh] rounded-lg border border-[var(--color-border)]" />
      <template #footer>
        <a v-if="verModalUrl" :href="verModalUrl" target="_blank" class="inline-flex">
          <UiButton variant="secondary" size="sm">
            <FileDown :size="15" /> Baixar PDF
          </UiButton>
        </a>
        <UiButton variant="ghost" @click="verModal = null; verModalUrl = null">Fechar</UiButton>
      </template>
    </UiModal>
  </div>
</template>
