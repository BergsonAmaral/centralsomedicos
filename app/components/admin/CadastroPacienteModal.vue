<script setup lang="ts">
import { UserPlus, X } from 'lucide-vue-next'

const emit = defineEmits<{ close: []; criado: [paciente: { id: string; nome: string }] }>()

const supabase = useSupabaseClient()
const adminLog = useAdminLog()

const erro = ref('')
const salvando = ref(false)
const sucesso = ref(false)

// Dados do paciente
const nome = ref('')
const cpf = ref('')
const susCartao = ref('')
const dataNascimento = ref('')
const sexo = ref<'M' | 'F' | 'O' | ''>('')
const telefone = ref('')
const email = ref('')
const unidadeId = ref('')

const unidades = ref<{ id: string; nome: string }[]>([])

// Agendamento opcional
const criarAgendamento = ref(false)
const dataConsulta = ref('')
const motivo = ref('')
const medicoId = ref('')

const medicos = ref<{ id: string; nome: string; especialidade: string }[]>([])

onMounted(async () => {
  const { data } = await supabase
    .from('medicos')
    .select('id, nome, especialidade')
    .eq('ativo', true)
    .order('nome')
  medicos.value = data ?? []

  const { data: uData } = await supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome')
  unidades.value = uData ?? []
  // hoje (horário local) por padrão
  const d = new Date()
  dataConsulta.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

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

function validar(): string | null {
  if (!nome.value.trim()) return 'Informe o nome do paciente.'
  const cpfNum = cpf.value.replace(/\D/g, '')
  if (cpfNum.length !== 11) return 'CPF deve ter 11 dígitos.'
  if (!dataNascimento.value) return 'Informe a data de nascimento.'
  if (criarAgendamento.value) {
    if (!medicoId.value) return 'Selecione o médico para o agendamento.'
    if (!dataConsulta.value) return 'Informe a data da consulta.'
  }
  return null
}

async function salvar() {
  erro.value = ''
  const v = validar()
  if (v) { erro.value = v; return }

  salvando.value = true
  try {
    // 1. Verificar se CPF já existe
    const cpfNum = cpf.value.replace(/\D/g, '')
    const { data: existente } = await supabase
      .from('pacientes')
      .select('id, nome')
      .eq('cpf', cpfNum)
      .maybeSingle()

    let pacienteId: string
    let pacienteNome = nome.value.trim()

    if (existente) {
      pacienteId = existente.id
      pacienteNome = existente.nome
    } else {
      // 2. Criar paciente
      const { data: novo, error: errPac } = await supabase
        .from('pacientes')
        .insert({
          nome: nome.value.trim(),
          cpf: cpfNum,
          sus_cartao: susCartao.value.replace(/\D/g, '') || null,
          data_nascimento: dataNascimento.value,
          sexo: sexo.value || null,
          telefone: telefone.value.replace(/\D/g, '') || null,
          email: email.value.trim() || null,
          unidade_id: unidadeId.value || null,
        })
        .select('id, nome')
        .single()

      if (errPac || !novo) {
        erro.value = errPac?.message ?? 'Erro ao salvar paciente.'
        salvando.value = false
        return
      }
      pacienteId = novo.id

      try {
        await adminLog.registrar('paciente_criado', {
          entidade: 'paciente',
          entidadeId: pacienteId,
          detalhes: { nome: pacienteNome, cpf: cpfNum, origem: 'manual' },
        })
      } catch {}
    }

    // 3. Criar agendamento (se solicitado)
    if (criarAgendamento.value) {
      const med = medicos.value.find((m) => m.id === medicoId.value)
      const { error: errAg } = await supabase.from('agendamentos').insert({
        paciente_id: pacienteId,
        medico_id: medicoId.value,
        data_consulta: dataConsulta.value,
        motivo: motivo.value.trim() || null,
        origem: 'manual',
        status: 'agendado',
      })
      if (errAg) {
        erro.value = errAg.message
        salvando.value = false
        return
      }
      try {
        await adminLog.registrar('agendamento_criado', {
          entidade: 'agendamento',
          detalhes: {
            paciente: pacienteNome,
            medico: med?.nome,
            data: dataConsulta.value,
            origem: 'manual',
          },
        })
      } catch {}
    }

    sucesso.value = true
    setTimeout(() => {
      emit('criado', { id: pacienteId, nome: pacienteNome })
      emit('close')
    }, 800)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <UiModal :model-value="true" title="Cadastro manual de paciente" size="lg" @update:model-value="emit('close')">
    <div v-if="sucesso" class="py-8 text-center">
      <div class="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style="background:#dcfce7">
        <UserPlus :size="26" style="color:#16a34a" />
      </div>
      <p class="font-semibold text-[var(--color-text)]">Paciente cadastrado com sucesso</p>
    </div>

    <div v-else class="space-y-5">
      <!-- Identificação -->
      <div>
        <p class="text-xs font-bold uppercase tracking-wider mb-2" style="color:#64748b">Identificação</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Nome completo *</label>
            <input v-model="nome" type="text" class="input-base" placeholder="Nome do paciente" />
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">CPF *</label>
            <input
              :value="cpf"
              type="text"
              class="input-base font-mono"
              placeholder="000.000.000-00"
              @input="cpf = formatarCPF(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Cartão SUS</label>
            <input v-model="susCartao" type="text" class="input-base font-mono" placeholder="000 0000 0000 0000" />
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Data de nascimento *</label>
            <input v-model="dataNascimento" type="date" class="input-base" />
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Sexo</label>
            <select v-model="sexo" class="input-base">
              <option value="">—</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Unidade</label>
            <select v-model="unidadeId" class="input-base">
              <option value="">—</option>
              <option v-for="u in unidades" :key="u.id" :value="u.id">{{ u.nome }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Contato -->
      <div>
        <p class="text-xs font-bold uppercase tracking-wider mb-2" style="color:#64748b">Contato</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Telefone</label>
            <input
              :value="telefone"
              type="text"
              class="input-base"
              placeholder="(00) 00000-0000"
              @input="telefone = formatarTelefone(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">E-mail</label>
            <input v-model="email" type="email" class="input-base" placeholder="email@exemplo.com" />
          </div>
        </div>
      </div>

      <!-- Agendar agora? -->
      <div class="rounded-lg border p-3" style="border-color:#e2e8f0;background:#f8fafc">
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="criarAgendamento" type="checkbox" class="w-4 h-4" />
          <span class="text-sm font-semibold text-[var(--color-text)]">Já agendar uma consulta</span>
        </label>

        <div v-if="criarAgendamento" class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Médico *</label>
            <select v-model="medicoId" class="input-base">
              <option value="">Selecione…</option>
              <option v-for="m in medicos" :key="m.id" :value="m.id">
                {{ m.nome }} — {{ m.especialidade }}
              </option>
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Data *</label>
            <input v-model="dataConsulta" type="date" class="input-base" />
          </div>
          <div class="sm:col-span-2">
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Motivo</label>
            <input v-model="motivo" type="text" class="input-base" placeholder="Ex.: dor de cabeça, retorno..." />
          </div>
        </div>
      </div>

      <p
        v-if="erro"
        class="text-sm rounded-lg p-3"
        style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca"
      >
        {{ erro }}
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" :disabled="salvando" @click="emit('close')">Cancelar</UiButton>
      <UiButton variant="primary" :loading="salvando" :disabled="sucesso" @click="salvar">
        <UserPlus :size="16" />
        Cadastrar paciente
      </UiButton>
    </template>
  </UiModal>
</template>
