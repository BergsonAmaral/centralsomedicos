import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const serviceKey = config.supabaseServiceKey
  const supabaseUrl = process.env.SUPABASE_URL!

  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

  const body = await readBody(event)
  const { agendamentoId, nota, comentario } = body

  if (!agendamentoId || !nota || nota < 1 || nota > 5) {
    throw createError({ statusCode: 400, message: 'agendamentoId e nota (1-5) são obrigatórios' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verifica que o agendamento realmente está em aguardando_avaliacao
  const { data: ag, error: agError } = await admin
    .from('agendamentos')
    .select('id, status')
    .eq('id', agendamentoId)
    .eq('status', 'aguardando_avaliacao')
    .single()

  if (agError || !ag) {
    throw createError({ statusCode: 404, message: 'Agendamento não encontrado ou status inválido' })
  }

  // Atualiza a consulta com a avaliação
  await admin
    .from('consultas')
    .update({
      avaliacao_nota: nota,
      avaliacao_comentario: comentario ?? null,
    })
    .eq('agendamento_id', agendamentoId)

  // Finaliza o agendamento
  const { error: updateError } = await admin
    .from('agendamentos')
    .update({ status: 'concluido' })
    .eq('id', agendamentoId)

  if (updateError) {
    throw createError({ statusCode: 500, message: updateError.message })
  }

  return { ok: true }
})
