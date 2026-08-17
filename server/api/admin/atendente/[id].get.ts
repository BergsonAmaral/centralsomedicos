import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  if (!serviceKey) throw createError({ statusCode: 500, message: 'Service key não configurada' })

  const callerClient = await serverSupabaseClient(event)
  const { data: { user }, error: authError } = await callerClient.auth.getUser()
  if (authError || !user) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: atendente, error } = await admin
    .from('atendentes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !atendente) {
    throw createError({ statusCode: 404, message: 'Atendente não encontrado' })
  }

  let email: string | null = null
  if (atendente.user_id) {
    const { data: userData } = await admin.auth.admin.getUserById(atendente.user_id)
    email = userData?.user?.email ?? null
  }

  return { ...atendente, email }
})
