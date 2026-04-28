<script setup lang="ts">
import { DoorOpen, Plus, Pencil, Trash2, Link, Check, X } from 'lucide-vue-next'
import type { Sala } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()

// ── dados ─────────────────────────────────────────────────
const salas = ref<Sala[]>([])
const carregando = ref(false)

// ── modal ─────────────────────────────────────────────────
const modal = ref(false)
const editando = ref<Sala | null>(null)

const form = reactive({
  nome: '',
  slug: '',
  ativo: true,
})
const salvando = ref(false)
const erroSlug = ref('')

function abrirNova() {
  editando.value = null
  Object.assign(form, { nome: '', slug: '', ativo: true })
  erroSlug.value = ''
  modal.value = true
}

function abrirEditar(s: Sala) {
  editando.value = s
  Object.assign(form, {
    nome: s.nome,
    slug: s.slug,
    ativo: s.ativo,
  })
  erroSlug.value = ''
  modal.value = true
}

// Gerar slug a partir do nome
watch(() => form.nome, (val) => {
  if (editando.value) return // ao editar não altera o slug automaticamente
  form.slug = val
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
})

async function salvar() {
  erroSlug.value = ''
  if (!form.nome.trim() || !form.slug.trim()) return
  salvando.value = true
  try {
    const payload = {
      nome: form.nome.trim(),
      slug: form.slug.trim(),
      ativo: form.ativo,
    }
    if (editando.value) {
      const { error } = await supabase.from('salas').update(payload).eq('id', editando.value.id)
      if (error?.code === '23505') { erroSlug.value = 'Este slug já está em uso.'; return }
      if (error) throw error
    } else {
      const { error } = await supabase.from('salas').insert(payload)
      if (error?.code === '23505') { erroSlug.value = 'Este slug já está em uso.'; return }
      if (error) throw error
    }
    modal.value = false
    await carregar()
  } catch (e: any) {
    alert('Erro ao salvar: ' + (e?.message ?? 'tente novamente'))
  } finally {
    salvando.value = false
  }
}

// ── confirmação de exclusão ────────────────────────────────
const confirmandoDelete = ref<string | null>(null)

async function excluir(id: string) {
  const { error } = await supabase.from('salas').delete().eq('id', id)
  if (error) { alert('Erro ao excluir: ' + error.message); return }
  confirmandoDelete.value = null
  await carregar()
}

// ── toggle ativo ──────────────────────────────────────────
async function toggleAtivo(s: Sala) {
  await supabase.from('salas').update({ ativo: !s.ativo }).eq('id', s.id)
  await carregar()
}

// ── carregar ──────────────────────────────────────────────
async function carregar() {
  carregando.value = true
  const { data } = await supabase.from('salas').select('*').order('nome')
  salas.value = (data ?? []) as Sala[]
  carregando.value = false
}

onMounted(carregar)

function linkSala(slug: string) {
  return `${window.location.origin}/sala/${slug}`
}

function copiarLink(slug: string) {
  navigator.clipboard.writeText(linkSala(slug))
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Salas</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">Espaços físicos independentes — qualquer médico pode atender em qualquer sala no dia</p>
      </div>
      <UiButton @click="abrirNova">
        <Plus :size="16" /> Nova Sala
      </UiButton>
    </div>

    <!-- Loading -->
    <div v-if="carregando" class="py-12 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <!-- Tabela -->
    <div v-else class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
      <div v-if="!salas.length" class="py-16 text-center">
        <DoorOpen :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
        <p class="font-semibold text-[var(--color-text)]">Nenhuma sala cadastrada</p>
        <p class="text-sm mt-1" style="color:var(--color-text-muted)">Crie as salas das suas unidades (ex: Sobral, Fortaleza)</p>
        <UiButton class="mt-4" @click="abrirNova"><Plus :size="15" /> Nova Sala</UiButton>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr style="background:var(--color-surface-2);border-bottom:1px solid var(--color-border-light)">
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Sala / Unidade</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">Link / Slug</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Status</th>
            <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in salas" :key="s.id"
            class="border-b hover:bg-blue-50 transition-colors"
            style="border-color:var(--color-border-light)"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:#ede9fe">
                  <DoorOpen :size="15" style="color:#7c3aed" />
                </div>
                <div>
                  <p class="font-semibold text-[var(--color-text)]">{{ s.nome }}</p>
                  <p class="text-xs sm:hidden" style="color:var(--color-text-muted)">/sala/{{ s.slug }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 hidden sm:table-cell">
              <div class="flex items-center gap-2">
                <code class="text-xs px-2 py-0.5 rounded" style="background:#f1f5f9;color:#475569">/sala/{{ s.slug }}</code>
                <button
                  type="button"
                  class="p-1 rounded hover:bg-purple-100 transition-colors"
                  title="Copiar link"
                  @click="copiarLink(s.slug)"
                >
                  <Link :size="13" style="color:#7c3aed" />
                </button>
              </div>
            </td>
            <td class="px-4 py-3">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                :style="s.ativo
                  ? 'background:#dcfce7;color:#16a34a'
                  : 'background:#f1f5f9;color:#94a3b8'"
                @click="toggleAtivo(s)"
              >
                <component :is="s.ativo ? Check : X" :size="11" />
                {{ s.ativo ? 'Ativa' : 'Inativa' }}
              </button>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  class="p-1.5 rounded-lg transition-colors hover:bg-blue-50"
                  title="Editar"
                  @click="abrirEditar(s)"
                >
                  <Pencil :size="14" style="color:#2563eb" />
                </button>
                <template v-if="confirmandoDelete === s.id">
                  <button
                    type="button"
                    class="px-2 py-1 rounded-lg text-xs font-bold"
                    style="background:#dc2626;color:white"
                    @click="excluir(s.id)"
                  >Confirmar</button>
                  <button
                    type="button"
                    class="px-2 py-1 rounded-lg text-xs font-semibold"
                    style="background:#f1f5f9;color:#475569"
                    @click="confirmandoDelete = null"
                  >Cancelar</button>
                </template>
                <button
                  v-else
                  type="button"
                  class="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                  title="Excluir"
                  @click="confirmandoDelete = s.id"
                >
                  <Trash2 :size="14" style="color:#dc2626" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal criar/editar -->
    <UiModal v-if="modal" :model-value="true" :title="editando ? 'Editar Sala' : 'Nova Sala'" size="md" @update:model-value="modal = false">
      <div class="space-y-4">
        <UiInput
          v-model="form.nome"
          label="Nome da sala"
          placeholder="Ex: Consultório 1, Sala Dr. João..."
          required
        />
        <div>
          <label class="block text-sm font-semibold text-[var(--color-text)] mb-1.5">
            Slug (URL da tela de espera)
          </label>
          <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm" style="border-color:var(--color-border);background:var(--color-surface-2)">
            <span style="color:var(--color-text-dim)">/sala/</span>
            <input
              v-model="form.slug"
              class="flex-1 bg-transparent outline-none text-[var(--color-text)]"
              placeholder="meu-consultorio"
            />
          </div>
          <p v-if="erroSlug" class="mt-1 text-xs font-medium" style="color:#dc2626">{{ erroSlug }}</p>
          <p class="mt-1 text-xs" style="color:var(--color-text-muted)">
            Abra em qualquer tela/TV: <strong>{{ typeof window !== 'undefined' ? window.location.origin : '' }}/sala/{{ form.slug || '...' }}</strong>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input id="ativo-toggle" v-model="form.ativo" type="checkbox" class="w-4 h-4 accent-[#7c3aed]" />
          <label for="ativo-toggle" class="text-sm text-[var(--color-text)]">Sala ativa</label>
        </div>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="modal = false">Cancelar</UiButton>
        <UiButton :loading="salvando" :disabled="!form.nome || !form.slug" @click="salvar">
          <Check :size="15" /> {{ editando ? 'Salvar alterações' : 'Criar sala' }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
