<script setup lang="ts">
import { Star } from 'lucide-vue-next'
import type { Agendamento } from '~/types'

const props = defineProps<{
  unidadeNome: string
  salaSlug: string
  pacienteAtual: Agendamento | null
  horaAtual: string
}>()

const emit = defineEmits<{ entrar: [] }>()

const nomePaciente = computed(() => (props.pacienteAtual?.pacientes as any)?.nome ?? '')

// O médico não pertence à sala — é atribuído dinamicamente por paciente,
// então só existe um "médico atual" quando há alguém sendo atendido.
const nomeMedicoAtual = computed(() => (props.pacienteAtual?.medicos as any)?.nome ?? '')
const aguardandoMedico = computed(() => props.pacienteAtual?.status === 'aguardando_medico')
const aguardandoEntrar = computed(() => props.pacienteAtual?.status === 'aguardando_paciente')
const emConsulta      = computed(() => props.pacienteAtual?.status === 'em_consulta')
const aguardandoAval  = computed(() => props.pacienteAtual?.status === 'aguardando_avaliacao')

const dataAtual = computed(() =>
  new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
)

// ── Avaliação ─────────────────────────────────────────────
const avNota       = ref(0)
const avHover      = ref(0)
const avComentario = ref('')
const avEnviando   = ref(false)
const avEnviada    = ref(false)
const avErro       = ref('')

watch(aguardandoAval, (val) => {
  if (val) { avNota.value = 0; avHover.value = 0; avComentario.value = ''; avEnviada.value = false; avErro.value = '' }
})

async function enviarAvaliacao() {
  if (!avNota.value || !props.pacienteAtual?.id) return
  avEnviando.value = true; avErro.value = ''
  try {
    await $fetch('/api/avaliacao/submit', {
      method: 'POST',
      body: { agendamentoId: props.pacienteAtual.id, nota: avNota.value, comentario: avComentario.value || undefined },
    })
    avEnviada.value = true
  } catch (err: any) {
    avErro.value = err?.data?.message ?? 'Erro ao enviar avaliação'
  } finally {
    avEnviando.value = false
  }
}

// ── Obrigado pós-consulta ─────────────────────────────────
const jitsiAtivo     = ref(false)
const mostraObrigado = ref(false)
let obrigadoTimer: ReturnType<typeof setTimeout> | null = null

function dispararObrigado() {
  jitsiAtivo.value = false
  mostraObrigado.value = true
  if (obrigadoTimer) clearTimeout(obrigadoTimer)
  obrigadoTimer = setTimeout(() => { mostraObrigado.value = false }, 6000)
}

watch(() => props.pacienteAtual?.id, (novoId, antigoId) => {
  if (!novoId && antigoId) dispararObrigado()
  else jitsiAtivo.value = false
})

watch(() => props.pacienteAtual?.status, (novo, antigo) => {
  if (antigo === 'em_consulta' && novo && !['em_consulta', 'aguardando_paciente'].includes(novo))
    dispararObrigado()
})

onUnmounted(() => { if (obrigadoTimer) clearTimeout(obrigadoTimer) })

function handleEntrar() { jitsiAtivo.value = true; emit('entrar') }

// Iniciais da unidade para avatar (a sala é da unidade, não do médico)
const iniciais = computed(() =>
  props.unidadeNome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
)
</script>

<template>
  <div class="h-screen w-full flex flex-col overflow-hidden" style="background:#060f1c;color:#ffffff">

    <!-- ══ EM CONSULTA ══════════════════════════════════════ -->
    <template v-if="emConsulta || jitsiAtivo">
      <div class="shrink-0 flex items-center gap-4 px-6 py-3"
        style="background:#021a0a;border-bottom:2px solid #16a34a">
        <span class="w-3 h-3 rounded-full shrink-0"
          style="background:#4ade80;box-shadow:0 0 10px #4ade80;animation:blink 1.4s ease-in-out infinite" />
        <p style="color:#ffffff;font-size:1.1rem;font-weight:600;flex:1">
          Consulta com <strong>Dr(a). {{ nomeMedicoAtual }}</strong>
        </p>
        <span style="background:#14532d;color:#86efac;font-size:0.8rem;font-weight:700;padding:4px 12px;border-radius:999px">
          AO VIVO
        </span>
      </div>
      <div class="flex-1" style="min-height:0">
        <UiJitsiMeet
          v-if="pacienteAtual"
          :room-id="pacienteAtual.id"
          :display-name="nomePaciente || 'Paciente'"
        />
      </div>
    </template>

    <!-- ══ AVALIAÇÃO ════════════════════════════════════════ -->
    <template v-else-if="aguardandoAval">
      <div class="flex-1 flex flex-col items-center justify-center gap-8 px-8 text-center"
        style="background:linear-gradient(160deg,#060f1c,#0d2640)">
        <template v-if="avEnviada">
          <div style="width:7rem;height:7rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(45,170,138,0.15);border:3px solid #2daa8a">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2daa8a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <h1 style="color:#ffffff;font-size:4rem;font-weight:900;margin-bottom:1rem">Obrigado!</h1>
            <p style="color:#6ee7b7;font-size:1.5rem">Avaliação registrada. Até breve!</p>
          </div>
        </template>
        <template v-else>
          <div>
            <h1 style="color:#ffffff;font-size:3.5rem;font-weight:900;margin-bottom:0.75rem">Consulta encerrada</h1>
            <p style="color:#e2e8f0;font-size:1.5rem">
              Como foi o atendimento com <strong style="color:#ffffff">Dr(a). {{ nomeMedicoAtual }}</strong>?
            </p>
          </div>
          <div style="display:flex;gap:1.25rem">
            <button
              v-for="i in 5" :key="i" type="button"
              style="background:none;border:none;cursor:pointer;transition:transform 0.15s"
              @click="avNota = i" @mouseenter="avHover = i" @mouseleave="avHover = 0"
            >
              <Star :size="64"
                :fill="(avHover || avNota) >= i ? '#f59e0b' : 'transparent'"
                :stroke="(avHover || avNota) >= i ? '#f59e0b' : 'rgba(255,255,255,0.5)'"
                stroke-width="1.5"
              />
            </button>
          </div>
          <p v-if="!avNota" style="color:rgba(255,255,255,0.65);font-size:1.3rem">Toque em uma estrela para avaliar</p>
          <p v-else style="color:#ffffff;font-size:1.5rem;font-weight:700">
            {{ ['','Péssimo','Ruim','Regular','Bom','Excelente'][avNota] }}
          </p>
          <textarea
            v-if="avNota"
            v-model="avComentario"
            placeholder="Deixe um comentário (opcional)..."
            rows="3"
            style="width:100%;max-width:36rem;padding:1rem 1.25rem;border-radius:1rem;color:#ffffff;font-size:1.1rem;resize:none;outline:none;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2)"
          />
          <p v-if="avErro" style="color:#f87171;font-size:1rem">{{ avErro }}</p>
          <button
            v-if="avNota" type="button" :disabled="avEnviando"
            style="padding:1.25rem 4rem;border-radius:1.5rem;color:#ffffff;font-weight:900;font-size:1.8rem;border:none;cursor:pointer;background:linear-gradient(135deg,#2daa8a,#1e7a65);opacity:1;transition:transform 0.15s"
            @click="enviarAvaliacao"
          >{{ avEnviando ? 'Enviando...' : 'Enviar avaliação' }}</button>
        </template>
      </div>
    </template>

    <!-- ══ OBRIGADO PÓS-CONSULTA ═══════════════════════════ -->
    <template v-else-if="mostraObrigado">
      <div class="flex-1 flex flex-col items-center justify-center gap-8 px-10 text-center"
        style="background:linear-gradient(160deg,#021a0a,#052e10)">
        <div style="width:7rem;height:7rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(74,222,128,0.15);border:3px solid rgba(74,222,128,0.5)">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <h1 style="color:#ffffff;font-size:4rem;font-weight:900;margin-bottom:1rem">Consulta encerrada!</h1>
          <p style="color:#86efac;font-size:2rem">Obrigado. Até breve!</p>
        </div>
      </div>
    </template>

    <!-- ══ ESTADOS DE ESPERA ════════════════════════════════ -->
    <template v-else>

      <!-- Header: médico sempre visível -->
      <header class="shrink-0 flex items-center justify-between px-8 py-5"
        style="background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.1)">
        <div style="display:flex;align-items:center;gap:1rem">
          <!-- Avatar -->
          <div style="width:3.5rem;height:3.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#ffffff;font-weight:700;font-size:1.2rem;flex-shrink:0">
            {{ iniciais }}
          </div>
          <div>
            <p style="color:#ffffff;font-weight:700;font-size:1.3rem;line-height:1.2">{{ unidadeNome }}</p>
            <p style="color:#93c5fd;font-size:1rem;font-weight:500">Sala de Teleconsulta</p>
          </div>
        </div>
        <!-- Relógio -->
        <div style="text-align:right">
          <p style="color:#ffffff;font-family:monospace;font-weight:700;font-size:2.4rem;line-height:1">{{ horaAtual }}</p>
          <p style="color:rgba(255,255,255,0.55);font-size:0.85rem;margin-top:4px;text-transform:capitalize">{{ dataAtual }}</p>
        </div>
      </header>

      <!-- Conteúdo central -->
      <Transition name="slide" mode="out-in">

        <!-- ─── CHAMADO: botão entrar ──────────────────────── -->
        <div v-if="aguardandoEntrar" key="chamado"
          class="flex-1 flex flex-col items-center justify-center gap-10 px-8 text-center"
          style="background:linear-gradient(160deg,#022c0a,#064d12)">

          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1.5rem;border-radius:1rem;background:rgba(74,222,128,0.15);border:2px solid rgba(74,222,128,0.4)">
            <span style="width:12px;height:12px;border-radius:50%;background:#4ade80;animation:blink 1.4s ease-in-out infinite;display:inline-block;flex-shrink:0" />
            <span style="color:#86efac;font-weight:700;font-size:1.3rem">Dr(a). {{ nomeMedicoAtual }} está pronto(a)!</span>
          </div>

          <div>
            <p style="color:#4ade80;font-size:1.5rem;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:0.75rem">Sua vez!</p>
            <h1 style="color:#ffffff;font-weight:900;line-height:1;font-size:clamp(3.5rem,9vw,7rem)">
              {{ nomePaciente }}
            </h1>
          </div>

          <button
            class="relative overflow-hidden rounded-3xl"
            style="color:#ffffff;font-weight:900;border:none;cursor:pointer;transition:transform 0.2s;background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 0 60px rgba(34,197,94,0.5),0 20px 50px rgba(0,0,0,0.4);padding:clamp(1.25rem,3vw,2rem) clamp(3rem,8vw,5rem);font-size:clamp(1.8rem,4.5vw,3rem)"
            @click="handleEntrar"
          >
            ENTRAR NA CONSULTA
            <div class="absolute inset-0 btn-shine" />
          </button>

          <p style="color:rgba(255,255,255,0.7);font-size:1.2rem">Toque no botão acima para iniciar sua teleconsulta</p>
        </div>

        <!-- ─── MÉDICO NOTIFICADO ───────────────────────────── -->
        <div v-else-if="aguardandoMedico" key="notificando"
          class="flex-1 flex flex-col items-center justify-center gap-10 px-8 text-center"
          style="background:linear-gradient(160deg,#1a0f00,#2d1a00)">

          <div class="relative">
            <div style="width:8rem;height:8rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(251,191,36,0.12);border:3px solid rgba(251,191,36,0.4)">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8a16 16 0 0 0 6.09 6.09l.88-.88a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div class="absolute inset-[-8px] rounded-full animate-ping" style="border:2px solid rgba(251,191,36,0.3)" />
            <div class="absolute inset-[-20px] rounded-full animate-ping" style="border:1px solid rgba(251,191,36,0.15);animation-delay:0.5s" />
          </div>

          <div>
            <p style="color:#fbbf24;font-size:1.5rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:0.75rem">Preparando sua consulta</p>
            <h1 style="color:#ffffff;font-weight:900;line-height:1.05;margin-bottom:1rem;font-size:clamp(3rem,7vw,5.5rem)">
              {{ nomePaciente }}
            </h1>
            <p style="color:#e2e8f0;font-size:1.5rem">
              Aguardando <strong style="color:#fde68a">Dr(a). {{ nomeMedicoAtual }}</strong> confirmar
            </p>
          </div>

          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1.5rem;border-radius:1rem;background:rgba(251,191,36,0.1);border:2px solid rgba(251,191,36,0.3)">
            <span style="width:12px;height:12px;border-radius:50%;background:#fbbf24;animation:blink 1.2s ease-in-out infinite;display:inline-block;flex-shrink:0" />
            <span style="color:#fde68a;font-weight:600;font-size:1.2rem">O médico está sendo notificado...</span>
          </div>
        </div>

        <!-- ─── IDLE: aguardando chamada ───────────────────── -->
        <div v-else key="idle"
          class="flex-1 flex flex-col items-center justify-center gap-10 px-8 text-center"
          style="background:linear-gradient(160deg,#0a1628,#112240)">

          <!-- Ícone relógio -->
          <div class="relative">
            <div style="width:9rem;height:9rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2)">
              <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div class="absolute inset-0 rounded-full animate-ping" style="border:2px solid rgba(255,255,255,0.15)" />
            <div class="absolute inset-[-16px] rounded-full animate-ping" style="border:1px solid rgba(255,255,255,0.08);animation-delay:0.4s" />
          </div>

          <!-- Texto principal -->
          <div style="display:flex;flex-direction:column;gap:1rem">
            <h1 style="color:#ffffff;font-weight:900;line-height:1;text-shadow:0 4px 30px rgba(0,0,0,0.5);font-size:clamp(3.5rem,9vw,7rem)">
              Aguardando chamada
            </h1>
            <p style="color:#c8dff5;font-weight:500;font-size:clamp(1.3rem,3vw,2rem)">
              Fique à vontade. Você será chamado(a) em breve.
            </p>
          </div>

          <!-- Status pill -->
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1.5rem;border-radius:1rem;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2)">
            <span style="width:12px;height:12px;border-radius:50%;background:#7dd3fc;animation:blink 2.5s ease-in-out infinite;display:inline-block;flex-shrink:0" />
            <span style="color:#ffffff;font-weight:600;font-size:1.2rem">
              Sala disponível
            </span>
          </div>
        </div>

      </Transition>

      <!-- Rodapé -->
      <footer class="shrink-0 py-3 text-center"
        style="border-top:1px solid rgba(255,255,255,0.07)">
        <p style="color:rgba(255,255,255,0.3);font-size:0.8rem">
          SóMedicos · Teleconsulta · /sala/{{ salaSlug }}
        </p>
      </footer>
    </template>

  </div>
</template>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: all 0.4s cubic-bezier(0.4,0,0.2,1); }
.slide-enter-from { opacity: 0; transform: translateY(16px); }
.slide-leave-to  { opacity: 0; transform: translateY(-10px); }

@keyframes blink {
  0%,100% { opacity:1; }
  50%      { opacity:0.3; }
}

.btn-shine {
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
  background-size: 200% 100%;
  animation: shine 2.5s ease-in-out infinite;
}
@keyframes shine {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
</style>
