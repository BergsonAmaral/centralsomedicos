<script setup lang="ts">
import { Plus, UserCog, Power, Building2, Trash2 } from 'lucide-vue-next'
import type { Atendente, Unidade } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const toast = useToast()

const atendentes = ref<Atendente[]>([])
const unidades = ref<Unidade[]>([])
const carregando = ref(true)

async function carregar() {
  carregando.value = true
  const [{ data: aData }, { data: uData }] = await Promise.all([
    supabase.from('atendentes').select('*, unidades(id, nome)').order('nome'),
    supabase.from('unidades').select('*').eq('ativo', true).order('nome'),
  ])
  atendentes.value = (aData ?? []) as Atendente[]
  unidades.value = uData ?? []
  carregando.value = false
}
onMounted(carregar)

async function alternarStatus(a: Atendente) {
  const novoAtivo = !a.ativo
  const { error } = await supabase.from('atendentes').update({ ativo: novoAtivo }).eq('id', a.id)
  if (error) { toast.erro('Erro ao atualizar: ' + error.message); return }
  toast.sucesso(novoAtivo ? 'Atendente reativado.' : 'Atendente desativado.')
  await carregar()
}

const excluindo = ref<string | null>(null)
async function excluir(a: Atendente) {
  if (!confirm(`Excluir definitivamente o atendente "${a.nome}"? A conta de acesso dele também será removida. Essa ação não pode ser desfeita.`)) return
  excluindo.value = a.id
  try {
    await $fetch('/api/admin/delete-atendente', { method: 'POST', body: { atendenteId: a.id } })
    toast.sucesso('Atendente excluído.')
    await carregar()
  } catch (e: any) {
    toast.erro('Erro ao excluir: ' + (e?.data?.message ?? 'tente novamente'))
  } finally {
    excluindo.value = null
  }
}

// Modal de cadastro
const modalAberto = ref(false)
const form = ref({ nome: '', email: '', senha: '', unidadeId: '' })
const salvando = ref(false)
const erro = ref('')

function abrirNovo() {
  form.value = { nome: '', email: '', senha: '', unidadeId: unidades.value[0]?.id ?? '' }
  erro.value = ''
  modalAberto.value = true
}

async function salvar() {
  erro.value = ''
  if (!form.value.nome.trim() || !form.value.email.trim() || !form.value.senha || !form.value.unidadeId) {
    erro.value = 'Preencha todos os campos.'
    return
  }
  if (form.value.senha.length < 8) {
    erro.value = 'Senha deve ter pelo menos 8 caracteres.'
    return
  }
  salvando.value = true
  try {
    await $fetch('/api/admin/create-atendente', {
      method: 'POST',
      body: {
        nome: form.value.nome.trim(),
        email: form.value.email.trim(),
        senha: form.value.senha,
        unidadeId: form.value.unidadeId,
      },
    })
    modalAberto.value = false
    toast.sucesso('Atendente cadastrado com sucesso!')
    await carregar()
  } catch (e: any) {
    erro.value = e?.data?.message ?? 'Erro ao cadastrar atendente.'
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Atendentes</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          Recepcionistas de cada unidade — cadastram paciente, agendamento e mexem na fila.
        </p>
      </div>
      <UiButton variant="primary" :disabled="!unidades.length" @click="abrirNovo">
        <Plus :size="16" /> Novo Atendente
      </UiButton>
    </div>

    <div v-if="!carregando && !unidades.length" class="rounded-xl p-4 text-sm" style="background:#fef9c3;color:#854d0e">
      Cadastre uma unidade antes de criar um atendente.
    </div>

    <div v-if="carregando" class="py-16 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <div v-else-if="atendentes.length === 0" class="py-16 text-center bg-white rounded-2xl border" style="border-color:var(--color-border)">
      <UserCog :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
      <p class="font-semibold text-[var(--color-text)]">Nenhum atendente cadastrado</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="a in atendentes" :key="a.id" class="bg-white rounded-2xl border p-5 flex flex-col gap-3" style="border-color:var(--color-border)">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex items-center gap-2.5">
            <UiAvatar :name="a.nome" size="md" />
            <div class="min-w-0">
              <p class="font-bold text-[var(--color-text)] truncate">{{ a.nome }}</p>
              <p v-if="a.unidades?.nome" class="text-xs flex items-center gap-1 mt-0.5" style="color:var(--color-text-muted)">
                <Building2 :size="11" /> {{ a.unidades.nome }}
              </p>
            </div>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" :style="a.ativo ? 'background:#dcfce7;color:#16a34a' : 'background:#f1f5f9;color:#94a3b8'">
            {{ a.ativo ? 'Ativo' : 'Inativo' }}
          </span>
        </div>
        <div class="flex gap-2 pt-2 mt-auto" style="border-top:1px solid var(--color-border-light)">
          <UiButton variant="ghost" size="sm" class="flex-1" @click="alternarStatus(a)">
            <Power :size="13" style="color:#dc2626" />
            {{ a.ativo ? 'Desativar' : 'Reativar' }}
          </UiButton>
          <UiButton variant="ghost" size="sm" :loading="excluindo === a.id" @click="excluir(a)">
            <Trash2 :size="13" style="color:#dc2626" />
          </UiButton>
        </div>
      </div>
    </div>

    <UiModal v-if="modalAberto" :model-value="true" title="Novo Atendente" size="sm" @update:model-value="modalAberto = false">
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Nome *</label>
          <input v-model="form.nome" type="text" class="input-base" placeholder="Nome completo" />
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Unidade *</label>
          <select v-model="form.unidadeId" class="input-base">
            <option v-for="u in unidades" :key="u.id" :value="u.id">{{ u.nome }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">E-mail *</label>
          <input v-model="form.email" type="email" class="input-base" placeholder="email@exemplo.com" />
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Senha *</label>
          <input v-model="form.senha" type="password" class="input-base" placeholder="Mínimo 8 caracteres" />
        </div>
        <p v-if="erro" class="text-sm rounded-lg p-3" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca">
          {{ erro }}
        </p>
      </div>
      <template #footer>
        <UiButton variant="ghost" :disabled="salvando" @click="modalAberto = false">Cancelar</UiButton>
        <UiButton variant="primary" :loading="salvando" @click="salvar">Cadastrar</UiButton>
      </template>
    </UiModal>
  </div>
</template>
