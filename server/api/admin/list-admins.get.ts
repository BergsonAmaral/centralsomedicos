import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  if (!serviceKey) throw createError({ statusCode: 500, message: 'Service key não configurada' })

  const callerClient = await serverSupabaseClient(event)
  const { data: { user }, error: authError } = await callerClient.auth.getUser()
  if (authError || !user) throw createError({ statusCode: 401, message: 'Não autenticado' })
  const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'admin') throw createError({ statusCode: 403, message: 'Acesso negado' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: perfis } = await admin
    .from('profiles')
    .select('id, nome, is_superadmin, created_at')
    .eq('role', 'admin')
    .order('is_superadmin', { ascending: false })
    .order('nome')

  // profiles não tem e-mail — busca no auth.users pra cada um
  const resultado = await Promise.all((perfis ?? []).map(async (p) => {
    const { data: userData } = await admin.auth.admin.getUserById(p.id)
    return { ...p, email: userData?.user?.email ?? null }
  }))

  return resultado
})
