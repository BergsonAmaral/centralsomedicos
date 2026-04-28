// middleware/auth.ts
// Middleware global: redireciona para login se não autenticado (exceto rotas públicas)
export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/sala') || to.path.startsWith('/doc') || to.path.startsWith('/auth')) {
    return
  }

  // useSupabaseUser é reativo (sem rede) — suficiente para guard rápido
  // O middleware role.ts faz a verificação completa de role logo depois
  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo('/auth/login')
  }
})
