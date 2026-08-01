import { defineStore } from 'pinia'
import type { Profile, Medico } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const profile = ref<Profile | null>(null)
  const medicoData = ref<Medico | null>(null)
  const loading = ref(false)

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isMedico = computed(() => profile.value?.role === 'medico')
  const medicoId = computed(() => medicoData.value?.id ?? null)

  // Evita múltiplas chamadas simultâneas ao banco
  let _loadingPromise: Promise<void> | null = null

  async function loadProfile(force = false) {
    // Cache hit — retorna imediatamente sem rede
    if (profile.value && !force) return

    // Se já há uma carga em andamento, aguarda a mesma promise
    if (_loadingPromise) return _loadingPromise

    // Usa o user reativo (já em memória, sem chamada de rede)
    const authUser = user.value
    if (!authUser) return

    loading.value = true
    _loadingPromise = (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()
        profile.value = data

        if (data?.role === 'medico') {
          const { data: med } = await supabase
            .from('medicos')
            .select('*')
            .eq('user_id', authUser.id)
            .single()
          medicoData.value = med
        }
      } finally {
        loading.value = false
        _loadingPromise = null
      }
    })()

    return _loadingPromise
  }

  async function logout() {
    await supabase.auth.signOut()
    profile.value = null
    medicoData.value = null
  }

  // Carrega assim que o user fica disponível (evita espera no middleware)
  if (import.meta.client) {
    if (user.value) {
      loadProfile()
    } else {
      const stop = watch(user, (u) => {
        if (u) { loadProfile(); stop() }
      })
    }
  }

  return {
    user,
    profile,
    medicoData,
    medicoId,
    loading,
    isAdmin,
    isMedico,
    loadProfile,
    logout,
  }
})
