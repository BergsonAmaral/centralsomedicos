import { createClient } from '@supabase/supabase-js'

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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: medico, error } = await admin
    .from('medicos')
    .select('user_id')
    .eq('id', id)
    .single()
  if (error || !medico?.user_id) {
    throw createError({ statusCode: 404, message: 'Médico ou usuário não encontrado' })
  }

  const updates: { email?: string; password?: string } = {}
  if (email) updates.email = email
  if (senha) updates.password = senha

  const { error: updErr } = await admin.auth.admin.updateUserById(medico.user_id, updates)
  if (updErr) throw createError({ statusCode: 400, message: updErr.message })

  return { ok: true }
})
