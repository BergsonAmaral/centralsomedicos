import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID obrigatório' })

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey
  if (!serviceKey) throw createError({ statusCode: 500, message: 'Service key não configurada' })

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Busca o médico
  const { data: medico, error } = await admin
    .from('medicos')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !medico) {
    throw createError({ statusCode: 404, message: 'Médico não encontrado' })
  }

  // Busca o email no auth.users
  let email: string | null = null
  if (medico.user_id) {
    const { data: userData } = await admin.auth.admin.getUserById(medico.user_id)
    email = userData?.user?.email ?? null
  }

  return { ...medico, email }
})
