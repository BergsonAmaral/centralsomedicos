<script setup lang="ts">
import { Mail, Lock, AlertCircle } from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const authStore = useAuthStore()

const email = ref('')
const senha = ref('')
const erro = ref('')
const carregando = ref(false)

const user = useSupabaseUser()
onMounted(async () => {
  if (user.value) {
    await authStore.loadProfile()
    // Recarrega a página em vez de navegar via SPA: trocar do layout de
    // login (sem layout) para admin/medico dentro da mesma sessão de router
    // às vezes pintava a tela antes do CSS do novo layout carregar,
    // deixando o grid quebrado até um refresh manual.
    if (authStore.isAdmin) window.location.href = '/admin'
    else if (authStore.isMedico) window.location.href = '/medico'
    else if (authStore.isAtendente) window.location.href = '/atendente'
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
      window.location.href = '/admin'
    } else if (authStore.isMedico) {
      window.location.href = '/medico'
    } else if (authStore.isAtendente) {
      window.location.href = '/atendente'
    } else {
      erro.value = 'Acesso não autorizado.'
    }
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="login-page min-h-screen flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <img src="/logo.png" alt="Central SóMedicos" class="w-auto object-contain" style="height:110px" />
      </div>

      <!-- Card -->
      <div class="login-card">
        <div class="mb-6">
          <h2 class="login-title">Bem-vindo de volta</h2>
          <p class="login-subtitle">Entre com suas credenciais</p>
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
            <label class="login-label">E-mail</label>
            <div class="relative">
              <Mail :size="15" class="input-icon" />
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
            <label class="login-label">Senha</label>
            <div class="relative">
              <Lock :size="15" class="input-icon" />
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
            class="login-btn"
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

      <p class="login-footer">
        Acesso restrito a profissionais cadastrados ·
        <span class="login-footer-dim">Suporte via administração</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  background: #F2F0EA;
  font-family: 'Inter', sans-serif;
}

.login-card {
  background: #fff;
  border-radius: 1.25rem;
  padding: 1.75rem;
  border: 1px solid rgba(10,12,9,0.08);
  box-shadow: 0 20px 50px -20px rgba(10,12,9,0.12), 0 4px 12px -4px rgba(10,12,9,0.04);
}

.login-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0A0C09;
}
.login-subtitle {
  color: #767670;
  font-size: 0.8125rem;
  margin-top: 0.15rem;
}

.login-label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0A0C09;
}

.input-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #a3a199;
  pointer-events: none;
  z-index: 10;
}

.input-base {
  width: 100%;
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
  padding-left: 2.25rem;
  padding-right: 0.875rem;
  font-size: 0.875rem;
  border-radius: 0.65rem;
  border: 1px solid rgba(10,12,9,0.12);
  background: #F9F8F4;
  color: #0A0C09;
  outline: none;
  transition: border-color 200ms, box-shadow 200ms;
}
.input-base::placeholder { color: #a3a199; }
.input-base:focus {
  border-color: #2daa8a;
  box-shadow: 0 0 0 3px rgba(45,170,138,0.14);
  background: white;
}
.input-base:disabled { opacity: 0.5; cursor: not-allowed; }

.login-btn {
  width: 100%;
  margin-top: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.8rem 1.5rem;
  border-radius: 100px;
  background: #2daa8a;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: opacity 200ms, transform 200ms;
}
.login-btn:not(:disabled):hover { opacity: 0.88; transform: translateY(-1px); }
.login-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.login-footer {
  text-align: center;
  font-size: 0.75rem;
  color: #767670;
  margin-top: 1.5rem;
}
.login-footer-dim { color: #a3a199; }
</style>
