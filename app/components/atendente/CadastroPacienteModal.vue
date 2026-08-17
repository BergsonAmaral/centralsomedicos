<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

const emit = defineEmits<{ close: []; criado: [paciente: { id: string; nome: string }] }>()

const supabase = useSupabaseClient()
const authStore = useAuthStore()

const erro = ref('')
const salvando = ref(false)
const sucesso = ref(false)
const reusouExistente = ref(false)

const nome = ref('')
const cpf = ref('')
const susCartao = ref('')
const dataNascimento = ref('')
const sexo = ref<'M' | 'F' | 'O' | ''>('')
const telefone = ref('')
const email = ref('')

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
  if (!cpfValido(cpfNum)) return 'CPF inválido — confira os números digitados.'
  if (!dataNascimento.value) return 'Informe a data de nascimento.'
  return null
}

async function salvar() {
  erro.value = ''
  const v = validar()
  if (v) { erro.value = v; return }
  if (!authStore.atendenteUnidadeId) { erro.value = 'Sua conta não está vinculada a uma unidade.'; return }

  salvando.value = true
  try {
    const cpfNum = cpf.value.replace(/\D/g, '')
    const { data: existente } = await supabase
      .from('pacientes')
      .select('id, nome')
      .eq('cpf', cpfNum)
      .maybeSingle()

    let pacienteId: string
    let pacienteNome = nome.value.trim()

    if (existente) {
      const nomeDigitado = nome.value.trim().toLowerCase()
      if (existente.nome.trim().toLowerCase() !== nomeDigitado) {
        erro.value = `Este CPF já está cadastrado para "${existente.nome}". Confira o número digitado ou use a busca para abrir o cadastro existente.`
        salvando.value = false
        return
      }
      pacienteId = existente.id
      pacienteNome = existente.nome
      reusouExistente.value = true
    } else {
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
          unidade_id: authStore.atendenteUnidadeId,
        })
        .select('id, nome')
        .single()

      if (errPac || !novo) {
        erro.value = errPac?.message ?? 'Erro ao salvar paciente.'
        salvando.value = false
        return
      }
      pacienteId = novo.id
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
  <UiModal :model-value="true" title="Cadastro de paciente" size="lg" @update:model-value="emit('close')">
    <div v-if="sucesso" class="py-8 text-center">
      <div class="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style="background:#dcfce7">
        <UserPlus :size="26" style="color:#16a34a" />
      </div>
      <p class="font-semibold text-[var(--color-text)]">
        {{ reusouExistente ? 'Paciente já cadastrado — dados reaproveitados' : 'Paciente cadastrado com sucesso' }}
      </p>
      <p v-if="reusouExistente" class="text-xs mt-1" style="color:var(--color-text-muted)">
        Encontramos este CPF na base e usamos o cadastro existente.
      </p>
    </div>

    <div v-else class="space-y-5">
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
              :value="cpf" type="text" class="input-base font-mono" placeholder="000.000.000-00"
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
        </div>
      </div>

      <div>
        <p class="text-xs font-bold uppercase tracking-wider mb-2" style="color:#64748b">Contato</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">Telefone</label>
            <input
              :value="telefone" type="text" class="input-base" placeholder="(00) 00000-0000"
              @input="telefone = formatarTelefone(($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-[var(--color-text-muted)] block mb-1">E-mail</label>
            <input v-model="email" type="email" class="input-base" placeholder="email@exemplo.com" />
          </div>
        </div>
      </div>

      <p v-if="erro" class="text-sm rounded-lg p-3" style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca">
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
