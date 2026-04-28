import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Verifica se o chamador é admin via anon client (cookie de sessão)
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_KEY!
  const serviceKey = config.supabaseServiceKey

  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

  const body = await readBody(event)
  const { nome, crm, especialidade, email, senha, foto_url, valor_consulta } = body

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
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // confirma automaticamente (sem precisar de e-mail)
  })

  if (authError) {
    throw createError({ statusCode: 400, message: authError.message })
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
    })

    if (medicoError) throw medicoError

    return { ok: true, userId }
  } catch (err: any) {
    // Rollback: deletar usuário criado se algo falhou
    await admin.auth.admin.deleteUser(userId)
    throw createError({ statusCode: 500, message: err.message ?? 'Erro ao cadastrar médico' })
  }
})
