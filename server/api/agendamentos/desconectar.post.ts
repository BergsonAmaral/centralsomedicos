import { createClient } from '@supabase/supabase-js'

/**
 * Chamado via navigator.sendBeacon quando o paciente ou o médico fecha a aba
 * / navegador no meio de uma consulta (sem clicar em "Encerrar"). Reverte o
 * status para o estado de espera correspondente, para que o outro lado saiba
 * que a pessoa saiu, em vez de ficar preso numa consulta fantasma.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = config.supabaseServiceKey

  if (!serviceKey) {
    throw createError({ statusCode: 500, message: 'Service key não configurada' })
  }

  const body = await readBody<{ agendamentoId?: string; quem?: 'paciente' | 'medico' }>(event)
  const { agendamentoId, quem } = body ?? {}

  if (!agendamentoId || (quem !== 'paciente' && quem !== 'medico')) {
    throw createError({ statusCode: 400, message: 'Parâmetros inválidos' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Só reverte se a consulta ainda estava em andamento — evita sobrescrever
  // um encerramento normal que já tenha acontecido concorrentemente.
  const novoStatus = quem === 'paciente' ? 'aguardando_paciente' : 'aguardando_medico'

  await admin
    .from('agendamentos')
    .update({ status: novoStatus })
    .eq('id', agendamentoId)
    .eq('status', 'em_consulta')

  return { ok: true }
})
