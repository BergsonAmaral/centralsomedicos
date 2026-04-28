<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()

onMounted(async () => {
  if (!user.value) {
    return navigateTo('/auth/login')
  }
  const { data } = await supabase.from('profiles').select('role').eq('id', user.value.id).single()
  if (data?.role === 'admin') return navigateTo('/admin')
  if (data?.role === 'medico') return navigateTo('/medico')
  return navigateTo('/auth/login')
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-[var(--color-text-muted)]">Redirecionando...</p>
  </div>
</template>
