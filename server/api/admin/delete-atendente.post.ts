import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey

  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

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

  const body = await readBody(event)
  const { atendenteId } = body
  if (!atendenteId) {
    throw createError({ statusCode: 400, message: 'atendenteId é obrigatório' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: atendente } = await admin
    .from('atendentes')
    .select('id, user_id')
    .eq('id', atendenteId)
    .single()
  if (!atendente) {
    throw createError({ statusCode: 404, message: 'Atendente não encontrado' })
  }

  const { error: delAtdError } = await admin.from('atendentes').delete().eq('id', atendenteId)
  if (delAtdError) {
    throw createError({ statusCode: 400, message: delAtdError.message })
  }

  if (atendente.user_id) {
    await admin.from('profiles').delete().eq('id', atendente.user_id)
    await admin.auth.admin.deleteUser(atendente.user_id)
  }

  return { ok: true }
})
