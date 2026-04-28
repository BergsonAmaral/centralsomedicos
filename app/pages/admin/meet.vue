<script setup lang="ts">
import { Video, Copy, ExternalLink, CheckCircle2, Save, Link, Users, Activity, PauseCircle, Monitor } from 'lucide-vue-next'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] })

const supabase = useSupabaseClient()
let channel: ReturnType<typeof supabase.channel> | null = null

interface MedicoMeet {
  id: string
  nome: string
  especialidade: string
  foto_url: string | null
  meet_link: string
  sala_slug: string
  ativo: boolean
  pausado: boolean
  // runtime
  emConsulta: boolean
  naFila: number
}

const medicos = ref<MedicoMeet[]>([])
const carregando = ref(true)
const editando = ref<Record<string, string>>({})
const salvando = ref<Record<string, boolean>>({})
const copiado = ref<Record<string, 'meet' | 'sala' | null>>({})
const erros = ref<Record<string, string>>({})
const hoje = new Date().toISOString().split('T')[0]

async function carregar() {
  carregando.value = true

  const [medicosRes, agRes] = await Promise.all([
    supabase.from('medicos').select('id, nome, especialidade, foto_url, meet_link, sala_slug, ativo, pausado').order('nome'),
    supabase.from('agendamentos').select('medico_id, status').eq('data_consulta', hoje).in('status', ['checkin', 'em_consulta']),
  ])

  const ags = agRes.data ?? []

  medicos.value = (medicosRes.data ?? []).map((m) => ({
    ...m,
    emConsulta: ags.some((a) => a.medico_id === m.id && a.status === 'em_consulta'),
    naFila: ags.filter((a) => a.medico_id === m.id && a.status === 'checkin').length,
  }))

  for (const m of medicos.value) {
    editando.value[m.id] = m.meet_link
  }

  carregando.value = false
}

onMounted(() => {
  carregar()
  channel = supabase.channel('meet-realtime')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agendamentos' }, carregar)
    .subscribe()
})
onUnmounted(() => {
  if (channel) supabase.removeChannel(channel)
})

function isLinkValido(link: string) {
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && link.includes('meet.google.com')
  } catch { return false }
}

async function salvar(medico: MedicoMeet) {
  const novo = editando.value[medico.id]?.trim()
  if (!novo) { erros.value[medico.id] = 'Link obrigatório'; return }
  if (!isLinkValido(novo)) { erros.value[medico.id] = 'Use um link válido do Google Meet (https://meet.google.com/...)'; return }
  erros.value[medico.id] = ''
  salvando.value[medico.id] = true
  const { error } = await supabase.from('medicos').update({ meet_link: novo }).eq('id', medico.id)
  salvando.value[medico.id] = false
  if (error) { erros.value[medico.id] = 'Erro ao salvar.' } else { medico.meet_link = novo }
}

async function copiar(texto: string, id: string, tipo: 'meet' | 'sala') {
  await navigator.clipboard.writeText(texto)
  copiado.value[id] = tipo
  setTimeout(() => { copiado.value[id] = null }, 2000)
}

function salaUrl(slug: string) {
  return `${window.location.origin}/sala/${slug}`
}

const houveMudanca = (m: MedicoMeet) => editando.value[m.id] !== m.meet_link

function statusLabel(m: MedicoMeet) {
  if (m.emConsulta) return { texto: 'Em consulta', bg: '#dbeafe', cor: '#1d4ed8' }
  if (m.pausado) return { texto: 'Pausado', bg: '#fef9c3', cor: '#a16207' }
  if (!m.ativo) return { texto: 'Inativo', bg: '#f3f4f6', cor: '#6b7280' }
  return { texto: 'Disponível', bg: '#dcfce7', cor: '#16a34a' }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-[var(--color-text)]">Teleconsultas — Meet</h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">
        Status em tempo real, links da sala do paciente e configuração do Google Meet por médico.
      </p>
    </div>

    <!-- Como funciona -->
    <div class="rounded-xl border p-4 flex flex-col sm:flex-row gap-3 sm:items-center text-sm"
         style="background:#eff6ff;border-color:#bfdbfe">
      <Monitor :size="18" style="color:#2563eb;flex-shrink:0" />
      <p style="color:#1e40af">
        <strong>Fluxo:</strong> Paciente acessa a <strong>URL da sala</strong> e aguarda →
        <strong>Admin faz o check-in</strong> e chama o próximo →
        Google Meet abre automaticamente para o médico.
        Compartilhe a URL da sala com os pacientes — o link do Meet é interno.
      </p>
    </div>

    <!-- Skeleton -->
    <div v-if="carregando" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-36 rounded-xl animate-pulse" style="background:var(--color-surface-2)" />
    </div>

    <!-- Lista -->
    <div v-else-if="medicos.length" class="space-y-3">
      <div
        v-for="medico in medicos"
        :key="medico.id"
        class="bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-sm"
        style="border-color:var(--color-border)"
      >
        <!-- Topo: info + status + fila -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
             style="border-bottom:1px solid var(--color-border-light)">
          <div class="flex items-center gap-3">
            <UiAvatar :src="medico.foto_url" :name="medico.nome" size="md" />
            <div>
              <p class="font-semibold text-[var(--color-text)]">{{ medico.nome }}</p>
              <p class="text-xs text-[var(--color-text-muted)]">{{ medico.especialidade }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Status -->
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              :style="`background:${statusLabel(medico).bg};color:${statusLabel(medico).cor}`"
            >
              <span class="w-1.5 h-1.5 rounded-full inline-block" :style="`background:${statusLabel(medico).cor}`" />
              {{ statusLabel(medico).texto }}
            </span>
            <!-- Fila -->
            <span
              v-if="medico.naFila > 0"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              style="background:#fef3c7;color:#b45309"
            >
              <Users :size="11" />
              {{ medico.naFila }} na fila
            </span>
          </div>
        </div>

        <!-- Corpo: URLs -->
        <div class="px-5 py-4 grid sm:grid-cols-2 gap-4">

          <!-- URL da Sala (pacientes) -->
          <div class="space-y-1.5">
            <p class="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Users :size="12" /> URL da Sala (compartilhe com pacientes)
            </p>
            <div class="flex gap-2">
              <div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono truncate"
                   style="background:var(--color-surface-2);color:var(--color-text-muted)">
                <span class="truncate">/sala/{{ medico.sala_slug }}</span>
              </div>
              <button
                class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style="background:#f0fdf4;color:#16a34a"
                title="Copiar URL da sala"
                @click="copiar(salaUrl(medico.sala_slug), medico.id + '-sala', 'sala')"
              >
                <CheckCircle2 v-if="copiado[medico.id + '-sala'] === 'sala'" :size="14" />
                <Copy v-else :size="14" />
                {{ copiado[medico.id + '-sala'] === 'sala' ? 'Copiado!' : 'Copiar' }}
              </button>
              <a
                :href="`/sala/${medico.sala_slug}`"
                target="_blank"
                rel="noopener"
                class="shrink-0 flex items-center p-2 rounded-lg"
                style="background:#f0fdf4;color:#16a34a"
                title="Abrir sala"
              >
                <ExternalLink :size="14" />
              </a>
            </div>
          </div>

          <!-- Link do Meet -->
          <div class="space-y-1.5">
            <p class="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Video :size="12" /> Link do Google Meet
            </p>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color:var(--color-text-dim)">
                  <Link :size="14" />
                </span>
                <input
                  v-model="editando[medico.id]"
                  type="url"
                  placeholder="https://meet.google.com/xxx-yyyy-zzz"
                  class="input-base pl-9 text-sm"
                  :style="erros[medico.id] ? 'border-color:#f87171' : houveMudanca(medico) ? 'border-color:#60a5fa' : ''"
                />
              </div>
              <button
                class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                :style="houveMudanca(medico)
                  ? 'background:#2563eb;color:white'
                  : 'background:var(--color-surface-2);color:var(--color-text-muted)'"
                :disabled="!houveMudanca(medico) || salvando[medico.id]"
                @click="salvar(medico)"
              >
                <Save :size="14" />
                {{ salvando[medico.id] ? '...' : 'Salvar' }}
              </button>
              <a
                :href="medico.meet_link"
                target="_blank"
                rel="noopener"
                class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                style="background:#eff6ff;color:#2563eb"
                title="Entrar no Meet"
              >
                <Video :size="14" />
                Entrar
              </a>
            </div>
            <p v-if="erros[medico.id]" class="text-xs text-red-500">{{ erros[medico.id] }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Vazio -->
    <div v-else class="text-center py-16 text-[var(--color-text-muted)]">
      <Video :size="40" class="mx-auto mb-3 opacity-30" />
      <p class="font-medium">Nenhum médico cadastrado</p>
      <p class="text-sm mt-1">Adicione médicos em <NuxtLink to="/admin/medicos" class="underline">Médicos</NuxtLink></p>
    </div>
  </div>
</template>
