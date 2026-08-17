import { createClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_KEY!
  const serviceKey = config.supabaseServiceKey

  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

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

  const body = await readBody(event)
  const { nome, email, senha, unidadeId } = body

  if (!email || !senha || !nome || !unidadeId) {
    throw createError({ statusCode: 400, message: 'Campos obrigatórios faltando' })
  }

  if (senha.length < 8) {
    throw createError({ statusCode: 400, message: 'Senha deve ter pelo menos 8 caracteres' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })

  if (createAuthError) {
    const jaExiste = /already been registered|already exists/i.test(createAuthError.message)
    throw createError({
      statusCode: 400,
      message: jaExiste
        ? 'Este e-mail já está cadastrado para outro usuário.'
        : createAuthError.message,
    })
  }

  const userId = authData.user.id

  try {
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      role: 'atendente',
      nome,
    })
    if (profileError) throw profileError

    const { error: atendenteError } = await admin.from('atendentes').insert({
      user_id: userId,
      nome,
      unidade_id: unidadeId,
      ativo: true,
    })
    if (atendenteError) throw atendenteError

    return { ok: true, userId }
  } catch (err: any) {
    await admin.auth.admin.deleteUser(userId)
    const bruto = err?.message ?? ''
    let amigavel = bruto || 'Erro ao cadastrar atendente'
    if (/duplicate key/i.test(bruto)) amigavel = 'Já existe um cadastro com esses dados.'
    throw createError({ statusCode: 400, message: amigavel })
  }
})
