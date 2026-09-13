// middleware/manutencao.global.ts
// Modo manutenção (liga/desliga via env NUXT_PUBLIC_MANUTENCAO) — roda antes
// de qualquer outro middleware, em toda rota, e redireciona pra /manutencao
// enquanto ativo. Desativado, não faz nada (comportamento normal do site).
export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig()
  if (!config.public.manutencao) return
  if (to.path === '/manutencao') return
  return navigateTo('/manutencao')
})
