<script setup lang="ts">
import { Search, Phone, MessageCircle, ChevronLeft, ChevronRight, Users2, UserPlus, CalendarPlus } from 'lucide-vue-next'
import type { Paciente } from '~/types'

definePageMeta({ layout: 'atendente', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()

const busca = ref('')
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

    // RLS já restringe à unidade do atendente — não precisa filtrar aqui
    let q = supabase.from('pacientes').select('*', { count: 'exact' }).order('nome').range(from, to)

    if (busca.value.trim()) {
      const termo = busca.value.trim()
      const somenteDigitos = termo.replace(/\D/g, '')
      if (somenteDigitos.length >= 6) {
        q = q.or(`cpf.ilike.%${somenteDigitos}%,sus_cartao.ilike.%${termo}%`)
      } else {
        q = q.ilike('nome', `%${termo}%`)
      }
    }

    const { data, count } = await q
    pacientes.value = data ?? []
    total.value = count ?? 0
  } finally {
    carregando.value = false
  }
}

watch(busca, () => { pagina.value = 1 })
let debounceTimer: ReturnType<typeof setTimeout>
watch(busca, () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(carregar, 300) })
watch(pagina, carregar)
onMounted(carregar)

function formatarCPF(cpf: string): string {
  return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? '—'
}
function whatsappLink(tel: string): string {
  const d = tel.replace(/\D/g, '')
  return `https://wa.me/${d.startsWith('55') ? d : '55' + d}`
}

const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / POR_PAGINA)))
const paginasVisiveis = computed(() => {
  const t = totalPaginas.value
  const atual = pagina.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (atual > 3) pages.push('...')
  for (let i = Math.max(2, atual - 1); i <= Math.min(t - 1, atual + 1); i++) pages.push(i)
  if (atual < t - 2) pages.push('...')
  pages.push(t)
  return pages
})

const modalCadastro = ref(false)

// Agendamento rápido
const medicos = ref<{ id: string; nome: string; especialidade: string }[]>([])
const agendandoPaciente = ref<Paciente | null>(null)
const agForm = ref({ medico_id: '', data_consulta: '', motivo: '', observacoes: '' })
const salvandoAg = ref(false)
const erroAg = ref('')

async function abrirAgendar(p: Paciente) {
  if (!medicos.value.length) {
    const { data } = await supabase.from('medicos').select('id, nome, especialidade').eq('ativo', true).order('especialidade,nome')
    medicos.value = data ?? []
  }
  const hoje = new Date()
  agForm.value = {
    medico_id: medicos.value[0]?.id ?? '',
    data_consulta: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`,
    motivo: '',
    observacoes: '',
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
    origem: 'manual',
    status: 'agendado',
  })
  salvandoAg.value = false
  if (error) { erroAg.value = error.message; return }
  agendandoPaciente.value = null
}
</script>

<template>
  <div class="space-y-5">
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

    <div class="bg-white rounded-2xl border p-4" style="border-color:var(--color-border)">
      <div class="relative">
        <Search :size="17" class="absolute left-3.5 top-1/2 -translate-y-1/2" style="color:var(--color-text-dim)" />
        <input
          v-model="busca"
          placeholder="Buscar por nome, CPF ou cartão SUS..."
          class="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-blue-400"
          style="border-color:var(--color-border);background:var(--color-surface-2)"
        />
      </div>
    </div>

    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:var(--color-border)">
      <div v-if="carregando" class="p-8 text-center">
        <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>

      <div v-else-if="pacientes.length === 0" class="py-16 text-center">
        <Users2 :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
        <p class="text-[var(--color-text-muted)] font-medium">Nenhum paciente encontrado</p>
      </div>

      <template v-else>
        <table class="w-full text-sm">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border-light);background:var(--color-surface-2)">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Nome</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style="color:var(--color-text-muted)">CPF</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style="color:var(--color-text-muted)">Nascimento</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style="color:var(--color-text-muted)">Contato</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pacientes" :key="p.id" class="border-b" style="border-color:var(--color-border-light)">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <UiAvatar :name="p.nome" size="xs" />
                  <p class="font-medium text-[var(--color-text)]">{{ p.nome }}</p>
                </div>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="font-mono text-xs" style="color:var(--color-text-muted)">{{ formatarCPF(p.cpf) }}</span>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell text-xs" style="color:var(--color-text-muted)">
                {{ p.data_nascimento ? new Date(p.data_nascimento).toLocaleDateString('pt-BR') : '—' }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <a v-if="p.telefone" :href="`tel:${p.telefone}`" title="Ligar" class="inline-flex items-center justify-center w-7 h-7 rounded-lg" style="background:#eff6ff;color:#2563eb">
                    <Phone :size="13" />
                  </a>
                  <a v-if="p.telefone" :href="whatsappLink(p.telefone)" target="_blank" rel="noopener" title="WhatsApp" class="inline-flex items-center justify-center w-7 h-7 rounded-lg" style="background:#dcfce7;color:#16a34a">
                    <MessageCircle :size="13" />
                  </a>
                  <span v-if="!p.telefone" class="text-xs" style="color:var(--color-text-dim)">—</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <button
                  title="Agendar consulta"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                  style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0"
                  @click="abrirAgendar(p)"
                >
                  <CalendarPlus :size="13" /> Agendar
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalPaginas > 1" class="flex items-center justify-between px-4 py-3" style="border-top:1px solid var(--color-border-light);background:var(--color-surface-2)">
          <p class="text-xs" style="color:var(--color-text-muted)">
            {{ (pagina - 1) * POR_PAGINA + 1 }}–{{ Math.min(pagina * POR_PAGINA, total) }} de {{ total }}
          </p>
          <div class="flex items-center gap-1">
            <button :disabled="pagina === 1" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="pagina--"><ChevronLeft :size="15" /></button>
            <button
              v-for="p in paginasVisiveis" :key="p" class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold"
              :style="p === pagina ? 'background:#2563eb;color:white;border:1px solid #2563eb' : p === '...' ? 'background:transparent;color:var(--color-text-dim);cursor:default;border:none' : 'background:white;color:var(--color-text-muted);border:1px solid var(--color-border)'"
              :disabled="p === '...'" @click="typeof p === 'number' && (pagina = p)"
            >{{ p }}</button>
            <button :disabled="pagina === totalPaginas" class="p-1.5 rounded-lg disabled:opacity-30" style="background:white;border:1px solid var(--color-border)" @click="pagina++"><ChevronRight :size="15" /></button>
          </div>
        </div>
      </template>
    </div>

    <AtendenteCadastroPacienteModal
      v-if="modalCadastro"
      @close="modalCadastro = false"
      @criado="() => { modalCadastro = false; carregar() }"
    />

    <UiModal v-if="agendandoPaciente" :model-value="true" title="Agendar Consulta" size="sm" @update:model-value="agendandoPaciente = null">
      <div class="space-y-4">
        <div class="p-3 rounded-xl" style="background:var(--color-surface-2)">
          <p class="font-semibold text-sm text-[var(--color-text)]">{{ agendandoPaciente.nome }}</p>
          <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{{ formatarCPF(agendandoPaciente.cpf) }}</p>
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
        <p v-if="erroAg" class="text-xs text-red-600">{{ erroAg }}</p>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="agendandoPaciente = null">Cancelar</UiButton>
        <UiButton variant="primary" :loading="salvandoAg" :disabled="!agForm.medico_id || !agForm.data_consulta" @click="confirmarAgendamento">Agendar</UiButton>
      </template>
    </UiModal>
  </div>
</template>
