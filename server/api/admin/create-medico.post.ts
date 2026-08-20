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
  const { nome, crm, especialidade, email, senha, foto_url, valor_consulta, valor_hora, meta_atendimentos_hora, valor_hora_bonus } = body

  if (!email || !senha || !nome || !crm || !especialidade) {
    throw createError({ statusCode: 400, message: 'Campos obrigatórios faltando' })
  }

  if (senha.length < 8) {
    throw createError({ statusCode: 400, message: 'Senha deve ter pelo menos 8 caracteres' })
  }

  // Client com service role — pode criar usuários
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Criar usuário no Auth
  const { data: authData, error: createAuthError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // confirma automaticamente (sem precisar de e-mail)
  })

  if (createAuthError) {
    // O Supabase responde em inglês; traduz o caso mais comum
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
    // 2. Inserir perfil com role 'medico'
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      role: 'medico',
      nome,
    })

    if (profileError) throw profileError

    // 3. Inserir médico vinculado ao usuário
    const { error: medicoError } = await admin.from('medicos').insert({
      user_id: userId,
      nome,
      crm,
      especialidade,
      foto_url: foto_url || null,
      ativo: true,
      pausado: false,
      valor_consulta: valor_consulta ?? 0,
      valor_hora: valor_hora ?? null,
      meta_atendimentos_hora: meta_atendimentos_hora ?? null,
      valor_hora_bonus: valor_hora_bonus ?? null,
    })

    if (medicoError) throw medicoError

    return { ok: true, userId }
  } catch (err: any) {
    // Rollback: deletar usuário criado se algo falhou
    await admin.auth.admin.deleteUser(userId)

    // Erros de constraint do Postgres são ilegíveis para quem está usando
    // o sistema ("duplicate key value violates unique constraint ...")
    const bruto = err?.message ?? ''
    let amigavel = bruto || 'Erro ao cadastrar médico'
    if (/duplicate key/i.test(bruto)) {
      if (/crm/i.test(bruto)) amigavel = 'Já existe um médico cadastrado com este CRM.'
      else amigavel = 'Já existe um cadastro com esses dados.'
    }
    throw createError({ statusCode: 400, message: amigavel })
  }
})
