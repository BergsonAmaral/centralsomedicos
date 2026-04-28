<script setup lang="ts">
import { Stethoscope, Mail, Lock, AlertCircle } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const senha = ref('')
const erro = ref('')
const carregando = ref(false)

// Se já logado, redirecionar
const user = useSupabaseUser()
onMounted(async () => {
  if (user.value) {
    await authStore.loadProfile()
    if (authStore.isAdmin) router.replace('/admin')
    else if (authStore.isMedico) router.replace('/medico')
  }
})

async function entrar() {
  erro.value = ''
  if (!email.value || !senha.value) {
    erro.value = 'Preencha e-mail e senha.'
    return
  }

  carregando.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: senha.value,
    })

    if (error) {
      erro.value = 'E-mail ou senha inválidos.'
      return
    }

    await authStore.loadProfile()

    if (authStore.isAdmin) {
      const adminLog = useAdminLog()
      await adminLog.registrar('login')
      await router.replace('/admin')
    } else if (authStore.isMedico) {
      await router.replace('/medico')
    } else {
      erro.value = 'Acesso não autorizado.'
    }
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
    style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #ecfeff 100%)"
  >
    <!-- Blobs decorativos de fundo -->
    <div
      class="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-30 pointer-events-none"
      style="background: radial-gradient(circle, #93c5fd 0%, transparent 70%)"
    />
    <div
      class="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-30 pointer-events-none"
      style="background: radial-gradient(circle, #67e8f9 0%, transparent 70%)"
    />

    <div class="relative w-full max-w-md">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-6">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg mb-3"
          style="background: linear-gradient(135deg, #2563eb, #06b6d4); box-shadow: 0 10px 30px -8px rgba(37,99,235,0.5)"
        >
          <Stethoscope :size="26" class="text-white" />
        </div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">SoMedicos</h1>
        <p class="text-xs text-slate-500 mt-1">Plataforma de teleconsultas SUS</p>
      </div>

      <!-- Card -->
      <div
        class="bg-white rounded-2xl p-7"
        style="border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 20px 60px -15px rgba(15,23,42,0.15), 0 4px 12px -4px rgba(15,23,42,0.05)"
      >
        <div class="mb-5">
          <h2 class="text-lg font-semibold text-slate-900">Bem-vindo de volta</h2>
          <p class="text-slate-500 text-sm mt-0.5">Entre com suas credenciais</p>
        </div>

        <form class="space-y-4" @submit.prevent="entrar">
          <!-- Erro -->
          <div
            v-if="erro"
            class="flex items-start gap-2.5 p-3 rounded-lg text-sm"
            style="background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c"
          >
            <AlertCircle :size="16" class="shrink-0 mt-0.5" />
            <span>{{ erro }}</span>
          </div>

          <!-- E-mail -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-700 uppercase tracking-wide">E-mail</label>
            <div class="relative">
              <Mail :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="email"
                type="email"
                placeholder="seu@email.com"
                :disabled="carregando"
                class="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                style="border: 1.5px solid #e2e8f0; background: white"
                @focus="($event.target as HTMLElement).style.borderColor='#2563eb'; ($event.target as HTMLElement).style.boxShadow='0 0 0 3px rgba(37,99,235,0.1)'"
                @blur="($event.target as HTMLElement).style.borderColor='#e2e8f0'; ($event.target as HTMLElement).style.boxShadow='none'"
              >
            </div>
          </div>

          <!-- Senha -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Senha</label>
            <div class="relative">
              <Lock :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="senha"
                type="password"
                placeholder="••••••••"
                :disabled="carregando"
                class="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                style="border: 1.5px solid #e2e8f0; background: white"
                @focus="($event.target as HTMLElement).style.borderColor='#2563eb'; ($event.target as HTMLElement).style.boxShadow='0 0 0 3px rgba(37,99,235,0.1)'"
                @blur="($event.target as HTMLElement).style.borderColor='#e2e8f0'; ($event.target as HTMLElement).style.boxShadow='none'"
              >
            </div>
          </div>

          <!-- Botão -->
          <button
            type="submit"
            :disabled="carregando"
            class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all mt-2 inline-flex items-center justify-center gap-2"
            :style="`background: linear-gradient(135deg, #2563eb, #0891b2); box-shadow: 0 6px 20px -6px rgba(37,99,235,0.5); ${carregando ? 'opacity:0.6;cursor:not-allowed' : 'cursor:pointer'}`"
          >
            <span v-if="!carregando">Entrar</span>
            <template v-else>
              <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Entrando...
            </template>
          </button>
        </form>
      </div>

      <!-- Rodapé -->
      <p class="text-center text-xs text-slate-500 mt-6">
        Acesso restrito a profissionais cadastrados ·
        <span class="text-slate-400">Suporte via administração</span>
      </p>
    </div>
  </div>
</template>
