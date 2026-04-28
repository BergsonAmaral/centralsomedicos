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

  async function loadProfile(force = false) {
    // Se já carregado e não forçado, usa cache do store
    if (profile.value && !force) return

    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    loading.value = true
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
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    profile.value = null
    medicoData.value = null
  }

  // Carrega ao montar se já autenticado
  if (import.meta.client && user.value) {
    loadProfile()
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
