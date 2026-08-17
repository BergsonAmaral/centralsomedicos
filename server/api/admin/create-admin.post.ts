import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

  // Só superadmin pode criar outro admin
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
    throw createError({ statusCode: 403, message: 'Só superadmin pode cadastrar novos admins' })
  }

  const body = await readBody(event)
  const { nome, email, senha } = body

  if (!nome || !email || !senha) {
    throw createError({ statusCode: 400, message: 'Campos obrigatórios faltando' })
  }
  if (senha.length < 8) {
    throw createError({ statusCode: 400, message: 'Senha deve ter pelo menos 8 caracteres' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
  })
  if (createAuthError) {
    const jaExiste = /already been registered|already exists/i.test(createAuthError.message)
    throw createError({
      statusCode: 400,
      message: jaExiste ? 'Este e-mail já está cadastrado para outro usuário.' : createAuthError.message,
    })
  }

  const userId = authData.user.id
  // Admins criados por aqui nascem como admin comum — virar superadmin
  // exige alterar o banco diretamente, não tem UI pra isso de propósito.
  const { error: profileError } = await admin.from('profiles').insert({
    id: userId, role: 'admin', nome, is_superadmin: false,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    throw createError({ statusCode: 400, message: profileError.message })
  }

  return { ok: true, userId }
})
