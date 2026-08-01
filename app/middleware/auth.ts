// middleware/auth.ts
// Middleware global: redireciona para login se não autenticado (exceto rotas públicas)
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/sala') || to.path.startsWith('/doc') || to.path.startsWith('/auth')) {
    return
  }

  const user = useSupabaseUser()

  // Fast path: user já está em memória
  if (user.value) return

  // Slow path (só na primeira carga): restaura sessão do localStorage (sem rede)
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return navigateTo('/auth/login')
  }
})
