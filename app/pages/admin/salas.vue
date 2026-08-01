<script setup lang="ts">
import { Stethoscope, Link, ExternalLink, Radio } from 'lucide-vue-next'
import type { Medico } from '~/types'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()

const medicos = ref<Medico[]>([])
const carregando = ref(true)

interface SituacaoSala {
  status: string
  paciente_nome: string | null
}
const situacao = ref<Record<string, SituacaoSala>>({})
let pollInterval: ReturnType<typeof setInterval>

async function carregar() {
  const { data } = await supabase
    .from('medicos')
    .select('*')
    .eq('ativo', true)
    .not('sala_slug', 'is', null)
    .order('nome')
  medicos.value = (data ?? []) as Medico[]
  carregando.value = false
}

async function carregarSituacao() {
  const hoje = new Date()
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  const { data } = await supabase
    .from('agendamentos')
    .select('medico_id, status, pacientes(nome)')
    .in('status', ['aguardando_medico', 'aguardando_paciente', 'em_consulta'])
    .eq('data_consulta', dataHoje)

  const mapa: Record<string, SituacaoSala> = {}
  for (const ag of (data ?? [])) {
    mapa[ag.medico_id] = {
      status: ag.status,
      paciente_nome: (ag.pacientes as any)?.nome ?? null,
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

function linkSala(slug: string) {
  return `${window.location.origin}/sala/${slug}`
}

const copiado = ref<string | null>(null)
function copiarLink(slug: string) {
  navigator.clipboard.writeText(linkSala(slug))
  copiado.value = slug
  setTimeout(() => { copiado.value = null }, 2000)
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  em_consulta:       { label: 'Em consulta',       bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
  aguardando_paciente: { label: 'Aguard. paciente', bg: '#fef9c3', color: '#a16207', dot: '#eab308' },
  aguardando_medico: { label: 'Aguard. médico',    bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Salas de Teleconsulta</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">
        Cada médico possui sua própria sala virtual. Configure o slug em <strong>Cadastros → Médicos</strong>.
      </p>
    </div>

    <!-- Loading -->
    <div v-if="carregando" class="py-16 text-center">
      <div class="inline-block w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>

    <!-- Vazio -->
    <div v-else-if="medicos.length === 0" class="py-16 text-center bg-white rounded-2xl border" style="border-color:var(--color-border)">
      <Stethoscope :size="40" class="mx-auto mb-3" style="color:var(--color-text-dim)" />
      <p class="font-semibold text-[var(--color-text)]">Nenhum médico com sala configurada</p>
      <p class="text-sm mt-1 text-[var(--color-text-muted)]">
        Edite o cadastro de um médico e defina o slug da sala dele.
      </p>
      <UiButton class="mt-4" @click="navigateTo('/admin/medicos')">
        <Stethoscope :size="15" /> Ir para Médicos
      </UiButton>
    </div>

    <!-- Lista de salas -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="m in medicos"
        :key="m.id"
        class="bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md"
        style="border-color:var(--color-border)"
      >
        <!-- Médico -->
        <div class="flex items-center gap-3">
          <UiAvatar :src="m.foto_url" :name="m.nome" size="md" />
          <div class="min-w-0 flex-1">
            <p class="font-bold text-[var(--color-text)] truncate">{{ m.nome }}</p>
            <p class="text-sm text-[var(--color-text-muted)] truncate">{{ m.especialidade }}</p>
          </div>
        </div>

        <!-- Status ao vivo -->
        <div v-if="situacao[m.id]" class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            :style="`background:${STATUS_CONFIG[situacao[m.id].status]?.bg};color:${STATUS_CONFIG[situacao[m.id].status]?.color}`"
          >
            <Radio :size="11" />
            {{ STATUS_CONFIG[situacao[m.id].status]?.label }}
          </span>
          <span v-if="situacao[m.id].paciente_nome" class="text-xs text-[var(--color-text-muted)] truncate">
            · {{ situacao[m.id].paciente_nome }}
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
          <code class="text-xs text-[var(--color-text-muted)] flex-1 truncate">/sala/{{ m.sala_slug }}</code>
          <button
            type="button"
            class="p-1.5 rounded-lg transition-colors hover:bg-purple-100 shrink-0"
            :title="copiado === m.sala_slug ? 'Copiado!' : 'Copiar link'"
            @click="copiarLink(m.sala_slug)"
          >
            <span v-if="copiado === m.sala_slug" class="text-xs font-bold" style="color:#7c3aed">✓</span>
            <Link v-else :size="13" style="color:#7c3aed" />
          </button>
          <a
            :href="linkSala(m.sala_slug)"
            target="_blank"
            class="p-1.5 rounded-lg transition-colors hover:bg-blue-50 shrink-0"
            title="Abrir sala"
          >
            <ExternalLink :size="13" style="color:#2563eb" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
