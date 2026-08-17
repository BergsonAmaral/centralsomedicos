<script setup lang="ts">
import { Building2, Stethoscope, CalendarDays, Clock, User, ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-vue-next'
import type { Unidade, Medico } from '~/types'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function formatarCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function formatarTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{0,5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

// ── Passo 1: unidade ──────────────────────────────────────────
const passo = ref(1)
const unidades = ref<Unidade[]>([])
const unidadeSelecionada = ref<Unidade | null>(null)
const carregandoUnidades = ref(true)

// ── Passo 2: médico ───────────────────────────────────────────
const medicos = ref<Medico[]>([])
const medicoSelecionado = ref<Medico | null>(null)
const carregandoMedicos = ref(true)

const medicosPorEspecialidade = computed(() => {
  const grupos: Record<string, Medico[]> = {}
  for (const m of medicos.value) (grupos[m.especialidade] ??= []).push(m)
  return grupos
})

// ── Passo 3: dia ───────────────────────────────────────────────
function dataLocal(offsetDias: number): { iso: string; date: Date } {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  d.setHours(0, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return { iso: `${y}-${m}-${dd}`, date: d }
}

const diasDisponiveis = computed(() => {
  if (!medicoSelecionado.value) return []
  const dias: { iso: string; label: string; diaSemana: string }[] = []
  for (let i = 0; i < 30 && dias.length < 14; i++) {
    const { iso, date } = dataLocal(i)
    if (medicoSelecionado.value.dias_atendimento.includes(date.getDay())) {
      dias.push({
        iso,
        label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        diaSemana: DIAS_SEMANA[date.getDay()] ?? '',
      })
    }
  }
  return dias
})
const diaSelecionado = ref<string>('')

// ── Passo 4: horário ─────────────────────────────────────────
const horariosOcupados = ref<Set<string>>(new Set())
const carregandoHorarios = ref(false)
const horarioSelecionado = ref<string>('')

async function carregarOcupados() {
  if (!medicoSelecionado.value || !diaSelecionado.value) return
  carregandoHorarios.value = true
  horarioSelecionado.value = ''
  const { data } = await supabase
    .from('agendamentos')
    .select('horario')
    .eq('medico_id', medicoSelecionado.value.id)
    .eq('data_consulta', diaSelecionado.value)
    .neq('status', 'cancelado')
    .not('horario', 'is', null)
  horariosOcupados.value = new Set((data ?? []).map((a: any) => (a.horario as string).slice(0, 5)))
  carregandoHorarios.value = false
}
watch(diaSelecionado, (v) => { if (v) carregarOcupados() })

const horariosDisponiveis = computed(() => {
  const m = medicoSelecionado.value
  if (!m || !diaSelecionado.value) return []
  const [hiH, hiM] = m.horario_inicio.split(':').map(Number) as [number, number]
  const [hfH, hfM] = m.horario_fim.split(':').map(Number) as [number, number]
  const inicio = hiH * 60 + hiM
  const fim = hfH * 60 + hfM
  const passo = m.duracao_slot_min || 15

  const agora = new Date()
  const ehHoje = diaSelecionado.value === dataLocal(0).iso
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()

  const lista: string[] = []
  for (let min = inicio; min < fim; min += passo) {
    if (ehHoje && min <= minutosAgora) continue
    const hh = String(Math.floor(min / 60)).padStart(2, '0')
    const mm = String(min % 60).padStart(2, '0')
    const hora = `${hh}:${mm}`
    if (!horariosOcupados.value.has(hora)) lista.push(hora)
  }
  return lista
})

// ── Passo 5: dados do paciente ──────────────────────────────
const nome = ref('')
const cpf = ref('')
const dataNascimento = ref('')
const telefone = ref('')
const email = ref('')
const motivo = ref('')
const erroForm = ref('')

function validarForm(): string | null {
  if (!nome.value.trim()) return 'Informe seu nome completo.'
  const cpfNum = cpf.value.replace(/\D/g, '')
  if (cpfNum.length !== 11) return 'CPF deve ter 11 dígitos.'
  if (!cpfValido(cpfNum)) return 'CPF inválido — confira os números digitados.'
  if (!dataNascimento.value) return 'Informe sua data de nascimento.'
  return null
}

// ── Envio ────────────────────────────────────────────────────
const enviando = ref(false)
const erroEnvio = ref('')
const concluido = ref(false)

async function confirmarAgendamento() {
  erroEnvio.value = ''
  const erro = validarForm()
  if (erro) { erroForm.value = erro; return }
  erroForm.value = ''
  enviando.value = true
  try {
    await $fetch('/api/publico/agendar', {
      method: 'POST',
      body: {
        medicoId: medicoSelecionado.value?.id,
        unidadeId: unidadeSelecionada.value?.id,
        data: diaSelecionado.value,
        horario: horarioSelecionado.value,
        nome: nome.value,
        cpf: cpf.value,
        dataNascimento: dataNascimento.value,
        telefone: telefone.value || undefined,
        email: email.value || undefined,
        motivo: motivo.value || undefined,
      },
    })
    concluido.value = true
  } catch (e: any) {
    const msg = e?.data?.message ?? 'Erro ao confirmar agendamento. Tente novamente.'
    erroEnvio.value = msg
    // Horário ocupado por outra pessoa nesse meio tempo — volta pro passo de horário
    if (e?.statusCode === 409 || e?.status === 409) {
      passo.value = 4
      carregarOcupados()
    }
  } finally {
    enviando.value = false
  }
}

// ── Navegação entre passos ──────────────────────────────────
function irPara(p: number) { passo.value = p }
function escolherUnidade(u: Unidade) { unidadeSelecionada.value = u; passo.value = 2 }
function escolherMedico(m: Medico) { medicoSelecionado.value = m; diaSelecionado.value = ''; horarioSelecionado.value = ''; passo.value = 3 }
function escolherDia(iso: string) { diaSelecionado.value = iso; passo.value = 4 }
function escolherHorario(h: string) { horarioSelecionado.value = h; passo.value = 5 }

onMounted(async () => {
  const { data: uData } = await supabase.from('unidades').select('*').eq('ativo', true).order('nome')
  unidades.value = uData ?? []
  carregandoUnidades.value = false

  const { data: mData } = await supabase.from('medicos').select('*').eq('ativo', true).order('especialidade,nome')
  medicos.value = (mData ?? []) as Medico[]
  carregandoMedicos.value = false
})

function reiniciar() {
  concluido.value = false
  unidadeSelecionada.value = null
  medicoSelecionado.value = null
  diaSelecionado.value = ''
  horarioSelecionado.value = ''
  nome.value = ''; cpf.value = ''; dataNascimento.value = ''; telefone.value = ''; email.value = ''; motivo.value = ''
  passo.value = 1
}
</script>

<template>
  <div class="agendar-page min-h-screen">
    <div class="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <img src="/logo.png" alt="Central SóMedicos" style="height:80px" class="object-contain" />
        <p class="text-sm mt-2" style="color:#767670">Marque sua consulta online</p>
      </div>

      <!-- Sucesso -->
      <div v-if="concluido" class="ag-card text-center py-10 px-6">
        <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style="background:#dcfce7">
          <Check :size="30" style="color:#16a34a" />
        </div>
        <h2 class="text-xl font-bold mb-2" style="color:#0A0C09">Consulta agendada!</h2>
        <p class="text-sm mb-6" style="color:#767670">
          {{ nome }}, sua consulta com <strong>{{ medicoSelecionado?.nome }}</strong> ({{ medicoSelecionado?.especialidade }})
          está marcada para <strong>{{ diaSelecionado.split('-').reverse().join('/') }} às {{ horarioSelecionado }}</strong>.
        </p>
        <div class="ag-info-box text-left text-sm mb-6">
          <div class="flex items-center gap-2 mb-1.5">
            <Building2 :size="15" style="color:#2daa8a" />
            <span><strong>Onde:</strong> {{ unidadeSelecionada?.nome }}<span v-if="unidadeSelecionada?.cidade"> — {{ unidadeSelecionada.cidade }}</span></span>
          </div>
          <p style="color:#767670">Chegue com um pouco de antecedência e leve um documento com foto.</p>
        </div>
        <button type="button" class="ag-btn-primary" @click="reiniciar">Marcar outra consulta</button>
      </div>

      <!-- Wizard -->
      <div v-else class="ag-card">
        <!-- Indicador de passos -->
        <div class="flex items-center gap-1.5 px-6 pt-5">
          <div v-for="p in 5" :key="p" class="h-1.5 flex-1 rounded-full" :style="p <= passo ? 'background:#2daa8a' : 'background:#e5e3dc'" />
        </div>

        <div class="p-6">
          <!-- Passo 1: Unidade -->
          <template v-if="passo === 1">
            <h2 class="ag-title"><Building2 :size="18" /> Escolha a unidade</h2>
            <p class="ag-subtitle">Onde você vai comparecer no dia da consulta.</p>
            <div v-if="carregandoUnidades" class="py-8 text-center text-sm" style="color:#767670">Carregando…</div>
            <div v-else-if="!unidades.length" class="py-8 text-center text-sm" style="color:#767670">Nenhuma unidade disponível no momento.</div>
            <div v-else class="space-y-2">
              <button
                v-for="u in unidades" :key="u.id" type="button"
                class="ag-option"
                @click="escolherUnidade(u)"
              >
                <span class="font-semibold" style="color:#0A0C09">{{ u.nome }}</span>
                <span v-if="u.cidade" class="text-xs block mt-0.5" style="color:#767670">{{ u.cidade }}</span>
              </button>
            </div>
          </template>

          <!-- Passo 2: Médico -->
          <template v-else-if="passo === 2">
            <button type="button" class="ag-voltar" @click="irPara(1)"><ChevronLeft :size="16" /> Voltar</button>
            <h2 class="ag-title"><Stethoscope :size="18" /> Escolha o especialista</h2>
            <p class="ag-subtitle">Unidade: <strong>{{ unidadeSelecionada?.nome }}</strong></p>
            <div v-if="carregandoMedicos" class="py-8 text-center text-sm" style="color:#767670">Carregando…</div>
            <div v-else-if="!medicos.length" class="py-8 text-center text-sm" style="color:#767670">Nenhum médico disponível no momento.</div>
            <div v-else class="space-y-4">
              <div v-for="(lista, esp) in medicosPorEspecialidade" :key="esp">
                <p class="text-xs font-bold uppercase tracking-wider mb-2" style="color:#a3a199">{{ esp }}</p>
                <div class="space-y-2">
                  <button
                    v-for="m in lista" :key="m.id" type="button"
                    class="ag-option"
                    @click="escolherMedico(m)"
                  >
                    <span class="font-semibold" style="color:#0A0C09">{{ m.nome }}</span>
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- Passo 3: Dia -->
          <template v-else-if="passo === 3">
            <button type="button" class="ag-voltar" @click="irPara(2)"><ChevronLeft :size="16" /> Voltar</button>
            <h2 class="ag-title"><CalendarDays :size="18" /> Escolha o dia</h2>
            <p class="ag-subtitle">{{ medicoSelecionado?.nome }} — {{ medicoSelecionado?.especialidade }}</p>
            <div v-if="!diasDisponiveis.length" class="py-8 text-center text-sm" style="color:#767670">
              Sem dias disponíveis nos próximos 30 dias.
            </div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="d in diasDisponiveis" :key="d.iso" type="button"
                class="ag-option text-center"
                @click="escolherDia(d.iso)"
              >
                <span class="text-xs block" style="color:#767670">{{ d.diaSemana }}</span>
                <span class="font-semibold" style="color:#0A0C09">{{ d.label }}</span>
              </button>
            </div>
          </template>

          <!-- Passo 4: Horário -->
          <template v-else-if="passo === 4">
            <button type="button" class="ag-voltar" @click="irPara(3)"><ChevronLeft :size="16" /> Voltar</button>
            <h2 class="ag-title"><Clock :size="18" /> Escolha o horário</h2>
            <p class="ag-subtitle">{{ diaSelecionado.split('-').reverse().join('/') }}</p>
            <div v-if="carregandoHorarios" class="py-8 text-center text-sm" style="color:#767670">Carregando…</div>
            <div v-else-if="!horariosDisponiveis.length" class="py-8 text-center text-sm" style="color:#767670">
              Nenhum horário livre nesse dia. Volte e escolha outra data.
            </div>
            <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="h in horariosDisponiveis" :key="h" type="button"
                class="ag-option text-center"
                @click="escolherHorario(h)"
              >
                <span class="font-semibold" style="color:#0A0C09">{{ h }}</span>
              </button>
            </div>
          </template>

          <!-- Passo 5: Dados do paciente -->
          <template v-else-if="passo === 5">
            <button type="button" class="ag-voltar" @click="irPara(4)"><ChevronLeft :size="16" /> Voltar</button>
            <h2 class="ag-title"><User :size="18" /> Seus dados</h2>
            <p class="ag-subtitle">
              {{ medicoSelecionado?.nome }} · {{ diaSelecionado.split('-').reverse().join('/') }} às {{ horarioSelecionado }}
            </p>

            <div class="space-y-3">
              <div>
                <label class="ag-label">Nome completo *</label>
                <input v-model="nome" type="text" class="ag-input" placeholder="Seu nome" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="ag-label">CPF *</label>
                  <input :value="cpf" type="text" class="ag-input font-mono" placeholder="000.000.000-00" @input="cpf = formatarCPF(($event.target as HTMLInputElement).value)" />
                </div>
                <div>
                  <label class="ag-label">Nascimento *</label>
                  <input v-model="dataNascimento" type="date" class="ag-input" />
                </div>
              </div>
              <div>
                <label class="ag-label">Telefone (opcional)</label>
                <input :value="telefone" type="text" class="ag-input" placeholder="(00) 00000-0000" @input="telefone = formatarTelefone(($event.target as HTMLInputElement).value)" />
              </div>
              <div>
                <label class="ag-label">E-mail (opcional)</label>
                <input v-model="email" type="email" class="ag-input" placeholder="seu@email.com" />
              </div>
              <div>
                <label class="ag-label">Motivo da consulta (opcional)</label>
                <input v-model="motivo" type="text" class="ag-input" placeholder="Ex.: dor de cabeça, retorno..." />
              </div>

              <p v-if="erroForm" class="ag-erro"><AlertCircle :size="14" /> {{ erroForm }}</p>
              <p v-if="erroEnvio" class="ag-erro"><AlertCircle :size="14" /> {{ erroEnvio }}</p>

              <button type="button" class="ag-btn-primary w-full" :disabled="enviando" @click="confirmarAgendamento">
                {{ enviando ? 'Confirmando…' : 'Confirmar agendamento' }}
              </button>
            </div>
          </template>
        </div>
      </div>

      <p class="text-center text-xs mt-6" style="color:#a3a199">
        Já tem cadastro? Fale com a recepção da unidade.
      </p>
    </div>
  </div>
</template>

<style scoped>
.agendar-page { background:#F2F0EA; font-family:'Inter',sans-serif; }
.ag-card { background:#fff; border-radius:1.25rem; border:1px solid rgba(10,12,9,0.08); box-shadow:0 20px 50px -20px rgba(10,12,9,0.12); overflow:hidden; }
.ag-title { display:flex; align-items:center; gap:0.5rem; font-family:'DM Sans',sans-serif; font-size:1.1rem; font-weight:700; color:#0A0C09; margin-bottom:0.25rem; }
.ag-subtitle { font-size:0.8125rem; color:#767670; margin-bottom:1.25rem; }
.ag-voltar { display:inline-flex; align-items:center; gap:0.25rem; font-size:0.8125rem; font-weight:600; color:#767670; margin-bottom:0.75rem; background:none; border:none; cursor:pointer; padding:0; }
.ag-voltar:hover { color:#0A0C09; }
.ag-option {
  display:block; width:100%; text-align:left; padding:0.9rem 1.1rem; border-radius:0.85rem;
  border:1px solid rgba(10,12,9,0.1); background:#F9F8F4; cursor:pointer; transition:border-color 150ms, background 150ms;
}
.ag-option:hover { border-color:#2daa8a; background:#fff; }
.ag-label { font-size:0.6875rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#0A0C09; display:block; margin-bottom:0.35rem; }
.ag-input {
  width:100%; padding:0.625rem 0.875rem; font-size:0.875rem; border-radius:0.65rem;
  border:1px solid rgba(10,12,9,0.12); background:#F9F8F4; color:#0A0C09; outline:none;
}
.ag-input:focus { border-color:#2daa8a; box-shadow:0 0 0 3px rgba(45,170,138,0.14); background:#fff; }
.ag-btn-primary {
  display:inline-flex; align-items:center; justify-content:center; gap:0.5rem;
  padding:0.8rem 1.5rem; border-radius:100px; background:#2daa8a; color:#fff;
  font-size:0.875rem; font-weight:700; border:none; cursor:pointer; transition:opacity 150ms;
}
.ag-btn-primary:disabled { opacity:0.55; cursor:not-allowed; }
.ag-btn-primary:not(:disabled):hover { opacity:0.9; }
.ag-erro { display:flex; align-items:center; gap:0.4rem; font-size:0.8125rem; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; padding:0.6rem 0.75rem; border-radius:0.6rem; }
.ag-info-box { background:#F9F8F4; border-radius:0.85rem; padding:0.9rem 1rem; }
</style>
