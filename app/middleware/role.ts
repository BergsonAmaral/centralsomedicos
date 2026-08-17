// middleware/role.ts
// Verifica role do usuário via store (sem queries extras por navegação)
export default defineNuxtRouteMiddleware(async (to) => {
  if (
    to.path.startsWith('/sala') ||
    to.path.startsWith('/doc') ||
    to.path.startsWith('/auth')
  ) {
    return
  }

  const authStore = useAuthStore()
  // Usa cache do store; só busca no banco se ainda não carregou
  await authStore.loadProfile()

  if (!authStore.profile) {
    return navigateTo('/auth/login')
  }

  if (to.path.startsWith('/admin') && !authStore.isAdmin) {
    return navigateTo('/auth/login')
  }

  if (to.path.startsWith('/medico') && !authStore.isMedico) {
    return navigateTo('/auth/login')
  }

  if (to.path.startsWith('/atendente') && !authStore.isAtendente) {
    return navigateTo('/auth/login')
  }
})
