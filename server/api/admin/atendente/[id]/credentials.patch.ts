import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const body = await readBody<{ email?: string; senha?: string }>(event)
  const { email, senha } = body
  if (!email && !senha) {
    throw createError({ statusCode: 400, message: 'Informe e-mail e/ou senha.' })
  }
  if (senha && senha.length < 8) {
    throw createError({ statusCode: 400, message: 'Senha deve ter pelo menos 8 caracteres' })
  }

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  if (!serviceKey) throw createError({ statusCode: 500, message: 'Service key não configurada' })

  // Verifica se o chamador é admin autenticado
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
    .select('user_id')
    .eq('id', id)
    .single()
  if (error || !atendente?.user_id) {
    throw createError({ statusCode: 404, message: 'Atendente ou usuário não encontrado' })
  }

  const updates: { email?: string; password?: string } = {}
  if (email) updates.email = email
  if (senha) updates.password = senha

  const { error: updErr } = await admin.auth.admin.updateUserById(atendente.user_id, updates)
  if (updErr) {
    const jaExiste = /already been registered|already exists/i.test(updErr.message)
    throw createError({ statusCode: 400, message: jaExiste ? 'Este e-mail já está em uso por outra conta.' : updErr.message })
  }

  return { ok: true }
})
