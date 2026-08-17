import { defineStore } from 'pinia'
import type { Profile, Medico, Atendente } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const profile = ref<Profile | null>(null)
  const medicoData = ref<Medico | null>(null)
  const atendenteData = ref<Atendente | null>(null)
  const loading = ref(false)

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isMedico = computed(() => profile.value?.role === 'medico')
  const isAtendente = computed(() => profile.value?.role === 'atendente')
  const medicoId = computed(() => medicoData.value?.id ?? null)
  const atendenteUnidadeId = computed(() => atendenteData.value?.unidade_id ?? null)

  // Evita múltiplas chamadas simultâneas ao banco
  let _loadingPromise: Promise<void> | null = null

  async function loadProfile(force = false) {
    // Usa o user reativo (já em memória, sem chamada de rede)
    const authUser = user.value
    if (!authUser) {
      profile.value = null
      medicoData.value = null
      atendenteData.value = null
      return
    }

    // Cache hit só é válido se o profile em memória é do usuário logado agora
    // (evita servir o perfil de uma sessão anterior após trocar de conta)
    if (profile.value && profile.value.id === authUser.id && !force) return

    // Se já há uma carga em andamento, aguarda a mesma promise
    if (_loadingPromise) return _loadingPromise

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
          atendenteData.value = null
        } else if (data?.role === 'atendente') {
          const { data: atd } = await supabase
            .from('atendentes')
            .select('*, unidades(id, nome)')
            .eq('user_id', authUser.id)
            .single()
          atendenteData.value = atd
          medicoData.value = null
        } else {
          medicoData.value = null
          atendenteData.value = null
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
    atendenteData.value = null
  }

  // Recarrega sempre que o usuário autenticado mudar (login, logout ou troca de conta)
  if (import.meta.client) {
    watch(user, (u, prevU) => {
      if (u?.id !== prevU?.id) loadProfile(true)
    }, { immediate: true })
  }

  return {
    user,
    profile,
    medicoData,
    medicoId,
    atendenteData,
    atendenteUnidadeId,
    loading,
    isAdmin,
    isMedico,
    isAtendente,
    loadProfile,
    logout,
  }
})
