<script setup lang="ts">
import {
  LayoutDashboard,
  Users2,
  ClipboardList,
  Upload,
  FileText,
  BarChart3,
  UserCheck,
  LogOut,
  Stethoscope,
  Menu,
  X,
  Activity,
  DollarSign,
  DoorOpen,
  CalendarCheck,
  ChevronDown,
  Building2,
  UserCog,
} from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navItemsTop = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin' },
  { label: 'Fila de Espera', icon: ClipboardList, to: '/admin/fila' },
  { label: 'Consultas', icon: CalendarCheck, to: '/admin/consultas' },
  { label: 'Importar SUS', icon: Upload, to: '/admin/importar' },
]

const cadastroItems = [
  { label: 'Médicos', icon: Stethoscope, to: '/admin/medicos' },
  { label: 'Atendentes', icon: UserCog, to: '/admin/atendentes' },
  { label: 'Salas', icon: DoorOpen, to: '/admin/salas' },
  { label: 'Unidades', icon: Building2, to: '/admin/unidades' },
  { label: 'Pacientes', icon: Users2, to: '/admin/pacientes' },
]

const navItemsBottom = [
  { label: 'Documentos', icon: FileText, to: '/admin/documentos' },
  { label: 'Relatórios', icon: BarChart3, to: '/admin/relatorios' },
  { label: 'Financeiro', icon: DollarSign, to: '/admin/financeiro' },
  { label: 'Logs', icon: Activity, to: '/admin/logs' },
]

const isCadastroActive = computed(() => cadastroItems.some(i => isActive(i.to)))
const cadastrosOpen = ref(false)
watch(isCadastroActive, (val) => { if (val) cadastrosOpen.value = true }, { immediate: true })

const allNavItems = computed(() => [...navItemsTop, ...cadastroItems, ...navItemsBottom])
const currentLabel = computed(() => {
  if (isCadastroActive.value) {
    const child = cadastroItems.find(n => isActive(n.to))
    return child ? `Cadastros › ${child.label}` : 'Cadastros'
  }
  return allNavItems.value.find(n => isActive(n.to))?.label ?? 'Painel'
})

function isActive(to: string) {
  if (to === '/admin') return route.path === '/admin'
  return route.path.startsWith(to)
}

async function logout() {
  try { await useAdminLog().registrar('logout') } catch {}
  await authStore.logout()
  // Navegação forçada (recarrega a página) em vez de navigateTo: trocar de
  // layout inteiro (admin → login) via SPA às vezes pintava a tela antes do
  // CSS do novo layout terminar de carregar, deixando o grid quebrado.
  window.location.href = '/auth/login'
}
</script>

<template>
  <div class="flex h-screen overflow-hidden" style="background:var(--color-bg)">

    <!-- ── SIDEBAR DESKTOP ── -->
    <aside
      class="hidden lg:flex flex-col w-60 shrink-0"
      style="background:linear-gradient(180deg,#0A0C09 0%,#14140f 100%);border-right:1px solid rgba(255,255,255,0.08)"
    >
      <!-- Logo -->
      <div class="px-4 pt-6 pb-4">
        <div class="bg-white/95 rounded-xl px-3 py-2.5 flex items-center justify-center" style="box-shadow:0 2px 8px rgba(0,0,0,0.15)">
          <img src="/logo.png" alt="Central SóMedicos" class="h-16 w-auto" />
        </div>
        <p class="text-[10px] font-bold text-center mt-2 uppercase tracking-widest" style="color:#2daa8a">ADMINISTRAÇÃO</p>
      </div>

      <!-- Divisor -->
      <div class="mx-4 mb-3" style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)" />

      <!-- Nav -->
      <nav class="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        <!-- Top items -->
        <NuxtLink
          v-for="item in navItemsTop"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium relative transition-all"
          :style="isActive(item.to) ? 'background:rgba(45,170,138,0.16);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
        >
          <span v-if="isActive(item.to)" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style="background:#2daa8a;box-shadow:0 0 8px rgba(45,170,138,0.6)" />
          <component :is="item.icon" :size="16" :style="isActive(item.to) ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
          <span>{{ item.label }}</span>
        </NuxtLink>

        <!-- Cadastros group -->
        <div>
          <button
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative"
            :style="isCadastroActive ? 'background:rgba(45,170,138,0.16);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
            @click="cadastrosOpen = !cadastrosOpen"
          >
            <span v-if="isCadastroActive" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style="background:#2daa8a;box-shadow:0 0 8px rgba(45,170,138,0.6)" />
            <UserCheck :size="16" :style="isCadastroActive ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
            <span class="flex-1 text-left">Cadastros</span>
            <ChevronDown
              :size="14"
              class="transition-transform duration-200"
              :style="(cadastrosOpen ? 'transform:rotate(180deg);' : '') + (isCadastroActive ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)')"
            />
          </button>
          <div v-if="cadastrosOpen" class="ml-3 mt-0.5 space-y-0.5 border-l pl-3" style="border-color:rgba(255,255,255,0.12)">
            <NuxtLink
              v-for="item in cadastroItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium relative transition-all"
              :style="isActive(item.to) ? 'background:rgba(45,170,138,0.12);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
            >
              <component :is="item.icon" :size="15" :style="isActive(item.to) ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </div>
        </div>

        <!-- Bottom items -->
        <div class="mx-1 mt-3 mb-1 flex items-center gap-2">
          <div class="flex-1" style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)" />
          <span class="text-[9px] font-bold uppercase tracking-widest px-1" style="color:rgba(255,255,255,0.2)">Administrativo</span>
          <div class="flex-1" style="height:1px;background:linear-gradient(90deg,rgba(255,255,255,0.12),transparent)" />
        </div>
        <NuxtLink
          v-for="item in navItemsBottom"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium relative transition-all"
          :style="isActive(item.to) ? 'background:rgba(45,170,138,0.16);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
        >
          <span v-if="isActive(item.to)" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style="background:#2daa8a;box-shadow:0 0 8px rgba(45,170,138,0.6)" />
          <component :is="item.icon" :size="16" :style="isActive(item.to) ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Perfil -->
      <div class="mt-auto">
        <div class="mx-4 mb-3" style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)" />
        <div class="px-3 pb-5 space-y-1.5">
          <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14)">
            <UiAvatar :name="authStore.profile?.nome" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-white truncate">{{ authStore.profile?.nome }}</p>
              <p class="text-[10px] font-medium" style="color:rgba(255,255,255,0.4)">Administrador</p>
            </div>
          </div>
          <button
            class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style="color:#f87171"
            @mouseenter="($event.currentTarget as HTMLElement).style.background='rgba(248,113,113,0.08)'"
            @mouseleave="($event.currentTarget as HTMLElement).style.background='transparent'"
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
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 lg:hidden"
        style="background:rgba(0,0,0,0.6);backdrop-filter:blur(2px)"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- ── SIDEBAR MOBILE ── -->
    <Transition name="slide-right">
      <aside
        v-if="sidebarOpen"
        class="fixed inset-y-0 left-0 z-50 w-60 flex flex-col lg:hidden"
        style="background:linear-gradient(180deg,#0A0C09 0%,#14140f 100%)"
      >
        <div class="px-4 py-4 flex items-center justify-between" style="border-bottom:1px solid rgba(255,255,255,0.08)">
          <div class="flex items-center gap-2.5">
            <div class="bg-white/95 rounded-lg px-2 py-1">
              <img src="/logo.png" alt="Central SóMedicos" class="h-12 w-auto" />
            </div>
          </div>
          <button class="text-white/40 hover:text-white transition-colors" @click="sidebarOpen = false">
            <X :size="18" />
          </button>
        </div>
        <nav class="flex-1 px-3 py-2 space-y-0.5">
          <NuxtLink
            v-for="item in navItemsTop"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium relative"
            :style="isActive(item.to) ? 'background:rgba(45,170,138,0.16);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
            @click="sidebarOpen = false"
          >
            <span v-if="isActive(item.to)" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style="background:#2daa8a" />
            <component :is="item.icon" :size="16" :style="isActive(item.to) ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
            {{ item.label }}
          </NuxtLink>

          <!-- Cadastros group mobile -->
          <div>
            <button
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium relative transition-all"
              :style="isCadastroActive ? 'background:rgba(45,170,138,0.16);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
              @click="cadastrosOpen = !cadastrosOpen"
            >
              <span v-if="isCadastroActive" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style="background:#2daa8a" />
              <UserCheck :size="16" :style="isCadastroActive ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
              <span class="flex-1 text-left">Cadastros</span>
              <ChevronDown :size="14" class="transition-transform duration-200" :style="(cadastrosOpen ? 'transform:rotate(180deg);' : '') + (isCadastroActive ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)')" />
            </button>
            <div v-if="cadastrosOpen" class="ml-3 mt-0.5 space-y-0.5 border-l pl-3" style="border-color:rgba(255,255,255,0.12)">
              <NuxtLink
                v-for="item in cadastroItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium relative"
                :style="isActive(item.to) ? 'background:rgba(45,170,138,0.12);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
                @click="sidebarOpen = false"
              >
                <component :is="item.icon" :size="15" :style="isActive(item.to) ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
                {{ item.label }}
              </NuxtLink>
            </div>
          </div>

          <!-- Admin section divider mobile -->
          <div class="mx-1 mt-3 mb-1 flex items-center gap-2">
            <div class="flex-1" style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)" />
            <span class="text-[9px] font-bold uppercase tracking-widest px-1" style="color:rgba(255,255,255,0.2)">Administrativo</span>
            <div class="flex-1" style="height:1px;background:linear-gradient(90deg,rgba(255,255,255,0.12),transparent)" />
          </div>

          <NuxtLink
            v-for="item in navItemsBottom"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium relative"
            :style="isActive(item.to) ? 'background:rgba(45,170,138,0.16);color:#7de8d0' : 'color:rgba(255,255,255,0.55)'"
            @click="sidebarOpen = false"
          >
            <span v-if="isActive(item.to)" class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style="background:#2daa8a" />
            <component :is="item.icon" :size="16" :style="isActive(item.to) ? 'color:#2daa8a' : 'color:rgba(255,255,255,0.4)'" />
            {{ item.label }}
          </NuxtLink>
        </nav>
        <div class="px-3 pb-4">
          <button class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium" style="color:#f87171" @click="logout">
            <LogOut :size="14" /><span>Sair</span>
          </button>
        </div>
      </aside>
    </Transition>

    <!-- ── CONTEÚDO ── -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

      <!-- Topbar desktop -->
      <header class="hidden lg:flex items-center justify-between px-6 py-3.5 shrink-0 bg-white" style="border-bottom:1px solid var(--color-border);box-shadow:0 1px 0 var(--color-border-light)">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider" style="color:var(--color-text-dim)">Admin</span>
          <span class="text-xs" style="color:var(--color-text-dim)">›</span>
          <span class="text-sm font-semibold" style="color:var(--color-text)">{{ currentLabel }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs" style="color:var(--color-text-muted)">
          <span class="capitalize">{{ new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</span>
        </div>
      </header>

      <!-- Topbar mobile -->
      <header
        class="lg:hidden flex items-center gap-3 px-4 py-3 bg-white"
        style="border-bottom:1px solid var(--color-border);box-shadow:0 1px 3px rgba(10,12,9,0.05)"
      >
        <button class="text-slate-400 hover:text-slate-700 transition-colors" @click="sidebarOpen = true">
          <Menu :size="20" />
        </button>
        <img src="/logo.png" alt="Central SóMedicos" class="h-14 w-auto" />
      </header>

      <main class="flex-1 overflow-y-auto p-5 lg:p-7 content-dots">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Hover nos itens da nav sem JS */
nav a:not([style*="color:#7de8d0"]):hover {
  background: rgba(255,255,255,0.07);
  color: #a8c8e0;
}

/* Transitions Vue */
.fade-enter-active,
.fade-leave-active { transition: opacity 200ms ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

.slide-right-enter-active,
.slide-right-leave-active { transition: transform 250ms cubic-bezier(0.16,1,0.3,1); }
.slide-right-enter-from,
.slide-right-leave-to     { transform: translateX(-100%); }
</style>
