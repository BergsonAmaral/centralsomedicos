<script setup lang="ts">
import {
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  Stethoscope,
  Menu,
  X,
} from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navItems = [
  { label: 'Painel', icon: LayoutDashboard, to: '/medico' },
  { label: 'Histórico', icon: History, to: '/medico/historico' },
  { label: 'Configurações', icon: Settings, to: '/medico/configuracoes' },
]

function isActive(to: string) {
  if (to === '/medico') return route.path === '/medico'
  return route.path.startsWith(to)
}

async function logout() {
  await authStore.logout()
  navigateTo('/auth/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden" style="background:var(--color-bg)">

    <!-- ── SIDEBAR DESKTOP ── -->
    <aside class="hidden lg:flex flex-col w-56 shrink-0" style="background:#0A0C09;border-right:1px solid rgba(255,255,255,0.10)">

      <!-- Logo -->
      <div class="px-4 pt-5 pb-4">
        <div class="bg-white/95 rounded-xl px-3 py-2 flex items-center justify-center">
          <img src="/logo.png" alt="Central SóMedicos" class="h-16 w-auto" />
        </div>
        <p class="text-[10px] font-medium text-center mt-1.5 uppercase tracking-widest" style="color:#3dc4a4">Painel Médico</p>
      </div>

      <div class="mx-3 mb-2" style="height:1px;background:rgba(255,255,255,0.10)" />

      <!-- Nav -->
      <nav class="flex-1 px-2 py-1 space-y-0.5">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium relative"
          :style="isActive(item.to)
            ? 'background:rgba(45,170,138,0.15);color:#3dc4a4'
            : 'color:rgba(255,255,255,0.5)'"
        >
          <span
            v-if="isActive(item.to)"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
            style="background:#2daa8a"
          />
          <component :is="item.icon" :size="15"
            :style="isActive(item.to) ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Perfil -->
      <div class="mt-auto">
        <div class="mx-3 mb-2" style="height:1px;background:rgba(255,255,255,0.10)" />
        <div class="px-2 pb-4 space-y-1">
          <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style="background:rgba(255,255,255,0.10)">
            <UiAvatar :src="authStore.medicoData?.foto_url" :name="authStore.profile?.nome" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-white truncate">{{ authStore.profile?.nome }}</p>
              <p class="text-[10px] font-medium truncate" style="color:#3dc4a4">{{ authStore.medicoData?.especialidade }}</p>
            </div>
          </div>
          <button
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[rgba(255,255,255,0.10)]"
            style="color:#f87171"
            @click="logout"
          >
            <LogOut :size="14" />
            <span>Sair da conta</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- ── OVERLAY MOBILE ── -->
    <Transition name="fade">
      <div v-if="sidebarOpen" class="fixed inset-0 z-40 lg:hidden"
           style="background:rgba(0,0,0,0.6);backdrop-filter:blur(2px)"
           @click="sidebarOpen = false" />
    </Transition>

    <!-- ── SIDEBAR MOBILE ── -->
    <Transition name="slide-right">
      <aside v-if="sidebarOpen" class="fixed inset-y-0 left-0 z-50 w-56 flex flex-col lg:hidden"
             style="background:#0A0C09">
        <div class="px-4 py-4 flex items-center justify-between" style="border-bottom:1px solid rgba(255,255,255,0.10)">
          <div class="flex items-center gap-2.5">
            <div class="bg-white/95 rounded-lg px-2 py-1">
              <img src="/logo.png" alt="Central SóMedicos" class="h-12 w-auto" />
            </div>
          </div>
          <button class="text-[#3dc4a4] hover:text-white transition-colors" @click="sidebarOpen = false">
            <X :size="18" />
          </button>
        </div>
        <nav class="flex-1 px-2 py-2 space-y-0.5">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium"
            :style="isActive(item.to) ? 'background:rgba(45,170,138,0.15);color:#3dc4a4' : 'color:rgba(255,255,255,0.4)'"
            @click="sidebarOpen = false"
          >
            <component :is="item.icon" :size="15" />
            {{ item.label }}
          </NuxtLink>
        </nav>
        <div class="px-2 pb-4">
          <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium"
                  style="color:#f87171" @click="logout">
            <LogOut :size="14" /><span>Sair</span>
          </button>
        </div>
      </aside>
    </Transition>

    <!-- ── CONTEÚDO ── -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <header class="lg:hidden flex items-center gap-3 px-4 py-3 bg-white"
              style="border-bottom:1px solid var(--color-border);box-shadow:0 1px 3px rgba(15,23,42,0.05)">
        <button class="text-slate-400 hover:text-slate-700 transition-colors" @click="sidebarOpen = true">
          <Menu :size="20" />
        </button>
        <img src="/logo.png" alt="Central SóMedicos" class="h-14 w-auto" />
      </header>
      <main id="medico-main" class="flex-1 overflow-hidden p-5 lg:p-6 relative">
        <div class="h-full overflow-y-auto">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
nav a:not([style*="color:#3dc4a4"]):hover {
  background: rgba(255,255,255,0.06);
  color: #a8d4cc;
}
.fade-enter-active, .fade-leave-active { transition: opacity 200ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-right-enter-active, .slide-right-leave-active { transition: transform 250ms cubic-bezier(0.16,1,0.3,1); }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(-100%); }
</style>
