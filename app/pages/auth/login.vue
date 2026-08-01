<script setup lang="ts">
import { Mail, Lock, AlertCircle } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const senha = ref('')
const erro = ref('')
const carregando = ref(false)

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
    class="min-h-screen flex items-center justify-center px-4 py-10"
    style="background: linear-gradient(135deg, #f4f7fb 0%, #e8eef8 50%, #e6f5f1 100%)"
  >
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <img src="/logo.png" alt="Central SóMedicos" class="w-auto object-contain" style="height:120px" />
        <p class="text-xs text-slate-500 mt-3">Plataforma de teleconsultas SUS</p>
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
              <Mail :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input
                v-model="email"
                type="email"
                placeholder="seu@email.com"
                :disabled="carregando"
                class="input-base"
              >
            </div>
          </div>

          <!-- Senha -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-700 uppercase tracking-wide">Senha</label>
            <div class="relative">
              <Lock :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input
                v-model="senha"
                type="password"
                placeholder="••••••••"
                :disabled="carregando"
                class="input-base"
              >
            </div>
          </div>

          <!-- Botão -->
          <button
            type="submit"
            :disabled="carregando"
            class="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-2 inline-flex items-center justify-center gap-2 login-btn"
            style="background: linear-gradient(135deg, #1e4d9a, #2daa8a)"
          >
            <template v-if="!carregando">Entrar</template>
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

      <p class="text-center text-xs text-slate-500 mt-6">
        Acesso restrito a profissionais cadastrados ·
        <span class="text-slate-400">Suporte via administração</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.input-base {
  width: 100%;
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
  padding-left: 2.25rem;
  padding-right: 0.875rem;
  font-size: 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #0f172a;
  outline: none;
  transition: border-color 200ms, box-shadow 200ms;
}
.input-base::placeholder { color: #94a3b8; }
.input-base:focus {
  border-color: #2daa8a;
  box-shadow: 0 0 0 3px rgba(45,170,138,0.12);
  background: white;
}
.input-base:disabled { opacity: 0.5; cursor: not-allowed; }

.login-btn {
  box-shadow: 0 4px 20px rgba(45,170,138,0.3);
  transition: box-shadow 200ms ease;
}
.login-btn:not(:disabled):hover {
  box-shadow: 0 8px 28px rgba(45,170,138,0.4);
}
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
