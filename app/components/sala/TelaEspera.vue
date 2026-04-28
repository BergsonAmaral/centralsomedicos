<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
import type { Agendamento, Medico } from '~/types'

const props = defineProps<{
  medico: Medico
  pacienteAtual: Agendamento | null
  horaAtual: string
}>()

const emit = defineEmits<{
  entrar: []
}>()

const nomePaciente = computed(() => (props.pacienteAtual?.pacientes as any)?.nome ?? '')
const aguardandoEntrar = computed(() => props.pacienteAtual?.status === 'aguardando_paciente')
const emConsulta = computed(() => props.pacienteAtual?.status === 'em_consulta')

// Controla se o Jitsi já foi aberto (para persistir mesmo se o status demorar a atualizar)
const jitsiAtivo = ref(false)

// Quando o pacienteAtual muda (novo paciente ou null), reseta estado do Jitsi
watch(() => props.pacienteAtual?.id, () => {
  jitsiAtivo.value = false
})

function handleEntrar() {
  jitsiAtivo.value = true
  emit('entrar')
}
</script>

<template>
  <div class="h-screen w-full flex flex-col overflow-hidden" style="background:#0c2340">

    <!-- ══════════════════════════════════════════ -->
    <!-- ESTADO: Em consulta — Jitsi tela cheia     -->
    <!-- ══════════════════════════════════════════ -->
    <template v-if="emConsulta || jitsiAtivo">
      <!-- Barra superior compacta -->
      <div
        class="shrink-0 flex items-center gap-3 px-5 py-2.5 z-10"
        style="background:#0a1f14;border-bottom:1px solid #14532d"
      >
        <div
          class="w-2 h-2 rounded-full shrink-0"
          style="background:#4ade80;animation:pulse 1.5s infinite"
        />
        <p class="text-white text-sm flex-1 font-medium truncate">
          Consulta com <strong>{{ medico.nome }}</strong>
        </p>
        <span class="text-xs px-2 py-0.5 rounded-full shrink-0" style="background:#14532d;color:#86efac">Ao vivo</span>
      </div>
      <!-- Jitsi ocupa todo o espaço restante -->
      <div class="flex-1" style="min-height:0">
        <UiJitsiMeet
          v-if="pacienteAtual"
          :room-id="pacienteAtual.id"
          :display-name="nomePaciente || 'Paciente'"
        />
      </div>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!-- ESTADOS: Aguardando / Chamado              -->
    <!-- ══════════════════════════════════════════ -->
    <template v-else>
      <div
        class="flex-1 flex flex-col overflow-hidden transition-all duration-500"
        :style="{
          background: aguardandoEntrar
            ? 'linear-gradient(135deg, #0f4c1e 0%, #1a7a3a 100%)'
            : 'linear-gradient(135deg, #0c2340 0%, #1a4a7a 100%)'
        }"
      >
        <!-- Cabeçalho -->
        <header class="flex items-center justify-between px-10 py-6 shrink-0">
          <div>
            <p class="text-white/60 text-sm font-mono tracking-widest uppercase">SoMedicos</p>
            <h2 class="text-white text-xl font-bold">{{ medico.nome }}</h2>
            <p class="text-white/70 text-sm">{{ medico.especialidade }}</p>
          </div>
          <div class="text-right">
            <p class="text-white/40 text-xs font-mono">somedicos.com/sala/{{ medico.sala_slug }}</p>
            <p class="text-white font-mono text-2xl font-bold tracking-widest mt-1">{{ horaAtual }}</p>
          </div>
        </header>

        <Transition name="fade-scale" mode="out-in">
          <!-- Estado 1: Aguardando chamada -->
          <div v-if="!aguardandoEntrar" key="aguardando" class="flex-1 flex flex-col items-center justify-center gap-8 px-10 text-center">
            <div class="relative">
              <div class="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center">
                <Clock :size="64" class="text-white/80" />
              </div>
              <div class="absolute inset-0 rounded-full border-2 border-white/20 animate-ping" />
              <div class="absolute inset-[-12px] rounded-full border border-white/10 animate-ping animation-delay-300" />
            </div>
            <div>
              <h1 class="text-5xl font-bold text-white mb-4">Aguardando chamada...</h1>
              <p class="text-white/60 text-xl">Fique à vontade. Você será chamado em breve.</p>
            </div>
          </div>

          <!-- Estado 2: Médico chamou — botão ENTRAR -->
          <div v-else key="chamado" class="flex-1 flex flex-col items-center justify-center gap-10 px-10 text-center">
            <div class="space-y-2">
              <p class="text-green-200 text-2xl font-medium uppercase tracking-widest">O médico está pronto!</p>
              <h1 class="text-7xl font-black text-white leading-tight">
                {{ nomePaciente }}
              </h1>
              <p class="text-white/70 text-xl mt-4">Clique abaixo para entrar na consulta</p>
            </div>
            <div class="space-y-4">
              <button
                class="px-20 py-8 rounded-3xl text-white font-black text-4xl shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 animate-pulse-soft"
                style="background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 12px 40px rgba(34,197,94,0.5)"
                @click="handleEntrar"
              >
                ENTRAR NA CONSULTA
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </template>

  </div>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.4s ease;
}
.fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(1.05);
}
.animation-delay-300 {
  animation-delay: 0.3s;
}
.animate-pulse-soft {
  animation: pulseSoft 1.4s ease-in-out infinite;
}
@keyframes pulseSoft {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7), 0 12px 40px rgba(34,197,94,0.5); }
  50%      { box-shadow: 0 0 0 22px rgba(34,197,94,0), 0 12px 40px rgba(34,197,94,0.5); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
</style>
