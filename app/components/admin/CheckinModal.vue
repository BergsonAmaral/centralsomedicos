<script setup lang="ts">
import { UserCheck, X } from 'lucide-vue-next'
import type { Agendamento } from '~/types'
import { useFila } from '~/composables/useFila'

interface Props {
  agendamento: Agendamento
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const fila = useFila()
const carregando = ref(false)

const triagem = ref({
  alergia: false,
  febre: false,
  urgencia: false,
  obs: '',
})

const paciente = computed(() => props.agendamento.pacientes)
const cpfFormatado = computed(() => {
  const cpf = paciente.value?.cpf ?? ''
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
})

async function confirmar() {
  carregando.value = true
  try {
    const { error } = await fila.fazerCheckin(props.agendamento.id, triagem.value)
    if (error) throw new Error(error.message)
    await fila.carregar()
    emit('close')
  } catch (e: any) {
    alert('Erro ao fazer check-in: ' + (e?.message ?? 'tente novamente'))
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <UiModal :model-value="true" title="Fazer Check-in" size="md" @update:model-value="emit('close')">
    <div class="space-y-5">
      <!-- Dados do paciente (somente leitura) -->
      <div class="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border-light)]">
        <p class="text-lg font-bold text-[var(--color-text)]">{{ paciente?.nome }}</p>
        <p class="text-sm text-[var(--color-text-muted)] mt-0.5">CPF: {{ cpfFormatado }}</p>
        <p v-if="paciente?.sus_cartao" class="text-sm text-[var(--color-text-muted)]">
          Cartão SUS: {{ paciente.sus_cartao }}
        </p>
        <p v-if="agendamento.motivo" class="text-sm text-[var(--color-text-muted)] mt-1">
          Motivo: {{ agendamento.motivo }}
        </p>
      </div>

      <!-- Triagem -->
      <div>
        <p class="text-sm font-semibold text-[var(--color-text)] mb-3">Triagem Rápida</p>
        <div class="space-y-3">
          <label
            v-for="campo in [
              { key: 'alergia', label: 'Alergia a medicamento?', color: 'text-[var(--color-warning)]' },
              { key: 'febre', label: 'Febre?', color: 'text-[var(--color-danger)]' },
              { key: 'urgencia', label: 'Urgência?', color: 'text-[var(--color-danger)] font-bold' },
            ]"
            :key="campo.key"
            class="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border-light)] cursor-pointer hover:bg-[var(--color-surface-2)]"
          >
            <span :class="['text-sm', campo.color]">{{ campo.label }}</span>
            <div class="flex gap-4">
              <label class="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  :name="campo.key"
                  :value="true"
                  v-model="triagem[campo.key as 'alergia' | 'febre' | 'urgencia']"
                  class="accent-[var(--color-blue)]"
                />
                Sim
              </label>
              <label class="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  :name="campo.key"
                  :value="false"
                  v-model="triagem[campo.key as 'alergia' | 'febre' | 'urgencia']"
                  class="accent-[var(--color-blue)]"
                />
                Não
              </label>
            </div>
          </label>
        </div>

        <div class="mt-3">
          <label class="text-sm font-medium text-[var(--color-text-muted)] block mb-1">
            Observações
          </label>
          <textarea
            v-model="triagem.obs"
            rows="3"
            placeholder="Observações adicionais..."
            class="input-base resize-none"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="emit('close')">Cancelar</UiButton>
      <UiButton variant="success" :loading="carregando" @click="confirmar">
        <UserCheck :size="16" />
        Confirmar Check-in
      </UiButton>
    </template>
  </UiModal>
</template>
