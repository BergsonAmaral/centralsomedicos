<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const token = route.params.token as string

const documento = ref<{ pdf_url: string; tipo: string } | null>(null)
const expirado = ref(false)
const carregando = ref(true)

onMounted(async () => {
  try {
    const data = await $fetch<{ expirado: boolean; tipo?: string; pdf_url?: string }>('/api/documentos/ver', {
      query: { token },
    })
    if (data.expirado || !data.pdf_url) {
      expirado.value = true
    } else {
      documento.value = { pdf_url: data.pdf_url, tipo: data.tipo ?? '' }
    }
  } catch {
    expirado.value = true
  }
  carregando.value = false
})

const TIPOS_LABELS: Record<string, string> = {
  atestado: 'Atestado', pedido_exame: 'Pedido de Exame', receita: 'Receita',
  receita_controlada: 'Receita Controlada', encaminhamento: 'Encaminhamento', declaracao: 'Declaração de Comparecimento',
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
    <div v-if="carregando" class="text-[var(--color-text-muted)]">Carregando documento...</div>

    <div v-else-if="expirado" class="text-center max-w-md">
      <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <span class="text-3xl">⏰</span>
      </div>
      <h1 class="text-xl font-bold text-[var(--color-text)] mb-2">Link Expirado</h1>
      <p class="text-[var(--color-text-muted)] text-sm">
        Este link de acesso ao documento expirou ou é inválido. Solicite um novo link ao médico responsável.
      </p>
    </div>

    <div v-else-if="documento" class="w-full max-w-4xl h-screen flex flex-col">
      <div class="bg-white border-b border-[var(--color-border)] px-6 py-3 flex items-center gap-3">
        <div class="w-8 h-8 bg-[var(--color-blue)] rounded-lg flex items-center justify-center">
          <span class="text-white text-xs font-bold">M</span>
        </div>
        <div>
          <p class="font-semibold text-[var(--color-text)] text-sm">
            {{ TIPOS_LABELS[documento.tipo] ?? documento.tipo }}
          </p>
          <p class="text-xs text-[var(--color-text-muted)]">Documento seguro — SoMedicos</p>
        </div>
        <a
          :href="documento.pdf_url"
          download
          class="ml-auto text-sm text-[var(--color-blue)] hover:underline font-medium"
        >
          Baixar PDF
        </a>
      </div>
      <iframe
        :src="documento.pdf_url"
        class="flex-1 w-full border-0"
        title="Documento médico"
      />
    </div>
  </div>
</template>
