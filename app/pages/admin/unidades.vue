<script setup lang="ts">
import { Building2, Plus, Pencil, Trash2, Users2, Link, ExternalLink } from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const toast = useToast()

interface Unidade {
  id: string
  nome: string
  tipo: 'hospital' | 'ubs' | 'itinerante' | 'rural'
  cidade: string | null
  ativo: boolean
  created_at: string
}

const unidades = ref<Unidade[]>([])
const pacientesPorUnidade = ref<Record<string, number>>({})
const carregando = ref(true)

const TIPO_LABELS: Record<Unidade['tipo'], string> = {
  hospital: 'Hospital / Clínica',
  ubs: 'UBS / Posto de Saúde',
  itinerante: 'Atendimento Itinerante',
  rural: 'Região Rural',
}

async function carregar() {
  carregando.value = true
  const { data } = await supabase.from('unidades').select('*').order('nome')
  unidades.value = (data ?? []) as Unidade[]

  const { data: pac } = await supabase.from('pacientes').select('unidade_id').not('unidade_id', 'is', null)
  const contagem: Record<string, number> = {}
  for (const p of pac ?? []) {
    if (p.unidade_id) contagem[p.unidade_id] = (contagem[p.unidade_id] ?? 0) + 1
  }
  pacientesPorUnidade.value = contagem
  carregando.value = false
}

onMounted(carregar)

// Modal criar/editar
const modalAberto = ref(false)
const editando = ref<Unidade | null>(null)
const form = ref({ nome: '', tipo: 'hospital' as Unidade['tipo'], cidade: '', ativo: true })
const salvando = ref(false)
const erro = ref('')

function abrirNovo() {
  editando.value = null
  form.value = { nome: '', tipo: 'hospital', cidade: '', ativo: true }
  erro.value = ''
  modalAberto.value = true
}

function abrirEditar(u: Unidade) {
  editando.value = u
  form.value = { nome: u.nome, tipo: u.tipo, cidade: u.cidade ?? '', ativo: u.ativo }
  erro.value = ''
  modalAberto.value = true
}

async function salvar() {
  if (!form.value.nome.trim()) { erro.value = 'Informe o nome da unidade.'; return }
  salvando.value = true
  erro.value = ''
  try {
    const payload = {
      nome: form.value.nome.trim(),
      tipo: form.value.tipo,
      cidade: form.value.cidade.trim() || null,
      ativo: form.value.ativo,
    }

    // O banco não impede nomes repetidos, e duas unidades com o mesmo nome
    // ficam impossíveis de distinguir no check-in e nos filtros da fila.
    const duplicada = unidades.value.find(
      (u) => u.nome.trim().toLowerCase() === payload.nome.toLowerCase()
        && u.id !== editando.value?.id
    )
    if (duplicada) throw new Error(`Já existe uma unidade chamada "${duplicada.nome}".`)

    const { error } = editando.value
      ? await supabase.from('unidades').update(payload).eq('id', editando.value.id)
      : await supabase.from('unidades').insert(payload)
    if (error) throw new Error(error.message)
    const eraEdicao = !!editando.value
    modalAberto.value = false
    await carregar()
    toast.sucesso(eraEdicao ? 'Unidade atualizada com sucesso!' : 'Unidade cadastrada com sucesso!')
  } catch (e: any) {
    erro.value = e?.message ?? 'Erro ao salvar unidade.'
    toast.erro(erro.value)
  } finally {
    salvando.value = false
  }
}

function linkAgendamento(unidadeId: string) {
  return `${window.location.origin}/agendar/${unidadeId}`
}
const copiado = ref<string | null>(null)
function copiarLink(unidadeId: string) {
  navigator.clipboard.writeText(linkAgendamento(unidadeId))
  copiado.value = unidadeId
  setTimeout(() => { copiado.value = null }, 2000)
}

const excluindo = ref<string | null>(null)
async function excluir(u: Unidade) {
  // Excluir a unidade apaga junto todas as salas dela (ON DELETE CASCADE).
  // O aviso antigo só falava dos pacientes, então as salas — e os links de
  // acesso já distribuídos — sumiam sem que ninguém fosse avisado.
  const [{ count: countSalas }, { count: countAtendentes }] = await Promise.all([
    supabase.from('salas').select('id', { count: 'exact', head: true }).eq('unidade_id', u.id),
    supabase.from('atendentes').select('id', { count: 'exact', head: true }).eq('unidade_id', u.id),
  ])

  // atendentes.unidade_id é NOT NULL com ON DELETE RESTRICT — o banco não
  // deixa apagar a unidade enquanto houver atendente vinculado a ela.
  // Sem essa checagem, o clique só resultava num erro técnico sem explicação.
  if (countAtendentes) {
    toast.erro(`Não é possível remover: ${countAtendentes} atendente(s) ainda vinculado(s) a "${u.nome}". Mude a unidade deles ou desative-os primeiro (Cadastros → Atendentes).`)
    return
  }

  const aviso = countSalas
    ? `Remover a unidade "${u.nome}"?\n\nATENÇÃO: ${countSalas} sala(s) desta unidade também serão excluídas, e os links /sala/... delas deixarão de funcionar.\n\nPacientes vinculados ficam sem unidade.`
    : `Remover a unidade "${u.nome}"? Pacientes vinculados ficam sem unidade.`

  if (!confirm(aviso)) return
  excluindo.value = u.id
  const { error } = await supabase.from('unidades').delete().eq('id', u.id)
  await carregar()
  excluindo.value = null
  if (error) { toast.erro('Erro ao remover unidade: ' + error.message); return }
  toast.sucesso('Unidade removida.')
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Unidades</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          Hospitais, UBS e postos atendidos pela Central SóMedicos. Cada paciente pertence a uma unidade.
        </p>
      </div>
      <UiButton variant="primary" @click="abrirNovo">
        <Plus :size="16" /> Nova Unidade
      </UiButton>
    </div>

    <div v-if="carregando" class="py-16 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <div v-else-if="unidades.length === 0" class="py-16 text-center bg-white rounded-2xl border" style="border-color:var(--color-border)">
      <Building2 :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
      <p class="font-semibold text-[var(--color-text)]">Nenhuma unidade cadastrada</p>
      <p class="text-sm mt-1 text-[var(--color-text-muted)]">Cadastre hospitais, UBS ou postos itinerantes.</p>
      <UiButton class="mt-4" variant="primary" @click="abrirNovo">
        <Plus :size="15" /> Cadastrar primeira unidade
      </UiButton>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="u in unidades"
        :key="u.id"
        class="bg-white rounded-2xl border p-5 flex flex-col gap-3"
        style="border-color:var(--color-border)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-bold text-[var(--color-text)] truncate">{{ u.nome }}</p>
            <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{{ TIPO_LABELS[u.tipo] }}</p>
            <p v-if="u.cidade" class="text-xs text-[var(--color-text-dim)] mt-0.5">{{ u.cidade }}</p>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            :style="u.ativo ? 'background:#dcfce7;color:#16a34a' : 'background:#f1f5f9;color:#94a3b8'"
          >
            {{ u.ativo ? 'Ativa' : 'Inativa' }}
          </span>
        </div>

        <div class="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Users2 :size="13" />
          {{ pacientesPorUnidade[u.id] ?? 0 }} paciente(s)
        </div>

        <!-- Link do totem de agendamento — a tela fixa da recepção aponta aqui -->
        <div class="rounded-xl p-2.5 flex items-center gap-2" style="background:var(--color-surface-2);border:1px solid var(--color-border-light)">
          <code class="text-xs text-[var(--color-text-muted)] flex-1 truncate">/agendar/{{ u.id }}</code>
          <button
            type="button"
            class="p-1.5 rounded-lg transition-colors hover:bg-green-100 shrink-0"
            :title="copiado === u.id ? 'Copiado!' : 'Copiar link do totem'"
            @click="copiarLink(u.id)"
          >
            <span v-if="copiado === u.id" class="text-xs font-bold" style="color:#2daa8a">✓</span>
            <Link v-else :size="13" style="color:#2daa8a" />
          </button>
          <a :href="linkAgendamento(u.id)" target="_blank" class="p-1.5 rounded-lg transition-colors hover:bg-blue-50 shrink-0" title="Abrir">
            <ExternalLink :size="13" style="color:#2563eb" />
          </a>
        </div>

        <div class="flex gap-2 pt-2 mt-auto" style="border-top:1px solid var(--color-border-light)">
          <UiButton variant="ghost" size="sm" class="flex-1" @click="abrirEditar(u)">
            <Pencil :size="13" /> Editar
          </UiButton>
          <UiButton variant="ghost" size="sm" :loading="excluindo === u.id" @click="excluir(u)">
            <Trash2 :size="13" style="color:#dc2626" />
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Modal criar/editar -->
    <UiModal
      v-if="modalAberto"
      :model-value="true"
      :title="editando ? 'Editar Unidade' : 'Nova Unidade'"
      size="sm"
      @update:model-value="modalAberto = false"
    >
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Nome *</label>
          <input v-model="form.nome" type="text" class="input-base" placeholder="Ex.: UBS Vila Esperança" />
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Tipo</label>
          <select v-model="form.tipo" class="input-base">
            <option value="hospital">Hospital / Clínica</option>
            <option value="ubs">UBS / Posto de Saúde</option>
            <option value="itinerante">Atendimento Itinerante</option>
            <option value="rural">Região Rural</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Cidade</label>
          <input v-model="form.cidade" type="text" class="input-base" placeholder="Ex.: Fortaleza - CE" />
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="form.ativo" type="checkbox" class="w-4 h-4" />
          <span class="text-sm font-semibold text-[var(--color-text)]">Unidade ativa</span>
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
