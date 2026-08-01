<script setup lang="ts">
import { PenLine, CheckCircle2, AlertCircle, Trash2, Upload } from 'lucide-vue-next'

definePageMeta({ layout: 'medico', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const authStore = useAuthStore()

const assinaturaAtual = ref<string | null>(null)
const salvando = ref(false)
const sucesso = ref(false)
const erro = ref('')
const removendo = ref(false)

// Carrega assinatura já salva
onMounted(async () => {
  if (!authStore.medicoId) return
  const { data } = await supabase
    .from('medicos')
    .select('assinatura_url')
    .eq('id', authStore.medicoId)
    .single()
  assinaturaAtual.value = data?.assinatura_url ?? null
})

async function salvarAssinatura(blob: Blob) {
  if (!authStore.medicoId) return
  salvando.value = true
  sucesso.value = false
  erro.value = ''

  try {
    const path = `assinaturas/${authStore.medicoId}.png`

    const { error: uploadError } = await supabase.storage
      .from('assinaturas')
      .upload(path, blob, { contentType: 'image/png', upsert: true })

    if (uploadError) throw new Error(uploadError.message)

    const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
    const url = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('medicos')
      .update({ assinatura_url: url })
      .eq('id', authStore.medicoId)

    if (updateError) throw new Error(updateError.message)

    // Atualiza store local sem recarregar a página
    if (authStore.medicoData) {
      authStore.medicoData.assinatura_url = url
    }

    assinaturaAtual.value = url + '?t=' + Date.now() // cache bust
    sucesso.value = true
  } catch (e: any) {
    erro.value = e?.message ?? 'Erro ao salvar assinatura'
  } finally {
    salvando.value = false
  }
}

async function removerAssinatura() {
  if (!authStore.medicoId) return
  removendo.value = true
  try {
    const path = `assinaturas/${authStore.medicoId}.png`
    await supabase.storage.from('assinaturas').remove([path])
    await supabase.from('medicos').update({ assinatura_url: null }).eq('id', authStore.medicoId)
    if (authStore.medicoData) authStore.medicoData.assinatura_url = null
    assinaturaAtual.value = null
    sucesso.value = false
  } finally {
    removendo.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Configurações</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">Dados e preferências do seu perfil médico</p>
    </div>

    <!-- Card Assinatura -->
    <div class="bg-white rounded-2xl border p-6 space-y-5" style="border-color:var(--color-border)">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:#eff6ff">
          <PenLine :size="18" style="color:#2563eb" />
        </div>
        <div>
          <h2 class="font-semibold text-[var(--color-text)]">Assinatura Digital</h2>
          <p class="text-xs mt-0.5" style="color:#64748b">
            Aparece no rodapé de todos os documentos (atestados, receitas, exames, etc.)
          </p>
        </div>
      </div>

      <!-- Assinatura atual -->
      <div v-if="assinaturaAtual" class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-wide" style="color:#94a3b8">Assinatura salva</p>
        <div
          class="rounded-xl border p-4 flex items-center justify-between gap-4"
          style="border-color:#e2e8f0;background:#f8fafc"
        >
          <img
            :src="assinaturaAtual"
            alt="Assinatura do médico"
            class="h-16 object-contain"
            style="max-width:260px"
          />
          <button
            type="button"
            :disabled="removendo"
            class="p-2 rounded-lg transition-colors shrink-0 disabled:opacity-40"
            style="background:#fef2f2;color:#b91c1c"
            title="Remover assinatura"
            @click="removerAssinatura"
          >
            <Trash2 :size="15" />
          </button>
        </div>
        <p class="text-xs" style="color:#64748b">
          Para atualizar, desenhe uma nova assinatura abaixo e clique em <strong>Salvar</strong>.
        </p>
      </div>

      <!-- Pad de desenho -->
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide" style="color:#94a3b8">
          {{ assinaturaAtual ? 'Redesenhar assinatura' : 'Desenhar assinatura' }}
        </p>
        <UiAssinaturaPad @save="salvarAssinatura" @clear="sucesso = false; erro = ''" />
      </div>

      <!-- Feedback -->
      <div
        v-if="salvando"
        class="flex items-center gap-2 text-sm"
        style="color:#2563eb"
      >
        <span class="inline-block w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        Salvando assinatura…
      </div>

      <div
        v-else-if="sucesso"
        class="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
        style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0"
      >
        <CheckCircle2 :size="16" />
        Assinatura salva com sucesso! Será usada em todos os documentos gerados.
      </div>

      <div
        v-else-if="erro"
        class="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
        style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca"
      >
        <AlertCircle :size="16" />
        {{ erro }}
      </div>

      <!-- Instrução -->
      <div
        class="rounded-xl p-4 text-xs space-y-1.5"
        style="background:#f8fafc;border:1px solid #e2e8f0;color:#475569"
      >
        <p class="font-semibold" style="color:#1e293b">Como funciona</p>
        <ul class="space-y-1 list-disc list-inside">
          <li>Desenhe sua assinatura no campo acima usando o mouse ou toque na tela</li>
          <li>Ela será salva de forma segura e embutida no rodapé de cada documento gerado</li>
          <li>Junto à assinatura, o documento exibirá seu nome completo e CRM</li>
          <li>Você pode redesenhar a qualquer momento — a versão mais recente será usada</li>
        </ul>
      </div>
    </div>

  </div>
</template>
