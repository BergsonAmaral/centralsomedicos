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
} from 'lucide-vue-next'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin' },
  { label: 'Atendimentos', icon: ClipboardList, to: '/admin/fila' },
  { label: 'Importar SUS', icon: Upload, to: '/admin/importar' },
  { label: 'Médicos', icon: Stethoscope, to: '/admin/medicos' },
  { label: 'Salas', icon: DoorOpen, to: '/admin/salas' },
  { label: 'Pacientes', icon: Users2, to: '/admin/pacientes' },
  { label: 'Documentos', icon: FileText, to: '/admin/documentos' },
  { label: 'Relatórios', icon: BarChart3, to: '/admin/relatorios' },
  { label: 'Financeiro', icon: DollarSign, to: '/admin/financeiro' },
  { label: 'Logs', icon: Activity, to: '/admin/logs' },
]

function isActive(to: string) {
  if (to === '/admin') return route.path === '/admin'
  return route.path.startsWith(to)
}

async function logout() {
  try { await useAdminLog().registrar('logout') } catch {}
  await authStore.logout()
  navigateTo('/auth/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden" style="background:#f8fafc">

    <!-- ── SIDEBAR DESKTOP ── -->
    <aside
      class="hidden lg:flex flex-col w-56 shrink-0"
      style="background:#0f172a;border-right:1px solid #1e293b"
    >
      <!-- Logo -->
      <div class="px-4 pt-5 pb-4">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style="background:linear-gradient(135deg,#059669,#2563eb)"
          >
            <Stethoscope :size="15" class="text-white" />
          </div>
          <div>
            <p class="font-bold text-white text-sm leading-tight tracking-tight">SoMedicos</p>
            <p class="text-[10px] font-medium" style="color:#475569;letter-spacing:0.05em">ADMINISTRAÇÃO</p>
          </div>
        </div>
      </div>

      <!-- Divisor -->
      <div class="mx-3 mb-2" style="height:1px;background:#1e293b" />

      <!-- Nav -->
      <nav class="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium relative group"
          :style="isActive(item.to)
            ? 'background:rgba(16,185,129,0.12);color:#34d399'
            : 'color:#64748b'"
        >
          <!-- indicador lateral ativo -->
          <span
            v-if="isActive(item.to)"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
            style="background:#10b981"
          />
          <component
            :is="item.icon"
            :size="15"
            :style="isActive(item.to) ? 'color:#34d399' : 'color:#475569'"
          />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Perfil -->
      <div class="mt-auto">
        <div class="mx-3 mb-2" style="height:1px;background:#1e293b" />
        <div class="px-2 pb-4 space-y-1">
          <div class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style="background:#1e293b">
            <UiAvatar :name="authStore.profile?.nome" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-white truncate">{{ authStore.profile?.nome }}</p>
              <p class="text-[10px] font-medium" style="color:#475569">Administrador</p>
            </div>
          </div>
          <button
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[#1e293b]"
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
        class="fixed inset-y-0 left-0 z-50 w-56 flex flex-col lg:hidden"
        style="background:#0f172a"
      >
        <div class="px-4 py-4 flex items-center justify-between" style="border-bottom:1px solid #1e293b">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-xl flex items-center justify-center"
          style="background:linear-gradient(135deg,#059669,#2563eb)">
              <Stethoscope :size="13" class="text-white" />
            </div>
            <span class="font-bold text-white text-sm tracking-tight">SoMedicos</span>
          </div>
          <button class="text-slate-400 hover:text-white transition-colors" @click="sidebarOpen = false">
            <X :size="18" />
          </button>
        </div>
        <nav class="flex-1 px-2 py-2 space-y-0.5">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium"
            :style="isActive(item.to) ? 'background:rgba(16,185,129,0.12);color:#34d399' : 'color:#64748b'"
            @click="sidebarOpen = false"
          >
            <component :is="item.icon" :size="15" />
            {{ item.label }}
          </NuxtLink>
        </nav>
        <div class="px-2 pb-4">
          <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium" style="color:#f87171" @click="logout">
            <LogOut :size="14" /><span>Sair</span>
          </button>
        </div>
      </aside>
    </Transition>

    <!-- ── CONTEÚDO ── -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Topbar mobile -->
      <header
        class="lg:hidden flex items-center gap-3 px-4 py-3 bg-white"
        style="border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.05)"
      >
        <button class="text-slate-400 hover:text-slate-700 transition-colors" @click="sidebarOpen = true">
          <Menu :size="20" />
        </button>
        <span class="font-bold text-slate-900 text-sm tracking-tight">SoMedicos</span>
      </header>

      <main class="flex-1 overflow-y-auto p-5 lg:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Hover nos itens da nav sem JS */
nav a:not([style*="color:#34d399"]):hover {
  background: rgba(255,255,255,0.06);
  color: #cbd5e1;
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
