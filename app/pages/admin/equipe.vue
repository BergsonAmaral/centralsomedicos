<script setup lang="ts">
import { Plus, ShieldCheck, Shield, Trash2 } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const authStore = useAuthStore()
const toast = useToast()
const adminLog = useAdminLog()

interface AdminRow { id: string; nome: string; email: string | null; is_superadmin: boolean; created_at: string }
const admins = ref<AdminRow[]>([])
const carregando = ref(true)

async function carregar() {
  carregando.value = true
  try {
    admins.value = await $fetch<AdminRow[]>('/api/admin/list-admins')
  } catch (e: any) {
    toast.erro('Erro ao carregar admins: ' + (e?.data?.message ?? 'tente novamente'))
  } finally {
    carregando.value = false
  }
}
onMounted(carregar)

const excluindo = ref<string | null>(null)
async function excluir(a: AdminRow) {
  if (!confirm(`Excluir definitivamente o admin "${a.nome}"? A conta de acesso dele será removida. Essa ação não pode ser desfeita.`)) return
  excluindo.value = a.id
  try {
    await $fetch('/api/admin/delete-admin', { method: 'POST', body: { adminId: a.id } })
    try {
      await adminLog.registrar('admin_excluido', { entidade: 'admin', entidadeId: a.id, detalhes: { nome: a.nome } })
    } catch {}
    toast.sucesso('Admin excluído.')
    await carregar()
  } catch (e: any) {
    toast.erro('Erro ao excluir: ' + (e?.data?.message ?? 'tente novamente'))
  } finally {
    excluindo.value = null
  }
}

// Modal de cadastro
const modalAberto = ref(false)
const form = ref({ nome: '', email: '', senha: '' })
const salvando = ref(false)
const erro = ref('')

function abrirNovo() {
  form.value = { nome: '', email: '', senha: '' }
  erro.value = ''
  modalAberto.value = true
}

async function salvar() {
  erro.value = ''
  if (!form.value.nome.trim() || !form.value.email.trim() || !form.value.senha) {
    erro.value = 'Preencha todos os campos.'
    return
  }
  if (form.value.senha.length < 8) {
    erro.value = 'Senha deve ter pelo menos 8 caracteres.'
    return
  }
  salvando.value = true
  try {
    await $fetch('/api/admin/create-admin', {
      method: 'POST',
      body: { nome: form.value.nome.trim(), email: form.value.email.trim(), senha: form.value.senha },
    })
    try {
      await adminLog.registrar('admin_criado', { entidade: 'admin', detalhes: { nome: form.value.nome.trim(), email: form.value.email.trim() } })
    } catch {}
    modalAberto.value = false
    toast.sucesso('Admin cadastrado com sucesso!')
    await carregar()
  } catch (e: any) {
    erro.value = e?.data?.message ?? 'Erro ao cadastrar admin.'
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Equipe (Admins)</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          Superadmins são protegidos — só outro superadmin pode excluí-los, e admins comuns não têm essa opção.
        </p>
      </div>
      <UiButton v-if="authStore.isSuperAdmin" variant="primary" @click="abrirNovo">
        <Plus :size="16" /> Novo Admin
      </UiButton>
    </div>

    <div v-if="!authStore.isSuperAdmin" class="rounded-xl p-4 text-sm" style="background:#eff6ff;color:#1d4ed8">
      Você é um admin comum — só um superadmin pode cadastrar ou excluir contas de admin.
    </div>

    <div v-if="carregando" class="py-16 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="a in admins" :key="a.id" class="bg-white rounded-2xl border p-5 flex flex-col gap-3" style="border-color:var(--color-border)">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex items-center gap-2.5">
            <UiAvatar :name="a.nome" size="md" />
            <div class="min-w-0">
              <p class="font-bold text-[var(--color-text)] truncate">{{ a.nome }}</p>
              <p class="text-xs truncate" style="color:var(--color-text-muted)">{{ a.email }}</p>
            </div>
          </div>
          <span
            class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            :style="a.is_superadmin ? 'background:#ede9fe;color:#7c3aed' : 'background:#f1f5f9;color:#64748b'"
          >
            <component :is="a.is_superadmin ? ShieldCheck : Shield" :size="11" />
            {{ a.is_superadmin ? 'Superadmin' : 'Admin' }}
          </span>
        </div>
        <div v-if="authStore.isSuperAdmin && !a.is_superadmin" class="pt-2 mt-auto" style="border-top:1px solid var(--color-border-light)">
          <UiButton variant="ghost" size="sm" class="w-full" :loading="excluindo === a.id" @click="excluir(a)">
            <Trash2 :size="13" style="color:#dc2626" /> Excluir
          </UiButton>
        </div>
      </div>
    </div>

    <UiModal v-if="modalAberto" :model-value="true" title="Novo Admin" size="sm" @update:model-value="modalAberto = false">
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Nome *</label>
          <input v-model="form.nome" type="text" class="input-base" placeholder="Nome completo" />
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
