<script setup lang="ts">
import { Building2, Plus, Pencil, Trash2, Link, ExternalLink, Radio, DoorOpen } from 'lucide-vue-next'
import type { Unidade, Sala } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const toast = useToast()

const unidades = ref<Unidade[]>([])
const salas = ref<Sala[]>([])
const carregando = ref(true)

interface SituacaoSala {
  status: string
  paciente_nome: string | null
  medico_nome: string | null
}
const situacao = ref<Record<string, SituacaoSala>>({})
let pollInterval: ReturnType<typeof setInterval>

async function carregar() {
  carregando.value = true
  const [{ data: uData }, { data: sData }] = await Promise.all([
    supabase.from('unidades').select('*').eq('ativo', true).order('nome'),
    supabase.from('salas').select('*').order('nome'),
  ])
  unidades.value = (uData ?? []) as Unidade[]
  salas.value = (sData ?? []) as Sala[]
  carregando.value = false
}

async function carregarSituacao() {
  const hoje = new Date()
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  const { data } = await supabase
    .from('agendamentos')
    .select('sala_slug, status, pacientes(nome), medicos(nome)')
    .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta'])
    .eq('data_consulta', dataHoje)
    .not('sala_slug', 'is', null)

  const mapa: Record<string, SituacaoSala> = {}
  for (const ag of (data ?? [])) {
    if (!ag.sala_slug) continue
    mapa[ag.sala_slug] = {
      status: ag.status,
      paciente_nome: (ag.pacientes as any)?.nome ?? null,
      medico_nome: (ag.medicos as any)?.nome ?? null,
    }
  }
  situacao.value = mapa
}

onMounted(async () => {
  await carregar()
  await carregarSituacao()
  pollInterval = setInterval(carregarSituacao, 5000)
})

onUnmounted(() => clearInterval(pollInterval))

const salasPorUnidade = computed(() => {
  const grupos: Record<string, Sala[]> = {}
  for (const s of salas.value) {
    if (!s.unidade_id) continue
    ;(grupos[s.unidade_id] ??= []).push(s)
  }
  return grupos
})

function linkSala(slug: string) {
  return `${window.location.origin}/sala/${slug}`
}

const copiado = ref<string | null>(null)
function copiarLink(slug: string) {
  navigator.clipboard.writeText(linkSala(slug))
  copiado.value = slug
  setTimeout(() => { copiado.value = null }, 2000)
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  em_consulta:         { label: 'Em consulta',        bg: '#dcfce7', color: '#16a34a' },
  aguardando_paciente: { label: 'Aguard. paciente',   bg: '#fef9c3', color: '#a16207' },
  aguardando_medico:   { label: 'Aguard. médico',     bg: '#fff7ed', color: '#c2410c' },
}

// Modal criar/editar sala
const modalAberto = ref(false)
const editando = ref<Sala | null>(null)
const form = ref({ nome: '', slug: '', unidade_id: '', ativo: true })
const salvando = ref(false)
const erro = ref('')
const slugManual = ref(false)

function slugify(v: string) {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
watch(() => form.value.nome, (val) => {
  if (!slugManual.value) form.value.slug = slugify(val)
})

function abrirNovo(unidadeId?: string) {
  editando.value = null
  form.value = { nome: '', slug: '', unidade_id: unidadeId ?? unidades.value[0]?.id ?? '', ativo: true }
  slugManual.value = false
  erro.value = ''
  modalAberto.value = true
}

function abrirEditar(s: Sala) {
  editando.value = s
  form.value = { nome: s.nome, slug: s.slug, unidade_id: s.unidade_id, ativo: s.ativo }
  slugManual.value = true
  erro.value = ''
  modalAberto.value = true
}

async function salvar() {
  if (!form.value.nome.trim()) { erro.value = 'Informe o nome da sala.'; return }
  if (!form.value.slug.trim()) { erro.value = 'Informe o slug da sala.'; return }
  if (!form.value.unidade_id) { erro.value = 'Selecione a unidade.'; return }
  salvando.value = true
  erro.value = ''
  try {
    const payload = {
      nome: form.value.nome.trim(),
      slug: slugify(form.value.slug),
      unidade_id: form.value.unidade_id,
      ativo: form.value.ativo,
    }
    const { error } = editando.value
      ? await supabase.from('salas').update(payload).eq('id', editando.value.id)
      : await supabase.from('salas').insert(payload)
    if (error) throw new Error(error.message.includes('duplicate') ? 'Já existe uma sala com esse slug.' : error.message)
    const eraEdicao = !!editando.value
    modalAberto.value = false
    await carregar()
    toast.sucesso(eraEdicao ? 'Sala atualizada com sucesso!' : 'Sala cadastrada com sucesso!')
  } catch (e: any) {
    erro.value = e?.message ?? 'Erro ao salvar sala.'
    toast.erro(erro.value)
  } finally {
    salvando.value = false
  }
}

const excluindo = ref<string | null>(null)
async function excluir(s: Sala) {
  // agendamentos.sala_slug é texto solto, sem FK — excluir a sala não é
  // bloqueado pelo banco e deixaria um atendimento em andamento sem tela.
  const hoje = new Date()
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`
  const { count } = await supabase
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('sala_slug', s.slug)
    .eq('data_consulta', dataHoje)
    .in('status', ['checkin', 'aguardando_medico', 'aguardando_paciente', 'em_consulta'])

  if (count) {
    toast.erro(`Não é possível remover: há ${count} paciente(s) usando esta sala agora. Encerre ou mova o atendimento antes.`)
    return
  }

  if (!confirm(`Remover a sala "${s.nome}"? O link /sala/${s.slug} deixará de funcionar.`)) return
  excluindo.value = s.id
  const { error } = await supabase.from('salas').delete().eq('id', s.id)
  await carregar()
  excluindo.value = null
  if (error) { toast.erro('Erro ao remover sala: ' + error.message); return }
  toast.sucesso('Sala removida.')
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Salas de Teleconsulta</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          Cada unidade pode ter várias salas. O paciente aguarda numa sala; o admin decide qual médico atende.
        </p>
      </div>
      <UiButton variant="primary" :disabled="unidades.length === 0" @click="abrirNovo()">
        <Plus :size="16" /> Nova Sala
      </UiButton>
    </div>

    <!-- Loading -->
    <div v-if="carregando" class="py-16 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <!-- Sem unidades -->
    <div v-else-if="unidades.length === 0" class="py-16 text-center bg-white rounded-2xl border" style="border-color:var(--color-border)">
      <Building2 :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
      <p class="font-semibold text-[var(--color-text)]">Nenhuma unidade ativa</p>
      <p class="text-sm mt-1 text-[var(--color-text-muted)]">Cadastre uma unidade antes de criar salas.</p>
      <UiButton class="mt-4" @click="navigateTo('/admin/unidades')">
        <Building2 :size="15" /> Ir para Unidades
      </UiButton>
    </div>

    <!-- Lista por unidade -->
    <div v-else class="space-y-6">
      <div v-for="u in unidades" :key="u.id">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Building2 :size="16" style="color:var(--color-text-muted)" />
            <p class="font-bold text-[var(--color-text)]">{{ u.nome }}</p>
            <span class="text-xs" style="color:var(--color-text-dim)">{{ u.cidade }}</span>
          </div>
          <button type="button" class="text-xs font-semibold flex items-center gap-1" style="color:var(--color-blue)" @click="abrirNovo(u.id)">
            <Plus :size="13" /> Adicionar sala
          </button>
        </div>

        <div v-if="(salasPorUnidade[u.id] ?? []).length === 0" class="py-6 text-center rounded-xl border border-dashed text-sm" style="border-color:var(--color-border);color:var(--color-text-dim)">
          Nenhuma sala cadastrada nesta unidade.
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="s in salasPorUnidade[u.id]"
            :key="s.id"
            class="bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md"
            style="border-color:var(--color-border)"
          >
            <!-- Sala -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:#f5f3ff">
                  <DoorOpen :size="16" style="color:#7c3aed" />
                </div>
                <p class="font-bold text-[var(--color-text)] truncate">{{ s.nome }}</p>
              </div>
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                :style="s.ativo ? 'background:#dcfce7;color:#16a34a' : 'background:#f1f5f9;color:#94a3b8'"
              >
                {{ s.ativo ? 'Ativa' : 'Inativa' }}
              </span>
            </div>

            <!-- Status ao vivo -->
            <div v-if="situacao[s.slug]" class="flex items-center gap-2 flex-wrap">
              <span
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                :style="`background:${STATUS_CONFIG[situacao[s.slug]?.status ?? '']?.bg};color:${STATUS_CONFIG[situacao[s.slug]?.status ?? '']?.color}`"
              >
                <Radio :size="11" />
                {{ STATUS_CONFIG[situacao[s.slug]?.status ?? '']?.label }}
              </span>
              <span v-if="situacao[s.slug]?.paciente_nome" class="text-xs text-[var(--color-text-muted)] truncate">
                · {{ situacao[s.slug]?.paciente_nome }}
              </span>
              <span v-if="situacao[s.slug]?.medico_nome" class="text-xs text-[var(--color-text-muted)] truncate">
                · Dr(a). {{ situacao[s.slug]?.medico_nome }}
              </span>
            </div>
            <div v-else class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style="background:#f1f5f9;color:#94a3b8">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-300" />
                Disponível
              </span>
            </div>

            <!-- Link da sala -->
            <div class="rounded-xl p-3 flex items-center gap-2" style="background:var(--color-surface-2);border:1px solid var(--color-border-light)">
              <code class="text-xs text-[var(--color-text-muted)] flex-1 truncate">/sala/{{ s.slug }}</code>
              <button
                type="button"
                class="p-1.5 rounded-lg transition-colors hover:bg-purple-100 shrink-0"
                :title="copiado === s.slug ? 'Copiado!' : 'Copiar link'"
                @click="copiarLink(s.slug)"
              >
                <span v-if="copiado === s.slug" class="text-xs font-bold" style="color:#7c3aed">✓</span>
                <Link v-else :size="13" style="color:#7c3aed" />
              </button>
              <a
                :href="linkSala(s.slug)"
                target="_blank"
                class="p-1.5 rounded-lg transition-colors hover:bg-blue-50 shrink-0"
                title="Abrir sala"
              >
                <ExternalLink :size="13" style="color:#2563eb" />
              </a>
            </div>

            <!-- Ações -->
            <div class="flex gap-2 pt-1" style="border-top:1px solid var(--color-border-light)">
              <UiButton variant="ghost" size="sm" class="flex-1" @click="abrirEditar(s)">
                <Pencil :size="13" /> Editar
              </UiButton>
              <UiButton variant="ghost" size="sm" :loading="excluindo === s.id" @click="excluir(s)">
                <Trash2 :size="13" style="color:#dc2626" />
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal criar/editar -->
    <UiModal
      v-if="modalAberto"
      :model-value="true"
      :title="editando ? 'Editar Sala' : 'Nova Sala'"
      size="sm"
      @update:model-value="modalAberto = false"
    >
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Unidade *</label>
          <select v-model="form.unidade_id" class="input-base">
            <option v-for="u in unidades" :key="u.id" :value="u.id">{{ u.nome }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Nome *</label>
          <input v-model="form.nome" type="text" class="input-base" placeholder="Ex.: Consultório 1" />
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Slug (link da sala)</label>
          <input v-model="form.slug" type="text" class="input-base font-mono text-sm" @input="slugManual = true" />
          <p class="text-xs mt-1" style="color:var(--color-text-dim)">
            {{ typeof window !== 'undefined' ? window.location.origin : '' }}/sala/{{ form.slug || '...' }}
          </p>
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="form.ativo" type="checkbox" class="w-4 h-4" />
          <span class="text-sm font-semibold text-[var(--color-text)]">Sala ativa</span>
        </label>
        <p v-if="erro" class="text-sm rounded-lg p-3" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca">
          {{ erro }}
        </p>
      </div>
      <template #footer>
        <UiButton variant="ghost" :disabled="salvando" @click="modalAberto = false">Cancelar</UiButton>
        <UiButton variant="primary" :loading="salvando" @click="salvar">Salvar</UiButton>
      </template>
    </UiModal>
  </div>
</template>
