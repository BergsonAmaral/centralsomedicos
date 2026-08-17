<script setup lang="ts">
import { Search, Phone, MessageCircle, ChevronLeft, ChevronRight, Users2, Filter, UserPlus, CalendarPlus } from 'lucide-vue-next'
import type { Paciente } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
const adminLog = useAdminLog()

const busca = ref('')
const filtroSexo = ref<'' | 'M' | 'F' | 'O'>('')
const filtroTelefone = ref(false)
const filtroSus = ref(false)
const ordenar = ref<'nome_asc' | 'nome_desc' | 'recentes'>('nome_asc')

const POR_PAGINA = 20
const pagina = ref(1)
const total = ref(0)
const pacientes = ref<Paciente[]>([])
const carregando = ref(true)

async function carregar() {
  carregando.value = true
  try {
    const from = (pagina.value - 1) * POR_PAGINA
    const to = from + POR_PAGINA - 1

    let q = supabase.from('pacientes').select('*', { count: 'exact' })

    if (busca.value.trim()) {
      const termo = busca.value.trim()
      const somenteDigitos = termo.replace(/\D/g, '')
      if (somenteDigitos.length >= 6) {
        q = q.or(`cpf.ilike.%${somenteDigitos}%,sus_cartao.ilike.%${termo}%`)
      } else {
        q = q.ilike('nome', `%${termo}%`)
      }
    }

    if (filtroSexo.value) q = q.eq('sexo', filtroSexo.value)
    if (filtroTelefone.value) q = q.not('telefone', 'is', null)
    if (filtroSus.value) q = q.not('sus_cartao', 'is', null)

    if (ordenar.value === 'nome_asc') q = q.order('nome', { ascending: true })
    else if (ordenar.value === 'nome_desc') q = q.order('nome', { ascending: false })
    else q = q.order('created_at', { ascending: false })

    q = q.range(from, to)

    const { data, count, error } = await q
    if (error) console.error('Erro ao carregar pacientes:', error.message)
    pacientes.value = data ?? []
    total.value = count ?? 0
  } finally {
    carregando.value = false
  }
}

const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))

// Reseta para página 1 ao mudar filtros
watch([busca, filtroSexo, filtroTelefone, filtroSus, ordenar], () => {
  pagina.value = 1
})

let debounceTimer: ReturnType<typeof setTimeout>
watch(busca, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(carregar, 300)
})

watch([filtroSexo, filtroTelefone, filtroSus, ordenar, pagina], carregar)

onMounted(carregar)

function formatarCPF(cpf: string): string {
  return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? '—'
}

function formatarTelefone(tel: string): string {
  const d = tel.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return tel
}

function whatsappLink(tel: string): string {
  const d = tel.replace(/\D/g, '')
  return `https://wa.me/${d.startsWith('55') ? d : '55' + d}`
}

const temFiltroAtivo = computed(() =>
  !!filtroSexo.value || filtroTelefone.value || filtroSus.value || ordenar.value !== 'nome_asc'
)

function limparFiltros() {
  filtroSexo.value = ''
  filtroTelefone.value = false
  filtroSus.value = false
  ordenar.value = 'nome_asc'
  busca.value = ''
}

const modalCadastro = ref(false)

// Agendamento rápido
const medicos = ref<{ id: string; nome: string; especialidade: string }[]>([])
const salasDaUnidade = ref<{ slug: string; nome: string }[]>([])
const agendandoPaciente = ref<Paciente | null>(null)
const agForm = ref({ medico_id: '', data_consulta: '', motivo: '', observacoes: '', sala_slug: '' })
const salvandoAg = ref(false)
const erroAg = ref('')

async function abrirAgendar(p: Paciente) {
  if (!medicos.value.length) {
    const { data } = await supabase.from('medicos').select('id, nome, especialidade').eq('ativo', true).order('especialidade,nome')
    medicos.value = data ?? []
  }
  // Só mostra as salas da unidade do próprio paciente — a sala pertence à
  // unidade, então não faz sentido oferecer sala de outro lugar.
  salasDaUnidade.value = []
  if (p.unidade_id) {
    const { data } = await supabase.from('salas').select('slug, nome').eq('unidade_id', p.unidade_id).eq('ativo', true).order('nome')
    salasDaUnidade.value = data ?? []
  }
  const hoje = new Date()
  agForm.value = {
    medico_id: medicos.value[0]?.id ?? '',
    data_consulta: `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`,
    motivo: '',
    observacoes: '',
    sala_slug: '',
  }
  erroAg.value = ''
  agendandoPaciente.value = p
}

async function confirmarAgendamento() {
  if (!agendandoPaciente.value || !agForm.value.medico_id || !agForm.value.data_consulta) return
  salvandoAg.value = true
  erroAg.value = ''
  const { error } = await supabase.from('agendamentos').insert({
    paciente_id: agendandoPaciente.value.id,
    medico_id: agForm.value.medico_id,
    data_consulta: agForm.value.data_consulta,
    motivo: agForm.value.motivo || null,
    observacoes: agForm.value.observacoes || null,
    sala_slug: agForm.value.sala_slug || null,
    origem: 'manual',
    status: 'agendado',
  })
  salvandoAg.value = false
  if (error) { erroAg.value = error.message; return }
  try {
    const med = medicos.value.find((m) => m.id === agForm.value.medico_id)
    await adminLog.registrar('agendamento_criado', {
      entidade: 'agendamento',
      detalhes: {
        paciente: agendandoPaciente.value.nome,
        medico: med?.nome,
        data: agForm.value.data_consulta,
        origem: 'manual',
      },
    })
  } catch {}
  agendandoPaciente.value = null
}

const paginasVisiveis = computed(() => {
  const total = totalPaginas.value
  const atual = pagina.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(total - 1, atual + 1); i++) pages.push(i)
  if (atual < total - 2) pages.push('...')
  pages.push(total)
  return pages
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">Pacientes</h1>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">
          {{ carregando ? '…' : `${total} paciente${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` }}
        </p>
      </div>
      <UiButton variant="primary" @click="modalCadastro = true">
        <UserPlus :size="16" /> Novo Paciente
      </UiButton>
    </div>

    <!-- Barra de busca + filtros -->
    <div class="bg-white rounded-2xl border p-4 space-y-4" style="border-color:var(--color-border)">
      <!-- Busca -->
      <div class="relative">
        <Search :size="17" class="absolute left-3.5 top-1/2 -translate-y-1/2" style="color:var(--color-text-dim)" />
        <input
          v-model="busca"
          placeholder="Buscar por nome, CPF ou cartão SUS..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-blue-400"
          style="border-color:var(--color-border);background:var(--color-surface-2)"
        />
      </div>

      <!-- Chips de filtro -->
      <div class="flex flex-wrap gap-2 items-center">
        <span class="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)] shrink-0">
          <Filter :size="13" /> Filtros:
        </span>

        <!-- Sexo -->
        <button
          v-for="op in [{ v: '', l: 'Todos' }, { v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }, { v: 'O', l: 'Outro' }]"
          :key="op.v"
          class="px-3 py-1 rounded-full text-xs font-semibold transition-all border"
          :style="filtroSexo === op.v
            ? 'background:#2563eb;color:white;border-color:#2563eb'
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="filtroSexo = op.v as typeof filtroSexo"
        >
          {{ op.l }}
        </button>

        <div class="w-px h-5 shrink-0" style="background:var(--color-border)" />

        <!-- Com telefone -->
        <button
          class="px-3 py-1 rounded-full text-xs font-semibold transition-all border"
          :style="filtroTelefone
            ? 'background:#16a34a;color:white;border-color:#16a34a'
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="filtroTelefone = !filtroTelefone"
        >
          📞 Com telefone
        </button>

        <!-- Com SUS -->
        <button
          class="px-3 py-1 rounded-full text-xs font-semibold transition-all border"
          :style="filtroSus
            ? 'background:#7c3aed;color:white;border-color:#7c3aed'
            : 'background:white;color:var(--color-text-muted);border-color:var(--color-border)'"
          @click="filtroSus = !filtroSus"
        >
          🏥 Com cartão SUS
        </button>

        <div class="w-px h-5 shrink-0" style="background:var(--color-border)" />

        <!-- Ordenação -->
        <select
          v-model="ordenar"
          class="px-3 py-1 rounded-full text-xs font-semibold border outline-none cursor-pointer"
          style="border-color:var(--color-border);color:var(--color-text-muted);background:white"
        >
          <option value="nome_asc">Nome A→Z</option>
          <option value="nome_desc">Nome Z→A</option>
          <option value="recentes">Mais recentes</option>
        </select>

        <!-- Limpar -->
        <button
          v-if="temFiltroAtivo"
          class="px-3 py-1 rounded-full text-xs font-semibold transition-all"
          style="color:#ef4444;background:#fef2f2;border:1px solid #fecaca"
          @click="limparFiltros"
        >
          ✕ Limpar
        </button>
      </div>
    </div>

    <!-- Tabela -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
      <!-- Loading -->
      <div v-if="carregando" class="p-8 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>

      <!-- Vazio -->
      <div v-else-if="pacientes.length === 0" class="py-16 text-center">
        <Users2 :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
        <p class="text-[var(--color-text-muted)] font-medium">Nenhum paciente encontrado</p>
        <button v-if="temFiltroAtivo || busca" class="mt-2 text-sm text-blue-500 hover:underline" @click="limparFiltros">
          Limpar filtros
        </button>
      </div>

      <!-- Linhas -->
      <template v-else>
        <table class="w-full text-sm">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border-light);background:var(--color-surface-2)">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Nome</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">CPF</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style="color:var(--color-text-muted)">SUS</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style="color:var(--color-text-muted)">Nascimento</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Contato</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in pacientes"
              :key="p.id"
              class="border-b cursor-pointer transition-colors hover:bg-blue-50"
              style="border-color:var(--color-border-light)"
              @click="navigateTo(`/admin/pacientes/${p.id}`)"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <UiAvatar :name="p.nome" size="xs" />
                  <div>
                    <p class="font-medium text-[var(--color-text)]">{{ p.nome }}</p>
                    <p class="text-xs mt-0.5" style="color:var(--color-text-dim)">
                      {{ p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Feminino' : p.sexo === 'O' ? 'Outro' : '—' }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="font-mono text-xs" style="color:var(--color-text-muted)">{{ formatarCPF(p.cpf) }}</span>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">
                <span v-if="p.sus_cartao" class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style="background:#f3e8ff;color:#7c3aed">
                  🏥 {{ p.sus_cartao }}
                </span>
                <span v-else class="text-xs" style="color:var(--color-text-dim)">—</span>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell text-xs" style="color:var(--color-text-muted)">
                {{ p.data_nascimento ? new Date(p.data_nascimento).toLocaleDateString('pt-BR') : '—' }}
              </td>
              <td class="px-4 py-3" @click.stop>
                <div class="flex items-center gap-1">
                  <a
                    v-if="p.telefone"
                    :href="`tel:${p.telefone}`"
                    title="Ligar"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                    style="background:#eff6ff;color:#2563eb"
                  >
                    <Phone :size="13" />
                  </a>
                  <a
                    v-if="p.telefone"
                    :href="whatsappLink(p.telefone)"
                    target="_blank"
                    rel="noopener"
                    title="WhatsApp"
                    class="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                    style="background:#dcfce7;color:#16a34a"
                  >
                    <MessageCircle :size="13" />
                  </a>
                  <span v-if="!p.telefone" class="text-xs" style="color:var(--color-text-dim)">—</span>
                </div>
              </td>
              <td class="px-4 py-3" @click.stop>
                <button
                  title="Agendar consulta"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                  style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0"
                  @click.stop="abrirAgendar(p)"
                >
                  <CalendarPlus :size="13" /> Agendar
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Paginação -->
        <div
          v-if="totalPaginas > 1"
          class="flex items-center justify-between px-4 py-3"
          style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)"
        >
          <p class="text-xs" style="color:var(--color-text-muted)">
            {{ (pagina - 1) * POR_PAGINA + 1 }}–{{ Math.min(pagina * POR_PAGINA, total) }} de {{ total }}
          </p>
          <div class="flex items-center gap-1">
            <button
              :disabled="pagina === 1"
              class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style="background:white;border:1px solid var(--color-border)"
              @click="pagina--"
            >
              <ChevronLeft :size="15" />
            </button>
            <button
              v-for="p in paginasVisiveis"
              :key="p"
              class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors"
              :style="p === pagina
                ? 'background:#2563eb;color:white;border:1px solid #2563eb'
                : p === '...'
                  ? 'background:transparent;color:var(--color-text-dim);cursor:default;border:none'
                  : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
              :disabled="p === '...'"
              @click="typeof p === 'number' && (pagina = p)"
            >
              {{ p }}
            </button>
            <button
              :disabled="pagina === totalPaginas"
              class="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style="background:white;border:1px solid var(--color-border)"
              @click="pagina++"
            >
              <ChevronRight :size="15" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Modal cadastro -->
    <AdminCadastroPacienteModal
      v-if="modalCadastro"
      @close="modalCadastro = false"
      @criado="(p) => { modalCadastro = false; carregar(); navigateTo(`/admin/pacientes/${p.id}`) }"
    />

    <!-- Modal agendamento rápido -->
    <UiModal v-if="agendandoPaciente" :model-value="true" title="Agendar Consulta" size="sm" @update:model-value="agendandoPaciente = null">
      <div class="space-y-4">
        <div class="p-3 rounded-xl" style="background:var(--color-surface-2)">
          <p class="font-semibold text-sm text-[var(--color-text)]">{{ agendandoPaciente.nome }}</p>
          <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{{ agendandoPaciente.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') }}</p>
        </div>
        <div>
          <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Médico *</label>
          <select v-model="agForm.medico_id" class="input-base">
            <option value="">Selecione</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.nome }} — {{ m.especialidade }}</option>
          </select>
        </div>
        <UiInput v-model="agForm.data_consulta" label="Data *" type="date" />
        <div>
          <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Motivo</label>
          <input v-model="agForm.motivo" type="text" class="input-base" placeholder="Opcional" />
        </div>
        <div>
          <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Observação</label>
          <input v-model="agForm.observacoes" type="text" class="input-base" placeholder="Opcional" />
        </div>
        <div>
          <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">Sala</label>
          <select v-model="agForm.sala_slug" class="input-base" :disabled="!salasDaUnidade.length">
            <option value="">Selecione…</option>
            <option v-for="s in salasDaUnidade" :key="s.slug" :value="s.slug">{{ s.nome }}</option>
          </select>
          <p v-if="!agendandoPaciente?.unidade_id" class="text-xs mt-1" style="color:#dc2626">
            Paciente sem unidade cadastrada — defina uma unidade antes pra escolher a sala.
          </p>
          <p v-else-if="!salasDaUnidade.length" class="text-xs mt-1" style="color:#dc2626">
            Essa unidade não tem salas cadastradas.
          </p>
        </div>
        <p v-if="erroAg" class="text-xs text-red-600">{{ erroAg }}</p>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="agendandoPaciente = null">Cancelar</UiButton>
        <UiButton variant="primary" :loading="salvandoAg" :disabled="!agForm.medico_id || !agForm.data_consulta" @click="confirmarAgendamento">Agendar</UiButton>
      </template>
    </UiModal>
  </div>
</template>

