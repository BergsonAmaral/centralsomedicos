<script setup lang="ts">
import { ArrowLeft, Camera, Eye, EyeOff, AlertTriangle, Trash2 } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const route = useRoute()
const id = route.params.id as string
const isNovo = id === 'novo'

const schema = toTypedSchema(
  z.object({
    nome: z.string().min(3, 'Nome obrigatório'),
    crm: z.string().min(4, 'CRM obrigatório'),
    especialidade: z.string().min(2, 'Especialidade obrigatória'),
    email: z.string().email('E-mail inválido'),
    senha: isNovo
      ? z.string().min(8, 'Senha deve ter pelo menos 8 caracteres')
      : z.union([z.string().min(8, 'Mínimo 8 caracteres'), z.literal('')]).optional(),
    telefone: z.string().optional(),
    valor_consulta: z.number({ invalid_type_error: 'Informe um valor válido' }).min(0).optional(),
  })
)

const { handleSubmit, errors, defineField, setValues } = useForm({ validationSchema: schema })

const [nome, nomeAttrs] = defineField('nome')
const [crm, crmAttrs] = defineField('crm')
const [especialidade, especialidadeAttrs] = defineField('especialidade')
const [email, emailAttrs] = defineField('email')
const [senha, senhaAttrs] = defineField('senha')
const [telefone, telefoneAttrs] = defineField('telefone')
const [valorConsulta, valorConsultaAttrs] = defineField('valor_consulta')

// Sala do médico
const salaSlug = ref('')
const salaSlugManual = ref(false)

watch(nome, (val) => {
  if (!salaSlugManual.value) {
    salaSlug.value = slugify(val)
  }
})

const senhaVisivel = ref(false)

const salvando = ref(false)
const fotoFile = ref<File | null>(null)
const fotoPreview = ref<string | null>(null)
const erro = ref('')

// Gera slug a partir do nome
function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

// Carregar dados se edição
const emailOriginal = ref<string>('')
onMounted(async () => {
  if (!isNovo) {
    try {
      const data = await $fetch<any>(`/api/admin/medico/${id}`)
      if (data) {
        setValues({
          nome: data.nome,
          crm: data.crm,
          especialidade: data.especialidade,
          email: data.email ?? '',
          senha: '',
          valor_consulta: data.valor_consulta ?? undefined,
        })
        emailOriginal.value = data.email ?? ''
        fotoPreview.value = data.foto_url
        salaSlug.value = data.sala_slug ?? ''
        if (data.sala_slug) salaSlugManual.value = true
      }
    } catch (e: any) {
      erro.value = e?.data?.message ?? 'Erro ao carregar médico'
    }
  }
})

function onFotoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    fotoFile.value = file
    fotoPreview.value = URL.createObjectURL(file)
  }
}

const onSubmit = handleSubmit(async (values) => {
  salvando.value = true
  erro.value = ''
  try {
    let fotoUrl: string | null = fotoPreview.value

    // Upload foto
    if (fotoFile.value) {
      const path = `avatares/${Date.now()}_${fotoFile.value.name}`
      await supabase.storage.from('avatares').upload(path, fotoFile.value, { upsert: true })
      const { data: url } = supabase.storage.from('avatares').getPublicUrl(path)
      fotoUrl = url.publicUrl
    }

    if (isNovo) {
      // Usa server API — cria auth user + profile + medico com service key
      const result = await $fetch('/api/admin/create-medico', {
        method: 'POST',
        body: {
          nome: values.nome,
          crm: values.crm,
          especialidade: values.especialidade,
          email: values.email,
          senha: values.senha,
          foto_url: fotoUrl,
          valor_consulta: values.valor_consulta ?? 0,
          sala_slug: salaSlug.value || null,
        },
      }).catch((e) => {
        throw new Error(e?.data?.message ?? 'Erro ao criar médico')
      })
      try {
        await useAdminLog().registrar('medico_criado', {
          entidade: 'medico',
          detalhes: { nome: values.nome, crm: values.crm, email: values.email },
        })
      } catch {}
    } else {
      await supabase.from('medicos').update({
        nome: values.nome,
        crm: values.crm,
        especialidade: values.especialidade,
        foto_url: fotoUrl,
        valor_consulta: values.valor_consulta ?? null,
        sala_slug: salaSlug.value || null,
      }).eq('id', id)

      // Atualiza credenciais (email/senha) se mudaram
      const credPayload: { email?: string; senha?: string } = {}
      if (values.email && values.email !== emailOriginal.value) credPayload.email = values.email
      if (values.senha) credPayload.senha = values.senha
      if (credPayload.email || credPayload.senha) {
        await $fetch(`/api/admin/medico/${id}/credentials`, {
          method: 'PATCH',
          body: credPayload,
        }).catch((e) => {
          throw new Error(e?.data?.message ?? 'Erro ao atualizar credenciais')
        })
      }

      try {
        await useAdminLog().registrar('medico_editado', {
          entidade: 'medico',
          entidadeId: id as string,
          detalhes: { nome: values.nome, email_alterado: !!credPayload.email, senha_alterada: !!credPayload.senha },
        })
      } catch {}
    }

    navigateTo('/admin/medicos')
  } catch (e: any) {
    erro.value = e.message ?? 'Erro ao salvar médico.'
  } finally {
    salvando.value = false
  }
})

async function desativarMedico() {
  if (!confirm('Desativar este médico? Ele não poderá mais fazer login nem aparecer na fila.')) return
  await supabase.from('medicos').update({ ativo: false }).eq('id', id)
  navigateTo('/admin/medicos')
}

async function excluirMedico() {
  if (!confirm('ATENÇÃO: Excluir o médico permanentemente? Todos os agendamentos e documentos associados serão removidos. Esta ação não pode ser desfeita.')) return
  await supabase.from('documentos').delete().eq('medico_id', id)
  await supabase.from('agendamentos').delete().eq('medico_id', id)
  await supabase.from('medicos').delete().eq('id', id)
  navigateTo('/admin/medicos')
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <button @click="navigateTo('/admin/medicos')" class="p-2 rounded-lg hover:bg-[var(--color-surface-2)]">
        <ArrowLeft :size="20" class="text-[var(--color-text-muted)]" />
      </button>
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">
          {{ isNovo ? 'Novo Médico' : 'Editar Médico' }}
        </h1>
      </div>
    </div>

    <form class="space-y-5" @submit.prevent="onSubmit">
      <!-- Foto -->
      <UiCard>
        <template #header><h3 class="font-semibold">Foto do Médico</h3></template>
        <div class="flex items-center gap-5">
          <UiAvatar :src="fotoPreview" :name="nome" size="xl" />
          <div>
            <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-sm font-medium">
              <Camera :size="16" /> Selecionar foto
              <input type="file" accept="image/*" class="hidden" @change="onFotoChange" />
            </label>
            <p class="text-xs text-[var(--color-text-dim)] mt-1">JPG, PNG ou WebP. Máx 2MB.</p>
          </div>
        </div>
      </UiCard>

      <!-- Dados básicos -->
      <UiCard>
        <template #header><h3 class="font-semibold">Dados Profissionais</h3></template>
        <div class="space-y-4">
          <UiInput v-model="nome" v-bind="nomeAttrs" label="Nome completo *" placeholder="Dr(a). Nome Sobrenome" :error="errors.nome" />
          <div class="grid grid-cols-2 gap-4">
            <UiInput v-model="crm" v-bind="crmAttrs" label="CRM *" placeholder="123456/SP" :error="errors.crm" />
            <UiInput v-model="especialidade" v-bind="especialidadeAttrs" label="Especialidade *" placeholder="Cardiologia" :error="errors.especialidade" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UiInput v-model="email" v-bind="emailAttrs" label="E-mail *" type="email" placeholder="medico@clinica.com.br" :error="errors.email" />
            <UiInput v-model="telefone" v-bind="telefoneAttrs" label="Telefone" mask="telefone" placeholder="(11) 99999-9999" />
          </div>
          <!-- Senha — obrigatória no novo, opcional na edição -->
          <div class="relative">
            <UiInput
              v-model="senha"
              v-bind="senhaAttrs"
              :label="isNovo ? 'Senha de acesso *' : 'Nova senha (deixe em branco para manter)'"
              :type="senhaVisivel ? 'text' : 'password'"
              :placeholder="isNovo ? 'Mínimo 8 caracteres' : '••••••••'"
              :error="errors.senha"
            />
            <button
              type="button"
              class="absolute right-3 top-8 text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]"
              @click="senhaVisivel = !senhaVisivel"
            >
              <component :is="senhaVisivel ? EyeOff : Eye" :size="16" />
            </button>
          </div>
        </div>
      </UiCard>

      <!-- Sala de teleconsulta -->
      <UiCard>
        <template #header>
          <h3 class="font-semibold">Sala de Teleconsulta</h3>
        </template>
        <div class="space-y-3">
          <p class="text-sm text-[var(--color-text-muted)]">
            Cada médico tem sua própria sala virtual. Os pacientes aguardam nessa URL antes da consulta.
          </p>
          <div>
            <label class="block text-sm font-semibold text-[var(--color-text)] mb-1.5">
              Link da sala
            </label>
            <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm" style="border-color:var(--color-border);background:var(--color-surface-2)">
              <span class="shrink-0" style="color:var(--color-text-dim)">/sala/</span>
              <input
                v-model="salaSlug"
                class="flex-1 bg-transparent outline-none text-[var(--color-text)]"
                placeholder="dr-nome-sobrenome"
                @input="salaSlugManual = true"
              />
            </div>
            <p class="mt-1.5 text-xs" style="color:var(--color-text-muted)">
              URL completa:
              <strong>{{ typeof window !== 'undefined' ? window.location.origin : '' }}/sala/{{ salaSlug || '...' }}</strong>
            </p>
            <p v-if="!salaSlug" class="mt-1 text-xs text-amber-600">
              ⚠️ Preencha o nome do médico para gerar o slug automaticamente.
            </p>
          </div>
        </div>
      </UiCard>

      <!-- Financeiro -->
      <UiCard>
        <template #header>
          <h3 class="font-semibold">Financeiro</h3>
        </template>
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-muted)] mb-1">Valor por consulta (R$)</label>
          <div class="relative max-w-xs">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style="color:var(--color-text-dim)">R$</span>
            <input
              v-bind="valorConsultaAttrs"
              :value="valorConsulta"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              class="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:border-blue-400 transition-colors"
              style="border-color:var(--color-border);background:var(--color-surface-2)"
              @input="valorConsulta = Number(($event.target as HTMLInputElement).value)"
            />
          </div>
          <p v-if="errors.valor_consulta" class="text-xs text-red-500 mt-1">{{ errors.valor_consulta }}</p>
          <p class="text-xs text-[var(--color-text-dim)] mt-1">Usado no painel financeiro para calcular a receita gerada por este médico.</p>
        </div>
      </UiCard>

      <!-- Erro geral -->
      <p v-if="erro" class="text-sm text-[var(--color-danger)] bg-red-50 p-3 rounded-lg border border-red-200">
        {{ erro }}
      </p>

      <!-- Ações -->
      <div class="flex justify-end gap-3">
        <UiButton variant="ghost" type="button" @click="navigateTo('/admin/medicos')">Cancelar</UiButton>
        <UiButton variant="primary" type="submit" :loading="salvando">
          {{ isNovo ? 'Cadastrar Médico' : 'Salvar Alterações' }}
        </UiButton>
      </div>

      <!-- Zona de Perigo (apenas edição) -->
      <div v-if="!isNovo" class="rounded-2xl border-2 border-red-200 bg-red-50 p-5 space-y-4">
        <div class="flex items-center gap-2">
          <AlertTriangle :size="18" style="color:#dc2626" />
          <h3 class="font-bold text-red-700">Zona de Perigo</h3>
        </div>
        <p class="text-sm text-red-600">
          Desativar o médico impede login e oculta da fila. Excluir remove permanentemente todos os dados associados.
        </p>
        <div class="flex flex-wrap gap-3">
          <UiButton
            variant="ghost"
            size="sm"
            class="border border-orange-300 text-orange-700 hover:bg-orange-50"
            type="button"
            @click="desativarMedico"
          >
            Desativar médico
          </UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            class="border border-red-300 text-red-600 hover:bg-red-100"
            type="button"
            @click="excluirMedico"
          >
            <Trash2 :size="14" /> Excluir médico permanentemente
          </UiButton>
        </div>
      </div>
    </form>
  </div>
</template>
