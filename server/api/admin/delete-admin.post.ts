import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

  // Só superadmin pode excluir um admin — e nem superadmin pode excluir
  // outro superadmin por aqui (proteção contra exclusão acidental/maliciosa).
  const callerClient = await serverSupabaseClient(event)
  const { data: { user }, error: authError } = await callerClient.auth.getUser()
  if (authError || !user) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role, is_superadmin')
    .eq('id', user.id)
    .single()
  if (callerProfile?.role !== 'admin' || !callerProfile?.is_superadmin) {
    throw createError({ statusCode: 403, message: 'Só superadmin pode excluir um admin' })
  }

  const body = await readBody(event)
  const { adminId } = body
  if (!adminId) throw createError({ statusCode: 400, message: 'adminId obrigatório' })
  if (adminId === user.id) throw createError({ statusCode: 400, message: 'Você não pode excluir a própria conta.' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: alvo } = await admin.from('profiles').select('role, is_superadmin').eq('id', adminId).single()
  if (!alvo || alvo.role !== 'admin') {
    throw createError({ statusCode: 404, message: 'Admin não encontrado' })
  }
  if (alvo.is_superadmin) {
    throw createError({ statusCode: 403, message: 'Superadmin não pode ser excluído.' })
  }

  await admin.from('profiles').delete().eq('id', adminId)
  const { error: delErr } = await admin.auth.admin.deleteUser(adminId)
  if (delErr) throw createError({ statusCode: 400, message: delErr.message })

  return { ok: true }
})
